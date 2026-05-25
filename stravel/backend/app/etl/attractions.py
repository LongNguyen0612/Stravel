from app.etl.pipeline import BasePipeline


class AttractionPipeline(BasePipeline):
    def entity_type(self) -> str:
        return "attraction"

    def expiry_days(self) -> int:
        return 30  # Attractions change less frequently

    def build_embedding_text(self, entity: dict) -> str:
        parts = [
            entity.get("name", ""),
            entity.get("description", ""),
            f"in {entity.get('region', '')}",
            entity.get("category", ""),
        ]
        return " ".join(p for p in parts if p)
