import json
from pathlib import Path

import structlog

from app.etl.pipeline import BasePipeline

logger = structlog.get_logger()

RULES_DIR = Path(__file__).parent.parent / "agents" / "compliance" / "rules"


class RegulatoryPipeline(BasePipeline):
    """Pipeline for ingesting regulatory data (visa rules, health, travel warnings)."""

    def entity_type(self) -> str:
        return "visa_rule"

    def expiry_days(self) -> int:
        return 30

    def build_embedding_text(self, entity: dict) -> str:
        parts = [
            entity.get("country", ""),
            entity.get("nationality", ""),
            entity.get("visa_type", ""),
            entity.get("description", ""),
        ]
        return " ".join(p for p in parts if p)

    async def load_rules_to_json(self, source_path: str) -> None:
        """Load regulatory data from source and save as structured JSON rules files."""
        raw = self.extract(source_path)
        if not raw:
            return

        RULES_DIR.mkdir(parents=True, exist_ok=True)

        # Separate by type
        visa_rules = [e for e in raw if e.get("type") == "visa_rule"]
        health = [e for e in raw if e.get("type") == "health_advisory"]
        warnings = [e for e in raw if e.get("type") == "travel_warning"]

        if visa_rules:
            with open(RULES_DIR / "vietnam_visa.json", "w") as f:
                json.dump(visa_rules, f, indent=2)
            logger.info("regulatory.saved", file="vietnam_visa.json", count=len(visa_rules))

        if health:
            with open(RULES_DIR / "vietnam_health.json", "w") as f:
                json.dump(health, f, indent=2)
            logger.info("regulatory.saved", file="vietnam_health.json", count=len(health))

        if warnings:
            with open(RULES_DIR / "vietnam_travel_warnings.json", "w") as f:
                json.dump(warnings, f, indent=2)
            logger.info("regulatory.saved", file="vietnam_travel_warnings.json", count=len(warnings))


class RegulatoryLookup:
    """Fast keyword lookup for regulatory data from JSON files."""

    def __init__(self, rules_dir: Path | None = None) -> None:
        self.rules_dir = rules_dir or RULES_DIR
        self._visa_rules: dict[str, dict] = {}
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        visa_path = self.rules_dir / "vietnam_visa.json"
        if visa_path.exists():
            with open(visa_path) as f:
                rules = json.load(f)
                for rule in rules:
                    key = rule.get("country_code", "").upper()
                    if key:
                        self._visa_rules[key] = rule
        self._loaded = True

    def get_visa_rule(self, country_code: str) -> dict | None:
        """Lookup visa rule by country code (case-insensitive)."""
        self._load()
        return self._visa_rules.get(country_code.upper())

    def get_all_visa_rules(self) -> list[dict]:
        self._load()
        return list(self._visa_rules.values())
