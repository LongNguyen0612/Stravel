"""Seed the Qdrant Vector Store with Vietnam travel data.

Usage:
    python -m data.scripts.seed_vector_store
    python -m data.scripts.seed_vector_store --data-dir data/seed --qdrant-url http://localhost:6333
"""

import argparse
import asyncio
import json
from pathlib import Path

import structlog

logger = structlog.get_logger()

DATA_DIR = Path(__file__).parent.parent / "seed"

PIPELINE_CONFIG = [
    ("hotels_vietnam.json", "hotel", 7),
    ("attractions_vietnam.json", "attraction", 30),
    ("restaurants_vietnam.json", "restaurant", 7),
    ("visa_rules.json", "visa_rule", 30),
]


async def seed(data_dir: str = str(DATA_DIR), qdrant_url: str = "http://localhost:6333") -> None:
    from app.etl.attractions import AttractionPipeline
    from app.etl.hotels import HotelPipeline
    from app.etl.regulatory import RegulatoryPipeline
    from app.etl.restaurants import RestaurantPipeline
    from app.rag.embeddings import EmbeddingService
    from app.rag.vector_store import QdrantVectorStore

    store = QdrantVectorStore(url=qdrant_url)
    await store.ensure_collection()
    embedder = EmbeddingService()

    data_path = Path(data_dir)

    pipelines = [
        (HotelPipeline(store, embedder), "hotels_vietnam.json"),
        (AttractionPipeline(store, embedder), "attractions_vietnam.json"),
        (RestaurantPipeline(store, embedder), "restaurants_vietnam.json"),
        (RegulatoryPipeline(store, embedder), "visa_rules.json"),
    ]

    total_inserted = 0
    for pipeline, filename in pipelines:
        filepath = data_path / filename
        if not filepath.exists():
            logger.warning("seed.file_not_found", file=filename)
            continue

        result = await pipeline.run(str(filepath))
        total_inserted += result.inserted
        logger.info(
            "seed.pipeline_complete",
            pipeline=pipeline.entity_type(),
            inserted=result.inserted,
            errors=len(result.errors),
        )

    # Copy regulatory rules to compliance rules dir
    reg_pipeline = RegulatoryPipeline(store, embedder)
    visa_path = data_path / "visa_rules.json"
    if visa_path.exists():
        await reg_pipeline.load_rules_to_json(str(visa_path))

    # Copy seasonal data
    seasons_src = data_path / "vietnam_seasons.json"
    seasons_dst = Path(__file__).parent.parent.parent / "backend" / "app" / "agents" / "compliance" / "rules" / "vietnam_seasons.json"
    if seasons_src.exists() and not seasons_dst.exists():
        seasons_dst.parent.mkdir(parents=True, exist_ok=True)
        import shutil

        shutil.copy2(seasons_src, seasons_dst)
        logger.info("seed.seasons_copied")

    logger.info("seed.complete", total_inserted=total_inserted)
    await store.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Vector Store with Vietnam travel data")
    parser.add_argument("--data-dir", default=str(DATA_DIR), help="Path to seed data directory")
    parser.add_argument("--qdrant-url", default="http://localhost:6333", help="Qdrant server URL")
    args = parser.parse_args()

    asyncio.run(seed(args.data_dir, args.qdrant_url))


if __name__ == "__main__":
    main()
