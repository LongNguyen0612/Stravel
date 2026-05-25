# Story 3.1: Budget Allocation Agent

Status: done

## Story

As a travel agent,
I want the system to compute a recommended budget split across categories based on my client's total budget and trip parameters,
so that I can show clients how their money will be distributed.

## Acceptance Criteria

1. Given a completed Traveler Profile with total budget, trip duration, and destination preferences, when the Calculation Agent runs budget allocation, then the system returns percentage splits for: flights, accommodation, activities, food, local transport, insurance, buffer.
2. Allocation adjusts based on destination cost index (e.g., Phu Quoc resort area vs Hanoi budget district).
3. Total allocation equals the stated budget exactly (no rounding drift -- the sum of all category amounts in VND/USD must equal `budget_total`).
4. `agents/calculation/budget.py` contains the allocation logic as a pure function (no LLM calls, no external services).
5. Results are written to `AdvisoryState.calculations` under a `budget_allocation` key.
6. The calculation node in `agents/orchestrator.py` invokes the budget allocation function instead of being a stub.
7. Unit tests cover: zero budget, extremely high budget (>$50,000), single-day trip, 30-day trip, all-inclusive resort vs backpacker allocation differences.
8. Pydantic schemas `BudgetAllocation` and `CalculationResults` are defined in `agents/calculation/schemas.py`.
9. `AdvisoryState.calculations` is typed as `CalculationResults | None` instead of `dict | None`.

## Tasks

- [ ] Task 1: Define Pydantic schemas for budget allocation (AC: #8, #9)
  - [ ] Create `app/agents/calculation/schemas.py`
  - [ ] Define `BudgetCategory` enum: `FLIGHTS`, `ACCOMMODATION`, `ACTIVITIES`, `FOOD`, `LOCAL_TRANSPORT`, `INSURANCE`, `BUFFER`
  - [ ] Define `BudgetAllocationItem` with fields: `category: BudgetCategory`, `percentage: float`, `amount: float`
  - [ ] Define `BudgetAllocation` with fields: `items: list[BudgetAllocationItem]`, `total_budget: float`, `currency: str`, `trip_duration_days: int`, `destination_cost_index: float`, `allocation_strategy: str` (e.g., "resort", "backpacker", "standard")
  - [ ] Add validator on `BudgetAllocation` that asserts `sum(item.amount for item in items) == total_budget` (exact equality after rounding fix)
  - [ ] Define `CalculationResults` with fields: `budget_allocation: BudgetAllocation | None = None`, plus placeholders for future calculation types (accommodation_matches, routing, pricing, insurance -- all `None` for now)
  - [ ] Update `AdvisoryState.calculations` type from `dict | None` to `CalculationResults | None` in `app/agents/state.py`

- [ ] Task 2: Build destination cost index data (AC: #2)
  - [ ] Create `app/agents/calculation/cost_index.py`
  - [ ] Define `DESTINATION_COST_INDEX: dict[str, float]` mapping destination names to relative cost multipliers (1.0 = Vietnam national average)
  - [ ] Include at minimum: Hanoi (0.85), HCMC (0.95), Da Nang (0.90), Hoi An (0.80), Hue (0.70), Phu Quoc (1.40), Nha Trang (1.00), Da Lat (0.75), Sapa (0.80), Mekong Delta (0.65), Can Tho (0.70)
  - [ ] Define `get_cost_index(destinations: list[str]) -> float` function that returns the weighted average cost index for a list of destinations (simple average for now)
  - [ ] Handle unknown destinations gracefully -- return 1.0 (national average) with a structlog warning
  - [ ] Include a `DESTINATION_STYLE: dict[str, str]` mapping destinations to typical travel style ("resort", "urban", "adventure", "cultural", "budget") for allocation strategy inference

- [ ] Task 3: Implement budget allocation logic (AC: #1, #2, #3, #4)
  - [ ] Create `app/agents/calculation/budget.py`
  - [ ] Define base allocation percentages for each strategy:
    - Standard: flights 20%, accommodation 30%, activities 15%, food 15%, transport 10%, insurance 5%, buffer 5%
    - Resort: flights 15%, accommodation 40%, activities 10%, food 15%, transport 5%, insurance 5%, buffer 10%
    - Backpacker: flights 25%, accommodation 20%, activities 20%, food 15%, transport 10%, insurance 5%, buffer 5%
    - Urban: flights 20%, accommodation 25%, activities 20%, food 15%, transport 10%, insurance 5%, buffer 5%
    - Adventure: flights 20%, accommodation 20%, activities 25%, food 10%, transport 10%, insurance 10%, buffer 5%
  - [ ] Define `allocate_budget(budget_total: float, currency: str, trip_duration_days: int, destinations: list[str], accommodation_style: str | None = None) -> BudgetAllocation`
  - [ ] Determine allocation strategy from destinations (via `DESTINATION_STYLE`) and `accommodation_style` override
  - [ ] Apply cost index adjustment: scale accommodation and food percentages by cost index, redistribute remainder proportionally
  - [ ] Handle duration scaling: single-day trips get 0% flights (already there), 2-3 day trips reduce flight share to 10%, 14+ day trips reduce flight share to 15% and boost accommodation
  - [ ] Implement rounding fix: allocate amounts using integer math (cents/dong), assign rounding remainder to the buffer category so total is exact
  - [ ] Handle zero budget: return `BudgetAllocation` with all amounts = 0.0 and percentages = 0.0
  - [ ] Handle edge case: no destinations provided -- use "standard" strategy with cost index 1.0
  - [ ] Log allocation with structlog: `budget.allocated`, session context, strategy, cost_index

- [ ] Task 4: Wire budget allocation into orchestrator (AC: #5, #6)
  - [ ] Update `agents/orchestrator.py` -- replace the `calculation_node` stub with a real implementation
  - [ ] In the calculation node, extract `budget_total`, `trip_duration_days` (computed from `travel_start_date` and `travel_end_date`), `destination_preferences`, `accommodation_style`, and `budget_currency` from `state.traveler_profile`
  - [ ] Call `allocate_budget()` with extracted parameters
  - [ ] Write result into `CalculationResults(budget_allocation=allocation)` and return as `{"calculations": results, "stage": "calculating"}`
  - [ ] Handle missing profile data gracefully: if `budget_total` is None, append error to `AdvisoryState.errors` and skip allocation
  - [ ] Handle missing dates: if dates are None but budget exists, default to 7-day trip duration with a warning in errors

- [ ] Task 5: Write unit tests for budget allocation (AC: #7)
  - [ ] Create `app/agents/calculation/tests/test_budget.py`
  - [ ] Test: zero budget returns all amounts = 0.0, all percentages = 0.0
  - [ ] Test: extremely high budget ($100,000) -- amounts are correct, no overflow, total matches exactly
  - [ ] Test: single-day trip -- flights percentage is 0%, accommodation percentage adjusted
  - [ ] Test: 30-day trip -- flight share reduced, accommodation share increased
  - [ ] Test: Phu Quoc resort destinations produce resort-style allocation (higher accommodation %)
  - [ ] Test: Hanoi + Sapa budget destinations produce different allocation than Phu Quoc
  - [ ] Test: total allocation amount equals budget_total exactly (test with $999.99, $1234.56, 15000000 VND -- amounts that cause rounding issues)
  - [ ] Test: unknown destination falls back to standard strategy with cost index 1.0
  - [ ] Test: missing destinations returns standard allocation
  - [ ] Test: 2-day trip vs 14-day trip vs 30-day trip produce different flight percentages

- [ ] Task 6: Write unit tests for cost index (AC: #2)
  - [ ] Create `app/agents/calculation/tests/test_cost_index.py`
  - [ ] Test: known destination returns correct cost index (Phu Quoc = 1.40)
  - [ ] Test: unknown destination returns 1.0
  - [ ] Test: multiple destinations return weighted average
  - [ ] Test: empty destination list returns 1.0
  - [ ] Test: case-insensitive matching ("phu quoc" == "Phu Quoc")

- [ ] Task 7: Write integration test for orchestrator with budget allocation (AC: #5, #6)
  - [ ] Create or update `app/agents/tests/test_orchestrator.py`
  - [ ] Test: graph traversal with a complete TravelerProfile produces a non-None `calculations.budget_allocation`
  - [ ] Test: `calculations.budget_allocation.total_budget` matches `traveler_profile.budget_total`
  - [ ] Test: graph traversal with missing `budget_total` appends an error and `calculations.budget_allocation` is None
  - [ ] Use `MockLLMService` for the profiling node -- do NOT require running Ollama

## Dev Notes

### Critical Architecture Constraints

- **Pure calculation -- no LLM calls.** Budget allocation is deterministic math, not AI-generated. The `allocate_budget()` function must be a pure function with no external dependencies. This is intentional: calculation agents use LLM only when interpreting unstructured data (Story 3.3 routing), not for arithmetic.
- **No rounding drift.** The sum of all category amounts must equal `budget_total` exactly. Use integer math (cents or dong) internally, assign remainder to buffer. Never round each category independently then hope they sum correctly.
- **Pydantic BaseModel for all state** -- `CalculationResults` and `BudgetAllocation` must be Pydantic BaseModel, not TypedDict or plain dict.
- **No Qdrant, no Redis.** This is Phase 3 but budget allocation has no Vector Store dependency. Unit tests must pass with PostgreSQL only.
- **Errors in state, not exceptions.** If the traveler profile lacks required fields (budget_total, dates), append to `AdvisoryState.errors` and skip -- do not raise exceptions inside the node.
- **structlog everywhere** -- All logging via structlog with `session_id`, `tenant_id`, `agent_name` keys.
- **Unit test callouts (party mode review).** Amelia flagged: all calculation stories must have explicit unit test coverage for edge cases. The test list in Task 5 is the minimum -- add more if you discover edge cases during implementation.

### Existing Code (from Epic 1)

`AdvisoryState` at `app/agents/state.py` -- currently uses `calculations: dict | None = None`. This story changes it to `CalculationResults | None`:

```python
# BEFORE (current)
class AdvisoryState(BaseModel):
    session_id: str
    tenant_id: str
    stage: Literal["profiling", "calculating", "proposing", "validating"] = "profiling"
    traveler_profile: TravelerProfileResponse | None = None
    calculations: dict | None = None
    proposal: dict | None = None
    compliance_report: dict | None = None
    errors: list[dict] = []

# AFTER (this story)
from app.agents.calculation.schemas import CalculationResults

class AdvisoryState(BaseModel):
    session_id: str
    tenant_id: str
    stage: Literal["profiling", "calculating", "proposing", "validating"] = "profiling"
    traveler_profile: TravelerProfileResponse | None = None
    calculations: CalculationResults | None = None  # CHANGED
    proposal: dict | None = None
    compliance_report: dict | None = None
    errors: list[dict] = []
```

`TravelerProfileResponse` at `app/schemas/profile.py` -- provides the input fields:

```python
class TravelerProfileResponse(BaseModel):
    budget_total: float | None = None
    budget_currency: str | None = None
    travel_start_date: date | None = None
    travel_end_date: date | None = None
    destination_preferences: list[str] | None = None
    accommodation_style: str | None = None
    # ... other fields
```

`orchestrator.py` at `app/agents/orchestrator.py` -- the calculation node is currently a stub:

```python
async def calculation_node(state: AdvisoryState) -> dict:
    """Stub -- passes through with stage update."""
    logger.info("agent.calculation.started", session_id=state.session_id)
    return {"stage": "calculating"}
```

### Schemas -- `agents/calculation/schemas.py`

```python
from enum import Enum

from pydantic import BaseModel, model_validator


class BudgetCategory(str, Enum):
    FLIGHTS = "flights"
    ACCOMMODATION = "accommodation"
    ACTIVITIES = "activities"
    FOOD = "food"
    LOCAL_TRANSPORT = "local_transport"
    INSURANCE = "insurance"
    BUFFER = "buffer"


class BudgetAllocationItem(BaseModel):
    category: BudgetCategory
    percentage: float  # 0.0 to 100.0
    amount: float      # Absolute amount in stated currency


class BudgetAllocation(BaseModel):
    items: list[BudgetAllocationItem]
    total_budget: float
    currency: str
    trip_duration_days: int
    destination_cost_index: float
    allocation_strategy: str  # "standard", "resort", "backpacker", "urban", "adventure"

    @model_validator(mode="after")
    def validate_total(self) -> "BudgetAllocation":
        if self.total_budget == 0.0:
            return self
        total = sum(item.amount for item in self.items)
        if abs(total - self.total_budget) > 0.01:
            raise ValueError(
                f"Allocation total {total} does not match budget {self.total_budget}"
            )
        return self


class CalculationResults(BaseModel):
    """Container for all calculation outputs. Fields added by later stories."""
    budget_allocation: BudgetAllocation | None = None
    # Story 3.2: accommodation_matches
    # Story 3.3: routing, seasonal_pricing
    # Story 3.4: insurance_estimation
```

### Destination Cost Index Data -- `agents/calculation/cost_index.py`

```python
import structlog

logger = structlog.get_logger()

# Relative cost multiplier. 1.0 = Vietnam national average.
# Sources: Numbeo cost of living, Agoda average nightly rates, TripAdvisor estimates.
# These are reference values for allocation adjustment, not absolute prices.
DESTINATION_COST_INDEX: dict[str, float] = {
    "hanoi": 0.85,
    "ho chi minh city": 0.95,
    "hcmc": 0.95,
    "saigon": 0.95,
    "da nang": 0.90,
    "hoi an": 0.80,
    "hue": 0.70,
    "phu quoc": 1.40,
    "nha trang": 1.00,
    "da lat": 0.75,
    "dalat": 0.75,
    "sapa": 0.80,
    "sa pa": 0.80,
    "mekong delta": 0.65,
    "can tho": 0.70,
    "ha long": 1.10,
    "halong": 1.10,
    "mui ne": 0.90,
    "con dao": 1.30,
    "quy nhon": 0.75,
    "ninh binh": 0.70,
}

DESTINATION_STYLE: dict[str, str] = {
    "hanoi": "urban",
    "ho chi minh city": "urban",
    "hcmc": "urban",
    "saigon": "urban",
    "da nang": "standard",
    "hoi an": "cultural",
    "hue": "cultural",
    "phu quoc": "resort",
    "nha trang": "resort",
    "da lat": "adventure",
    "dalat": "adventure",
    "sapa": "adventure",
    "sa pa": "adventure",
    "mekong delta": "budget",
    "can tho": "budget",
    "ha long": "standard",
    "halong": "standard",
    "mui ne": "resort",
    "con dao": "resort",
    "quy nhon": "standard",
    "ninh binh": "cultural",
}


def get_cost_index(destinations: list[str]) -> float:
    """Return weighted average cost index for destinations.

    Unknown destinations default to 1.0 with a warning logged.
    Empty list returns 1.0.
    """
    if not destinations:
        return 1.0

    total = 0.0
    for dest in destinations:
        key = dest.strip().lower()
        if key in DESTINATION_COST_INDEX:
            total += DESTINATION_COST_INDEX[key]
        else:
            logger.warning("cost_index.unknown_destination", destination=dest)
            total += 1.0

    return round(total / len(destinations), 4)


def get_destination_style(destinations: list[str]) -> str:
    """Infer travel style from destinations.

    Returns the most common style among destinations.
    Falls back to "standard" if no destinations or all unknown.
    """
    if not destinations:
        return "standard"

    styles: list[str] = []
    for dest in destinations:
        key = dest.strip().lower()
        if key in DESTINATION_STYLE:
            styles.append(DESTINATION_STYLE[key])

    if not styles:
        return "standard"

    # Return the most common style; tie-break alphabetically for determinism
    from collections import Counter
    counts = Counter(styles)
    max_count = max(counts.values())
    top_styles = sorted(s for s, c in counts.items() if c == max_count)
    return top_styles[0]
```

### Budget Allocation Logic -- `agents/calculation/budget.py`

```python
import structlog

from app.agents.calculation.cost_index import get_cost_index, get_destination_style
from app.agents.calculation.schemas import (
    BudgetAllocation,
    BudgetAllocationItem,
    BudgetCategory,
)

logger = structlog.get_logger()

# Base allocation percentages per strategy.
# Each row sums to 100.
BASE_ALLOCATIONS: dict[str, dict[BudgetCategory, float]] = {
    "standard": {
        BudgetCategory.FLIGHTS: 20.0,
        BudgetCategory.ACCOMMODATION: 30.0,
        BudgetCategory.ACTIVITIES: 15.0,
        BudgetCategory.FOOD: 15.0,
        BudgetCategory.LOCAL_TRANSPORT: 10.0,
        BudgetCategory.INSURANCE: 5.0,
        BudgetCategory.BUFFER: 5.0,
    },
    "resort": {
        BudgetCategory.FLIGHTS: 15.0,
        BudgetCategory.ACCOMMODATION: 40.0,
        BudgetCategory.ACTIVITIES: 10.0,
        BudgetCategory.FOOD: 15.0,
        BudgetCategory.LOCAL_TRANSPORT: 5.0,
        BudgetCategory.INSURANCE: 5.0,
        BudgetCategory.BUFFER: 10.0,
    },
    "backpacker": {
        BudgetCategory.FLIGHTS: 25.0,
        BudgetCategory.ACCOMMODATION: 20.0,
        BudgetCategory.ACTIVITIES: 20.0,
        BudgetCategory.FOOD: 15.0,
        BudgetCategory.LOCAL_TRANSPORT: 10.0,
        BudgetCategory.INSURANCE: 5.0,
        BudgetCategory.BUFFER: 5.0,
    },
    "urban": {
        BudgetCategory.FLIGHTS: 20.0,
        BudgetCategory.ACCOMMODATION: 25.0,
        BudgetCategory.ACTIVITIES: 20.0,
        BudgetCategory.FOOD: 15.0,
        BudgetCategory.LOCAL_TRANSPORT: 10.0,
        BudgetCategory.INSURANCE: 5.0,
        BudgetCategory.BUFFER: 5.0,
    },
    "adventure": {
        BudgetCategory.FLIGHTS: 20.0,
        BudgetCategory.ACCOMMODATION: 20.0,
        BudgetCategory.ACTIVITIES: 25.0,
        BudgetCategory.FOOD: 10.0,
        BudgetCategory.LOCAL_TRANSPORT: 10.0,
        BudgetCategory.INSURANCE: 10.0,
        BudgetCategory.BUFFER: 5.0,
    },
    "cultural": {
        BudgetCategory.FLIGHTS: 20.0,
        BudgetCategory.ACCOMMODATION: 25.0,
        BudgetCategory.ACTIVITIES: 20.0,
        BudgetCategory.FOOD: 15.0,
        BudgetCategory.LOCAL_TRANSPORT: 10.0,
        BudgetCategory.INSURANCE: 5.0,
        BudgetCategory.BUFFER: 5.0,
    },
    "budget": {
        BudgetCategory.FLIGHTS: 25.0,
        BudgetCategory.ACCOMMODATION: 20.0,
        BudgetCategory.ACTIVITIES: 15.0,
        BudgetCategory.FOOD: 15.0,
        BudgetCategory.LOCAL_TRANSPORT: 15.0,
        BudgetCategory.INSURANCE: 5.0,
        BudgetCategory.BUFFER: 5.0,
    },
}


def _apply_duration_adjustments(
    percentages: dict[BudgetCategory, float],
    trip_duration_days: int,
) -> dict[BudgetCategory, float]:
    """Adjust flight vs accommodation split based on trip length."""
    adjusted = dict(percentages)

    if trip_duration_days <= 1:
        # Day trip: no flights needed (already at destination)
        flight_share = adjusted[BudgetCategory.FLIGHTS]
        adjusted[BudgetCategory.FLIGHTS] = 0.0
        adjusted[BudgetCategory.ACTIVITIES] += flight_share * 0.5
        adjusted[BudgetCategory.FOOD] += flight_share * 0.3
        adjusted[BudgetCategory.BUFFER] += flight_share * 0.2
    elif trip_duration_days <= 3:
        # Short trip: reduce flights to 10%
        original = adjusted[BudgetCategory.FLIGHTS]
        if original > 10.0:
            excess = original - 10.0
            adjusted[BudgetCategory.FLIGHTS] = 10.0
            adjusted[BudgetCategory.ACCOMMODATION] += excess
    elif trip_duration_days >= 14:
        # Long trip: flights amortized, boost accommodation
        original = adjusted[BudgetCategory.FLIGHTS]
        if original > 15.0:
            excess = original - 15.0
            adjusted[BudgetCategory.FLIGHTS] = 15.0
            adjusted[BudgetCategory.ACCOMMODATION] += excess * 0.6
            adjusted[BudgetCategory.FOOD] += excess * 0.4

    return adjusted


def _apply_cost_index_adjustments(
    percentages: dict[BudgetCategory, float],
    cost_index: float,
) -> dict[BudgetCategory, float]:
    """Scale accommodation and food by cost index, redistribute excess."""
    adjusted = dict(percentages)

    # Only adjust if cost index deviates meaningfully from average
    if abs(cost_index - 1.0) < 0.05:
        return adjusted

    # Scale accommodation and food by cost index
    accom_base = adjusted[BudgetCategory.ACCOMMODATION]
    food_base = adjusted[BudgetCategory.FOOD]

    accom_scaled = accom_base * cost_index
    food_scaled = food_base * cost_index

    # Cap accommodation at 50% and food at 25%
    accom_scaled = min(accom_scaled, 50.0)
    food_scaled = min(food_scaled, 25.0)

    delta = (accom_scaled - accom_base) + (food_scaled - food_base)
    adjusted[BudgetCategory.ACCOMMODATION] = accom_scaled
    adjusted[BudgetCategory.FOOD] = food_scaled

    # Take delta from buffer first, then flights, then activities
    for donor in [BudgetCategory.BUFFER, BudgetCategory.FLIGHTS, BudgetCategory.ACTIVITIES]:
        if delta <= 0:
            break
        available = max(adjusted[donor] - 2.0, 0.0)  # Keep min 2% in each
        take = min(delta, available)
        adjusted[donor] -= take
        delta -= take

    return adjusted


def _distribute_amounts(
    percentages: dict[BudgetCategory, float],
    total_budget: float,
) -> list[BudgetAllocationItem]:
    """Convert percentages to absolute amounts with zero rounding drift.

    Uses integer math: convert to smallest currency unit (cents/dong),
    distribute, then assign remainder to buffer.
    """
    if total_budget == 0.0:
        return [
            BudgetAllocationItem(category=cat, percentage=0.0, amount=0.0)
            for cat in BudgetCategory
        ]

    # Normalize percentages to sum to exactly 100
    pct_total = sum(percentages.values())
    if pct_total != 100.0 and pct_total > 0:
        factor = 100.0 / pct_total
        percentages = {k: v * factor for k, v in percentages.items()}

    # Use integer math to avoid floating-point drift
    # Multiply budget by 100 to work in "cents" (works for VND too -- just
    # means sub-dong precision internally, final output rounds to 2 decimals)
    total_cents = round(total_budget * 100)
    allocated_cents: dict[BudgetCategory, int] = {}

    for cat in BudgetCategory:
        pct = percentages.get(cat, 0.0)
        allocated_cents[cat] = int(total_cents * pct / 100.0)

    # Assign remainder to buffer so total is exact
    remainder = total_cents - sum(allocated_cents.values())
    allocated_cents[BudgetCategory.BUFFER] += remainder

    items = []
    for cat in BudgetCategory:
        amount = allocated_cents[cat] / 100.0
        pct = (amount / total_budget * 100.0) if total_budget > 0 else 0.0
        items.append(BudgetAllocationItem(
            category=cat,
            percentage=round(pct, 2),
            amount=round(amount, 2),
        ))

    return items


def allocate_budget(
    budget_total: float,
    currency: str,
    trip_duration_days: int,
    destinations: list[str] | None = None,
    accommodation_style: str | None = None,
) -> BudgetAllocation:
    """Compute recommended budget split across travel categories.

    Pure function. No LLM calls, no external services.

    Args:
        budget_total: Total trip budget in stated currency.
        currency: ISO 4217 currency code (e.g., "USD", "VND").
        trip_duration_days: Number of days for the trip.
        destinations: List of Vietnam destinations.
        accommodation_style: Optional override (e.g., "luxury", "budget").

    Returns:
        BudgetAllocation with exact amounts summing to budget_total.
    """
    destinations = destinations or []

    # 1. Determine allocation strategy
    if accommodation_style and accommodation_style.lower() in ("luxury", "resort", "5-star"):
        strategy = "resort"
    elif accommodation_style and accommodation_style.lower() in ("budget", "hostel", "backpacker"):
        strategy = "backpacker"
    else:
        strategy = get_destination_style(destinations)

    # Fall back to "standard" if strategy not in base allocations
    if strategy not in BASE_ALLOCATIONS:
        strategy = "standard"

    # 2. Start with base percentages
    percentages = dict(BASE_ALLOCATIONS[strategy])

    # 3. Adjust for trip duration
    percentages = _apply_duration_adjustments(percentages, trip_duration_days)

    # 4. Adjust for destination cost index
    cost_index = get_cost_index(destinations)
    percentages = _apply_cost_index_adjustments(percentages, cost_index)

    # 5. Distribute amounts with zero rounding drift
    items = _distribute_amounts(percentages, budget_total)

    allocation = BudgetAllocation(
        items=items,
        total_budget=budget_total,
        currency=currency,
        trip_duration_days=trip_duration_days,
        destination_cost_index=cost_index,
        allocation_strategy=strategy,
    )

    logger.info(
        "budget.allocated",
        strategy=strategy,
        cost_index=cost_index,
        total_budget=budget_total,
        currency=currency,
        duration_days=trip_duration_days,
        destinations=destinations,
    )

    return allocation
```

### Updated Orchestrator -- Calculation Node

```python
# In agents/orchestrator.py, replace the calculation_node stub:

from app.agents.calculation.budget import allocate_budget
from app.agents.calculation.schemas import CalculationResults

async def calculation_node(state: AdvisoryState) -> dict:
    """Run all calculation sub-agents. Currently: budget allocation only."""
    logger.info("agent.calculation.started", session_id=state.session_id)

    profile = state.traveler_profile
    if profile is None or profile.budget_total is None:
        logger.warning(
            "agent.calculation.skipped",
            session_id=state.session_id,
            reason="missing_budget",
        )
        return {
            "stage": "calculating",
            "errors": [
                *state.errors,
                {"agent": "calculation", "message": "Cannot allocate budget: budget_total is missing from traveler profile"},
            ],
        }

    # Compute trip duration
    if profile.travel_start_date and profile.travel_end_date:
        trip_duration_days = (profile.travel_end_date - profile.travel_start_date).days
        if trip_duration_days < 1:
            trip_duration_days = 1
    else:
        trip_duration_days = 7  # Default assumption
        logger.warning(
            "agent.calculation.default_duration",
            session_id=state.session_id,
            default_days=7,
        )

    budget_allocation = allocate_budget(
        budget_total=profile.budget_total,
        currency=profile.budget_currency or "USD",
        trip_duration_days=trip_duration_days,
        destinations=profile.destination_preferences,
        accommodation_style=profile.accommodation_style,
    )

    results = CalculationResults(budget_allocation=budget_allocation)

    return {"stage": "calculating", "calculations": results}
```

### Unit Test Examples -- `agents/calculation/tests/test_budget.py`

```python
import pytest

from app.agents.calculation.budget import allocate_budget
from app.agents.calculation.schemas import BudgetCategory


class TestZeroBudget:
    def test_zero_budget_all_amounts_zero(self):
        result = allocate_budget(0.0, "USD", 7, ["Hanoi"])
        for item in result.items:
            assert item.amount == 0.0
            assert item.percentage == 0.0

    def test_zero_budget_has_all_categories(self):
        result = allocate_budget(0.0, "USD", 7, ["Hanoi"])
        categories = {item.category for item in result.items}
        assert categories == set(BudgetCategory)


class TestHighBudget:
    def test_high_budget_no_overflow(self):
        result = allocate_budget(100_000.0, "USD", 14, ["Phu Quoc"])
        assert sum(item.amount for item in result.items) == 100_000.0

    def test_vnd_high_budget(self):
        result = allocate_budget(50_000_000.0, "VND", 7, ["Da Nang"])
        assert sum(item.amount for item in result.items) == 50_000_000.0


class TestTripDuration:
    def test_single_day_no_flights(self):
        result = allocate_budget(500.0, "USD", 1, ["Hanoi"])
        flights = next(i for i in result.items if i.category == BudgetCategory.FLIGHTS)
        assert flights.amount == 0.0

    def test_30_day_reduced_flights(self):
        result = allocate_budget(5000.0, "USD", 30, ["Hanoi"])
        flights = next(i for i in result.items if i.category == BudgetCategory.FLIGHTS)
        assert flights.percentage <= 15.0

    def test_two_day_trip_reduced_flights(self):
        result = allocate_budget(1000.0, "USD", 2, ["Hanoi"])
        flights = next(i for i in result.items if i.category == BudgetCategory.FLIGHTS)
        assert flights.percentage <= 10.0


class TestDestinationAdjustment:
    def test_phu_quoc_resort_higher_accommodation(self):
        resort = allocate_budget(3000.0, "USD", 7, ["Phu Quoc"])
        budget = allocate_budget(3000.0, "USD", 7, ["Sapa"])
        resort_accom = next(i for i in resort.items if i.category == BudgetCategory.ACCOMMODATION)
        budget_accom = next(i for i in budget.items if i.category == BudgetCategory.ACCOMMODATION)
        assert resort_accom.percentage > budget_accom.percentage

    def test_phu_quoc_uses_resort_strategy(self):
        result = allocate_budget(3000.0, "USD", 7, ["Phu Quoc"])
        assert result.allocation_strategy == "resort"

    def test_hanoi_uses_urban_strategy(self):
        result = allocate_budget(3000.0, "USD", 7, ["Hanoi"])
        assert result.allocation_strategy == "urban"


class TestRoundingExactness:
    @pytest.mark.parametrize("budget", [999.99, 1234.56, 15_000_000.0, 0.01, 77.77])
    def test_total_matches_exactly(self, budget):
        result = allocate_budget(budget, "USD", 7, ["Da Nang"])
        total = sum(item.amount for item in result.items)
        assert total == budget, f"Expected {budget}, got {total}"


class TestEdgeCases:
    def test_no_destinations_uses_standard(self):
        result = allocate_budget(2000.0, "USD", 7)
        assert result.allocation_strategy == "standard"
        assert result.destination_cost_index == 1.0

    def test_unknown_destination_falls_back(self):
        result = allocate_budget(2000.0, "USD", 7, ["Unknown City"])
        assert result.destination_cost_index == 1.0
        assert result.allocation_strategy == "standard"
```

### Anti-Patterns -- DO NOT

- **DO NOT** call the LLM to compute budget splits -- this is pure math
- **DO NOT** use TypedDict for `CalculationResults` or `BudgetAllocation` -- use Pydantic BaseModel
- **DO NOT** round each category independently and hope they sum to the total -- use the remainder-to-buffer technique
- **DO NOT** import from `agents/profiling/` or any other agent module -- read from `AdvisoryState` shared state only
- **DO NOT** add Qdrant or Redis dependencies -- budget allocation has no Vector Store dependency
- **DO NOT** require a running Ollama instance for unit tests -- mock the LLM service
- **DO NOT** hardcode currency conversion -- work in the stated currency throughout
- **DO NOT** skip the zero-budget edge case -- it must return a valid `BudgetAllocation` with all zeros

### File Structure After This Story

```
backend/app/
├── agents/
│   ├── state.py                           # MODIFIED -- calculations type changed
│   ├── orchestrator.py                    # MODIFIED -- calculation node implemented
│   ├── calculation/
│   │   ├── __init__.py                    # EXISTS (from scaffolding)
│   │   ├── budget.py                      # NEW -- allocation logic
│   │   ├── cost_index.py                  # NEW -- destination cost data
│   │   ├── schemas.py                     # NEW -- BudgetAllocation, CalculationResults
│   │   └── tests/
│   │       ├── __init__.py                # EXISTS (from scaffolding)
│   │       ├── test_budget.py             # NEW -- budget allocation tests
│   │       └── test_cost_index.py         # NEW -- cost index tests
│   └── tests/
│       └── test_orchestrator.py           # MODIFIED -- add calculation integration tests
```

### Dependencies

No new dependencies required. All logic uses Python stdlib + Pydantic (already installed).

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- LangGraph State Convention, AdvisoryState with CalculationResults]
- [Source: _bmad-output/planning-artifacts/architecture.md -- agents/calculation/ directory structure]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Boundary Rules: agents communicate via shared state only]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 3, Story 3.1, party mode unit test callout from Amelia]
- [Source: _bmad-output/project-context.md -- Pydantic BaseModel for state, structlog, errors in state not exceptions]
- [Source: app/agents/state.py -- current AdvisoryState definition]
- [Source: app/schemas/profile.py -- TravelerProfileResponse fields]
- [Source: app/agents/orchestrator.py -- current calculation_node stub]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
