"""
Phase 2 tests: Daily Deals CRUD + Quick Buy Again endpoint.
Uses the public preview URL via EXPO_PUBLIC_BACKEND_URL.
"""
import os
import time
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or os.environ.get("EXPO_BACKEND_URL", "https://produce-express-12.preview.emergentagent.com")).rstrip("/")

ADMIN_EMAIL = "admin@freshcuts.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def user_token(s):
    """Get a mobile user via OTP flow (mocked)."""
    mobile = "+919876500099"
    r = s.post(f"{BASE_URL}/api/auth/otp/send", json={"mobile": mobile})
    assert r.status_code == 200, r.text
    rid = r.json()["request_id"]
    r2 = s.post(f"{BASE_URL}/api/auth/otp/verify", json={"mobile": mobile, "otp": "123456", "request_id": rid})
    assert r2.status_code == 200, r2.text
    return r2.json()["access_token"]


# ============== Daily Deals ==============

class TestDealsPublicList:
    def test_get_deals_returns_seeded_three(self, s):
        r = s.get(f"{BASE_URL}/api/deals")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        names = {d["product_name"] for d in data}
        # Seeded 3
        for expected in ("Bitter Gourd", "Asparagus", "Cabbage"):
            assert expected in names, f"Expected {expected} in {names}"
        assert len(data) >= 3

    def test_deal_price_math_correct(self, s):
        r = s.get(f"{BASE_URL}/api/deals")
        for d in r.json():
            expected = round(d["original_price"] * (100 - d["discount_pct"]) / 100.0, 2)
            assert abs(d["deal_price"] - expected) < 0.01, f"bad math for {d['product_name']}"

    def test_deal_object_shape(self, s):
        r = s.get(f"{BASE_URL}/api/deals")
        keys = {"id", "product_id", "discount_pct", "product_name", "product_image",
                "product_unit", "original_price", "deal_price", "category", "cut_type"}
        for d in r.json():
            missing = keys - set(d.keys())
            assert not missing, f"missing keys: {missing}"


class TestDealsAdminCRUD:
    def _get_product_id(self, s):
        r = s.get(f"{BASE_URL}/api/products?q=Tomato")
        assert r.status_code == 200
        prods = r.json()
        # Prefer a whole tomato so we don't clash with seeded deals
        for p in prods:
            if p["name"] == "Tomato" and p["category"] == "whole":
                return p["id"]
        return prods[0]["id"]

    def test_create_deal_requires_admin(self, s):
        r = s.post(f"{BASE_URL}/api/admin/deals",
                   json={"product_id": "x", "discount_pct": 10})
        assert r.status_code in (401, 403), r.status_code

    def test_full_deal_lifecycle(self, s, admin_headers):
        pid = self._get_product_id(s)
        # CREATE
        create = s.post(
            f"{BASE_URL}/api/admin/deals",
            headers=admin_headers,
            json={"product_id": pid, "discount_pct": 20, "banner_text": "Weekend Special"},
        )
        assert create.status_code == 200, create.text
        created = create.json()
        assert created["discount_pct"] == 20
        assert created["banner_text"] == "Weekend Special"
        deal_id = created["id"]

        # Verify it shows in public /deals
        r = s.get(f"{BASE_URL}/api/deals")
        assert any(d["id"] == deal_id for d in r.json())

        # TOGGLE inactive
        toggle = s.patch(
            f"{BASE_URL}/api/admin/deals/{deal_id}?active=false",
            headers=admin_headers,
        )
        assert toggle.status_code == 200, toggle.text
        assert toggle.json()["active"] is False

        # Should NOT show in public deals
        r2 = s.get(f"{BASE_URL}/api/deals")
        assert not any(d["id"] == deal_id for d in r2.json()), "inactive deal should be hidden"

        # Toggle back active
        s.patch(f"{BASE_URL}/api/admin/deals/{deal_id}?active=true", headers=admin_headers)

        # DELETE
        d = s.delete(f"{BASE_URL}/api/admin/deals/{deal_id}", headers=admin_headers)
        assert d.status_code == 200
        r3 = s.get(f"{BASE_URL}/api/deals")
        assert not any(x["id"] == deal_id for x in r3.json())

    def test_delete_nonexistent_deal_404(self, s, admin_headers):
        r = s.delete(f"{BASE_URL}/api/admin/deals/does-not-exist", headers=admin_headers)
        assert r.status_code == 404

    def test_create_deal_invalid_product(self, s, admin_headers):
        r = s.post(f"{BASE_URL}/api/admin/deals", headers=admin_headers,
                   json={"product_id": "does-not-exist", "discount_pct": 15})
        assert r.status_code == 400


# ============== Quick Buy Again ==============

class TestQuickBuyAgain:
    def test_requires_auth(self, s):
        r = s.get(f"{BASE_URL}/api/orders/quick-buy-again")
        assert r.status_code == 401

    def test_returns_empty_for_new_user(self, s, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        r = s.get(f"{BASE_URL}/api/orders/quick-buy-again", headers=h)
        assert r.status_code == 200
        assert r.json() == []

    def test_returns_sorted_after_orders(self, s, user_token):
        h = {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}
        # Get a product
        prods = s.get(f"{BASE_URL}/api/products?q=Onion").json()
        assert len(prods) >= 1
        p1 = prods[0]
        prods2 = s.get(f"{BASE_URL}/api/products?q=Potato").json()
        p2 = prods2[0]

        # Place 2 orders for p1 and 1 for p2 so p1 must sort higher
        def _order(pid, name, qty):
            body = {
                "items": [{
                    "product_id": pid, "name": name, "price": 59.0,
                    "quantity": qty, "cut_type": "whole", "unit": "500g",
                    "image": "x",
                }],
                "address": "TEST 1 Street", "pincode": "560001", "phone": "9876500099",
                "payment_method": "cod", "delivery_fee": 0, "subtotal": 59.0, "total": 59.0,
            }
            r = s.post(f"{BASE_URL}/api/orders", headers=h, json=body)
            assert r.status_code == 200, r.text

        _order(p1["id"], p1["name"], 2)
        _order(p1["id"], p1["name"], 1)
        _order(p2["id"], p2["name"], 1)
        time.sleep(0.5)

        r = s.get(f"{BASE_URL}/api/orders/quick-buy-again", headers=h)
        assert r.status_code == 200
        result = r.json()
        assert len(result) >= 1
        # p1 must be first (higher order_count)
        assert result[0]["product_id"] == p1["id"], result
        assert result[0]["order_count"] >= result[-1]["order_count"]


# ============== Regressions ==============

class TestRegressions:
    def test_products_count_164(self, s):
        r = s.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        assert len(r.json()) == 164

    def test_product_detail_works(self, s):
        prods = s.get(f"{BASE_URL}/api/products").json()
        pid = prods[0]["id"]
        r = s.get(f"{BASE_URL}/api/products/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid

    def test_pincode_check_works(self, s):
        r = s.get(f"{BASE_URL}/api/pincodes/check/560001")
        assert r.status_code == 200 and r.json().get("serviceable") is True
