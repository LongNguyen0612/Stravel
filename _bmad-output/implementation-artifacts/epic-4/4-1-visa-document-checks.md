# Story 4.1: Visa & Document Compliance Checks

Status: draft

## Story

As a travel agent,
I want the system to validate visa requirements and passport validity for my client's nationality,
so that my client is not stranded at a border or denied entry.

**Depends on:** Story 2.5 (Regulatory Data Ingestion -- `agents/compliance/rules/vietnam_visa.json` exists and is loaded via `load_visa_rules()`), Story 1.3 (LangGraph Orchestrator -- provides `AdvisoryState`, `LLMServiceProtocol`)

**FRs implemented:** FR-15 (Visa Requirement Validation), FR-22 (Passport Validity Check)
**FRs partially advanced:** FR-23 (Compliance Gate -- produces visa/passport flags that feed into the gate in Story 4.4)

## Acceptance Criteria

### AC-1: Visa Agent Module Structure
**Given** the compliance agent module exists at `agents/compliance/`
**When** the visa and passport modules are inspected
**Then** they contain:
- `agents/compliance/visa.py` -- visa requirement lookup and Phu Quoc trap detection
- `agents/compliance/passport.py` -- passport validity checking
- `agents/compliance/schemas.py` -- `VisaCheckResult`, `PassportCheckResult`, `ComplianceFlag`, and related Pydantic models
- `agents/compliance/tests/test_visa.py` -- unit tests for visa checks
- `agents/compliance/tests/test_passport.py` -- unit tests for passport checks

### AC-2: Visa Lookup by Country Code
**Given** a Traveler Profile with `nationalities` field containing one or more country codes (ISO 3166-1 alpha-2)
**When** `check_visa_requirements(country_code, destinations, travel_dates)` is invoked
**Then** the system loads the visa rules from `agents/compliance/rules/vietnam_visa.json` via `load_visa_rules()`
**And** looks up the rule matching the traveler's `country_code`
**And** correctly identifies the visa category:
- `visa_free_45` -- 45-day visa-free (DE, FR, GB, IT, ES, JP, KR, RU, DK, SE)
- `visa_free_30` -- 30-day ASEAN visa-free (TH, SG, MY, ID, PH)
- `e_visa` -- e-visa required, 90 days (AU, US, CA, CN, IN, BR, NZ)
**And** the result includes: `visa_type`, `duration_days`, `cost_usd`, `processing_days`, `description`, `application_url`, `deadline` (relative to `travel_start_date`)

### AC-3: Phu Quoc Special Case (Trap Detection)
**Given** a Traveler Profile with a nationality that requires an e-visa (e.g., AU) and `phu_quoc_exception: true` in the visa rule
**When** the itinerary includes ONLY Phu Quoc island destinations
**Then** the system returns a `visa_free_phu_quoc` result with 30-day visa-free status and a warning: "Visa-free entry valid only while staying on Phu Quoc island. If you leave the island for mainland Vietnam, an e-visa is required."

**Given** a Traveler Profile with a nationality that requires an e-visa (e.g., AU) and `phu_quoc_exception: true`
**When** the itinerary includes Phu Quoc AND any mainland destination (e.g., HCMC, Hanoi, Da Nang)
**Then** the system returns the standard `e_visa` result (NOT the Phu Quoc exception)
**And** the result includes a specific `ComplianceFlag` with `severity: "block"` and message: "Phu Quoc visa-free entry does not apply when combined with mainland destinations. E-visa required for entire trip."

**Given** a Traveler Profile with a nationality that is visa-free (e.g., DE, `phu_quoc_exception: false`)
**When** the itinerary includes Phu Quoc and/or mainland destinations
**Then** the Phu Quoc exception logic is not triggered (irrelevant -- already visa-free)

### AC-4: Unknown Nationality Handling
**Given** a Traveler Profile with a nationality code that does not exist in `vietnam_visa.json`
**When** `check_visa_requirements()` is invoked
**Then** the system returns a result with `visa_type: "unknown"` and `requires_manual_verification: true`
**And** the result message is: "Visa requirements for nationality '{country_code}' not found in our database. Manual verification required before booking."
**And** the result produces a `ComplianceFlag` with `severity: "warning"` (not a block -- the agent can override after manual verification)
**And** the system never guesses or fabricates visa requirements for unknown nationalities

### AC-5: Passport 6-Month Validity Check
**Given** a Traveler Profile with `passport_expiry_date` set
**When** `check_passport_validity(passport_expiry_date, travel_start_date)` is invoked
**Then** the system checks whether the passport is valid for at least 6 months beyond `travel_start_date`
**And** if the passport expires within 6 months of departure, the result includes:
- `is_valid: false`
- `months_remaining` (calculated)
- `ComplianceFlag` with `severity: "block"` and message: "Passport expires on {expiry_date} -- only {months_remaining} months before departure. Vietnam requires 6 months validity. Renewal required before travel."
- `renewal_urgency` classification: "critical" if <2 months, "urgent" if 2-4 months, "advisory" if 4-6 months
**And** if the passport is valid for 6+ months, the result includes `is_valid: true` with no compliance flag

### AC-6: Missing Passport Expiry Date
**Given** a Traveler Profile where `passport_expiry_date` is `None`
**When** `check_passport_validity()` is invoked
**Then** the system returns `is_valid: None` (not false -- not verified, not failed)
**And** the result includes a `ComplianceFlag` with `severity: "warning"` and message: "Passport validity not verified -- expiry date not provided. Vietnam requires passport valid for 6+ months beyond entry date."
**And** the system does NOT block the proposal for missing passport data (it is a warning, not a block)

### AC-7: Multi-Nationality Support
**Given** a Traveler Profile with multiple entries in `nationalities` (e.g., a group with DE and AU travelers)
**When** `check_visa_requirements()` is invoked
**Then** the system checks visa requirements for EACH nationality separately
**And** the result aggregates all checks, returning the most restrictive visa requirement
**And** if any traveler requires an e-visa, the group result flags this with per-nationality detail

### AC-8: Application Deadline Calculation
**Given** a visa check result with `processing_days > 0` and a `travel_start_date`
**When** the result is generated
**Then** the `deadline` field is calculated as `travel_start_date - processing_days - 7` (7-day safety buffer)
**And** if the deadline has already passed relative to today, the `ComplianceFlag` severity escalates to `"block"` with message: "E-visa application deadline has passed. Apply immediately -- processing takes {processing_days} business days."

### AC-9: Visa Check Integration with AdvisoryState
**Given** the visa and passport checks have completed
**When** results are written to `AdvisoryState`
**Then** the results are stored in `AdvisoryState.compliance_report` under a `visa_checks` key
**And** all `ComplianceFlag` entries are aggregated for the Compliance Gate (Story 4.4)
**And** errors during check execution are appended to `AdvisoryState.errors` (never raised as exceptions)

### AC-10: Unit Test Coverage
**Given** the test suite at `agents/compliance/tests/test_visa.py` and `agents/compliance/tests/test_passport.py`
**When** tests are run with `pytest`
**Then** the following test cases pass:
- Visa-free nationality (DE) returns correct visa_free_45 result
- E-visa nationality (AU) returns correct e_visa result with cost and processing time
- AU with Phu Quoc only returns visa_free_phu_quoc exception
- AU with Phu Quoc + HCMC returns e_visa (trap detected, no exception)
- DE with Phu Quoc + mainland returns visa_free_45 (exception irrelevant)
- Unknown nationality returns manual_verification_required
- Passport valid for 8 months returns is_valid: true
- Passport expiring in 3 months returns is_valid: false with "urgent" renewal
- Passport expiring in 1 month returns is_valid: false with "critical" renewal
- Missing passport_expiry_date returns warning (not block)
- Multi-nationality group aggregation
- Deadline calculation with past deadline escalation
**And** all tests pass without Ollama, Qdrant, or Redis (unit tests only)

## Tasks

- [ ] Task 1: Define compliance Pydantic schemas (AC: #1, #9)
  - [ ] Create `agents/compliance/schemas.py` with:
    - `VisaType` enum: `VISA_FREE_45`, `VISA_FREE_30`, `E_VISA`, `VISA_FREE_PHU_QUOC`, `UNKNOWN`
    - `ComplianceSeverity` enum: `PASS`, `WARNING`, `BLOCK`
    - `ComplianceFlag` model: `check_name: str`, `severity: ComplianceSeverity`, `message: str`, `details: dict | None`, `resolution_guidance: str | None`
    - `VisaCheckResult` model: `country_code: str`, `nationality: str | None`, `visa_type: VisaType`, `duration_days: int | None`, `cost_usd: float`, `processing_days: int`, `description: str`, `application_url: str | None`, `deadline: date | None`, `requires_manual_verification: bool`, `phu_quoc_exception_applied: bool`, `flags: list[ComplianceFlag]`
    - `PassportCheckResult` model: `is_valid: bool | None`, `passport_expiry_date: date | None`, `travel_start_date: date | None`, `months_remaining: float | None`, `renewal_urgency: str | None`, `flags: list[ComplianceFlag]`
    - `VisaComplianceReport` model: `visa_results: list[VisaCheckResult]`, `passport_result: PassportCheckResult | None`, `overall_flags: list[ComplianceFlag]`

- [ ] Task 2: Implement visa requirement checker (AC: #2, #3, #4, #7, #8)
  - [ ] Create `agents/compliance/visa.py` with:
    - `_load_visa_rules() -> dict[str, dict]` -- loads `vietnam_visa.json` via `rules.load_visa_rules()`, indexes by `country_code` for O(1) lookup
    - `_is_phu_quoc_only(destinations: list[str]) -> bool` -- returns True if all destinations are on Phu Quoc island. Recognizes destination names/codes: "Phu Quoc", "phu_quoc", "PQ", and variations. Mainland destinations include: "HCMC", "Ho Chi Minh City", "Hanoi", "Da Nang", "Hoi An", "Hue", "Nha Trang", "Da Lat", "Sapa", "Mekong Delta", etc.
    - `_calculate_deadline(travel_start_date: date, processing_days: int) -> date` -- returns `travel_start_date - processing_days - 7` (7-day safety buffer)
    - `check_visa_requirements(country_code: str, destinations: list[str], travel_start_date: date | None = None) -> VisaCheckResult` -- main entry point
    - `check_all_nationalities(nationalities: list[str], destinations: list[str], travel_start_date: date | None = None) -> list[VisaCheckResult]` -- iterates nationalities, returns per-nationality results
  - [ ] Implement Phu Quoc trap detection logic:
    - If `rule.phu_quoc_exception is True` AND `_is_phu_quoc_only(destinations)` returns True, return `VISA_FREE_PHU_QUOC` with 30-day duration and warning
    - If `rule.phu_quoc_exception is True` AND destinations include mainland, return standard `E_VISA` with block-severity flag explaining the trap
    - If `rule.phu_quoc_exception is False` (visa-free nationalities), skip Phu Quoc logic entirely
  - [ ] Unknown nationality: return `VisaCheckResult(visa_type=VisaType.UNKNOWN, requires_manual_verification=True)` with warning flag
  - [ ] Deadline calculation: compute deadline, escalate to block if past today

- [ ] Task 3: Implement passport validity checker (AC: #5, #6)
  - [ ] Create `agents/compliance/passport.py` with:
    - `check_passport_validity(passport_expiry_date: date | None, travel_start_date: date | None) -> PassportCheckResult`
    - If `passport_expiry_date` is None, return `is_valid=None` with warning flag "Passport validity not verified"
    - If `travel_start_date` is None, return `is_valid=None` with warning "Cannot verify passport -- travel dates not set"
    - Calculate `months_remaining = (passport_expiry_date - travel_start_date).days / 30.44`
    - If `months_remaining >= 6`, return `is_valid=True` with no flags
    - If `months_remaining < 6`, return `is_valid=False` with block flag and `renewal_urgency`:
      - `< 2 months` -> "critical"
      - `2-4 months` -> "urgent"
      - `4-6 months` -> "advisory"

- [ ] Task 4: Create convenience function for full compliance run (AC: #9)
  - [ ] Add to `visa.py` or a new `agents/compliance/document_checks.py`:
    - `run_document_compliance_checks(state: AdvisoryState) -> VisaComplianceReport`
    - Extracts `nationalities`, `destination_preferences`, `travel_start_date`, `passport_expiry_date` from `state.traveler_profile`
    - Calls `check_all_nationalities()` and `check_passport_validity()`
    - Aggregates all flags into `overall_flags`
    - Returns `VisaComplianceReport` that can be merged into `AdvisoryState.compliance_report`
    - On any exception, appends error to a list and returns partial results (never raises)

- [ ] Task 5: Write visa unit tests (AC: #10)
  - [ ] Create `agents/compliance/tests/test_visa.py` with:
    - `test_visa_free_45_de` -- German nationality returns visa_free_45, 0 cost, 0 processing days
    - `test_visa_free_30_th` -- Thai nationality returns visa_free_30 (ASEAN)
    - `test_e_visa_au` -- Australian returns e_visa, $25, 3 processing days
    - `test_phu_quoc_only_au` -- AU with destinations=["Phu Quoc"] returns visa_free_phu_quoc, 30-day, with warning
    - `test_phu_quoc_plus_mainland_au` -- AU with destinations=["Phu Quoc", "HCMC"] returns e_visa with block flag (trap caught)
    - `test_phu_quoc_irrelevant_for_visa_free` -- DE with destinations=["Phu Quoc", "Hanoi"] returns visa_free_45 (no exception logic)
    - `test_unknown_nationality` -- country_code "ZZ" returns VisaType.UNKNOWN, requires_manual_verification=True, warning flag
    - `test_unknown_nationality_never_guesses` -- verify unknown result has no fabricated visa_type, cost, or processing time
    - `test_deadline_calculation` -- travel_start_date 30 days from now, processing_days=3, deadline = travel_start - 10 days
    - `test_deadline_already_passed` -- travel_start_date 2 days from now, processing_days=3, flag severity escalates to block
    - `test_multi_nationality_group` -- ["DE", "AU"] returns 2 results, AU is the restrictive one
    - `test_case_insensitive_destinations` -- "phu quoc", "PHU QUOC", "Phu Quoc" all recognized

- [ ] Task 6: Write passport unit tests (AC: #10)
  - [ ] Create `agents/compliance/tests/test_passport.py` with:
    - `test_passport_valid_8_months` -- passport expiring 8 months after departure returns is_valid=True, no flags
    - `test_passport_valid_exactly_6_months` -- edge case: 6 months exactly returns is_valid=True
    - `test_passport_expiry_5_months` -- returns is_valid=False, renewal_urgency="advisory"
    - `test_passport_expiry_3_months` -- returns is_valid=False, renewal_urgency="urgent"
    - `test_passport_expiry_1_month` -- returns is_valid=False, renewal_urgency="critical"
    - `test_passport_already_expired` -- returns is_valid=False, renewal_urgency="critical"
    - `test_passport_expiry_not_provided` -- returns is_valid=None, warning flag, message contains "not verified"
    - `test_passport_no_travel_date` -- returns is_valid=None with warning
    - `test_passport_flag_messages` -- verify block flag message includes expiry date and months remaining

- [ ] Task 7: Manual verification
  - [ ] Load vietnam_visa.json and run check for DE, AU, TH, and a non-existent code
  - [ ] Verify Phu Quoc trap fires correctly for AU with mixed destinations
  - [ ] Verify passport checks for various expiry scenarios
  - [ ] Confirm all flags use correct severity levels

## Dev Notes

### Critical Architecture Constraints

- **No LLM required**: Visa and passport checks are deterministic rule-based lookups. They do NOT call the LLM. They read from `agents/compliance/rules/vietnam_visa.json` which was ingested in Epic 2 (Story 2.5).
- **Pydantic BaseModel for all state**: All result models must be Pydantic, not TypedDict (architecture decision AR-5).
- **Errors in state, not exceptions**: If the JSON file is missing, if a date calculation fails, or if any unexpected error occurs, append to an errors list and return partial results. Never raise inside compliance check functions.
- **No cross-agent imports**: The visa/passport checks read from `AdvisoryState.traveler_profile` only. They never import from `agents/profiling/`, `agents/calculation/`, or `agents/proposal/`.
- **Co-located tests**: Tests live at `agents/compliance/tests/`, not in a top-level `tests/` directory.
- **Protocol interfaces**: These checks do NOT use `VectorStoreProtocol` or `LLMServiceProtocol`. They are pure functions operating on local JSON data + Pydantic models. This makes them trivially testable.

### Data Source: vietnam_visa.json

The existing visa rules file at `agents/compliance/rules/vietnam_visa.json` (from Story 2.5) contains 21 entries with this structure:

```json
{
  "type": "visa_rule",
  "country_code": "AU",
  "nationality": "Australian",
  "visa_type": "e_visa",
  "duration_days": 90,
  "cost_usd": 25,
  "processing_days": 3,
  "description": "E-visa required, 90 days",
  "phu_quoc_exception": true
}
```

Key data patterns:
- **visa_free_45**: DE, FR, GB, IT, ES, JP, KR, RU, DK, SE -- `phu_quoc_exception: false`
- **visa_free_30**: TH, SG, MY, ID, PH (ASEAN) -- `phu_quoc_exception: false`
- **e_visa**: AU, US, CA, CN, IN, BR, NZ -- `phu_quoc_exception: true`

The `load_visa_rules()` function in `agents/compliance/rules/__init__.py` already handles loading this file. The visa checker should call this function directly -- do not reimplement file loading.

### Phu Quoc Destination Detection Logic

Phu Quoc is an island in southern Vietnam. The "trap" is that some nationalities (e.g., Australian) can enter Phu Quoc visa-free for 30 days, but ONLY if they stay exclusively on the island. The moment a traveler also visits a mainland destination, the exception no longer applies and a full e-visa is required.

The destination field in `TravelerProfileResponse` is `destination_preferences: list[str] | None`. Values are free-text strings from the profiling agent. The checker must normalize these for comparison.

```python
PHU_QUOC_IDENTIFIERS = {
    "phu quoc", "phu_quoc", "phú quốc", "pq",
    "phu quoc island", "kien giang",
}

MAINLAND_DESTINATIONS = {
    "hanoi", "ha noi", "hcmc", "ho chi minh city", "ho chi minh",
    "saigon", "sai gon", "da nang", "danang", "hoi an",
    "hue", "nha trang", "da lat", "dalat", "sapa", "sa pa",
    "mekong delta", "can tho", "halong", "ha long",
    "ninh binh", "phong nha", "mui ne", "vung tau",
    "con dao", "cat ba", "quy nhon",
}
```

**Decision rule**: If ALL destinations match `PHU_QUOC_IDENTIFIERS`, the exception applies. If ANY destination matches `MAINLAND_DESTINATIONS` or is not in `PHU_QUOC_IDENTIFIERS`, the exception does NOT apply.

### Passport Validity Calculation

Vietnam requires passports to be valid for at least 6 months beyond the date of entry. The calculation:

```python
from datetime import date

def _calculate_months_remaining(passport_expiry: date, travel_start: date) -> float:
    """Calculate months between travel start and passport expiry."""
    delta = passport_expiry - travel_start
    return delta.days / 30.44  # Average days per month

def _classify_urgency(months_remaining: float) -> str:
    """Classify renewal urgency based on months remaining."""
    if months_remaining < 2:
        return "critical"
    elif months_remaining < 4:
        return "urgent"
    else:  # 4-6 months
        return "advisory"
```

### ComplianceFlag Design

The `ComplianceFlag` model is shared across all compliance checks (visa, health, travel advisory, age, seasonal, budget, accessibility). Story 4.4 (Compliance Gate) will aggregate these flags to determine pass/warning/block status. Design the model here to be reusable:

```python
class ComplianceFlag(BaseModel):
    """A single compliance finding. Used by all compliance checks."""
    check_name: str          # e.g., "visa", "passport", "health", "age_restriction"
    severity: ComplianceSeverity  # PASS, WARNING, BLOCK
    message: str             # Human-readable description
    details: dict | None = None   # Structured data for programmatic use
    resolution_guidance: str | None = None  # What the agent should do to resolve
```

Severity semantics:
- `PASS` -- check passed, no action needed
- `WARNING` -- non-critical issue, agent can override (Story 4.4)
- `BLOCK` -- critical issue, proposal cannot be delivered until resolved

### Application URL

The e-visa application URL for Vietnam is `https://evisa.xuatnhapcanh.gov.vn/`. Include this as `application_url` in all e-visa results. For visa-free results, set to `None`. For unknown nationalities, set to the Vietnam Immigration Department general page: `https://xuatnhapcanh.gov.vn/en`.

### Integration with AdvisoryState

The compliance report merges into `AdvisoryState.compliance_report` (currently typed as `dict | None`). The `run_document_compliance_checks()` function should return a `VisaComplianceReport` and serialize it to dict for storage:

```python
def run_document_compliance_checks(state: AdvisoryState) -> VisaComplianceReport:
    profile = state.traveler_profile
    if profile is None:
        # Return empty report with error
        return VisaComplianceReport(
            visa_results=[],
            passport_result=None,
            overall_flags=[ComplianceFlag(
                check_name="document_checks",
                severity=ComplianceSeverity.BLOCK,
                message="Cannot run document checks -- traveler profile not available.",
            )],
        )

    nationalities = profile.nationalities or []
    destinations = profile.destination_preferences or []
    travel_start = profile.travel_start_date
    passport_expiry = profile.passport_expiry_date

    visa_results = check_all_nationalities(nationalities, destinations, travel_start)
    passport_result = check_passport_validity(passport_expiry, travel_start)

    # Aggregate all flags
    all_flags = []
    for vr in visa_results:
        all_flags.extend(vr.flags)
    if passport_result:
        all_flags.extend(passport_result.flags)

    return VisaComplianceReport(
        visa_results=visa_results,
        passport_result=passport_result,
        overall_flags=all_flags,
    )
```

### Naming Conventions (per project-context.md)

| Element | Convention | This Story |
|---|---|---|
| Files | snake_case | `visa.py`, `passport.py`, `schemas.py` |
| Classes | PascalCase | `VisaCheckResult`, `PassportCheckResult`, `ComplianceFlag` |
| Functions | snake_case | `check_visa_requirements()`, `check_passport_validity()` |
| Enums | PascalCase class, UPPER_SNAKE values | `VisaType.VISA_FREE_45`, `ComplianceSeverity.BLOCK` |
| Test functions | snake_case with `test_` prefix | `test_visa_free_45_de`, `test_phu_quoc_plus_mainland_au` |

### Logging

All compliance checks should emit structured logs via `structlog`:

```python
import structlog

logger = structlog.get_logger()

# On visa check
logger.info("compliance.visa.checked",
    country_code=country_code,
    visa_type=result.visa_type.value,
    phu_quoc_exception=result.phu_quoc_exception_applied,
    flags_count=len(result.flags),
)

# On passport check
logger.info("compliance.passport.checked",
    is_valid=result.is_valid,
    months_remaining=result.months_remaining,
    renewal_urgency=result.renewal_urgency,
)

# On unknown nationality
logger.warning("compliance.visa.unknown_nationality",
    country_code=country_code,
    message="Nationality not in rules database, manual verification required",
)
```

### File Placement Summary

| File | Purpose |
|---|---|
| `backend/app/agents/compliance/schemas.py` | `VisaType`, `ComplianceSeverity`, `ComplianceFlag`, `VisaCheckResult`, `PassportCheckResult`, `VisaComplianceReport` |
| `backend/app/agents/compliance/visa.py` | `check_visa_requirements()`, `check_all_nationalities()`, `_is_phu_quoc_only()`, `_load_visa_rules()`, `_calculate_deadline()` |
| `backend/app/agents/compliance/passport.py` | `check_passport_validity()`, `_calculate_months_remaining()`, `_classify_urgency()` |
| `backend/app/agents/compliance/tests/__init__.py` | Test module init (may already exist) |
| `backend/app/agents/compliance/tests/test_visa.py` | 12 unit tests for visa requirement checks |
| `backend/app/agents/compliance/tests/test_passport.py` | 9 unit tests for passport validity checks |
| `backend/app/agents/compliance/rules/vietnam_visa.json` | Already exists -- DO NOT MODIFY (from Story 2.5) |
| `backend/app/agents/compliance/rules/__init__.py` | Already exists -- `load_visa_rules()` function. DO NOT MODIFY. |

### Anti-Patterns -- DO NOT

- **DO NOT** call the LLM for visa lookups. This is a deterministic rule-based check. The LLM has no role here.
- **DO NOT** modify `vietnam_visa.json`. The seed data is owned by Epic 2.
- **DO NOT** modify `agents/compliance/rules/__init__.py`. Use the existing `load_visa_rules()` function.
- **DO NOT** guess visa requirements for unknown nationalities. Return "manual verification required" explicitly.
- **DO NOT** block proposals for missing passport data. Missing data is a warning, not a block.
- **DO NOT** import from `agents/profiling/`, `agents/calculation/`, or `agents/proposal/`. Read only from `AdvisoryState`.
- **DO NOT** raise exceptions inside check functions. Append errors and return partial results.
- **DO NOT** use TypedDict anywhere. All models are Pydantic BaseModel.
- **DO NOT** create a `utils.py` file. Name files by purpose.
- **DO NOT** implement the Compliance Gate aggregation (that is Story 4.4).
- **DO NOT** implement health, travel advisory, age, seasonal, budget, or accessibility checks (those are Stories 4.2 and 4.3).

### Testing Strategy

All tests are pure unit tests -- no database, no LLM, no external services. Tests load the real `vietnam_visa.json` file to verify against actual seed data.

Each test follows this pattern:

1. Import the function under test
2. Provide input parameters (country_code, destinations, dates)
3. Call the function
4. Assert the result fields match expected values
5. Assert compliance flags have correct severity and messages

For date-dependent tests (deadline calculation, passport expiry), use fixed dates rather than `date.today()` to avoid flaky tests:

```python
from datetime import date

def test_deadline_calculation():
    travel_start = date(2026, 9, 15)
    result = check_visa_requirements("AU", ["Hanoi"], travel_start)
    # processing_days=3, buffer=7, deadline = Sept 15 - 10 = Sept 5
    assert result.deadline == date(2026, 9, 5)
```

For "deadline already passed" tests, use a travel date very close to the reference date:

```python
def test_deadline_already_passed():
    # Travel in 2 days, processing takes 3 days + 7 buffer = 10 days
    travel_start = date(2026, 5, 26)  # Use a fixed date, not today
    result = check_visa_requirements("AU", ["Hanoi"], travel_start)
    block_flags = [f for f in result.flags if f.severity == ComplianceSeverity.BLOCK]
    assert len(block_flags) >= 1
    assert "deadline" in block_flags[0].message.lower() or "immediately" in block_flags[0].message.lower()
```

### E2E Traceability

This story is covered by the following E2E test suites (Story 6.3):

| E2E Suite | Scenario | This Story's Role |
|---|---|---|
| Suite 1 (B2C Demo) | Solo backpacker, 3 weeks, Vietnam, $1500 | E-visa warning for test nationality |
| Suite 2 (B2B Copilot) | German family of 4, December | Compliance passes (DE = 45-day visa-free) |
| Suite 3 (Compliance Edge) | Russian client, Phu Quoc + HCMC | Phu Quoc trap caught, gate blocks |

### References

- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 4, Story 4.1 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture.md -- agents/compliance/ structure, Protocol interfaces]
- [Source: _bmad-output/planning-artifacts/architecture.md -- compliance flag severity: pass/warning/block]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Anti-patterns: no cross-agent imports, errors in state]
- [Source: _bmad-output/project-context.md -- Pydantic BaseModel for state, structlog logging, co-located tests]
- [Source: stravel/backend/app/agents/compliance/rules/vietnam_visa.json -- actual seed data structure]
- [Source: stravel/backend/app/agents/compliance/rules/__init__.py -- load_visa_rules() function]
- [Source: stravel/backend/app/agents/state.py -- AdvisoryState structure]
- [Source: stravel/backend/app/schemas/profile.py -- TravelerProfileResponse fields: nationalities, passport_expiry_date, destination_preferences]

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
