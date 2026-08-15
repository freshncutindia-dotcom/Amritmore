"""Backend tests for FreshCuts Smart Search + Subscriptions (iteration 15)."""
import os
import time
import pytest
import requests
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

FRONTEND_ENV = Path(__file__).resolve().parents[2] / "frontend" / ".env"
BACKEND_ENV = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(FRONTEND_ENV)
load_dotenv(BACKEND_ENV)

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


# ---- helpers ----
def _login_admin(session: requests.Session) -> str:
    r = session.post(f"{API}/auth/login", json={
        "email": "admin@freshcuts.com", "password": "Admin@123",
    })
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _otp_login(session: requests.Session, mobile: str) -> str:
    r = session.post(f"{API}/auth/otp/send", json={"mobile": mobile})
    assert r.status_code == 200, r.text
    req_id = r.json()["request_id"]
    r = session.post(f"{API}/auth/otp/verify", json={
        "request_id": req_id, "mobile": mobile, "otp": "123456",
    })
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_headers(s):
    tok = _login_admin(s)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def customer_headers(s):
    mobile = f"98{int(time.time()) % 100000000:08d}"
    tok = _otp_login(s, mobile)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}, mobile


# ------------------ SMART SEARCH ------------------
class TestSearchSuggest:
    def test_dhaniya_returns_coriander(self, s):
        r = s.get(f"{API}/search/suggest", params={"q": "dhan"})
        assert r.status_code == 200
        j = r.json()
        names = [x["name"].lower() for x in j["suggestions"]]
        assert any("coriander" in n for n in names), f"Expected coriander in {names}"
        # expanded terms should include coriander (dhaniya synonym)
        assert any("coriander" in e for e in j.get("expanded", [])) or "dhan" in "".join(names)

    def test_bhindi_returns_okra(self, s):
        r = s.get(f"{API}/search/suggest", params={"q": "bhindi"})
        assert r.status_code == 200
        names = [x["name"].lower() for x in r.json()["suggestions"]]
        assert any("okra" in n or "lady" in n for n in names), f"names={names}"

    def test_short_query_returns_empty(self, s):
        r = s.get(f"{API}/search/suggest", params={"q": "a"})
        assert r.status_code == 200
        assert r.json()["suggestions"] == []

    def test_suggest_excludes_unavailable(self, s, admin_headers):
        # find a product, mark unavailable, verify excluded, revert
        r = s.get(f"{API}/products", params={"q": "coriander"})
        assert r.status_code == 200
        prods = r.json()
        if not prods:
            pytest.skip("no coriander product")
        pid = prods[0]["id"]
        # patch to unavailable
        r = s.patch(f"{API}/admin/products/{pid}", json={"is_available": False}, headers=admin_headers)
        assert r.status_code == 200
        try:
            r = s.get(f"{API}/search/suggest", params={"q": "coriander"})
            ids = [x["id"] for x in r.json()["suggestions"]]
            assert pid not in ids, f"unavailable product {pid} leaked into suggestions {ids}"
        finally:
            s.patch(f"{API}/admin/products/{pid}", json={"is_available": True}, headers=admin_headers)


class TestProductFilters:
    def test_synonym_aloo_returns_potato(self, s):
        r = s.get(f"{API}/products", params={"q": "aloo"})
        assert r.status_code == 200
        names = [p["name"].lower() for p in r.json()]
        assert any("potato" in n for n in names), f"names={names}"

    def test_price_range_filter(self, s):
        r = s.get(f"{API}/products", params={"min_price": 0, "max_price": 50})
        assert r.status_code == 200
        prods = r.json()
        assert prods, "expected some products under 50"
        for p in prods:
            assert p["price"] <= 50, f"product {p['name']} price {p['price']} > 50"

    def test_min_price_filter(self, s):
        r = s.get(f"{API}/products", params={"min_price": 100})
        assert r.status_code == 200
        for p in r.json():
            assert p["price"] >= 100

    def test_in_stock_true_excludes_zero(self, s):
        r = s.get(f"{API}/products", params={"in_stock": "true"})
        assert r.status_code == 200
        for p in r.json():
            assert p["stock"] > 0, f"{p['name']} has stock={p['stock']}"

    def test_combined_filters(self, s):
        r = s.get(f"{API}/products", params={"q": "potato", "in_stock": "true", "max_price": 200})
        assert r.status_code == 200
        for p in r.json():
            assert p["stock"] > 0 and p["price"] <= 200


# ------------------ SUBSCRIPTIONS ------------------
@pytest.fixture(scope="module")
def one_product(s):
    r = s.get(f"{API}/products", params={"in_stock": "true"})
    assert r.status_code == 200 and r.json(), "no in-stock products"
    return r.json()[0]


@pytest.fixture(scope="module")
def sub_payload(one_product):
    return {
        "name": "TEST basket",
        "items": [{
            "product_id": one_product["id"],
            "name": one_product["name"],
            "price": one_product["price"],
            "quantity": 2,
            "unit": one_product.get("unit", "500g"),
            "cut_type": (one_product.get("available_cuts") or ["whole"])[0],
            "image": one_product.get("image", "https://example.com/x.png"),
        }],
        "frequency": "weekly",
        "weekly_day": 5,  # Saturday
        "address": "TEST 123 Test Street, Fort",
        "pincode": "400001",
        "phone": "9876500001",
    }


class TestSubscriptionsCRUD:
    def test_create_requires_auth(self, s, sub_payload):
        r = s.post(f"{API}/subscriptions", json=sub_payload)
        assert r.status_code in (401, 403)

    def test_create_bad_pincode(self, s, customer_headers, sub_payload):
        hdr, _ = customer_headers
        bad = {**sub_payload, "pincode": "999999"}
        r = s.post(f"{API}/subscriptions", json=bad, headers=hdr)
        assert r.status_code == 400
        assert "servic" in r.json().get("detail", "").lower()

    def test_create_empty_items(self, s, customer_headers, sub_payload):
        hdr, _ = customer_headers
        bad = {**sub_payload, "items": []}
        r = s.post(f"{API}/subscriptions", json=bad, headers=hdr)
        # FastAPI may return 422 for empty list at pydantic layer or 400 at endpoint
        assert r.status_code in (400, 422)

    def test_create_weekly_next_date_alignment(self, s, customer_headers, sub_payload):
        hdr, _ = customer_headers
        r = s.post(f"{API}/subscriptions", json=sub_payload, headers=hdr)
        assert r.status_code == 200, r.text
        sub = r.json()
        assert sub["status"] == "active"
        assert sub["next_delivery_date"], "no next_delivery_date"
        nd = date.fromisoformat(sub["next_delivery_date"])
        assert nd > date.today() - timedelta(days=1), "next_delivery_date must be tomorrow or later"
        assert nd.weekday() == 5, f"weekly_day=5 (Sat) but next_delivery_date weekday={nd.weekday()}"
        # save sub id
        pytest.sub_id = sub["id"]

    def test_list_subscriptions(self, s, customer_headers):
        hdr, _ = customer_headers
        r = s.get(f"{API}/subscriptions", headers=hdr)
        assert r.status_code == 200
        assert any(x["id"] == pytest.sub_id for x in r.json())

    def test_pause_resume(self, s, customer_headers):
        hdr, _ = customer_headers
        r = s.patch(f"{API}/subscriptions/{pytest.sub_id}", json={"status": "paused"}, headers=hdr)
        assert r.status_code == 200 and r.json()["status"] == "paused"
        r = s.patch(f"{API}/subscriptions/{pytest.sub_id}", json={"status": "active"}, headers=hdr)
        assert r.status_code == 200 and r.json()["status"] == "active"

    def test_frequency_change_recomputes(self, s, customer_headers):
        hdr, _ = customer_headers
        r = s.patch(f"{API}/subscriptions/{pytest.sub_id}", json={"frequency": "daily"}, headers=hdr)
        assert r.status_code == 200
        j = r.json()
        assert j["frequency"] == "daily"
        nd = date.fromisoformat(j["next_delivery_date"])
        assert nd == date.today() + timedelta(days=1), f"daily should be tomorrow, got {nd}"

    def test_skip_advances_date(self, s, customer_headers):
        hdr, _ = customer_headers
        r = s.get(f"{API}/subscriptions", headers=hdr)
        cur = next(x for x in r.json() if x["id"] == pytest.sub_id)
        before = date.fromisoformat(cur["next_delivery_date"])
        r = s.post(f"{API}/subscriptions/{pytest.sub_id}/skip", headers=hdr)
        assert r.status_code == 200
        after = date.fromisoformat(r.json()["next_delivery_date"])
        assert after > before, f"skip did not advance {before} -> {after}"

    def test_cancel_excludes_from_list(self, s, customer_headers):
        hdr, _ = customer_headers
        r = s.patch(f"{API}/subscriptions/{pytest.sub_id}", json={"status": "cancelled"}, headers=hdr)
        assert r.status_code == 200
        r = s.get(f"{API}/subscriptions", headers=hdr)
        ids = [x["id"] for x in r.json()]
        assert pytest.sub_id not in ids, "cancelled sub still in list"


# ------------------ ADMIN + SCHEDULER ------------------
class TestAdminSubscriptions:
    def test_admin_list(self, s, admin_headers):
        r = s.get(f"{API}/admin/subscriptions", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_stats_has_active_subs(self, s, admin_headers):
        r = s.get(f"{API}/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        assert "active_subscriptions" in r.json()

    def test_run_generates_order_for_due(self, s, admin_headers, customer_headers, sub_payload, one_product):
        # Create a fresh sub then force it due via Mongo
        hdr, _ = customer_headers
        payload = {**sub_payload, "frequency": "daily", "weekly_day": None, "name": "TEST due basket"}
        r = s.post(f"{API}/subscriptions", json=payload, headers=hdr)
        assert r.status_code == 200
        sub = r.json()

        async def _force_due():
            client = AsyncIOMotorClient(MONGO_URL)
            db = client[DB_NAME]
            yesterday = (date.today() - timedelta(days=1)).isoformat()
            await db.subscriptions.update_one({"id": sub["id"]}, {"$set": {"next_delivery_date": yesterday}})
            client.close()

        asyncio.run(_force_due())

        # snapshot stock before
        r = s.get(f"{API}/products/{one_product['id']}")
        stock_before = r.json()["stock"]

        r = s.post(f"{API}/admin/subscriptions/run", headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json().get("generated", 0) >= 1

        # verify a subscription-source order was created for this user
        r = s.get(f"{API}/admin/orders", headers=admin_headers)
        assert r.status_code == 200
        orders = r.json()
        found = [o for o in orders if o.get("source") == "subscription" and o.get("subscription_id") == sub["id"]]
        assert found, "no subscription-generated order found"
        order = found[0]
        assert order.get("payment_method") == "cod"

        # stock decremented
        r = s.get(f"{API}/products/{one_product['id']}")
        assert r.json()["stock"] == stock_before - 2, f"stock not decremented: {stock_before} -> {r.json()['stock']}"

        # sub next_date advanced + orders_generated incremented
        r = s.get(f"{API}/subscriptions", headers=hdr)
        cur = next(x for x in r.json() if x["id"] == sub["id"])
        assert date.fromisoformat(cur["next_delivery_date"]) >= date.today() + timedelta(days=1)
        assert cur["orders_generated"] >= 1

        # cleanup: cancel
        s.patch(f"{API}/subscriptions/{sub['id']}", json={"status": "cancelled"}, headers=hdr)


# ------------------ LEGACY BOX ENDPOINTS SHOULD BE REMOVED ------------------
class TestLegacyRemoved:
    @pytest.mark.parametrize("path", [
        "/subscriptions/boxes",
        "/admin/subscription-boxes",
    ])
    def test_legacy_endpoints_404(self, s, path):
        r = s.get(f"{API}{path}")
        assert r.status_code in (404, 405), f"legacy endpoint {path} still responds: {r.status_code}"
