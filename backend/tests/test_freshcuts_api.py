"""FreshCuts backend API tests - covers auth, products, pincodes, orders, payments, admin."""
import os
import uuid
import pytest

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


# ============ HEALTH ============
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert "FreshCuts" in data["message"]


# ============ PRODUCTS (public) ============
class TestProducts:
    def test_list_returns_22_seeded(self, api_client):
        r = api_client.get(f"{API}/products")
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list)
        assert len(products) >= 22, f"Expected at least 22 seeded products, got {len(products)}"

    def test_product_has_required_fields(self, api_client):
        r = api_client.get(f"{API}/products")
        p = r.json()[0]
        for f in ["id", "name", "description", "category", "cut_type", "price", "unit", "image", "stock"]:
            assert f in p, f"Missing field {f}"
        # ensure no mongo _id leaked
        assert "_id" not in p

    def test_filter_by_category_cut_veg(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "cut-veg"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        assert all(p["category"] == "cut-veg" for p in items)

    def test_filter_by_cut_type_diced(self, api_client):
        r = api_client.get(f"{API}/products", params={"cut_type": "diced"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        assert all(p["cut_type"] == "diced" for p in items)

    def test_get_product_by_id(self, api_client):
        r_list = api_client.get(f"{API}/products")
        product_id = r_list.json()[0]["id"]
        r = api_client.get(f"{API}/products/{product_id}")
        assert r.status_code == 200
        assert r.json()["id"] == product_id

    def test_get_product_404(self, api_client):
        r = api_client.get(f"{API}/products/nonexistent-{uuid.uuid4()}")
        assert r.status_code == 404


# ============ PINCODES (public check) ============
class TestPincodes:
    def test_check_serviceable_560001(self, api_client):
        r = api_client.get(f"{API}/pincodes/check/560001")
        assert r.status_code == 200
        data = r.json()
        assert data["serviceable"] is True
        assert data["pincode"] == "560001"
        assert "area" in data
        assert "eta_hours" in data

    def test_check_unserviceable_999999(self, api_client):
        r = api_client.get(f"{API}/pincodes/check/999999")
        assert r.status_code == 200
        data = r.json()
        assert data["serviceable"] is False
        assert "message" in data


# ============ AUTH ============
class TestAuth:
    def test_register_and_me(self, api_client):
        email = f"reg_{uuid.uuid4().hex[:8]}@freshcuts-test.com"
        r = api_client.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!", "name": "TEST Reg"
        })
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        assert r.json()["role"] == "user"
        assert r.json()["email"] == email

        # /auth/me
        me = api_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == email
        assert me.json()["role"] == "user"

    def test_register_duplicate_email(self, api_client, test_user):
        r = api_client.post(f"{API}/auth/register", json={
            "email": test_user["email"], "password": "x", "name": "Dup"
        })
        assert r.status_code == 400

    def test_admin_login(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={
            "email": "admin@freshcuts.com", "password": "Admin@123"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "admin"
        assert data["access_token"]

    def test_login_wrong_password(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={
            "email": "admin@freshcuts.com", "password": "wrong-pw"
        })
        assert r.status_code == 401

    def test_me_without_token(self, api_client):
        r = api_client.get(f"{API}/auth/me")
        assert r.status_code == 401


# ============ ORDERS ============
class TestOrders:
    def _sample_order_payload(self, api_client, pincode="560001"):
        products = api_client.get(f"{API}/products").json()
        p = products[0]
        item = {
            "product_id": p["id"], "name": p["name"], "price": p["price"],
            "quantity": 2, "cut_type": p["cut_type"], "unit": p["unit"], "image": p["image"],
        }
        subtotal = p["price"] * 2
        return {
            "items": [item],
            "address": "TEST 123 Test Street",
            "pincode": pincode,
            "phone": "9999999999",
            "payment_method": "cod",
            "delivery_fee": 0,
            "subtotal": subtotal,
            "total": subtotal,
        }

    def test_create_order_requires_auth(self, api_client):
        payload = self._sample_order_payload(api_client)
        r = api_client.post(f"{API}/orders", json=payload)
        assert r.status_code == 401

    def test_create_order_bad_pincode(self, api_client, user_headers):
        payload = self._sample_order_payload(api_client, pincode="999999")
        r = api_client.post(f"{API}/orders", json=payload, headers=user_headers)
        assert r.status_code == 400

    def test_create_order_success_and_persist(self, api_client, user_headers, test_user):
        payload = self._sample_order_payload(api_client)
        r = api_client.post(f"{API}/orders", json=payload, headers=user_headers)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["id"]
        assert order["user_email"] == test_user["email"]
        assert order["status"] == "pending"
        assert order["payment_status"] == "pending"
        assert len(order["items"]) == 1

        # verify persisted via GET /orders/{id}
        rg = api_client.get(f"{API}/orders/{order['id']}", headers=user_headers)
        assert rg.status_code == 200
        assert rg.json()["id"] == order["id"]

        # save for next test
        pytest._last_order_id = order["id"]

    def test_list_my_orders(self, api_client, user_headers):
        r = api_client.get(f"{API}/orders", headers=user_headers)
        assert r.status_code == 200
        orders = r.json()
        assert isinstance(orders, list)
        assert len(orders) >= 1
        assert any(o["id"] == getattr(pytest, "_last_order_id", None) for o in orders)


# ============ STRIPE CHECKOUT ============
class TestStripeCheckout:
    def test_checkout_creates_session(self, api_client, user_headers):
        # Need an order first
        products = api_client.get(f"{API}/products").json()
        p = products[0]
        payload = {
            "items": [{
                "product_id": p["id"], "name": p["name"], "price": p["price"],
                "quantity": 1, "cut_type": p["cut_type"], "unit": p["unit"], "image": p["image"],
            }],
            "address": "TEST addr", "pincode": "560001", "phone": "9999999999",
            "payment_method": "stripe", "delivery_fee": 0,
            "subtotal": p["price"], "total": p["price"],
        }
        r_order = api_client.post(f"{API}/orders", json=payload, headers=user_headers)
        assert r_order.status_code == 200
        order_id = r_order.json()["id"]

        r = api_client.post(f"{API}/payments/checkout", json={
            "order_id": order_id,
            "origin_url": "https://produce-express-12.preview.emergentagent.com",
        }, headers=user_headers)
        if r.status_code != 200:
            pytest.fail(f"Stripe checkout failed: {r.status_code} {r.text}")
        data = r.json()
        assert "url" in data and data["url"].startswith("https://")
        assert "session_id" in data
        assert "stripe.com" in data["url"] or "checkout" in data["url"]


# ============ ADMIN AUTHORIZATION ============
class TestAdminAuth:
    def test_create_product_requires_auth(self, api_client):
        r = api_client.post(f"{API}/products", json={
            "name": "TEST", "description": "d", "category": "whole-veg",
            "price": 10, "image": "x"
        })
        assert r.status_code == 401

    def test_create_product_forbidden_for_normal_user(self, api_client, user_headers):
        r = api_client.post(f"{API}/products", json={
            "name": "TEST Forbid", "description": "d", "category": "whole-veg",
            "price": 10, "image": "x"
        }, headers=user_headers)
        assert r.status_code == 403

    def test_create_pincode_forbidden_for_normal_user(self, api_client, user_headers):
        r = api_client.post(f"{API}/pincodes", json={
            "pincode": "111111", "area": "TEST", "delivery_fee": 0, "eta_hours": 1
        }, headers=user_headers)
        assert r.status_code == 403


# ============ ADMIN CRUD ============
class TestAdminCRUD:
    def test_admin_create_and_delete_product(self, api_client, admin_headers):
        payload = {
            "name": "TEST Admin Product",
            "description": "seeded by test",
            "category": "whole-veg",
            "cut_type": "whole",
            "price": 12.5,
            "unit": "500g",
            "image": "https://images.unsplash.com/test",
            "stock": 5,
            "tags": ["TEST"],
        }
        r = api_client.post(f"{API}/products", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        prod = r.json()
        pid = prod["id"]
        assert prod["name"] == payload["name"]

        # Verify GET
        rg = api_client.get(f"{API}/products/{pid}")
        assert rg.status_code == 200

        # Delete
        rd = api_client.delete(f"{API}/products/{pid}", headers=admin_headers)
        assert rd.status_code == 200
        assert rd.json()["ok"] is True

        # Verify gone
        rgone = api_client.get(f"{API}/products/{pid}")
        assert rgone.status_code == 404

    def test_admin_create_and_delete_pincode(self, api_client, admin_headers):
        pincode_val = f"9{uuid.uuid4().int % 100000:05d}"
        payload = {"pincode": pincode_val, "area": "TEST Area", "delivery_fee": 15, "eta_hours": 2}
        r = api_client.post(f"{API}/pincodes", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["pincode"] == pincode_val

        # Verify via check
        rc = api_client.get(f"{API}/pincodes/check/{pincode_val}")
        assert rc.status_code == 200
        assert rc.json()["serviceable"] is True

        # Duplicate should fail
        rdup = api_client.post(f"{API}/pincodes", json=payload, headers=admin_headers)
        assert rdup.status_code == 400

        # Delete
        rd = api_client.delete(f"{API}/pincodes/{pincode_val}", headers=admin_headers)
        assert rd.status_code == 200

        # Verify gone
        rc2 = api_client.get(f"{API}/pincodes/check/{pincode_val}")
        assert rc2.json()["serviceable"] is False
