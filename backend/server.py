from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import random
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

MOCK_USERNAMES = ['fashionista_emma', 'travel_wanderer', 'tech_guru_mike', 'foodie_sarah', 'fitness_coach_alex']
MOCK_PROFILES = {
    'fashionista_emma': {
        'username': 'fashionista_emma',
        'full_name': 'Emma Rodriguez',
        'bio': 'Fashion & Lifestyle | NYC 📍 | Style tips & OOTD',
        'followers': 45230,
        'following': 892,
        'posts': 1243,
        'profile_pic': 'https://images.unsplash.com/photo-1517462964-21fdcec3f25b?w=150',
        'is_verified': True,
        'category': 'fashion'
    },
    'travel_wanderer': {
        'username': 'travel_wanderer',
        'full_name': 'Alex Chen',
        'bio': '🌍 Explorer | 47 countries & counting | Travel blogger',
        'followers': 89450,
        'following': 1240,
        'posts': 2156,
        'profile_pic': 'https://images.unsplash.com/photo-1664515226058-03952a19bd76?w=150',
        'is_verified': True,
        'category': 'travel'
    },
    'tech_guru_mike': {
        'username': 'tech_guru_mike',
        'full_name': 'Michael Thompson',
        'bio': 'Tech Reviews | Gadgets | AI Enthusiast 🤖',
        'followers': 112340,
        'following': 567,
        'posts': 892,
        'profile_pic': 'https://images.unsplash.com/photo-1611042553484-d61f84d22784?w=150',
        'is_verified': True,
        'category': 'tech'
    }
}

class TrackedAccount(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    tracking_since: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ActivityItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_id: str
    username: str
    activity_type: str
    content: str
    timestamp: datetime

@api_router.get("/")
async def root():
    return {"message": "Sherlock API v1.0"}

@api_router.get("/accounts")
async def get_tracked_accounts():
    accounts = await db.tracked_accounts.find({}, {"_id": 0}).to_list(100)
    for acc in accounts:
        if isinstance(acc.get('tracking_since'), str):
            acc['tracking_since'] = datetime.fromisoformat(acc['tracking_since'])
        if isinstance(acc.get('last_updated'), str):
            acc['last_updated'] = datetime.fromisoformat(acc['last_updated'])
    return accounts

@api_router.post("/accounts")
async def add_tracked_account(username: str):
    existing = await db.tracked_accounts.find_one({"username": username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Account already tracked")
    
    account = TrackedAccount(username=username)
    doc = account.model_dump()
    doc['tracking_since'] = doc['tracking_since'].isoformat()
    doc['last_updated'] = doc['last_updated'].isoformat()
    await db.tracked_accounts.insert_one(doc)
    return account

@api_router.delete("/accounts/{username}")
async def remove_tracked_account(username: str):
    result = await db.tracked_accounts.delete_one({"username": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Account removed"}

@api_router.get("/accounts/{username}/profile")
async def get_profile(username: str):
    if username in MOCK_PROFILES:
        return MOCK_PROFILES[username]
    return {
        'username': username,
        'full_name': username.replace('_', ' ').title(),
        'bio': 'Instagram user',
        'followers': random.randint(1000, 50000),
        'following': random.randint(100, 2000),
        'posts': random.randint(50, 1000),
        'profile_pic': 'https://images.pexels.com/photos/22742255/pexels-photo-22742255.jpeg?w=150',
        'is_verified': False,
        'category': 'other'
    }

@api_router.get("/accounts/{username}/followers")
async def get_follower_history(username: str):
    base = random.randint(30000, 50000)
    return [
        {"date": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat(), "count": base - 1200},
        {"date": (datetime.now(timezone.utc) - timedelta(days=23)).isoformat(), "count": base - 800},
        {"date": (datetime.now(timezone.utc) - timedelta(days=16)).isoformat(), "count": base - 400},
        {"date": (datetime.now(timezone.utc) - timedelta(days=9)).isoformat(), "count": base},
        {"date": datetime.now(timezone.utc).isoformat(), "count": base + 500}
    ]

@api_router.get("/accounts/{username}/following")
async def get_following_history(username: str):
    return [
        {"username": "user_a", "followed_at": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat(), "status": "following"},
        {"username": "user_b", "followed_at": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat(), "status": "unfollowed"},
        {"username": "user_c", "followed_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(), "status": "following"}
    ]

@api_router.get("/accounts/{username}/activity")
async def get_activity_feed(username: str):
    activities = [
        {"type": "post", "content": "New post: Summer vibes ☀️", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()},
        {"type": "like", "content": "Liked @friend_user's photo", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat()},
        {"type": "comment", "content": "Commented on @another_user's post", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=8)).isoformat()},
        {"type": "story", "content": "Posted a story", "timestamp": (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()}
    ]
    return activities

@api_router.get("/relationships")
async def get_relationships():
    return {
        "nodes": [
            {"id": "fashionista_emma", "label": "fashionista_emma", "category": "fashion"},
            {"id": "travel_wanderer", "label": "travel_wanderer", "category": "travel"},
            {"id": "tech_guru_mike", "label": "tech_guru_mike", "category": "tech"},
            {"id": "user_a", "label": "user_a", "category": "other"},
            {"id": "user_b", "label": "user_b", "category": "other"}
        ],
        "links": [
            {"source": "fashionista_emma", "target": "travel_wanderer", "value": 15},
            {"source": "travel_wanderer", "target": "tech_guru_mike", "value": 8},
            {"source": "fashionista_emma", "target": "user_a", "value": 22},
            {"source": "tech_guru_mike", "target": "user_b", "value": 10}
        ]
    }

@api_router.get("/insights/{username}")
async def get_ai_insights(username: str):
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {"insights": f"Mock AI Insight for {username}: This account shows consistent posting behavior with high engagement rates. Primary content focuses on lifestyle and fashion trends. Audience appears to be predominantly 18-35 age group with strong interests in visual content."}
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"insights-{username}",
            system_message="You are an Instagram analytics expert. Provide concise, actionable insights about account behavior, content patterns, and audience engagement."
        ).with_model("openai", "gpt-5.4")
        
        profile = MOCK_PROFILES.get(username, {})
        prompt = f"Analyze this Instagram account: @{username}. Followers: {profile.get('followers', 'N/A')}, Following: {profile.get('following', 'N/A')}, Bio: {profile.get('bio', 'N/A')}. Category: {profile.get('category', 'general')}. Provide 3-4 key insights about their strategy, audience, and content approach."
        
        async def generate():
            full_text = ""
            async for event in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(event, TextDelta):
                    full_text += event.content
                    yield f"data: {json.dumps({'content': event.content})}\n\n"
                elif isinstance(event, StreamDone):
                    break
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
        )
    except Exception as e:
        logging.error(f"AI insights error: {e}")
        return {"insights": f"Mock AI Insight for {username}: Shows strong engagement patterns with consistent content strategy. Recommended focus: continue current content mix while exploring trending topics."}

@api_router.get("/search")
async def search_profiles(q: str):
    results = []
    for username, profile in MOCK_PROFILES.items():
        if q.lower() in username.lower() or q.lower() in profile.get('full_name', '').lower():
            results.append(profile)
    return results

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()