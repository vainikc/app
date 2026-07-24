"""
Backend API tests for Sherlock - Instagram Data Tracker
Tests real Apify integration and Emergent LLM insights.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://insta-sleuth-1.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")

# Long timeout because Apify actor can take 20-90s for fresh usernames
APIFY_TIMEOUT = 180


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Root / Health ----------
class TestRoot:
    def test_root_message(self, http):
        r = http.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "Sherlock" in data.get("message", "")
        assert "v2.0" in data.get("message", "")


# ---------- Profile Endpoint - REAL Apify data ----------
class TestProfile:
    def test_profile_natgeo_real_data(self, http):
        r = http.get(f"{BASE_URL}/api/profile/natgeo", timeout=APIFY_TIMEOUT)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        p = r.json()
        # Real data checks
        assert p["username"] == "natgeo"
        assert p["full_name"], "full_name missing"
        assert "national geographic" in p["full_name"].lower(), f"Expected National Geographic, got {p['full_name']}"
        # National Geographic has hundreds of millions of followers
        assert p["followers"] > 100_000_000, f"Follower count too low: {p['followers']}"
        assert p["is_verified"] is True
        assert p["posts"] > 1000
        assert isinstance(p["recent_posts"], list)
        assert len(p["recent_posts"]) > 0, "Expected real recent posts"
        # Validate a post shape
        post0 = p["recent_posts"][0]
        for k in ["id", "caption", "likes", "comments", "display_url", "type"]:
            assert k in post0

    def test_profile_cristiano_real_data(self, http):
        r = http.get(f"{BASE_URL}/api/profile/cristiano", timeout=APIFY_TIMEOUT)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        p = r.json()
        assert p["username"] == "cristiano"
        # Cristiano Ronaldo has 600M+ followers
        assert p["followers"] > 400_000_000, f"Follower count too low: {p['followers']}"
        assert p["is_verified"] is True

    def test_profile_nonexistent_returns_404(self, http):
        r = http.get(f"{BASE_URL}/api/profile/nonexistent_user_zzz999_ashd", timeout=APIFY_TIMEOUT)
        # Apify may return empty result -> 404 from our backend
        assert r.status_code in (404, 502), f"Got {r.status_code}"


# ---------- Search Endpoint ----------
class TestSearch:
    def test_search_natgeo(self, http):
        r = http.get(f"{BASE_URL}/api/search", params={"q": "natgeo"}, timeout=APIFY_TIMEOUT)
        assert r.status_code == 200
        results = r.json()
        assert isinstance(results, list)
        assert len(results) >= 1
        assert results[0]["username"] == "natgeo"
        assert results[0]["followers"] > 100_000_000

    def test_search_nonexistent_returns_empty(self, http):
        r = http.get(f"{BASE_URL}/api/search", params={"q": "nonexistent_user_zzz999_ashd"}, timeout=APIFY_TIMEOUT)
        assert r.status_code == 200
        assert r.json() == []

    def test_search_empty_query(self, http):
        r = http.get(f"{BASE_URL}/api/search", params={"q": ""}, timeout=30)
        assert r.status_code == 200
        assert r.json() == []


# ---------- Tracked Accounts CRUD ----------
class TestAccounts:
    """Full lifecycle: add -> list -> get history -> delete."""

    def test_a_cleanup_before(self, http):
        # Best effort cleanup
        http.delete(f"{BASE_URL}/api/accounts/natgeo", timeout=15)

    def test_b_add_account_natgeo(self, http):
        r = http.post(f"{BASE_URL}/api/accounts", params={"username": "natgeo"}, timeout=APIFY_TIMEOUT)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data["username"] == "natgeo"
        assert "profile" in data
        assert data["profile"]["followers"] > 100_000_000
        assert data["profile"]["is_verified"] is True

    def test_c_add_duplicate_fails(self, http):
        r = http.post(f"{BASE_URL}/api/accounts", params={"username": "natgeo"}, timeout=APIFY_TIMEOUT)
        assert r.status_code == 400

    def test_d_list_accounts(self, http):
        r = http.get(f"{BASE_URL}/api/accounts", timeout=15)
        assert r.status_code == 200
        accts = r.json()
        assert isinstance(accts, list)
        usernames = [a["username"] for a in accts]
        assert "natgeo" in usernames

    def test_e_history_returns_snapshots(self, http):
        r = http.get(f"{BASE_URL}/api/profile/natgeo/history", timeout=15)
        assert r.status_code == 200
        snaps = r.json()
        assert isinstance(snaps, list)
        assert len(snaps) >= 1
        s0 = snaps[0]
        assert s0["username"] == "natgeo"
        assert s0["followers"] > 100_000_000
        assert "timestamp" in s0

    def test_f_activity_endpoint(self, http):
        # Apify intermittently returns empty latestPosts for some accounts (e.g. natgeo);
        # use cristiano which reliably returns 12 posts. Still validates activity endpoint.
        r = http.get(f"{BASE_URL}/api/profile/cristiano/activity", timeout=APIFY_TIMEOUT)
        assert r.status_code == 200
        acts = r.json()
        assert isinstance(acts, list)
        assert len(acts) > 0, "Expected recent posts in activity feed for cristiano"
        a0 = acts[0]
        for k in ["type", "content", "likes", "comments", "media_url"]:
            assert k in a0

    def test_g_relationships(self, http):
        r = http.get(f"{BASE_URL}/api/relationships", timeout=30)
        assert r.status_code == 200
        graph = r.json()
        assert "nodes" in graph and "links" in graph
        assert isinstance(graph["nodes"], list)
        node_ids = [n["id"] for n in graph["nodes"]]
        assert "natgeo" in node_ids

    def test_h_delete_account(self, http):
        r = http.delete(f"{BASE_URL}/api/accounts/natgeo", timeout=15)
        assert r.status_code == 200

    def test_i_delete_missing(self, http):
        r = http.delete(f"{BASE_URL}/api/accounts/natgeo", timeout=15)
        assert r.status_code == 404


# ---------- AI Insights via Emergent LLM ----------
class TestAIInsights:
    def test_insights_natgeo(self, http):
        r = http.get(f"{BASE_URL}/api/insights/natgeo", timeout=180)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert "insights" in data
        text = data["insights"]
        assert isinstance(text, str) and len(text) > 50, f"AI insight text too short: {text[:200]}"
        # Verify format sections came through
        must_have_any = ["Content Strategy", "Audience", "Engagement", "Recommendation"]
        found = sum(1 for k in must_have_any if k in text)
        assert found >= 3, f"AI insight missing required sections. Text: {text[:500]}"
        # Metrics
        assert "metrics" in data
        assert data["metrics"]["followers"] > 100_000_000
