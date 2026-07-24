"""
Backend API tests for Sherlock - Instagram Data Tracker (v3.0)
Tests real Apify integration, Emergent LLM insights, dashboard aggregate,
followers/following lists, connection history, post comments, rate limiting.
"""
import os
import time
import pytest
import requests
import concurrent.futures

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://insta-sleuth-1.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")

# Long timeout because Apify actor can take 20-90s for fresh usernames
APIFY_TIMEOUT = 180
# Followers/Following actor may take 30-90s (larger scrape)
LIST_TIMEOUT = 240


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Root / Health ----------
class TestRoot:
    def test_root_message_v3(self, http):
        r = http.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "Sherlock" in data.get("message", "")
        assert "v3.0" in data.get("message", "")


# ---------- Dashboard Aggregate ----------
class TestDashboard:
    def test_dashboard_shape_and_totals(self, http):
        r = http.get(f"{BASE_URL}/api/dashboard", timeout=APIFY_TIMEOUT)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert "accounts" in data and "totals" in data
        assert isinstance(data["accounts"], list)
        totals = data["totals"]
        for key in ["tracked", "followers", "following", "posts"]:
            assert key in totals, f"Missing key {key} in totals"
            assert isinstance(totals[key], int)
        # Sanity: totals aggregate from account profiles
        assert totals["tracked"] == len(data["accounts"])
        summed_followers = sum(
            (a.get("profile") or {}).get("followers", 0) for a in data["accounts"]
        )
        assert totals["followers"] == summed_followers, \
            f"totals.followers ({totals['followers']}) != sum ({summed_followers})"


# ---------- Profile Endpoint - REAL Apify data ----------
class TestProfile:
    def test_profile_natgeo_real_data(self, http):
        r = http.get(f"{BASE_URL}/api/profile/natgeo", timeout=APIFY_TIMEOUT)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        p = r.json()
        assert p["username"] == "natgeo"
        assert p["full_name"], "full_name missing"
        assert "national geographic" in p["full_name"].lower(), f"Expected National Geographic, got {p['full_name']}"
        assert p["followers"] > 100_000_000, f"Follower count too low: {p['followers']}"
        assert p["is_verified"] is True
        assert p["posts"] > 1000
        assert isinstance(p["recent_posts"], list)

    def test_profile_cristiano_real_data(self, http):
        r = http.get(f"{BASE_URL}/api/profile/cristiano", timeout=APIFY_TIMEOUT)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        p = r.json()
        assert p["username"] == "cristiano"
        assert p["followers"] > 400_000_000
        assert p["is_verified"] is True

    def test_profile_nonexistent_returns_404(self, http):
        r = http.get(f"{BASE_URL}/api/profile/nonexistent_user_zzz999_ashd", timeout=APIFY_TIMEOUT)
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


# ---------- Tracked Accounts CRUD (uses natgeo temporarily) ----------
class TestAccounts:
    """Full lifecycle: add -> list -> get history -> delete."""

    def test_a_cleanup_before(self, http):
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
        r = http.get(f"{BASE_URL}/api/profile/cristiano/activity", timeout=APIFY_TIMEOUT)
        assert r.status_code == 200
        acts = r.json()
        assert isinstance(acts, list)
        assert len(acts) > 0
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


# ---------- Image Proxy ----------
class TestImageProxy:
    def test_image_proxy_missing_param(self, http):
        r = http.get(f"{BASE_URL}/api/image-proxy", timeout=15)
        assert r.status_code == 422

    def test_image_proxy_rejects_non_instagram_url(self, http):
        r = http.get(
            f"{BASE_URL}/api/image-proxy",
            params={"url": "https://example.com/image.jpg"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_image_proxy_returns_real_jpeg_bytes(self, http):
        p = http.get(f"{BASE_URL}/api/profile/natgeo", timeout=APIFY_TIMEOUT)
        assert p.status_code == 200
        pic_url = p.json().get("profile_pic")
        assert pic_url and ("cdninstagram.com" in pic_url or "fbcdn.net" in pic_url)

        r = http.get(
            f"{BASE_URL}/api/image-proxy",
            params={"url": pic_url},
            timeout=30,
        )
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert ct.startswith("image/")
        body = r.content
        assert len(body) > 1000
        assert body[:3] == b"\xff\xd8\xff" or body[:8] == b"\x89PNG\r\n\x1a\n"


# ---------- AI Insights ----------
class TestAIInsights:
    def test_insights_natgeo(self, http):
        r = http.get(f"{BASE_URL}/api/insights/natgeo", timeout=180)
        # v3.0: LLM failure now returns 502 instead of 200
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert "insights" in data
        text = data["insights"]
        assert isinstance(text, str) and len(text) > 50
        must_have_any = ["Content Strategy", "Audience", "Engagement", "Recommendation"]
        found = sum(1 for k in must_have_any if k in text)
        assert found >= 3
        assert "metrics" in data
        assert data["metrics"]["followers"] > 100_000_000


# ---------- Followers/Following Lists (new v3.0) ----------
# Use @chilichidiu because it has small follower count (~1400) so scraper returns fast
class TestConnectionLists:

    def test_followers_list_shape(self, http):
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/followers-list",
            params={"limit": 10},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        data = r.json()
        for key in ["current", "added_details", "removed_usernames", "total_count"]:
            assert key in data, f"Missing key {key}"
        assert isinstance(data["current"], list)
        assert isinstance(data["added_details"], list)
        assert isinstance(data["removed_usernames"], list)
        assert isinstance(data["total_count"], int)
        # If any current items, verify shape
        if data["current"]:
            item = data["current"][0]
            for k in ["username", "full_name", "profile_pic", "is_verified", "is_private"]:
                assert k in item, f"Missing key {k} in follower item"

    def test_following_list_shape(self, http):
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/following-list",
            params={"limit": 10},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        data = r.json()
        for key in ["current", "added_details", "removed_usernames", "total_count"]:
            assert key in data
        assert isinstance(data["current"], list)

    def test_connection_history_grows(self, http):
        # After the two calls above, history should have at least 1 snapshot
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/connection-history",
            params={"connection_type": "followers"},
            timeout=15,
        )
        assert r.status_code == 200
        snaps = r.json()
        assert isinstance(snaps, list)
        # Should have at least 1 snapshot after the followers-list call above
        assert len(snaps) >= 1, "Expected at least 1 connection snapshot"
        s0 = snaps[0]
        assert s0["username"] == "chilichidiu"
        assert s0["type"] == "followers"
        assert "count" in s0
        assert "timestamp" in s0

    def test_connection_history_following(self, http):
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/connection-history",
            params={"connection_type": "following"},
            timeout=15,
        )
        assert r.status_code == 200
        snaps = r.json()
        assert isinstance(snaps, list)
        assert len(snaps) >= 1
        assert snaps[0]["type"] == "following"


# ---------- Post Comments (new v3.0) ----------
class TestPostComments:
    def test_post_comments_shape(self, http):
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/post-comments",
            params={"posts_limit": 2, "comments_limit": 5},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        comments = r.json()
        assert isinstance(comments, list)
        # If comments exist, verify shape
        if comments:
            c = comments[0]
            for k in ["author", "text", "likes", "timestamp", "post_url"]:
                assert k in c, f"Missing key {k} in comment"


# ---------- Rate Limiting ----------
class TestRateLimit:
    def test_search_rate_limit(self, http):
        """GET /api/search is limited to 30/min per IP. Ingress splits across
        ~2 IPs, so send 100 requests to reliably trigger 429 on both buckets."""
        codes = []
        for _ in range(100):
            try:
                r = requests.get(
                    f"{BASE_URL}/api/search",
                    params={"q": ""},  # returns [] 200 quickly
                    timeout=10,
                )
                codes.append(r.status_code)
            except Exception:
                codes.append(0)
        n_429 = codes.count(429)
        assert n_429 > 0, f"Expected some 429 responses; got codes: {sorted(set(codes))}, counts: {[(c, codes.count(c)) for c in sorted(set(codes))]}"
