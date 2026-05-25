"""Tests for seed data integrity — no Qdrant required."""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "seed"


def test_hotels_file_exists():
    assert (DATA_DIR / "hotels_vietnam.json").exists()


def test_attractions_file_exists():
    assert (DATA_DIR / "attractions_vietnam.json").exists()


def test_restaurants_file_exists():
    assert (DATA_DIR / "restaurants_vietnam.json").exists()


def test_visa_rules_file_exists():
    assert (DATA_DIR / "visa_rules.json").exists()


def test_seasons_file_exists():
    assert (DATA_DIR / "vietnam_seasons.json").exists()


def test_hotels_have_required_fields():
    with open(DATA_DIR / "hotels_vietnam.json") as f:
        hotels = json.load(f)
    assert len(hotels) >= 10
    for hotel in hotels:
        assert "name" in hotel
        assert "region" in hotel
        assert "pricing" in hotel
        assert "rating" in hotel


def test_visa_rules_cover_20_nationalities():
    with open(DATA_DIR / "visa_rules.json") as f:
        rules = json.load(f)
    visa_rules = [r for r in rules if r.get("type") == "visa_rule"]
    assert len(visa_rules) >= 20


def test_visa_rules_phu_quoc_exception():
    with open(DATA_DIR / "visa_rules.json") as f:
        rules = json.load(f)
    e_visa_rules = [r for r in rules if r.get("visa_type") == "e_visa"]
    assert any(r.get("phu_quoc_exception") for r in e_visa_rules)


def test_seasons_cover_all_regions():
    with open(DATA_DIR / "vietnam_seasons.json") as f:
        seasons = json.load(f)
    regions = {s["region"] for s in seasons}
    assert regions == {"north", "central", "south"}


def test_attractions_have_categories():
    with open(DATA_DIR / "attractions_vietnam.json") as f:
        attractions = json.load(f)
    assert len(attractions) >= 10
    categories = {a.get("category") for a in attractions}
    assert len(categories) >= 3  # At least 3 different categories
