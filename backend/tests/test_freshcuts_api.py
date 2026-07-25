"""FreshCuts backend API tests - covers auth, products (v3 schema), pincodes, orders, payments, admin."""
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
        assert "FreshCuts" in r.json()["message"]


# ============ PRODUCTS (v3 schema) ============
class TestProducts:
    def test_list_returns_around_33_seeded(self, api_client):
        r = api_client.get(f"{API}/products")
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list)
        # v3 seed has 33 products
        assert 30 <= len(products) <= 40, f"Expected ~33 products, got {len(products)}"

    def test_product_has_new_schema_fields(self, api_client):
        r = api_client.get(f"{API}/products")
        p = r.json()[0]
        for f in ["id", "name", "description", "category", "cut_type", "price", "unit",
                  "image", "stock", "available_cuts", "available_weights"]:
            assert f in p, f"Missing field {f}"
        assert isinstance(p["available_cuts"], list) and len(p["available_cuts"]) >= 1
        assert isinstance(p["available_weights"], list) and len(p["available_weights"]) >= 1
        assert p["category"] in ("cut-veg", "cut-fruit", "whole", "ready-mix"), \
            f"Unexpected category {p['category']}"
        assert "_id" not in p

    def test_filter_by_category_cut_veg_multi_cuts(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "cut-veg"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        assert all(p["category"] == "cut-veg" for p in items)
        # Most cut-veg products should have >1 cut option
        multi_cut = [p for p in items if len(p["available_cuts"]) > 1]
        assert len(multi_cut) >= len(items) - 2, \
            f"Expected most cut-veg items to have >1 cuts, got {len(multi_cut)}/{len(items)}"
        # available_weights populated
        assert all(len(p["available_weights"]) >= 1 for p in items)

    def test_filter_by_category_whole(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "whole"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        assert all(p["category"] == "whole" for p in items)
        assert all(p["available_cuts"] == ["whole"] for p in items), \
            "Whole category should only have 'whole' in available_cuts"
        # multi-weight arrays
        multi_weight = [p for p in items if len(p["available_weights"]) >= 2]
        assert len(multi_weight) == len(items), "All whole products should have multi-weight arrays"

    def test_filter_by_category_ready_mix(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "ready-mix"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        assert all(p["category"] == "ready-mix" for p in items)

    def test_filter_by_category_cut_fruit(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "cut-fruit"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        assert all(p["category"] == "cut-fruit" for p in items)

    def test_filter_cut_veg_and_cut_type_sliced(self, api_client):
        """cut_type filter matches against available_cuts array."""
        r = api_client.get(f"{API}/products", params={"category": "cut-veg", "cut_type": "sliced"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0, "Expected some cut-veg products with 'sliced' in available_cuts"
        for p in items:
            assert p["category"] == "cut-veg"
            assert "sliced" in p["available_cuts"], \
                f"Product {p['name']} returned but 'sliced' not in {p['available_cuts']}"

    def test_get_product_by_id_has_new_fields(self, api_client):
        r_list = api_client.get(f"{API}/products").json()
        pid = r_list[0]["id"]
        r = api_client.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == pid
        assert "available_cuts" in data and "available_weights" in data

    def test_get_product_404(self, api_client):
        r = api_client.get(f"{API}/products/nonexistent-{uuid.uuid4()}")
        assert r.status_code == 404


# ============ PINCODES ============
class TestPincodes:
    def test_check_serviceable_560001(self, api_client):
        r = api_client.get(f"{API}/pincodes/check/560001")
        assert r.status_code == 200
        data = r.json()
        assert data["serviceable"] is True
        assert data["pincode"] == "560001"

    def test_check_unserviceable_999999(self, api_client):
        r = api_client.get(f"{API}/pincodes/check/999999")
        assert r.status_code == 200
        assert r.json()["serviceable"] is False


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
        me = api_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == email

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
        assert r.json()["role"] == "admin"

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
    def _payload(self, api_client, pincode="560001"):
        p = api_client.get(f"{API}/products").json()[0]
        item = {
            "product_id": p["id"], "name": p["name"], "price": p["price"],
            "quantity": 2, "cut_type": p["cut_type"], "unit": p["unit"], "image": p["image"],
        }
        subtotal = p["price"] * 2
        return {
            "items": [item], "address": "TEST 123 Test Street", "pincode": pincode,
            "phone": "9999999999", "payment_method": "cod", "delivery_fee": 0,
            "subtotal": subtotal, "total": subtotal,
        }

    def test_create_order_requires_auth(self, api_client):
        r = api_client.post(f"{API}/orders", json=self._payload(api_client))
        assert r.status_code == 401

    def test_create_order_bad_pincode(self, api_client, user_headers):
        r = api_client.post(f"{API}/orders", json=self._payload(api_client, "999999"),
                            headers=user_headers)
        assert r.status_code == 400

    def test_create_order_success_and_persist(self, api_client, user_headers, test_user):
        r = api_client.post(f"{API}/orders", json=self._payload(api_client), headers=user_headers)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["user_email"] == test_user["email"]
        assert order["status"] == "pending"
        assert order["payment_status"] == "pending"
        rg = api_client.get(f"{API}/orders/{order['id']}", headers=user_headers)
        assert rg.status_code == 200
        pytest._last_order_id = order["id"]

    def test_list_my_orders(self, api_client, user_headers):
        r = api_client.get(f"{API}/orders", headers=user_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 1


# ============ STRIPE CHECKOUT via emergentintegrations ============
class TestStripeCheckout:
    def test_checkout_creates_session(self, api_client, user_headers):
        # Pick a higher-priced product so INR->USD stays above Stripe's $0.50 minimum
        products = api_client.get(f"{API}/products").json()
        p = max(products, key=lambda x: x["price"])
        qty = 2
        total = p["price"] * qty
        order_payload = {
            "items": [{
                "product_id": p["id"], "name": p["name"], "price": p["price"],
                "quantity": qty, "cut_type": p["cut_type"], "unit": p["unit"], "image": p["image"],
            }],
            "address": "TEST addr", "pincode": "560001", "phone": "9999999999",
            "payment_method": "stripe", "delivery_fee": 0,
            "subtotal": total, "total": total,
        }
        r_order = api_client.post(f"{API}/orders", json=order_payload, headers=user_headers)
        assert r_order.status_code == 200
        order_id = r_order.json()["id"]

        r = api_client.post(f"{API}/payments/checkout", json={
            "order_id": order_id,
            "origin_url": "https://produce-express-12.preview.emergentagent.com",
        }, headers=user_headers)
        assert r.status_code == 200, f"Stripe checkout failed: {r.status_code} {r.text}"
        data = r.json()
        assert "url" in data and data["url"].startswith("https://")
        assert "session_id" in data and data["session_id"]
        pytest._session_id = data["session_id"]

    def test_payment_status_returns_fields(self, api_client, user_headers):
        session_id = getattr(pytest, "_session_id", None)
        if not session_id:
            pytest.skip("no session_id from checkout test")
        r = api_client.get(f"{API}/payments/status/{session_id}", headers=user_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "paid" in data
        assert "payment_status" in data
        assert "status" in data


# ============ ADMIN AUTHORIZATION (RBAC) ============
class TestAdminAuth:
    def test_create_product_requires_auth(self, api_client):
        r = api_client.post(f"{API}/products", json={
            "name": "TEST", "description": "d", "category": "whole",
            "price": 10, "image": "x"
        })
        assert r.status_code == 401

    def test_create_product_forbidden_for_normal_user(self, api_client, user_headers):
        r = api_client.post(f"{API}/products", json={
            "name": "TEST Forbid", "description": "d", "category": "whole",
            "price": 10, "image": "x"
        }, headers=user_headers)
        assert r.status_code == 403

    def test_delete_product_forbidden_for_normal_user(self, api_client, user_headers):
        r = api_client.delete(f"{API}/products/some-id", headers=user_headers)
        assert r.status_code == 403

    def test_create_pincode_forbidden_for_normal_user(self, api_client, user_headers):
        r = api_client.post(f"{API}/pincodes", json={
            "pincode": "111111", "area": "TEST", "delivery_fee": 0, "eta_hours": 1
        }, headers=user_headers)
        assert r.status_code == 403

    def test_delete_pincode_requires_auth(self, api_client):
        r = api_client.delete(f"{API}/pincodes/560001")
        assert r.status_code == 401


# ============ ADMIN CRUD ============
class TestAdminCRUD:
    def test_admin_create_and_delete_product(self, api_client, admin_headers):
        payload = {
            "name": "TEST Admin Product", "description": "seeded by test",
            "category": "whole", "cut_type": "whole",
            "price": 12.5, "unit": "500g",
            "image": "https://images.unsplash.com/test", "stock": 5, "tags": ["TEST"],
            "available_cuts": ["whole"], "available_weights": ["500g", "1kg"],
        }
        r = api_client.post(f"{API}/products", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        assert r.json()["available_cuts"] == ["whole"]

        # Verify persisted
        rg = api_client.get(f"{API}/products/{pid}")
        assert rg.status_code == 200
        assert rg.json()["available_weights"] == ["500g", "1kg"]

        rd = api_client.delete(f"{API}/products/{pid}", headers=admin_headers)
        assert rd.status_code == 200
        assert api_client.get(f"{API}/products/{pid}").status_code == 404

    def test_admin_create_and_delete_pincode(self, api_client, admin_headers):
        pincode_val = f"9{uuid.uuid4().int % 100000:05d}"
        payload = {"pincode": pincode_val, "area": "TEST Area", "delivery_fee": 15, "eta_hours": 2}
        r = api_client.post(f"{API}/pincodes", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text

        rc = api_client.get(f"{API}/pincodes/check/{pincode_val}")
        assert rc.json()["serviceable"] is True

        rdup = api_client.post(f"{API}/pincodes", json=payload, headers=admin_headers)
        assert rdup.status_code == 400

        rd = api_client.delete(f"{API}/pincodes/{pincode_val}", headers=admin_headers)
        assert rd.status_code == 200
        assert api_client.get(f"{API}/pincodes/check/{pincode_val}").json()["serviceable"] is False
