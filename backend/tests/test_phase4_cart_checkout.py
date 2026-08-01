"""Phase 4 backend tests: Saved addresses + Delivery slots + Order with slot fields.

Scope: /api/delivery/slots, /api/addresses CRUD + default, /api/orders (Phase 4 fields).
Regression check: /api/deals, /api/products, /api/auth/otp/*, /api/geo/reverse-pin.

Razorpay is intentionally NOT tested (Phase 5 deferred by user).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_BACKEND_URL",
    "https://produce-express-12.preview.emergentagent.com",
).rstrip("/")

API = f"{BASE_URL}/api"
TIMEOUT = 30


# -------- helpers / fixtures --------

@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def otp_user(s):
    """Create a fresh mobile OTP user so we don't pollute admin's seeded address."""
    # unique 10-digit mobile
    mobile = "9" + str(uuid.uuid4().int)[:9]
    r = s.post(f"{API}/auth/otp/send", json={"mobile": mobile}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    req_id = r.json()["request_id"]
    r = s.post(
        f"{API}/auth/otp/verify",
        json={"mobile": mobile, "otp": "123456", "request_id": req_id},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    return {"token": tok, "mobile": mobile, "email": r.json()["email"]}


@pytest.fixture(scope="module")
def auth_headers(otp_user):
    return {"Authorization": f"Bearer {otp_user['token']}", "Content-Type": "application/json"}


# ============ Delivery Slots ============

class TestDeliverySlots:
    def test_slots_public(self, s):
        r = s.get(f"{API}/delivery/slots", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "slots" in data and "handling_fee" in data
        assert data["handling_fee"] == 9
        slots = data["slots"]
        assert isinstance(slots, list) and len(slots) >= 3
        # 3 scheduled slots (7-11 AM, 11-3, 3-7) always present
        types = [x["type"] for x in slots]
        assert types.count("scheduled") == 3
        # each scheduled fee = 29
        for sl in slots:
            if sl["type"] == "scheduled":
                assert sl["fee"] == 29
            if sl["type"] == "express":
                assert sl["fee"] == 49
        # ids/labels have expected shape
        labels = [sl["label"] for sl in slots]
        assert any("7 – 11 AM" in l for l in labels)
        assert any("11 AM – 3 PM" in l for l in labels)
        assert any("3 – 7 PM" in l for l in labels)


# ============ Addresses ============

class TestAddresses:
    def test_list_requires_auth(self, s):
        r = s.get(f"{API}/addresses", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_create_invalid_pincode(self, s, auth_headers):
        payload = {
            "label": "home", "name": "TEST User", "mobile": "9999900000",
            "line1": "F-1", "area": "Test Area", "pincode": "12345",  # 5 digits
        }
        r = s.post(f"{API}/addresses", json=payload, headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 400, r.text

    def test_create_first_address_auto_default(self, s, auth_headers):
        # Ensure clean slate: delete any existing (fresh user, should be empty)
        r = s.get(f"{API}/addresses", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        for a in r.json():
            s.delete(f"{API}/addresses/{a['id']}", headers=auth_headers, timeout=TIMEOUT)

        payload = {
            "label": "home", "name": "TEST User", "mobile": "9999900000",
            "line1": "F-1 Test Bldg", "line2": "Near park", "area": "Koramangala",
            "pincode": "560034", "is_default": False,  # explicitly false
        }
        r = s.post(f"{API}/addresses", json=payload, headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["is_default"] is True, "first address must be auto-defaulted"
        assert body["pincode"] == "560034"
        assert "id" in body
        pytest.first_addr_id = body["id"]

        # Verify via GET
        r = s.get(f"{API}/addresses", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert any(a["id"] == body["id"] and a["is_default"] for a in r.json())

    def test_second_address_with_default_clears_others(self, s, auth_headers):
        payload = {
            "label": "office", "name": "TEST Office", "mobile": "9999900001",
            "line1": "Suite 4", "area": "BTM Layout", "pincode": "560076",
            "is_default": True,
        }
        r = s.post(f"{API}/addresses", json=payload, headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        new_id = r.json()["id"]
        assert r.json()["is_default"] is True
        pytest.second_addr_id = new_id

        # Confirm only ONE default in list
        r = s.get(f"{API}/addresses", headers=auth_headers, timeout=TIMEOUT)
        addrs = r.json()
        defaults = [a for a in addrs if a["is_default"]]
        assert len(defaults) == 1
        assert defaults[0]["id"] == new_id

    def test_patch_updates_only_owner(self, s, auth_headers):
        aid = pytest.first_addr_id
        r = s.patch(
            f"{API}/addresses/{aid}",
            json={
                "label": "home", "name": "TEST User Renamed", "mobile": "9999900000",
                "line1": "F-1 Test Bldg", "area": "Koramangala", "pincode": "560034",
                "is_default": False,
            },
            headers=auth_headers, timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "TEST User Renamed"

        # Bogus id → 404
        r = s.patch(
            f"{API}/addresses/{uuid.uuid4()}",
            json={
                "label": "home", "name": "x", "mobile": "9", "line1": "x",
                "area": "x", "pincode": "560034",
            },
            headers=auth_headers, timeout=TIMEOUT,
        )
        assert r.status_code == 404

    def test_set_default_endpoint(self, s, auth_headers):
        # switch default back to first
        aid = pytest.first_addr_id
        r = s.post(f"{API}/addresses/{aid}/default", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["is_default"] is True

        r = s.get(f"{API}/addresses", headers=auth_headers, timeout=TIMEOUT)
        defaults = [a for a in r.json() if a["is_default"]]
        assert len(defaults) == 1 and defaults[0]["id"] == aid

        # 404 on bogus
        r = s.post(f"{API}/addresses/{uuid.uuid4()}/default", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 404

    def test_delete_address(self, s, auth_headers):
        aid = pytest.second_addr_id
        r = s.delete(f"{API}/addresses/{aid}", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        # 404 on second attempt
        r = s.delete(f"{API}/addresses/{aid}", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 404


# ============ Orders w/ Phase 4 fields ============

class TestOrderPhase4:
    def test_place_cod_order_with_slot(self, s, auth_headers):
        # get a product
        r = s.get(f"{API}/products", timeout=TIMEOUT)
        assert r.status_code == 200
        prod = r.json()[0]

        slots = s.get(f"{API}/delivery/slots", timeout=TIMEOUT).json()["slots"]
        slot = next((x for x in slots if x["type"] == "express"), slots[0])
        handling = 9

        # Self-contained: create an address in this test (xdist-safe)
        r = s.post(
            f"{API}/addresses",
            json={
                "label": "home", "name": "TEST Order", "mobile": "9999900002",
                "line1": "Order Test Bldg", "area": "Koramangala",
                "pincode": "560034", "is_default": True,
            },
            headers=auth_headers, timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        addr_id = r.json()["id"]
        item_total = float(prod["price"]) * 2
        total = item_total + slot["fee"] + handling
        payload = {
            "items": [{
                "product_id": prod["id"], "name": prod["name"], "price": float(prod["price"]),
                "quantity": 2, "cut_type": prod.get("cut_type", "whole"),
                "unit": prod.get("unit", "500g"), "image": prod.get("image", ""),
            }],
            "address": "TEST User, F-1, Koramangala",
            "pincode": "560034",
            "phone": "9999900000",
            "payment_method": "cod",
            "delivery_fee": slot["fee"],
            "handling_fee": handling,
            "subtotal": item_total,
            "total": total,
            "address_id": addr_id,
            "delivery_slot_id": slot["id"],
            "delivery_slot_label": slot["label"],
        }
        r = s.post(f"{API}/orders", json=payload, headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["payment_method"] == "cod"
        assert order["handling_fee"] == handling
        assert order["delivery_slot_id"] == slot["id"]
        assert order["delivery_slot_label"] == slot["label"]
        assert order["address_id"] == addr_id
        assert order["status"] == "pending"

        # Verify via GET
        r = s.get(f"{API}/orders/{order['id']}", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        got = r.json()
        assert got["delivery_slot_id"] == slot["id"]
        assert got["delivery_slot_label"] == slot["label"]


# ============ Regressions ============

class TestRegressions:
    def test_deals_still_public(self, s):
        r = s.get(f"{API}/deals", timeout=TIMEOUT)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_products_list(self, s):
        r = s.get(f"{API}/products", timeout=TIMEOUT)
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_otp_send_and_verify_flow(self, s):
        mobile = "9" + str(uuid.uuid4().int)[:9]
        r = s.post(f"{API}/auth/otp/send", json={"mobile": mobile}, timeout=TIMEOUT)
        assert r.status_code == 200
        req_id = r.json()["request_id"]
        r = s.post(f"{API}/auth/otp/verify",
                   json={"mobile": mobile, "otp": "123456", "request_id": req_id},
                   timeout=TIMEOUT)
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_geo_reverse_pin(self, s):
        r = s.get(f"{API}/geo/reverse-pin", params={"lat": 12.9352, "lng": 77.6146}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("pincode") == "560034"
