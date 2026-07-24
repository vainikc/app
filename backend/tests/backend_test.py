"""
Backend API tests for Sherlock - Instagram Data Tracker (v3.4 iteration 8)
Tests real Apify integration, Emergent LLM insights, dashboard aggregate,
followers/following lists w/ smart_recent + smart_recent_mode + removed_details,
connection history, post comments, rate limiting.
"""
import os
import time
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://insta-sleuth-1.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")

# Long timeout because Apify actor can take 20-90s for fresh usernames
APIFY_TIMEOUT = 180
# Followers/Following actor may take 30-90s (larger scrape)
LIST_TIMEOUT = 240

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


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
            assert key in totals
            assert isinstance(totals[key], int)
        assert totals["tracked"] == len(data["accounts"])
        summed_followers = sum(
            (a.get("profile") or {}).get("followers", 0) for a in data["accounts"]
        )
        assert totals["followers"] == summed_followers


# ---------- Profile Endpoint - REAL Apify data ----------
class TestProfile:
    def test_profile_natgeo_real_data(self, http):
        r = http.get(f"{BASE_URL}/api/profile/natgeo", timeout=APIFY_TIMEOUT)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        p = r.json()
        assert p["username"] == "natgeo"
        assert "national geographic" in p["full_name"].lower()
        assert p["followers"] > 100_000_000
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
        assert r.status_code in (404, 502)


# ---------- Search Endpoint ----------
class TestSearch:
    def test_search_natgeo(self, http):
        r = http.get(f"{BASE_URL}/api/search", params={"q": "natgeo"}, timeout=APIFY_TIMEOUT)
        assert r.status_code == 200
        results = r.json()
        assert isinstance(results, list)
        assert len(results) >= 1
        assert results[0]["username"] == "natgeo"

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

    def test_c_add_duplicate_fails(self, http):
        r = http.post(f"{BASE_URL}/api/accounts", params={"username": "natgeo"}, timeout=APIFY_TIMEOUT)
        assert r.status_code == 400

    def test_d_list_accounts(self, http):
        r = http.get(f"{BASE_URL}/api/accounts", timeout=15)
        assert r.status_code == 200
        accts = r.json()
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
        r = http.get(f"{BASE_URL}/api/image-proxy",
                     params={"url": "https://example.com/image.jpg"}, timeout=15)
        assert r.status_code == 400

    def test_image_proxy_returns_real_jpeg_bytes(self, http):
        p = http.get(f"{BASE_URL}/api/profile/natgeo", timeout=APIFY_TIMEOUT)
        assert p.status_code == 200
        pic_url = p.json().get("profile_pic")
        assert pic_url and ("cdninstagram.com" in pic_url or "fbcdn.net" in pic_url)
        r = http.get(f"{BASE_URL}/api/image-proxy", params={"url": pic_url}, timeout=30)
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


# ---------- Followers/Following Lists (iteration 8: NEW SCHEMA) ----------
# Response no longer contains `most_recent`. It now contains smart_recent_mode and removed_details.
EXPECTED_LIST_KEYS = [
    "current",
    "smart_recent",
    "smart_recent_mode",   # v3.4 (iteration 8)
    "added_details",
    "removed_details",     # v3.4 (iteration 8)
    "removed_usernames",
    "profile_count",
    "sample_count",
    "total_count",
    "net_change",
    "baseline_count",
    "quota_exhausted",
    "comparison_period",
    "has_baseline",
    "has_count_baseline",
    "baseline_timestamp",
]


class TestConnectionLists:
    """Basic shape + since_days variations."""

    def test_followers_list_shape(self, http):
        r = http.get(f"{BASE_URL}/api/profile/chilichidiu/followers-list",
                     params={"limit": 10, "since_days": 7}, timeout=LIST_TIMEOUT)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        data = r.json()
        for key in EXPECTED_LIST_KEYS:
            assert key in data, f"Missing key {key}"
        assert data["smart_recent_mode"] in ("exact", "approximate", "none")
        assert isinstance(data["current"], list)
        assert isinstance(data["smart_recent"], list)
        assert isinstance(data["added_details"], list)
        assert isinstance(data["removed_details"], list)
        assert isinstance(data["removed_usernames"], list)
        # NEW: 'most_recent' MUST NOT be present anymore
        assert "most_recent" not in data, "Legacy 'most_recent' field should be removed"
        assert data["comparison_period"] == "past 7 days"

    def test_following_list_shape(self, http):
        r = http.get(f"{BASE_URL}/api/profile/chilichidiu/following-list",
                     params={"limit": 10, "since_days": 7}, timeout=LIST_TIMEOUT)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        data = r.json()
        for key in EXPECTED_LIST_KEYS:
            assert key in data, f"Missing key {key}"
        assert data["smart_recent_mode"] in ("exact", "approximate", "none")
        assert "most_recent" not in data
        assert data["comparison_period"] == "past 7 days"

    def test_following_list_since_days_0_last_check(self, http):
        r = http.get(f"{BASE_URL}/api/profile/chilichidiu/following-list",
                     params={"limit": 10, "since_days": 0}, timeout=LIST_TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data["comparison_period"] == "last check"
        assert isinstance(data["has_baseline"], bool)

    def test_following_list_since_days_1(self, http):
        r = http.get(f"{BASE_URL}/api/profile/chilichidiu/following-list",
                     params={"limit": 10, "since_days": 1}, timeout=LIST_TIMEOUT)
        assert r.status_code == 200
        assert r.json()["comparison_period"] == "past 1 day"

    def test_following_list_since_days_30(self, http):
        r = http.get(f"{BASE_URL}/api/profile/chilichidiu/following-list",
                     params={"limit": 10, "since_days": 30}, timeout=LIST_TIMEOUT)
        assert r.status_code == 200
        assert r.json()["comparison_period"] == "past 30 days"

    def test_since_days_invalid_out_of_range(self, http):
        r = http.get(f"{BASE_URL}/api/profile/chilichidiu/following-list",
                     params={"limit": 10, "since_days": 400}, timeout=30)
        assert r.status_code == 422

    def test_connection_history_grows(self, http):
        r = http.get(f"{BASE_URL}/api/profile/chilichidiu/connection-history",
                     params={"connection_type": "following"}, timeout=15)
        assert r.status_code == 200
        snaps = r.json()
        assert isinstance(snaps, list)
        assert len(snaps) >= 1
        s0 = snaps[0]
        assert s0["username"] == "chilichidiu"
        assert s0["type"] == "following"
        assert "count" in s0 and "timestamp" in s0


# ---------- v3.2 real IG count fix ----------
class TestConnectionListsBugFix:
    def test_following_profile_count_uses_real_ig_total_not_scrape_cap(self, http):
        r = http.get(f"{BASE_URL}/api/profile/chilichidiu/following-list",
                     params={"limit": 100, "since_days": 7}, timeout=LIST_TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["profile_count"], int)
        assert data["total_count"] == data["profile_count"]
        if not data["quota_exhausted"] and data["current"]:
            assert data["profile_count"] > 500
            assert data["sample_count"] == len(data["current"])
            assert data["profile_count"] >= data["sample_count"]

    def test_followers_profile_count_uses_real_ig_total(self, http):
        r = http.get(f"{BASE_URL}/api/profile/chilichidiu/followers-list",
                     params={"limit": 100, "since_days": 7}, timeout=LIST_TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data["total_count"] == data["profile_count"]


# ---------- v3.4 (iteration 8) smart_recent_mode + removed_details ----------
class TestSmartRecentMode:
    """
    smart_recent_mode logic:
      - 'exact'       when full-list connection_snapshot older than since_days exists
      - 'approximate' when only follower_snapshot count-baseline exists and net_change > 0
      - 'none'        otherwise
    When mode='exact':
      - smart_recent = users present in current but NOT in old_snapshot.usernames
      - removed_details = [{'username': u} for u in old.usernames - current]
      - smart_recent is NOT capped at 200 (equal to added set size)
    """

    SEED_MARKER = "TEST_SEED_ITER8"

    def _cleanup_seed(self, db):
        db.connection_snapshots.delete_many({"_seed": self.SEED_MARKER})
        db.follower_snapshots.delete_many({"_seed": self.SEED_MARKER})

    def test_z_cleanup_before(self, db):
        self._cleanup_seed(db)

    def test_mode_field_returned(self, http):
        r = http.get(f"{BASE_URL}/api/profile/chilichidiu/following-list",
                     params={"limit": 100, "since_days": 7}, timeout=LIST_TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert "smart_recent_mode" in data
        assert data["smart_recent_mode"] in ("exact", "approximate", "none")

    def test_removed_details_field_returned(self, http):
        r = http.get(f"{BASE_URL}/api/profile/chilichidiu/following-list",
                     params={"limit": 100, "since_days": 7}, timeout=LIST_TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert "removed_details" in data
        assert isinstance(data["removed_details"], list)
        # If any removed_details items exist, each must be a dict with 'username'
        for item in data["removed_details"]:
            assert isinstance(item, dict)
            assert "username" in item

    def test_exact_mode_with_seeded_baseline(self, http, db):
        """
        Seed a full-list connection_snapshot 10 days ago for chilichidiu:
        Use the current live following list minus 5 users + 2 fake unfollows.
        Then GET /following-list?since_days=7 → expect:
          - smart_recent_mode == 'exact'
          - smart_recent length == 5 (the 5 removed from old-list slice = added when going old->current)
          - removed_details has 2 fake usernames (present in old, absent in current)
          - smart_recent is NOT capped at 200
        """
        # 1. Get current live following (uncached fresh call)
        r = http.get(f"{BASE_URL}/api/profile/chilichidiu/following-list",
                     params={"limit": 100, "since_days": 7}, timeout=LIST_TIMEOUT)
        assert r.status_code == 200
        base_data = r.json()
        current_usernames = [c["username"] for c in base_data["current"] if c.get("username")]
        assert len(current_usernames) >= 10, \
            f"Need at least 10 current users to seed a diff test; got {len(current_usernames)}"

        # 2. Build baseline: current minus first 5 (they become "added") + 2 fakes (they become "removed")
        fake_unfollowed = [f"fake_unfollowed_iter8_{i}" for i in range(2)]
        old_usernames = current_usernames[5:] + fake_unfollowed

        # Clean any prior seed
        self._cleanup_seed(db)

        # 3. Insert baseline snapshot 10 days old
        ten_days_ago = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        db.connection_snapshots.insert_one({
            "username": "chilichidiu",
            "type": "following",
            "usernames": old_usernames,
            "count": len(old_usernames),
            "timestamp": ten_days_ago,
            "_seed": self.SEED_MARKER,
        })

        try:
            # 4. Query with since_days=7 → should find the 10-day-old snapshot
            r2 = http.get(f"{BASE_URL}/api/profile/chilichidiu/following-list",
                          params={"limit": 100, "since_days": 7}, timeout=LIST_TIMEOUT)
            assert r2.status_code == 200
            data = r2.json()

            # Backend prefers full-list diff → mode should be 'exact'
            assert data["smart_recent_mode"] == "exact", (
                f"Expected mode='exact' with seeded 10-day baseline, got mode='{data['smart_recent_mode']}'. "
                f"has_baseline={data.get('has_baseline')}, baseline_ts={data.get('baseline_timestamp')}"
            )
            assert data["has_baseline"] is True

            # smart_recent must equal the 5 users we removed from the old list = current[:5] (recency order)
            sr_usernames = [u["username"] for u in data["smart_recent"]]
            expected_added = current_usernames[:5]
            # Order: added_details_ordered comes from iterating current_usernames in order,
            # so it should equal expected_added (the first 5 current users, since they're not in old)
            assert sr_usernames == expected_added, (
                f"smart_recent usernames {sr_usernames} != expected added {expected_added}"
            )
            assert len(data["smart_recent"]) == 5

            # removed_details should contain the 2 fakes (present in old, absent in current)
            removed_names = sorted([d["username"] for d in data["removed_details"]])
            assert removed_names == sorted(fake_unfollowed), (
                f"removed_details={removed_names} expected {sorted(fake_unfollowed)}"
            )
            assert sorted(data["removed_usernames"]) == sorted(fake_unfollowed)

            # smart_recent is NOT capped at 200 — it equals actual diff size (5), not 200
            assert len(data["smart_recent"]) < 200
        finally:
            self._cleanup_seed(db)

    def test_none_mode_when_no_baseline(self, http, db):
        """
        For an account with NO baseline of any kind for a since_days=7 window,
        mode should be 'none' and smart_recent should be empty.
        Use a random untracked account.
        """
        candidate = "nasa"
        # Ensure no prior snapshots exist for this window (delete all older than 7 days is not needed
        # since fresh accounts won't have any). Just check response shape.
        r = http.get(f"{BASE_URL}/api/profile/{candidate}/following-list",
                     params={"limit": 10, "since_days": 7}, timeout=LIST_TIMEOUT)
        if r.status_code != 200:
            pytest.skip(f"Could not fetch {candidate}: {r.status_code}")
        data = r.json()
        # If BOTH baselines absent → mode must be 'none' and smart_recent must be []
        if not data["has_baseline"] and not data["has_count_baseline"]:
            assert data["smart_recent_mode"] == "none"
            assert data["smart_recent"] == []
            assert data["removed_details"] == []
        elif data["has_baseline"]:
            # unlikely for fresh account but respect actual state
            assert data["smart_recent_mode"] in ("exact",)
        else:
            # only count-baseline exists
            # if net_change > 0 → 'approximate'; if <= 0 or None → 'none'
            if (data.get("net_change") or 0) > 0:
                assert data["smart_recent_mode"] == "approximate"
            else:
                assert data["smart_recent_mode"] == "none"

    def test_approximate_mode_smart_recent_uses_current_slice(self, http, db):
        """
        Force approximate mode by seeding ONLY a follower_snapshot count baseline (no connection_snapshot).
        Use a target that currently has no full-list snapshot from >7 days ago.
        For chilichidiu we can seed a stale follower_snapshot but we must ALSO delete any 
        connection_snapshot older than since_days=7. Since all current chilichidiu connection_snapshots
        are recent (< 1 day old), setting since_days=7 already won't find any full-list baseline.
        """
        # Seed old follower_snapshot for chilichidiu with a lower following count → net_change>0
        # Get current profile_count
        r0 = http.get(f"{BASE_URL}/api/profile/chilichidiu/following-list",
                      params={"limit": 100, "since_days": 7}, timeout=LIST_TIMEOUT)
        assert r0.status_code == 200
        current_profile_count = r0.json()["profile_count"]

        # Cleanup + seed
        db.follower_snapshots.delete_many({"_seed": self.SEED_MARKER})
        ten_days_ago = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        db.follower_snapshots.insert_one({
            "username": "chilichidiu",
            "followers": 100,
            "following": max(current_profile_count - 8, 1),  # net_change=+8
            "posts": 0,
            "timestamp": ten_days_ago,
            "_seed": self.SEED_MARKER,
        })

        try:
            r = http.get(f"{BASE_URL}/api/profile/chilichidiu/following-list",
                         params={"limit": 100, "since_days": 7}, timeout=LIST_TIMEOUT)
            assert r.status_code == 200
            data = r.json()
            # Since no full-list snapshot from >7d ago, but count-baseline exists → approximate
            assert data["has_baseline"] is False, "Should be no full-list baseline older than 7d"
            assert data["has_count_baseline"] is True
            assert data["net_change"] == 8
            assert data["smart_recent_mode"] == "approximate"
            # smart_recent = current_list[:min(net_change, len(current))] = first 8
            assert len(data["smart_recent"]) == min(8, len(data["current"]))
            assert data["smart_recent"] == data["current"][:len(data["smart_recent"])]
        finally:
            db.follower_snapshots.delete_many({"_seed": self.SEED_MARKER})

    def test_zz_cleanup_after(self, db):
        self._cleanup_seed(db)


# ---------- Post Comments ----------
class TestPostComments:
    def test_post_comments_shape(self, http):
        r = http.get(f"{BASE_URL}/api/profile/chilichidiu/post-comments",
                     params={"posts_limit": 2, "comments_limit": 5}, timeout=LIST_TIMEOUT)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        comments = r.json()
        assert isinstance(comments, list)
        if comments:
            c = comments[0]
            for k in ["author", "text", "likes", "timestamp", "post_url"]:
                assert k in c, f"Missing key {k} in comment"


# ---------- Rate Limiting ----------
class TestRateLimit:
    def test_search_rate_limit(self, http):
        codes = []
        for _ in range(100):
            try:
                r = requests.get(f"{BASE_URL}/api/search", params={"q": ""}, timeout=10)
                codes.append(r.status_code)
            except Exception:
                codes.append(0)
        n_429 = codes.count(429)
        assert n_429 > 0, f"Expected some 429; got {sorted(set(codes))}"
