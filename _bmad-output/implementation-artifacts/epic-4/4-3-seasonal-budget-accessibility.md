# Story 4.3: Seasonal, Budget & Accessibility Checks

Status: done

## Story

As a travel agent,
I want the system to validate seasonal suitability, budget feasibility, and accessibility for my client's trip,
so that my client doesn't travel during monsoon season, exceed their budget, or encounter inaccessible venues.

**Depends on:** Story 4.2 (Health, Travel Advisory & Age Restriction Checks — establishes the compliance agent module structure, `ComplianceFlag` schema, and check runner pattern)

**FRs implemented:** FR-19 (Seasonal Feasibility Check), FR-20 (Budget Feasibility Validation), FR-21 (Accessibility Validation)
**FRs partially advanced:** FR-23 (Compliance Gate — provides seasonal/budget/accessibility flags consumed by Story 4.4's gate logic)

## Acceptance Criteria

### AC-1: Module Structure

**Given** the compliance agent module at `agents/compliance/`
**When** this story is complete
**Then** the following files exist:
- `agents/compliance/seasonal.py` -- seasonal feasibility checker
- `agents/compliance/budget_check.py` -- budget feasibility validator
- `agents/compliance/accessibility.py` -- accessibility validator
- `agents/compliance/tests/test_seasonal.py` -- seasonal check unit tests
- `agents/compliance/tests/test_budget_check.py` -- budget check unit tests
- `agents/compliance/tests/test_accessibility.py` -- accessibility check unit tests

### AC-2: Seasonal Feasibility — Region Mapping

**Given** a Traveler Profile with `destination_preferences` containing one or more Vietnam destinations
**When** `agents/compliance/seasonal.py` runs the seasonal check
**Then** each destination is mapped to its region (North, Central, or South) using data from `data/seed/vietnam_seasons.json`
**And** the mapping handles all destinations in the seed data:
- North: hanoi, halong, sapa
- Central: danang, hoian, hue
- South: hcmc, mekong, phuquoc, nhatrang, dalat
**And** if a destination is not found in any region, a warning flag is returned: "Unknown destination — seasonal data unavailable for {destination}"

### AC-3: Seasonal Feasibility — Monsoon Detection

**Given** a Traveler Profile with `travel_start_date`, `travel_end_date`, and destinations mapped to regions
**When** `agents/compliance/seasonal.py` checks each destination against monsoon patterns
**Then** destinations planned during their region's monsoon months are flagged:
- North: May through October
- Central: September through January
- South: May through October
**And** the flag includes:
- `severity`: "warning" (seasonal checks are non-critical per Story 4.4 AC)
- `check`: "seasonal"
- `destination`: the flagged destination
- `region`: North/Central/South
- `monsoon_severity`: "hot_wet" or "heavy_rain" (from seed data)
- `message`: human-readable description (e.g., "Da Nang is in the Central region's monsoon season (Sep-Jan). Expect heavy rain.")
- `alternative`: suggested alternative timing from the `best_travel` field

### AC-4: Seasonal Feasibility — Staggered Monsoon Handling

**Given** a multi-destination trip spanning destinations in different regions
**When** the seasonal check runs
**Then** each destination is validated independently against its own region's monsoon calendar
**And** a trip visiting Hanoi (North) in March and Da Nang (Central) in October correctly flags only Da Nang
**And** a trip visiting HCMC (South) in July and Hue (Central) in July correctly flags HCMC (monsoon) but not Hue (dry season in July)

### AC-5: Seasonal Feasibility — Date Range Spanning

**Given** a trip with `travel_start_date` and `travel_end_date` that spans across monsoon boundary months
**When** the seasonal check runs
**Then** any overlap between the travel date range and the region's monsoon months triggers a flag
**And** the flag indicates partial overlap when applicable (e.g., "Your dates (Oct 25 - Nov 15) partially overlap with Central Vietnam's monsoon season ending in January")
**And** if only `travel_start_date` is provided (no end date), the check uses a default 7-day duration

### AC-6: Budget Feasibility — Over-Budget Detection

**Given** a Traveler Profile with `budget_total` and a proposal/calculation with total estimated cost in `AdvisoryState.calculations`
**When** `agents/compliance/budget_check.py` validates total cost
**Then** if total estimated cost is within budget, no flag is raised
**And** if total estimated cost exceeds budget by up to 10%, a soft informational message is returned (not a flag)
**And** if total estimated cost exceeds budget by more than 10%, a warning flag is raised with:
- `severity`: "warning"
- `check`: "budget"
- `message`: human-readable description including the amount over budget and percentage
- `budget_total`: stated budget
- `estimated_cost`: calculated cost
- `overage_amount`: how much over
- `overage_percent`: percentage over budget

### AC-7: Budget Feasibility — Cost-Reduction Suggestions

**Given** a budget flag has been raised (cost exceeds budget by >10%)
**When** `agents/compliance/budget_check.py` generates cost-reduction suggestions
**Then** suggestions are prioritized by impact (largest potential savings first)
**And** suggestions include at least the following categories when applicable:
- Accommodation downgrade (e.g., "Switch from 5-star to 4-star hotels: estimated savings $X/night")
- Season shift (e.g., "Moving travel dates to shoulder season could save 20-30%")
- Destination swap (e.g., "Consider Da Lat instead of Phu Quoc for lower accommodation costs")
- Activity trimming (e.g., "Remove 2 premium activities to save $X")
- Duration reduction (e.g., "Shorten trip by 2 days to save approximately $X")
**And** each suggestion includes an estimated savings amount or percentage when possible
**And** suggestions are returned in a `suggestions` list on the budget flag

### AC-8: Budget Feasibility — Missing Data Handling

**Given** a Traveler Profile where `budget_total` is not set
**When** `agents/compliance/budget_check.py` runs
**Then** a warning flag is returned: "Budget not specified — unable to validate cost feasibility"
**And** no cost-reduction suggestions are generated

**Given** `AdvisoryState.calculations` is None or does not contain estimated cost data
**When** `agents/compliance/budget_check.py` runs
**Then** a warning flag is returned: "Cost calculations not available — unable to validate budget"

### AC-9: Accessibility — Mobility Needs Detection

**Given** a Traveler Profile with `accessibility_needs` containing mobility requirements (e.g., ["wheelchair_access", "elevator_required", "ground_floor"])
**When** `agents/compliance/accessibility.py` runs
**Then** accommodations in the proposal are validated against stated mobility needs
**And** activities in the proposal are validated against stated mobility needs
**And** the check considers common accessibility barriers in Vietnam:
- Many boutique hotels are walk-up buildings without elevators
- Temple/pagoda visits often require stairs
- Old Quarter areas (Hanoi, Hoi An) have uneven surfaces
- Beach activities may be inaccessible for wheelchair users
- Motorbike tours are unsuitable for mobility-impaired travelers

### AC-10: Accessibility — Flagging Non-Compliant Items

**Given** an accommodation or activity in the proposal does not meet the traveler's stated accessibility needs
**When** the accessibility check evaluates the item
**Then** a warning flag is raised with:
- `severity`: "warning"
- `check`: "accessibility"
- `item_type`: "accommodation" or "activity"
- `item_name`: name of the non-compliant item
- `requirement`: which accessibility need is not met
- `message`: human-readable explanation (e.g., "Hotel XYZ is a walk-up building — no elevator available. Wheelchair access required.")
- `alternative`: suggested accessible alternative when available (from Vector Store data if accessible options exist)

### AC-11: Accessibility — No Needs Specified

**Given** a Traveler Profile where `accessibility_needs` is None or empty
**When** `agents/compliance/accessibility.py` runs
**Then** no accessibility flags are raised
**And** the check returns a "pass" status with message "No accessibility requirements specified"

### AC-12: Return Format Consistency

**Given** any of the three checkers (seasonal, budget, accessibility) complete their validation
**When** the results are returned
**Then** all results use the same `ComplianceFlag` schema structure consistent with Story 4.1 and 4.2 outputs
**And** results are appendable to the `compliance_report` in `AdvisoryState`
**And** each checker returns a list of `ComplianceFlag` objects (empty list if no issues found)

### AC-13: Unit Test Coverage

**Given** the test suites for all three checkers
**When** tests are run with `pytest`
**Then** all tests pass with no external dependencies (no Qdrant, no Ollama, no Redis)
**And** seasonal tests cover:
- Destination in monsoon season is flagged
- Destination in dry season passes
- Multi-region trip with mixed results
- Unknown destination produces warning
- Date range spanning monsoon boundary
- Missing travel dates
**And** budget tests cover:
- Within budget (no flag)
- 5% over budget (soft info, no flag)
- 15% over budget (flag + suggestions)
- 50% over budget (flag + suggestions ordered by impact)
- Missing budget_total
- Missing calculations
**And** accessibility tests cover:
- No accessibility needs (pass)
- Wheelchair need with walk-up hotel (flag)
- Elevator need met by accessible hotel (pass)
- Activity unsuitable for mobility needs (flag)
- Multiple accessibility needs with mixed results

## Tasks

- [ ] Task 1: Define Pydantic schemas for the three checkers (AC: #1, #12)
  - [ ] Create or extend `agents/compliance/schemas.py` with:
    - `SeasonalRegion` model: `region: str`, `destinations: list[str]`, `dry_season: str`, `monsoon: str`, `best_travel: str`, `monsoon_severity: str`
    - `SeasonalCheckResult` model: `destination: str`, `region: str | None`, `in_monsoon: bool`, `monsoon_months: str | None`, `monsoon_severity: str | None`, `best_travel: str | None`
    - `BudgetCheckResult` model: `budget_total: float | None`, `estimated_cost: float | None`, `overage_amount: float | None`, `overage_percent: float | None`, `suggestions: list[CostReductionSuggestion]`
    - `CostReductionSuggestion` model: `category: str`, `description: str`, `estimated_savings: float | None`, `priority: int`
    - `AccessibilityCheckResult` model: `item_type: str`, `item_name: str`, `requirement: str`, `is_compliant: bool`, `alternative: str | None`
  - [ ] Ensure `ComplianceFlag` from Story 4.1/4.2 is reused (do not create a duplicate)

- [ ] Task 2: Implement seasonal feasibility checker (AC: #2, #3, #4, #5)
  - [ ] Create `agents/compliance/seasonal.py` with:
    - `load_season_data(path: str | None = None) -> list[SeasonalRegion]` — loads `data/seed/vietnam_seasons.json`, with fallback to `agents/compliance/rules/vietnam_seasons.json`
    - `map_destination_to_region(destination: str, season_data: list[SeasonalRegion]) -> SeasonalRegion | None` — case-insensitive lookup
    - `parse_month_range(range_str: str) -> list[int]` — converts "May-Oct" to [5, 6, 7, 8, 9, 10], handles wrap-around like "Sep-Jan" -> [9, 10, 11, 12, 1]
    - `check_date_overlap(start_date: date, end_date: date, monsoon_months: list[int]) -> bool` — checks if any travel month falls in monsoon
    - `run_seasonal_check(state: AdvisoryState) -> list[ComplianceFlag]` — main entry point
  - [ ] Handle edge cases:
    - No travel dates → return warning flag "Travel dates not specified"
    - No destinations → return empty list
    - Destination not found → return warning with "Unknown destination"
    - Date range wrapping a year boundary (e.g., Dec 20 - Jan 15)

- [ ] Task 3: Implement budget feasibility checker (AC: #6, #7, #8)
  - [ ] Create `agents/compliance/budget_check.py` with:
    - `extract_estimated_cost(calculations: dict | None) -> float | None` — safely extract total cost from AdvisoryState.calculations
    - `calculate_overage(budget_total: float, estimated_cost: float) -> tuple[float, float]` — returns (overage_amount, overage_percent)
    - `generate_suggestions(state: AdvisoryState, overage_percent: float) -> list[CostReductionSuggestion]` — context-aware suggestions based on profile and calculation data
    - `run_budget_check(state: AdvisoryState) -> list[ComplianceFlag]` — main entry point
  - [ ] Suggestion generation logic:
    - Only include accommodation downgrade suggestion if `accommodation_style` is "luxury" or "premium"
    - Only include season shift suggestion if `date_flexibility` is not None
    - Only include duration reduction if trip is longer than 7 days
    - Priority ordering: accommodation (highest savings) > season shift > activity trimming > duration reduction > destination swap
  - [ ] Handle: budget_total is None, calculations is None, estimated_cost is 0

- [ ] Task 4: Implement accessibility validator (AC: #9, #10, #11)
  - [ ] Create `agents/compliance/accessibility.py` with:
    - `parse_accessibility_needs(needs: list[str] | None) -> list[str]` — normalize and validate accessibility need strings
    - `check_accommodation_accessibility(accommodation: dict, needs: list[str]) -> list[ComplianceFlag]` — validate a single accommodation
    - `check_activity_accessibility(activity: dict, needs: list[str]) -> list[ComplianceFlag]` — validate a single activity
    - `run_accessibility_check(state: AdvisoryState) -> list[ComplianceFlag]` — main entry point
  - [ ] Vietnam-specific accessibility knowledge (embedded as constants, not LLM-generated):
    - `KNOWN_INACCESSIBLE_ACTIVITY_TYPES`: ["motorbike_tour", "trekking", "caving", "rock_climbing"]
    - `KNOWN_STAIR_HEAVY_ATTRACTIONS`: ["temples", "pagodas", "cave_systems", "old_quarter_walks"]
    - `WHEELCHAIR_INCOMPATIBLE`: ["beach_activity", "hiking", "cycling_tour"]
  - [ ] If proposal data is not yet available in state, check against `destination_preferences` and flag known inaccessible destinations/activity types

- [ ] Task 5: Write unit tests for seasonal checker (AC: #13)
  - [ ] Create `agents/compliance/tests/test_seasonal.py` with:
    - `test_destination_in_monsoon_season_flagged` — Hanoi in July -> flagged
    - `test_destination_in_dry_season_passes` — Hanoi in February -> no flag
    - `test_central_region_monsoon_detection` — Da Nang in October -> flagged (heavy_rain)
    - `test_south_region_monsoon_detection` — HCMC in June -> flagged (hot_wet)
    - `test_multi_region_mixed_results` — Hanoi (Mar) + Da Nang (Oct) -> only Da Nang flagged
    - `test_unknown_destination_warning` — "Atlantis" -> warning flag
    - `test_date_range_spanning_monsoon_boundary` — Central Oct 25 to Nov 15 -> flagged (partial overlap)
    - `test_missing_travel_dates` — no dates -> warning flag
    - `test_missing_destinations` — no destinations -> empty list
    - `test_case_insensitive_destination_matching` — "HANOI", "Hanoi", "hanoi" all match
    - `test_month_range_parsing` — "May-Oct" -> [5..10], "Sep-Jan" -> [9..12, 1]
    - `test_year_boundary_date_range` — Dec 20 to Jan 15 trip
  - [ ] All tests use fixture data, no external dependencies

- [ ] Task 6: Write unit tests for budget checker (AC: #13)
  - [ ] Create `agents/compliance/tests/test_budget_check.py` with:
    - `test_within_budget_no_flag` — cost $950 on $1000 budget -> no flag
    - `test_slightly_over_budget_no_flag` — cost $1050 on $1000 budget (5%) -> informational only
    - `test_over_10_percent_flagged` — cost $1150 on $1000 budget (15%) -> warning flag
    - `test_significantly_over_budget` — cost $1500 on $1000 budget (50%) -> flag + all applicable suggestions
    - `test_suggestions_ordered_by_impact` — verify priority ordering
    - `test_luxury_gets_downgrade_suggestion` — luxury accommodation_style triggers downgrade suggestion
    - `test_budget_traveler_no_downgrade_suggestion` — budget accommodation_style does not suggest downgrade
    - `test_flexible_dates_gets_season_shift_suggestion` — flexible dates trigger season shift suggestion
    - `test_short_trip_no_duration_reduction` — 5-day trip does not suggest duration reduction
    - `test_missing_budget_total` — None budget -> warning
    - `test_missing_calculations` — None calculations -> warning
    - `test_zero_budget` — $0 budget with any cost -> flag
  - [ ] All tests construct `AdvisoryState` with mock data

- [ ] Task 7: Write unit tests for accessibility checker (AC: #13)
  - [ ] Create `agents/compliance/tests/test_accessibility.py` with:
    - `test_no_accessibility_needs_passes` — None/empty needs -> pass, no flags
    - `test_wheelchair_with_walkup_hotel_flagged` — wheelchair need + no-elevator hotel -> flag
    - `test_elevator_need_met_passes` — elevator need + accessible hotel -> no flag
    - `test_motorbike_tour_with_mobility_needs` — motorbike activity + any mobility need -> flag
    - `test_temple_visit_with_wheelchair` — temple activity + wheelchair need -> flag with alternative
    - `test_multiple_needs_mixed_results` — wheelchair + dietary (non-accessibility) -> only relevant flags
    - `test_unknown_accessibility_need_passes` — unrecognized need string -> no crash, no flag
    - `test_missing_proposal_data` — no proposal in state -> checks against destination preferences only
  - [ ] All tests use mock data, no external dependencies

- [ ] Task 8: Integration with compliance agent runner
  - [ ] Ensure `seasonal.run_seasonal_check`, `budget_check.run_budget_check`, and `accessibility.run_accessibility_check` are callable from the compliance agent in `agents/compliance/agent.py` (to be wired in Story 4.4)
  - [ ] Each checker follows the same interface: `run_*_check(state: AdvisoryState) -> list[ComplianceFlag]`
  - [ ] Verify all three checkers can run independently and in any order
  - [ ] Verify flags from all three checkers can be aggregated into a single `compliance_report`

## Dev Notes

### Critical Architecture Constraints

- **No cross-agent imports**: These checkers read from `AdvisoryState` only. They never import from `agents/profiling/`, `agents/calculation/`, or `agents/proposal/`.
- **Errors in state, not exceptions**: If data is missing or parsing fails, return a warning `ComplianceFlag`. Never raise exceptions.
- **Protocol interfaces only**: The accessibility checker may need to query the Vector Store for accessible alternatives. If so, accept `VectorStoreProtocol` via parameter. For Story 4.3, use static fallback suggestions when Vector Store is unavailable.
- **Pydantic BaseModel for all schemas**: No TypedDict. All check results and flags use Pydantic.
- **Co-located tests**: Tests live at `agents/compliance/tests/`, not in a top-level `tests/` directory.
- **structlog for logging**: Every check should log entry/exit with `session_id` and check name.

### Seasonal Checker Implementation Details

The seasonal checker is data-driven, not LLM-driven. All logic is deterministic based on the `vietnam_seasons.json` data.

**Loading season data:**

```python
import json
from pathlib import Path

SEASON_DATA_PATHS = [
    Path("data/seed/vietnam_seasons.json"),
    Path("backend/app/agents/compliance/rules/vietnam_seasons.json"),
]

def load_season_data(path: str | None = None) -> list[dict]:
    """Load Vietnam seasonal data. Tries seed data first, falls back to rules copy."""
    if path:
        with open(path) as f:
            return json.load(f)
    for p in SEASON_DATA_PATHS:
        if p.exists():
            with open(p) as f:
                return json.load(f)
    raise FileNotFoundError("Vietnam seasons data not found")
```

**Month range parsing — handling wrap-around:**

```python
MONTH_NAMES = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

def parse_month_range(range_str: str) -> list[int]:
    """Parse 'May-Oct' -> [5,6,7,8,9,10]. Handles wrap: 'Sep-Jan' -> [9,10,11,12,1]."""
    start_str, end_str = range_str.split("-")
    start = MONTH_NAMES[start_str.strip()]
    end = MONTH_NAMES[end_str.strip()]
    if start <= end:
        return list(range(start, end + 1))
    else:
        # Wrap around year boundary
        return list(range(start, 13)) + list(range(1, end + 1))
```

**Date overlap check:**

```python
from datetime import date

def check_date_overlap(start_date: date, end_date: date, monsoon_months: list[int]) -> bool:
    """Check if any month in the travel date range falls within monsoon months."""
    current = start_date
    while current <= end_date:
        if current.month in monsoon_months:
            return True
        # Move to next month
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1, day=1)
        else:
            current = current.replace(month=current.month + 1, day=1)
    return False
```

### Budget Checker Implementation Details

The budget checker reads cost data from `AdvisoryState.calculations`. The calculation structure is expected to be populated by Epic 3 (Story 3.1 budget allocation, Story 3.6 budget breakdown). For now, the checker should handle any dict structure gracefully and look for a `total_estimated_cost` key.

**Cost extraction — defensive:**

```python
def extract_estimated_cost(calculations: dict | None) -> float | None:
    """Extract total estimated cost from calculations dict. Returns None if not found."""
    if not calculations:
        return None
    # Try common key names
    for key in ["total_estimated_cost", "total_cost", "estimated_total", "total"]:
        if key in calculations and isinstance(calculations[key], (int, float)):
            return float(calculations[key])
    return None
```

**Suggestion generation — context-aware:**

```python
SUGGESTION_TEMPLATES = {
    "accommodation_downgrade": {
        "category": "Accommodation",
        "description": "Consider downgrading accommodation tier (e.g., 5-star to 4-star). "
                       "Vietnam's 4-star hotels often provide excellent value.",
        "estimated_savings_percent": 25,
        "priority": 1,
        "condition": lambda state: state.traveler_profile
            and state.traveler_profile.accommodation_style in ("luxury", "premium", "5-star"),
    },
    "season_shift": {
        "category": "Travel Dates",
        "description": "Shift travel dates to shoulder season for lower prices. "
                       "Shoulder seasons in Vietnam can be 20-30% cheaper.",
        "estimated_savings_percent": 25,
        "priority": 2,
        "condition": lambda state: state.traveler_profile
            and state.traveler_profile.date_flexibility is not None,
    },
    "activity_trimming": {
        "category": "Activities",
        "description": "Remove or swap 1-2 premium activities for free/low-cost alternatives. "
                       "Vietnam has many free cultural experiences.",
        "estimated_savings_percent": 10,
        "priority": 3,
        "condition": lambda state: True,  # Always applicable
    },
    "duration_reduction": {
        "category": "Trip Duration",
        "description": "Shorten trip duration to reduce overall costs.",
        "estimated_savings_percent": None,  # Calculated per day
        "priority": 4,
        "condition": lambda state: _trip_duration(state) and _trip_duration(state) > 7,
    },
    "destination_swap": {
        "category": "Destinations",
        "description": "Consider swapping premium destinations for budget-friendly alternatives. "
                       "E.g., Da Lat or Hoi An instead of Phu Quoc.",
        "estimated_savings_percent": 15,
        "priority": 5,
        "condition": lambda state: True,  # Always applicable
    },
}
```

### Accessibility Checker Implementation Details

The accessibility checker uses a combination of:
1. **Static knowledge** about Vietnam-specific accessibility barriers (constants in the module)
2. **Entity metadata** from the proposal when available (accommodation/activity attributes)
3. **Graceful fallback** when proposal data is not yet available

**Known accessibility constants:**

```python
KNOWN_INACCESSIBLE_ACTIVITY_TYPES = [
    "motorbike_tour", "trekking", "caving", "rock_climbing",
    "cycling_tour", "kayaking", "scuba_diving",
]

KNOWN_STAIR_HEAVY_ATTRACTIONS = [
    "temple", "pagoda", "cave", "old_quarter_walk", "citadel",
    "mountain_viewpoint", "lighthouse",
]

WHEELCHAIR_INCOMPATIBLE_ACTIVITIES = [
    "beach_sports", "hiking", "cycling", "motorbike",
    "cave_exploration", "trekking", "snorkeling",
]

ACCESSIBILITY_ALTERNATIVES = {
    "motorbike_tour": "Private car tour with accessible vehicle",
    "trekking": "Scenic drive through the highlands with stops at accessible viewpoints",
    "temple": "Visit temples with ramp access (e.g., modern pagodas in HCMC)",
    "old_quarter_walk": "Cyclo (pedicab) tour through the Old Quarter",
    "cave": "Visit accessible cave sections or virtual cave experience centers",
    "cycling_tour": "Electric cart tour or boat tour",
}
```

**Parsing accessibility needs:**

```python
VALID_ACCESSIBILITY_NEEDS = [
    "wheelchair_access",
    "elevator_required",
    "ground_floor",
    "limited_walking",
    "hearing_impaired",
    "visual_impaired",
    "step_free_access",
]

MOBILITY_NEEDS = [
    "wheelchair_access", "elevator_required", "ground_floor",
    "limited_walking", "step_free_access",
]

def parse_accessibility_needs(needs: list[str] | None) -> list[str]:
    """Normalize and validate accessibility need strings."""
    if not needs:
        return []
    normalized = [n.lower().strip().replace(" ", "_") for n in needs]
    return [n for n in normalized if n]  # Return all, even unrecognized
```

### ComplianceFlag Schema Convention

All three checkers must return `ComplianceFlag` objects consistent with Stories 4.1 and 4.2. The expected structure:

```python
class ComplianceFlag(BaseModel):
    """A single compliance check finding."""
    severity: Literal["block", "warning", "info", "pass"]
    check: str  # "seasonal", "budget", "accessibility", "visa", etc.
    message: str
    details: dict = {}  # Check-specific data (destination, region, amounts, etc.)
    alternative: str | None = None  # Suggested fix or alternative
```

For Story 4.3 specifically:
- **Seasonal flags** always have severity "warning" (non-critical, per Story 4.4)
- **Budget flags** always have severity "warning" (non-critical)
- **Accessibility flags** always have severity "warning" (non-critical)
- None of these checks produce "block" severity — that is reserved for visa violations, travel advisories, and age restrictions (Story 4.1 / 4.2)

### State Access Patterns

Each checker reads from `AdvisoryState` only. Here is what each checker needs:

| Checker | Reads From | Required | Falls Back |
|---|---|---|---|
| seasonal | `traveler_profile.destination_preferences` | Yes | Empty list -> no check |
| seasonal | `traveler_profile.travel_start_date` | Yes | None -> warning flag |
| seasonal | `traveler_profile.travel_end_date` | No | Default 7-day trip |
| budget | `traveler_profile.budget_total` | Yes | None -> warning flag |
| budget | `calculations` (dict with cost data) | Yes | None -> warning flag |
| budget | `traveler_profile.accommodation_style` | No | Affects suggestion selection |
| budget | `traveler_profile.date_flexibility` | No | Affects suggestion selection |
| budget | `traveler_profile.travel_start_date/end_date` | No | Affects duration suggestion |
| accessibility | `traveler_profile.accessibility_needs` | Yes | None/empty -> pass (no check) |
| accessibility | `proposal` (dict with accommodations/activities) | No | Check against destinations only |

### Logging Convention

```python
import structlog

logger = structlog.get_logger()

def run_seasonal_check(state: AdvisoryState) -> list[ComplianceFlag]:
    logger.info("compliance.seasonal.started", session_id=state.session_id)
    # ... check logic ...
    logger.info("compliance.seasonal.completed",
        session_id=state.session_id,
        flags_count=len(flags),
        destinations_checked=len(destinations),
    )
    return flags
```

### File Placement Summary

| File | Purpose |
|---|---|
| `backend/app/agents/compliance/seasonal.py` | Seasonal feasibility check: region mapping, monsoon detection, date overlap |
| `backend/app/agents/compliance/budget_check.py` | Budget feasibility: overage detection, cost-reduction suggestions |
| `backend/app/agents/compliance/accessibility.py` | Accessibility validation: mobility needs vs accommodations/activities |
| `backend/app/agents/compliance/schemas.py` | Pydantic models: `SeasonalRegion`, `BudgetCheckResult`, `CostReductionSuggestion`, `AccessibilityCheckResult` (extend or create) |
| `backend/app/agents/compliance/tests/test_seasonal.py` | 12+ unit tests for seasonal checker |
| `backend/app/agents/compliance/tests/test_budget_check.py` | 12+ unit tests for budget checker |
| `backend/app/agents/compliance/tests/test_accessibility.py` | 8+ unit tests for accessibility checker |
| `data/seed/vietnam_seasons.json` | Existing seed data (read-only, do not modify) |
| `backend/app/agents/compliance/rules/vietnam_seasons.json` | Existing rules copy (read-only, do not modify) |

### Anti-Patterns -- DO NOT

- **DO NOT** use the LLM for seasonal or budget checks. These are deterministic, rule-based validations. No LLM cost.
- **DO NOT** hard-code monsoon months in Python. Read from `vietnam_seasons.json` and parse the month range strings.
- **DO NOT** raise exceptions. Return `ComplianceFlag` with severity "warning" for any error condition.
- **DO NOT** import from `agents/profiling/`, `agents/calculation/`, or `agents/proposal/`. Read from `AdvisoryState` only.
- **DO NOT** modify the existing `vietnam_seasons.json` files. They are shared seed data.
- **DO NOT** create a `utils.py` file. Name files by purpose.
- **DO NOT** generate accessibility data via LLM. Use static constants for Vietnam-specific knowledge.
- **DO NOT** block proposals for seasonal, budget, or accessibility issues. These are warnings, not blocks (per FR-23 and Story 4.4).
- **DO NOT** implement the compliance gate or agent runner (that is Story 4.4).

### Testing Strategy

All tests use constructed `AdvisoryState` instances with mock data. No external dependencies.

**Fixture pattern for seasonal tests:**

```python
import pytest
from datetime import date
from app.agents.state import AdvisoryState
from app.schemas.profile import TravelerProfileResponse

def make_state(destinations=None, start_date=None, end_date=None, **kwargs):
    """Create a minimal AdvisoryState for testing."""
    profile_data = {
        "id": "00000000-0000-0000-0000-000000000001",
        "advisory_session_id": "00000000-0000-0000-0000-000000000002",
        "destination_preferences": destinations or [],
        "travel_start_date": start_date,
        "travel_end_date": end_date,
        "created_at": "2026-01-01T00:00:00",
        "updated_at": "2026-01-01T00:00:00",
        **kwargs,
    }
    return AdvisoryState(
        session_id="test-session",
        tenant_id="test-tenant",
        traveler_profile=TravelerProfileResponse(**profile_data),
    )
```

**Fixture pattern for budget tests:**

```python
def make_budget_state(budget_total=None, estimated_cost=None, accommodation_style=None, **kwargs):
    """Create an AdvisoryState with budget and calculation data."""
    state = make_state(budget_total=budget_total, accommodation_style=accommodation_style, **kwargs)
    if estimated_cost is not None:
        state.calculations = {"total_estimated_cost": estimated_cost}
    return state
```

**Fixture pattern for accessibility tests:**

```python
def make_accessibility_state(needs=None, proposal=None):
    """Create an AdvisoryState with accessibility needs and optional proposal."""
    state = make_state(accessibility_needs=needs)
    if proposal:
        state.proposal = proposal
    return state
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- agents/compliance/ structure, Protocol interfaces, naming conventions]
- [Source: _bmad-output/planning-artifacts/architecture.md -- LangGraph state convention, AdvisoryState]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Anti-patterns: no cross-agent imports, no direct LLM imports]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 4, Story 4.3 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 4, Story 4.4 compliance gate (block vs warning severity)]
- [Source: data/seed/vietnam_seasons.json -- Regional monsoon data: North May-Oct, Central Sep-Jan, South May-Oct]
- [Source: backend/app/agents/state.py -- AdvisoryState definition with traveler_profile, calculations, proposal]
- [Source: backend/app/schemas/profile.py -- TravelerProfileResponse with accessibility_needs, budget_total, destination_preferences]
- [Source: _bmad-output/project-context.md -- SQLAlchemy async rules, testing rules, code quality standards]

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
