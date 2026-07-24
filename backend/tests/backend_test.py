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


# ---------- Followers/Following Lists (new v3.0 + since_days v3.1) ----------
# Use @chilichidiu because it has small follower count (~1400) so scraper returns fast
# EXPECTED_LIST_KEYS = new shape after since_days feature
EXPECTED_LIST_KEYS = [
    "current", "most_recent", "added_details", "removed_usernames", "total_count",
    "quota_exhausted", "comparison_period", "has_baseline", "baseline_timestamp",
    # v3.2 bug-fix fields (iteration 6+):
    "profile_count", "sample_count", "net_change", "baseline_count", "has_count_baseline",
]


class TestConnectionLists:

    def test_followers_list_shape(self, http):
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/followers-list",
            params={"limit": 10, "since_days": 7},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        data = r.json()
        for key in EXPECTED_LIST_KEYS:
            assert key in data, f"Missing key {key}"
        assert isinstance(data["current"], list)
        assert isinstance(data["most_recent"], list)
        assert isinstance(data["added_details"], list)
        assert isinstance(data["removed_usernames"], list)
        assert isinstance(data["total_count"], int)
        assert isinstance(data["quota_exhausted"], bool)
        # For followers, most_recent should be [] per server logic
        assert data["most_recent"] == []
        assert data["comparison_period"] == "past 7 days"
        # If any current items, verify shape
        if data["current"]:
            item = data["current"][0]
            for k in ["username", "full_name", "profile_pic", "is_verified", "is_private"]:
                assert k in item, f"Missing key {k} in follower item"

    def test_following_list_shape(self, http):
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/following-list",
            params={"limit": 10, "since_days": 7},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        data = r.json()
        for key in EXPECTED_LIST_KEYS:
            assert key in data, f"Missing key {key}"
        assert isinstance(data["current"], list)
        assert isinstance(data["most_recent"], list)
        assert data["comparison_period"] == "past 7 days"
        # For following, most_recent is top-20 of current
        assert len(data["most_recent"]) <= 20
        assert len(data["most_recent"]) <= len(data["current"])
        if data["current"]:
            # most_recent should be the first N of current
            n = min(20, len(data["current"]))
            assert data["most_recent"] == data["current"][:n]

    def test_following_list_since_days_0_last_check(self, http):
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/following-list",
            params={"limit": 10, "since_days": 0},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["comparison_period"] == "last check"
        assert isinstance(data["has_baseline"], bool)

    def test_following_list_since_days_1(self, http):
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/following-list",
            params={"limit": 10, "since_days": 1},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["comparison_period"] == "past 1 day"

    def test_following_list_since_days_30(self, http):
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/following-list",
            params={"limit": 10, "since_days": 30},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["comparison_period"] == "past 30 days"

    def test_since_days_invalid_out_of_range(self, http):
        # since_days > 365 or < 0 should 422
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/following-list",
            params={"limit": 10, "since_days": 400},
            timeout=30,
        )
        assert r.status_code == 422

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


# ---------- v3.2 Bug-Fix (iteration 6+) response shape ----------
# BUG 1: profile_count uses real IG count (not scraped-list length).
# BUG 2: net_change comes from follower_snapshots count-baseline path even when
# no full-list snapshot exists (has_baseline=false but has_count_baseline=true).
class TestConnectionListsBugFix:
    """Verify /following-list + /followers-list return the new fields introduced by
    the iteration-6 bug fix for '@total following stuck at 200' and 'followed/unfollowed
    stuck at 0'."""

    def test_following_profile_count_uses_real_ig_total_not_scrape_cap(self, http):
        """profile_count/total_count should be the real IG following count (e.g. 1385),
        NOT the ~200 scrape cap (sample_count)."""
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/following-list",
            params={"limit": 100, "since_days": 7},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data["profile_count"], int)
        assert isinstance(data["sample_count"], int)
        assert isinstance(data["total_count"], int)
        # total_count is alias for profile_count
        assert data["total_count"] == data["profile_count"]
        # profile_count should be MUCH larger than scraper cap when actor works
        if not data["quota_exhausted"] and data["current"]:
            assert data["profile_count"] > 500, (
                f"profile_count={data['profile_count']} — expected real IG count (~1385) "
                f"not scrape cap (~200)"
            )
            assert data["sample_count"] == len(data["current"])
            # profile_count should be >= sample_count
            assert data["profile_count"] >= data["sample_count"]

    def test_followers_profile_count_uses_real_ig_total(self, http):
        """Same fix on followers-list — profile_count uses profile.followers."""
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/followers-list",
            params={"limit": 100, "since_days": 7},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["profile_count"], int)
        assert isinstance(data["sample_count"], int)
        assert data["total_count"] == data["profile_count"]
        if not data["quota_exhausted"] and data["current"]:
            assert data["sample_count"] == len(data["current"])
            assert data["profile_count"] >= data["sample_count"]

    def test_following_count_baseline_path_returns_net_change(self, http):
        """With a follower_snapshots baseline seeded ~10d ago, since_days=7 should
        return has_count_baseline=true, baseline_count set, and net_change=profile_count-baseline_count."""
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/following-list",
            params={"limit": 100, "since_days": 7},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["has_count_baseline"], bool)
        assert isinstance(data["has_baseline"], bool)
        # baseline exists (seeded snapshot 10d old)
        if data["has_count_baseline"]:
            assert data["baseline_count"] is not None
            assert isinstance(data["baseline_count"], int)
            assert data["net_change"] is not None
            assert isinstance(data["net_change"], int)
            # net_change math: current - baseline
            assert data["net_change"] == data["profile_count"] - data["baseline_count"], (
                f"net_change={data['net_change']} but profile_count-baseline_count="
                f"{data['profile_count'] - data['baseline_count']}"
            )
            assert data["baseline_timestamp"] is not None
        else:
            # If no baseline, net_change must be null
            assert data["net_change"] is None
            assert data["baseline_count"] is None

    def test_following_since_days_0_uses_most_recent_snapshot(self, http):
        """since_days=0 should look at the most recent follower_snapshot regardless of age."""
        r = http.get(
            f"{BASE_URL}/api/profile/chilichidiu/following-list",
            params={"limit": 100, "since_days": 0},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["comparison_period"] == "last check"
        # There will be at least 1 follower_snapshot from prior tests
        if data["has_count_baseline"]:
            assert data["baseline_count"] is not None
            assert data["net_change"] is not None
            assert data["net_change"] == data["profile_count"] - data["baseline_count"]

    def test_no_baseline_untracked_account_returns_null_net_change(self, http):
        """An account with NO follower_snapshots at all should return
        has_count_baseline=false, net_change=null, baseline_count=null."""
        # Use a small, real IG account that is NOT tracked and has no snapshots.
        # 'kkw' is a small real account we don't track (skip if scraper cap-hit).
        r = http.get(
            f"{BASE_URL}/api/profile/instagram/following-list",
            params={"limit": 10, "since_days": 7},
            timeout=LIST_TIMEOUT,
        )
        # 'instagram' is huge but its following-count endpoint may error/quota.
        # We only assert shape when call succeeds and this account has no snapshots.
        if r.status_code == 200:
            data = r.json()
            # There may or may not be a snapshot depending on prior test runs.
            # But if has_count_baseline==false, net_change MUST be None.
            if not data["has_count_baseline"]:
                assert data["net_change"] is None
                assert data["baseline_count"] is None


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
