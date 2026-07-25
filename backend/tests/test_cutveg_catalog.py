"""Tests for v7 pre-cut vegetable catalog: sku, local_name, regex cut_type filter and search."""
import os
import pytest

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


# ============ CUT-VEG CATALOG (v7) ============
class TestCutVegCatalog:
    def test_cut_veg_has_at_least_60_products(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "cut-veg"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 60, f"Expected >=60 cut-veg products, got {len(items)}"

    def test_all_cut_veg_have_sku_and_local_name(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "cut-veg"})
        items = r.json()
        # Every cut-veg product should have non-null sku and local_name
        missing_sku = [p["name"] for p in items if not p.get("sku")]
        missing_local = [p["name"] for p in items if not p.get("local_name")]
        assert not missing_sku, f"Products missing sku: {missing_sku}"
        assert not missing_local, f"Products missing local_name: {missing_local}"

    def test_cut_veg_skus_are_uppercase_alphanumeric(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "cut-veg"})
        items = r.json()
        for p in items:
            sku = p["sku"]
            assert isinstance(sku, str) and len(sku) >= 3, f"Invalid sku for {p['name']}: {sku!r}"
            assert sku == sku.upper(), f"SKU not uppercase: {sku}"
            assert sku.isalnum(), f"SKU has non-alphanumerics: {sku}"

    def test_onion_exists_with_expected_fields(self, api_client):
        """Anchor product: FNCONN Onion / Pyaj / Kanda with rings, diced, strips."""
        r = api_client.get(f"{API}/products", params={"category": "cut-veg"})
        onion = next((p for p in r.json() if p["sku"] == "FNCONN"), None)
        assert onion is not None, "Onion (FNCONN) not seeded"
        assert onion["name"] == "Onion"
        assert onion["local_name"] == "Pyaj / Kanda"
        assert onion["category"] == "cut-veg"
        assert onion["available_cuts"] == ["rings", "diced", "strips"]
        assert isinstance(onion["cut_images"], dict)
        # Persist id for GET-by-id test
        pytest._onion_id = onion["id"]

    def test_get_onion_by_id_returns_full_fields(self, api_client):
        oid = getattr(pytest, "_onion_id", None)
        assert oid, "onion id not captured from previous test"
        r = api_client.get(f"{API}/products/{oid}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == oid
        assert data["sku"] == "FNCONN"
        assert data["local_name"] == "Pyaj / Kanda"
        assert "cut_images" in data and isinstance(data["cut_images"], dict)
        assert "available_cuts" in data and data["available_cuts"] == ["rings", "diced", "strips"]
        # MongoDB internal id must not leak
        assert "_id" not in data


# ============ SEARCH ENDPOINT (name / local_name / sku) ============
class TestProductSearch:
    def test_search_by_local_name_pyaj_returns_onion(self, api_client):
        r = api_client.get(f"{API}/products", params={"q": "pyaj"})
        assert r.status_code == 200
        items = r.json()
        skus = {p.get("sku") for p in items}
        assert "FNCONN" in skus, f"'pyaj' search should match Onion; got skus={skus}"

    def test_search_by_local_name_case_insensitive(self, api_client):
        r = api_client.get(f"{API}/products", params={"q": "KANDA"})
        assert r.status_code == 200
        items = r.json()
        assert any(p.get("sku") == "FNCONN" for p in items), \
            "Case-insensitive local_name search failed for 'KANDA'"

    def test_search_by_sku_returns_onion(self, api_client):
        r = api_client.get(f"{API}/products", params={"q": "FNCONN"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert any(p.get("sku") == "FNCONN" for p in items), \
            f"SKU search returned {[p.get('sku') for p in items]}"

    def test_search_by_partial_sku(self, api_client):
        """FNC prefix should return many cut-veg products."""
        r = api_client.get(f"{API}/products", params={"q": "FNC"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 50, f"'FNC' should match most catalog items, got {len(items)}"

    def test_search_by_english_name_still_works(self, api_client):
        """Regression: name search must not break."""
        r = api_client.get(f"{API}/products", params={"q": "Onion"})
        assert r.status_code == 200
        items = r.json()
        assert any("onion" in p["name"].lower() for p in items)


# ============ CUT_TYPE REGEX FILTER (case-insensitive, partial) ============
class TestCutTypeFilter:
    def test_cut_type_diced_returns_products(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "cut-veg", "cut_type": "diced"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 10, f"Expected many diced products, got {len(items)}"
        for p in items:
            joined = " ".join(p["available_cuts"]).lower()
            assert "diced" in joined, f"{p['name']} matched 'diced' but cuts={p['available_cuts']}"

    def test_cut_type_case_insensitive_uppercase(self, api_client):
        """Case-insensitive regex: 'DICED' should return same set as 'diced'."""
        r_lower = api_client.get(f"{API}/products",
                                 params={"category": "cut-veg", "cut_type": "diced"}).json()
        r_upper = api_client.get(f"{API}/products",
                                 params={"category": "cut-veg", "cut_type": "DICED"}).json()
        assert len(r_lower) == len(r_upper), \
            f"Case-insensitivity failed: diced={len(r_lower)} DICED={len(r_upper)}"

    def test_cut_type_partial_match_sliced(self, api_client):
        """Partial regex should match variants like 'sliced-full', 'diagonally sliced'."""
        r = api_client.get(f"{API}/products",
                           params={"category": "cut-veg", "cut_type": "sliced"})
        items = r.json()
        assert len(items) > 0
        # Confirm we get variant-style matches too
        variant_matched = False
        for p in items:
            for c in p["available_cuts"]:
                lc = c.lower()
                if "sliced" in lc and lc != "sliced":
                    variant_matched = True
                    break
            if variant_matched:
                break
        assert variant_matched, \
            "Expected regex filter to also return products with variants like 'sliced-full'"

    def test_cut_type_rings_returns_onion(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "cut-veg", "cut_type": "rings"})
        items = r.json()
        assert any(p.get("sku") == "FNCONN" for p in items), \
            "cut_type=rings should return Onion (FNCONN)"

    def test_cut_type_all_returns_all_cut_veg(self, api_client):
        """cut_type='all' should be treated as no filter."""
        r_all = api_client.get(f"{API}/products",
                               params={"category": "cut-veg", "cut_type": "all"}).json()
        r_none = api_client.get(f"{API}/products", params={"category": "cut-veg"}).json()
        assert len(r_all) == len(r_none)
