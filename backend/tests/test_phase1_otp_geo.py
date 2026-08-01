"""Phase 1 tests: mobile OTP auth + geo reverse-pin + regression check."""
import os
import requests
from pathlib import Path
from dotenv import load_dotenv

FRONTEND_ENV = Path(__file__).resolve().parents[2] / "frontend" / ".env"
load_dotenv(FRONTEND_ENV)
BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


# ================= OTP SEND =================
class TestOtpSend:
    def test_send_valid_mobile_returns_request_id_and_dev_code(self, api_client):
        r = api_client.post(f"{API}/auth/otp/send", json={"mobile": "+919876543210"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["sent"] is True
        assert isinstance(data["request_id"], str) and len(data["request_id"]) > 10
        assert data["dev_code"] == "123456"

    def test_send_10_digit_no_prefix_normalises(self, api_client):
        r = api_client.post(f"{API}/auth/otp/send", json={"mobile": "9876543211"})
        assert r.status_code == 200, r.text
        assert r.json()["dev_code"] == "123456"

    def test_send_invalid_mobile_returns_400(self, api_client):
        r = api_client.post(f"{API}/auth/otp/send", json={"mobile": "123"})
        assert r.status_code == 400, r.text
        assert "valid mobile" in r.json()["detail"].lower()


# ================= OTP VERIFY =================
class TestOtpVerify:
    def _send(self, api_client, mobile="+919876500001"):
        r = api_client.post(f"{API}/auth/otp/send", json={"mobile": mobile})
        assert r.status_code == 200, r.text
        return r.json()["request_id"]

    def test_verify_valid_returns_token(self, api_client):
        mobile = "+919876500001"
        req_id = self._send(api_client, mobile)
        r = api_client.post(f"{API}/auth/otp/verify", json={
            "mobile": mobile, "otp": "123456", "request_id": req_id,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["access_token"] and d["token_type"] == "bearer"
        assert d["role"] == "user"
        assert d["email"] == "919876500001@mobile.freshcuts.in"

    def test_verify_wrong_otp_returns_400(self, api_client):
        mobile = "+919876500002"
        req_id = self._send(api_client, mobile)
        r = api_client.post(f"{API}/auth/otp/verify", json={
            "mobile": mobile, "otp": "abc12", "request_id": req_id,
        })
        assert r.status_code == 400, r.text
        assert "invalid otp" in r.json()["detail"].lower()

    def test_verify_reused_request_id_fails(self, api_client):
        mobile = "+919876500003"
        req_id = self._send(api_client, mobile)
        r1 = api_client.post(f"{API}/auth/otp/verify", json={
            "mobile": mobile, "otp": "123456", "request_id": req_id,
        })
        assert r1.status_code == 200
        r2 = api_client.post(f"{API}/auth/otp/verify", json={
            "mobile": mobile, "otp": "123456", "request_id": req_id,
        })
        assert r2.status_code == 400
        assert "already been used" in r2.json()["detail"].lower()

    def test_verify_bad_request_id_returns_400(self, api_client):
        r = api_client.post(f"{API}/auth/otp/verify", json={
            "mobile": "+919876500009", "otp": "123456", "request_id": "nonexistent_" + "x" * 20,
        })
        assert r.status_code == 400

    def test_me_works_with_otp_jwt(self, api_client):
        mobile = "+919876500004"
        req_id = self._send(api_client, mobile)
        r = api_client.post(f"{API}/auth/otp/verify", json={
            "mobile": mobile, "otp": "123456", "request_id": req_id,
        })
        assert r.status_code == 200
        token = r.json()["access_token"]
        me = api_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200, me.text
        assert me.json()["email"] == "919876500004@mobile.freshcuts.in"
        assert me.json()["role"] == "user"

    def test_verify_any_6_digit_otp_accepted(self, api_client):
        mobile = "+919876500005"
        req_id = self._send(api_client, mobile)
        # Per backend, any 6-digit numeric code should verify (MOCKED)
        r = api_client.post(f"{API}/auth/otp/verify", json={
            "mobile": mobile, "otp": "555111", "request_id": req_id,
        })
        assert r.status_code == 200, r.text


# ================= GEO REVERSE PIN =================
class TestGeoReversePin:
    def test_bengaluru_central(self, api_client):
        r = api_client.get(f"{API}/geo/reverse-pin", params={"lat": 12.9716, "lng": 77.5946})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["pincode"] == "560001"
        assert d["area"] == "Bengaluru Central"
        assert d["serviceable"] is True

    def test_out_of_service_zero_coords(self, api_client):
        r = api_client.get(f"{API}/geo/reverse-pin", params={"lat": 0, "lng": 0})
        assert r.status_code == 200
        assert r.json().get("pincode") is None

    def test_bandra_matches(self, api_client):
        r = api_client.get(f"{API}/geo/reverse-pin", params={"lat": 19.0611, "lng": 72.8302})
        assert r.status_code == 200
        assert r.json()["pincode"] == "400050"


# ================= REGRESSIONS =================
class TestRegressions:
    def test_email_register_login_still_work(self, api_client):
        import uuid as _u
        email = f"regress_{_u.uuid4().hex[:8]}@freshcuts-test.com"
        r = api_client.post(f"{API}/auth/register", json={
            "email": email, "password": "Pass@1234", "name": "Regress",
        })
        assert r.status_code == 200
        token = r.json()["access_token"]
        me = api_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        # login
        r2 = api_client.post(f"{API}/auth/login", json={
            "email": email, "password": "Pass@1234",
        })
        assert r2.status_code == 200

    def test_products_count_is_164(self, api_client):
        r = api_client.get(f"{API}/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 164, f"Expected 164 products, got {len(data)}"
