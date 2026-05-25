# Story 4.2: Health, Travel Advisory & Age Restriction Checks

Status: draft

## Story

As a travel agent,
I want the system to check health requirements, government travel warnings, and age restrictions for planned activities,
so that my client's safety is protected and unsuitable activities are flagged.

**Depends on:** Story 4.1 (Visa & Document Compliance Checks -- establishes the `agents/compliance/` module structure, `ComplianceCheck` base pattern, and regulatory data loading from `rules/` JSON files)

**FRs implemented:** FR-16 (Health & Vaccination Advisory), FR-17 (Travel Advisory Check), FR-18 (Age Restriction Validation)

## Acceptance Criteria

### AC-1: Health Advisory Module Structure
**Given** the compliance agent module exists at `agents/compliance/`
**When** the health check module is inspected
**Then** `agents/compliance/health.py` contains:
- `HealthAdvisoryChecker` class with `check(profile, destinations) -> list[ComplianceFlag]` method
- Reads health advisory data from `agents/compliance/rules/vietnam_health.json`
- Returns `ComplianceFlag` objects with `severity="warning"` for recommended vaccinations
- Returns `ComplianceFlag` objects with `severity="warning"` for required vaccinations with emphasis text
- Each flag includes `source_url` and `last_verified` date from regulatory data

### AC-2: Required and Recommended Vaccinations
**Given** a Traveler Profile with destination preferences including Vietnam
**When** `agents/compliance/health.py` runs health checks
**Then** required vaccinations (if any by entry regulation) produce flags with `severity="warning"` and `category="health_required"`
**And** recommended vaccinations (Hepatitis A, Hepatitis B, Typhoid, Japanese Encephalitis, Rabies) produce flags with `severity="warning"` and `category="health_recommended"`
**And** malaria prophylaxis is flagged for travelers visiting rural highlands (Sapa, Ha Giang) with `category="health_prophylaxis"`
**And** each vaccination flag includes the health authority source URL (CDC, WHO)
**And** flags include a `lead_time` field indicating how far before departure the vaccination should be administered (e.g., "at least 2 weeks before travel")

### AC-3: Destination-Specific Health Advisories
**Given** a Traveler Profile with specific Vietnam destinations
**When** health checks are run
**Then** destinations in rural/highland regions (Sapa, Ha Giang, Phong Nha) receive additional malaria and dengue advisories
**And** destinations in urban areas (Hanoi, HCMC, Da Nang) receive standard advisories without malaria warnings
**And** if destination is not found in the health rules dataset, no advisory is generated (not a guess)

### AC-4: Travel Advisory Module Structure
**Given** the compliance agent module exists at `agents/compliance/`
**When** the travel advisory module is inspected
**Then** `agents/compliance/travel_advisory.py` contains:
- `TravelAdvisoryChecker` class with `check(profile, destinations) -> list[ComplianceFlag]` method
- Reads travel warning data from `agents/compliance/rules/vietnam_travel_warnings.json`
- Maps advisory levels to severity: `do_not_travel` -> `severity="block"`, all others -> `severity="warning"`

### AC-5: "Do Not Travel" Advisory Blocks Destination
**Given** a destination has a "Do Not Travel" advisory level in the regulatory data
**When** `agents/compliance/travel_advisory.py` checks the destination
**Then** a `ComplianceFlag` with `severity="block"` is returned
**And** `flag.message` clearly states the destination is blocked due to government travel advisory
**And** `flag.resolution` suggests removing the destination or checking for updated advisory status
**And** the blocked destination is excluded from proposal generation (enforced by Compliance Gate in Story 4.4)

### AC-6: Lower-Level Advisories Are Warnings
**Given** a destination has an advisory level below "Do Not Travel" (exercise_normal_precautions, exercise_increased_caution, reconsider_travel)
**When** `agents/compliance/travel_advisory.py` checks the destination
**Then** a `ComplianceFlag` with `severity="warning"` is returned
**And** `flag.message` describes the advisory level in human-readable form
**And** `flag.advisory_level` preserves the raw advisory level for programmatic use
**And** warnings do not block proposal delivery (travel agent can override in Story 4.4)

### AC-7: Age Restriction Module Structure
**Given** the compliance agent module exists at `agents/compliance/`
**When** the age restriction module is inspected
**Then** `agents/compliance/age_restrictions.py` contains:
- `AgeRestrictionChecker` class with `check(profile, activities) -> list[ComplianceFlag]` method
- Reads age restriction rules from `agents/compliance/rules/vietnam_age_restrictions.json`
- Validates each planned activity against the minimum age of all travelers in the group

### AC-8: Scuba Diving Minimum Age 10
**Given** a Traveler Profile with planned activity "scuba diving" and a traveler aged 8
**When** `agents/compliance/age_restrictions.py` checks the activity
**Then** a `ComplianceFlag` with `severity="block"` is returned for scuba diving
**And** `flag.message` states "Scuba diving requires minimum age 10. Traveler age 8 does not meet requirement."
**And** `flag.alternatives` includes ["snorkeling", "glass-bottom boat tour"]
**And** the non-compliant activity is removed from the proposal and alternatives are suggested

### AC-9: Motorbike Minimum Age 18
**Given** a Traveler Profile with planned activity "motorbike tour" and a traveler aged 16
**When** `agents/compliance/age_restrictions.py` checks the activity
**Then** a `ComplianceFlag` with `severity="block"` is returned for the motorbike activity
**And** `flag.message` states the minimum age requirement (18) and the traveler's age
**And** `flag.alternatives` includes ["bicycle tour", "guided bus tour", "car with driver"]

### AC-10: All Travelers Validated Against Age Restrictions
**Given** a Traveler Profile with `traveler_ages: [35, 32, 12, 8]` (family with two children)
**When** age restriction checks are run against activities including scuba diving (min 10) and motorbike tour (min 18)
**Then** scuba diving is blocked for the 8-year-old but allowed for the 12-year-old and adults
**And** motorbike tour is blocked for both children (12 and 8) but allowed for adults
**And** each flag references the specific traveler age that triggered the restriction

### AC-11: Activities Without Age Restrictions Pass
**Given** a Traveler Profile with activities that have no age restrictions (e.g., cooking class, city walking tour, beach visit)
**When** age restriction checks are run
**Then** no `ComplianceFlag` is generated for those activities
**And** the check completes without error

### AC-12: Missing Traveler Ages Handled Gracefully
**Given** a Traveler Profile where `traveler_ages` is `None` or an empty list
**When** age restriction checks are run for activities that have age requirements
**Then** a `ComplianceFlag` with `severity="warning"` is returned
**And** `flag.message` states "Traveler ages not provided -- cannot validate age restrictions for [activity]. Manual verification required."

### AC-13: Unit Test Coverage
**Given** the test suite at `agents/compliance/tests/`
**When** tests are run with `pytest`
**Then** health advisory tests verify:
- Required vaccinations produce warning flags with source URLs
- Recommended vaccinations produce warning flags
- Malaria advisory triggers only for highland destinations
- Urban destinations do not receive malaria advisories
- Unknown destinations produce no advisory (not a guess)
**And** travel advisory tests verify:
- "Do Not Travel" produces a block flag
- "Exercise Normal Precautions" produces a warning flag
- "Reconsider Travel" produces a warning flag
- Advisory level is preserved in flag metadata
**And** age restriction tests verify:
- Scuba diving blocked for age < 10
- Motorbike blocked for age < 18
- Alternatives are suggested for blocked activities
- Mixed-age groups produce per-traveler flags
- Activities without restrictions pass cleanly
- Missing ages produce a warning flag
**And** all tests pass without Qdrant, Redis, or LLM (regulatory data from JSON files)

## Schemas

### ComplianceCheck

```python
# agents/compliance/schemas.py

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel


class ComplianceSeverity(str, Enum):
    """Severity level for compliance flags.

    block: Critical issue -- prevents proposal delivery until resolved.
    warning: Non-critical -- surfaced to travel agent, can be overridden.
    """
    BLOCK = "block"
    WARNING = "warning"


class ComplianceCategory(str, Enum):
    """Category of compliance check that produced the flag."""
    VISA = "visa"
    PASSPORT = "passport"
    HEALTH_REQUIRED = "health_required"
    HEALTH_RECOMMENDED = "health_recommended"
    HEALTH_PROPHYLAXIS = "health_prophylaxis"
    TRAVEL_ADVISORY = "travel_advisory"
    AGE_RESTRICTION = "age_restriction"
    SEASONAL = "seasonal"
    BUDGET = "budget"
    ACCESSIBILITY = "accessibility"


class ComplianceFlag(BaseModel):
    """A single compliance finding from a check.

    Flags are aggregated into a ComplianceReport by the Compliance Gate (Story 4.4).
    """
    category: ComplianceCategory
    severity: ComplianceSeverity
    check_name: str              # e.g., "health_vaccination_hepatitis_a", "age_scuba_diving"
    message: str                 # Human-readable description of the issue
    resolution: str | None = None  # Suggested resolution or action
    alternatives: list[str] | None = None  # Alternative activities (age restrictions)
    source_url: str | None = None  # Regulatory source link
    last_verified: str | None = None  # ISO date when regulatory data was last verified
    advisory_level: str | None = None  # Raw advisory level (travel warnings)
    lead_time: str | None = None  # How far ahead action is needed (vaccinations)
    affected_traveler_age: int | None = None  # Specific traveler age that triggered the flag
    affected_destination: str | None = None  # Destination that triggered the flag
    affected_activity: str | None = None  # Activity that triggered the flag


class ComplianceCheck(BaseModel):
    """Result of running a single compliance checker module.

    Each checker (health, travel_advisory, age_restrictions) returns one ComplianceCheck
    containing zero or more ComplianceFlags.
    """
    checker_name: str            # e.g., "health_advisory", "travel_advisory", "age_restrictions"
    checked_at: datetime
    passed: bool                 # True if no block-severity flags
    flags: list[ComplianceFlag] = []
    error: str | None = None     # Set if the checker itself failed (data load error, etc.)


class ComplianceReport(BaseModel):
    """Aggregated compliance results across all checkers.

    Built by the Compliance Gate (Story 4.4) from individual ComplianceCheck results.
    """
    session_id: str
    checks: list[ComplianceCheck] = []
    has_blocks: bool = False     # True if any flag has severity="block"
    has_warnings: bool = False   # True if any flag has severity="warning"
    block_count: int = 0
    warning_count: int = 0
```

### Age Restriction Rules Schema

```python
class AgeRestrictionRule(BaseModel):
    """A single age restriction rule for an activity."""
    activity: str                # Activity name (must match activity_preferences values)
    activity_aliases: list[str] = []  # Alternative names for matching
    min_age: int                 # Minimum age required
    max_age: int | None = None   # Maximum age allowed (None = no upper limit)
    alternatives: list[str] = []  # Suggested alternatives for non-compliant travelers
    source: str | None = None    # Regulatory or operator source
    notes: str | None = None     # Additional context (e.g., "with parental consent from age 8")
```

### Health Advisory Rules Schema

```python
class HealthAdvisory(BaseModel):
    """A single health advisory entry."""
    vaccination_name: str        # e.g., "Hepatitis A", "Typhoid"
    requirement_level: Literal["required", "recommended", "situational"]
    applicable_regions: list[str] | None = None  # None = all regions
    description: str             # Advisory description
    lead_time: str | None = None  # e.g., "at least 2 weeks before travel"
    source_url: str
    last_verified: str           # ISO date
```

## Tasks

- [ ] Task 1: Extend regulatory data files (AC: #2, #3, #5, #6, #8, #9)
  - [ ] Expand `agents/compliance/rules/vietnam_health.json` with structured vaccination entries: Hepatitis A, Hepatitis B, Typhoid, Japanese Encephalitis, Rabies (recommended), Malaria prophylaxis (situational -- highland regions only)
  - [ ] Each entry includes: `vaccination_name`, `requirement_level`, `applicable_regions`, `description`, `lead_time`, `source_url`, `last_verified`
  - [ ] Expand `agents/compliance/rules/vietnam_travel_warnings.json` with structured advisory levels per destination/region including the `level` field using standard values: `do_not_travel`, `reconsider_travel`, `exercise_increased_caution`, `exercise_normal_precautions`
  - [ ] Create `agents/compliance/rules/vietnam_age_restrictions.json` with activity restrictions: scuba diving (min 10), motorbike rental/tour (min 18), parasailing (min 16), jet ski (min 16), bungee jumping (min 18), quad biking (min 16), solo kayaking (min 12)
  - [ ] Each age restriction entry includes: `activity`, `activity_aliases`, `min_age`, `alternatives`, `source`, `notes`

- [ ] Task 2: Create compliance schemas (AC: #1, #4, #7)
  - [ ] Create or extend `agents/compliance/schemas.py` with `ComplianceSeverity`, `ComplianceCategory`, `ComplianceFlag`, `ComplianceCheck`, `ComplianceReport`
  - [ ] Create `AgeRestrictionRule` and `HealthAdvisory` Pydantic models for deserializing rule JSON files
  - [ ] Ensure all models use Pydantic BaseModel (not TypedDict)
  - [ ] Verify schema compatibility with the SSE event format: `event: agent.compliance.flag\ndata: {ComplianceFlag.model_dump_json()}`

- [ ] Task 3: Implement health advisory checker (AC: #1, #2, #3)
  - [ ] Create `agents/compliance/health.py` with `HealthAdvisoryChecker` class
  - [ ] Implement `__init__` that loads `rules/vietnam_health.json` and deserializes into `list[HealthAdvisory]`
  - [ ] Implement `check(profile: TravelerProfileResponse, destinations: list[str]) -> ComplianceCheck` method
  - [ ] For each destination, match against applicable health advisories
  - [ ] Map `requirement_level="required"` to `ComplianceFlag(severity="warning", category="health_required")`
  - [ ] Map `requirement_level="recommended"` to `ComplianceFlag(severity="warning", category="health_recommended")`
  - [ ] Map `requirement_level="situational"` to `ComplianceFlag(severity="warning", category="health_prophylaxis")` only when `applicable_regions` matches destination
  - [ ] Include `source_url`, `last_verified`, and `lead_time` on every flag
  - [ ] If a destination is not found in health rules, skip it silently (no guessing)
  - [ ] Log all checks with structlog: `tenant_id`, `session_id`, `checker="health_advisory"`, `destination`, `flags_count`

- [ ] Task 4: Implement travel advisory checker (AC: #4, #5, #6)
  - [ ] Create `agents/compliance/travel_advisory.py` with `TravelAdvisoryChecker` class
  - [ ] Implement `__init__` that loads `rules/vietnam_travel_warnings.json`
  - [ ] Implement `check(profile: TravelerProfileResponse, destinations: list[str]) -> ComplianceCheck` method
  - [ ] Map advisory levels to severity:
    - `do_not_travel` -> `ComplianceFlag(severity="block", category="travel_advisory")`
    - `reconsider_travel` -> `ComplianceFlag(severity="warning", category="travel_advisory")`
    - `exercise_increased_caution` -> `ComplianceFlag(severity="warning", category="travel_advisory")`
    - `exercise_normal_precautions` -> `ComplianceFlag(severity="warning", category="travel_advisory")`
  - [ ] Set `flag.advisory_level` to the raw level string for programmatic use
  - [ ] Set `flag.resolution` for block-level flags: suggest removing destination or checking for updated status
  - [ ] Set `flag.affected_destination` to the destination name
  - [ ] Include `source_url` and `last_verified` on every flag
  - [ ] Log all checks with structlog

- [ ] Task 5: Implement age restriction checker (AC: #7, #8, #9, #10, #11, #12)
  - [ ] Create `agents/compliance/age_restrictions.py` with `AgeRestrictionChecker` class
  - [ ] Implement `__init__` that loads `rules/vietnam_age_restrictions.json` and deserializes into `list[AgeRestrictionRule]`
  - [ ] Implement `check(profile: TravelerProfileResponse, activities: list[str]) -> ComplianceCheck` method
  - [ ] For each activity in the planned activities list:
    - Match against rules by `activity` name and `activity_aliases` (case-insensitive)
    - If a rule exists, validate against every age in `profile.traveler_ages`
    - If any traveler age < `min_age`, produce `ComplianceFlag(severity="block", category="age_restriction")`
    - Set `flag.affected_traveler_age` to the specific age that failed
    - Set `flag.affected_activity` to the activity name
    - Set `flag.alternatives` from the rule's alternatives list
    - Set `flag.message` with clear human-readable explanation (e.g., "Scuba diving requires minimum age 10. Traveler age 8 does not meet requirement.")
  - [ ] If `profile.traveler_ages` is `None` or empty and the activity has age requirements, produce `ComplianceFlag(severity="warning")` with message "Traveler ages not provided -- cannot validate age restrictions for [activity]. Manual verification required."
  - [ ] Activities with no matching rule pass silently (no flag generated)
  - [ ] Log all checks with structlog

- [ ] Task 6: Write unit tests for health advisory checker (AC: #13)
  - [ ] Create `agents/compliance/tests/test_health.py`
  - [ ] `test_recommended_vaccinations_produce_warning_flags` -- verify Hepatitis A, Hepatitis B, Typhoid produce warning flags with source URLs
  - [ ] `test_malaria_advisory_for_highland_destinations` -- verify Sapa/Ha Giang destinations trigger malaria prophylaxis flag
  - [ ] `test_no_malaria_for_urban_destinations` -- verify Hanoi/HCMC/Da Nang do not trigger malaria flag
  - [ ] `test_unknown_destination_produces_no_advisory` -- verify "Unknown City" produces no health flags (not a guess)
  - [ ] `test_health_check_includes_source_urls` -- verify every flag has a non-empty `source_url`
  - [ ] `test_health_check_includes_lead_time` -- verify vaccination flags include lead time information
  - [ ] `test_multiple_destinations_aggregated` -- verify checking ["Hanoi", "Sapa"] produces both standard and highland advisories

- [ ] Task 7: Write unit tests for travel advisory checker (AC: #13)
  - [ ] Create `agents/compliance/tests/test_travel_advisory.py`
  - [ ] `test_do_not_travel_produces_block_flag` -- verify "do_not_travel" level produces `severity="block"`
  - [ ] `test_exercise_normal_precautions_produces_warning` -- verify standard advisory produces `severity="warning"`
  - [ ] `test_reconsider_travel_produces_warning` -- verify elevated advisory produces `severity="warning"`
  - [ ] `test_advisory_level_preserved_in_flag` -- verify `flag.advisory_level` contains the raw level string
  - [ ] `test_block_flag_includes_resolution` -- verify block flags have a non-empty `resolution` suggestion
  - [ ] `test_advisory_includes_source_url` -- verify every flag has `source_url` from regulatory data

- [ ] Task 8: Write unit tests for age restriction checker (AC: #13)
  - [ ] Create `agents/compliance/tests/test_age_restrictions.py`
  - [ ] `test_scuba_blocked_for_under_10` -- age 8 with scuba diving produces block flag
  - [ ] `test_scuba_allowed_for_10_and_over` -- age 10 with scuba diving produces no flag
  - [ ] `test_motorbike_blocked_for_under_18` -- age 16 with motorbike tour produces block flag
  - [ ] `test_motorbike_allowed_for_18_and_over` -- age 18 with motorbike produces no flag
  - [ ] `test_alternatives_suggested_for_blocked_activity` -- blocked scuba suggests snorkeling, glass-bottom boat
  - [ ] `test_mixed_age_group_produces_per_traveler_flags` -- ages [35, 32, 12, 8] with scuba produces flag for age 8 only
  - [ ] `test_activity_without_restriction_passes` -- cooking class produces no flag
  - [ ] `test_missing_ages_produces_warning` -- None/empty `traveler_ages` with restricted activity produces warning
  - [ ] `test_activity_alias_matching` -- "motorbike rental" matches "motorbike tour" rule via aliases
  - [ ] `test_case_insensitive_matching` -- "Scuba Diving" matches "scuba diving" rule
  - [ ] All tests use local JSON rule files only -- no Qdrant, Redis, or LLM

- [ ] Task 9: Verify integration with existing compliance module (AC: #1, #4, #7)
  - [ ] Verify `agents/compliance/__init__.py` exports all three checker classes
  - [ ] Verify all three checkers conform to a consistent interface: `check(...) -> ComplianceCheck`
  - [ ] Verify the checkers can be composed by the Compliance Agent (Story 4.4) to build a `ComplianceReport`
  - [ ] Run `make test` or `pytest` and verify all new and existing tests pass

## Dev Notes

### Critical Architecture Constraints

- **No LLM required**: These checkers are rule-based, not LLM-driven. They read structured JSON data and apply deterministic validation logic. No `LLMServiceProtocol` is needed.
- **No Qdrant or Redis**: Regulatory data comes from local JSON files in `agents/compliance/rules/`. Phase 2 may move to Vector Store retrieval, but this story uses file-based lookup.
- **Pydantic BaseModel for all schemas**: All data models must use Pydantic BaseModel (AR-5). No TypedDict.
- **Errors in ComplianceCheck, not exceptions**: If a checker fails to load its JSON data or encounters an unexpected format, set `ComplianceCheck.error` and return. Never raise exceptions.
- **No cross-agent imports**: Checkers read from `TravelerProfileResponse` (shared schema) and `AdvisoryState`. They never import from `agents/profiling/`, `agents/calculation/`, or `agents/proposal/`.
- **structlog for all logging**: Log with context keys: `tenant_id`, `session_id`, `checker`, `destination`, `activity`, `flags_count`.
- **Co-located tests**: Tests live at `agents/compliance/tests/`, not in a top-level `tests/` directory.

### Relationship to Story 4.1

Story 4.1 (Visa & Document Compliance Checks) establishes the compliance module foundation:
- `agents/compliance/visa.py` -- visa requirement checker
- `agents/compliance/passport.py` -- passport validity checker
- `agents/compliance/schemas.py` -- may already define `ComplianceFlag` and `ComplianceCheck` base schemas

If Story 4.1 has already defined `ComplianceFlag` and `ComplianceCheck` schemas, extend them with the additional `ComplianceCategory` values needed for this story (`HEALTH_REQUIRED`, `HEALTH_RECOMMENDED`, `HEALTH_PROPHYLAXIS`, `TRAVEL_ADVISORY`, `AGE_RESTRICTION`). If Story 4.1 has not been implemented, this story defines the schemas fresh.

### Regulatory Data File Formats

**vietnam_health.json (expanded):**
```json
[
  {
    "vaccination_name": "Hepatitis A",
    "requirement_level": "recommended",
    "applicable_regions": null,
    "description": "Recommended for all travelers. Spread through contaminated food and water.",
    "lead_time": "At least 2 weeks before travel for initial dose",
    "source_url": "https://wwwnc.cdc.gov/travel/destinations/traveler/none/vietnam",
    "last_verified": "2026-05-01"
  },
  {
    "vaccination_name": "Hepatitis B",
    "requirement_level": "recommended",
    "applicable_regions": null,
    "description": "Recommended for all travelers. Spread through infected body fluids.",
    "lead_time": "3-dose series over 6 months; accelerated schedule available",
    "source_url": "https://wwwnc.cdc.gov/travel/destinations/traveler/none/vietnam",
    "last_verified": "2026-05-01"
  },
  {
    "vaccination_name": "Typhoid",
    "requirement_level": "recommended",
    "applicable_regions": null,
    "description": "Recommended for travelers visiting smaller cities or rural areas.",
    "lead_time": "At least 2 weeks before travel",
    "source_url": "https://wwwnc.cdc.gov/travel/destinations/traveler/none/vietnam",
    "last_verified": "2026-05-01"
  },
  {
    "vaccination_name": "Japanese Encephalitis",
    "requirement_level": "recommended",
    "applicable_regions": ["rural", "sapa", "ha_giang", "mekong_delta"],
    "description": "Recommended for travelers spending extended time in rural areas.",
    "lead_time": "2-dose series at least 1 week before travel",
    "source_url": "https://wwwnc.cdc.gov/travel/destinations/traveler/none/vietnam",
    "last_verified": "2026-05-01"
  },
  {
    "vaccination_name": "Rabies",
    "requirement_level": "recommended",
    "applicable_regions": null,
    "description": "Recommended for travelers involved in outdoor activities or visiting remote areas where animal contact is likely.",
    "lead_time": "3-dose series over 21-28 days",
    "source_url": "https://wwwnc.cdc.gov/travel/destinations/traveler/none/vietnam",
    "last_verified": "2026-05-01"
  },
  {
    "vaccination_name": "Malaria Prophylaxis",
    "requirement_level": "situational",
    "applicable_regions": ["sapa", "ha_giang", "phong_nha", "central_highlands"],
    "description": "Malaria prophylaxis recommended for travelers visiting rural highland areas. Not needed for major cities or coastal resorts.",
    "lead_time": "Consult travel medicine clinic at least 4 weeks before departure",
    "source_url": "https://wwwnc.cdc.gov/travel/destinations/traveler/none/vietnam",
    "last_verified": "2026-05-01"
  },
  {
    "vaccination_name": "Dengue Awareness",
    "requirement_level": "situational",
    "applicable_regions": ["sapa", "ha_giang", "mekong_delta", "central_highlands"],
    "description": "Dengue fever risk in rural and peri-urban areas. Use mosquito repellent and protective clothing.",
    "lead_time": "No vaccination widely available; preventive measures recommended",
    "source_url": "https://wwwnc.cdc.gov/travel/destinations/traveler/none/vietnam",
    "last_verified": "2026-05-01"
  }
]
```

**vietnam_travel_warnings.json (expanded):**
```json
[
  {
    "destination": "Vietnam",
    "region": null,
    "level": "exercise_normal_precautions",
    "description": "Exercise normal safety precautions. Petty crime in tourist areas. Be aware of traffic conditions.",
    "source_url": "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/vietnam-travel-advisory.html",
    "last_verified": "2026-05-01"
  },
  {
    "destination": "Hanoi",
    "region": "north",
    "level": "exercise_normal_precautions",
    "description": "Standard precautions. Watch for motorbike bag-snatching in Old Quarter.",
    "source_url": "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/vietnam-travel-advisory.html",
    "last_verified": "2026-05-01"
  },
  {
    "destination": "HCMC",
    "region": "south",
    "level": "exercise_normal_precautions",
    "description": "Standard precautions. Petty theft common in District 1 tourist area.",
    "source_url": "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/vietnam-travel-advisory.html",
    "last_verified": "2026-05-01"
  }
]
```

**vietnam_age_restrictions.json (new):**
```json
[
  {
    "activity": "scuba diving",
    "activity_aliases": ["scuba", "deep diving", "dive certification", "padi course"],
    "min_age": 10,
    "max_age": null,
    "alternatives": ["snorkeling", "glass-bottom boat tour", "semi-submarine tour"],
    "source": "PADI Open Water Diver certification minimum age",
    "notes": "Junior Open Water Diver available for ages 10-14 with restrictions on depth (12m max)"
  },
  {
    "activity": "motorbike tour",
    "activity_aliases": ["motorbike rental", "motorbike", "motorcycle", "ha giang loop", "easy rider"],
    "min_age": 18,
    "max_age": null,
    "alternatives": ["bicycle tour", "guided bus tour", "car with driver", "sidecar tour as passenger"],
    "source": "Vietnamese traffic law - minimum driving age for motorbikes >50cc",
    "notes": "International Driving Permit with motorcycle endorsement required for foreigners"
  },
  {
    "activity": "parasailing",
    "activity_aliases": ["paragliding beach", "parasail"],
    "min_age": 16,
    "max_age": null,
    "alternatives": ["banana boat ride", "jet boat tour", "beach kayaking"],
    "source": "Standard operator safety requirements",
    "notes": "Ages 16-17 may require parental consent depending on operator"
  },
  {
    "activity": "jet ski",
    "activity_aliases": ["jet skiing", "jetski", "waverunner"],
    "min_age": 16,
    "max_age": null,
    "alternatives": ["banana boat ride", "kayaking", "paddleboarding"],
    "source": "Standard operator safety requirements",
    "notes": "Ages 16-17 typically require parental supervision"
  },
  {
    "activity": "bungee jumping",
    "activity_aliases": ["bungee", "bungy jumping"],
    "min_age": 18,
    "max_age": null,
    "alternatives": ["zipline", "high ropes course", "rock climbing wall"],
    "source": "Standard operator safety requirements",
    "notes": null
  },
  {
    "activity": "quad biking",
    "activity_aliases": ["atv", "atv tour", "quad bike", "all-terrain vehicle"],
    "min_age": 16,
    "max_age": null,
    "alternatives": ["bicycle tour", "guided hiking", "horseback riding"],
    "source": "Standard operator safety requirements",
    "notes": "Ages 16-17 may ride with adult supervision on some operators"
  },
  {
    "activity": "solo kayaking",
    "activity_aliases": ["single kayak", "kayaking alone"],
    "min_age": 12,
    "max_age": null,
    "alternatives": ["tandem kayaking with adult", "guided group kayaking", "boat tour"],
    "source": "Standard water safety guidelines",
    "notes": "Children under 12 can kayak in tandem with an adult"
  }
]
```

### Checker Implementation Pattern

All three checkers follow the same structural pattern:

```python
# agents/compliance/health.py (pattern applies to all three)
import json
from datetime import datetime
from pathlib import Path

import structlog

from app.agents.compliance.schemas import (
    ComplianceCategory,
    ComplianceCheck,
    ComplianceFlag,
    ComplianceSeverity,
)
from app.schemas.profile import TravelerProfileResponse

logger = structlog.get_logger()

RULES_DIR = Path(__file__).parent / "rules"


class HealthAdvisoryChecker:
    """Checks health and vaccination advisories for travel destinations.

    Reads regulatory data from agents/compliance/rules/vietnam_health.json.
    All checks are deterministic -- no LLM involvement.
    """

    def __init__(self):
        self._advisories = self._load_rules()

    def _load_rules(self) -> list[dict]:
        rules_path = RULES_DIR / "vietnam_health.json"
        try:
            with open(rules_path) as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.error("compliance.rules_load_failed", checker="health_advisory", error=str(e))
            return []

    def check(
        self,
        profile: TravelerProfileResponse,
        destinations: list[str],
    ) -> ComplianceCheck:
        flags: list[ComplianceFlag] = []
        # ... validation logic producing ComplianceFlag instances ...

        return ComplianceCheck(
            checker_name="health_advisory",
            checked_at=datetime.utcnow(),
            passed=not any(f.severity == ComplianceSeverity.BLOCK for f in flags),
            flags=flags,
        )
```

### Destination Normalization

Destinations from the `TravelerProfileResponse.destination_preferences` field are free-text strings (e.g., "Sapa", "sapa", "Sa Pa"). The checkers must normalize these for matching against rules:

```python
def normalize_destination(destination: str) -> str:
    """Normalize destination name for rule matching."""
    normalized = destination.lower().strip()
    # Handle common variations
    ALIASES = {
        "sa pa": "sapa",
        "ho chi minh city": "hcmc",
        "ho chi minh": "hcmc",
        "saigon": "hcmc",
        "da nang": "danang",
        "hoi an": "hoian",
        "nha trang": "nhatrang",
        "da lat": "dalat",
        "phu quoc": "phuquoc",
        "phong nha": "phong_nha",
        "ha giang": "ha_giang",
        "mekong delta": "mekong_delta",
    }
    return ALIASES.get(normalized, normalized)
```

### SSE Event Integration

When these checkers run as part of the compliance stage, their flags are emitted as SSE events. The event format (defined in architecture) is:

```
event: agent.compliance.flag
data: {"type": "flag", "severity": "block", "check": "age_restriction", "message": "Scuba diving requires minimum age 10. Traveler age 8 does not meet requirement.", "alternative": "snorkeling"}

event: agent.compliance.flag
data: {"type": "flag", "severity": "warning", "check": "health_advisory", "message": "Hepatitis A vaccination recommended", "source_url": "https://wwwnc.cdc.gov/..."}
```

The SSE emission is handled by the Compliance Agent (Story 4.4) and event bus -- the individual checkers only return `ComplianceCheck` objects.

### Input Data Sources

The checkers receive data from `AdvisoryState`:

| Input | Source | Field |
|---|---|---|
| Destinations | `AdvisoryState.traveler_profile.destination_preferences` | `list[str]` |
| Traveler ages | `AdvisoryState.traveler_profile.traveler_ages` | `list[int] \| None` |
| Activities | `AdvisoryState.traveler_profile.activity_preferences` | `list[str] \| None` |
| Nationalities | `AdvisoryState.traveler_profile.nationalities` | `list[str] \| None` (used by travel advisory for source selection) |

### Anti-Patterns -- DO NOT

- **DO NOT** call the LLM for rule-based checks. These are deterministic -- read JSON, apply rules, return flags.
- **DO NOT** guess or infer health advisories for unknown destinations. If the destination is not in the rules, skip it.
- **DO NOT** import from `agents/profiling/`, `agents/calculation/`, or `agents/proposal/`. Read only from shared schemas and `AdvisoryState`.
- **DO NOT** raise exceptions inside checkers. Set `ComplianceCheck.error` and return gracefully.
- **DO NOT** use `datetime.now(timezone.utc)` -- use `datetime.utcnow()` (naive UTC, per project-context.md).
- **DO NOT** create a `utils.py` file. Put destination normalization in a shared location like `agents/compliance/normalization.py` or inline in each checker.
- **DO NOT** block on health advisories. All health findings are warnings, never blocks. Only travel advisory "Do Not Travel" and age restriction violations produce blocks.
- **DO NOT** use `from __future__ import annotations` in any file with Pydantic models.

### File Structure After This Story

```
backend/app/agents/compliance/
├── __init__.py                          # Exports all checker classes
├── schemas.py                           # NEW or EXTENDED: ComplianceFlag, ComplianceCheck, ComplianceReport, AgeRestrictionRule, HealthAdvisory
├── health.py                            # NEW: HealthAdvisoryChecker
├── travel_advisory.py                   # NEW: TravelAdvisoryChecker
├── age_restrictions.py                  # NEW: AgeRestrictionChecker
├── rules/
│   ├── __init__.py
│   ├── vietnam_health.json              # EXPANDED: structured vaccination entries
│   ├── vietnam_travel_warnings.json     # EXPANDED: per-destination advisory levels
│   ├── vietnam_age_restrictions.json    # NEW: activity age restriction rules
│   ├── vietnam_visa.json                # EXISTS (from Story 4.1)
│   └── vietnam_seasons.json             # EXISTS (for Story 4.3)
└── tests/
    ├── __init__.py                      # EXISTS
    ├── test_health.py                   # NEW: 7 tests
    ├── test_travel_advisory.py          # NEW: 6 tests
    └── test_age_restrictions.py         # NEW: 10 tests
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- agents/compliance/ structure, compliance node in orchestrator]
- [Source: _bmad-output/planning-artifacts/architecture.md -- SSE event format for agent.compliance.flag]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Error handling: ComplianceFlag(severity="block") pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Naming conventions: snake_case files, PascalCase classes]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 4, Story 4.2 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/epics.md -- FR-16 Health & Vaccination Advisory, FR-17 Travel Advisory Check, FR-18 Age Restriction Validation]
- [Source: _bmad-output/project-context.md -- datetime.utcnow(), structlog, Pydantic BaseModel rules]
- [Existing: backend/app/agents/compliance/rules/vietnam_health.json -- current health advisory data]
- [Existing: backend/app/agents/compliance/rules/vietnam_travel_warnings.json -- current travel warning data]
- [Existing: backend/app/schemas/profile.py -- TravelerProfileResponse with traveler_ages, destination_preferences, activity_preferences]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
