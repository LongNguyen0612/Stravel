# Story 2.6: Vietnam Seed Data Loading

Status: done

## Story

As a developer,
I want a seed data script that populates the Vector Store with Vietnam travel data,
so that the system has real entities to work with during development and testing.

**Depends on:** Story 2.1 (Qdrant Vector Store Setup & Entity Model), Story 2.2 (Entity Ingestion Pipeline), Story 2.5 (Regulatory Data Ingestion)

**FRs implemented:** None directly -- this is a data population story (AR-12)
**FRs enabled:** FR-6 (Accommodation Matching), FR-10 (Day-by-Day Itinerary), FR-15 (Visa Requirement Validation), FR-19 (Seasonal Feasibility Check), FR-30 (Hybrid Search -- provides data to search)

## Acceptance Criteria

### AC-1: Seed Data File Structure
**Given** the `data/seed/` directory exists
**When** the directory is inspected
**Then** it contains:
- `data/seed/hotels.json` -- hotel entities across 10 destinations
- `data/seed/attractions.json` -- attraction entities across 10 destinations
- `data/seed/restaurants.json` -- restaurant entities across 10 destinations
- `data/seed/visa_rules.json` -- visa rules for 20+ nationalities
- `data/seed/monsoon_patterns.json` -- regional seasonal/monsoon data
- `data/seed/README.md` -- documents the seed data format and sources

### AC-2: Destination Coverage
**Given** the seed JSON files are inspected
**When** entities are counted per destination
**Then** the following 10 destinations each have at least 10 hotels, 10 attractions, and 10 restaurants:
- Hanoi
- Ho Chi Minh City (HCMC)
- Da Nang
- Phu Quoc
- Sapa
- Hoi An
- Hue
- Nha Trang
- Da Lat
- Mekong Delta (Can Tho / Ben Tre)

### AC-3: Hotel Entity Schema
**Given** any hotel entity in `data/seed/hotels.json`
**When** the entity is validated
**Then** it contains all required fields:
- `name: str` -- real or realistic hotel name
- `type: "hotel"` -- entity type literal
- `destination: str` -- one of the 10 destinations
- `region: str` -- "north", "central", or "south"
- `description: str` -- 2-3 sentence description of the property
- `latitude: float` and `longitude: float` -- approximate coordinates
- `price_per_night_usd: float` -- typical nightly rate in USD
- `price_category: str` -- "budget", "mid-range", or "luxury"
- `star_rating: int | null` -- 1-5 or null for unrated
- `amenities: list[str]` -- e.g., ["pool", "spa", "wifi", "breakfast", "airport_shuttle"]
- `accessibility: dict` -- `{"wheelchair": bool, "elevator": bool, "ground_floor_available": bool}`
- `style: str` -- e.g., "boutique", "resort", "hostel", "homestay", "business"
- `max_guests_per_room: int` -- typical max occupancy
- `source_url: str` -- reference URL (real or realistic)
- `tags: list[str]` -- searchable tags, e.g., ["beachfront", "family-friendly", "romantic"]

### AC-4: Attraction Entity Schema
**Given** any attraction entity in `data/seed/attractions.json`
**When** the entity is validated
**Then** it contains all required fields:
- `name: str` -- real attraction name
- `type: "attraction"` -- entity type literal
- `destination: str` -- one of the 10 destinations
- `region: str` -- "north", "central", or "south"
- `description: str` -- 2-3 sentence description
- `latitude: float` and `longitude: float` -- approximate coordinates
- `category: str` -- e.g., "cultural", "nature", "adventure", "historical", "entertainment", "religious"
- `estimated_duration_hours: float` -- typical visit duration
- `entrance_fee_usd: float | null` -- null if free
- `min_age: int | null` -- minimum age restriction or null
- `physical_intensity: str` -- "low", "moderate", "high"
- `best_time_of_day: str` -- "morning", "afternoon", "evening", "any"
- `weather_dependent: bool` -- whether outdoor/weather-sensitive
- `accessibility: dict` -- `{"wheelchair_accessible": bool, "requires_climbing": bool, "walking_distance_km": float}`
- `source_url: str` -- reference URL
- `tags: list[str]` -- searchable tags, e.g., ["unesco", "kid-friendly", "photography", "sunset"]

### AC-5: Restaurant Entity Schema
**Given** any restaurant entity in `data/seed/restaurants.json`
**When** the entity is validated
**Then** it contains all required fields:
- `name: str` -- real or realistic restaurant name
- `type: "restaurant"` -- entity type literal
- `destination: str` -- one of the 10 destinations
- `region: str` -- "north", "central", or "south"
- `description: str` -- 2-3 sentence description
- `latitude: float` and `longitude: float` -- approximate coordinates
- `cuisine_type: list[str]` -- e.g., ["vietnamese", "seafood", "fusion", "international"]
- `price_range_usd: str` -- "$" (under $5), "$$" ($5-15), "$$$" ($15-40), "$$$$" ($40+)
- `average_meal_usd: float` -- average cost per person
- `dietary_options: list[str]` -- e.g., ["vegan", "vegetarian", "halal", "gluten-free"]
- `meal_types: list[str]` -- e.g., ["breakfast", "lunch", "dinner", "street_food"]
- `rating: float` -- 1.0-5.0
- `atmosphere: str` -- e.g., "casual", "fine-dining", "street-food", "rooftop", "garden"
- `source_url: str` -- reference URL
- `tags: list[str]` -- searchable tags, e.g., ["local-favorite", "tourist-friendly", "romantic", "family"]

### AC-6: Visa Rules Schema and Coverage
**Given** `data/seed/visa_rules.json` is inspected
**When** the nationality coverage is checked
**Then** visa rules exist for at least the following 20+ nationalities:
- **45-day visa-free:** United Kingdom, France, Germany, Spain, Italy, Japan, South Korea, Denmark, Sweden, Norway, Finland, Russia, Belarus
- **30-day visa-free (ASEAN):** Thailand, Malaysia, Singapore, Indonesia, Philippines, Myanmar, Laos, Cambodia, Brunei
- **E-visa required:** United States, Canada, Australia, India, China, Brazil
- **Each rule includes:** nationality, visa_type ("visa-free-45", "visa-free-30", "e-visa", "embassy-visa"), max_stay_days, cost_usd, processing_days, entry_points (list), notes
- **Phu Quoc special case** is explicitly represented: 30-day visa-free only when staying exclusively on the island; if combined with mainland Vietnam, standard visa rules apply

### AC-7: Monsoon Pattern Data
**Given** `data/seed/monsoon_patterns.json` is inspected
**When** the data is validated
**Then** seasonal patterns are represented for all three regions:
- **North (Hanoi, Sapa):** wet season May-October, dry season November-April, coldest December-February
- **Central (Da Nang, Hoi An, Hue):** wet season September-January (peak October-November), dry season February-August
- **South (HCMC, Phu Quoc, Mekong Delta, Nha Trang, Da Lat):** wet season May-October, dry season November-April
- Each region includes: `region`, `months` (array of 12 objects with `month`, `rainfall_mm`, `avg_temp_celsius`, `humidity_percent`, `risk_level` ("low", "moderate", "high"))
- Special notes for Da Lat (cooler highland climate) and Nha Trang (offset pattern from HCMC)

### AC-8: Seed Script Execution
**Given** `data/scripts/seed_vector_store.py` exists
**When** `python data/scripts/seed_vector_store.py` is run
**Then** all seed entities from JSON files are ingested into Qdrant with embeddings and metadata
**And** the script outputs progress: `Loading hotels... 100/100 | Loading attractions... 100/100 | Loading restaurants... 100/100 | Loading visa rules... 20/20 | Loading monsoon patterns... 3/3`
**And** the script completes without errors against a running Qdrant instance

### AC-9: Idempotency
**Given** the seed script has already been run once
**When** `python data/scripts/seed_vector_store.py` is run a second time
**Then** no duplicate entities are created in Qdrant
**And** existing entities are updated if the seed data has changed (upsert behavior)
**And** the script logs `Skipped (already exists): 100 | Updated: 0 | Created: 0` or similar

### AC-10: Entity Data Quality
**Given** the seed data is loaded
**When** the data quality is validated
**Then** price ranges are realistic for Vietnam (budget hotels $10-30, mid-range $40-100, luxury $150-500+)
**And** coordinates are within Vietnam's geographic bounds (lat: 8.0-23.5, lon: 102.0-110.0)
**And** entity distribution covers budget, mid-range, and luxury segments per destination
**And** restaurant data includes at least 2 entries with vegan/vegetarian options per destination
**And** hotel data includes at least 1 wheelchair-accessible option per destination

## Tasks

- [ ] Task 1: Create hotel seed data JSON (AC: #1, #2, #3, #10)
  - [ ] Create `data/seed/hotels.json` with 100+ hotel entities
  - [ ] Distribute across 10 destinations (minimum 10 per destination)
  - [ ] Include mix of budget (hostels, homestays: $10-30), mid-range (3-star, boutique: $40-100), luxury (4-5 star, resort: $150-500+) per destination
  - [ ] Ensure at least 1 wheelchair-accessible hotel per destination
  - [ ] Include realistic amenities, coordinates, and descriptions
  - [ ] Validate all entries match the hotel entity schema (AC-3)

- [ ] Task 2: Create attraction seed data JSON (AC: #1, #2, #4, #10)
  - [ ] Create `data/seed/attractions.json` with 100+ attraction entities
  - [ ] Distribute across 10 destinations (minimum 10 per destination)
  - [ ] Include mix of categories: cultural, nature, adventure, historical, entertainment, religious
  - [ ] Include realistic duration estimates, fees, and accessibility info
  - [ ] Mark weather-dependent attractions appropriately
  - [ ] Include age-restricted activities (e.g., motorbike tours min 18, scuba min 10)
  - [ ] Validate all entries match the attraction entity schema (AC-4)

- [ ] Task 3: Create restaurant seed data JSON (AC: #1, #2, #5, #10)
  - [ ] Create `data/seed/restaurants.json` with 100+ restaurant entities
  - [ ] Distribute across 10 destinations (minimum 10 per destination)
  - [ ] Include mix of price ranges: street food ($1-5), mid-range ($5-15), upscale ($15-40), fine dining ($40+)
  - [ ] Include at least 2 restaurants with vegan/vegetarian options per destination
  - [ ] Include variety of cuisine types: Vietnamese, seafood, fusion, international, regional specialties
  - [ ] Include at least 1 halal option per major destination (Hanoi, HCMC, Da Nang)
  - [ ] Validate all entries match the restaurant entity schema (AC-5)

- [ ] Task 4: Create visa rules seed data JSON (AC: #1, #6)
  - [ ] Create `data/seed/visa_rules.json` with visa rules for 20+ nationalities
  - [ ] Include 45-day visa-free countries (13+)
  - [ ] Include 30-day visa-free ASEAN countries (9+)
  - [ ] Include e-visa required countries (6+)
  - [ ] Implement Phu Quoc special case with explicit notes and conditions
  - [ ] Include processing times, costs, and valid entry points

- [ ] Task 5: Create monsoon pattern seed data JSON (AC: #1, #7)
  - [ ] Create `data/seed/monsoon_patterns.json` with month-by-month data
  - [ ] Cover North, Central, South regions with per-month rainfall, temperature, humidity, risk level
  - [ ] Include special notes for Da Lat (highland climate) and Nha Trang (offset pattern)
  - [ ] Include destination-to-region mapping

- [ ] Task 6: Implement the seed script (AC: #8, #9)
  - [ ] Create `data/scripts/seed_vector_store.py`
  - [ ] Implement JSON file loading with schema validation (Pydantic)
  - [ ] Generate embeddings for entity descriptions using `rag/embeddings.py`
  - [ ] Upsert entities into Qdrant using `rag/vector_store.py` (via `VectorStoreProtocol`)
  - [ ] Use `etl/deduplication.py` for idempotent ingestion (match on name + destination)
  - [ ] Add progress output with counts per entity type
  - [ ] Add CLI arguments: `--dry-run` (validate without ingesting), `--force` (re-ingest all), `--type` (hotels|attractions|restaurants|visa|monsoon)
  - [ ] Add structured logging via `structlog`
  - [ ] Handle errors gracefully: log failures per entity, continue loading remaining entities

- [ ] Task 7: Create seed data README (AC: #1)
  - [ ] Create `data/seed/README.md` documenting:
    - JSON schema for each entity type
    - How to add new entities
    - Data sources and freshness expectations
    - How to run the seed script

- [ ] Task 8: Validate end-to-end (AC: #8, #9, #10)
  - [ ] Run seed script against running Qdrant instance
  - [ ] Verify entity counts in Qdrant match expected totals
  - [ ] Run seed script a second time and verify no duplicates
  - [ ] Verify hybrid search returns results for test queries:
    - Keyword: "Rex Hotel Saigon" -> exact match
    - Semantic: "quiet beach resort with pool under $100" -> relevant Phu Quoc/Nha Trang results
    - Filtered: type=restaurant, destination=Hanoi, dietary_options contains "vegan" -> relevant results
  - [ ] Verify visa rule lookup for US nationality returns e-visa requirement
  - [ ] Verify Phu Quoc special case is retrievable and correctly structured

## Dev Notes

### Critical Architecture Constraints

- **Use existing ETL infrastructure**: The seed script must use the `etl/pipeline.py` base class and `etl/deduplication.py` from Story 2.2. Do not re-implement ingestion logic.
- **Use existing VectorStoreProtocol**: All Qdrant interactions go through `rag/vector_store.py` implementing `VectorStoreProtocol`. Never import `qdrant_client` directly in the seed script.
- **Use existing embeddings**: Use `rag/embeddings.py` from Story 2.1 for generating vector representations. Never call the embedding model directly.
- **Idempotency via deduplication**: Use `etl/deduplication.py` matching on `name + destination` (or `name + nationality` for visa rules). The script must be safe to run repeatedly.
- **structlog only**: All logging via `structlog`, never stdlib `logging`.
- **No tenant_id in seed data**: Seed data is shared across all tenants. The vector store should store these as `tenant_id: "shared"` or without tenant filtering (architecture decision for Story 2.1).

### Seed Script Architecture

```python
# data/scripts/seed_vector_store.py

"""
Vietnam Seed Data Loader

Populates Qdrant vector store with Vietnam travel data for development and testing.
Uses existing ETL pipeline infrastructure for ingestion and deduplication.

Usage:
    python data/scripts/seed_vector_store.py                    # Load all seed data
    python data/scripts/seed_vector_store.py --type hotels      # Load only hotels
    python data/scripts/seed_vector_store.py --dry-run           # Validate without ingesting
    python data/scripts/seed_vector_store.py --force             # Re-ingest all (overwrite)
"""

import argparse
import json
import sys
from pathlib import Path

import structlog

# Add backend to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from app.rag.vector_store import QdrantVectorStore  # via VectorStoreProtocol
from app.rag.embeddings import EmbeddingService
from app.etl.deduplication import DeduplicationService

logger = structlog.get_logger()

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"

ENTITY_TYPES = {
    "hotels": {"file": "hotels.json", "collection": "entities"},
    "attractions": {"file": "attractions.json", "collection": "entities"},
    "restaurants": {"file": "restaurants.json", "collection": "entities"},
    "visa": {"file": "visa_rules.json", "collection": "regulatory"},
    "monsoon": {"file": "monsoon_patterns.json", "collection": "regulatory"},
}


def load_json(filename: str) -> list[dict]:
    """Load and validate a seed JSON file."""
    filepath = SEED_DIR / filename
    if not filepath.exists():
        raise FileNotFoundError(f"Seed file not found: {filepath}")
    with open(filepath) as f:
        data = json.load(f)
    logger.info("seed.file_loaded", file=filename, count=len(data))
    return data


async def seed_entities(
    entity_type: str,
    entities: list[dict],
    vector_store: VectorStoreProtocol,
    embedding_service: EmbeddingService,
    dedup_service: DeduplicationService,
    dry_run: bool = False,
    force: bool = False,
) -> dict:
    """Ingest a batch of entities with deduplication."""
    stats = {"created": 0, "updated": 0, "skipped": 0, "failed": 0}

    for entity in entities:
        try:
            # Check for duplicates (by name + destination/nationality)
            dedup_key = _get_dedup_key(entity)
            exists = await dedup_service.check_exists(dedup_key)

            if exists and not force:
                stats["skipped"] += 1
                continue

            if dry_run:
                stats["created"] += 1
                continue

            # Generate embedding from description/content
            text = _build_embedding_text(entity)
            embedding = await embedding_service.embed(text)

            # Upsert into vector store
            await vector_store.upsert(
                entity_id=dedup_key,
                embedding=embedding,
                metadata=entity,
            )

            if exists:
                stats["updated"] += 1
            else:
                stats["created"] += 1

        except Exception as e:
            stats["failed"] += 1
            logger.error("seed.entity_failed",
                entity_type=entity_type,
                entity_name=entity.get("name", "unknown"),
                error=str(e))

    return stats
```

### JSON File Format -- hotels.json

The JSON file is an array of hotel objects at the top level. Each hotel follows the schema defined in AC-3.

```json
[
  {
    "name": "Sofitel Legend Metropole Hanoi",
    "type": "hotel",
    "destination": "Hanoi",
    "region": "north",
    "description": "Iconic French colonial luxury hotel in the heart of Hanoi's French Quarter. Features two wings — the historic Metropole wing and modern Opera wing — with world-class dining and a legendary history hosting heads of state and literary figures.",
    "latitude": 21.0245,
    "longitude": 105.8567,
    "price_per_night_usd": 350.0,
    "price_category": "luxury",
    "star_rating": 5,
    "amenities": ["pool", "spa", "wifi", "breakfast", "fitness_center", "restaurant", "bar", "concierge", "room_service", "laundry"],
    "accessibility": {"wheelchair": true, "elevator": true, "ground_floor_available": true},
    "style": "heritage",
    "max_guests_per_room": 3,
    "source_url": "https://www.sofitel-legend-metropole-hanoi.com",
    "tags": ["heritage", "french-colonial", "luxury", "central-location", "romantic", "fine-dining"]
  }
]
```

### JSON File Format -- attractions.json

```json
[
  {
    "name": "Ha Long Bay Cruise",
    "type": "attraction",
    "destination": "Hanoi",
    "region": "north",
    "description": "UNESCO World Heritage Site featuring thousands of limestone karsts and islands rising from emerald waters. Day trips and overnight junk boat cruises explore caves, floating villages, and kayaking routes through dramatic seascapes.",
    "latitude": 20.9101,
    "longitude": 107.1839,
    "category": "nature",
    "estimated_duration_hours": 8.0,
    "entrance_fee_usd": 7.0,
    "min_age": null,
    "physical_intensity": "low",
    "best_time_of_day": "morning",
    "weather_dependent": true,
    "accessibility": {"wheelchair_accessible": false, "requires_climbing": true, "walking_distance_km": 1.5},
    "source_url": "https://www.halongbay.com.vn",
    "tags": ["unesco", "nature", "boat-cruise", "photography", "bucket-list", "kayaking"]
  }
]
```

### JSON File Format -- restaurants.json

```json
[
  {
    "name": "Pho Thin",
    "type": "restaurant",
    "destination": "Hanoi",
    "region": "north",
    "description": "Legendary Hanoi pho restaurant established in 1979, famous for its stir-fried beef pho (pho xao). A tiny street-side establishment that draws locals and tourists alike with its rich, deeply flavored broth.",
    "latitude": 21.0325,
    "longitude": 105.8508,
    "cuisine_type": ["vietnamese", "noodle_soup"],
    "price_range_usd": "$",
    "average_meal_usd": 3.0,
    "dietary_options": [],
    "meal_types": ["breakfast", "lunch"],
    "rating": 4.5,
    "atmosphere": "street-food",
    "source_url": "https://www.tripadvisor.com/pho-thin-hanoi",
    "tags": ["local-favorite", "iconic", "street-food", "must-try", "budget"]
  }
]
```

### JSON File Format -- visa_rules.json

```json
[
  {
    "nationality": "United States",
    "country_code": "US",
    "visa_type": "e-visa",
    "max_stay_days": 90,
    "cost_usd": 25.0,
    "processing_days": 3,
    "entry_points": ["all_international"],
    "multiple_entry": true,
    "notes": "E-visa valid for 90 days, multiple entry. Apply at https://evisa.xuatnhapcanh.gov.vn/"
  },
  {
    "nationality": "Phu Quoc Special Zone",
    "country_code": "__PHU_QUOC__",
    "visa_type": "special-zone",
    "max_stay_days": 30,
    "cost_usd": 0.0,
    "processing_days": 0,
    "entry_points": ["phu_quoc_international_airport", "phu_quoc_seaport"],
    "multiple_entry": false,
    "notes": "30-day visa-free stay ONLY when arriving directly to Phu Quoc and staying exclusively on the island. If combining with mainland Vietnam destinations, standard visa rules for the traveler's nationality apply. This is the most common compliance trap for Vietnam trip planning.",
    "applies_to_all_nationalities": true,
    "conditions": {
      "must_arrive_directly": true,
      "island_only": true,
      "mainland_combination_requires_visa": true
    }
  }
]
```

### JSON File Format -- monsoon_patterns.json

```json
[
  {
    "region": "north",
    "destinations": ["Hanoi", "Sapa"],
    "months": [
      {"month": 1, "month_name": "January", "rainfall_mm": 18, "avg_temp_celsius": 17, "humidity_percent": 78, "risk_level": "low"},
      {"month": 2, "month_name": "February", "rainfall_mm": 26, "avg_temp_celsius": 18, "humidity_percent": 82, "risk_level": "low"},
      {"month": 3, "month_name": "March", "rainfall_mm": 44, "avg_temp_celsius": 21, "humidity_percent": 84, "risk_level": "low"},
      {"month": 4, "month_name": "April", "rainfall_mm": 90, "avg_temp_celsius": 25, "humidity_percent": 83, "risk_level": "moderate"},
      {"month": 5, "month_name": "May", "rainfall_mm": 190, "avg_temp_celsius": 28, "humidity_percent": 81, "risk_level": "high"},
      {"month": 6, "month_name": "June", "rainfall_mm": 240, "avg_temp_celsius": 30, "humidity_percent": 82, "risk_level": "high"},
      {"month": 7, "month_name": "July", "rainfall_mm": 290, "avg_temp_celsius": 30, "humidity_percent": 82, "risk_level": "high"},
      {"month": 8, "month_name": "August", "rainfall_mm": 320, "avg_temp_celsius": 29, "humidity_percent": 84, "risk_level": "high"},
      {"month": 9, "month_name": "September", "rainfall_mm": 260, "avg_temp_celsius": 28, "humidity_percent": 82, "risk_level": "high"},
      {"month": 10, "month_name": "October", "rainfall_mm": 130, "avg_temp_celsius": 25, "humidity_percent": 79, "risk_level": "moderate"},
      {"month": 11, "month_name": "November", "rainfall_mm": 43, "avg_temp_celsius": 22, "humidity_percent": 77, "risk_level": "low"},
      {"month": 12, "month_name": "December", "rainfall_mm": 20, "avg_temp_celsius": 18, "humidity_percent": 75, "risk_level": "low"}
    ],
    "notes": "Sapa is significantly cooler than Hanoi (5-10C lower), with possible frost December-February. Best trekking weather: September-November (post-rain, rice harvest)."
  }
]
```

### Deduplication Key Strategy

Entities are deduplicated using a composite key derived from name + location/category:

```python
def _get_dedup_key(entity: dict) -> str:
    """Generate a deterministic dedup key for an entity."""
    entity_type = entity.get("type", "unknown")

    if entity_type in ("hotel", "attraction", "restaurant"):
        # name + destination -> "hotel:sofitel-legend-metropole-hanoi:hanoi"
        name_slug = entity["name"].lower().replace(" ", "-")
        destination_slug = entity["destination"].lower().replace(" ", "-")
        return f"{entity_type}:{name_slug}:{destination_slug}"

    elif entity.get("nationality"):
        # Visa rules: "visa:us" or "visa:__phu_quoc__"
        code = entity["country_code"].lower()
        return f"visa:{code}"

    elif entity.get("region"):
        # Monsoon patterns: "monsoon:north"
        return f"monsoon:{entity['region'].lower()}"

    raise ValueError(f"Cannot generate dedup key for entity: {entity}")


def _build_embedding_text(entity: dict) -> str:
    """Build the text representation used for generating embeddings."""
    entity_type = entity.get("type", "unknown")

    if entity_type == "hotel":
        return (
            f"{entity['name']} - {entity['style']} hotel in {entity['destination']}, Vietnam. "
            f"{entity['description']} "
            f"Price: ${entity['price_per_night_usd']}/night. "
            f"Category: {entity['price_category']}. "
            f"Amenities: {', '.join(entity['amenities'])}. "
            f"Tags: {', '.join(entity['tags'])}."
        )

    elif entity_type == "attraction":
        return (
            f"{entity['name']} - {entity['category']} attraction in {entity['destination']}, Vietnam. "
            f"{entity['description']} "
            f"Duration: {entity['estimated_duration_hours']} hours. "
            f"Intensity: {entity['physical_intensity']}. "
            f"Tags: {', '.join(entity['tags'])}."
        )

    elif entity_type == "restaurant":
        return (
            f"{entity['name']} - {', '.join(entity['cuisine_type'])} restaurant in {entity['destination']}, Vietnam. "
            f"{entity['description']} "
            f"Price range: {entity['price_range_usd']}. "
            f"Atmosphere: {entity['atmosphere']}. "
            f"Tags: {', '.join(entity['tags'])}."
        )

    elif entity.get("nationality"):
        return (
            f"Vietnam visa rules for {entity['nationality']} citizens. "
            f"Visa type: {entity['visa_type']}. Max stay: {entity['max_stay_days']} days. "
            f"{entity.get('notes', '')}"
        )

    elif entity.get("region"):
        return (
            f"Vietnam monsoon and weather patterns for the {entity['region']} region. "
            f"Destinations: {', '.join(entity['destinations'])}. "
            f"{entity.get('notes', '')}"
        )

    return entity.get("description", entity.get("name", ""))
```

### Destination Entity Count Targets

| Destination | Hotels | Attractions | Restaurants | Total |
|---|---|---|---|---|
| Hanoi | 12 | 12 | 12 | 36 |
| Ho Chi Minh City | 12 | 12 | 12 | 36 |
| Da Nang | 10 | 10 | 10 | 30 |
| Phu Quoc | 10 | 10 | 10 | 30 |
| Sapa | 10 | 10 | 10 | 30 |
| Hoi An | 10 | 10 | 10 | 30 |
| Hue | 10 | 10 | 10 | 30 |
| Nha Trang | 10 | 10 | 10 | 30 |
| Da Lat | 10 | 10 | 10 | 30 |
| Mekong Delta | 10 | 10 | 10 | 30 |
| **Total** | **104** | **104** | **104** | **312** |

Major destinations (Hanoi, HCMC) get 12 each to reflect their larger tourism infrastructure. All other destinations get 10 each.

### Price Distribution Per Destination

Each destination should have a realistic mix:

| Category | Hotels | Price Range (USD/night) | Count per destination |
|---|---|---|---|
| Budget | Hostels, homestays, guesthouses | $8-30 | 3-4 |
| Mid-range | 3-star, boutique, business | $35-100 | 4-5 |
| Luxury | 4-5 star, resort, heritage | $120-500+ | 2-3 |

Note: Phu Quoc and Da Nang skew higher (resort destinations). Sapa and Mekong Delta skew lower (homestay-heavy). HCMC and Hanoi have the widest range.

### Visa Rule Nationality Coverage

| Category | Nationalities | Visa Type |
|---|---|---|
| 45-day visa-free | UK, France, Germany, Spain, Italy, Japan, South Korea, Denmark, Sweden, Norway, Finland, Russia, Belarus | visa-free-45 |
| 30-day ASEAN visa-free | Thailand, Malaysia, Singapore, Indonesia, Philippines, Myanmar, Laos, Cambodia, Brunei | visa-free-30 |
| E-visa required | US, Canada, Australia, India, China, Brazil, New Zealand, South Africa | e-visa |
| Special zone | Phu Quoc (all nationalities) | special-zone |
| **Total** | **31 rules** | |

### Region Mapping for Destinations

```python
DESTINATION_REGION_MAP = {
    "Hanoi": "north",
    "Sapa": "north",
    "Hue": "central",
    "Da Nang": "central",
    "Hoi An": "central",
    "Nha Trang": "south",      # Geographically south-central, but monsoon follows south pattern
    "Da Lat": "south",          # Central Highlands, but climate closer to south
    "Ho Chi Minh City": "south",
    "Phu Quoc": "south",
    "Mekong Delta": "south",
}
```

### Sample Entity Data Per Destination

Below is a partial list of real/realistic entities per destination to guide data creation. The implementing agent should expand these to meet the minimum count per destination.

**Hanoi (12 hotels, 12 attractions, 12 restaurants):**
- Hotels: Sofitel Legend Metropole, JW Marriott, Hilton Hanoi Opera, La Siesta Premium, Hanoi La Siesta Hotel & Spa, Old Quarter View Boutique, Hanoi Rocks Hostel, Nexy Hostel, The Chi Boutique, InterContinental Hanoi Westlake, Peridot Grand, Essence Hanoi
- Attractions: Ho Chi Minh Mausoleum, Temple of Literature, Hoan Kiem Lake, Old Quarter Walking Tour, Vietnam Museum of Ethnology, Ha Long Bay Day Trip, Train Street, Tran Quoc Pagoda, St. Joseph's Cathedral, Thang Long Water Puppet Theatre, Dong Xuan Market, West Lake
- Restaurants: Pho Thin, Bun Cha Huong Lien (Obama Bun Cha), La Badiane, Cha Ca La Vong, Maison Vie, Home Restaurant, Xoi Yen, Banh Mi 25, Green Tangerine, Quan An Ngon, Cong Caphe, KOTO

**Ho Chi Minh City (12 hotels, 12 attractions, 12 restaurants):**
- Hotels: Park Hyatt Saigon, Rex Hotel, Hotel des Arts Saigon, Liberty Central Riverside, The Reverie Saigon, Fusion Suites, Town House 23, The Common Room Project, Wink Hotel, Hotel Majestic, Silverland Yen, LOTTE Hotel Saigon
- Attractions: Cu Chi Tunnels, War Remnants Museum, Ben Thanh Market, Notre-Dame Cathedral Basilica, Central Post Office, Jade Emperor Pagoda, Saigon Opera House, Bitexco Financial Tower, Mekong Delta Day Trip, FITO Museum, Independence Palace, Saigon Zoo
- Restaurants: Cuc Gach Quan, Noir Dining in the Dark, Pho Hoa Pasteur, Secret Garden, Quan Bui, Pizza 4P's, Banh Mi Huynh Hoa, Ben Thanh Street Food Market, The Deck Saigon, Propaganda Bistro, Nha Hang Ngon, Snap Cafe

**Phu Quoc (10 hotels, 10 attractions, 10 restaurants):**
- Hotels: JW Marriott Phu Quoc, InterContinental Phu Quoc, La Veranda Resort, Salinda Resort, Vinpearl Resort, Mango Bay Resort, Peppercorn Beach Resort, Nine Hotel & Hostel, Cassia Cottage, Lahana Resort
- Attractions: Phu Quoc National Park, Sao Beach, An Thoi Islands Snorkeling, Phu Quoc Prison Museum, Dinh Cau Night Market, Suoi Tranh Waterfall, VinWonders Phu Quoc, Pepper Farm Tour, Bai Dai Beach, Fishing Village Tour
- Restaurants: Crab House, Sailing Club Phu Quoc, Pepper Tree Restaurant, The Spice House, Night Market Seafood Stalls, Ganesh Indian Restaurant, Mango Garden, Itaca Rooftop, Xin Chao, Rory's Beach Bar

### Script CLI Interface

```
usage: seed_vector_store.py [-h] [--type {hotels,attractions,restaurants,visa,monsoon,all}]
                            [--dry-run] [--force] [--seed-dir SEED_DIR]

Vietnam Seed Data Loader - Populates Qdrant with travel data

optional arguments:
  -h, --help            show this help message and exit
  --type TYPE           Entity type to load (default: all)
  --dry-run             Validate data without ingesting
  --force               Re-ingest all entities (overwrite existing)
  --seed-dir SEED_DIR   Path to seed data directory (default: data/seed/)
```

### Integration with docker-compose.full.yml

The seed script requires Qdrant to be running. It is designed to be executed after Phase 2 services are up:

```bash
# Start Phase 2 services
docker compose -f docker-compose.full.yml up -d

# Wait for Qdrant to be healthy
# Run seed script
python data/scripts/seed_vector_store.py

# Verify with dry-run
python data/scripts/seed_vector_store.py --dry-run
```

This should also be documented in the `Makefile`:

```makefile
seed: ## Load Vietnam seed data into Qdrant
	python data/scripts/seed_vector_store.py

seed-dry-run: ## Validate seed data without loading
	python data/scripts/seed_vector_store.py --dry-run
```

### Freshness Timestamps

All seed entities should be ingested with:
- `ingested_at`: current UTC timestamp at ingestion time
- `expires_at`: `ingested_at + 30 days` for descriptions, `ingested_at + 7 days` for prices

The seed script sets these automatically. Re-running the script with `--force` refreshes these timestamps.

### File Placement Summary

| File | Purpose |
|---|---|
| `data/seed/hotels.json` | 104 hotel entities across 10 destinations |
| `data/seed/attractions.json` | 104 attraction entities across 10 destinations |
| `data/seed/restaurants.json` | 104 restaurant entities across 10 destinations |
| `data/seed/visa_rules.json` | Visa rules for 31 nationality entries (incl. Phu Quoc special case) |
| `data/seed/monsoon_patterns.json` | Monthly climate data for 3 regions |
| `data/seed/README.md` | Documentation for seed data format, sources, and usage |
| `data/scripts/seed_vector_store.py` | Idempotent seed data loading script |

### Anti-Patterns -- DO NOT

- **DO NOT** import `qdrant_client` directly in the seed script. Use `VectorStoreProtocol` via `rag/vector_store.py`.
- **DO NOT** hallucinate fake coordinates. Use approximate real coordinates for real attractions and plausible coordinates within city bounds for realistic entities.
- **DO NOT** create entities without all required schema fields. Every entity must pass Pydantic validation.
- **DO NOT** mix entity types in a single JSON file. Hotels, attractions, and restaurants are separate files.
- **DO NOT** use stdlib `logging`. Use `structlog` only.
- **DO NOT** skip the Phu Quoc visa special case. This is the most important compliance test case in the system.
- **DO NOT** generate duplicate names within the same destination. Each entity must be unique.
- **DO NOT** create a single mega-JSON file. Keep entity types in separate files for maintainability.

### Testing Strategy

This story does not have traditional unit tests because the seed data JSON files are the primary artifact and the seed script uses existing tested infrastructure (ETL pipeline, deduplication, vector store). Validation is performed via:

1. **Schema validation**: The seed script validates all entities against Pydantic models before ingestion (part of `--dry-run`).
2. **Count verification**: The script logs entity counts per destination. The implementing agent should verify these match the targets in the Destination Entity Count Targets table.
3. **Idempotency test**: Run the script twice and verify no duplicates via Qdrant count query.
4. **Search verification**: After seeding, run sample queries via `rag/hybrid_search.py` to verify data is retrievable.

If the implementing agent determines that a dedicated test file is valuable, it should be placed at `data/scripts/tests/test_seed_data.py` and should validate JSON schema compliance and count targets without requiring Qdrant.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- Project Structure: data/seed/ and data/scripts/]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Data Architecture: Qdrant for Entity embeddings]
- [Source: _bmad-output/planning-artifacts/architecture.md -- ETL Flow: External APIs -> etl/*.py -> deduplication.py -> rag/vector_store.py -> Qdrant]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 2.6 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 2.5 regulatory data ingestion (visa rules, Phu Quoc special case)]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 4.3 monsoon patterns (seasonal feasibility data consumer)]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 4.1 visa compliance (visa rules data consumer)]
- [Source: _bmad-output/planning-artifacts/architecture.md -- AR-12: Seed data requirement]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Progressive Infrastructure: Phase 2 adds Qdrant + Redis]

## Dev Agent Record

### Agent Model Used

(To be filled by implementing agent)

### Debug Log References

(To be filled during implementation)

### Completion Notes List

(To be filled on completion)

### Change Log

- 2026-05-24: Story spec created -- ready-for-dev

### File List

(To be filled by implementing agent with all files created/modified)
