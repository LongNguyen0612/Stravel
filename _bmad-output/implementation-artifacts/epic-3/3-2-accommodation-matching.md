# Story 3.2: Accommodation Matching Agent

Status: draft

## Story

As a travel agent,
I want the system to search for and score accommodations that match my client's profile,
so that I can present a curated list of options with clear reasoning.

**Depends on:** Story 2.1 (Qdrant Vector Store Setup — provides `VectorStoreProtocol` implementation and `Entity` model), Story 2.3 (Hybrid Search — provides searchable hotel entities), Story 2.4 (Freshness Tracking — provides staleness checks), Story 3.1 (Budget Allocation — provides per-category budget splits including accommodation budget per night)

**FRs implemented:** FR-6 (Accommodation Matching — search Vector Store, scored comparison, zero hallucinated entities)
**FRs partially advanced:** FR-11 (Accommodation Comparison Table — matching produces the data; Story 3.6 formats the comparison table)
**NFRs enforced:** NFR-1 (Zero hallucination — all results from Vector Store only)

## Acceptance Criteria

### AC-1: Agent Module Structure
**Given** the accommodation matching module exists at `agents/calculation/`
**When** the module is inspected
**Then** it contains:
- `agents/calculation/accommodation.py` — accommodation matching and scoring logic
- `agents/calculation/schemas.py` — `AccommodationMatch`, `AccommodationSearchCriteria`, `AccommodationMatchResult`, and related Pydantic models (extend if file exists from Story 3.1)
- `agents/calculation/tests/test_accommodation.py` — unit tests

### AC-2: Vector Store Search via Protocol
**Given** a completed Traveler Profile with destination preferences
**When** the accommodation matching logic is invoked
**Then** the system searches the Vector Store using `VectorStoreProtocol.search()` via dependency injection
**And** the search query is constructed from the traveler's destination, style, and group size requirements
**And** the search filters include `entity_type: "hotel"` and the target `region`
**And** the implementation never imports a concrete Vector Store class — only the Protocol interface

### AC-3: Budget Filtering
**Given** a Traveler Profile with a budget per night (derived from total budget, trip duration, and budget allocation percentages)
**When** the Vector Store returns candidate hotels
**Then** hotels with pricing above the budget per night are excluded from the primary results
**And** if no hotels match within budget, the closest options above budget are returned with a `budget_warning: true` flag
**And** the budget warning includes the percentage over budget for each option (e.g., "15% over nightly budget")

### AC-4: Location Filtering
**Given** a Traveler Profile with one or more destination preferences (e.g., "Phu Quoc", "Hanoi", "Da Nang")
**When** accommodation matching runs
**Then** only hotels in the requested regions are returned
**And** if the profile specifies multiple destinations, matches are grouped by destination
**And** region matching is case-insensitive and handles common aliases (e.g., "HCMC" matches "Ho Chi Minh City", "Saigon" matches "Ho Chi Minh City")

### AC-5: Style Filtering
**Given** a Traveler Profile with an `accommodation_style` preference (e.g., "boutique", "resort", "hostel", "homestay", "luxury")
**When** accommodation matching runs
**Then** results are filtered or prioritized to match the stated style
**And** style matching checks the entity's `description` and `metadata_extra` fields for style indicators
**And** if no style preference is stated, no style filter is applied (all types returned)

### AC-6: Group Size Filtering
**Given** a Traveler Profile with `traveler_count` and `traveler_ages`
**When** accommodation matching runs
**Then** accommodations that cannot support the group size (based on `metadata_extra.max_guests` or `metadata_extra.room_types`) are excluded
**And** for families with children, properties flagged as "adults only" in metadata are excluded
**And** if group size data is unavailable in the entity metadata, the entity is included with a `group_size_unverified: true` flag

### AC-7: Accessibility Filtering
**Given** a Traveler Profile with `accessibility_needs` (e.g., "wheelchair", "elevator required", "ground floor")
**When** accommodation matching runs
**Then** only hotels with matching accessibility attributes in `metadata_extra.accessibility` are returned
**And** if the Vector Store has no accessibility data for a hotel, the hotel is excluded with a log entry (fail-safe — do not recommend unverified)
**And** if `accessibility_needs` is empty or None, no accessibility filter is applied

### AC-8: Scoring Algorithm — Price-to-Value Ratio
**Given** candidate hotels have passed all applicable filters
**When** scoring is computed
**Then** each hotel receives a composite score (0.0 to 1.0) based on:
- `price_score` (weight: 0.35) — lower price relative to budget yields higher score; exactly at budget = 0.8, 50% of budget = 1.0, at budget limit = 0.5
- `rating_score` (weight: 0.25) — normalized from entity `rating` field (assume 0-5 scale, map to 0-1)
- `style_match_score` (weight: 0.20) — 1.0 if style matches preference, 0.5 if neutral, 0.0 if mismatched
- `freshness_score` (weight: 0.10) — 1.0 if data is fresh (<7 days), linear decay to 0.0 at staleness threshold
- `location_score` (weight: 0.10) — 1.0 if exact region match, 0.5 if adjacent/nearby region
**And** results are sorted by composite score descending
**And** the scoring weights are defined as constants, not hard-coded in the formula

### AC-9: "Why It Fits" Explanation
**Given** a hotel has been scored and included in results
**When** the result is constructed
**Then** each result includes a `why_it_fits` string explaining in 1-2 sentences why this hotel matches the traveler
**And** the explanation references specific profile attributes (e.g., "Within your $80/night budget at $65/night. Boutique style matches your preference. Rated 4.5/5 with wheelchair access.")
**And** the explanation is generated from structured data, NOT from an LLM (no hallucination risk in explanations)

### AC-10: Result Envelope
**Given** accommodation matching has completed
**When** results are returned
**Then** each result includes: `entity_id`, `name`, `region`, `price_per_night`, `currency`, `rating`, `source_url`, `freshness_timestamp` (from `ingested_at`), `composite_score`, `score_breakdown` (dict of individual scores), `why_it_fits`, `budget_warning` (bool), `group_size_unverified` (bool)
**And** the overall result includes: `matches` (list), `search_criteria` (what was searched), `total_candidates` (pre-filter count), `total_matches` (post-filter count), `no_results_explanation` (if empty)

### AC-11: Zero Hallucinated Entities
**Given** accommodation matching has completed
**When** the result list is inspected
**Then** every entity in the result list has a valid `entity_id` that exists in the Vector Store
**And** every `name`, `price_per_night`, `rating`, and `source_url` is copied directly from the Vector Store entity — never generated or modified
**And** no entity is fabricated, interpolated, or synthesized by the matching logic

### AC-12: Zero Results — Honest Empty Response
**Given** the Vector Store returns zero results for the requested region, style, and budget combination
**When** accommodation matching completes
**Then** the system returns an empty `matches` list
**And** the `no_results_explanation` field provides a structured explanation (e.g., "No hotels found in Sapa within $40/night budget. Closest options in the region start at $55/night." or "No hotel data available for the Mekong Delta region.")
**And** the system does NOT hallucinate a list of hotels to fill the gap
**And** the system does NOT use an LLM to generate fictional alternatives

### AC-13: State Integration
**Given** accommodation matching has completed with results
**When** the results are written to `AdvisoryState`
**Then** results are stored in `AdvisoryState.calculations` under the key `accommodation_matches`
**And** the data is serializable (all Pydantic models, no raw objects)
**And** downstream agents (Proposal, Compliance) can read the matches from shared state

### AC-14: Unit Test Coverage
**Given** the test suite at `agents/calculation/tests/test_accommodation.py`
**When** tests are run with `pytest`
**Then** the following test cases pass:
- `test_exact_budget_match` — hotels at exactly the budget per night are included and scored appropriately
- `test_over_budget_filtering` — hotels above budget are excluded from primary results
- `test_over_budget_fallback` — when no in-budget hotels exist, closest over-budget options returned with warning
- `test_zero_results_returns_empty_with_explanation` — empty Vector Store response yields empty list and explanation, not hallucinated list
- `test_zero_results_explanation_content` — explanation references the actual search criteria (region, budget)
- `test_accessibility_filtering_includes` — hotel with matching accessibility attributes is included
- `test_accessibility_filtering_excludes` — hotel without matching accessibility attributes is excluded
- `test_accessibility_filtering_skipped_when_no_needs` — when profile has no accessibility needs, all hotels pass
- `test_group_size_filtering_excludes_too_small` — hotel with max_guests < traveler_count is excluded
- `test_group_size_filtering_adults_only` — adults-only hotel excluded when children present
- `test_group_size_unverified_flag` — hotel without group size metadata is included with flag
- `test_scoring_price_to_value` — cheaper hotel scores higher on price component
- `test_scoring_composite_ranking` — results are sorted by composite score
- `test_style_match_scoring` — matching style gets higher style_match_score than non-matching
- `test_why_it_fits_references_profile` — explanation string references actual budget, style, or accessibility
- `test_result_envelope_structure` — result contains all required fields
- `test_vector_store_protocol_used` — matching uses mock VectorStoreProtocol, no concrete imports
- `test_multi_destination_grouping` — multiple destinations produce grouped results
**And** all tests pass with a mock `VectorStoreProtocol` — no Qdrant required

## Tasks

- [ ] Task 1: Define Pydantic schemas (AC: #1, #10)
  - [ ] Create or extend `agents/calculation/schemas.py` with:
    - `AccommodationSearchCriteria` model: `destinations: list[str]`, `budget_per_night: float`, `currency: str`, `accommodation_style: str | None`, `group_size: int`, `has_children: bool`, `child_ages: list[int] | None`, `accessibility_needs: list[str] | None`
    - `ScoreBreakdown` model: `price_score: float`, `rating_score: float`, `style_match_score: float`, `freshness_score: float`, `location_score: float`, `composite_score: float`
    - `AccommodationMatch` model: `entity_id: str`, `name: str`, `region: str`, `price_per_night: float`, `currency: str`, `rating: float | None`, `source_url: str`, `freshness_timestamp: datetime`, `score_breakdown: ScoreBreakdown`, `composite_score: float`, `why_it_fits: str`, `budget_warning: bool`, `budget_warning_detail: str | None`, `group_size_unverified: bool`, `accessibility_verified: bool`
    - `AccommodationMatchResult` model: `matches: list[AccommodationMatch]`, `search_criteria: AccommodationSearchCriteria`, `total_candidates: int`, `total_matches: int`, `no_results_explanation: str | None`

- [ ] Task 2: Define scoring constants (AC: #8)
  - [ ] Add scoring weight constants to `agents/calculation/accommodation.py`:
    - `PRICE_WEIGHT = 0.35`
    - `RATING_WEIGHT = 0.25`
    - `STYLE_MATCH_WEIGHT = 0.20`
    - `FRESHNESS_WEIGHT = 0.10`
    - `LOCATION_WEIGHT = 0.10`
    - `FRESHNESS_THRESHOLD_DAYS = 7` (for hotel pricing data)
    - `REGION_ALIASES` dict mapping common aliases to canonical region names

- [ ] Task 3: Implement search criteria extraction (AC: #2, #3, #4, #5, #6, #7)
  - [ ] Implement `build_search_criteria(state: AdvisoryState) -> AccommodationSearchCriteria` in `accommodation.py`
  - [ ] Extract budget per night from `state.calculations["budget_allocation"]` accommodation percentage and trip duration
  - [ ] Extract destinations from `state.traveler_profile.destination_preferences`
  - [ ] Extract style from `state.traveler_profile.accommodation_style`
  - [ ] Extract group size from `state.traveler_profile.traveler_count`
  - [ ] Extract accessibility from `state.traveler_profile.accessibility_needs`
  - [ ] Determine `has_children` from `state.traveler_profile.traveler_ages` (any age < 18)

- [ ] Task 4: Implement Vector Store query construction (AC: #2, #4)
  - [ ] Implement `build_vector_store_query(criteria: AccommodationSearchCriteria) -> tuple[str, dict]` in `accommodation.py`
  - [ ] Build a natural language query string for semantic search (e.g., "hotels in Phu Quoc for family, boutique style")
  - [ ] Build metadata filters dict: `{"entity_type": "hotel", "region": region}`
  - [ ] Resolve region aliases before querying (e.g., "HCMC" -> "Ho Chi Minh City")
  - [ ] Query each destination separately to ensure coverage

- [ ] Task 5: Implement filtering pipeline (AC: #3, #5, #6, #7)
  - [ ] Implement `filter_candidates(candidates: list[dict], criteria: AccommodationSearchCriteria) -> tuple[list[dict], list[dict]]` in `accommodation.py`
  - [ ] Returns `(in_budget, over_budget)` tuples
  - [ ] Budget filter: compare `entity.pricing` against `criteria.budget_per_night`
  - [ ] Style filter: check `entity.description` and `entity.metadata_extra` for style keywords
  - [ ] Group size filter: check `entity.metadata_extra.max_guests` >= `criteria.group_size`; exclude `adults_only` when `criteria.has_children`
  - [ ] Accessibility filter: only apply when `criteria.accessibility_needs` is non-empty; check `entity.metadata_extra.accessibility` for matching attributes; exclude unverified entities when accessibility is required

- [ ] Task 6: Implement scoring algorithm (AC: #8)
  - [ ] Implement `score_accommodation(entity: dict, criteria: AccommodationSearchCriteria) -> ScoreBreakdown` in `accommodation.py`
  - [ ] `compute_price_score(price: float, budget: float) -> float`: ratio-based; at 50% of budget = 1.0, at 100% of budget = 0.5, at budget limit = 0.5; linear interpolation between points
  - [ ] `compute_rating_score(rating: float | None) -> float`: `rating / 5.0` if present, 0.5 default if None
  - [ ] `compute_style_match_score(entity: dict, preferred_style: str | None) -> float`: 1.0 for match, 0.5 for no preference, 0.0 for mismatch
  - [ ] `compute_freshness_score(ingested_at: datetime, threshold_days: int) -> float`: 1.0 if fresh, linear decay to 0.0 at threshold
  - [ ] `compute_location_score(entity_region: str, target_region: str) -> float`: 1.0 for exact match, 0.5 for adjacent
  - [ ] Composite: weighted sum of all individual scores

- [ ] Task 7: Implement "why it fits" explanation generator (AC: #9)
  - [ ] Implement `generate_why_it_fits(entity: dict, criteria: AccommodationSearchCriteria, score: ScoreBreakdown) -> str` in `accommodation.py`
  - [ ] Build explanation from structured data ONLY — no LLM calls
  - [ ] Include: price comparison to budget, style match, rating highlight, accessibility confirmation if relevant
  - [ ] Template: "{price_part}. {style_part}. {rating_part}. {accessibility_part}."
  - [ ] Example output: "At $65/night, well within your $80 budget. Boutique style matches your preference. Rated 4.5/5 with verified wheelchair access."

- [ ] Task 8: Implement main matching function (AC: #2, #10, #11, #12, #13)
  - [ ] Implement `async def match_accommodations(state: AdvisoryState, vector_store: VectorStoreProtocol) -> AccommodationMatchResult` in `accommodation.py`
  - [ ] Accept `VectorStoreProtocol` via function parameter (DI)
  - [ ] Call `build_search_criteria` to extract criteria from state
  - [ ] Query Vector Store per destination via Protocol
  - [ ] Apply filtering pipeline
  - [ ] Score and sort remaining candidates
  - [ ] Generate "why it fits" for each match
  - [ ] If zero results after filtering: attempt over-budget fallback (closest 3 options above budget)
  - [ ] If zero results from Vector Store entirely: return empty with `no_results_explanation`
  - [ ] Construct and return `AccommodationMatchResult`

- [ ] Task 9: Implement no-results explanation generator (AC: #12)
  - [ ] Implement `generate_no_results_explanation(criteria: AccommodationSearchCriteria, total_candidates: int, closest_price: float | None) -> str` in `accommodation.py`
  - [ ] If `total_candidates == 0`: "No hotel data available for {region}. The database may not cover this destination yet."
  - [ ] If candidates exist but none pass filters: "No hotels found in {region} within ${budget}/night budget. Closest options start at ${closest_price}/night."
  - [ ] If accessibility filtering removed all options: "No hotels in {region} with verified {accessibility_need} support. Consider contacting hotels directly to verify accessibility."

- [ ] Task 10: Integrate with calculation agent node (AC: #13)
  - [ ] In `agents/calculation/agent.py` (or create if not exists), call `match_accommodations` as part of the calculation stage
  - [ ] Store result in `AdvisoryState.calculations["accommodation_matches"]` as serialized dict
  - [ ] Ensure `VectorStoreProtocol` is injected via the orchestrator or DI container
  - [ ] Handle errors gracefully — append to `AdvisoryState.errors`, do not raise

- [ ] Task 11: Write unit tests (AC: #14)
  - [ ] Create `agents/calculation/tests/test_accommodation.py` with all 18 test cases listed in AC-14
  - [ ] Create a `MockVectorStore` class implementing `VectorStoreProtocol` that returns configurable entity lists
  - [ ] Create factory functions for test entities: `make_hotel_entity(name, region, pricing, rating, ...)` with sensible defaults
  - [ ] All tests use mock Vector Store and mock state — no Qdrant, no PostgreSQL required
  - [ ] Verify scoring math with exact expected values (not approximate)

## Dev Notes

### Critical Architecture Constraints

- **VectorStoreProtocol only**: Never `from app.rag.vector_store import QdrantVectorStore` or similar. The matching function receives a `VectorStoreProtocol` instance via parameter. This is how the system swaps between real Qdrant (integration) and mock (unit tests).
- **Zero hallucination is non-negotiable**: Every hotel name, price, rating, and URL in the results must be a direct copy from a Vector Store entity. The `why_it_fits` explanation is generated from structured data using string templates, never from an LLM. If the Vector Store has no data, return empty — never fabricate.
- **Pydantic BaseModel for all schemas**: All input/output models are Pydantic, not TypedDict (AR-5).
- **Errors in state, not exceptions**: If Vector Store search fails, append error to `AdvisoryState.errors` and return an empty result with explanation. Never raise inside the matching function.
- **Co-located tests**: Tests live at `agents/calculation/tests/`, not in a top-level `tests/` directory.
- **No cross-agent imports**: The accommodation matching reads from `AdvisoryState` only. It never imports from `agents/profiling/` or `agents/proposal/`.
- **No LLM usage in this story**: Unlike the Profiling Agent, accommodation matching is purely algorithmic. All scoring, filtering, and explanation generation use deterministic code. LLMs introduce hallucination risk for factual data — we avoid them entirely here.

### Scoring Algorithm — Detailed Design

The scoring system uses a weighted linear combination. Each sub-score is normalized to [0.0, 1.0] before weighting.

```python
# Scoring weight constants
PRICE_WEIGHT = 0.35
RATING_WEIGHT = 0.25
STYLE_MATCH_WEIGHT = 0.20
FRESHNESS_WEIGHT = 0.10
LOCATION_WEIGHT = 0.10

def compute_price_score(price: float, budget: float) -> float:
    """Score based on how far below budget the price is.

    - At 50% of budget: 1.0 (great deal)
    - At 80% of budget: 0.8 (good value)
    - At 100% of budget: 0.5 (at limit)
    - Above budget: 0.0 (excluded by filter, but used for fallback scoring)
    """
    if budget <= 0:
        return 0.0
    ratio = price / budget
    if ratio <= 0.5:
        return 1.0
    if ratio <= 1.0:
        # Linear interpolation: 0.5 ratio -> 1.0 score, 1.0 ratio -> 0.5 score
        return 1.0 - (ratio - 0.5) * 1.0  # 1.0 at 0.5, 0.5 at 1.0
    # Over budget (fallback only)
    return max(0.0, 0.5 - (ratio - 1.0) * 0.5)


def compute_rating_score(rating: float | None) -> float:
    """Normalize rating to 0-1 scale. Default 0.5 if no rating."""
    if rating is None:
        return 0.5
    return min(1.0, max(0.0, rating / 5.0))


def compute_style_match_score(
    entity_description: str,
    entity_metadata: dict | None,
    preferred_style: str | None,
) -> float:
    """Score style alignment. 1.0 match, 0.5 neutral, 0.0 mismatch."""
    if preferred_style is None:
        return 0.5  # No preference — neutral
    style_lower = preferred_style.lower()
    desc_lower = entity_description.lower()
    meta_style = (entity_metadata or {}).get("style", "").lower()

    if style_lower in desc_lower or style_lower in meta_style:
        return 1.0
    # Check for style conflicts (e.g., profile says "luxury", hotel is "hostel")
    STYLE_CONFLICTS = {
        "luxury": ["hostel", "dormitory", "budget"],
        "budget": ["luxury", "5-star", "premium"],
        "boutique": ["chain", "resort"],
    }
    conflicts = STYLE_CONFLICTS.get(style_lower, [])
    if any(c in desc_lower or c in meta_style for c in conflicts):
        return 0.0
    return 0.5  # No strong signal either way


def compute_freshness_score(ingested_at: datetime, threshold_days: int = 7) -> float:
    """1.0 if fresh, linear decay to 0.0 at threshold."""
    from datetime import datetime as dt
    age_days = (dt.utcnow() - ingested_at).days
    if age_days <= 0:
        return 1.0
    if age_days >= threshold_days:
        return 0.0
    return 1.0 - (age_days / threshold_days)


def compute_location_score(entity_region: str, target_region: str) -> float:
    """1.0 for exact match (after alias resolution), 0.5 for adjacent."""
    if normalize_region(entity_region) == normalize_region(target_region):
        return 1.0
    # Adjacent region check — Vietnam-specific proximity map
    if is_adjacent_region(entity_region, target_region):
        return 0.5
    return 0.0
```

### Region Alias Resolution

Vietnam destinations have common aliases that must resolve to canonical names:

```python
REGION_ALIASES = {
    "hcmc": "Ho Chi Minh City",
    "saigon": "Ho Chi Minh City",
    "ho chi minh": "Ho Chi Minh City",
    "phu quoc island": "Phu Quoc",
    "danang": "Da Nang",
    "da nang city": "Da Nang",
    "hoian": "Hoi An",
    "hoi an ancient town": "Hoi An",
    "sa pa": "Sapa",
    "dalat": "Da Lat",
    "nhatrang": "Nha Trang",
}

ADJACENT_REGIONS = {
    "Da Nang": ["Hoi An", "Hue"],
    "Hoi An": ["Da Nang", "Hue"],
    "Hue": ["Da Nang", "Hoi An"],
    "Hanoi": ["Sapa", "Ha Long"],
    "Sapa": ["Hanoi"],
    "Ha Long": ["Hanoi"],
    "Ho Chi Minh City": ["Mekong Delta"],
    "Mekong Delta": ["Ho Chi Minh City"],
}

def normalize_region(region: str) -> str:
    """Resolve region aliases to canonical name."""
    return REGION_ALIASES.get(region.lower().strip(), region.strip())

def is_adjacent_region(region_a: str, region_b: str) -> bool:
    """Check if two regions are adjacent in Vietnam."""
    a = normalize_region(region_a)
    b = normalize_region(region_b)
    return b in ADJACENT_REGIONS.get(a, [])
```

### "Why It Fits" Template Construction

The explanation is built from structured data using template parts. No LLM involvement.

```python
def generate_why_it_fits(
    entity: dict,
    criteria: AccommodationSearchCriteria,
    score: ScoreBreakdown,
) -> str:
    """Build a human-readable explanation from structured data only."""
    parts = []

    # Price part
    price = entity.get("pricing", 0)
    budget = criteria.budget_per_night
    if price <= budget:
        savings_pct = int((1 - price / budget) * 100) if budget > 0 else 0
        parts.append(f"At ${price:.0f}/night, {'right at' if savings_pct < 5 else f'{savings_pct}% under'} your ${budget:.0f} budget")
    else:
        over_pct = int((price / budget - 1) * 100) if budget > 0 else 0
        parts.append(f"At ${price:.0f}/night, {over_pct}% over your ${budget:.0f} budget")

    # Style part
    if criteria.accommodation_style:
        if score.style_match_score >= 0.8:
            parts.append(f"{criteria.accommodation_style.capitalize()} style matches your preference")
        elif score.style_match_score <= 0.2:
            parts.append(f"Style differs from your {criteria.accommodation_style} preference")

    # Rating part
    rating = entity.get("rating")
    if rating is not None:
        parts.append(f"Rated {rating:.1f}/5")

    # Accessibility part
    if criteria.accessibility_needs:
        accessibility = (entity.get("metadata_extra") or {}).get("accessibility", [])
        if accessibility:
            parts.append(f"Verified: {', '.join(criteria.accessibility_needs)}")

    return ". ".join(parts) + "." if parts else "Matches your search criteria."
```

### Mock Vector Store for Testing

Tests must not require Qdrant. Create a configurable mock:

```python
class MockVectorStore:
    """Mock Vector Store that returns predetermined entities for testing."""

    def __init__(self, entities: list[dict] | None = None):
        self._entities = entities or []

    async def search(self, query: str, filters: dict, limit: int = 10) -> list[dict]:
        results = self._entities
        # Apply basic filter matching for test realism
        if "entity_type" in filters:
            results = [e for e in results if e.get("entity_type") == filters["entity_type"]]
        if "region" in filters:
            results = [e for e in results if e.get("region") == filters["region"]]
        return results[:limit]

    async def get_by_id(self, entity_id: str) -> dict | None:
        for entity in self._entities:
            if str(entity.get("id")) == entity_id:
                return entity
        return None
```

### Test Entity Factory

```python
def make_hotel_entity(
    name: str = "Test Hotel",
    region: str = "Hanoi",
    pricing: float = 50.0,
    rating: float = 4.0,
    source_url: str = "https://example.com/hotel",
    style: str = "boutique",
    max_guests: int = 4,
    adults_only: bool = False,
    accessibility: list[str] | None = None,
    ingested_at: datetime | None = None,
) -> dict:
    """Create a test hotel entity with sensible defaults."""
    from datetime import datetime
    import uuid
    return {
        "id": str(uuid.uuid4()),
        "entity_type": "hotel",
        "name": name,
        "region": region,
        "description": f"A {style} hotel in {region}",
        "pricing": pricing,
        "pricing_currency": "USD",
        "rating": rating,
        "source_url": source_url,
        "ingested_at": ingested_at or datetime.utcnow(),
        "expires_at": None,
        "location_lat": 21.028511,
        "location_lng": 105.804817,
        "metadata_extra": {
            "style": style,
            "max_guests": max_guests,
            "adults_only": adults_only,
            "accessibility": accessibility or [],
            "room_types": ["double", "twin"],
        },
    }
```

### Budget Per Night Derivation

The accommodation matching agent needs a budget per night. This is derived from the Budget Allocation Agent output (Story 3.1):

```python
def derive_budget_per_night(state: AdvisoryState) -> float:
    """Extract accommodation budget per night from budget allocation results.

    Budget allocation stores percentage splits. Accommodation % * total budget / trip nights.
    """
    profile = state.traveler_profile
    calculations = state.calculations or {}
    budget_allocation = calculations.get("budget_allocation", {})

    total_budget = profile.budget_total or 0.0
    accommodation_pct = budget_allocation.get("accommodation_pct", 0.30)  # Default 30% if not calculated

    # Calculate trip duration
    if profile.travel_start_date and profile.travel_end_date:
        trip_nights = (profile.travel_end_date - profile.travel_start_date).days
    else:
        trip_nights = 7  # Default assumption if dates not set

    trip_nights = max(trip_nights, 1)  # Prevent division by zero
    accommodation_budget = total_budget * accommodation_pct
    return accommodation_budget / trip_nights
```

### Entity Metadata Schema Expectations

The matching logic depends on `metadata_extra` containing specific fields for hotels. These are populated by the ETL pipeline (Story 2.2). Expected schema:

```python
# Expected metadata_extra for hotel entities
{
    "style": "boutique" | "resort" | "hostel" | "homestay" | "luxury" | "business" | "chain",
    "max_guests": 4,          # Maximum guests per booking
    "adults_only": false,      # True if property does not accept children
    "room_types": ["double", "twin", "family", "suite"],
    "accessibility": ["wheelchair", "elevator", "ground_floor", "accessible_bathroom"],
    "amenities": ["pool", "spa", "gym", "restaurant", "wifi", "parking"],
    "star_rating": 4,          # Official star classification if available
    "check_in": "14:00",
    "check_out": "12:00",
}
```

If a field is missing from `metadata_extra`, the matching logic must handle `None` gracefully — never crash on missing metadata.

### File Placement Summary

| File | Purpose |
|---|---|
| `backend/app/agents/calculation/accommodation.py` | Core matching logic: search, filter, score, explain |
| `backend/app/agents/calculation/schemas.py` | `AccommodationSearchCriteria`, `ScoreBreakdown`, `AccommodationMatch`, `AccommodationMatchResult` (extend if exists from 3.1) |
| `backend/app/agents/calculation/tests/test_accommodation.py` | 18 unit tests covering all filtering, scoring, and edge cases |
| `backend/app/agents/calculation/agent.py` | Updated: call `match_accommodations` in calculation stage (create if not exists) |

### Anti-Patterns -- DO NOT

- **DO NOT** import `QdrantVectorStore` or any concrete Vector Store implementation. Use `VectorStoreProtocol` parameter only.
- **DO NOT** use an LLM to generate hotel names, descriptions, prices, ratings, or explanations. All data comes from Vector Store entities; all explanations come from string templates.
- **DO NOT** invent hotels when the Vector Store returns empty. Return empty list with structured explanation.
- **DO NOT** modify entity data from the Vector Store (e.g., rounding prices, editing names). Copy exactly as-is.
- **DO NOT** import from `agents/profiling/` or `agents/proposal/`. Read only from `AdvisoryState`.
- **DO NOT** use TypedDict. All models are Pydantic BaseModel.
- **DO NOT** raise exceptions inside the matching function. Append to `AdvisoryState.errors` and degrade gracefully.
- **DO NOT** create a `utils.py` file. All helper functions live in `accommodation.py` or dedicated purpose-named files.
- **DO NOT** hard-code scoring weights in the formula. Use named constants at module level.

### Testing Strategy

All tests use `MockVectorStore` with predetermined entity lists. Each test follows this pattern:

1. Create a list of test hotel entities using `make_hotel_entity()` factory
2. Create a `MockVectorStore` pre-loaded with those entities
3. Create a mock `AdvisoryState` with a configured `TravelerProfileResponse` and `calculations`
4. Call `match_accommodations(state, mock_vector_store)`
5. Assert on the returned `AccommodationMatchResult`: match count, scores, explanations, flags

**Specific test setup notes:**

- **Exact budget test**: Create hotels at $50, $75, $100 with budget=$100/night. All three should be included.
- **Over-budget test**: Create hotels at $120, $150, $200 with budget=$100/night. None in primary results.
- **Over-budget fallback test**: Same as above but no in-budget options exist. The 3 closest ($120, $150, $200) returned with warnings.
- **Zero results test**: Empty entity list in MockVectorStore. Verify empty matches, non-None explanation.
- **Accessibility test**: Create hotels with/without wheelchair accessibility. Profile needs wheelchair. Only accessible hotel returned.
- **Group size test**: Create hotel with max_guests=2, profile has 4 travelers. Hotel excluded.
- **Adults-only test**: Create adults-only hotel, profile has children (ages include < 18). Hotel excluded.
- **Scoring test**: Create two hotels at different prices. Verify cheaper one has higher price_score.
- **Multi-destination test**: Create hotels in Hanoi and Da Nang. Profile wants both. Results grouped by destination.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- agents/calculation/ structure, VectorStoreProtocol, naming conventions]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Zero-hallucination policy, retrieve-then-generate pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Protocol interface convention, DI patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Anti-patterns: no direct Vector Store imports, no LLM-generated entities]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 3, Story 3.2 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/epics.md -- FR-6 Accommodation Matching definition]
- [Source: _bmad-output/project-context.md -- SQLAlchemy async rules, testing rules, agent architecture constraints]
- [Source: backend/app/agents/protocols.py -- VectorStoreProtocol interface definition]
- [Source: backend/app/agents/state.py -- AdvisoryState with calculations dict]
- [Source: backend/app/models/entity.py -- Entity model with metadata_extra, pricing, rating fields]
- [Source: backend/app/schemas/profile.py -- TravelerProfileResponse with accessibility_needs, accommodation_style, traveler_count fields]

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
