from app.etl.pipeline import BasePipeline


class RestaurantPipeline(BasePipeline):
    def entity_type(self) -> str:
        return "restaurant"

    def expiry_days(self) -> int:
        return 7  # Prices change frequently

    def build_embedding_text(self, entity: dict) -> str:
        parts = [
            entity.get("name", ""),
            entity.get("description", ""),
            f"in {entity.get('region', '')}",
            entity.get("cuisine", ""),
        ]
        return " ".join(p for p in parts if p)
