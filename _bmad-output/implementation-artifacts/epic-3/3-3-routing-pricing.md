# Story 3.3: Multi-City Routing & Seasonal Pricing

Status: done

## Story

As a travel agent,
I want the system to optimize multi-city Vietnam itineraries and show pricing across date ranges,
so that my clients get efficient routes and the best value dates.

**Depends on:** Story 3.1 (Budget Allocation Agent -- provides `agents/calculation/budget.py`, `CalculationResults` pattern in `AdvisoryState.calculations`, unit test fixtures), Story 3.2 (Accommodation Matching Agent -- provides `agents/calculation/accommodation.py`, Vector Store search patterns)

**FRs implemented:** FR-7 (Multi-City Routing Optimization), FR-8 (Seasonal Price Analysis)

## Acceptance Criteria

### AC-1: Routing Module Structure
**Given** the routing module exists at `agents/calculation/routing.py`
**When** the module is inspected
**Then** it contains:
- `RouteOptimizer` class with `optimize(destinations, constraints) -> OptimizedRoute` method
- Vietnam transport network graph as structured data (not LLM-generated)
- Transport mode options per city pair: flight, train, bus (where applicable)
- Estimated cost and duration per leg per transport mode

### AC-2: Optimized Visit Sequence
**Given** a Traveler Profile with multiple Vietnam destinations (e.g., Hanoi, Sapa, Da Nang, Hoi An, Phu Quoc)
**When** `agents/calculation/routing.py` runs routing optimization
**Then** the system returns an optimized visit sequence that minimizes total travel time and cost
**And** each leg includes: origin, destination, available transport modes, estimated cost per mode (USD), estimated duration per mode
**And** the recommended sequence accounts for geographic proximity (e.g., Hanoi before Sapa, Da Nang before Hoi An)

### AC-3: Real Transit Constraints
**Given** a destination list that includes city pairs without direct connections
**When** routing optimization runs for e.g., Sapa to Phu Quoc
**Then** the system correctly identifies that no direct transport exists
**And** the system inserts required connection points (e.g., Sapa -> Hanoi -> Phu Quoc)
**And** the connection leg costs and durations are included in the total
**And** connection requirements are documented in the route output with explanation

### AC-4: Single Destination Graceful Skip
**Given** a Traveler Profile with only one destination (e.g., just "Phu Quoc")
**When** routing optimization is invoked
**Then** routing optimization is skipped gracefully
**And** the result indicates no routing needed with a clear message (e.g., "Single destination -- no inter-city routing required")
**And** no error is appended to `AdvisoryState.errors`
**And** the calculation pipeline continues to the next step without interruption

### AC-5: Pricing Module Structure
**Given** the pricing module exists at `agents/calculation/pricing.py`
**When** the module is inspected
**Then** it contains:
- `SeasonalPricingAnalyzer` class with `analyze(destinations, date_range) -> SeasonalPriceReport` method
- Vietnam seasonal pricing reference data covering peak, shoulder, and low seasons
- Peak season definitions for: Tet holiday (variable date, Jan/Feb), Christmas/New Year (Dec 20 - Jan 5), summer (Jun-Aug for domestic tourism)
- Shoulder season definitions for transition periods

### AC-6: Seasonal Price Comparison
**Given** a Traveler Profile with destinations and a flexible date window (e.g., "anytime November to February")
**When** `agents/calculation/pricing.py` runs seasonal price analysis
**Then** the system returns a week-by-week price comparison across the date window
**And** each week shows a relative price index (e.g., 1.0 = baseline, 1.5 = 50% above baseline)
**And** peak seasons are flagged with: season name, price multiplier, reason (e.g., "Tet holiday -- domestic travel surge")
**And** shoulder seasons are flagged as potential value periods with savings estimate

### AC-7: Tet Holiday Pricing
**Given** a date range that spans Tet holiday (Vietnamese Lunar New Year, typically late January to mid-February)
**When** seasonal price analysis runs
**Then** the Tet period is identified as the highest peak season
**And** the price multiplier reflects 1.5x-2.5x baseline depending on destination (higher for domestic tourism hotspots like Da Lat, Nha Trang, Phu Quoc)
**And** the analysis warns about: limited availability, higher domestic flight prices, some businesses closed during Tet week
**And** the Tet date is calculated correctly for the travel year (Lunar calendar)

### AC-8: Christmas/New Year Pricing
**Given** a date range that includes December 20 through January 5
**When** seasonal price analysis runs
**Then** the Christmas/New Year period is flagged as peak season for international tourism
**And** the price multiplier reflects 1.3x-1.8x baseline (lower than Tet, focused on international tourist areas)
**And** affected destinations are identified (Phu Quoc, Hoi An, Da Nang, Nha Trang have higher impact; Sapa, Mekong Delta less affected)

### AC-9: Fixed Date Handling
**Given** a Traveler Profile with specific fixed dates (e.g., "December 15 to December 28")
**When** seasonal price analysis runs
**Then** the analysis returns pricing for the specified period only (no week-by-week comparison needed)
**And** any peak/shoulder flags that apply to the fixed dates are included
**And** the result includes a note about whether shifting dates by 1-2 weeks would yield savings

### AC-10: Results Written to AdvisoryState
**Given** routing and pricing calculations have completed
**When** the results are finalized
**Then** routing results are written to `AdvisoryState.calculations` under a `routing` key
**And** pricing results are written to `AdvisoryState.calculations` under a `seasonal_pricing` key
**And** the calculation pipeline does not overwrite results from Story 3.1 (budget allocation) or Story 3.2 (accommodation matching)

### AC-11: Unit Test Coverage
**Given** the test suite at `agents/calculation/tests/test_routing.py` and `agents/calculation/tests/test_pricing.py`
**When** tests are run with `pytest`
**Then** the following test cases pass:
- Multi-city routing produces optimized sequence (3+ destinations)
- Sapa-to-Phu-Quoc requires Hanoi connection
- Single destination returns graceful skip
- Two destinations returns simple A-to-B route
- Tet holiday correctly flagged with high multiplier
- Christmas/New Year correctly flagged with moderate multiplier
- Shoulder season identified between peak periods
- Fixed dates return single-period analysis
- Flexible dates return week-by-week comparison
- All tests pass without LLM, Qdrant, or Redis -- pure calculation logic

## Tasks

- [ ] Task 1: Define Pydantic schemas for routing and pricing (AC: #1, #5)
  - [ ] Create `agents/calculation/schemas.py` additions (or extend existing) with:
    - `TransportMode` enum: `FLIGHT`, `TRAIN`, `BUS`
    - `TransportOption` model: `mode: TransportMode`, `estimated_cost_usd: float`, `estimated_duration_hours: float`, `notes: str | None` (e.g., "overnight sleeper train")
    - `RouteLeg` model: `origin: str`, `destination: str`, `transport_options: list[TransportOption]`, `recommended_mode: TransportMode`, `is_connection: bool` (True if this leg was inserted as a required connection), `connection_reason: str | None`
    - `OptimizedRoute` model: `legs: list[RouteLeg]`, `total_estimated_cost_usd: float`, `total_estimated_hours: float`, `visit_sequence: list[str]`, `optimization_notes: list[str]`
    - `SingleDestinationResult` model: `destination: str`, `message: str` (graceful skip message)
    - `RoutingResult` model: union/discriminated type of `OptimizedRoute | SingleDestinationResult`
    - `SeasonLabel` enum: `PEAK`, `SHOULDER`, `LOW`
    - `SeasonalFlag` model: `season: SeasonLabel`, `name: str`, `price_multiplier: float`, `reason: str`, `affected_destinations: list[str]`
    - `WeeklyPricePoint` model: `week_start: date`, `week_end: date`, `relative_price_index: float`, `flags: list[SeasonalFlag]`
    - `SeasonalPriceReport` model: `date_range_start: date`, `date_range_end: date`, `weekly_prices: list[WeeklyPricePoint]`, `cheapest_week: date | None`, `most_expensive_week: date | None`, `savings_vs_peak_percent: float | None`, `recommendations: list[str]`

- [ ] Task 2: Build Vietnam transport network data (AC: #1, #2, #3)
  - [ ] Create `agents/calculation/vietnam_transport.py` with:
    - `VIETNAM_DESTINATIONS` list: Hanoi, HCMC (Ho Chi Minh City), Da Nang, Hoi An, Hue, Nha Trang, Phu Quoc, Sapa, Da Lat, Mekong Delta (Can Tho)
    - `TRANSPORT_NETWORK` dict-of-dicts adjacency structure mapping city pairs to available transport modes with cost and duration estimates
    - Flight routes: Hanoi<->HCMC, Hanoi<->Da Nang, Hanoi<->Phu Quoc, Hanoi<->Nha Trang, Hanoi<->Da Lat, HCMC<->Da Nang, HCMC<->Phu Quoc, HCMC<->Nha Trang, HCMC<->Da Lat, Da Nang<->HCMC
    - Train routes: Hanoi<->Hue, Hue<->Da Nang, Da Nang<->Nha Trang, Nha Trang<->HCMC (Reunification Express segments)
    - Bus routes: Hanoi<->Sapa, Da Nang<->Hoi An, HCMC<->Mekong Delta, HCMC<->Da Lat, Nha Trang<->Da Lat
    - `REQUIRED_CONNECTIONS` dict mapping impossible direct routes to their required waypoints: e.g., `("Sapa", "Phu Quoc"): ["Hanoi"]`, `("Sapa", "Da Nang"): ["Hanoi"]`, `("Sapa", "HCMC"): ["Hanoi"]`, `("Mekong Delta", "Da Nang"): ["HCMC"]`, `("Hoi An", "Phu Quoc"): ["Da Nang"]` or `["HCMC"]`
    - All costs in USD, durations in hours
    - Reference price ranges (budget estimates, not live data):
      - Domestic flights: $30-80 one-way
      - Train (sleeper): $15-45 depending on distance and class
      - Bus: $8-25 depending on distance
    - Source comments documenting that these are 2024-2025 reference estimates

- [ ] Task 3: Implement route optimizer (AC: #2, #3, #4)
  - [ ] Create `agents/calculation/routing.py` with `RouteOptimizer` class:
    - `__init__(self, transport_network, required_connections)` -- injectable for testing
    - `optimize(self, destinations: list[str], constraints: dict | None = None) -> RoutingResult`
    - If `len(destinations) <= 1`: return `SingleDestinationResult` immediately
    - If `len(destinations) == 2`: return simple A-to-B route with all transport options
    - If `len(destinations) >= 3`: run nearest-neighbor heuristic on geographic distance/travel-time to determine visit order
    - For each consecutive pair in the optimized sequence, check `REQUIRED_CONNECTIONS`; if a connection is required, insert the waypoint and split into two legs
    - For each leg, look up available transport options from `TRANSPORT_NETWORK`
    - Calculate `total_estimated_cost_usd` using the cheapest mode per leg
    - Calculate `total_estimated_hours` using the fastest mode per leg
    - Populate `optimization_notes` with explanations (e.g., "Reordered Sapa before Da Nang to avoid backtracking to Hanoi", "Inserted Hanoi connection between Sapa and Phu Quoc -- no direct route")
  - [ ] Implement `_nearest_neighbor_order(self, destinations: list[str]) -> list[str]` helper
    - Use a simple travel-time-based nearest-neighbor algorithm
    - Start from the first destination in the list (or northernmost if no preference)
    - At each step, pick the unvisited destination with the shortest travel time from the current position
  - [ ] Implement `_resolve_connections(self, sequence: list[str]) -> list[str]` helper
    - Walk the sequence pair-by-pair
    - For each pair, check if a required connection exists
    - Insert connection waypoints into the sequence
    - Handle transitive connections (A->B requires C, C->B requires D)
  - [ ] Implement `_build_legs(self, sequence: list[str]) -> list[RouteLeg]` helper
    - For each consecutive pair, look up transport options
    - Mark inserted connection legs with `is_connection=True`
    - If a city pair has no entry in `TRANSPORT_NETWORK`, raise a clear error identifying the missing route

- [ ] Task 4: Build Vietnam seasonal pricing data (AC: #5, #7, #8)
  - [ ] Create `agents/calculation/vietnam_seasons.py` with:
    - `TET_DATES` dict mapping years to (start_date, end_date) for Tet holiday: 2026: (Jan 17 - Jan 25), 2027: (Feb 6 - Feb 14), 2028: (Jan 26 - Feb 3) -- Lunar calendar dates
    - `CHRISTMAS_NEW_YEAR` constant: (Dec 20, Jan 5) -- fixed annually
    - `SUMMER_DOMESTIC` constant: (Jun 1, Aug 31) -- Vietnamese domestic tourism peak
    - `PEAK_SEASONS` list of dicts: `{"name": "Tet Holiday", "get_dates": callable, "multiplier_range": (1.5, 2.5), "reason": "...", "high_impact_destinations": [...]}`, similar for Christmas/New Year and Summer
    - `SHOULDER_SEASONS` definition: 2-3 weeks before/after each peak period
    - `DESTINATION_SEASONALITY` dict mapping each destination to its seasonal price modifiers:
      - Phu Quoc: highest Tet impact (2.5x), high Christmas (1.8x), dry season premium Nov-Mar
      - Da Lat: high Tet (2.0x), moderate Christmas (1.3x), summer domestic peak (1.5x)
      - Sapa: moderate Tet (1.5x), low Christmas (1.2x), trekking season Sep-Nov premium
      - Hanoi: moderate Tet (1.8x -- city empties but airport expensive), low Christmas (1.2x)
      - HCMC: moderate Tet (1.5x), moderate Christmas (1.4x)
      - Da Nang/Hoi An: high Christmas (1.8x -- beach season), low Tet (1.3x)
      - Nha Trang: high Tet (2.0x), high Christmas (1.7x)
      - Mekong Delta: low all seasons (1.1x-1.3x)
    - Source comments documenting these as reference estimates

- [ ] Task 5: Implement seasonal pricing analyzer (AC: #6, #7, #8, #9)
  - [ ] Create `agents/calculation/pricing.py` with `SeasonalPricingAnalyzer` class:
    - `__init__(self, seasonal_data, destination_seasonality)` -- injectable for testing
    - `analyze(self, destinations: list[str], date_range_start: date, date_range_end: date, is_flexible: bool = True) -> SeasonalPriceReport`
    - If `is_flexible` and date range spans more than 2 weeks: generate week-by-week `WeeklyPricePoint` entries
    - If not flexible (fixed dates): generate a single-period analysis for the exact date range
    - For each week/period, calculate `relative_price_index` as the weighted average of all destination multipliers for that period
    - Identify and attach `SeasonalFlag` entries for any peak/shoulder season overlaps
    - Calculate `cheapest_week` and `most_expensive_week` from the weekly data
    - Calculate `savings_vs_peak_percent` comparing cheapest to most expensive
    - Generate `recommendations` list with actionable advice (e.g., "Traveling 2 weeks after Tet saves approximately 40%", "Christmas week in Phu Quoc is 1.8x baseline -- consider Dec 5-15 for similar weather at lower cost")
  - [ ] Implement `_get_tet_dates(self, year: int) -> tuple[date, date]` helper
    - Look up pre-computed Tet dates for the year
    - If year not in lookup table, return None and flag as "Tet dates unknown for this year"
  - [ ] Implement `_calculate_period_index(self, destinations: list[str], period_start: date, period_end: date) -> tuple[float, list[SeasonalFlag]]` helper
    - Check each peak/shoulder season definition against the period
    - For each destination, look up its seasonal modifier
    - Average across destinations for the composite index
    - Collect all matching seasonal flags
  - [ ] Implement `_generate_shift_recommendation(self, fixed_start: date, fixed_end: date, destinations: list[str]) -> str | None` helper
    - For fixed-date requests, check if shifting 1-2 weeks earlier or later would reduce cost
    - Return recommendation text if savings > 10%, otherwise None

- [ ] Task 6: Integrate with calculation agent (AC: #10)
  - [ ] Update `agents/calculation/agent.py` to invoke `RouteOptimizer` and `SeasonalPricingAnalyzer` during the calculation stage
  - [ ] Read destinations from `AdvisoryState.traveler_profile.destination_preferences`
  - [ ] Read dates from `AdvisoryState.traveler_profile.travel_start_date`, `travel_end_date`, `date_flexibility`
  - [ ] Write routing results to `AdvisoryState.calculations["routing"]`
  - [ ] Write pricing results to `AdvisoryState.calculations["seasonal_pricing"]`
  - [ ] Preserve existing keys in `calculations` dict (budget, accommodation from Stories 3.1, 3.2)
  - [ ] Append errors to `AdvisoryState.errors` on failure, do not raise exceptions
  - [ ] Log all calculations with structlog including `session_id`, `tenant_id`, `agent_name="calculation"`, destination count, date range

- [ ] Task 7: Write unit tests for routing (AC: #11)
  - [ ] Create `agents/calculation/tests/test_routing.py` with:
    - `test_multi_city_optimized_sequence` -- 4+ destinations returns reordered sequence with legs
    - `test_sapa_to_phu_quoc_requires_hanoi` -- verifies Hanoi connection inserted, `is_connection=True`, connection reason populated
    - `test_single_destination_graceful_skip` -- returns `SingleDestinationResult`, no errors
    - `test_two_destinations_simple_route` -- returns single leg with transport options
    - `test_unknown_destination_raises_error` -- destination not in network returns clear error
    - `test_all_legs_have_transport_options` -- no empty transport_options lists
    - `test_total_cost_calculation` -- total equals sum of cheapest modes
    - `test_total_duration_calculation` -- total equals sum of fastest modes
    - `test_optimization_notes_populated` -- notes explain reordering and connections
  - [ ] All tests use the built-in transport network data (no external dependencies)
  - [ ] All tests run without LLM, Qdrant, or Redis

- [ ] Task 8: Write unit tests for pricing (AC: #11)
  - [ ] Create `agents/calculation/tests/test_pricing.py` with:
    - `test_tet_holiday_peak_flagged` -- date range spanning Tet shows peak flag with multiplier >= 1.5
    - `test_christmas_peak_flagged` -- date range spanning Christmas shows peak flag with multiplier >= 1.3
    - `test_shoulder_season_identified` -- weeks adjacent to peak show shoulder flag
    - `test_fixed_dates_single_period` -- non-flexible dates return single analysis, no week-by-week
    - `test_flexible_dates_weekly_comparison` -- flexible date range returns weekly price points
    - `test_cheapest_and_most_expensive_identified` -- report correctly identifies min/max weeks
    - `test_savings_percentage_calculated` -- savings_vs_peak_percent is correct
    - `test_recommendations_generated` -- non-empty recommendations list for flexible dates
    - `test_shift_recommendation_for_peak_fixed_dates` -- fixed dates during peak include shift suggestion
    - `test_destination_specific_multipliers` -- Phu Quoc Tet multiplier > Mekong Delta Tet multiplier
    - `test_tet_date_lookup_by_year` -- correct Tet dates returned for 2026, 2027
    - `test_unknown_year_tet_handled` -- year not in lookup returns graceful result, not crash
  - [ ] All tests use the built-in seasonal data (no external dependencies)
  - [ ] All tests run without LLM, Qdrant, or Redis

## Dev Notes

### Critical Architecture Constraints

- **Pure calculation -- no LLM required.** Routing and pricing are deterministic algorithms operating on reference data. They do NOT call the LLM. This is intentional -- these calculations must be reproducible and testable without an inference backend.
- **No Vector Store dependency.** Transport network data and seasonal pricing data are embedded in Python modules as constants. They are NOT retrieved from Qdrant. This data is structural/reference, not entity data.
- **Pydantic BaseModel for all schemas.** All data models use Pydantic BaseModel, not TypedDict (AR-5).
- **Errors in state, not exceptions.** If routing fails (e.g., unknown destination), append to `AdvisoryState.errors` and return a partial result. Never raise inside the calculation pipeline.
- **Co-located tests.** Tests live at `agents/calculation/tests/`, not in a top-level `tests/` directory.
- **No cross-agent imports.** Routing and pricing read from `AdvisoryState` only. They never import from `agents/profiling/` or `agents/proposal/`.
- **Preserve existing calculations.** Stories 3.1 and 3.2 write `budget` and `accommodation` keys to `AdvisoryState.calculations`. This story adds `routing` and `seasonal_pricing` keys. Merging must not overwrite existing keys.

### Vietnam Transport Network Reference Data

The transport network is a weighted adjacency graph. Each edge has one or more transport modes with cost and duration. Here is the reference structure:

```python
VIETNAM_DESTINATIONS = [
    "Hanoi", "HCMC", "Da Nang", "Hoi An", "Hue",
    "Nha Trang", "Phu Quoc", "Sapa", "Da Lat",
    "Mekong Delta",  # Can Tho as gateway
]

# Geographic coordinates for nearest-neighbor ordering (approximate)
DESTINATION_COORDS = {
    "Hanoi": (21.03, 105.85),
    "Sapa": (22.34, 103.84),
    "Hue": (16.46, 107.60),
    "Da Nang": (16.05, 108.22),
    "Hoi An": (15.88, 108.33),
    "Nha Trang": (12.24, 109.19),
    "Da Lat": (11.94, 108.44),
    "HCMC": (10.82, 106.63),
    "Phu Quoc": (10.23, 103.97),
    "Mekong Delta": (10.04, 105.79),
}

# Adjacency structure: (origin, destination) -> list of TransportOption
# Costs in USD, durations in hours -- 2024-2025 reference estimates
TRANSPORT_NETWORK = {
    # === FLIGHTS ===
    ("Hanoi", "HCMC"): [
        TransportOption(mode=TransportMode.FLIGHT, estimated_cost_usd=55, estimated_duration_hours=2.2, notes="Multiple daily flights, VietJet/Bamboo/VNA"),
        TransportOption(mode=TransportMode.TRAIN, estimated_cost_usd=35, estimated_duration_hours=33, notes="Reunification Express, 4-berth sleeper"),
    ],
    ("Hanoi", "Da Nang"): [
        TransportOption(mode=TransportMode.FLIGHT, estimated_cost_usd=40, estimated_duration_hours=1.3, notes="Multiple daily flights"),
        TransportOption(mode=TransportMode.TRAIN, estimated_cost_usd=25, estimated_duration_hours=17, notes="Overnight sleeper, scenic route"),
    ],
    ("Hanoi", "Phu Quoc"): [
        TransportOption(mode=TransportMode.FLIGHT, estimated_cost_usd=65, estimated_duration_hours=2.5, notes="Direct flights available"),
    ],
    ("Hanoi", "Nha Trang"): [
        TransportOption(mode=TransportMode.FLIGHT, estimated_cost_usd=50, estimated_duration_hours=2.0, notes=None),
    ],
    ("Hanoi", "Da Lat"): [
        TransportOption(mode=TransportMode.FLIGHT, estimated_cost_usd=50, estimated_duration_hours=2.0, notes=None),
    ],
    ("Hanoi", "Sapa"): [
        TransportOption(mode=TransportMode.BUS, estimated_cost_usd=15, estimated_duration_hours=5.5, notes="Luxury sleeper bus, highway route"),
    ],
    ("HCMC", "Da Nang"): [
        TransportOption(mode=TransportMode.FLIGHT, estimated_cost_usd=40, estimated_duration_hours=1.3, notes=None),
        TransportOption(mode=TransportMode.TRAIN, estimated_cost_usd=30, estimated_duration_hours=18, notes="Overnight sleeper"),
    ],
    ("HCMC", "Phu Quoc"): [
        TransportOption(mode=TransportMode.FLIGHT, estimated_cost_usd=35, estimated_duration_hours=1.0, notes="Frequent daily flights, shortest domestic route"),
    ],
    ("HCMC", "Nha Trang"): [
        TransportOption(mode=TransportMode.FLIGHT, estimated_cost_usd=35, estimated_duration_hours=1.0, notes=None),
        TransportOption(mode=TransportMode.TRAIN, estimated_cost_usd=20, estimated_duration_hours=8, notes="Daytime or overnight"),
        TransportOption(mode=TransportMode.BUS, estimated_cost_usd=12, estimated_duration_hours=9, notes="Sleeper bus"),
    ],
    ("HCMC", "Da Lat"): [
        TransportOption(mode=TransportMode.FLIGHT, estimated_cost_usd=35, estimated_duration_hours=0.8, notes=None),
        TransportOption(mode=TransportMode.BUS, estimated_cost_usd=10, estimated_duration_hours=7, notes="Scenic mountain road"),
    ],
    ("HCMC", "Mekong Delta"): [
        TransportOption(mode=TransportMode.BUS, estimated_cost_usd=8, estimated_duration_hours=3.5, notes="To Can Tho, frequent departures"),
    ],
    # === TRAIN (Reunification Express segments) ===
    ("Hue", "Da Nang"): [
        TransportOption(mode=TransportMode.TRAIN, estimated_cost_usd=8, estimated_duration_hours=2.5, notes="Scenic Hai Van Pass route"),
        TransportOption(mode=TransportMode.BUS, estimated_cost_usd=6, estimated_duration_hours=3, notes=None),
    ],
    ("Da Nang", "Nha Trang"): [
        TransportOption(mode=TransportMode.TRAIN, estimated_cost_usd=20, estimated_duration_hours=10, notes="Daytime coastal scenery"),
        TransportOption(mode=TransportMode.FLIGHT, estimated_cost_usd=35, estimated_duration_hours=1.2, notes=None),
    ],
    ("Nha Trang", "HCMC"): [
        TransportOption(mode=TransportMode.TRAIN, estimated_cost_usd=20, estimated_duration_hours=8, notes=None),
        TransportOption(mode=TransportMode.FLIGHT, estimated_cost_usd=35, estimated_duration_hours=1.0, notes=None),
    ],
    # === BUS-ONLY ROUTES ===
    ("Da Nang", "Hoi An"): [
        TransportOption(mode=TransportMode.BUS, estimated_cost_usd=3, estimated_duration_hours=0.7, notes="Local bus or taxi, very short distance"),
    ],
    ("Nha Trang", "Da Lat"): [
        TransportOption(mode=TransportMode.BUS, estimated_cost_usd=10, estimated_duration_hours=4, notes="Mountain road, scenic"),
    ],
}

# Routes that require connections -- no direct transport exists
REQUIRED_CONNECTIONS = {
    ("Sapa", "Phu Quoc"): ["Hanoi"],
    ("Sapa", "HCMC"): ["Hanoi"],
    ("Sapa", "Da Nang"): ["Hanoi"],
    ("Sapa", "Hoi An"): ["Hanoi"],
    ("Sapa", "Hue"): ["Hanoi"],
    ("Sapa", "Nha Trang"): ["Hanoi"],
    ("Sapa", "Da Lat"): ["Hanoi"],
    ("Sapa", "Mekong Delta"): ["Hanoi"],
    ("Mekong Delta", "Da Nang"): ["HCMC"],
    ("Mekong Delta", "Hue"): ["HCMC"],
    ("Mekong Delta", "Hanoi"): ["HCMC"],
    ("Mekong Delta", "Sapa"): ["HCMC", "Hanoi"],
    ("Mekong Delta", "Nha Trang"): ["HCMC"],
    ("Mekong Delta", "Phu Quoc"): ["HCMC"],
    ("Hoi An", "Phu Quoc"): ["Da Nang"],
    ("Hoi An", "Hanoi"): ["Da Nang"],
    ("Hoi An", "HCMC"): ["Da Nang"],
    ("Hoi An", "Nha Trang"): ["Da Nang"],
    ("Hoi An", "Sapa"): ["Da Nang", "Hanoi"],
    ("Phu Quoc", "Da Nang"): ["HCMC"],
    ("Phu Quoc", "Hue"): ["HCMC"],
    ("Phu Quoc", "Sapa"): ["HCMC", "Hanoi"],
    ("Phu Quoc", "Hoi An"): ["HCMC", "Da Nang"],
    ("Da Lat", "Hanoi"): ["HCMC"],
    ("Da Lat", "Da Nang"): ["HCMC"],
    ("Da Lat", "Hoi An"): ["HCMC", "Da Nang"],
    ("Da Lat", "Sapa"): ["HCMC", "Hanoi"],
    ("Da Lat", "Phu Quoc"): ["HCMC"],
}
```

**Note on bidirectionality:** The `TRANSPORT_NETWORK` stores one direction per pair. The `RouteOptimizer` should check both `(A, B)` and `(B, A)` when looking up routes. Costs and durations are approximately symmetric for Vietnam domestic transport.

### Routing Algorithm Design

The route optimizer uses a **nearest-neighbor heuristic** rather than solving TSP exactly. This is appropriate because:
1. Vietnam destinations typically number 3-7 per trip (small n)
2. The transport network has real geographic constraints (linear north-south layout)
3. Connection requirements make pure distance optimization insufficient
4. An exact TSP solver is unnecessary complexity for this problem size

**Algorithm steps:**
```
1. Input: list of destinations
2. If len <= 1: return SingleDestinationResult
3. If len == 2: return single leg
4. Start from the northernmost destination (convention: geographic ordering)
5. Nearest-neighbor: at each step, pick the unvisited destination with lowest travel time from current position
6. Resolve connections: walk the sequence, insert required waypoints
7. Build legs: for each consecutive pair, look up transport options
8. Calculate totals: sum cheapest costs, sum fastest durations
9. Generate notes: explain reordering decisions and connection insertions
```

**Why northernmost start:** Vietnam's geography is a long narrow country running north-to-south. Starting from the northernmost destination and working south (or vice versa) naturally avoids backtracking in most cases. The nearest-neighbor heuristic further optimizes within this constraint.

### Seasonal Pricing Model

Pricing uses a **multiplicative model** where the base price (1.0x) represents low-season pricing, and multipliers increase during peak/shoulder periods:

```
actual_price = base_price * destination_multiplier * seasonal_multiplier
```

The `relative_price_index` returned in `WeeklyPricePoint` is the composite multiplier across all destinations in the itinerary for that week.

**Tet Holiday handling is critical.** Tet is the single most expensive travel period in Vietnam because it is the only time the entire country takes extended holiday. Unlike Christmas (which affects international tourist areas), Tet affects domestic flight prices, bus availability, restaurant closures, and hotel pricing nationwide. The Tet dates shift yearly with the Lunar calendar -- hard-coding dates by year is the correct approach for a reference system.

```python
# Tet 2026-2030 reference dates (eve through end of holiday week)
TET_DATES = {
    2026: (date(2026, 1, 17), date(2026, 1, 25)),  # Year of the Horse
    2027: (date(2027, 2, 6), date(2027, 2, 14)),    # Year of the Goat
    2028: (date(2028, 1, 26), date(2028, 2, 3)),     # Year of the Monkey
    2029: (date(2029, 2, 13), date(2029, 2, 21)),    # Year of the Rooster
    2030: (date(2030, 2, 3), date(2030, 2, 11)),     # Year of the Dog
}
```

### Integration Pattern with Calculation Agent

The calculation agent (`agents/calculation/agent.py`) orchestrates multiple sub-calculators. This story adds routing and pricing as the third and fourth sub-calculators (after budget and accommodation from Stories 3.1 and 3.2).

```python
# In agents/calculation/agent.py -- integration pattern
async def calculation_node(state: AdvisoryState) -> AdvisoryState:
    calculations = state.calculations or {}

    # Story 3.1: Budget allocation (already implemented)
    # calculations["budget"] = ...

    # Story 3.2: Accommodation matching (already implemented)
    # calculations["accommodation"] = ...

    # Story 3.3: Routing optimization
    try:
        destinations = state.traveler_profile.destination_preferences or []
        router = RouteOptimizer(TRANSPORT_NETWORK, REQUIRED_CONNECTIONS)
        routing_result = router.optimize(destinations)
        calculations["routing"] = routing_result.model_dump()
    except Exception as e:
        state.errors.append({
            "agent": "calculation",
            "component": "routing",
            "message": str(e),
        })

    # Story 3.3: Seasonal pricing
    try:
        analyzer = SeasonalPricingAnalyzer(PEAK_SEASONS, DESTINATION_SEASONALITY)
        start = state.traveler_profile.travel_start_date
        end = state.traveler_profile.travel_end_date
        is_flexible = state.traveler_profile.date_flexibility is not None
        if start and end:
            pricing_result = analyzer.analyze(destinations, start, end, is_flexible)
            calculations["seasonal_pricing"] = pricing_result.model_dump()
    except Exception as e:
        state.errors.append({
            "agent": "calculation",
            "component": "pricing",
            "message": str(e),
        })

    state.calculations = calculations
    return state
```

### File Placement Summary

| File | Purpose |
|---|---|
| `backend/app/agents/calculation/schemas.py` | Extended with routing and pricing Pydantic models |
| `backend/app/agents/calculation/vietnam_transport.py` | Transport network adjacency data, destination coordinates, required connections |
| `backend/app/agents/calculation/routing.py` | `RouteOptimizer` class with nearest-neighbor heuristic |
| `backend/app/agents/calculation/vietnam_seasons.py` | Seasonal pricing reference data, Tet dates, destination seasonality |
| `backend/app/agents/calculation/pricing.py` | `SeasonalPricingAnalyzer` class with week-by-week analysis |
| `backend/app/agents/calculation/agent.py` | Updated: routing and pricing integrated into calculation pipeline |
| `backend/app/agents/calculation/tests/test_routing.py` | 9+ routing unit tests |
| `backend/app/agents/calculation/tests/test_pricing.py` | 12+ pricing unit tests |

### Anti-Patterns -- DO NOT

- **DO NOT** call the LLM for routing or pricing calculations. These are deterministic algorithms on reference data.
- **DO NOT** query Qdrant/Vector Store for transport or pricing data. This is structural reference data, not entity data.
- **DO NOT** use live API calls (Skyscanner, Google Flights, etc.) for pricing. Use embedded reference estimates. Live data is a Phase 2+ enhancement.
- **DO NOT** implement a full TSP solver. Nearest-neighbor is sufficient for 3-10 destinations.
- **DO NOT** hard-code Tet dates as a fixed date range. Tet follows the Lunar calendar and shifts yearly.
- **DO NOT** overwrite existing keys in `AdvisoryState.calculations`. Merge, do not replace.
- **DO NOT** import from `agents/profiling/` or `agents/proposal/`. Read only from `AdvisoryState`.
- **DO NOT** raise exceptions inside the calculation pipeline. Append to `AdvisoryState.errors`.
- **DO NOT** create a `utils.py` file. Name files by purpose (`vietnam_transport.py`, `vietnam_seasons.py`).

### Testing Strategy

All tests are pure calculation tests with zero external dependencies. No LLM, no Qdrant, no Redis, no PostgreSQL.

**Routing tests** instantiate `RouteOptimizer` directly with the built-in `TRANSPORT_NETWORK` and `REQUIRED_CONNECTIONS` data and verify algorithmic correctness.

**Pricing tests** instantiate `SeasonalPricingAnalyzer` directly with the built-in seasonal data and verify date math, multiplier calculations, and flag generation.

Test pattern:
```python
def test_sapa_to_phu_quoc_requires_hanoi():
    router = RouteOptimizer(TRANSPORT_NETWORK, REQUIRED_CONNECTIONS)
    result = router.optimize(["Sapa", "Phu Quoc"])
    assert isinstance(result, OptimizedRoute)
    assert len(result.legs) >= 2  # Must go via Hanoi
    # Find the connection leg
    connection_legs = [leg for leg in result.legs if leg.is_connection]
    assert len(connection_legs) >= 1
    assert any("Hanoi" in [leg.origin, leg.destination] for leg in result.legs)
    assert any("connection" in note.lower() for note in result.optimization_notes)

def test_tet_holiday_peak_flagged():
    analyzer = SeasonalPricingAnalyzer(PEAK_SEASONS, DESTINATION_SEASONALITY)
    # Tet 2026 is Jan 17-25
    result = analyzer.analyze(["Phu Quoc"], date(2026, 1, 1), date(2026, 2, 28))
    tet_weeks = [wp for wp in result.weekly_prices if any(f.name == "Tet Holiday" for f in wp.flags)]
    assert len(tet_weeks) >= 1
    assert all(wp.relative_price_index >= 1.5 for wp in tet_weeks)
```

### Edge Cases to Handle

1. **Empty destination list:** Return graceful skip, same as single destination
2. **Duplicate destinations:** Remove duplicates before optimization (traveler might list "Hanoi" twice)
3. **Destination not in network:** Append clear error to `AdvisoryState.errors` naming the unknown destination
4. **Date range with no Tet lookup:** Return pricing without Tet flag, add note "Tet dates not available for [year]"
5. **Date range shorter than 1 week:** Return single-period analysis even for flexible dates
6. **All destinations in same city:** Return single-destination result (e.g., ["Da Nang", "Hoi An"] could be treated as same-area, but should still show the short bus route)
7. **Circular routes (return to start):** The optimizer does not assume return-to-origin. If the traveler wants to return to Hanoi, it should be listed as the last destination.
8. **Destination name normalization:** Handle common aliases ("Ho Chi Minh City" = "HCMC" = "Saigon", "Can Tho" = "Mekong Delta")

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- agents/calculation/ structure, Protocol interfaces, naming conventions]
- [Source: _bmad-output/planning-artifacts/architecture.md -- LangGraph state convention, AdvisoryState with calculations dict]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Anti-patterns: no cross-agent imports, no LLM for factual data]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 3, Story 3.3 acceptance criteria]
- [Source: _bmad-output/project-context.md -- Testing rules, SQLAlchemy async patterns, code quality rules]
- [Source: backend/app/agents/state.py -- AdvisoryState definition with calculations: dict | None]
- [Source: backend/app/agents/protocols.py -- LLMServiceProtocol, VectorStoreProtocol, CacheProtocol]
- [Source: backend/app/schemas/profile.py -- TravelerProfileResponse with destination_preferences, travel dates, date_flexibility]

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
