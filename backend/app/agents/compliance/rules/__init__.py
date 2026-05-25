import json
from pathlib import Path

RULES_DIR = Path(__file__).parent


def load_rule_file(filename: str) -> list[dict]:
    """Load a regulatory rules JSON file."""
    path = RULES_DIR / filename
    if not path.exists():
        return []
    with open(path) as f:
        return json.load(f)


def load_visa_rules() -> list[dict]:
    return load_rule_file("vietnam_visa.json")


def load_health_advisories() -> list[dict]:
    return load_rule_file("vietnam_health.json")


def load_travel_warnings() -> list[dict]:
    return load_rule_file("vietnam_travel_warnings.json")


def load_seasonal_patterns() -> list[dict]:
    return load_rule_file("vietnam_seasons.json")
