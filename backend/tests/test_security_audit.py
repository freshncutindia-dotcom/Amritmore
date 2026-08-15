"""Security audit regression tests (iteration 16).

Covers:
- Admin login with rotated password + old-password fail (exactly once, throwaway email brute-force)
- Login brute-force -> 429 after 5 failures
- OTP send response has NO dev_code
- OTP verify: non-123456 rejected, 5-attempts cap -> 429
- POST /api/orders with tampered money fields uses server-computed totals
"""
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

FRONTEND_ENV = Path(__file__).resolve().parents[2] / "frontend" / ".env"
load_dotenv(FRONTEND_ENV)
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


# --- Auth ---

class TestAdminAuth:
    def test_new_admin_password_login(self):
        r = requests.post(f"{API}/auth/login", json={
            "email": "admin@freshcuts.com",
            "password": "Fc!LdZB5RH3sprvcI",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data.get("role") == "admin"

    def test_old_admin_password_fails_once(self):
        # Only ONE attempt to avoid triggering lockout on admin
        r = requests.post(f"{API}/auth/login", json={
            "email": "admin@freshcuts.com",
            "password": "Admin@123",
        })
        assert r.status_code in (401, 400, 403), r.text


class TestLoginBruteForceLockout:
    """Use a throwaway email so admin never gets locked."""

    def test_lockout_after_5_failures(self):
        email = f"bf-test-{uuid.uuid4().hex[:6]}@x-y.com"
        # First 5 attempts: expect 401 (user doesn't exist or wrong password)
        codes = []
        for i in range(5):
            r = requests.post(f"{API}/auth/login", json={
                "email": email, "password": f"WrongPass{i}!"
            })
            codes.append(r.status_code)
        # 6th attempt must be rate-limited/locked (429)
        r6 = requests.post(f"{API}/auth/login", json={
            "email": email, "password": "WrongPassFinal!"
        })
        assert r6.status_code == 429, (
            f"Expected 429 after 5 failures, got {r6.status_code}. "
            f"Prev codes={codes}. Body={r6.text}"
        )


# --- OTP ---

class TestOtpSecurity:
    def test_otp_send_has_no_dev_code(self):
        mobile = f"9{uuid.uuid4().int % 10**9:09d}"
        r = requests.post(f"{API}/auth/otp/send", json={"mobile": mobile})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "dev_code" not in body, f"dev_code leaked in response: {body}"
        assert "request_id" in body

    def test_otp_wrong_code_rejected(self):
        mobile = f"9{uuid.uuid4().int % 10**9:09d}"
        send = requests.post(f"{API}/auth/otp/send", json={"mobile": mobile}).json()
        rid = send["request_id"]
        r = requests.post(f"{API}/auth/otp/verify", json={
            "mobile": mobile, "otp": "654321", "request_id": rid,
        })
        assert r.status_code in (400, 401), r.text

    def test_otp_correct_code_logs_in(self):
        mobile = f"9{uuid.uuid4().int % 10**9:09d}"
        send = requests.post(f"{API}/auth/otp/send", json={"mobile": mobile}).json()
        rid = send["request_id"]
        r = requests.post(f"{API}/auth/otp/verify", json={
            "mobile": mobile, "otp": "123456", "request_id": rid,
        })
        assert r.status_code == 200, r.text
        assert "access_token" in r.json()

    def test_otp_attempt_cap_5_then_429(self):
        mobile = f"9{uuid.uuid4().int % 10**9:09d}"
        send = requests.post(f"{API}/auth/otp/send", json={"mobile": mobile}).json()
        rid = send["request_id"]
        codes = []
        for i in range(5):
            r = requests.post(f"{API}/auth/otp/verify", json={
                "mobile": mobile, "otp": "000000", "request_id": rid,
            })
            codes.append(r.status_code)
        # 6th attempt: expect 429
        r6 = requests.post(f"{API}/auth/otp/verify", json={
            "mobile": mobile, "otp": "000000", "request_id": rid,
        })
        assert r6.status_code == 429, (
            f"Expected 429 on 6th OTP verify, got {r6.status_code}. codes={codes}"
        )


# --- Order server-side pricing ---

@pytest.fixture(scope="module")
def user_ctx():
    email = f"sec_test_{uuid.uuid4().hex[:8]}@freshcuts-test.com"
    password = "TestPass@123"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": "SEC TEST"
    })
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    # Save address at pincode 400001
    addr = requests.post(f"{API}/addresses", headers=headers, json={
        "label": "home",
        "name": "SEC TEST",
        "mobile": "9999900001",
        "line1": "1 Test St",
        "area": "Fort",
        "pincode": "400001",
        "is_default": True,
    })
    assert addr.status_code == 200, addr.text
    return {"headers": headers, "email": email, "address_id": addr.json()["id"]}


class TestOrderServerPricing:
    def test_tampered_price_uses_server_value(self, user_ctx):
        headers = user_ctx["headers"]
        # Get 1 product
        prods = requests.get(f"{API}/products").json()
        p = next(x for x in prods if x.get("in_stock", True) and x.get("is_available", True))
        real_price = float(p["price"])

        payload = {
            "items": [{
                "product_id": p["id"],
                "name": p["name"],
                "price": 0.01,           # TAMPERED
                "quantity": 2,
                "unit": p.get("unit", "500g"),
                "image": p.get("image", "https://x.com/x.jpg"),
                "cut_type": "whole",
            }],
            "address": "1 Test St, Fort, Mumbai 400001",
            "pincode": "400001",
            "phone": "9999900001",
            "address_id": user_ctx["address_id"],
            "payment_method": "cod",
            "delivery_slot_id": "express",
            "delivery_slot_label": "Express (30-45 min)",
            "subtotal": 0.02,   # TAMPERED
            "delivery_fee": 0,  # TAMPERED
            "handling_fee": 0,  # TAMPERED
            "total": 1,         # TAMPERED
        }
        r = requests.post(f"{API}/orders", headers=headers, json=payload)
        assert r.status_code == 200, r.text
        order = r.json()

        # Server should recompute: subtotal = real_price * 2, express fee 49, handling 9
        expected_subtotal = round(real_price * 2, 2)
        assert abs(order["subtotal"] - expected_subtotal) < 0.01, (
            f"Server should recompute subtotal. Got {order['subtotal']} vs expected {expected_subtotal}"
        )
        assert order["items"][0]["price"] == real_price, (
            f"Server should use real price. Got {order['items'][0]['price']}"
        )
        # Express slot fee should be 49
        assert order.get("delivery_fee", 0) == 49, f"Delivery fee expected 49, got {order.get('delivery_fee')}"
        # Handling fee should be 9
        assert order.get("handling_fee", 0) == 9, f"Handling fee expected 9, got {order.get('handling_fee')}"
        # Total should exceed 1
        assert order["total"] > 1, f"Total should be recomputed; got {order['total']}"
