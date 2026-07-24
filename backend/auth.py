"""Email/password JWT auth for Sherlock."""
import os
import uuid
import secrets
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 15
REFRESH_TOKEN_DAYS = 7
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


# --- password utils ---
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# --- jwt utils ---
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def _set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie(
        key="access_token", value=access,
        httponly=True, secure=True, samesite="none",
        max_age=ACCESS_TOKEN_MINUTES * 60, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh,
        httponly=True, secure=True, samesite="none",
        max_age=REFRESH_TOKEN_DAYS * 24 * 3600, path="/",
    )


def _clear_auth_cookies(response: Response):
    # Must match the original cookie attributes for browsers to accept the deletion
    response.set_cookie(key="access_token", value="", httponly=True, secure=True,
                        samesite="none", max_age=0, path="/")
    response.set_cookie(key="refresh_token", value="", httponly=True, secure=True,
                        samesite="none", max_age=0, path="/")


# --- pydantic models ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    role: str = "user"


# --- brute force helpers ---
async def _identifier(request: Request, email: str) -> str:
    ip = (request.client.host if request.client else "unknown")
    return f"{ip}:{email.lower()}"


async def _is_locked_out(db, identifier: str) -> bool:
    doc = await db.login_attempts.find_one({"identifier": identifier})
    if not doc:
        return False
    if doc.get("failed_count", 0) < MAX_FAILED_ATTEMPTS:
        return False
    last = doc.get("last_failed_at")
    if not last:
        return False
    if isinstance(last, str):
        try:
            last = datetime.fromisoformat(last)
        except Exception:
            return False
    return (datetime.now(timezone.utc) - last).total_seconds() < LOCKOUT_MINUTES * 60


async def _record_failed(db, identifier: str):
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {"$inc": {"failed_count": 1}, "$set": {"last_failed_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


async def _clear_failed(db, identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})


# --- user document helpers ---
def _user_to_response(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name"),
        "role": user.get("role", "user"),
    }


# --- dependency factory ---
def get_current_user_dep(db):
    """Returns a FastAPI dependency that resolves the current user from JWT."""
    async def _dep(request: Request) -> dict:
        token = request.cookies.get("access_token")
        if not token:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")
        try:
            payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("type") != "access":
                raise HTTPException(status_code=401, detail="Invalid token type")
            user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            return user
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
    return _dep


# --- router factory ---
def build_auth_router(db) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])
    current_user = get_current_user_dep(db)

    @router.post("/register", response_model=UserResponse)
    async def register(payload: RegisterRequest, response: Response):
        email = payload.email.lower().strip()
        existing = await db.users.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": hash_password(payload.password),
            "name": payload.name or email.split("@")[0],
            "role": "user",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)
        access = create_access_token(user["id"], user["email"])
        refresh = create_refresh_token(user["id"])
        _set_auth_cookies(response, access, refresh)
        return _user_to_response(user)

    @router.post("/login", response_model=UserResponse)
    async def login(payload: LoginRequest, request: Request, response: Response):
        email = payload.email.lower().strip()
        identifier = await _identifier(request, email)
        if await _is_locked_out(db, identifier):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
        user = await db.users.find_one({"email": email})
        if not user or not verify_password(payload.password, user.get("password_hash", "")):
            await _record_failed(db, identifier)
            raise HTTPException(status_code=401, detail="Invalid email or password")
        await _clear_failed(db, identifier)
        access = create_access_token(user["id"], user["email"])
        refresh = create_refresh_token(user["id"])
        _set_auth_cookies(response, access, refresh)
        return _user_to_response(user)

    @router.post("/logout")
    async def logout(response: Response, user: dict = Depends(current_user)):
        _clear_auth_cookies(response)
        return {"message": "Logged out"}

    @router.get("/me", response_model=UserResponse)
    async def me(user: dict = Depends(current_user)):
        return _user_to_response(user)

    @router.post("/refresh")
    async def refresh(request: Request, response: Response):
        token = request.cookies.get("refresh_token")
        if not token:
            raise HTTPException(status_code=401, detail="No refresh token")
        try:
            payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("type") != "refresh":
                raise HTTPException(status_code=401, detail="Invalid token type")
            user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            access = create_access_token(user["id"], user["email"])
            response.set_cookie(
                key="access_token", value=access,
                httponly=True, secure=True, samesite="none",
                max_age=ACCESS_TOKEN_MINUTES * 60, path="/",
            )
            return {"message": "Refreshed"}
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Refresh token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

    return router


# --- admin seeding & indexes ---
async def seed_admin_and_indexes(db):
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@sherlock.app").lower().strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"[Auth] Seeded admin user @ {admin_email}")
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
        logger.info(f"[Auth] Updated admin password for {admin_email}")
