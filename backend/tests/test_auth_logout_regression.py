"""Auth logout regression test (iteration 10) — verifies the console.warn change in
AuthContext.js has no server-side regression.

Scope (per review request):
- POST /api/auth/logout returns 200 with a valid access_token cookie
- Logout properly clears both cookies (Max-Age=0 in Set-Cookie)
- After logout, GET /api/auth/me returns 401
- After logout, GET /api/accounts returns 401
- Fresh login after logout works and re-issues cookies
"""
import os
import re
import requests
import pytest

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or
            "https://insta-sleuth-1.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@sherlock.app")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Sherlock2026!")


def _login(session: requests.Session) -> requests.Response:
    return session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        headers={"Content-Type": "application/json"},
        timeout=15,
    )


class TestLogoutRegression:
    """POST /api/auth/logout regression suite."""

    def test_login_precondition_sets_cookies(self):
        s = requests.Session()
        r = _login(s)
        assert r.status_code == 200, f"login should return 200, got {r.status_code}: {r.text[:200]}"
        # both cookies must be set
        cookie_names = {c.name for c in s.cookies}
        assert "access_token" in cookie_names, f"access_token not set. Got: {cookie_names}"
        assert "refresh_token" in cookie_names, f"refresh_token not set. Got: {cookie_names}"
        # response body shape
        data = r.json()
        assert data.get("email") == ADMIN_EMAIL
        assert data.get("role") == "admin"

    def test_logout_returns_200_with_valid_cookie(self):
        s = requests.Session()
        assert _login(s).status_code == 200
        r = s.post(f"{BASE_URL}/api/auth/logout", timeout=15)
        assert r.status_code == 200, f"logout should return 200, got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert body.get("message") == "Logged out"

    def test_logout_clears_both_cookies_max_age_zero(self):
        s = requests.Session()
        assert _login(s).status_code == 200
        r = s.post(f"{BASE_URL}/api/auth/logout", timeout=15)
        assert r.status_code == 200
        # Collect all Set-Cookie headers
        raw_set_cookies = r.raw.headers.getlist("Set-Cookie") if hasattr(r.raw.headers, "getlist") \
            else [v for k, v in r.raw.headers.items() if k.lower() == "set-cookie"]
        # Fallback for requests versions
        if not raw_set_cookies:
            raw_set_cookies = r.headers.get("Set-Cookie", "").split(",")
        joined = "\n".join(raw_set_cookies)
        # Must include both cookie names with Max-Age=0
        access_match = re.search(r"access_token=[^;]*;[^\n]*Max-Age=0", joined, re.IGNORECASE)
        refresh_match = re.search(r"refresh_token=[^;]*;[^\n]*Max-Age=0", joined, re.IGNORECASE)
        assert access_match, f"access_token cookie not cleared (no Max-Age=0). Set-Cookie: {joined}"
        assert refresh_match, f"refresh_token cookie not cleared (no Max-Age=0). Set-Cookie: {joined}"

    def test_me_returns_401_after_logout(self):
        s = requests.Session()
        assert _login(s).status_code == 200
        assert s.post(f"{BASE_URL}/api/auth/logout", timeout=15).status_code == 200
        # After the server sends Max-Age=0, requests.Session clears the cookie jar
        r = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401, f"/auth/me should return 401 after logout, got {r.status_code}: {r.text[:200]}"

    def test_protected_route_accounts_returns_401_after_logout(self):
        s = requests.Session()
        assert _login(s).status_code == 200
        assert s.post(f"{BASE_URL}/api/auth/logout", timeout=15).status_code == 200
        r = s.get(f"{BASE_URL}/api/accounts", timeout=15)
        assert r.status_code == 401, f"/accounts should return 401 after logout, got {r.status_code}: {r.text[:200]}"

    def test_fresh_login_after_logout(self):
        s = requests.Session()
        assert _login(s).status_code == 200
        assert s.post(f"{BASE_URL}/api/auth/logout", timeout=15).status_code == 200
        # Fresh login should still succeed and re-set cookies
        r = _login(s)
        assert r.status_code == 200, f"fresh login after logout failed: {r.status_code}: {r.text[:200]}"
        cookie_names = {c.name for c in s.cookies}
        assert "access_token" in cookie_names, "access_token not re-set after fresh login"
        assert "refresh_token" in cookie_names, "refresh_token not re-set after fresh login"
        # And /auth/me should now work again
        r_me = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r_me.status_code == 200, f"/auth/me after fresh login should be 200, got {r_me.status_code}"
        assert r_me.json().get("email") == ADMIN_EMAIL
