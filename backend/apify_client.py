"""Apify Instagram API client for Sherlock."""
import os
import logging
import httpx
from datetime import datetime, timezone
from fastapi import HTTPException
from pathlib import Path
from dotenv import load_dotenv

# Load env at module init so APIFY_TOKEN is available regardless of import order
load_dotenv(Path(__file__).parent / '.env')

logger = logging.getLogger(__name__)


def _get_token() -> str:
    return os.environ.get('APIFY_API_TOKEN', '')

_cache = {}
CACHE_TTL = 900  # 15 min
CACHE_TTL_LONG = 21600  # 6 hrs for expensive follower/following lists


def _cache_get(key: str, ttl: int = CACHE_TTL):
    now = datetime.now(timezone.utc).timestamp()
    entry = _cache.get(key)
    if entry and now - entry['ts'] < ttl:
        return entry['data']
    return None


def _cache_set(key: str, data):
    _cache[key] = {'ts': datetime.now(timezone.utc).timestamp(), 'data': data}


def clear_profile_cache(username: str):
    _cache.pop(f"profile_{username}", None)


async def _apify_run(actor_id: str, payload: dict, timeout: float = 180.0) -> list:
    token = _get_token()
    if not token:
        raise HTTPException(status_code=500, detail="Apify API token not configured")

    url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items?token={token}"

    async with httpx.AsyncClient(timeout=timeout) as http:
        try:
            resp = await http.post(url, json=payload)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Apify {actor_id} HTTP error: {e.response.status_code} - {e.response.text[:200]}")
            raise HTTPException(status_code=502, detail=f"Apify error: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Apify {actor_id} request failed: {e}")
            raise HTTPException(status_code=502, detail="Failed to fetch data from Apify")


async def fetch_profile(username: str) -> dict:
    cache_key = f"profile_{username}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    data = await _apify_run("apify~instagram-profile-scraper", {"usernames": [username]})

    if not data:
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

    _cache_set(cache_key, profile)
    return profile


async def fetch_post_comments(post_url: str, limit: int = 30) -> list:
    cache_key = f"comments_{post_url}_{limit}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    data = await _apify_run(
        "apify~instagram-comment-scraper",
        {"directUrls": [post_url], "resultsLimit": limit},
        timeout=120.0
    )

    comments = []
    for c in data or []:
        if c.get('error'):
            continue
        comments.append({
            'id': c.get('id', ''),
            'author': c.get('ownerUsername', ''),
            'author_pic': c.get('ownerProfilePicUrl', ''),
            'text': c.get('text', ''),
            'likes': c.get('likesCount', 0),
            'timestamp': c.get('timestamp', ''),
            'replies_count': c.get('repliesCount', 0),
        })

    _cache_set(cache_key, comments)
    return comments


async def fetch_connection_list(username: str, connection_type: str = "followers", limit: int = 100) -> list:
    """
    Fetch followers or following list via scraping_solutions no-cookies actor.
    connection_type: 'followers' or 'following'
    Returns list of {username, full_name, profile_pic, is_verified, is_private}
    """
    if connection_type not in ('followers', 'following'):
        raise ValueError("connection_type must be 'followers' or 'following'")

    cache_key = f"{connection_type}_{username}_{limit}"
    cached = _cache_get(cache_key, ttl=CACHE_TTL_LONG)
    if cached:
        return cached

    try:
        data = await _apify_run(
            "scraping_solutions~instagram-scraper-followers-following-no-cookies",
            {
                "Account": [username],
                "selectType": connection_type,
                "maxResults": limit
            },
            timeout=180.0
        )
    except HTTPException as e:
        logger.warning(f"Connection list fetch failed for @{username}/{connection_type}: {e.detail}")
        return []

    results = []
    for item in data or []:
        if item.get('error'):
            continue
        results.append({
            'id': item.get('id', ''),
            'username': item.get('username', ''),
            'full_name': item.get('full_name', ''),
            'profile_pic': item.get('profile_pic_url', ''),
            'is_verified': item.get('is_verified', False),
            'is_private': item.get('is_private', False),
        })

    _cache_set(cache_key, results)
    return results
