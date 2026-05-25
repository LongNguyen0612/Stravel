# Story 3.4: Travel Insurance Estimation

Status: pending

## Story

As a travel agent,
I want the system to estimate travel insurance needs based on the client's profile and planned activities,
so that I can flag coverage gaps before the client books.

## Acceptance Criteria

1. `agents/calculation/insurance.py` contains the insurance estimation logic
2. High-risk activities (scuba diving, motorbike riding, trekking, rock climbing, bungee jumping, paragliding, caving, white-water rafting) are classified and flagged as requiring additional coverage
3. An estimated premium range (min/max USD per day) is returned based on reference data considering age, destination, duration, and activity risk level
4. Results are written to `AdvisoryState.calculations` under an `insurance` key
5. If the Traveler Profile has no planned activities, the estimation returns a base coverage recommendation without activity surcharges
6. If traveler ages are not provided, the estimation uses a default adult age band (18-59) and logs a warning
7. The estimation handles multiple travelers with different ages, returning per-person and total premium ranges
8. Unit tests cover: single traveler base case, high-risk activity surcharge, multiple age bands, zero-duration trip, missing activities, missing ages, all-high-risk activities, destination risk variation

## Tasks / Subtasks

- [ ] Task 1: Define insurance reference data and risk classifications (AC: #2, #3)
  - [ ] Create `agents/calculation/insurance.py`
  - [ ] Define `ActivityRiskLevel` enum: `LOW`, `MEDIUM`, `HIGH`
  - [ ] Define `ACTIVITY_RISK_CLASSIFICATION` dict mapping activity strings to risk levels:
    - HIGH: scuba diving, motorbike riding, trekking above 3000m, rock climbing, bungee jumping, paragliding, caving, white-water rafting, skydiving
    - MEDIUM: trekking (general), cycling tours, snorkeling, surfing, kayaking, zip-lining
    - LOW: sightseeing, cooking classes, boat tours, temple visits, beach, spa, shopping, night markets, food tours, photography tours
  - [ ] Define `AGE_BAND` categories with base daily premium multipliers:
    - `0-17` (child): 0.7x
    - `18-35` (young adult): 1.0x
    - `36-59` (adult): 1.3x
    - `60-69` (senior): 1.8x
    - `70+` (elderly): 2.5x
  - [ ] Define `DESTINATION_RISK_INDEX` for Vietnam regions:
    - Standard: hanoi, hcmc, da_nang, hoi_an, hue, nha_trang, da_lat, mekong_delta (1.0x)
    - Elevated: sapa, ha_giang, phong_nha (1.15x -- remote/mountainous)
    - Island: phu_quoc, con_dao, cat_ba (1.1x -- limited medical facilities)
  - [ ] Define `BASE_PREMIUM_RANGE` as reference data: min $3.50/day, max $7.00/day per person (standard adult, no high-risk activities, standard destination)
  - [ ] Add `ACTIVITY_SURCHARGE_RATES`:
    - LOW: 0% surcharge
    - MEDIUM: 25% surcharge on base premium
    - HIGH: 60% surcharge on base premium
  - [ ] Define `DURATION_DISCOUNT_TIERS`:
    - 1-7 days: no discount
    - 8-14 days: 5% discount
    - 15-30 days: 10% discount
    - 31+ days: 15% discount

- [ ] Task 2: Implement Pydantic schemas for insurance estimation (AC: #3, #4, #7)
  - [ ] Create `InsuranceCoverageFlag` schema in `agents/calculation/insurance.py`:
    - `activity: str`
    - `risk_level: ActivityRiskLevel`
    - `requires_additional_coverage: bool`
    - `note: str` (e.g., "Scuba diving requires specific dive insurance rider")
  - [ ] Create `TravelerInsuranceEstimate` schema:
    - `age: int`
    - `age_band: str`
    - `base_premium_min_per_day: float`
    - `base_premium_max_per_day: float`
    - `activity_surcharge_pct: float`
    - `destination_multiplier: float`
    - `duration_discount_pct: float`
    - `adjusted_premium_min_per_day: float`
    - `adjusted_premium_max_per_day: float`
    - `total_premium_min: float`
    - `total_premium_max: float`
  - [ ] Create `InsuranceEstimationResult` schema:
    - `traveler_estimates: list[TravelerInsuranceEstimate]`
    - `coverage_flags: list[InsuranceCoverageFlag]`
    - `trip_duration_days: int`
    - `total_premium_range_min: float`
    - `total_premium_range_max: float`
    - `currency: str` (default "USD")
    - `recommended_coverage_type: str` (e.g., "Standard", "Adventure", "Comprehensive")
    - `notes: list[str]`

- [ ] Task 3: Implement core estimation logic (AC: #1, #3, #5, #6, #7)
  - [ ] Implement `classify_activity(activity: str) -> tuple[ActivityRiskLevel, bool]`:
    - Normalize activity string (lowercase, strip whitespace)
    - Match against `ACTIVITY_RISK_CLASSIFICATION` using substring/fuzzy matching
    - Return risk level and whether additional coverage is required (True for HIGH)
    - Default to `LOW` if no match found
  - [ ] Implement `get_age_band(age: int) -> tuple[str, float]`:
    - Map age to band label and premium multiplier
    - Clamp negative ages to 0, warn on ages > 100
  - [ ] Implement `get_destination_risk_multiplier(destinations: list[str]) -> float`:
    - Return the highest multiplier across all destinations
    - Normalize destination names (lowercase, replace spaces with underscores)
    - Default to 1.0x for unknown destinations
  - [ ] Implement `get_duration_discount(duration_days: int) -> float`:
    - Map trip duration to discount percentage
    - Return 0 for zero or negative durations
  - [ ] Implement `estimate_insurance(profile: TravelerProfileResponse) -> InsuranceEstimationResult`:
    - Extract ages from `profile.traveler_ages` or use default [30] with warning
    - Calculate trip duration from `profile.travel_start_date` and `profile.travel_end_date`
    - If dates missing, use 7 days as default with note
    - Classify all activities from `profile.activity_preferences`
    - Determine highest activity risk level across all activities
    - Calculate per-traveler premium ranges considering age band, activity surcharge, destination multiplier, and duration discount
    - Sum all traveler estimates for total premium range
    - Determine `recommended_coverage_type`: "Standard" (no high-risk), "Adventure" (any HIGH activity), "Comprehensive" (multiple HIGH activities or senior travelers with HIGH activities)
    - Round all monetary values to 2 decimal places
    - Return `InsuranceEstimationResult` with all traveler breakdowns and coverage flags
  - [ ] Add structlog logging for estimation with session context

- [ ] Task 4: Integrate with AdvisoryState (AC: #4)
  - [ ] Implement `run_insurance_estimation(state: AdvisoryState) -> dict`:
    - Extract `TravelerProfileResponse` from `state.traveler_profile`
    - If profile is None, append error to state and return unchanged calculations
    - Call `estimate_insurance(profile)`
    - Serialize `InsuranceEstimationResult` to dict
    - Merge into `state.calculations` under the `insurance` key
    - Return updated calculations dict
  - [ ] Ensure function signature is compatible with being called from `agents/calculation/agent.py` (the Calculation Agent node)
  - [ ] Log with `tenant_id` and `session_id` from state

- [ ] Task 5: Write unit tests (AC: #8)
  - [ ] Create `agents/calculation/tests/test_insurance.py`
  - [ ] Test: `test_single_adult_base_case` -- 30-year-old, 7-day trip, sightseeing only, standard destination. Verify premium range is within expected bounds.
  - [ ] Test: `test_high_risk_activity_surcharge` -- scuba diving flagged as HIGH, surcharge applied, `requires_additional_coverage=True`
  - [ ] Test: `test_motorbike_flagged_as_high_risk` -- motorbike riding classified HIGH
  - [ ] Test: `test_trekking_flagged_as_high_risk` -- trekking above 3000m classified HIGH vs general trekking classified MEDIUM
  - [ ] Test: `test_multiple_age_bands` -- family with ages [8, 35, 62], verify each traveler gets correct age band multiplier and per-person estimates differ
  - [ ] Test: `test_zero_duration_trip` -- travel_start_date == travel_end_date, returns minimum 1-day estimate with note
  - [ ] Test: `test_missing_activities` -- profile with no activity_preferences, returns base coverage with no surcharge, no coverage flags
  - [ ] Test: `test_missing_ages` -- profile with traveler_ages=None, defaults to [30], adds warning note
  - [ ] Test: `test_all_high_risk_activities` -- multiple HIGH-risk activities, recommended_coverage_type is "Comprehensive"
  - [ ] Test: `test_destination_risk_variation` -- sapa (elevated) vs hanoi (standard), verify destination multiplier differs
  - [ ] Test: `test_long_trip_duration_discount` -- 21-day trip receives 10% duration discount
  - [ ] Test: `test_premium_rounding` -- all monetary values rounded to 2 decimal places
  - [ ] Test: `test_unknown_activity_defaults_to_low` -- unrecognized activity classified as LOW risk
  - [ ] Test: `test_unknown_destination_defaults_to_standard` -- unrecognized destination uses 1.0x multiplier
  - [ ] Test: `test_state_integration` -- `run_insurance_estimation` writes to `calculations["insurance"]` correctly
  - [ ] Test: `test_state_missing_profile` -- `run_insurance_estimation` with None profile appends error, returns unchanged calculations
  - [ ] All tests pass without LLM, Qdrant, or Redis (pure calculation logic)

- [ ] Task 6: Activity classification edge cases and normalization (AC: #2)
  - [ ] Handle case variations: "Scuba Diving", "SCUBA", "scuba_diving" all classify as HIGH
  - [ ] Handle compound activities: "motorbike tour" matches motorbike HIGH classification
  - [ ] Handle partial matches: "deep sea diving" matches scuba/diving HIGH
  - [ ] Add `ACTIVITY_NOTES` dict with specific warnings per high-risk activity:
    - scuba diving: "Verify dive certification. Most standard policies exclude diving below 30m."
    - motorbike riding: "Requires valid motorcycle license in home country. Unlicensed riding may void coverage."
    - trekking: "Trekking above 3000m elevation (e.g., Fansipan) requires altitude sickness coverage."
    - rock climbing: "Indoor climbing typically covered. Outdoor/free climbing requires adventure rider."
    - paragliding: "Tandem paragliding with licensed operator may have different coverage than solo."
  - [ ] Add test for each normalization edge case

## Dev Notes

### Critical Architecture Constraints

- **Pure calculation -- no LLM, no Vector Store**: This story implements deterministic calculation logic using reference data. No AI inference or RAG retrieval is needed. All premium data comes from hardcoded reference tables.
- **Protocol boundary**: This module does NOT depend on `VectorStoreProtocol` or `LLMServiceProtocol`. It reads from `AdvisoryState.traveler_profile` and writes to `AdvisoryState.calculations`.
- **Unit tests pass without any external services**: All tests are pure Python -- no PostgreSQL, no Qdrant, no Redis, no LLM required.
- **Feature-grouped structure**: File lives at `agents/calculation/insurance.py` with tests at `agents/calculation/tests/test_insurance.py`, following the co-located test pattern.

### AdvisoryState Integration

The `calculations` field in `AdvisoryState` is currently typed as `dict | None`. The insurance estimation result should be stored as:

```python
state.calculations = state.calculations or {}
state.calculations["insurance"] = insurance_result.model_dump()
```

The `calculations` dict will also contain keys from other calculation stories: `budget` (Story 3.1), `accommodation` (Story 3.2), `routing` and `pricing` (Story 3.3). Each calculation module owns its own key.

### TravelerProfileResponse Fields Used

The insurance estimation reads these fields from the profile:

| Field | Type | Used For |
|---|---|---|
| `traveler_ages` | `list[int] \| None` | Age band classification, per-person premium |
| `traveler_count` | `int \| None` | Fallback if ages not provided |
| `travel_start_date` | `date \| None` | Trip duration calculation |
| `travel_end_date` | `date \| None` | Trip duration calculation |
| `destination_preferences` | `list[str] \| None` | Destination risk multiplier |
| `activity_preferences` | `list[str] \| None` | Activity risk classification |

### Premium Calculation Formula

For each traveler:

```
base_min = BASE_PREMIUM_RANGE.min  ($3.50/day)
base_max = BASE_PREMIUM_RANGE.max  ($7.00/day)

age_multiplier = AGE_BAND[age_band].multiplier
activity_surcharge = max(ACTIVITY_SURCHARGE_RATES[risk_level] for each activity)
destination_multiplier = max(DESTINATION_RISK_INDEX[dest] for each destination)
duration_discount = DURATION_DISCOUNT_TIERS[duration_days]

adjusted_min = base_min * age_multiplier * (1 + activity_surcharge) * destination_multiplier * (1 - duration_discount)
adjusted_max = base_max * age_multiplier * (1 + activity_surcharge) * destination_multiplier * (1 - duration_discount)

total_min = adjusted_min * duration_days
total_max = adjusted_max * duration_days
```

Grand total = sum of all traveler `total_min` / `total_max`.

### Activity Risk Classification -- Complete Reference

```python
ACTIVITY_RISK_CLASSIFICATION = {
    # HIGH -- requires additional coverage rider
    "scuba diving": ActivityRiskLevel.HIGH,
    "scuba": ActivityRiskLevel.HIGH,
    "motorbike riding": ActivityRiskLevel.HIGH,
    "motorbike": ActivityRiskLevel.HIGH,
    "motorbike tour": ActivityRiskLevel.HIGH,
    "trekking above 3000m": ActivityRiskLevel.HIGH,
    "rock climbing": ActivityRiskLevel.HIGH,
    "bungee jumping": ActivityRiskLevel.HIGH,
    "paragliding": ActivityRiskLevel.HIGH,
    "caving": ActivityRiskLevel.HIGH,
    "white-water rafting": ActivityRiskLevel.HIGH,
    "skydiving": ActivityRiskLevel.HIGH,

    # MEDIUM -- standard adventure coverage
    "trekking": ActivityRiskLevel.MEDIUM,
    "hiking": ActivityRiskLevel.MEDIUM,
    "cycling tours": ActivityRiskLevel.MEDIUM,
    "cycling": ActivityRiskLevel.MEDIUM,
    "snorkeling": ActivityRiskLevel.MEDIUM,
    "surfing": ActivityRiskLevel.MEDIUM,
    "kayaking": ActivityRiskLevel.MEDIUM,
    "zip-lining": ActivityRiskLevel.MEDIUM,
    "zip lining": ActivityRiskLevel.MEDIUM,

    # LOW -- standard coverage
    "sightseeing": ActivityRiskLevel.LOW,
    "cooking classes": ActivityRiskLevel.LOW,
    "boat tours": ActivityRiskLevel.LOW,
    "temple visits": ActivityRiskLevel.LOW,
    "beach": ActivityRiskLevel.LOW,
    "spa": ActivityRiskLevel.LOW,
    "shopping": ActivityRiskLevel.LOW,
    "night markets": ActivityRiskLevel.LOW,
    "food tours": ActivityRiskLevel.LOW,
    "photography tours": ActivityRiskLevel.LOW,
}
```

### Recommended Coverage Type Logic

```python
high_risk_count = sum(1 for f in coverage_flags if f.risk_level == ActivityRiskLevel.HIGH)
has_senior = any(age >= 60 for age in traveler_ages)

if high_risk_count >= 2 or (high_risk_count >= 1 and has_senior):
    recommended_coverage_type = "Comprehensive"
elif high_risk_count >= 1:
    recommended_coverage_type = "Adventure"
else:
    recommended_coverage_type = "Standard"
```

### SQLAlchemy Async -- MOST COMMON BUG SOURCE

```python
# NEVER use session.exec() with AsyncSession -- use session.execute()
# ALWAYS call .scalars() before .first() or .all()

# WRONG
result = await session.exec(select(Model).where(...))

# CORRECT
result = await session.execute(select(Model).where(...))
item = result.scalars().first()
```

Note: This story does NOT use database queries directly. The profile is already loaded into `AdvisoryState`. This reminder is included for general project consistency.

### Datetime -- CAUSES INSERT FAILURES

```python
# NEVER use timezone-aware datetimes with PostgreSQL TIMESTAMP WITHOUT TIME ZONE
# Use datetime.utcnow(), NOT datetime.now(timezone.utc)
```

Note: This story uses `date` objects (not `datetime`) from the profile for duration calculation. Use `(end_date - start_date).days` for duration.

### File Locations

| File | Purpose |
|---|---|
| `backend/app/agents/calculation/insurance.py` | Insurance estimation logic, reference data, schemas |
| `backend/app/agents/calculation/tests/test_insurance.py` | Unit tests for all estimation scenarios |
| `backend/app/agents/state.py` | AdvisoryState (read -- not modified by this story) |
| `backend/app/schemas/profile.py` | TravelerProfileResponse (read -- not modified by this story) |

### Dependencies

| Dependency | Direction | Notes |
|---|---|---|
| Story 1.3 | Reads from | Uses `AdvisoryState` from `agents/state.py` |
| Story 1.5 | Reads from | Uses confirmed `TravelerProfileResponse` from `schemas/profile.py` |
| Story 3.1 | Sibling | Both write to `AdvisoryState.calculations` under separate keys |
| Story 3.6 | Read by | Proposal Agent reads insurance estimation for budget breakdown |
| Story 4.2 | Related | Compliance checks may reference insurance coverage flags for age restrictions on activities |

### Anti-Patterns -- DO NOT

- **DO NOT** call any LLM for premium estimation -- this is deterministic calculation
- **DO NOT** query the Vector Store -- reference data is hardcoded
- **DO NOT** import from other agent modules (profiling, proposal, compliance)
- **DO NOT** modify `AdvisoryState` schema -- use the existing `calculations: dict | None` field
- **DO NOT** use `from __future__ import annotations` in any file
- **DO NOT** create a `utils.py` file -- all logic belongs in `insurance.py`
- **DO NOT** use `datetime.now(timezone.utc)` for any timestamps
- **DO NOT** hardcode test assertions to exact float values -- use `pytest.approx()` for premium calculations

### References

- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 3, Story 3.4]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Project Structure: agents/calculation/]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Enforcement Guidelines: errors via AdvisoryState.errors]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Implementation Patterns: co-located tests]
- [Source: _bmad-output/project-context.md -- Agent Architecture: Pydantic BaseModel for all state]
- [Source: _bmad-output/project-context.md -- Testing Rules: unit tests pass with PostgreSQL only]
- [Source: backend/app/agents/state.py -- AdvisoryState.calculations: dict | None]
- [Source: backend/app/schemas/profile.py -- TravelerProfileResponse fields]
- [FR-9: Travel Insurance Estimation -- coverage needs based on profile, premium range]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
