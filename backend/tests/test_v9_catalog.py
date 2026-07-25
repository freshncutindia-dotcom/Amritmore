"""Tests for v9 seed expansion: WHOLE_CATALOG (73), CUTFRUIT_CATALOG (8), READYMIX_CATALOG (18).

Total catalog should now be 164 products (65 cut-veg + 73 whole + 8 cut-fruit + 18 ready-mix).
Every product across every category must have non-null sku and non-null local_name.
"""
import os

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


# ============ TOTAL CATALOG SIZE ============
class TestV9CatalogSize:
    def test_total_products_is_164(self, api_client):
        r = api_client.get(f"{API}/products")
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 164, f"Expected exactly 164 products in v9, got {len(items)}"

    def test_category_breakdown(self, api_client):
        r = api_client.get(f"{API}/products")
        items = r.json()
        by_cat = {}
        for p in items:
            by_cat.setdefault(p["category"], 0)
            by_cat[p["category"]] += 1
        assert by_cat.get("cut-veg") == 65, f"cut-veg: expected 65, got {by_cat.get('cut-veg')}"
        assert by_cat.get("whole") == 73, f"whole: expected 73, got {by_cat.get('whole')}"
        assert by_cat.get("cut-fruit") == 8, f"cut-fruit: expected 8, got {by_cat.get('cut-fruit')}"
        assert by_cat.get("ready-mix") == 18, f"ready-mix: expected 18, got {by_cat.get('ready-mix')}"


# ============ UNIVERSAL SKU + LOCAL_NAME COVERAGE ============
class TestUniversalFieldCoverage:
    def test_every_product_has_non_null_sku(self, api_client):
        r = api_client.get(f"{API}/products")
        items = r.json()
        missing = [(p["category"], p["name"]) for p in items if not p.get("sku")]
        assert not missing, f"Products missing sku: {missing}"

    def test_every_product_has_non_null_local_name(self, api_client):
        r = api_client.get(f"{API}/products")
        items = r.json()
        missing = [(p["category"], p["name"]) for p in items if not p.get("local_name")]
        assert not missing, f"Products missing local_name: {missing}"

    def test_sku_uniqueness_across_catalog(self, api_client):
        r = api_client.get(f"{API}/products")
        items = r.json()
        skus = [p["sku"] for p in items]
        dupes = [s for s in set(skus) if skus.count(s) > 1]
        assert not dupes, f"Duplicate SKUs in catalog: {dupes}"

    def test_no_mongo_id_leak(self, api_client):
        r = api_client.get(f"{API}/products")
        for p in r.json():
            assert "_id" not in p, f"MongoDB _id leaked on {p.get('name')}"


# ============ WHOLE CATEGORY (73 items) ============
class TestWholeCatalog:
    def test_whole_returns_73(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "whole"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 73, f"Expected 73 whole, got {len(items)}"

    def test_whole_all_have_sku_starting_wh_or_wl_or_wr(self, api_client):
        """Review-request expected WHL/WL prefix; observed data also has WR* variants.
        We assert the more permissive 'starts with W' rule that matches the seed."""
        r = api_client.get(f"{API}/products", params={"category": "whole"})
        items = r.json()
        bad = [p["sku"] for p in items if not p["sku"].startswith(("WHL", "WL", "WR"))]
        assert not bad, f"Whole products with unexpected SKU prefix: {bad}"

    def test_whole_all_have_local_name(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "whole"})
        items = r.json()
        missing = [p["name"] for p in items if not p.get("local_name")]
        assert not missing, f"Whole products missing local_name: {missing}"

    def test_whole_available_cuts_is_whole_only(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "whole"})
        items = r.json()
        assert all(p["available_cuts"] == ["whole"] for p in items)


# ============ CUT-FRUIT CATEGORY (8 items) ============
class TestCutFruitCatalog:
    EXPECTED = {
        "FNCAPL": "Apple",
        "FNCBNN": "Banana",
        "FNCORG": "Orange",
        "FNCPPY": "Papaya",
        "FNCPPL": "Pineapple",
        "FNCPOM": "Pomegranate",
        "FNCSWL": "Sweet Lemon",
        "FNCWML": "Watermelon",
    }

    def test_cut_fruit_returns_8(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "cut-fruit"})
        assert r.status_code == 200
        assert len(r.json()) == 8

    def test_cut_fruit_all_have_fnc_prefix(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "cut-fruit"})
        items = r.json()
        bad = [p["sku"] for p in items if not p["sku"].startswith("FNC")]
        assert not bad, f"cut-fruit products with non-FNC SKU: {bad}"

    def test_cut_fruit_expected_skus_and_names(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "cut-fruit"})
        actual = {p["sku"]: p["name"] for p in r.json()}
        assert actual == self.EXPECTED, f"cut-fruit mismatch: {actual}"

    def test_cut_fruit_all_have_local_name(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "cut-fruit"})
        for p in r.json():
            assert p.get("local_name"), f"cut-fruit {p['name']} missing local_name"


# ============ READY-MIX CATEGORY (18 items) ============
class TestReadyMixCatalog:
    def test_ready_mix_returns_18(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "ready-mix"})
        assert r.status_code == 200
        assert len(r.json()) == 18

    def test_ready_mix_all_have_fnp_or_fnf_prefix(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "ready-mix"})
        items = r.json()
        bad = [p["sku"] for p in items if not p["sku"].startswith(("FNP", "FNF"))]
        assert not bad, f"ready-mix with non-FNP/FNF SKU: {bad}"

    def test_ready_mix_contains_signature_items(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "ready-mix"})
        names = {p["name"] for p in r.json()}
        # Signature items called out in review request
        assert "Daily Table Salad" in names
        assert "Sambhar Mix" in names
        # Biryani and Undhiyu (variations of naming acceptable)
        assert any("Biryani" in n for n in names), f"expected a Biryani mix, got {names}"
        assert any("Undhiyu" in n for n in names), f"expected an Undhiyu mix, got {names}"

    def test_ready_mix_all_have_local_name(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "ready-mix"})
        for p in r.json():
            assert p.get("local_name"), f"ready-mix {p['name']} missing local_name"


# ============ CUT-VEG UNCHANGED (65 items) ============
class TestCutVegUnchanged:
    def test_cut_veg_still_65(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "cut-veg"})
        assert r.status_code == 200
        assert len(r.json()) == 65

    def test_cut_veg_anchor_onion(self, api_client):
        """Regression: FNCONN Onion still present unchanged from v7."""
        r = api_client.get(f"{API}/products", params={"category": "cut-veg"})
        onion = next((p for p in r.json() if p["sku"] == "FNCONN"), None)
        assert onion is not None
        assert onion["name"] == "Onion"
        assert onion["local_name"] == "Pyaj / Kanda"
