"""Shared pytest fixtures for FreshCuts backend tests."""
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get public backend URL (matches what user sees)
FRONTEND_ENV = Path(__file__).resolve().parents[2] / "frontend" / ".env"
load_dotenv(FRONTEND_ENV)

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@freshcuts.com"
ADMIN_PASSWORD = "Fc!LdZB5RH3sprvcI"


@pytest.fixture(scope="session")
def api_base():
    return API


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api_client):
    r = api_client.post(f"{API}/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
    })
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def test_user(api_client):
    """Register a fresh user for this session."""
    email = f"test_user_{uuid.uuid4().hex[:8]}@freshcuts-test.com"
    password = "TestPass@123"
    r = api_client.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": "TEST User"
    })
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    return {
        "email": email,
        "password": password,
        "token": data["access_token"],
        "name": "TEST User",
    }


@pytest.fixture(scope="session")
def user_headers(test_user):
    return {"Authorization": f"Bearer {test_user['token']}", "Content-Type": "application/json"}
