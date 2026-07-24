from fastapi import FastAPI, APIRouter, HTTPException, Query
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
from datetime import datetime, timezone
import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage
from apscheduler.schedulers.asyncio import AsyncIOScheduler

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

APIFY_TOKEN = os.environ.get('APIFY_API_TOKEN')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# In-memory cache for profile data (TTL 15 min) to reduce Apify usage & speed up UI
profile_cache = {}
CACHE_TTL = 900  # 15 minutes


async def fetch_instagram_profile(username: str) -> dict:
    """Fetch real Instagram profile data via Apify Instagram Profile Scraper."""
    cache_key = f"profile_{username}"
    now = datetime.now(timezone.utc).timestamp()

    if cache_key in profile_cache:
        cached = profile_cache[cache_key]
        if now - cached['timestamp'] < CACHE_TTL:
            return cached['data']

    if not APIFY_TOKEN:
        raise HTTPException(status_code=500, detail="Apify API token not configured")

    url = f"https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token={APIFY_TOKEN}"
    payload = {"usernames": [username]}

    async with httpx.AsyncClient(timeout=120.0) as http:
        try:
            resp = await http.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Apify HTTP error: {e.response.status_code} - {e.response.text[:200]}")
            raise HTTPException(status_code=502, detail=f"Apify error: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Apify request failed: {e}")
            raise HTTPException(status_code=502, detail="Failed to fetch profile data")

    if not data or len(data) == 0:
        raise HTTPException(status_code=404, detail=f"Instagram profile @{username} not found")

    p = data[0]
    if p.get('error'):
        raise HTTPException(status_code=404, detail=f"Instagram profile @{username} not found or is inaccessible")

    category_raw = p.get('businessCategoryName')
    if not category_raw or str(category_raw).lower() in ('none', 'null', ''):
        category_raw = 'personal'

    profile = {
        'username': p.get('username', username),
        'full_name': p.get('fullName') or p.get('username', username),
        'bio': p.get('biography', ''),
        'followers': p.get('followersCount', 0),
        'following': p.get('followsCount', 0),
        'posts': p.get('postsCount', 0),
        'profile_pic': p.get('profilePicUrlHD') or p.get('profilePicUrl', ''),
        'is_verified': p.get('verified', False),
        'is_private': p.get('private', False),
        'is_business': p.get('isBusinessAccount', False),
        'external_url': p.get('externalUrl') or '',
        'category': category_raw,
        'recent_posts': [],
    }

    latest = p.get('latestPosts', []) or []
    for post in latest[:12]:
        profile['recent_posts'].append({
            'id': post.get('id') or post.get('shortCode', ''),
            'shortcode': post.get('shortCode', ''),
            'caption': (post.get('caption') or '')[:200],
            'likes': post.get('likesCount', 0),
            'comments': post.get('commentsCount', 0),
            'timestamp': post.get('timestamp', ''),
            'display_url': post.get('displayUrl', ''),
            'type': post.get('type', 'Image'),
            'url': post.get('url', ''),
        })

    profile_cache[cache_key] = {'timestamp': now, 'data': profile}
    return profile


class TrackedAccount(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    tracking_since: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_updated: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@api_router.get("/")
async def root():
    return {"message": "Sherlock API v2.0 - Live Instagram Data"}


@api_router.get("/image-proxy")
async def image_proxy(url: str = Query(...)):
    """Proxy Instagram CDN images to bypass Cross-Origin-Resource-Policy header."""
    if not url or ('cdninstagram.com' not in url and 'fbcdn.net' not in url and 'instagram.com' not in url):
        raise HTTPException(status_code=400, detail="Invalid image URL")

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as http:
        try:
            r = await http.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            })
            r.raise_for_status()
        except Exception as e:
            logger.error(f"Image proxy failed: {e}")
            raise HTTPException(status_code=502, detail="Failed to fetch image")

    return Response(
        content=r.content,
        media_type=r.headers.get('content-type', 'image/jpeg'),
        headers={"Cache-Control": "public, max-age=3600"}
    )


@api_router.get("/accounts")
async def get_tracked_accounts():
    accounts = await db.tracked_accounts.find({}, {"_id": 0}).to_list(200)
    return accounts


@api_router.post("/accounts")
async def add_tracked_account(username: str):
    username = username.strip().lstrip('@').lower()
    if not username:
        raise HTTPException(status_code=400, detail="Username required")

    existing = await db.tracked_accounts.find_one({"username": username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Account already tracked")

    # Verify the account exists on Instagram (real data)
    profile = await fetch_instagram_profile(username)

    account = TrackedAccount(username=profile['username'])
    doc = account.model_dump()
    await db.tracked_accounts.insert_one(doc)

    # Store initial snapshot for history tracking
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
    return {"message": "Account removed"}


@api_router.get("/profile/{username}")
async def get_profile(username: str):
    username = username.strip().lstrip('@').lower()
    profile = await fetch_instagram_profile(username)

    # Auto-snapshot for tracked accounts
    tracked = await db.tracked_accounts.find_one({"username": username})
    if tracked:
        # Only insert snapshot if last one is > 1 hour old
        last = await db.follower_snapshots.find_one(
            {"username": username},
            {"_id": 0},
            sort=[("timestamp", -1)]
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
        {"username": username},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(500)
    return snapshots


@api_router.get("/profile/{username}/activity")
async def get_activity(username: str):
    """Return recent posts as activity feed."""
    username = username.strip().lstrip('@').lower()
    profile = await fetch_instagram_profile(username)

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


@api_router.get("/relationships")
async def get_relationships():
    """Build relationship graph based on tracked accounts."""
    accounts = await db.tracked_accounts.find({}, {"_id": 0}).to_list(200)

    nodes = []
    links = []

    for acc in accounts:
        username = acc['username']
        # Use cached data if available; skip Apify call for relationship view
        cache_key = f"profile_{username}"
        cached = profile_cache.get(cache_key)
        if cached:
            p = cached['data']
            nodes.append({
                "id": username,
                "label": username,
                "category": p.get('category', 'personal'),
                "followers": p.get('followers', 0),
                "verified": p.get('is_verified', False)
            })
        else:
            nodes.append({
                "id": username,
                "label": username,
                "category": 'unknown',
                "followers": 0,
                "verified": False
            })

    # Create links between accounts sharing category
    for i, node_a in enumerate(nodes):
        for node_b in nodes[i+1:]:
            if node_a['category'] == node_b['category'] and node_a['category'] != 'unknown':
                links.append({
                    "source": node_a['id'],
                    "target": node_b['id'],
                    "value": 5
                })

    return {"nodes": nodes, "links": links}


@api_router.get("/insights/{username}")
async def get_ai_insights(username: str):
    username = username.strip().lstrip('@').lower()

    profile = await fetch_instagram_profile(username)

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
        return {"insights": f"Unable to generate AI insights: {str(e)[:200]}"}


@api_router.get("/search")
async def search_profile(q: str):
    """Search returns a single profile preview for exact username match."""
    q = q.strip().lstrip('@').lower()
    if not q:
        return []

    try:
        profile = await fetch_instagram_profile(q)
        return [profile]
    except HTTPException:
        return []
    except Exception as e:
        logger.error(f"Search error: {e}")
        return []


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    if scheduler.running:
        scheduler.shutdown(wait=False)
    client.close()


# Scheduled task: snapshot all tracked accounts every 6 hours for historical trend data
scheduler = AsyncIOScheduler(timezone="UTC")


async def snapshot_all_tracked_accounts():
    """Automatically capture follower snapshots for all tracked accounts."""
    try:
        accounts = await db.tracked_accounts.find({}, {"_id": 0}).to_list(200)
        logger.info(f"[Scheduler] Running snapshot for {len(accounts)} tracked accounts")
        for acc in accounts:
            username = acc['username']
            try:
                # Force fresh fetch by removing from cache
                profile_cache.pop(f"profile_{username}", None)
                profile = await fetch_instagram_profile(username)
                await db.follower_snapshots.insert_one({
                    "username": username,
                    "followers": profile['followers'],
                    "following": profile['following'],
                    "posts": profile['posts'],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                logger.info(f"[Scheduler] Snapshot saved for @{username}: {profile['followers']} followers")
                # Space out Apify calls to avoid rate limits
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
        next_run_time=datetime.now(timezone.utc)  # Run first job in ~immediately after startup
    )
    scheduler.start()
    logger.info("[Scheduler] Started auto-snapshot job (every 6h)")
