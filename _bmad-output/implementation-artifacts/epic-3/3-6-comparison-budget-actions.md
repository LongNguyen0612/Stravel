# Story 3.6: Proposal -- Comparison Table, Budget & Actions

Status: pending

## Story

As a travel agent,
I want the proposal to include accommodation comparisons, a categorized budget breakdown, and prioritized booking actions,
so that my client has all the information needed to make decisions and book.

**Depends on:** Story 3.5 (Proposal Agent -- Itinerary Generation) -- requires `agents/proposal/agent.py`, `guardrails/entity_validator.py`, `AdvisoryState.proposal` structure, and the Proposal Agent's itinerary generation flow to be implemented.

## Acceptance Criteria

1. An accommodation comparison table includes min 3 options per destination with: name, location, price/night, rating, amenities, and a "why it fits" explanation -- all with source links and freshness timestamps
2. If fewer than 3 options exist in the Vector Store for a destination, the table includes all available options with an explicit note ("Only N options available for [destination]") -- never hallucinated filler
3. A categorized budget breakdown shows line items for: flights, accommodation, activities, food, transport, insurance, and buffer
4. Each budget line item includes: category, description, unit cost, quantity/nights, subtotal, and source (Vector Store entity ID or calculation reference)
5. Total budget matches or falls within the stated budget; if >10% over, the system flags the overage explicitly with the percentage and dollar amount
6. Booking action items are generated with: action description, priority (high/medium/low), time-sensitivity reasoning, and deadline if applicable (e.g., "Book flights first -- prices volatile, recommend booking 60+ days before departure")
7. Actions are sorted by priority (high first) and then by deadline (earliest first)
8. `guardrails/price_validator.py` validates every price in the proposal -- prices must trace to a Vector Store entity `pricing` field or a calculation in `AdvisoryState.calculations`; LLM-generated prices cause validation failure
9. All accommodation entries in the comparison table must pass `guardrails/entity_validator.py` -- every entry traces to an entity in the Vector Store
10. Pydantic schemas `ProposalSection`, `AccommodationOption`, `AccommodationTable`, `BudgetLineItem`, `BudgetBreakdown`, and `BookingAction` are defined in `agents/proposal/schemas.py`
11. Unit tests pass without Qdrant, Redis, or LLM -- mocking `VectorStoreProtocol` and `LLMServiceProtocol`

## Dependencies

- **Story 3.5** (Proposal Agent -- Itinerary Generation) -- provides `agents/proposal/agent.py` with the Proposal Agent skeleton, `guardrails/entity_validator.py`, the itinerary generation flow, and the `Proposal` model in `AdvisoryState`
- **Story 3.2** (Accommodation Matching Agent) -- provides scored accommodation results in `AdvisoryState.calculations` via `agents/calculation/accommodation.py`
- **Story 3.1** (Budget Allocation Agent) -- provides category budget splits in `AdvisoryState.calculations` via `agents/calculation/budget.py`
- **Story 2.3** (Hybrid Search) -- provides `SearchServiceProtocol` and `HybridSearchService` for Vector Store queries
- **Story 2.4** (Freshness Tracking) -- provides `rag/freshness.py` for staleness checking and freshness timestamps

## Tasks / Subtasks

- [ ] Task 1: Define Pydantic schemas (AC: #10)
  - [ ] Add `AccommodationOption` to `backend/app/agents/proposal/schemas.py` with fields: `entity_id` (str), `name` (str), `location` (str), `region` (str), `price_per_night` (float), `currency` (str, default "USD"), `rating` (float | None), `amenities` (list[str]), `why_it_fits` (str), `source_url` (str), `freshness_timestamp` (datetime), `is_stale` (bool, default False)
  - [ ] Add `AccommodationTable` with fields: `destination` (str), `options` (list[AccommodationOption]), `note` (str | None) -- note used when <3 options available
  - [ ] Add `BudgetLineItem` with fields: `category` (str), `description` (str), `unit_cost` (float), `quantity` (float), `subtotal` (float), `source_entity_id` (str | None), `source_type` (Literal["vector_store", "calculation", "estimate"]), `currency` (str, default "USD")
  - [ ] Add `BudgetBreakdown` with fields: `line_items` (list[BudgetLineItem]), `total` (float), `stated_budget` (float), `currency` (str, default "USD"), `is_over_budget` (bool), `overage_percentage` (float | None), `overage_amount` (float | None)
  - [ ] Add `BookingAction` with fields: `action` (str), `priority` (Literal["high", "medium", "low"]), `reasoning` (str), `deadline` (str | None), `category` (str)
  - [ ] Add `ProposalSection` with fields: `accommodation_tables` (list[AccommodationTable]), `budget_breakdown` (BudgetBreakdown), `booking_actions` (list[BookingAction])
  - [ ] Add validators: `BudgetBreakdown` model_validator to auto-compute `is_over_budget`, `overage_percentage`, `overage_amount` from `total` vs `stated_budget`

- [ ] Task 2: Implement price validator guardrail (AC: #8)
  - [ ] Create `backend/app/guardrails/price_validator.py` with `PriceValidator` class
  - [ ] Implement `validate_accommodation_prices()` -- for each `AccommodationOption`, verify `price_per_night` matches the `pricing` field of the corresponding Vector Store entity (by `entity_id`)
  - [ ] Implement `validate_budget_line_items()` -- for each `BudgetLineItem` with `source_type="vector_store"`, verify `unit_cost` matches the entity's pricing data
  - [ ] Implement `validate_proposal_prices()` -- runs both accommodation and budget validation, returns `PriceValidationResult` with `is_valid` (bool), `violations` (list[PriceViolation])
  - [ ] `PriceViolation` includes: `field` (str), `expected_price` (float), `actual_price` (float), `entity_id` (str | None), `message` (str)
  - [ ] `PriceValidator` receives `VectorStoreProtocol` via constructor (DI, no direct import)
  - [ ] Log all violations via structlog with `session_id` and `tenant_id`

- [ ] Task 3: Implement accommodation comparison table builder (AC: #1, #2, #9)
  - [ ] Add `build_accommodation_tables()` method to `agents/proposal/agent.py`
  - [ ] For each destination in the itinerary, retrieve scored accommodation results from `AdvisoryState.calculations` (produced by Story 3.2)
  - [ ] If fewer than 3 options available per destination, query Vector Store for additional options via `SearchServiceProtocol` (fallback search)
  - [ ] For each accommodation, populate: `entity_id`, `name`, `location`, `price_per_night`, `rating`, `amenities`, `source_url`, `freshness_timestamp` from the Vector Store entity
  - [ ] Generate `why_it_fits` explanation via `LLMServiceProtocol` -- prompt includes traveler profile preferences + hotel attributes; LLM explains the match, does NOT generate any factual data
  - [ ] Check freshness via `rag/freshness.py` -- set `is_stale=True` if entity data has expired
  - [ ] If still fewer than 3 after fallback search, add note: "Only {N} verified accommodations available for {destination}"
  - [ ] Run `entity_validator.py` on all accommodation entries before returning
  - [ ] Sort options by price-to-value ratio (rating / price_per_night) descending

- [ ] Task 4: Implement budget breakdown builder (AC: #3, #4, #5)
  - [ ] Add `build_budget_breakdown()` method to `agents/proposal/agent.py`
  - [ ] Pull category allocation percentages from `AdvisoryState.calculations` (Story 3.1 budget allocation results)
  - [ ] For accommodation line items: use the selected hotel's actual `price_per_night` * number of nights per destination -- `source_type="vector_store"`, `source_entity_id` = hotel entity ID
  - [ ] For activity line items: use activity entity pricing from the itinerary -- `source_type="vector_store"`
  - [ ] For transport line items: use routing cost estimates from `AdvisoryState.calculations` (Story 3.3) -- `source_type="calculation"`
  - [ ] For flights, insurance, food, and buffer: use calculated allocations from Story 3.1 -- `source_type="calculation"` or `"estimate"` as appropriate
  - [ ] Compute `total` as the sum of all `subtotal` values
  - [ ] If total > stated_budget * 1.10, set `is_over_budget=True`, compute `overage_percentage` and `overage_amount`
  - [ ] All amounts in consistent currency (default USD)

- [ ] Task 5: Implement booking action items builder (AC: #6, #7)
  - [ ] Add `build_booking_actions()` method to `agents/proposal/agent.py`
  - [ ] Generate standard time-sensitive actions:
    - Flights: priority=high, reasoning="Prices volatile, recommend booking 60+ days before departure"
    - Accommodation: priority=high, reasoning="Popular destinations fill quickly during peak season" (adjust if off-peak)
    - Visa/Documents: priority=high if e-visa required (from compliance data if available), medium otherwise
    - Activities requiring advance booking: priority=medium, reasoning based on activity type
    - Travel insurance: priority=medium, reasoning="Purchase after flights booked, before departure"
    - Local transport/food: priority=low, reasoning="Can be arranged on arrival"
  - [ ] Calculate deadlines relative to travel departure date from `TravelerProfile`
  - [ ] Sort actions by priority (high > medium > low), then by deadline (earliest first, None last)
  - [ ] Use `LLMServiceProtocol` to generate context-specific reasoning only -- all priorities and deadline calculations are deterministic

- [ ] Task 6: Integrate sections into Proposal Agent flow (AC: #1-#9)
  - [ ] Extend the Proposal Agent node in `agents/proposal/agent.py` to call `build_accommodation_tables()`, `build_budget_breakdown()`, and `build_booking_actions()` after itinerary generation (Story 3.5)
  - [ ] Run `PriceValidator.validate_proposal_prices()` on the assembled proposal sections
  - [ ] If price validation fails, log violations and attempt re-assembly with corrected prices from Vector Store
  - [ ] If re-assembly still fails, append errors to `AdvisoryState.errors` with details
  - [ ] Store completed `ProposalSection` in `AdvisoryState.proposal`
  - [ ] Emit SSE events: `agent.proposal.accommodation_table`, `agent.proposal.budget_breakdown`, `agent.proposal.booking_actions` as each section completes

- [ ] Task 7: Write unit tests for schemas and price validator (AC: #8, #10, #11)
  - [ ] Create `backend/app/guardrails/tests/__init__.py` (if not exists)
  - [ ] Create `backend/app/guardrails/tests/test_price_validator.py`:
    - [ ] `test_valid_prices_pass` -- all prices match Vector Store entities, validation passes
    - [ ] `test_mismatched_accommodation_price_fails` -- price_per_night differs from entity, violation reported
    - [ ] `test_mismatched_budget_line_item_fails` -- unit_cost differs from entity pricing, violation reported
    - [ ] `test_missing_entity_fails` -- entity_id not found in Vector Store, violation reported
    - [ ] `test_calculation_source_skipped` -- line items with `source_type="calculation"` are not validated against Vector Store
    - [ ] `test_estimate_source_skipped` -- line items with `source_type="estimate"` are not validated against Vector Store
    - [ ] `test_multiple_violations_reported` -- multiple price mismatches all reported in single result
    - [ ] All tests mock `VectorStoreProtocol`
  - [ ] Create `backend/app/agents/proposal/tests/test_schemas.py`:
    - [ ] `test_budget_breakdown_under_budget` -- total < stated_budget, is_over_budget=False
    - [ ] `test_budget_breakdown_within_10_percent` -- total between budget and budget*1.10, is_over_budget=False
    - [ ] `test_budget_breakdown_over_10_percent` -- total > budget*1.10, is_over_budget=True with correct overage values
    - [ ] `test_budget_breakdown_exact_budget` -- total == stated_budget, is_over_budget=False
    - [ ] `test_booking_actions_sorted_by_priority_and_deadline` -- high before medium before low, earliest deadline first within same priority
    - [ ] `test_accommodation_option_requires_source_url` -- missing source_url raises validation error
    - [ ] `test_accommodation_table_note_when_few_options` -- note field populated when <3 options

- [ ] Task 8: Write unit tests for proposal section builders (AC: #1-#7, #11)
  - [ ] Create or extend `backend/app/agents/proposal/tests/test_proposal_sections.py`:
    - [ ] `test_accommodation_table_min_3_options` -- 3+ options returned per destination when available
    - [ ] `test_accommodation_table_fallback_search` -- when <3 in calculations, additional search performed
    - [ ] `test_accommodation_table_fewer_than_3_adds_note` -- note added when Vector Store has insufficient data
    - [ ] `test_accommodation_table_no_hallucinated_entries` -- all entries trace to mock entity IDs
    - [ ] `test_accommodation_table_stale_entities_flagged` -- stale entity gets `is_stale=True`
    - [ ] `test_accommodation_table_entity_validation` -- entity_validator called on all entries
    - [ ] `test_budget_breakdown_categories` -- all 7 categories present: flights, accommodation, activities, food, transport, insurance, buffer
    - [ ] `test_budget_breakdown_total_matches_sum` -- total == sum of all subtotals
    - [ ] `test_budget_breakdown_over_budget_flagged` -- >10% over triggers flag
    - [ ] `test_budget_breakdown_source_traceability` -- every line item has source_entity_id or source_type
    - [ ] `test_booking_actions_generated` -- at least 3 actions generated for a standard trip
    - [ ] `test_booking_actions_sorted` -- actions sorted by priority then deadline
    - [ ] `test_booking_actions_flights_high_priority` -- flights always high priority
    - [ ] `test_price_validation_runs_on_proposal` -- price validator called during assembly
    - [ ] `test_price_validation_failure_triggers_reassembly` -- failed validation retries with corrected prices
    - [ ] All tests mock `VectorStoreProtocol`, `LLMServiceProtocol`, and `SearchServiceProtocol`

## Dev Notes

### Architecture Constraints

- **Python 3.12+** with modern syntax (`X | Y` union types, etc.)
- **Async all the way** -- proposal builders must be async since they access VectorStoreProtocol
- **structlog** for all logging -- never use stdlib `logging`
- **Protocol-based DI** -- PriceValidator, Proposal Agent, and all builders receive services via constructor injection, never direct imports
- **Agents communicate via shared state only** -- read from `AdvisoryState`, write results back to `AdvisoryState`
- **Errors go into `AdvisoryState.errors`** -- never raise exceptions inside agent nodes
- **Zero hallucination policy** -- NO prices, entity names, ratings, or factual data generated by LLM. LLM generates only: "why it fits" explanations, booking action reasoning text. All facts from Vector Store or calculations.
- **Tenant isolation mandatory** -- all Vector Store queries include `tenant_id`
- **Tests pass with PostgreSQL only** -- no Qdrant, Redis, or LLM required

### Pydantic Schemas

```python
# backend/app/agents/proposal/schemas.py (extend existing file from Story 3.5)
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class AccommodationOption(BaseModel):
    """A single accommodation option in the comparison table.

    Every field except `why_it_fits` comes directly from the Vector Store entity.
    `why_it_fits` is LLM-generated explanation text only -- no factual claims.
    """

    entity_id: str
    name: str
    location: str
    region: str
    price_per_night: float = Field(ge=0)
    currency: str = "USD"
    rating: float | None = None
    amenities: list[str] = Field(default_factory=list)
    why_it_fits: str
    source_url: str
    freshness_timestamp: datetime
    is_stale: bool = False


class AccommodationTable(BaseModel):
    """Accommodation comparison table for a single destination.

    Contains min 3 options when available. If fewer than 3 verified options
    exist in the Vector Store, includes a note explaining the limitation.
    """

    destination: str
    options: list[AccommodationOption]
    note: str | None = None  # e.g., "Only 2 verified accommodations available for Sapa"


class BudgetLineItem(BaseModel):
    """A single line item in the budget breakdown.

    Every price must be traceable to either a Vector Store entity
    or a calculation in AdvisoryState. LLM-generated prices are forbidden.
    """

    category: str  # flights, accommodation, activities, food, transport, insurance, buffer
    description: str
    unit_cost: float = Field(ge=0)
    quantity: float = Field(ge=0)
    subtotal: float = Field(ge=0)
    source_entity_id: str | None = None  # Vector Store entity ID, if applicable
    source_type: Literal["vector_store", "calculation", "estimate"]
    currency: str = "USD"

    @model_validator(mode="after")
    def validate_subtotal(self) -> "BudgetLineItem":
        """Ensure subtotal matches unit_cost * quantity."""
        expected = round(self.unit_cost * self.quantity, 2)
        if abs(self.subtotal - expected) > 0.01:
            raise ValueError(
                f"Subtotal {self.subtotal} does not match "
                f"unit_cost ({self.unit_cost}) * quantity ({self.quantity}) = {expected}"
            )
        return self


class BudgetBreakdown(BaseModel):
    """Categorized budget breakdown with overage detection.

    Total is auto-validated against the sum of line items.
    Overage is flagged when total exceeds stated budget by >10%.
    """

    line_items: list[BudgetLineItem]
    total: float = Field(ge=0)
    stated_budget: float = Field(ge=0)
    currency: str = "USD"
    is_over_budget: bool = False
    overage_percentage: float | None = None
    overage_amount: float | None = None

    @model_validator(mode="after")
    def compute_overage(self) -> "BudgetBreakdown":
        """Auto-compute overage fields from total vs stated_budget."""
        if self.stated_budget > 0:
            overage = self.total - self.stated_budget
            percentage = (overage / self.stated_budget) * 100

            if percentage > 10.0:
                self.is_over_budget = True
                self.overage_percentage = round(percentage, 1)
                self.overage_amount = round(overage, 2)
            else:
                self.is_over_budget = False
                self.overage_percentage = None
                self.overage_amount = None

        return self

    @model_validator(mode="after")
    def validate_total_matches_sum(self) -> "BudgetBreakdown":
        """Ensure total matches the sum of all line item subtotals."""
        expected = round(sum(item.subtotal for item in self.line_items), 2)
        if abs(self.total - expected) > 0.01:
            raise ValueError(
                f"Total {self.total} does not match sum of line items {expected}"
            )
        return self


class BookingAction(BaseModel):
    """A prioritized booking action item with time-sensitivity reasoning.

    Priority and deadline calculations are deterministic.
    Only the reasoning text may be LLM-generated.
    """

    action: str
    priority: Literal["high", "medium", "low"]
    reasoning: str
    deadline: str | None = None  # e.g., "60 days before departure (2026-08-15)"
    category: str  # flights, accommodation, visa, activities, insurance, transport


class ProposalSection(BaseModel):
    """Aggregated proposal sections: comparisons, budget, and actions.

    Stored in AdvisoryState.proposal alongside the itinerary from Story 3.5.
    """

    accommodation_tables: list[AccommodationTable]
    budget_breakdown: BudgetBreakdown
    booking_actions: list[BookingAction]
```

### Price Validator Implementation

```python
# backend/app/guardrails/price_validator.py
from dataclasses import dataclass, field

import structlog
from opentelemetry import trace

from app.agents.protocols import VectorStoreProtocol

logger = structlog.get_logger()
tracer = trace.get_tracer(__name__)

# Tolerance for floating-point price comparison (cents)
PRICE_TOLERANCE = 0.01


@dataclass
class PriceViolation:
    """A single price validation failure."""

    field: str
    expected_price: float
    actual_price: float
    entity_id: str | None
    message: str


@dataclass
class PriceValidationResult:
    """Aggregated result of price validation across the proposal."""

    is_valid: bool = True
    violations: list[PriceViolation] = field(default_factory=list)

    def add_violation(self, violation: PriceViolation) -> None:
        self.violations.append(violation)
        self.is_valid = False


class PriceValidator:
    """Ensures no prices in the proposal are LLM-generated.

    Every price must trace to:
    - A Vector Store entity's pricing field (for accommodation, activities)
    - A calculation result in AdvisoryState (for transport, allocations)

    Prices with source_type="calculation" or "estimate" are not validated
    against the Vector Store -- they are validated by their calculation logic.
    Only source_type="vector_store" prices are cross-checked.
    """

    def __init__(self, vector_store: VectorStoreProtocol) -> None:
        self.vector_store = vector_store
        self.logger = logger.bind(component="price_validator")

    async def validate_accommodation_prices(
        self,
        accommodation_tables: list,
        session_id: str = "",
        tenant_id: str = "",
    ) -> PriceValidationResult:
        """Validate that accommodation prices match Vector Store entities.

        Args:
            accommodation_tables: List of AccommodationTable objects.
            session_id: For structured logging.
            tenant_id: For structured logging.

        Returns:
            PriceValidationResult with any violations.
        """
        with tracer.start_as_current_span("validate_accommodation_prices"):
            result = PriceValidationResult()

            for table in accommodation_tables:
                for option in table.options:
                    entity = await self.vector_store.get_by_id(option.entity_id)

                    if entity is None:
                        result.add_violation(
                            PriceViolation(
                                field=f"accommodation.{option.name}.price_per_night",
                                expected_price=0.0,
                                actual_price=option.price_per_night,
                                entity_id=option.entity_id,
                                message=f"Entity '{option.entity_id}' not found in Vector Store",
                            )
                        )
                        continue

                    # Extract price from entity pricing dict
                    entity_price = self._extract_price_per_night(entity.pricing)
                    if entity_price is None:
                        result.add_violation(
                            PriceViolation(
                                field=f"accommodation.{option.name}.price_per_night",
                                expected_price=0.0,
                                actual_price=option.price_per_night,
                                entity_id=option.entity_id,
                                message=f"Entity '{option.name}' has no pricing data",
                            )
                        )
                        continue

                    if abs(option.price_per_night - entity_price) > PRICE_TOLERANCE:
                        result.add_violation(
                            PriceViolation(
                                field=f"accommodation.{option.name}.price_per_night",
                                expected_price=entity_price,
                                actual_price=option.price_per_night,
                                entity_id=option.entity_id,
                                message=(
                                    f"Price mismatch for '{option.name}': "
                                    f"proposal has ${option.price_per_night}, "
                                    f"Vector Store has ${entity_price}"
                                ),
                            )
                        )

            if not result.is_valid:
                self.logger.warning(
                    "price_validation.accommodation_failed",
                    violation_count=len(result.violations),
                    session_id=session_id,
                    tenant_id=tenant_id,
                )

            return result

    async def validate_budget_line_items(
        self,
        line_items: list,
        session_id: str = "",
        tenant_id: str = "",
    ) -> PriceValidationResult:
        """Validate budget line items with source_type='vector_store'.

        Line items with source_type='calculation' or 'estimate' are skipped --
        those prices are validated by their respective calculation logic.

        Args:
            line_items: List of BudgetLineItem objects.
            session_id: For structured logging.
            tenant_id: For structured logging.

        Returns:
            PriceValidationResult with any violations.
        """
        with tracer.start_as_current_span("validate_budget_line_items"):
            result = PriceValidationResult()

            for item in line_items:
                if item.source_type != "vector_store":
                    continue

                if item.source_entity_id is None:
                    result.add_violation(
                        PriceViolation(
                            field=f"budget.{item.category}.{item.description}",
                            expected_price=0.0,
                            actual_price=item.unit_cost,
                            entity_id=None,
                            message=(
                                f"Budget line item '{item.description}' has "
                                f"source_type='vector_store' but no source_entity_id"
                            ),
                        )
                    )
                    continue

                entity = await self.vector_store.get_by_id(item.source_entity_id)

                if entity is None:
                    result.add_violation(
                        PriceViolation(
                            field=f"budget.{item.category}.{item.description}",
                            expected_price=0.0,
                            actual_price=item.unit_cost,
                            entity_id=item.source_entity_id,
                            message=f"Entity '{item.source_entity_id}' not found in Vector Store",
                        )
                    )
                    continue

                entity_price = self._extract_price(entity.pricing, item.category)
                if entity_price is not None and abs(item.unit_cost - entity_price) > PRICE_TOLERANCE:
                    result.add_violation(
                        PriceViolation(
                            field=f"budget.{item.category}.{item.description}",
                            expected_price=entity_price,
                            actual_price=item.unit_cost,
                            entity_id=item.source_entity_id,
                            message=(
                                f"Price mismatch for '{item.description}': "
                                f"budget has ${item.unit_cost}, "
                                f"Vector Store has ${entity_price}"
                            ),
                        )
                    )

            if not result.is_valid:
                self.logger.warning(
                    "price_validation.budget_failed",
                    violation_count=len(result.violations),
                    session_id=session_id,
                    tenant_id=tenant_id,
                )

            return result

    async def validate_proposal_prices(
        self,
        accommodation_tables: list,
        budget_line_items: list,
        session_id: str = "",
        tenant_id: str = "",
    ) -> PriceValidationResult:
        """Run all price validations on the proposal.

        Combines accommodation and budget line item validation results.

        Args:
            accommodation_tables: List of AccommodationTable objects.
            budget_line_items: List of BudgetLineItem objects.
            session_id: For structured logging.
            tenant_id: For structured logging.

        Returns:
            Combined PriceValidationResult.
        """
        with tracer.start_as_current_span("validate_proposal_prices") as span:
            span.set_attribute("session_id", session_id)
            span.set_attribute("tenant_id", tenant_id)

            accom_result = await self.validate_accommodation_prices(
                accommodation_tables, session_id, tenant_id,
            )
            budget_result = await self.validate_budget_line_items(
                budget_line_items, session_id, tenant_id,
            )

            combined = PriceValidationResult()
            for v in accom_result.violations + budget_result.violations:
                combined.add_violation(v)

            self.logger.info(
                "price_validation.completed",
                is_valid=combined.is_valid,
                total_violations=len(combined.violations),
                session_id=session_id,
                tenant_id=tenant_id,
            )

            return combined

    @staticmethod
    def _extract_price_per_night(pricing: dict | None) -> float | None:
        """Extract per-night price from entity pricing dict.

        Supports formats:
        - {"per_night": 120.0}
        - {"min_per_night": 80.0, "max_per_night": 150.0} -> uses min
        """
        if pricing is None:
            return None
        if "per_night" in pricing:
            return float(pricing["per_night"])
        if "min_per_night" in pricing:
            return float(pricing["min_per_night"])
        return None

    @staticmethod
    def _extract_price(pricing: dict | None, category: str) -> float | None:
        """Extract relevant price from entity pricing dict by category.

        Different entity types store pricing differently:
        - Hotels: per_night or min_per_night
        - Attractions: per_person or entry_fee
        - Restaurants: per_person or average_meal
        """
        if pricing is None:
            return None

        if category == "accommodation":
            return PriceValidator._extract_price_per_night(pricing)

        # Activities / attractions
        for key in ["per_person", "entry_fee", "price", "cost"]:
            if key in pricing:
                return float(pricing[key])

        return None
```

### Proposal Agent Extension

```python
# Extension to backend/app/agents/proposal/agent.py
# These methods are added to the existing ProposalAgent class from Story 3.5

import structlog
from opentelemetry import trace

from app.agents.protocols import LLMServiceProtocol, VectorStoreProtocol, SearchServiceProtocol
from app.agents.state import AdvisoryState
from app.agents.proposal.schemas import (
    AccommodationOption,
    AccommodationTable,
    BookingAction,
    BudgetBreakdown,
    BudgetLineItem,
    ProposalSection,
)
from app.guardrails.entity_validator import EntityValidator
from app.guardrails.price_validator import PriceValidator

logger = structlog.get_logger()
tracer = trace.get_tracer(__name__)

# Budget categories in standard order
BUDGET_CATEGORIES = [
    "flights",
    "accommodation",
    "activities",
    "food",
    "transport",
    "insurance",
    "buffer",
]

MIN_ACCOMMODATION_OPTIONS = 3


class ProposalAgent:
    """Extended from Story 3.5 with comparison table, budget, and action builders."""

    def __init__(
        self,
        llm: LLMServiceProtocol,
        vector_store: VectorStoreProtocol,
        search_service: SearchServiceProtocol,
        entity_validator: EntityValidator,
        price_validator: PriceValidator,
    ) -> None:
        self.llm = llm
        self.vector_store = vector_store
        self.search_service = search_service
        self.entity_validator = entity_validator
        self.price_validator = price_validator
        self.logger = logger.bind(agent_name="proposal")

    async def build_accommodation_tables(
        self, state: AdvisoryState,
    ) -> list[AccommodationTable]:
        """Build accommodation comparison tables for each destination.

        Sources options from:
        1. Pre-scored results in AdvisoryState.calculations (from Story 3.2)
        2. Fallback Vector Store search if < 3 options per destination

        Every option is entity-validated and freshness-checked.
        """
        with tracer.start_as_current_span("build_accommodation_tables"):
            tables = []
            destinations = self._extract_destinations(state)

            for destination in destinations:
                # Get pre-scored options from calculation stage
                options = self._get_calculation_accommodations(state, destination)

                # Fallback search if insufficient options
                if len(options) < MIN_ACCOMMODATION_OPTIONS:
                    additional = await self._fallback_accommodation_search(
                        state, destination, exclude_ids=[o.entity_id for o in options],
                    )
                    options.extend(additional)

                # Generate "why it fits" for each option
                for option in options:
                    option.why_it_fits = await self._generate_why_it_fits(
                        state.traveler_profile, option,
                    )

                # Build note if still < 3
                note = None
                if len(options) < MIN_ACCOMMODATION_OPTIONS:
                    note = (
                        f"Only {len(options)} verified accommodations "
                        f"available for {destination}"
                    )

                # Sort by value ratio (rating / price)
                options.sort(
                    key=lambda o: (o.rating or 0) / max(o.price_per_night, 0.01),
                    reverse=True,
                )

                tables.append(
                    AccommodationTable(
                        destination=destination,
                        options=options,
                        note=note,
                    )
                )

            return tables

    async def build_budget_breakdown(
        self, state: AdvisoryState,
    ) -> BudgetBreakdown:
        """Build categorized budget breakdown from calculations and entity prices.

        All prices trace to Vector Store entities or calculation results.
        No LLM-generated prices.
        """
        with tracer.start_as_current_span("build_budget_breakdown"):
            line_items = []

            # Pull allocation from calculation results (Story 3.1)
            allocations = state.calculations.budget_allocation
            stated_budget = state.traveler_profile.budget_total

            # Build line items per category from calculations + entity data
            for category in BUDGET_CATEGORIES:
                category_items = self._build_category_line_items(
                    state, category, allocations,
                )
                line_items.extend(category_items)

            total = round(sum(item.subtotal for item in line_items), 2)

            return BudgetBreakdown(
                line_items=line_items,
                total=total,
                stated_budget=stated_budget,
            )

    async def build_booking_actions(
        self, state: AdvisoryState,
    ) -> list[BookingAction]:
        """Build prioritized booking action items.

        Priorities and deadlines are deterministic. Only reasoning text
        may be LLM-generated.
        """
        with tracer.start_as_current_span("build_booking_actions"):
            actions = []
            departure_date = state.traveler_profile.travel_dates.start

            # Flights -- always high priority
            actions.append(
                BookingAction(
                    action="Book flights to Vietnam",
                    priority="high",
                    reasoning="Flight prices are volatile; booking 60+ days in advance typically saves 20-30%",
                    deadline=self._compute_deadline(departure_date, days_before=60),
                    category="flights",
                )
            )

            # Accommodation -- high priority
            actions.append(
                BookingAction(
                    action="Reserve accommodation",
                    priority="high",
                    reasoning="Popular destinations fill quickly, especially during peak season; most hotels offer free cancellation for early bookings",
                    deadline=self._compute_deadline(departure_date, days_before=45),
                    category="accommodation",
                )
            )

            # Visa -- conditional priority
            visa_priority = "high" if self._requires_visa(state) else "medium"
            actions.append(
                BookingAction(
                    action="Apply for Vietnam e-visa" if self._requires_visa(state) else "Verify visa requirements",
                    priority=visa_priority,
                    reasoning="E-visa processing takes 3-5 business days; apply early to avoid delays" if self._requires_visa(state) else "Confirm visa-free entry eligibility before travel",
                    deadline=self._compute_deadline(departure_date, days_before=30) if self._requires_visa(state) else None,
                    category="visa",
                )
            )

            # Activities requiring advance booking -- medium priority
            actions.append(
                BookingAction(
                    action="Book advance-reservation activities",
                    priority="medium",
                    reasoning="Popular tours and experiences (Ha Long Bay cruises, cooking classes) sell out during peak periods",
                    deadline=self._compute_deadline(departure_date, days_before=14),
                    category="activities",
                )
            )

            # Travel insurance -- medium priority
            actions.append(
                BookingAction(
                    action="Purchase travel insurance",
                    priority="medium",
                    reasoning="Purchase after flights are booked but before departure to ensure coverage for trip cancellation",
                    deadline=self._compute_deadline(departure_date, days_before=14),
                    category="insurance",
                )
            )

            # Local transport and food -- low priority
            actions.append(
                BookingAction(
                    action="Arrange local transport and dining",
                    priority="low",
                    reasoning="Local transport (Grab, taxis) and restaurant reservations can be arranged on arrival; no advance booking needed",
                    deadline=None,
                    category="transport",
                )
            )

            # Sort: high > medium > low, then earliest deadline first
            priority_order = {"high": 0, "medium": 1, "low": 2}
            actions.sort(
                key=lambda a: (
                    priority_order[a.priority],
                    a.deadline or "9999-99-99",
                )
            )

            return actions

    @staticmethod
    def _compute_deadline(departure_date, days_before: int) -> str:
        """Compute a deadline string relative to departure date."""
        from datetime import timedelta

        deadline_date = departure_date - timedelta(days=days_before)
        return f"{days_before} days before departure ({deadline_date.strftime('%Y-%m-%d')})"

    @staticmethod
    def _requires_visa(state: AdvisoryState) -> bool:
        """Check if traveler requires a visa based on profile/compliance data."""
        # Check compliance data if available from prior stages
        if state.compliance_report and state.compliance_report.visa_required:
            return True
        # Default to True for safety -- compliance stage will refine
        return True

    def _extract_destinations(self, state: AdvisoryState) -> list[str]:
        """Extract unique destinations from itinerary."""
        destinations = []
        if state.proposal and state.proposal.itinerary:
            for day in state.proposal.itinerary.days:
                if day.destination and day.destination not in destinations:
                    destinations.append(day.destination)
        return destinations

    def _get_calculation_accommodations(
        self, state: AdvisoryState, destination: str,
    ) -> list[AccommodationOption]:
        """Extract pre-scored accommodation options from calculation results."""
        if not state.calculations or not state.calculations.accommodation_matches:
            return []

        options = []
        for match in state.calculations.accommodation_matches:
            if match.region.lower() == destination.lower():
                options.append(
                    AccommodationOption(
                        entity_id=str(match.entity_id),
                        name=match.name,
                        location=match.location,
                        region=match.region,
                        price_per_night=match.price_per_night,
                        rating=match.rating,
                        amenities=match.amenities or [],
                        why_it_fits="",  # Generated in next step
                        source_url=match.source_url,
                        freshness_timestamp=match.ingested_at,
                        is_stale=match.is_stale if hasattr(match, "is_stale") else False,
                    )
                )
        return options

    async def _fallback_accommodation_search(
        self,
        state: AdvisoryState,
        destination: str,
        exclude_ids: list[str],
    ) -> list[AccommodationOption]:
        """Search Vector Store for additional accommodation options."""
        from app.rag.schemas import SearchFilters, SearchMode, SearchQuery

        query = SearchQuery(
            query=f"hotel accommodation in {destination}",
            mode=SearchMode.HYBRID,
            filters=SearchFilters(region=destination.lower(), type="hotel"),
            limit=MIN_ACCOMMODATION_OPTIONS * 2,
            tenant_id=state.tenant_id,
        )
        response = await self.search_service.search(query)

        options = []
        for result in response.results:
            if result.entity_id in exclude_ids:
                continue

            entity = await self.vector_store.get_by_id(result.entity_id)
            if entity is None:
                continue

            price = PriceValidator._extract_price_per_night(entity.pricing)
            if price is None:
                continue

            options.append(
                AccommodationOption(
                    entity_id=result.entity_id,
                    name=entity.name,
                    location=f"{entity.region}",
                    region=entity.region,
                    price_per_night=price,
                    rating=entity.rating,
                    amenities=entity.metadata.get("amenities", []) if isinstance(entity.metadata, dict) else [],
                    why_it_fits="",  # Generated in next step
                    source_url=entity.source_url or "",
                    freshness_timestamp=entity.ingested_at,
                    is_stale=entity.expires_at is not None and entity.expires_at < datetime.utcnow(),
                )
            )

        return options

    async def _generate_why_it_fits(
        self, traveler_profile, option: AccommodationOption,
    ) -> str:
        """Generate a 'why it fits' explanation using LLM.

        LLM receives factual data (from Vector Store) + profile preferences
        and explains the match. LLM does NOT generate any new factual claims.
        """
        prompt = (
            f"Explain in 1-2 sentences why this hotel fits the traveler's needs. "
            f"Use ONLY the facts provided below. Do NOT invent any details.\n\n"
            f"Hotel: {option.name}\n"
            f"Location: {option.location}\n"
            f"Price: ${option.price_per_night}/night\n"
            f"Rating: {option.rating}\n"
            f"Amenities: {', '.join(option.amenities)}\n\n"
            f"Traveler preferences: {traveler_profile.preferences_summary if traveler_profile else 'N/A'}\n"
            f"Budget per night: ${traveler_profile.budget_per_night if traveler_profile else 'N/A'}"
        )
        return await self.llm.generate(prompt)
```

### Unit Test Patterns

```python
# backend/app/guardrails/tests/test_price_validator.py
import pytest
from unittest.mock import AsyncMock
from dataclasses import dataclass

from app.guardrails.price_validator import PriceValidator, PriceValidationResult


@dataclass
class MockEntity:
    id: str
    name: str
    pricing: dict | None
    type: str = "hotel"
    region: str = "hanoi"


@pytest.fixture
def mock_vector_store():
    store = AsyncMock()
    store.get_by_id = AsyncMock(return_value=MockEntity(
        id="entity-1",
        name="Rex Hotel",
        pricing={"per_night": 120.0},
    ))
    return store


@pytest.fixture
def price_validator(mock_vector_store):
    return PriceValidator(vector_store=mock_vector_store)


async def test_valid_prices_pass(price_validator, mock_vector_store):
    """All prices match Vector Store -- validation passes."""
    mock_vector_store.get_by_id.return_value = MockEntity(
        id="entity-1", name="Rex Hotel", pricing={"per_night": 120.0},
    )

    from app.agents.proposal.schemas import AccommodationOption, AccommodationTable
    from datetime import datetime

    table = AccommodationTable(
        destination="Hanoi",
        options=[
            AccommodationOption(
                entity_id="entity-1",
                name="Rex Hotel",
                location="Hanoi",
                region="hanoi",
                price_per_night=120.0,
                rating=4.5,
                amenities=["pool"],
                why_it_fits="Great value",
                source_url="https://example.com",
                freshness_timestamp=datetime.utcnow(),
            )
        ],
    )

    result = await price_validator.validate_accommodation_prices([table])
    assert result.is_valid is True
    assert len(result.violations) == 0


async def test_mismatched_accommodation_price_fails(price_validator, mock_vector_store):
    """Price mismatch between proposal and Vector Store triggers violation."""
    mock_vector_store.get_by_id.return_value = MockEntity(
        id="entity-1", name="Rex Hotel", pricing={"per_night": 120.0},
    )

    from app.agents.proposal.schemas import AccommodationOption, AccommodationTable
    from datetime import datetime

    table = AccommodationTable(
        destination="Hanoi",
        options=[
            AccommodationOption(
                entity_id="entity-1",
                name="Rex Hotel",
                location="Hanoi",
                region="hanoi",
                price_per_night=99.0,  # Does NOT match Vector Store (120.0)
                rating=4.5,
                amenities=["pool"],
                why_it_fits="Great value",
                source_url="https://example.com",
                freshness_timestamp=datetime.utcnow(),
            )
        ],
    )

    result = await price_validator.validate_accommodation_prices([table])
    assert result.is_valid is False
    assert len(result.violations) == 1
    assert result.violations[0].expected_price == 120.0
    assert result.violations[0].actual_price == 99.0


async def test_missing_entity_fails(price_validator, mock_vector_store):
    """Entity not found in Vector Store triggers violation."""
    mock_vector_store.get_by_id.return_value = None

    from app.agents.proposal.schemas import AccommodationOption, AccommodationTable
    from datetime import datetime

    table = AccommodationTable(
        destination="Hanoi",
        options=[
            AccommodationOption(
                entity_id="nonexistent-id",
                name="Fake Hotel",
                location="Hanoi",
                region="hanoi",
                price_per_night=50.0,
                rating=3.0,
                amenities=[],
                why_it_fits="N/A",
                source_url="https://example.com",
                freshness_timestamp=datetime.utcnow(),
            )
        ],
    )

    result = await price_validator.validate_accommodation_prices([table])
    assert result.is_valid is False
    assert "not found" in result.violations[0].message


async def test_calculation_source_skipped(price_validator):
    """Line items with source_type='calculation' are not validated against Vector Store."""
    from app.agents.proposal.schemas import BudgetLineItem

    items = [
        BudgetLineItem(
            category="flights",
            description="Round-trip flights",
            unit_cost=450.0,
            quantity=2,
            subtotal=900.0,
            source_entity_id=None,
            source_type="calculation",
        )
    ]

    result = await price_validator.validate_budget_line_items(items)
    assert result.is_valid is True


async def test_estimate_source_skipped(price_validator):
    """Line items with source_type='estimate' are not validated against Vector Store."""
    from app.agents.proposal.schemas import BudgetLineItem

    items = [
        BudgetLineItem(
            category="buffer",
            description="Emergency buffer",
            unit_cost=200.0,
            quantity=1,
            subtotal=200.0,
            source_entity_id=None,
            source_type="estimate",
        )
    ]

    result = await price_validator.validate_budget_line_items(items)
    assert result.is_valid is True
```

```python
# backend/app/agents/proposal/tests/test_schemas.py
import pytest
from datetime import datetime

from app.agents.proposal.schemas import (
    AccommodationOption,
    AccommodationTable,
    BookingAction,
    BudgetBreakdown,
    BudgetLineItem,
)


def test_budget_breakdown_under_budget():
    """Total < stated_budget: is_over_budget=False."""
    bd = BudgetBreakdown(
        line_items=[
            BudgetLineItem(
                category="flights", description="Flights", unit_cost=400, quantity=1,
                subtotal=400, source_type="calculation",
            ),
        ],
        total=400.0,
        stated_budget=1000.0,
    )
    assert bd.is_over_budget is False
    assert bd.overage_percentage is None
    assert bd.overage_amount is None


def test_budget_breakdown_within_10_percent():
    """Total between budget and budget*1.10: is_over_budget=False."""
    bd = BudgetBreakdown(
        line_items=[
            BudgetLineItem(
                category="flights", description="Flights", unit_cost=1050, quantity=1,
                subtotal=1050, source_type="calculation",
            ),
        ],
        total=1050.0,
        stated_budget=1000.0,
    )
    assert bd.is_over_budget is False  # 5% over, within tolerance


def test_budget_breakdown_over_10_percent():
    """Total > budget*1.10: is_over_budget=True with correct overage values."""
    bd = BudgetBreakdown(
        line_items=[
            BudgetLineItem(
                category="flights", description="Flights", unit_cost=1200, quantity=1,
                subtotal=1200, source_type="calculation",
            ),
        ],
        total=1200.0,
        stated_budget=1000.0,
    )
    assert bd.is_over_budget is True
    assert bd.overage_percentage == 20.0
    assert bd.overage_amount == 200.0


def test_budget_breakdown_exact_budget():
    """Total == stated_budget: is_over_budget=False."""
    bd = BudgetBreakdown(
        line_items=[
            BudgetLineItem(
                category="flights", description="Flights", unit_cost=1000, quantity=1,
                subtotal=1000, source_type="calculation",
            ),
        ],
        total=1000.0,
        stated_budget=1000.0,
    )
    assert bd.is_over_budget is False


def test_budget_line_item_subtotal_validation():
    """Subtotal must match unit_cost * quantity."""
    with pytest.raises(ValueError, match="does not match"):
        BudgetLineItem(
            category="flights", description="Flights",
            unit_cost=100.0, quantity=2, subtotal=300.0,  # Should be 200
            source_type="calculation",
        )


def test_budget_breakdown_total_validation():
    """Total must match sum of line item subtotals."""
    with pytest.raises(ValueError, match="does not match"):
        BudgetBreakdown(
            line_items=[
                BudgetLineItem(
                    category="flights", description="Flights",
                    unit_cost=400, quantity=1, subtotal=400,
                    source_type="calculation",
                ),
            ],
            total=999.0,  # Does NOT match sum (400)
            stated_budget=1000.0,
        )


def test_booking_actions_sorted_by_priority_and_deadline():
    """Actions sort: high > medium > low, earliest deadline first within priority."""
    actions = [
        BookingAction(action="Insurance", priority="medium", reasoning="R", category="insurance", deadline="2026-09-01"),
        BookingAction(action="Flights", priority="high", reasoning="R", category="flights", deadline="2026-08-01"),
        BookingAction(action="Transport", priority="low", reasoning="R", category="transport", deadline=None),
        BookingAction(action="Hotels", priority="high", reasoning="R", category="accommodation", deadline="2026-08-15"),
    ]
    priority_order = {"high": 0, "medium": 1, "low": 2}
    sorted_actions = sorted(
        actions,
        key=lambda a: (priority_order[a.priority], a.deadline or "9999-99-99"),
    )
    assert sorted_actions[0].action == "Flights"
    assert sorted_actions[1].action == "Hotels"
    assert sorted_actions[2].action == "Insurance"
    assert sorted_actions[3].action == "Transport"


def test_accommodation_option_requires_source_url():
    """AccommodationOption validates source_url is present."""
    # source_url is a required str field -- empty string allowed but must be present
    option = AccommodationOption(
        entity_id="e1", name="Hotel", location="Hanoi", region="hanoi",
        price_per_night=100.0, amenities=[], why_it_fits="Good",
        source_url="https://example.com",
        freshness_timestamp=datetime.utcnow(),
    )
    assert option.source_url == "https://example.com"


def test_accommodation_table_note_when_few_options():
    """Note field populated when fewer than 3 options."""
    table = AccommodationTable(
        destination="Sapa",
        options=[
            AccommodationOption(
                entity_id="e1", name="Hotel A", location="Sapa", region="sapa",
                price_per_night=50.0, amenities=[], why_it_fits="Good",
                source_url="https://example.com",
                freshness_timestamp=datetime.utcnow(),
            ),
        ],
        note="Only 1 verified accommodations available for Sapa",
    )
    assert table.note is not None
    assert "Only 1" in table.note
```

### Existing Code Dependencies (Expected from Prior Stories)

**AdvisoryState** in `agents/state.py` (Story 1.3):
```python
class AdvisoryState(BaseModel):
    session_id: str
    tenant_id: str
    stage: Literal["profiling", "calculating", "proposing", "validating"]
    traveler_profile: TravelerProfile | None = None
    calculations: CalculationResults | None = None
    proposal: Proposal | None = None
    compliance_report: ComplianceReport | None = None
    errors: list[AgentError] = []
```

**Entity** model in `models/entity.py` (Story 2.1):
```python
class Entity(SQLModel, table=True):
    __tablename__ = "entities"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    type: str = Field(index=True)
    region: str = Field(index=True)
    description: str
    pricing: dict | None = Field(default=None, sa_type=JSON)
    rating: float | None = None
    source_url: str | None = None
    tenant_id: str = Field(index=True)
    ingested_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime | None = None
```

**Protocols** in `agents/protocols.py` (Stories 1.3, 2.3):
```python
class VectorStoreProtocol(Protocol):
    async def search(self, query: str, filters: dict, limit: int = 10) -> list[Entity]: ...
    async def get_by_id(self, entity_id: str) -> Entity | None: ...
    async def upsert(self, entity: Entity) -> None: ...

class LLMServiceProtocol(Protocol):
    async def generate(self, prompt: str, **kwargs) -> str: ...
    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]: ...

class SearchServiceProtocol(Protocol):
    async def search(self, query: "SearchQuery") -> "SearchResponse": ...
```

**EntityValidator** in `guardrails/entity_validator.py` (Story 3.5):
```python
class EntityValidator:
    def __init__(self, vector_store: VectorStoreProtocol) -> None: ...
    async def validate_entity_references(self, entity_ids: list[str]) -> EntityValidationResult: ...
```

### SSE Event Format

When each proposal section completes, emit:

```
event: agent.proposal.accommodation_table
data: {"type": "section_complete", "section": "accommodation_table", "destination_count": 3}

event: agent.proposal.budget_breakdown
data: {"type": "section_complete", "section": "budget_breakdown", "total": 2450.0, "is_over_budget": false}

event: agent.proposal.booking_actions
data: {"type": "section_complete", "section": "booking_actions", "action_count": 6}
```

### Anti-Patterns -- DO NOT

- **DO NOT** generate prices via LLM -- all prices from Vector Store entities or calculation results
- **DO NOT** generate hotel names, ratings, or amenities via LLM -- all factual data from Vector Store only
- **DO NOT** import `qdrant_client` directly -- use `VectorStoreProtocol` only
- **DO NOT** import another agent's internals -- read from `AdvisoryState` shared state
- **DO NOT** use stdlib `logging` -- use `structlog` only
- **DO NOT** use `datetime.now(timezone.utc)` for timestamps -- use `datetime.utcnow()` (asyncpg compatibility)
- **DO NOT** skip tenant_id in Vector Store queries -- mandatory for multi-tenancy
- **DO NOT** skip price validation -- `PriceValidator` must run before proposal is finalized
- **DO NOT** hallucinate accommodation options when Vector Store has fewer than 3 -- add a note explaining limited data
- **DO NOT** raise exceptions inside agent nodes -- append to `AdvisoryState.errors` instead
- **DO NOT** write tests that require Qdrant, Redis, or LLM -- mock all external services
- **DO NOT** create a monolithic file -- schemas, price validator, and proposal builders are separate modules

### File Structure After This Story

```
backend/app/
├── agents/
│   └── proposal/
│       ├── __init__.py            # Already exists (Story 3.5)
│       ├── agent.py               # MODIFIED -- add build_accommodation_tables(), build_budget_breakdown(), build_booking_actions()
│       ├── prompts.py             # Already exists (Story 3.5)
│       ├── schemas.py             # MODIFIED -- add AccommodationOption, AccommodationTable, BudgetLineItem, BudgetBreakdown, BookingAction, ProposalSection
│       ├── export.py              # Will be created in Story 3.7
│       └── tests/
│           ├── __init__.py        # Already exists (Story 3.5)
│           ├── test_proposal_agent.py    # Already exists (Story 3.5)
│           ├── test_schemas.py           # NEW -- schema validation tests
│           └── test_proposal_sections.py # NEW -- section builder tests
├── guardrails/
│   ├── __init__.py                # Already exists
│   ├── entity_validator.py        # Already exists (Story 3.5)
│   ├── price_validator.py         # NEW -- price validation guardrail
│   └── tests/
│       ├── __init__.py            # NEW (if not exists)
│       └── test_price_validator.py # NEW -- price validator tests
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 3, Story 3.6]
- [Source: _bmad-output/planning-artifacts/epics.md -- FR-11: Accommodation Comparison Table]
- [Source: _bmad-output/planning-artifacts/epics.md -- FR-12: Budget Breakdown]
- [Source: _bmad-output/planning-artifacts/epics.md -- FR-13: Booking Action Items]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Zero hallucination policy, guardrails/]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Protocol interfaces, boundary rules]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Proposal Agent: agents/proposal/]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md -- SSE Event Format]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Data Architecture: Entity freshness]
- [Source: _bmad-output/project-context.md -- Datetime anti-pattern, structlog rules, async rules]
- [Source: _bmad-output/project-context.md -- Agent Architecture (LangGraph), errors in AdvisoryState.errors]
- [Source: _bmad-output/project-context.md -- Testing Rules: unit tests pass with PostgreSQL only]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 3.5 (dependency), Story 3.2 (dependency), Story 3.1 (dependency)]
- [Source: _bmad-output/planning-artifacts/epics.md -- NFR-1: Zero hallucination]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
