from fastapi import FastAPI, APIRouter, HTTPException, Query, Request
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from apify_client import (
    fetch_profile,
    fetch_post_comments,
    fetch_connection_list,
    clear_profile_cache,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Rate limiter (per IP)
limiter = Limiter(key_func=get_remote_address)

# Scheduler (declared before startup handler)
scheduler = AsyncIOScheduler(timezone="UTC")

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")


class TrackedAccount(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    tracking_since: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_updated: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ========== Core endpoints ==========

@api_router.get("/")
async def root():
    return {"message": "Sherlock API v3.0 - Live Instagram Intelligence"}


@api_router.get("/image-proxy")
@limiter.limit("300/minute")
async def image_proxy(request: Request, url: str = Query(...)):
    """Proxy Instagram CDN images to bypass Cross-Origin-Resource-Policy."""
    from urllib.parse import urlparse
    try:
        host = urlparse(url).hostname or ""
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL")

    allowed = ('cdninstagram.com', 'fbcdn.net', 'instagram.com')
    if not any(host.endswith(d) or host == d for d in allowed):
        raise HTTPException(status_code=400, detail="Invalid image host")

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as http:
        try:
            r = await http.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            })
            r.raise_for_status()
        except Exception as e:
            logger.error(f"Image proxy failed: {e}")
            raise HTTPException(status_code=502, detail="Failed to fetch image")

    if len(r.content) > 5_000_000:
        raise HTTPException(status_code=413, detail="Image too large")

    return Response(
        content=r.content,
        media_type=r.headers.get('content-type', 'image/jpeg'),
        headers={"Cache-Control": "public, max-age=3600"}
    )


# ========== Tracked accounts CRUD ==========

@api_router.get("/accounts")
async def get_tracked_accounts():
    accounts = await db.tracked_accounts.find({}, {"_id": 0}).to_list(200)
    return accounts


@api_router.post("/accounts")
@limiter.limit("30/minute")
async def add_tracked_account(request: Request, username: str):
    username = username.strip().lstrip('@').lower()
    if not username:
        raise HTTPException(status_code=400, detail="Username required")

    existing = await db.tracked_accounts.find_one({"username": username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Account already tracked")

    profile = await fetch_profile(username)

    account = TrackedAccount(username=profile['username'])
    await db.tracked_accounts.insert_one(account.model_dump())

    await db.follower_snapshots.insert_one({
        "username": profile['username'],
        "followers": profile['followers'],
        "following": profile['following'],
        "posts": profile['posts'],
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    return {**account.model_dump(), "profile": profile}


@api_router.delete("/accounts/{username}")
async def remove_tracked_account(username: str):
    username = username.strip().lstrip('@').lower()
    result = await db.tracked_accounts.delete_one({"username": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    # Clean up related data
    await db.follower_snapshots.delete_many({"username": username})
    await db.connection_snapshots.delete_many({"username": username})
    return {"message": "Account removed"}


# ========== Profile data ==========

@api_router.get("/profile/{username}")
async def get_profile_endpoint(username: str):
    username = username.strip().lstrip('@').lower()
    profile = await fetch_profile(username)

    tracked = await db.tracked_accounts.find_one({"username": username})
    if tracked:
        last = await db.follower_snapshots.find_one(
            {"username": username}, {"_id": 0}, sort=[("timestamp", -1)]
        )
        should_snapshot = True
        if last:
            try:
                last_ts = datetime.fromisoformat(last["timestamp"])
                if (datetime.now(timezone.utc) - last_ts).total_seconds() < 3600:
                    should_snapshot = False
            except Exception:
                pass
        if should_snapshot:
            await db.follower_snapshots.insert_one({
                "username": username,
                "followers": profile['followers'],
                "following": profile['following'],
                "posts": profile['posts'],
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

    return profile


@api_router.get("/profile/{username}/history")
async def get_follower_history(username: str):
    username = username.strip().lstrip('@').lower()
    snapshots = await db.follower_snapshots.find(
        {"username": username}, {"_id": 0}
    ).sort("timestamp", 1).to_list(500)
    return snapshots


@api_router.get("/profile/{username}/activity")
async def get_activity(username: str):
    username = username.strip().lstrip('@').lower()
    profile = await fetch_profile(username)

    activity = []
    for post in profile.get('recent_posts', []):
        activity.append({
            'type': 'post',
            'content': post.get('caption', '')[:150] or 'Posted new content',
            'likes': post.get('likes', 0),
            'comments': post.get('comments', 0),
            'timestamp': post.get('timestamp', ''),
            'media_url': post.get('display_url', ''),
            'post_url': post.get('url', ''),
            'post_type': post.get('type', 'Image')
        })
    return activity


# ========== Connections (followers/following + diffs) ==========

async def _snapshot_connections(username: str, connection_type: str, limit: int = 100, since_days: int = 7):
    """
    Fetch current connections list + compute diff against snapshot from `since_days` ago.

    Important: Instagram's public API returns the following list in REVERSE-CHRONOLOGICAL order
    (most recently followed appears first). We use position-in-current-list as recency.

    - Newly added users are returned in current-list order → newest follow first.
    - `since_days=0` uses the most recent previous snapshot (last check).
    - Uses profile-level counts (real total) alongside scraped list (may be capped at ~200).
    """
    # Real total count from profile (uses cache)
    profile = await fetch_profile(username)
    profile_count_field = 'followers' if connection_type == 'followers' else 'following'
    real_total = profile.get(profile_count_field, 0)

    current_list = await fetch_connection_list(username, connection_type, limit)
    current_usernames = [c['username'] for c in current_list if c.get('username')]
    quota_exhausted = len(current_list) == 0

    # Find comparison snapshot for FULL LIST diff
    if since_days > 0:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=since_days)).isoformat()
        old_snapshot = await db.connection_snapshots.find_one(
            {
                "username": username,
                "type": connection_type,
                "timestamp": {"$lte": cutoff}
            },
            {"_id": 0},
            sort=[("timestamp", -1)]
        )
        comparison_label = f"past {since_days} day{'s' if since_days != 1 else ''}"

        # Also find count-based baseline from follower_snapshots (which is snapshotted every 6h by scheduler)
        old_count_snapshot = await db.follower_snapshots.find_one(
            {"username": username, "timestamp": {"$lte": cutoff}},
            {"_id": 0},
            sort=[("timestamp", -1)]
        )
    else:
        old_snapshot = await db.connection_snapshots.find_one(
            {"username": username, "type": connection_type},
            {"_id": 0},
            sort=[("timestamp", -1)]
        )
        comparison_label = "last check"
        old_count_snapshot = await db.follower_snapshots.find_one(
            {"username": username},
            {"_id": 0},
            sort=[("timestamp", -1)]
        )

    # Full-list diff (only works if we have a baseline snapshot with usernames)
    added_usernames = []
    removed_usernames = []
    if old_snapshot:
        prev_usernames = set(old_snapshot.get('usernames', []))
        current_set = set(current_usernames)
        added_set = current_set - prev_usernames
        removed_usernames = list(prev_usernames - current_set)
        added_usernames = [u for u in current_usernames if u in added_set]

    # Count-based net change (always works if we have any follower_snapshot from the period)
    net_change = None
    baseline_count = None
    if old_count_snapshot:
        baseline_count = old_count_snapshot.get(profile_count_field, 0)
        net_change = real_total - baseline_count

    # Only save non-empty snapshots
    if current_usernames:
        await db.connection_snapshots.insert_one({
            "username": username,
            "type": connection_type,
            "usernames": current_usernames,
            "count": len(current_usernames),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

    user_map = {c['username']: c for c in current_list if c.get('username')}

    # Most recent = top of Instagram's list (reverse-chronological for 'following')
    most_recent = current_list[:20] if connection_type == 'following' else []

    # Smart-scoped list: only show the N newest users where N = numeric count-diff
    # Since Instagram returns following list newest-first, current_list[:N] are exactly
    # the N users followed in the period. Works even without a full-list baseline.
    smart_recent = []
    if connection_type == 'following' and net_change is not None and net_change > 0:
        smart_recent = current_list[:min(net_change, len(current_list))]
    elif connection_type == 'followers' and net_change is not None and net_change > 0:
        # Followers list ordering isn't guaranteed reverse-chronological by IG, but
        # top-of-list is still the best public proxy for "recent"
        smart_recent = current_list[:min(net_change, len(current_list))]

    return {
        "current": current_list,
        "most_recent": most_recent,
        "smart_recent": smart_recent,
        "added_details": [user_map.get(u, {"username": u}) for u in added_usernames],
        "removed_usernames": removed_usernames,
        "profile_count": real_total,
        "sample_count": len(current_list),
        "total_count": real_total,
        "net_change": net_change,
        "baseline_count": baseline_count,
        "quota_exhausted": quota_exhausted,
        "comparison_period": comparison_label,
        "has_baseline": old_snapshot is not None,
        "has_count_baseline": old_count_snapshot is not None,
        "baseline_timestamp": old_snapshot.get('timestamp') if old_snapshot else (old_count_snapshot.get('timestamp') if old_count_snapshot else None),
    }


@api_router.get("/profile/{username}/followers-list")
@limiter.limit("10/minute")
async def get_followers_list(request: Request, username: str, limit: int = Query(100, ge=1, le=500), since_days: int = Query(7, ge=0, le=365)):
    """Fetch current followers list + detect new/lost since `since_days` ago."""
    username = username.strip().lstrip('@').lower()
    return await _snapshot_connections(username, "followers", limit, since_days)


@api_router.get("/profile/{username}/following-list")
@limiter.limit("10/minute")
async def get_following_list(request: Request, username: str, limit: int = Query(100, ge=1, le=500), since_days: int = Query(7, ge=0, le=365)):
    """
    Fetch current following list + detect who was followed/unfollowed in past `since_days`.
    Results are ordered by recency (most recently followed first).
    """
    username = username.strip().lstrip('@').lower()
    return await _snapshot_connections(username, "following", limit, since_days)


@api_router.get("/profile/{username}/connection-history")
async def get_connection_history(username: str, connection_type: str = "followers"):
    """Return historical snapshots showing connection count over time."""
    username = username.strip().lstrip('@').lower()
    snapshots = await db.connection_snapshots.find(
        {"username": username, "type": connection_type},
        {"_id": 0, "usernames": 0}  # exclude big usernames arrays
    ).sort("timestamp", 1).to_list(200)
    return snapshots


# ========== Comments on their posts ==========

@api_router.get("/profile/{username}/post-comments")
@limiter.limit("15/minute")
async def get_recent_post_comments(request: Request, username: str, posts_limit: int = 3, comments_limit: int = 20):
    """
    Fetch comments FROM OTHER USERS on this account's recent posts.
    NOTE: Instagram does NOT publicly expose comments that a user has made
    on OTHER accounts' posts, nor posts they've liked.
    """
    username = username.strip().lstrip('@').lower()
    profile = await fetch_profile(username)
    posts = profile.get('recent_posts', [])[:posts_limit]

    all_comments = []
    for post in posts:
        post_url = post.get('url')
        if not post_url:
            continue
        try:
            comments = await fetch_post_comments(post_url, comments_limit)
            for c in comments:
                c['post_url'] = post_url
                c['post_caption'] = post.get('caption', '')[:80]
                c['post_thumbnail'] = post.get('display_url', '')
            all_comments.extend(comments)
        except Exception as e:
            logger.error(f"Failed to fetch comments for {post_url}: {e}")
            continue

    # Sort by likes desc
    all_comments.sort(key=lambda c: c.get('likes', 0), reverse=True)
    return all_comments


# ========== Aggregated dashboard endpoint ==========

@api_router.get("/dashboard")
async def get_dashboard():
    """Aggregated data for the dashboard, avoiding N+1 client-side fetches."""
    accounts = await db.tracked_accounts.find({}, {"_id": 0}).to_list(200)

    accounts_with_data = []
    total_followers = 0
    total_following = 0
    total_posts = 0

    for acc in accounts:
        username = acc['username']
        try:
            profile = await fetch_profile(username)  # uses cache
            accounts_with_data.append({
                **acc,
                "profile": profile
            })
            total_followers += profile.get('followers', 0)
            total_following += profile.get('following', 0)
            total_posts += profile.get('posts', 0)
        except Exception as e:
            logger.error(f"Dashboard fetch failed for {username}: {e}")
            accounts_with_data.append({**acc, "profile": None})

    return {
        "accounts": accounts_with_data,
        "totals": {
            "tracked": len(accounts),
            "followers": total_followers,
            "following": total_following,
            "posts": total_posts
        }
    }


# ========== Relationships graph ==========

@api_router.get("/relationships")
async def get_relationships():
    accounts = await db.tracked_accounts.find({}, {"_id": 0}).to_list(200)

    nodes = []
    for acc in accounts:
        username = acc['username']
        try:
            profile = await fetch_profile(username)  # uses cache
            nodes.append({
                "id": username,
                "label": username,
                "category": profile.get('category', 'personal'),
                "followers": profile.get('followers', 0),
                "verified": profile.get('is_verified', False)
            })
        except Exception:
            nodes.append({"id": username, "label": username, "category": "unknown", "followers": 0, "verified": False})

    links = []
    for i, node_a in enumerate(nodes):
        for node_b in nodes[i+1:]:
            if node_a['category'] == node_b['category'] and node_a['category'] not in ('unknown', 'personal'):
                links.append({"source": node_a['id'], "target": node_b['id'], "value": 5})

    return {"nodes": nodes, "links": links}


# ========== AI Insights ==========

@api_router.get("/insights/{username}")
@limiter.limit("10/minute")
async def get_ai_insights(request: Request, username: str):
    username = username.strip().lstrip('@').lower()
    profile = await fetch_profile(username)

    if not EMERGENT_LLM_KEY:
        return {"insights": "AI insights unavailable. Emergent LLM key not configured."}

    posts_summary = ""
    for post in profile.get('recent_posts', [])[:5]:
        posts_summary += f"\n- {post.get('likes', 0)} likes, {post.get('comments', 0)} comments: {post.get('caption', '')[:100]}"

    engagement_rate = 0.0
    if profile.get('recent_posts') and profile.get('followers', 0) > 0:
        total_engagement = sum(p.get('likes', 0) + p.get('comments', 0) for p in profile['recent_posts'])
        avg = total_engagement / len(profile['recent_posts'])
        engagement_rate = (avg / profile['followers']) * 100

    prompt = f"""Analyze this Instagram account and provide a concise marketing intelligence brief in 4 sections:

Account: @{profile['username']} ({profile['full_name']})
Bio: {profile['bio']}
Category: {profile['category']}
Followers: {profile['followers']:,}
Following: {profile['following']:,}
Total Posts: {profile['posts']}
Verified: {profile['is_verified']}
Business Account: {profile['is_business']}
Avg Engagement Rate: {engagement_rate:.2f}%

Recent Posts:{posts_summary}

Provide analysis in this exact format:

**Content Strategy**: [2 sentences]
**Audience Profile**: [2 sentences]
**Engagement Analysis**: [2 sentences]
**Recommendation**: [2 sentences with actionable advice]"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"insights-{username}-{datetime.now(timezone.utc).timestamp()}",
            system_message="You are an expert Instagram marketing analyst. Provide sharp, data-driven insights."
        ).with_model("openai", "gpt-5.4")

        response = await chat.send_message(UserMessage(text=prompt))
        return {
            "insights": response,
            "metrics": {
                "engagement_rate": round(engagement_rate, 2),
                "followers": profile['followers'],
                "posts_analyzed": len(profile.get('recent_posts', []))
            }
        }
    except Exception as e:
        logger.error(f"LLM error: {e}")
        raise HTTPException(status_code=502, detail=f"AI insights generation failed: {str(e)[:200]}")


# ========== Search ==========

@api_router.get("/search")
@limiter.limit("30/minute")
async def search_profile(request: Request, q: str):
    q = q.strip().lstrip('@').lower()
    if not q:
        return []
    try:
        profile = await fetch_profile(q)
        return [profile]
    except HTTPException:
        return []
    except Exception as e:
        logger.error(f"Search error: {e}")
        return []


# ========== Scheduler ==========

async def snapshot_all_tracked_accounts():
    """Snapshot follower counts + following LIST (for recency diff) for all tracked accounts."""
    try:
        accounts = await db.tracked_accounts.find({}, {"_id": 0}).to_list(200)
        logger.info(f"[Scheduler] Running snapshot for {len(accounts)} tracked accounts")
        for acc in accounts:
            username = acc['username']
            try:
                # Profile counts snapshot (cheap - single Apify call)
                clear_profile_cache(username)
                profile = await fetch_profile(username)
                await db.follower_snapshots.insert_one({
                    "username": username,
                    "followers": profile['followers'],
                    "following": profile['following'],
                    "posts": profile['posts'],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                logger.info(f"[Scheduler] Profile snapshot saved for @{username}: {profile['followers']} followers")
                await asyncio.sleep(3)

                # Following-list snapshot (uses limited-quota actor - only do once per day per account)
                last_following = await db.connection_snapshots.find_one(
                    {"username": username, "type": "following"},
                    {"_id": 0},
                    sort=[("timestamp", -1)]
                )
                should_snapshot_following = True
                if last_following:
                    try:
                        last_ts = datetime.fromisoformat(last_following["timestamp"])
                        if (datetime.now(timezone.utc) - last_ts).total_seconds() < 86400:
                            should_snapshot_following = False
                    except Exception:
                        pass
                if should_snapshot_following:
                    try:
                        await _snapshot_connections(username, "following", limit=100, since_days=7)
                        logger.info(f"[Scheduler] Following-list snapshot saved for @{username}")
                    except Exception as e:
                        logger.warning(f"[Scheduler] Following-list snapshot skipped for @{username}: {e}")
                    await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"[Scheduler] Failed to snapshot @{username}: {e}")
    except Exception as e:
        logger.error(f"[Scheduler] snapshot_all_tracked_accounts failed: {e}")


@app.on_event("startup")
async def start_scheduler():
    scheduler.add_job(
        snapshot_all_tracked_accounts,
        'interval',
        hours=6,
        id='auto_snapshot',
        replace_existing=True,
        next_run_time=datetime.now(timezone.utc)
    )
    scheduler.start()
    logger.info("[Scheduler] Started auto-snapshot job (every 6h)")


@app.on_event("shutdown")
async def shutdown_handler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
    mongo_client.close()


# ========== Wire up ==========

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
