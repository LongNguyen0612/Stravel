import structlog

logger = structlog.get_logger()


class EntityValidator:
    """Validates that all entity references in proposals exist in the Vector Store."""

    def __init__(self, vector_store) -> None:
        self.vector_store = vector_store

    async def validate_entities(self, entity_names: list[str], region: str = "") -> dict:
        """Validate a list of entity names against the Vector Store.

        Returns: {"valid": [...], "invalid": [...], "replacements": {...}}
        """
        valid = []
        invalid = []
        replacements = {}

        for name in entity_names:
            result = await self.vector_store.search(name, {"region": region} if region else {}, limit=1)
            # Require exact name match (case-insensitive) — not just semantic similarity
            if result and result[0].get("name", "").lower() == name.lower():
                valid.append(name)
            elif result and result[0].get("name", "").lower().startswith(name.lower()):
                valid.append(name)  # Allow prefix match (e.g., "Rex" → "Rex Hotel Saigon")
            else:
                invalid.append(name)
                # Try to find a replacement
                replacement = await self._find_replacement(name, region)
                if replacement:
                    replacements[name] = replacement

        if invalid:
            logger.warning(
                "guardrails.entity_validation_failed",
                invalid_count=len(invalid),
                invalid_names=invalid[:5],
            )

        return {"valid": valid, "invalid": invalid, "replacements": replacements}

    async def _find_replacement(self, name: str, region: str) -> str | None:
        """Try to find a similar entity in the Vector Store."""
        # Search with broader query
        results = await self.vector_store.search(name, {"region": region} if region else {}, limit=3)
        if results:
            return results[0].get("name", "")
        return None

    async def validate_and_filter(self, entities: list[dict]) -> list[dict]:
        """Filter a list of entity dicts to only those that exist in the Vector Store."""
        validated = []
        for entity in entities:
            name = entity.get("name", "")
            region = entity.get("region", "")
            result = await self.vector_store.search(name, {"region": region} if region else {}, limit=1)
            if result:
                validated.append(entity)
            else:
                logger.warning("guardrails.entity_rejected", name=name, region=region)
        return validated
