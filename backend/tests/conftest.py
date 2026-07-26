"""Shared pytest fixtures for Sherlock backend tests (JWT httpOnly cookie auth)."""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or
            "https://insta-sleuth-1.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@sherlock.app")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Sherlock2026!")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def db():
    return MongoClient(MONGO_URL)[DB_NAME]


@pytest.fixture(scope="session")
def auth_session():
    """Requests session authenticated via /api/auth/login (cookies set)."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Cannot login as admin ({r.status_code}: {r.text[:200]}) — skipping auth-protected tests")
    return s


@pytest.fixture(scope="session")
def http():
    """Backward-compat alias used by older test file."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Cannot login as admin ({r.status_code}) — skipping")
    return s
