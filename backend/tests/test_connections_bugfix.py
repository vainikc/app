"""
Backend tests for iteration 9 — Connections bug fix + Mutuals feature.

Scope (per review_request):
- BUG FIX #1: /followers-list vs /following-list return DIFFERENT lists for
              the same tracked account (@ashvi.thakkarr). Previously both
              returned identical data because Apify `selectType` param was
              ignored. Now uses `dataToScrape` (Followers/Followings).
- BUG FIX #2: Corrupted 'following' snapshots wiped; new snapshots stored
              contain actual following list (not followers list).
- FEATURE:    GET /api/profile/{username}/mutuals — intersection of
              followers ∩ following, returns {mutuals, mutual_count,
              followers_sampled, following_sampled}.
- REGRESSION: Auth flows still work (login / /me / logout / protected 401).
"""
import time
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or
            "https://insta-sleuth-1.preview.emergentagent.com").rstrip("/")

TARGET = "ashvi.thakkarr"      # Primary tracked account per review_request
SECONDARY = "chilichidiu"

LIST_TIMEOUT = 240              # Apify list endpoints can take 30-120s each
MUTUALS_TIMEOUT = 300           # fetches 2 lists in parallel


# =========================================================================
# REGRESSION: Auth flow
# =========================================================================
class TestAuthRegression:
    def test_login_sets_cookies(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": "admin@sherlock.app", "password": "Sherlock2026!"},
                   timeout=15)
        assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
        body = r.json()
        assert body["email"] == "admin@sherlock.app"
        assert body["role"] == "admin"
        # Cookies must be set on session
        cookie_names = {c.name for c in s.cookies}
        assert "access_token" in cookie_names
        assert "refresh_token" in cookie_names

    def test_me_returns_current_user(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == "admin@sherlock.app"

    def test_protected_route_without_auth_returns_401(self):
        # Fresh session, no cookies
        r = requests.get(f"{BASE_URL}/api/accounts", timeout=10)
        assert r.status_code == 401

    def test_protected_mutuals_without_auth_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/profile/{TARGET}/mutuals", timeout=10)
        assert r.status_code == 401

    def test_logout_clears_cookies(self):
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login",
               json={"email": "admin@sherlock.app", "password": "Sherlock2026!"},
               timeout=15)
        r = s.post(f"{BASE_URL}/api/auth/logout", timeout=10)
        assert r.status_code in (200, 204)
        # After logout, /me should be 401
        r2 = s.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r2.status_code == 401


# =========================================================================
# BUG FIX #1: followers-list vs following-list return DIFFERENT lists
# =========================================================================
class TestFollowersVsFollowingBugFix:
    """
    Critical bug: previously both endpoints returned identical data because
    the Apify actor's `selectType` param was ignored. Now uses `dataToScrape`
    with `Followers` / `Followings`.
    """

    @pytest.fixture(scope="class")
    def followers_data(self, auth_session):
        r = auth_session.get(
            f"{BASE_URL}/api/profile/{TARGET}/followers-list",
            params={"limit": 100, "since_days": 7},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200, f"followers-list failed: {r.status_code} {r.text[:300]}"
        return r.json()

    @pytest.fixture(scope="class")
    def following_data(self, auth_session):
        r = auth_session.get(
            f"{BASE_URL}/api/profile/{TARGET}/following-list",
            params={"limit": 100, "since_days": 7},
            timeout=LIST_TIMEOUT,
        )
        assert r.status_code == 200, f"following-list failed: {r.status_code} {r.text[:300]}"
        return r.json()

    def test_followers_list_returns_data(self, followers_data):
        if followers_data.get("quota_exhausted"):
            pytest.skip("Apify quota exhausted for followers-list — cannot verify")
        assert isinstance(followers_data["current"], list)
        assert len(followers_data["current"]) > 0, "Expected followers to have real data"

    def test_following_list_returns_data(self, following_data):
        if following_data.get("quota_exhausted"):
            pytest.skip("Apify quota exhausted for following-list — cannot verify")
        assert isinstance(following_data["current"], list)
        assert len(following_data["current"]) > 0, "Expected following to have real data"

    def test_followers_and_following_are_different_lists(self, followers_data, following_data):
        """The CRITICAL bug fix assertion — lists must NOT be identical."""
        if followers_data.get("quota_exhausted") or following_data.get("quota_exhausted"):
            pytest.skip("Apify quota exhausted — cannot verify bug fix")

        followers_names = [u["username"] for u in followers_data["current"] if u.get("username")]
        following_names = [u["username"] for u in following_data["current"] if u.get("username")]

        assert followers_names, "followers list is empty"
        assert following_names, "following list is empty"

        # Sanity: the entire lists must not be identical
        assert followers_names != following_names, (
            "BUG FIX #1 FAILED: followers-list and following-list return "
            "IDENTICAL data — Apify dataToScrape param is not working."
        )

        # Stronger: the first 5 users of each list should not be identical
        # (they'd differ by ordering even if there is overlap)
        assert followers_names[:5] != following_names[:5], (
            f"BUG FIX #1 FAILED: first 5 of followers ({followers_names[:5]}) "
            f"== first 5 of following ({following_names[:5]})"
        )

        # There should exist at least one user in followers NOT in following
        # (impossible if lists were identical). Sets differ.
        fs = set(followers_names)
        gs = set(following_names)
        assert fs != gs, "followers set == following set (identical lists)"
        assert len(fs - gs) > 0 or len(gs - fs) > 0, "No asymmetry between followers and following"

    def test_profile_counts_are_different_dimensions(self, followers_data, following_data):
        """profile_count on followers-list = followers total; on following-list = following total.
        These should typically differ."""
        # These come from the profile call and are the real IG counts.
        # This won't catch a bug in the LIST content, but validates the fields exist.
        assert isinstance(followers_data["profile_count"], int)
        assert isinstance(following_data["profile_count"], int)


# =========================================================================
# BUG FIX #2: 'following' snapshots contain actual following list, not followers
# =========================================================================
class TestFollowingSnapshotIntegrity:
    """
    After the fix, when GET /following-list is called it internally caches
    a new snapshot in db.connection_snapshots{type='following'}. The stored
    usernames should match the ACTUAL following list, not the followers list.
    """

    def test_following_snapshot_matches_following_not_followers(self, auth_session, db):
        # Trigger a fresh call to /following-list to store a new snapshot
        r_following = auth_session.get(
            f"{BASE_URL}/api/profile/{TARGET}/following-list",
            params={"limit": 100, "since_days": 7},
            timeout=LIST_TIMEOUT,
        )
        assert r_following.status_code == 200
        following_data = r_following.json()
        if following_data.get("quota_exhausted"):
            pytest.skip("Apify quota exhausted — cannot verify snapshot integrity")

        current_following_names = set(
            u["username"] for u in following_data["current"] if u.get("username")
        )
        assert current_following_names, "Following list is empty — cannot verify"

        # Fetch the latest 'following' snapshot from Mongo
        latest = db.connection_snapshots.find_one(
            {"username": TARGET, "type": "following"},
            sort=[("timestamp", -1)],
        )
        assert latest is not None, "No 'following' snapshot exists after calling /following-list"

        snapshot_names = set(latest.get("usernames", []))
        assert snapshot_names, "Latest 'following' snapshot has empty usernames"

        # Get followers list to compare — snapshot must NOT be equal to followers
        r_followers = auth_session.get(
            f"{BASE_URL}/api/profile/{TARGET}/followers-list",
            params={"limit": 100, "since_days": 7},
            timeout=LIST_TIMEOUT,
        )
        assert r_followers.status_code == 200
        followers_data = r_followers.json()
        current_followers_names = set(
            u["username"] for u in followers_data["current"] if u.get("username")
        )

        if current_followers_names:
            # The 'following' snapshot must overlap heavily with actual following list,
            # NOT with the followers list (the previous bug).
            overlap_with_following = len(snapshot_names & current_following_names)
            overlap_with_followers = len(snapshot_names & current_followers_names)

            assert overlap_with_following >= overlap_with_followers, (
                f"BUG FIX #2 FAILED: 'following' snapshot overlaps more with "
                f"followers ({overlap_with_followers}) than following "
                f"({overlap_with_following}). Snapshot may still contain wrong list."
            )

            # Sanity: snapshot should be substantially the same as current following
            # (may differ slightly because scrapes are non-deterministic in ordering
            # and pagination)
            assert overlap_with_following > len(snapshot_names) * 0.5, (
                f"'following' snapshot overlap with current following list is too low "
                f"({overlap_with_following}/{len(snapshot_names)}) — content mismatch"
            )


# =========================================================================
# FEATURE: /mutuals endpoint semantic correctness
# =========================================================================
class TestMutualsEndpoint:
    """
    Verify GET /api/profile/{username}/mutuals:
      (a) returns proper shape {mutuals, mutual_count, followers_sampled, following_sampled}
      (b) every user in mutuals appears in BOTH followers AND following lists
      (c) mutual_count == len(mutuals)
      (d) rate limits and validation
    """

    @pytest.fixture(scope="class")
    def mutuals_response(self, auth_session):
        r = auth_session.get(
            f"{BASE_URL}/api/profile/{TARGET}/mutuals",
            params={"limit": 200},
            timeout=MUTUALS_TIMEOUT,
        )
        assert r.status_code == 200, f"mutuals failed: {r.status_code} {r.text[:300]}"
        return r.json()

    def test_mutuals_response_shape(self, mutuals_response):
        data = mutuals_response
        for key in ("username", "mutuals", "mutual_count", "followers_sampled",
                    "following_sampled", "quota_exhausted"):
            assert key in data, f"Missing key '{key}' in mutuals response"
        assert data["username"] == TARGET
        assert isinstance(data["mutuals"], list)
        assert isinstance(data["mutual_count"], int)
        assert isinstance(data["followers_sampled"], int)
        assert isinstance(data["following_sampled"], int)
        assert data["mutual_count"] == len(data["mutuals"])

    def test_mutuals_has_data(self, mutuals_response):
        if mutuals_response.get("quota_exhausted"):
            pytest.skip("Apify quota exhausted — mutuals endpoint")
        # Main agent's smoke test found 64+ mutuals — expect > 0
        assert mutuals_response["mutual_count"] > 0, (
            "Expected mutuals for @ashvi.thakkarr > 0 "
            "(main agent found 64 in curl and 123 in browser)"
        )
        assert mutuals_response["followers_sampled"] > 0
        assert mutuals_response["following_sampled"] > 0

    def test_mutuals_are_intersection_of_followers_and_following(self, auth_session, mutuals_response):
        """
        CRITICAL semantic check: every user in mutuals must exist in
        BOTH the followers list AND the following list.
        """
        if mutuals_response.get("quota_exhausted"):
            pytest.skip("Apify quota exhausted — cannot verify intersection")

        limit = 200

        r_fol = auth_session.get(
            f"{BASE_URL}/api/profile/{TARGET}/followers-list",
            params={"limit": limit, "since_days": 7},
            timeout=LIST_TIMEOUT,
        )
        assert r_fol.status_code == 200
        followers_names = set(
            u["username"] for u in r_fol.json()["current"] if u.get("username")
        )

        r_fng = auth_session.get(
            f"{BASE_URL}/api/profile/{TARGET}/following-list",
            params={"limit": limit, "since_days": 7},
            timeout=LIST_TIMEOUT,
        )
        assert r_fng.status_code == 200
        following_names = set(
            u["username"] for u in r_fng.json()["current"] if u.get("username")
        )

        assert followers_names, "followers list came back empty"
        assert following_names, "following list came back empty"

        mutual_names = [u["username"] for u in mutuals_response["mutuals"] if u.get("username")]
        assert mutual_names, "mutuals list is empty"

        # THE core semantic check
        missing_from_followers = [u for u in mutual_names if u not in followers_names]
        missing_from_following = [u for u in mutual_names if u not in following_names]

        assert not missing_from_followers, (
            f"MUTUALS BUG: {len(missing_from_followers)} user(s) in mutuals "
            f"are NOT in followers list, e.g. {missing_from_followers[:5]}"
        )
        assert not missing_from_following, (
            f"MUTUALS BUG: {len(missing_from_following)} user(s) in mutuals "
            f"are NOT in following list, e.g. {missing_from_following[:5]}"
        )

        # Reverse check: mutual_count must equal set-intersection size
        expected_intersection = followers_names & following_names
        assert set(mutual_names) == expected_intersection, (
            f"mutuals set ({len(mutual_names)}) != intersection "
            f"({len(expected_intersection)}). "
            f"Missing from mutuals: {list(expected_intersection - set(mutual_names))[:5]}. "
            f"Extra in mutuals: {list(set(mutual_names) - expected_intersection)[:5]}."
        )

    def test_mutuals_default_limit_is_200(self, auth_session):
        """The docstring states default limit=200 and cap=1000."""
        r = auth_session.get(
            f"{BASE_URL}/api/profile/{TARGET}/mutuals",
            timeout=MUTUALS_TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        if not data.get("quota_exhausted"):
            # With default limit 200 both samples should be attempted at up to 200
            assert data["followers_sampled"] <= 200
            assert data["following_sampled"] <= 200

    def test_mutuals_limit_validation_upper_bound(self, auth_session):
        # Query > 1000 must return 422 (Pydantic Query validation le=1000)
        r = auth_session.get(
            f"{BASE_URL}/api/profile/{TARGET}/mutuals",
            params={"limit": 5000},
            timeout=30,
        )
        assert r.status_code == 422

    def test_mutuals_limit_validation_lower_bound(self, auth_session):
        r = auth_session.get(
            f"{BASE_URL}/api/profile/{TARGET}/mutuals",
            params={"limit": 0},
            timeout=30,
        )
        assert r.status_code == 422
