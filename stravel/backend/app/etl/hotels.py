from app.etl.pipeline import BasePipeline


class HotelPipeline(BasePipeline):
    def entity_type(self) -> str:
        return "hotel"

    def expiry_days(self) -> int:
        return 7  # Prices change frequently

    def build_embedding_text(self, entity: dict) -> str:
        parts = [
            entity.get("name", ""),
            entity.get("description", ""),
            f"in {entity.get('region', '')}",
            entity.get("accommodation_style", ""),
        ]
        return " ".join(p for p in parts if p)
