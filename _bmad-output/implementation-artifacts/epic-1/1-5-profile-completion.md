# Story 1.5: Traveler Profile Completion & Confirmation

Status: done

## Story

As a travel agent,
I want to see a summary of the collected traveler profile and confirm it before proceeding,
so that I can verify all details are correct and complete.

**Dependencies:** Story 1.2 (DB models & session API), Story 1.3 (LangGraph orchestrator), Story 1.4 (Profiling Agent dynamic fact-finding)

**FRs covered:** FR-3 (Traveler Profile Completion)

## Acceptance Criteria

1. **Given** the Profiling Agent has collected responses from a traveler, **When** minimum required fields are present (traveler count, travel dates or flexibility, budget range, at least one destination preference), **Then** the agent signals profile completion and presents a structured profile summary.

2. **Given** the profile summary is generated, **Then** the summary includes all collected data organized by category:
   - **Demographics:** traveler count, ages, nationalities, group composition
   - **Dates:** travel dates or flexibility window, duration
   - **Budget:** total budget range, currency, budget style (luxury/mid-range/budget)
   - **Preferences:** destination preferences, accommodation style, activity interests, dietary needs
   - **Constraints:** mobility requirements, child-related constraints, school schedule, visa concerns

3. **Given** any of the four minimum required fields are missing (traveler count, travel dates/flexibility, budget range, destination preference), **When** profile completion is evaluated, **Then** the agent returns a structured response indicating exactly which fields still need answers and does NOT signal completion.

4. **Given** a completed traveler profile exists, **When** the travel agent sends a PATCH request to `/api/v1/traveler_profiles/{profile_id}`, **Then** the specified profile fields are updated and the updated profile is returned.

5. **Given** a PATCH request contains invalid data (e.g., negative traveler count, budget range where min exceeds max, past travel dates), **Then** the endpoint returns a 422 with field-level validation errors.

6. **Given** the travel agent confirms the profile via `POST /api/v1/advisory_sessions/{session_id}/confirm-profile`, **Then** the session stage transitions from `profiling` to `calculating` in both the database and the LangGraph `AdvisoryState`.

7. **Given** a profile confirmation is attempted but minimum fields are still missing, **Then** the confirmation is rejected with a 400 error listing the missing fields.

8. **Given** a profile has been confirmed and the session is in `calculating` stage, **When** a profile edit is attempted via PATCH, **Then** the edit is allowed but the session stage reverts to `profiling` (requiring re-confirmation before proceeding).

## Tasks

- [x] Task 1: Define TravelerProfile Pydantic schemas for profile summary and validation (AC: #1, #2, #3)
  - [x] Create `backend/app/schemas/profile.py` with `TravelerProfileResponse`, `TravelerProfileUpdate`, `ProfileSummary`, and `ProfileCompletionStatus` schemas
  - [x] `TravelerProfileResponse` includes all fields organized by category (demographics, dates, budget, preferences, constraints)
  - [x] `TravelerProfileUpdate` is a partial-update schema where all fields are `Optional` for PATCH semantics
  - [x] `ProfileSummary` organizes profile data into category groups with display labels
  - [x] `ProfileCompletionStatus` has `is_complete: bool`, `missing_fields: list[str]`, `summary: ProfileSummary | None`
  - [x] Add field validators: `traveler_count >= 1`, `budget_min <= budget_max`, `budget_min >= 0`, travel dates not in the past (if specific dates provided, not flexibility)

- [x] Task 2: Implement profile validation service (AC: #1, #3, #5)
  - [x] Create `backend/app/services/profile_validator.py`
  - [x] Implement `validate_minimum_fields(profile: TravelerProfile) -> ProfileCompletionStatus` checking all four required fields
  - [x] Implement `build_profile_summary(profile: TravelerProfile) -> ProfileSummary` organizing data by category
  - [x] Required field definitions:
    - `traveler_count`: must be >= 1
    - `travel_dates` OR `date_flexibility`: at least one must be non-null
    - `budget_range`: must have both min and max values
    - `destination_preferences`: must have at least one entry
  - [x] Unit tests in `backend/app/services/tests/test_profile_validator.py`:
    - All four fields present -> complete
    - Each field missing individually -> incomplete with correct missing field name
    - Multiple fields missing -> all listed
    - Edge case: empty destination_preferences list -> treated as missing
    - Edge case: budget_range with only min or only max -> treated as missing

- [x] Task 3: Implement PATCH endpoint for traveler profile edits (AC: #4, #5, #8)
  - [x] Create or update `backend/app/api/v1/profiles.py` with `PATCH /api/v1/traveler_profiles/{profile_id}`
  - [x] Accept `TravelerProfileUpdate` request body; apply only non-null fields to the existing profile
  - [x] Return updated `TravelerProfileResponse`
  - [x] If profile not found, return 404 with `PROFILE_NOT_FOUND` error code
  - [x] If validation fails, return 422 with field-level error details
  - [x] If the associated session is past `profiling` stage, revert the session stage to `profiling` and log the reversion
  - [x] Register route in `backend/app/api/v1/router.py`
  - [x] Unit tests in `backend/app/api/v1/tests/test_profiles.py`:
    - Successful partial update (change only traveler_count)
    - Successful multi-field update
    - Profile not found returns 404
    - Invalid data returns 422
    - Edit after confirmation reverts session stage to profiling

- [x] Task 4: Implement profile confirmation endpoint (AC: #6, #7)
  - [x] Add `POST /api/v1/advisory_sessions/{session_id}/confirm-profile` to `backend/app/api/v1/sessions.py`
  - [x] Call `validate_minimum_fields()` before allowing confirmation
  - [x] If incomplete, return 400 with `PROFILE_INCOMPLETE` code and `missing_fields` in the response body
  - [x] If complete, update session status from `profiling` to `calculating` in the database
  - [x] Update the `AdvisoryState.stage` to `calculating` via LangGraph checkpointer
  - [x] Return the confirmed `ProfileSummary` in the response
  - [x] Emit structured log: `logger.info("profile.confirmed", session_id=session_id, tenant_id=tenant_id, field_count=N)`
  - [x] Unit tests in `backend/app/api/v1/tests/test_sessions.py`:
    - Confirm with all fields present -> 200, stage becomes `calculating`
    - Confirm with missing fields -> 400 with missing_fields list
    - Confirm already-confirmed session -> idempotent 200 or appropriate response
    - Session not found -> 404

- [x] Task 5: Integrate completion check into Profiling Agent (AC: #1, #3)
  - [x] Update `backend/app/agents/profiling/agent.py` to call `validate_minimum_fields()` after each exchange
  - [x] When all minimum fields are present, the agent transitions to a "summary" sub-state and generates the `ProfileSummary`
  - [x] When fields are still missing, the agent continues asking questions targeting the missing fields specifically
  - [x] The agent MUST NOT signal completion until all four minimum fields are satisfied
  - [x] Agent emits SSE event `agent.profiling.summary` with the structured summary when complete
  - [x] Agent emits SSE event `agent.profiling.missing_fields` listing what's still needed (for copilot sidebar display)
  - [x] Unit tests in `backend/app/agents/profiling/tests/test_profile_completion.py`:
    - Agent with complete profile -> emits summary
    - Agent with partial profile -> continues asking
    - Agent correctly identifies each missing field type

- [x] Task 6: Add GET endpoint for profile completion status (AC: #3)
  - [x] Add `GET /api/v1/traveler_profiles/{profile_id}/completion-status` to `backend/app/api/v1/profiles.py`
  - [x] Returns `ProfileCompletionStatus` showing complete/incomplete and missing fields
  - [x] This allows the frontend to poll or check status independently of SSE
  - [x] Unit test: returns correct status for complete and incomplete profiles

- [x] Task 7: Update AdvisoryState with typed TravelerProfile (AC: #1, #2)
  - [x] Update `backend/app/agents/state.py` to replace `traveler_profile: dict | None` with the typed `TravelerProfile` Pydantic model (addresses deferred work item from Story 1.1 review)
  - [x] Ensure all existing agent code that reads/writes `traveler_profile` on `AdvisoryState` is updated to use the typed model
  - [x] Verify existing tests still pass after the type change

## Dev Notes

### Critical Architecture Constraints

- **Pydantic BaseModel for all state** -- the `TravelerProfile` on `AdvisoryState` MUST be a Pydantic model, not a dict (architecture enforcement rule #6)
- **Protocol interfaces** -- profile validation service does NOT directly import database models. It operates on Pydantic schemas. Database access goes through the service layer.
- **structlog for all logging** -- include `tenant_id`, `session_id` in every log entry (architecture enforcement rule #4)
- **Error format** -- use `AppError` from `core/exceptions.py` for all HTTP error responses: `{"detail": {"code": "...", "message": "..."}}`
- **No auth enforcement in this story** -- auth comes in Story 1.6. Endpoints are unprotected for now.
- **Tenant context** -- not yet implemented (Story 1.6). Use a placeholder `tenant_id` in logs and state for now.

### TravelerProfile Model Structure

The `TravelerProfile` Pydantic model should align with the architecture's naming conventions and the data the Profiling Agent collects (Story 1.4):

```python
from pydantic import BaseModel, Field
from datetime import date
from enum import Enum


class BudgetStyle(str, Enum):
    BUDGET = "budget"
    MID_RANGE = "mid_range"
    LUXURY = "luxury"


class DateFlexibility(str, Enum):
    EXACT = "exact"
    FLEXIBLE_WEEK = "flexible_week"
    FLEXIBLE_MONTH = "flexible_month"
    FLEXIBLE_SEASON = "flexible_season"


class BudgetRange(BaseModel):
    min_amount: float = Field(ge=0)
    max_amount: float
    currency: str = "USD"


class TravelerProfile(BaseModel):
    # Demographics
    traveler_count: int | None = Field(default=None, ge=1)
    traveler_ages: list[int] | None = None
    nationalities: list[str] | None = None
    group_composition: str | None = None  # e.g. "family", "couple", "solo", "friends"

    # Dates
    travel_start_date: date | None = None
    travel_end_date: date | None = None
    date_flexibility: DateFlexibility | None = None
    trip_duration_days: int | None = Field(default=None, ge=1)

    # Budget
    budget_range: BudgetRange | None = None
    budget_style: BudgetStyle | None = None

    # Preferences
    destination_preferences: list[str] | None = None
    accommodation_style: str | None = None
    activity_interests: list[str] | None = None
    dietary_needs: list[str] | None = None

    # Constraints
    mobility_requirements: str | None = None
    child_constraints: list[str] | None = None
    school_schedule_constraints: str | None = None
    visa_concerns: str | None = None
    other_constraints: list[str] | None = None
```

### Profile Summary Category Mapping

```python
PROFILE_CATEGORIES = {
    "demographics": {
        "label": "Travelers",
        "fields": ["traveler_count", "traveler_ages", "nationalities", "group_composition"],
    },
    "dates": {
        "label": "Travel Dates",
        "fields": ["travel_start_date", "travel_end_date", "date_flexibility", "trip_duration_days"],
    },
    "budget": {
        "label": "Budget",
        "fields": ["budget_range", "budget_style"],
    },
    "preferences": {
        "label": "Preferences",
        "fields": ["destination_preferences", "accommodation_style", "activity_interests", "dietary_needs"],
    },
    "constraints": {
        "label": "Constraints & Requirements",
        "fields": [
            "mobility_requirements",
            "child_constraints",
            "school_schedule_constraints",
            "visa_concerns",
            "other_constraints",
        ],
    },
}
```

### Minimum Required Fields

These four fields gate profile completion. All four must be non-null and valid:

| Field | Valid When |
|---|---|
| `traveler_count` | >= 1 |
| `travel_start_date` + `travel_end_date` OR `date_flexibility` | At least one date mechanism provided |
| `budget_range` | Both `min_amount` and `max_amount` present |
| `destination_preferences` | Non-empty list with at least one entry |

### PATCH Semantics

The PATCH endpoint uses partial update semantics. Only fields present in the request body are updated; absent fields are left unchanged. This is standard JSON Merge Patch behavior:

```python
# Example: only update traveler_count
PATCH /api/v1/traveler_profiles/{profile_id}
{
    "traveler_count": 5
}
# All other fields remain unchanged
```

### SSE Event Contracts

```
event: agent.profiling.summary
data: {"type": "profile_summary", "summary": {...}, "is_complete": true}

event: agent.profiling.missing_fields
data: {"type": "missing_fields", "fields": ["budget_range", "destination_preferences"]}

event: stage.change
data: {"stage": "calculating"}
```

### Stage Transition Flow

```
Profiling Agent collects data
    |
    v
validate_minimum_fields() -> incomplete? -> continue asking
    |
    v (complete)
Agent emits profile summary via SSE
    |
    v
Travel agent reviews summary in UI
    |
    v (optional)
PATCH /traveler_profiles/{id} -> edit fields -> re-validate
    |
    v
POST /advisory_sessions/{id}/confirm-profile
    |
    v
validate_minimum_fields() -> if incomplete, reject 400
    |
    v (complete)
Session stage: profiling -> calculating
AdvisoryState.stage: profiling -> calculating
    |
    v
SSE: stage.change -> calculating
```

### Anti-Patterns -- DO NOT

- **DO NOT** allow profile confirmation without all four minimum fields -- the validation must be server-side, not just client-side
- **DO NOT** skip validation on PATCH -- even partial updates must validate the fields being changed
- **DO NOT** use `PUT` for profile edits -- use `PATCH` with partial update semantics (only sent fields are changed)
- **DO NOT** hardcode field validation in the endpoint -- use the `profile_validator` service so the same logic is shared between the API and the agent
- **DO NOT** import agent internals from the API layer -- the API layer calls services, services call agents if needed (architecture boundary: `api/` -> `agents/` via `services/session_manager.py` only)
- **DO NOT** allow profile confirmation to succeed if the session is already past `profiling` stage and no changes were made (idempotent but should not re-trigger stage transition)

### Testing Requirements

- Unit tests for `profile_validator.py`: all combinations of missing/present minimum fields
- Unit tests for PATCH endpoint: partial updates, validation errors, 404, stage reversion
- Unit tests for confirmation endpoint: success, missing fields rejection, session not found
- Unit tests for agent completion integration: agent detects completion, agent detects missing fields
- All tests must pass with PostgreSQL only -- no Qdrant, Redis, or LLM required
- Use mock/stub for LLM calls in agent tests

### Files That Must Exist Before This Story

These files should exist from Stories 1.2-1.4:

- `backend/app/models/advisory_session.py` -- SQLModel AdvisorySession with status field
- `backend/app/models/traveler_profile.py` -- SQLModel TravelerProfile linked to AdvisorySession
- `backend/app/api/v1/sessions.py` -- Session CRUD endpoints
- `backend/app/agents/profiling/agent.py` -- Profiling Agent with dynamic questioning
- `backend/app/agents/profiling/prompts.py` -- System prompts for profiling
- `backend/app/agents/orchestrator.py` -- LangGraph StateGraph with stage transitions
- `backend/app/services/llm.py` -- LLMServiceProtocol implementation (Ollama)

### Deferred Work Addressed

This story addresses one deferred item from Story 1.1 code review:
- "AdvisoryState uses bare dict fields -- should be typed Pydantic models" -> Task 7 replaces `traveler_profile: dict | None` with `TravelerProfile | None`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Data Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Architectural Boundaries]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 1, Story 1.5]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md -- AdvisoryState dict fields]

## Dev Agent Record

### Agent Model Used

(to be filled by implementing agent)

### Debug Log References

(to be filled during implementation)

### Completion Notes List

(to be filled during implementation)

### File List

- backend/app/schemas/profile.py (new)
- backend/app/services/profile_validator.py (new)
- backend/app/services/tests/test_profile_validator.py (new)
- backend/app/api/v1/profiles.py (new)
- backend/app/api/v1/tests/test_profiles.py (new)
- backend/app/api/v1/sessions.py (modified -- add confirm-profile endpoint)
- backend/app/api/v1/tests/test_sessions.py (new or modified)
- backend/app/api/v1/router.py (modified -- register profiles router)
- backend/app/agents/state.py (modified -- typed TravelerProfile)
- backend/app/agents/profiling/agent.py (modified -- completion check integration)
- backend/app/agents/profiling/tests/test_profile_completion.py (new)
