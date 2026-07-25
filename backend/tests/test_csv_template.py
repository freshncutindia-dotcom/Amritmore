"""Tests for GET /api/templates/products.csv (public CSV template download)."""
import os
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

TEMPLATE_URL = f"{API}/templates/products.csv"
EXPECTED_HEADER = "name,category,available_cuts,available_weights,price,base_unit,description,image,tags"


class TestProductsCsvTemplate:
    """CSV template download endpoint - public, must return CSV file."""

    def test_status_200(self, api_client):
        r = api_client.get(TEMPLATE_URL)
        assert r.status_code == 200, f"Expected 200, got {r.status_code} — body: {r.text[:200]}"

    def test_content_type_is_text_csv(self, api_client):
        r = api_client.get(TEMPLATE_URL)
        assert r.status_code == 200
        ctype = r.headers.get("Content-Type", "")
        assert "text/csv" in ctype.lower(), f"Content-Type must contain 'text/csv', got: {ctype}"

    def test_content_disposition_attachment_and_filename(self, api_client):
        r = api_client.get(TEMPLATE_URL)
        assert r.status_code == 200
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd.lower(), f"Content-Disposition missing 'attachment': {cd}"
        assert "freshcuts_products_template.csv" in cd, \
            f"Content-Disposition missing filename: {cd}"

    def test_body_starts_with_expected_header(self, api_client):
        r = api_client.get(TEMPLATE_URL)
        assert r.status_code == 200
        first_line = r.text.splitlines()[0] if r.text else ""
        assert first_line == EXPECTED_HEADER, \
            f"Header mismatch.\nExpected: {EXPECTED_HEADER}\nGot     : {first_line}"

    def test_body_has_at_least_5_data_rows(self, api_client):
        r = api_client.get(TEMPLATE_URL)
        assert r.status_code == 200
        # non-empty lines beyond the header
        lines = [ln for ln in r.text.splitlines() if ln.strip()]
        data_rows = lines[1:]  # exclude header
        assert len(data_rows) >= 5, \
            f"Expected >=5 data rows beyond header, got {len(data_rows)}"

    def test_public_no_auth_required(self):
        """Fresh session with NO Authorization header must return 200."""
        s = requests.Session()
        # Explicitly no auth header
        r = s.get(TEMPLATE_URL)
        assert r.status_code == 200, \
            f"Endpoint must be public but got {r.status_code}: {r.text[:200]}"
        assert "text/csv" in r.headers.get("Content-Type", "").lower()

    def test_public_ignores_bogus_bearer_token(self):
        """Even with a bogus Bearer token, endpoint should still return the CSV (no auth check)."""
        s = requests.Session()
        r = s.get(TEMPLATE_URL, headers={"Authorization": "Bearer this-is-not-a-real-token"})
        assert r.status_code == 200, \
            f"Public endpoint should not validate tokens, got {r.status_code}"


# ============ REGRESSION: existing endpoints still working ============
class TestRegressionExisting:
    def test_products_still_works(self, api_client):
        r = api_client.get(f"{API}/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0

    def test_subscriptions_boxes_still_works(self, api_client):
        r = api_client.get(f"{API}/subscriptions/boxes")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        ids = {b["id"] for b in data}
        assert ids == {"essentials", "mixed", "premium"}
