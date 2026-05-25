import json
import tempfile
from pathlib import Path

import pytest

from app.etl.regulatory import RegulatoryLookup, RegulatoryPipeline


class MockVectorStore:
    def __init__(self):
        self._store = {}

    async def upsert(self, entity_id, vector, payload):
        self._store[entity_id] = payload

    async def search(self, query, filters, limit=10):
        return []

    async def get_by_id(self, entity_id):
        return self._store.get(entity_id)


class MockEmbedder:
    def embed(self, text):
        return [0.1] * 384

    def embed_batch(self, texts):
        return [[0.1] * 384 for _ in texts]


@pytest.fixture
def pipeline():
    return RegulatoryPipeline(MockVectorStore(), MockEmbedder())


@pytest.fixture
def sample_regulatory_data():
    return [
        {
            "type": "visa_rule",
            "country_code": "DE",
            "nationality": "German",
            "visa_type": "visa_free_45",
            "duration_days": 45,
            "cost_usd": 0,
            "description": "German citizens visa-free 45 days",
            "name": "Vietnam visa - Germany",
            "region": "vietnam",
        },
        {
            "type": "visa_rule",
            "country_code": "AU",
            "nationality": "Australian",
            "visa_type": "e_visa",
            "duration_days": 90,
            "cost_usd": 25,
            "description": "Australian citizens require e-visa",
            "name": "Vietnam visa - Australia",
            "region": "vietnam",
        },
    ]


@pytest.mark.asyncio
async def test_regulatory_pipeline_run(pipeline, sample_regulatory_data):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(sample_regulatory_data, f)
        path = f.name

    result = await pipeline.run(path)
    assert result.total == 2
    assert result.inserted == 2


@pytest.mark.asyncio
async def test_load_rules_to_json(pipeline, sample_regulatory_data, tmp_path):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(sample_regulatory_data, f)
        source = f.name

    # Patch rules dir
    import app.etl.regulatory as reg

    original_dir = reg.RULES_DIR
    reg.RULES_DIR = tmp_path

    await pipeline.load_rules_to_json(source)

    assert (tmp_path / "vietnam_visa.json").exists()
    with open(tmp_path / "vietnam_visa.json") as f:
        rules = json.load(f)
    assert len(rules) == 2

    reg.RULES_DIR = original_dir


def test_regulatory_lookup():
    rules_dir = Path(tempfile.mkdtemp())
    visa_data = [
        {"country_code": "DE", "visa_type": "visa_free_45", "duration_days": 45},
        {"country_code": "AU", "visa_type": "e_visa", "duration_days": 90},
    ]
    with open(rules_dir / "vietnam_visa.json", "w") as f:
        json.dump(visa_data, f)

    lookup = RegulatoryLookup(rules_dir)

    de_rule = lookup.get_visa_rule("DE")
    assert de_rule is not None
    assert de_rule["visa_type"] == "visa_free_45"

    au_rule = lookup.get_visa_rule("au")  # Case insensitive
    assert au_rule is not None
    assert au_rule["duration_days"] == 90

    unknown = lookup.get_visa_rule("XX")
    assert unknown is None


def test_regulatory_lookup_all():
    rules_dir = Path(tempfile.mkdtemp())
    visa_data = [
        {"country_code": "DE", "visa_type": "visa_free_45"},
        {"country_code": "AU", "visa_type": "e_visa"},
        {"country_code": "JP", "visa_type": "visa_free_45"},
    ]
    with open(rules_dir / "vietnam_visa.json", "w") as f:
        json.dump(visa_data, f)

    lookup = RegulatoryLookup(rules_dir)
    all_rules = lookup.get_all_visa_rules()
    assert len(all_rules) == 3
