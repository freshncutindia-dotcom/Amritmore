"""
FreshCuts Admin Panel & Contact/Support backend tests (Iteration 14).
Covers:
- GET /api/admin/stats
- GET /api/admin/orders?status=<>, PATCH /api/admin/orders/{id}/status (COD delivered => paid)
- PATCH /api/admin/products/{id} (name/price/stock/available_weights/available_cuts/is_available)
  + whole/organic category rule (available_cuts forced to ['whole'])
- PATCH /api/admin/products/{id}/stock (delta, floors at 0)
- Public GET /api/products excludes is_available=false; include_unavailable=true includes them
- POST /api/contact (auth, subject/message validation, storage, admin email fire-and-forget)
- GET /api/admin/messages, PATCH .../read, DELETE .../{id}
- GET/PUT /api/admin/settings, POST /api/admin/settings/test-email
- POST /api/orders regression: stock decrements + no 500 from admin email
"""
import os
import uuid
import time
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

FRONTEND_ENV = Path(__file__).resolve().parents[2] / "frontend" / ".env"
load_dotenv(FRONTEND_ENV)

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@freshcuts.com"
ADMIN_PASSWORD = "Admin@123"
DEFAULT_NOTIFY_EMAIL = "admin@freshcuts.com"


# ---------- shared session ----------
@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def admin_headers(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def user_ctx(s):
    email = f"TEST_admin_panel_{uuid.uuid4().hex[:8]}@freshcuts-test.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "TestPass@123", "name": "TEST Panel"})
    assert r.status_code == 200, f"register failed: {r.text}"
    tok = r.json()["access_token"]
    return {
        "email": email,
        "headers": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
    }


# ================= ADMIN STATS =================
class TestAdminStats:
    def test_stats_requires_admin(self, s, user_ctx):
        r = s.get(f"{API}/admin/stats", headers=user_ctx["headers"])
        assert r.status_code in (401, 403)

    def test_stats_shape_and_types(self, s, admin_headers):
        r = s.get(f"{API}/admin/stats", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in [
            "orders_today", "revenue_today", "revenue_total", "pending_orders",
            "total_orders", "total_products", "low_stock", "low_stock_count",
            "unavailable_count", "total_users", "active_deals", "unread_messages",
        ]:
            assert key in data, f"missing key {key}"
        assert isinstance(data["low_stock"], list)
        assert isinstance(data["orders_today"], int)
        assert isinstance(data["revenue_today"], (int, float))
        assert isinstance(data["revenue_total"], (int, float))


# ================= ADMIN PRODUCTS =================
class TestAdminProducts:
    def test_public_excludes_unavailable(self, s, admin_headers):
        # pick a product, mark unavailable, verify it's excluded from public GET
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        products = r.json()
        assert len(products) > 0
        pid = products[0]["id"]

        # mark unavailable
        r = s.patch(f"{API}/admin/products/{pid}", headers=admin_headers,
                    json={"is_available": False})
        assert r.status_code == 200, r.text
        assert r.json()["is_available"] is False

        # public list should not contain it
        r_pub = s.get(f"{API}/products")
        ids = [p["id"] for p in r_pub.json()]
        assert pid not in ids

        # include_unavailable=true should include it
        r_all = s.get(f"{API}/products?include_unavailable=true")
        ids_all = [p["id"] for p in r_all.json()]
        assert pid in ids_all

        # restore
        r = s.patch(f"{API}/admin/products/{pid}", headers=admin_headers,
                    json={"is_available": True})
        assert r.status_code == 200
        assert r.json()["is_available"] is True

    def test_update_price_name_weights_cuts(self, s, admin_headers):
        r = s.get(f"{API}/products")
        products = [p for p in r.json() if p.get("category") not in ("whole", "organic")]
        assert products, "need at least one cut-veg/cut-fruit product"
        p = products[0]
        pid = p["id"]
        orig_name = p["name"]
        orig_price = p["price"]

        new_payload = {
            "name": f"{orig_name} TEST",
            "price": round(orig_price + 3.5, 2),
            "available_weights": ["250g", "500g"],
            "available_cuts": ["diced", "sliced"],
        }
        r = s.patch(f"{API}/admin/products/{pid}", headers=admin_headers, json=new_payload)
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["name"] == new_payload["name"]
        assert float(updated["price"]) == float(new_payload["price"])
        assert updated["available_weights"] == new_payload["available_weights"]
        assert updated["available_cuts"] == new_payload["available_cuts"]

        # verify GET reflects
        r = s.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        assert r.json()["name"] == new_payload["name"]

        # restore
        r = s.patch(f"{API}/admin/products/{pid}", headers=admin_headers,
                    json={"name": orig_name, "price": orig_price})
        assert r.status_code == 200

    def test_whole_category_forces_cuts_whole(self, s, admin_headers):
        r = s.get(f"{API}/products?include_unavailable=true")
        candidates = [p for p in r.json() if p.get("category") in ("whole", "organic")]
        if not candidates:
            # try to convert one cut-veg into whole temporarily
            r = s.get(f"{API}/products")
            p = r.json()[0]
            pid = p["id"]
            orig_cat = p["category"]
            orig_cuts = p.get("available_cuts")
            r = s.patch(f"{API}/admin/products/{pid}", headers=admin_headers,
                        json={"category": "whole", "available_cuts": ["diced"]})
            assert r.status_code == 200, r.text
            updated = r.json()
            assert updated["available_cuts"] == ["whole"], updated
            # restore
            s.patch(f"{API}/admin/products/{pid}", headers=admin_headers,
                    json={"category": orig_cat, "available_cuts": orig_cuts or ["diced"]})
        else:
            p = candidates[0]
            pid = p["id"]
            # try to sneak in non-whole cuts; server must overwrite to ['whole']
            r = s.patch(f"{API}/admin/products/{pid}", headers=admin_headers,
                        json={"available_cuts": ["diced", "sliced"]})
            assert r.status_code == 200, r.text
            assert r.json()["available_cuts"] == ["whole"]

    def test_stock_delta_floors_at_zero(self, s, admin_headers):
        r = s.get(f"{API}/products")
        p = r.json()[0]
        pid = p["id"]
        cur = int(p["stock"])

        # +5
        r = s.patch(f"{API}/admin/products/{pid}/stock", headers=admin_headers, json={"delta": 5})
        assert r.status_code == 200
        assert r.json()["stock"] == cur + 5

        # -3
        r = s.patch(f"{API}/admin/products/{pid}/stock", headers=admin_headers, json={"delta": -3})
        assert r.status_code == 200
        assert r.json()["stock"] == cur + 2

        # -9999 must floor at 0
        r = s.patch(f"{API}/admin/products/{pid}/stock", headers=admin_headers, json={"delta": -99999})
        assert r.status_code == 200
        assert r.json()["stock"] == 0

        # restore roughly (bring back to cur)
        r = s.patch(f"{API}/admin/products/{pid}/stock", headers=admin_headers, json={"delta": cur})
        assert r.status_code == 200
        assert r.json()["stock"] == cur


# ================= ORDERS + ADMIN ORDERS =================
class TestOrdersFlow:
    @pytest.fixture(scope="class")
    def created_order(self, s, user_ctx):
        # find a serviceable pincode
        r = s.get(f"{API}/pincodes")
        assert r.status_code == 200
        pincodes = r.json()
        assert pincodes, "no pincodes seeded"
        pincode = pincodes[0]["pincode"]

        # add address
        addr_payload = {
            "label": "home", "name": "TEST Panel", "recipient_name": "TEST Panel", "mobile": "9998887770",
            "line1": "1 Test Rd", "area": "Test Area", "city": "TestCity", "state": "TS", "pincode": pincode,
            "is_default": True,
        }
        r = s.post(f"{API}/addresses", headers=user_ctx["headers"], json=addr_payload)
        assert r.status_code == 200, r.text
        addr_id = r.json()["id"]

        # get products
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        products = [p for p in r.json() if p.get("stock", 0) > 5][:2]
        assert len(products) >= 1
        p = products[0]
        stock_before = p["stock"]

        # place order
        items = [{
            "product_id": p["id"],
            "name": p["name"],
            "price": float(p["price"]),
            "quantity": 2,
            "unit": p.get("unit", "500g"),
            "image": p.get("image", ""),
            "cut_type": (p.get("available_cuts") or ["whole"])[0],
            "weight": (p.get("available_weights") or ["500g"])[0],
        }]
        subtotal = float(p["price"]) * 2
        order_payload = {
            "items": items,
            "subtotal": subtotal,
            "delivery_fee": 0,
            "handling_fee": 9,
            "total": subtotal + 9,
            "pincode": pincode,
            "phone": "9998887770",
            "address": f"1 Test Rd, TestCity, TS - {pincode}",
            "address_id": addr_id,
            "delivery_slot_id": "express",
            "delivery_slot_label": "Express (2 hours)",
            "payment_method": "cod",
        }
        r = s.post(f"{API}/orders", headers=user_ctx["headers"], json=order_payload)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "pending"
        assert order["payment_status"] in ("pending", "unpaid", None) or order.get("payment_status") != "paid"

        # verify stock decremented
        time.sleep(0.4)
        r = s.get(f"{API}/products/{p['id']}")
        assert r.status_code == 200
        assert r.json()["stock"] == stock_before - 2, "stock should decrement by ordered quantity"

        return {"order": order, "product_id": p["id"], "stock_before": stock_before}

    def test_admin_orders_list_all(self, s, admin_headers, created_order):
        r = s.get(f"{API}/admin/orders?status=all", headers=admin_headers)
        assert r.status_code == 200, r.text
        orders = r.json()
        assert isinstance(orders, list)
        oid = created_order["order"]["id"]
        assert any(o["id"] == oid for o in orders), "newly created order missing from admin list"

    def test_admin_orders_filter_pending(self, s, admin_headers, created_order):
        r = s.get(f"{API}/admin/orders?status=pending", headers=admin_headers)
        assert r.status_code == 200
        for o in r.json():
            assert o["status"] == "pending"

    def test_admin_order_status_transitions_and_cod_paid(self, s, admin_headers, created_order):
        oid = created_order["order"]["id"]
        for st in ["confirmed", "packed", "out-for-delivery"]:
            r = s.patch(f"{API}/admin/orders/{oid}/status", headers=admin_headers, json={"status": st})
            assert r.status_code == 200, r.text
            assert r.json()["status"] == st
            # COD not delivered yet -> payment_status should not be paid
            assert r.json().get("payment_status") != "paid"

        # deliver -> COD should auto-set payment_status=paid
        r = s.patch(f"{API}/admin/orders/{oid}/status", headers=admin_headers, json={"status": "delivered"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "delivered"
        assert body["payment_status"] == "paid", body

    def test_admin_order_status_invalid_rejected(self, s, admin_headers, created_order):
        oid = created_order["order"]["id"]
        r = s.patch(f"{API}/admin/orders/{oid}/status", headers=admin_headers, json={"status": "banana"})
        assert r.status_code == 422


# ================= CONTACT / MESSAGES =================
class TestContactMessages:
    def test_contact_requires_auth(self, s):
        r = s.post(f"{API}/contact", json={"subject": "Hello there", "message": "This is a test message."})
        assert r.status_code in (401, 403)

    def test_contact_validation_short_subject(self, s, user_ctx):
        r = s.post(f"{API}/contact", headers=user_ctx["headers"], json={"subject": "hi", "message": "message"})
        assert r.status_code == 422

    def test_contact_validation_short_message(self, s, user_ctx):
        r = s.post(f"{API}/contact", headers=user_ctx["headers"], json={"subject": "Hello", "message": "hi"})
        assert r.status_code == 422

    def test_contact_submit_success_and_visible_to_admin(self, s, user_ctx, admin_headers):
        subject = f"TEST subject {uuid.uuid4().hex[:6]}"
        message = "This is a TEST customer support message for panel verification."
        r = s.post(f"{API}/contact", headers=user_ctx["headers"], json={"subject": subject, "message": message})
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
        mid = r.json()["id"]

        # admin sees it
        r = s.get(f"{API}/admin/messages", headers=admin_headers)
        assert r.status_code == 200
        msgs = r.json()
        match = next((m for m in msgs if m.get("id") == mid), None)
        assert match, "submitted message missing from admin inbox"
        assert match["subject"] == subject
        assert match["message"] == message
        assert match["read"] is False
        assert match["user_email"].lower() == user_ctx["email"].lower()

        # mark read
        r = s.patch(f"{API}/admin/messages/{mid}/read", headers=admin_headers)
        assert r.status_code == 200
        r = s.get(f"{API}/admin/messages", headers=admin_headers)
        match = next((m for m in r.json() if m.get("id") == mid), None)
        assert match and match["read"] is True

        # delete
        r = s.delete(f"{API}/admin/messages/{mid}", headers=admin_headers)
        assert r.status_code == 200
        r = s.get(f"{API}/admin/messages", headers=admin_headers)
        assert all(m.get("id") != mid for m in r.json())

    def test_contact_throttle_5_per_hour(self, s, user_ctx):
        # create a fresh user just for throttle test to avoid polluting prior counts
        email = f"TEST_throttle_{uuid.uuid4().hex[:8]}@freshcuts-test.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "TestPass@123", "name": "TEST Throttle"})
        assert r.status_code == 200
        h = {"Authorization": f"Bearer {r.json()['access_token']}", "Content-Type": "application/json"}
        for i in range(5):
            rr = s.post(f"{API}/contact", headers=h,
                        json={"subject": f"TEST throttle {i}", "message": "TEST throttle message body"})
            assert rr.status_code == 200, f"i={i}: {rr.text}"
        # 6th should be blocked
        rr = s.post(f"{API}/contact", headers=h,
                    json={"subject": "TEST throttle 6", "message": "Should be blocked"})
        assert rr.status_code == 429, rr.text


# ================= SETTINGS =================
class TestAdminSettings:
    def test_get_default_settings(self, s, admin_headers):
        r = s.get(f"{API}/admin/settings", headers=admin_headers)
        assert r.status_code == 200
        assert "notify_email" in r.json()

    def test_put_and_restore_settings(self, s, admin_headers):
        # change to a valid test email
        new_email = "notify+test@freshcuts-test.com"
        r = s.put(f"{API}/admin/settings", headers=admin_headers, json={"notify_email": new_email})
        assert r.status_code == 200, r.text
        assert r.json()["notify_email"] == new_email

        # verify persisted
        r = s.get(f"{API}/admin/settings", headers=admin_headers)
        assert r.json()["notify_email"] == new_email

        # restore
        r = s.put(f"{API}/admin/settings", headers=admin_headers,
                  json={"notify_email": DEFAULT_NOTIFY_EMAIL})
        assert r.status_code == 200
        assert r.json()["notify_email"] == DEFAULT_NOTIFY_EMAIL

    def test_put_invalid_email_rejected(self, s, admin_headers):
        r = s.put(f"{API}/admin/settings", headers=admin_headers, json={"notify_email": "not-an-email"})
        assert r.status_code == 422

    def test_test_email_endpoint(self, s, admin_headers):
        r = s.post(f"{API}/admin/settings/test-email", headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "to" in body and "email_id" in body

    def test_settings_requires_admin(self, s, user_ctx):
        r = s.get(f"{API}/admin/settings", headers=user_ctx["headers"])
        assert r.status_code in (401, 403)
        r = s.put(f"{API}/admin/settings", headers=user_ctx["headers"],
                  json={"notify_email": "x@y.com"})
        assert r.status_code in (401, 403)


# ================= FINAL RESTORE =================
def test_zz_notify_email_left_default(s, admin_headers):
    """Ensure notify_email is admin@freshcuts.com after all tests."""
    r = s.get(f"{API}/admin/settings", headers=admin_headers)
    assert r.status_code == 200
    if r.json()["notify_email"] != DEFAULT_NOTIFY_EMAIL:
        s.put(f"{API}/admin/settings", headers=admin_headers,
              json={"notify_email": DEFAULT_NOTIFY_EMAIL})
    r = s.get(f"{API}/admin/settings", headers=admin_headers)
    assert r.json()["notify_email"] == DEFAULT_NOTIFY_EMAIL
