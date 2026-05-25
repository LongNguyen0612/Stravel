import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

import structlog

logger = structlog.get_logger()


@dataclass
class IngestionResult:
    total: int = 0
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)

    @property
    def success_rate(self) -> float:
        return (self.inserted + self.updated) / self.total * 100 if self.total > 0 else 0


class BasePipeline(ABC):
    """Base ETL pipeline for ingesting entities into the Vector Store."""

    def __init__(self, vector_store, embedder) -> None:
        self.vector_store = vector_store
        self.embedder = embedder

    @abstractmethod
    def entity_type(self) -> str:
        """Return the entity type this pipeline handles."""

    @abstractmethod
    def expiry_days(self) -> int:
        """Return the number of days before entities expire."""

    @abstractmethod
    def build_embedding_text(self, entity: dict) -> str:
        """Build the text to embed for this entity."""

    def extract(self, source_path: str) -> list[dict]:
        """Extract entities from a JSON file."""
        path = Path(source_path)
        if not path.exists():
            logger.error("etl.extract.file_not_found", path=source_path)
            return []
        with open(path) as f:
            data = json.load(f)
        logger.info("etl.extract", source=source_path, count=len(data))
        return data

    def transform(self, raw_entities: list[dict]) -> list[dict]:
        """Transform raw data into entity format with metadata."""
        now = datetime.utcnow()
        transformed = []
        for entity in raw_entities:
            entity["entity_type"] = self.entity_type()
            entity["ingested_at"] = now.isoformat()
            entity["expires_at"] = (now + timedelta(days=self.expiry_days())).isoformat()
            transformed.append(entity)
        return transformed

    async def load(self, entities: list[dict]) -> IngestionResult:
        """Load entities into the Vector Store."""
        result = IngestionResult(total=len(entities))

        texts = [self.build_embedding_text(e) for e in entities]
        vectors = self.embedder.embed_batch(texts)

        for entity, vector in zip(entities, vectors):
            try:
                entity_id = self._build_id(entity)
                await self.vector_store.upsert(entity_id, vector, entity)
                result.inserted += 1
            except Exception as e:
                result.errors.append(f"{entity.get('name', 'unknown')}: {e}")

        logger.info(
            "etl.load",
            entity_type=self.entity_type(),
            total=result.total,
            inserted=result.inserted,
            errors=len(result.errors),
        )
        return result

    def _build_id(self, entity: dict) -> str:
        """Build a deterministic ID for deduplication."""
        name = entity.get("name", "").lower().strip()
        region = entity.get("region", "").lower().strip()
        etype = self.entity_type()
        import hashlib

        return hashlib.md5(f"{etype}:{region}:{name}".encode()).hexdigest()

    async def run(self, source_path: str) -> IngestionResult:
        """Run the full ETL pipeline."""
        raw = self.extract(source_path)
        if not raw:
            return IngestionResult()
        transformed = self.transform(raw)
        return await self.load(transformed)
