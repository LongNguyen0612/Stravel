import structlog

logger = structlog.get_logger()


class PriceValidator:
    """Validates that all prices in proposals come from data sources, not LLM generation."""

    def __init__(self, vector_store) -> None:
        self.vector_store = vector_store

    async def validate_price(self, entity_name: str, claimed_price: float, region: str = "") -> dict:
        """Validate a price claim against Vector Store data.

        Returns: {"valid": bool, "source_price": float|None, "entity_name": str}
        """
        results = await self.vector_store.search(entity_name, {"region": region} if region else {}, limit=1)
        if not results:
            logger.warning("guardrails.price_no_entity", entity=entity_name)
            return {"valid": False, "source_price": None, "entity_name": entity_name}

        source_price = results[0].get("pricing")
        if source_price is None:
            return {"valid": True, "source_price": None, "entity_name": entity_name}

        # Allow 10% tolerance for currency conversion / rounding
        tolerance = source_price * 0.10
        is_valid = abs(claimed_price - source_price) <= tolerance

        if not is_valid:
            logger.warning(
                "guardrails.price_mismatch",
                entity=entity_name,
                claimed=claimed_price,
                source=source_price,
            )

        return {"valid": is_valid, "source_price": source_price, "entity_name": entity_name}

    async def validate_prices(self, price_claims: list[dict]) -> dict:
        """Validate multiple price claims. Returns summary.

        price_claims: [{"name": str, "price": float, "region": str}]
        """
        valid = []
        invalid = []

        for claim in price_claims:
            result = await self.validate_price(
                claim.get("name", ""),
                claim.get("price", 0),
                claim.get("region", ""),
            )
            if result["valid"]:
                valid.append(result)
            else:
                invalid.append(result)

        return {"valid": valid, "invalid": invalid, "all_valid": len(invalid) == 0}
