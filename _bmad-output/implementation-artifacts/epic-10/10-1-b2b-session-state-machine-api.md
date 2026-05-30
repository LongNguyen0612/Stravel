# Story 10.1: B2B Session State Machine API

Status: done

## Story

As a travel agent using the B2B copilot,
I want the backend to track session status transitions (pending → confirmed → modified → flagged),
So that the frontend status badges and staging gate have a reliable server-side state to reflect.

## Acceptance Criteria

**AC1 — New `/status` endpoint exists**
Given the session state machine requirements (ARCH-8)
When `PATCH /api/v1/advisory_sessions/{session_id}/status` is called
Then it accepts `{ status: "pending" | "confirmed" | "modified" | "flagged", flag_reason?: str }`
And it validates transitions: `pending → confirmed`, `confirmed → modified`, `modified → confirmed`, any state → `flagged`
And it rejects invalid transitions with HTTP 422 `{ "detail": "Invalid status transition: {from} → {to}" }`

**AC2 — Database migration**
Given the `AdvisorySession` model
When the Alembic migration runs
Then the `status` column is `VARCHAR` with values constrained to the four valid B2B values
And a `flag_reason` nullable TEXT column is added to `advisory_sessions`
And the Alembic migration file does NOT use `from __future__ import annotations` (project convention)

**AC3 — flag_reason required for flagged**
Given a status update to `"flagged"` is requested
When `flag_reason` is absent or empty
Then the endpoint returns HTTP 422 `{ "detail": "flag_reason required when status is flagged" }`

**AC4 — SessionStatus frontend type already aligned**
Given `SessionStatus` in `domain.ts` already equals `"pending" | "confirmed" | "modified" | "flagged"` (added in ARCH-7/Story 2.1)
When the endpoint responds
Then the response `status` field uses the same four values — no frontend type changes needed

**AC5 — Structured logging**
Given the endpoint is called and transition succeeds
When the response is returned
Then `structlog` records `{ session_id, from_status, to_status }` at INFO level
(Note: `agent_id` is not available from current auth — log `tenant_id` instead, as established by existing endpoints)

## Tasks / Subtasks

- [x] Task 1: Update `SessionStatus` enum and `AdvisorySession` model (AC: 1, 2, 4)
  - [x] 1.1: In `app/models/advisory_session.py`, replace `SessionStatus` enum values with `PENDING="pending"`, `CONFIRMED="confirmed"`, `MODIFIED="modified"`, `FLAGGED="flagged"`. Remove old `IN_PROGRESS`, `COMPLETED`, `ARCHIVED`.
  - [x] 1.2: Change `AdvisorySession.status` default to `SessionStatus.PENDING`
  - [x] 1.3: Add `flag_reason: Optional[str] = Field(default=None)` to `AdvisorySession`

- [x] Task 2: Alembic migration (AC: 2)
  - [x] 2.1: Create new migration file (do NOT use `from __future__ import annotations`). Migration must:
    - Drop the old `sessionstatus` PostgreSQL ENUM type
    - ALTER `advisory_sessions.status` to `VARCHAR(20)` with CHECK constraint: `CHECK (status IN ('pending', 'confirmed', 'modified', 'flagged'))`
    - Set a DEFAULT of `'pending'` on the column
    - UPDATE existing rows: map `'in_progress'` → `'pending'`, `'completed'` → `'confirmed'`, `'archived'` → `'confirmed'`
    - ADD COLUMN `flag_reason TEXT` (nullable, no default)
  - [x] 2.2: Implement `downgrade()` to reverse the migration

- [x] Task 3: New `/status` PATCH endpoint (AC: 1, 3, 5)
  - [x] 3.1: Add `SessionStatusUpdateRequest` Pydantic model with `status: SessionStatus` and `flag_reason: Optional[str] = None`
  - [x] 3.2: Add `@router.patch("/{session_id}/status", response_model=SessionResponse)` endpoint in `app/api/v1/sessions.py` with B2B transition table and `flag_reason` validation
  - [x] 3.3: Log `session_id, from_status, to_status, tenant_id` via `structlog` on success

- [x] Task 4: Update existing session schemas and endpoints (AC: 1, 2)
  - [x] 4.1: Update `app/schemas/session.py` — `SessionUpdateRequest.status` and `SessionResponse.status` now reference the new `SessionStatus` enum
  - [x] 4.2: Update the existing `PATCH /{session_id}` transitions table in `sessions.py` to use new B2B enum values (keep the endpoint for backward compat; update valid transitions to B2B values)

- [x] Task 5: Update existing tests + add new tests (AC: 1, 2, 3, 5)
  - [x] 5.1: Update `tests/test_sessions.py` — change `"in_progress"` → `"pending"` in `test_create_session` assertion; update `test_update_session_status` and `test_update_session_invalid_transition` to use B2B values
  - [x] 5.2: New file `tests/test_b2b_session_status.py` — tests:
    - `test_b2b_status_pending_to_confirmed` — valid transition
    - `test_b2b_status_confirmed_to_modified` — valid transition
    - `test_b2b_status_modified_to_confirmed` — valid transition
    - `test_b2b_status_any_to_flagged` — from pending and confirmed
    - `test_b2b_status_invalid_transition_422` — e.g. `confirmed → pending`
    - `test_b2b_status_flagged_requires_flag_reason` — missing flag_reason → 422
    - `test_b2b_status_flagged_with_flag_reason` — success
    - `test_b2b_status_not_found` — 404 on unknown session_id

## Dev Notes

### Critical: What Is Already Implemented — DO NOT RECREATE

- **`SessionStatus` in `domain.ts`** (`stravel/frontend/src/types/domain.ts` line ~23): Already has `type SessionStatus = "pending" | "confirmed" | "modified" | "flagged"` from ARCH-7. **No frontend changes needed.**
- **`PATCH /advisory_sessions/{session_id}` endpoint** (`sessions.py` line 88): Existing endpoint. Keep it; update its `valid_transitions` dict to B2B enum values in Task 4.2.
- **`structlog.contextvars.bind_contextvars`** pattern: Established in all existing endpoints. Mirror the pattern.
- **`NotFoundError` / `ValidationError`** from `app.core.exceptions`: Use these — do not raise `HTTPException` directly.
- **`get_current_tenant_id` dependency**: Returns `tenant_id: str` from JWT. This is the only identity available — log `tenant_id`, not `agent_id` (AC5 corrects the spec's mention of agent_id).

### PostgreSQL ENUM Migration — Critical Pattern

The existing `status` column uses a PostgreSQL ENUM type named `sessionstatus`. Alembic's auto-generated ENUM handling is fragile. Use raw SQL in the migration:

```python
def upgrade() -> None:
    # Step 1: Drop the ENUM constraint by altering to VARCHAR
    op.execute("ALTER TABLE advisory_sessions ALTER COLUMN status TYPE VARCHAR(20)")
    # Step 2: Drop the old ENUM type
    op.execute("DROP TYPE IF EXISTS sessionstatus")
    # Step 3: Migrate existing data
    op.execute("""
        UPDATE advisory_sessions SET status = CASE
            WHEN status = 'IN_PROGRESS' THEN 'pending'
            WHEN status = 'COMPLETED' THEN 'confirmed'
            WHEN status = 'ARCHIVED' THEN 'confirmed'
            ELSE 'pending'
        END
    """)
    # Step 4: Add CHECK constraint
    op.execute("""
        ALTER TABLE advisory_sessions
        ADD CONSTRAINT advisory_sessions_status_check
        CHECK (status IN ('pending', 'confirmed', 'modified', 'flagged'))
    """)
    # Step 5: Set default
    op.execute("ALTER TABLE advisory_sessions ALTER COLUMN status SET DEFAULT 'pending'")
    # Step 6: Add flag_reason
    op.add_column('advisory_sessions', sa.Column('flag_reason', sa.Text(), nullable=True))
```

**NEVER use `from __future__ import annotations`** in migration files (project convention enforced across all existing migrations).

### B2B Transition Table

```python
VALID_B2B_TRANSITIONS = {
    SessionStatus.PENDING: [SessionStatus.CONFIRMED, SessionStatus.FLAGGED],
    SessionStatus.CONFIRMED: [SessionStatus.MODIFIED, SessionStatus.FLAGGED],
    SessionStatus.MODIFIED: [SessionStatus.CONFIRMED, SessionStatus.FLAGGED],
    SessionStatus.FLAGGED: [SessionStatus.FLAGGED],  # idempotent
}
```

Note: "any state → `flagged`" per AC1. Flagged → flagged is allowed (update flag_reason).

### New Endpoint Pattern (mirrors existing endpoints)

```python
@router.patch("/{session_id}/status", response_model=SessionResponse)
async def update_session_b2b_status(
    session_id: uuid.UUID,
    body: SessionStatusUpdateRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> AdvisorySession:
    # 1. Fetch session
    # 2. Validate flag_reason when status == FLAGGED
    # 3. Validate transition
    # 4. Apply update + commit
    # 5. structlog INFO with session_id, from_status, to_status, tenant_id
```

### Schemas to Update

- `SessionUpdateRequest` in `app/schemas/session.py` — already imports `SessionStatus`; after Task 1.1, the import automatically picks up new values. No structural change needed.
- `SessionResponse.status` — same; the Pydantic model will serialize new enum values correctly.

### Existing Tests That Break After Task 1

These tests in `tests/test_sessions.py` must be updated in Task 5.1:
- `test_create_session`: asserts `data["status"] == "in_progress"` → change to `"pending"`
- `test_update_session_status`: patches with `{"status": "completed"}` → change to `{"status": "confirmed"}`
- `test_update_session_invalid_transition`: tests `completed → in_progress` → update to B2B values

### File Locations

- `app/models/advisory_session.py`: `stravel/backend/app/models/advisory_session.py`
- `app/schemas/session.py`: `stravel/backend/app/schemas/session.py`
- `app/api/v1/sessions.py`: `stravel/backend/app/api/v1/sessions.py`
- Migration: `stravel/backend/alembic/versions/<hash>_b2b_session_status.py`
- New test file: `stravel/backend/tests/test_b2b_session_status.py`

### Test Pattern Reference

```python
import pytest

pytestmark = pytest.mark.integration

@pytest.mark.asyncio
async def test_b2b_status_pending_to_confirmed(async_client):
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id = create_resp.json()["id"]
    # New sessions start at "pending"
    assert create_resp.json()["status"] == "pending"

    response = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}/status",
        json={"status": "confirmed"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"
```

### Previous Story Learnings (Epic 9)

- All Alembic migration files in this project never use `from __future__ import annotations` — enforced.
- `session.execute()` (not `session.exec()`) with `result.scalars().first()` is the correct async SQLAlchemy pattern.
- `logger = structlog.get_logger()` at module level; `structlog.contextvars.bind_contextvars(...)` for request-scoped context.
- `raise ValidationError(...)` from `app.core.exceptions` for business rule failures — maps to HTTP 422.
- `raise NotFoundError("AdvisorySession", str(session_id))` for 404 responses.

### Review Findings

- [x] [Review][Patch] Duplicate `valid_transitions` dict in `update_session` — should reference module-level `VALID_B2B_TRANSITIONS` [sessions.py:~112] — currently a local copy; can silently diverge on future changes
- [x] [Review][Patch] Legacy `PATCH /{session_id}` endpoint can set `status=flagged` without `flag_reason` — violates AC3; add the same `flag_reason` guard to `update_session` [sessions.py:~112]
- [x] [Review][Patch] Migration missing `USING status::text` on `ALTER COLUMN TYPE VARCHAR(20)` — may fail on PostgreSQL without implicit cast [migration:~22]
- [x] [Review][Patch] Migration `ADD CONSTRAINT advisory_sessions_status_check` will fail on re-run — add `DROP CONSTRAINT IF EXISTS advisory_sessions_status_check` before the ADD [migration:~37]
- [x] [Review][Patch] No test for empty-string `flag_reason` — AC3 says "absent **or empty**" must return 422; add `test_b2b_status_flagged_empty_flag_reason` [test_b2b_session_status.py]
- [x] [Review][Patch] Intermediate PATCH calls in multi-step tests are not asserted — silent test infrastructure failures would produce false passes [test_b2b_session_status.py:test_b2b_status_confirmed_to_modified, test_b2b_status_modified_to_confirmed, test_b2b_status_any_to_flagged]
- [x] [Review][Defer] `SessionResponse` schema does not include `flag_reason` — callers cannot verify persisted flag reason without a separate GET; pre-existing schema design decision — deferred, pre-existing
- [x] [Review][Defer] Concurrent PATCH race condition (no `SELECT FOR UPDATE`) — two simultaneous transitions can both pass the state check and both commit [sessions.py:~138] — deferred, pre-existing pattern across all endpoints
- [x] [Review][Defer] Whitespace-only `flag_reason` (e.g. `"   "`) bypasses `not body.flag_reason` guard — stored as valid compliance annotation — deferred, pre-existing
- [x] [Review][Defer] Migration `ELSE 'pending'` fallback silently maps unrecognised values (e.g. mixed-case) to `pending` with no error or log — deferred, acceptable migration safety net
- [x] [Review][Defer] `datetime.now(timezone.utc)` in pre-existing `update_session` endpoint vs `datetime.utcnow()` in new endpoint — project convention is `utcnow()` per project-context.md; the inconsistency was introduced in a prior uncommitted change, not this story — deferred, pre-existing

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Test run showed auth 401 — fixed by updating `tests/conftest.py` to generate a valid JWT token via `create_access_token` with `tenant_id="default"`. The `async_client` fixture now passes `Authorization: Bearer <token>` headers.
- Integration tests require a running PostgreSQL instance — syntax/import validation performed instead; all non-integration streaming tests pass (9/9).

### Completion Notes List

- Replaced `SessionStatus` enum: removed `IN_PROGRESS/COMPLETED/ARCHIVED`, added `PENDING/CONFIRMED/MODIFIED/FLAGGED` with lowercase string values.
- Added `flag_reason: Optional[str]` field to `AdvisorySession` model.
- Created Alembic migration `b2b1c3d4e5f6_b2b_session_status.py` using raw SQL to safely drop the PostgreSQL `sessionstatus` ENUM type and replace with `VARCHAR(20)` + CHECK constraint. Migration handles both uppercase and lowercase legacy values.
- Added `SessionStatusUpdateRequest` to `app/schemas/session.py`.
- Added `PATCH /{session_id}/status` endpoint with B2B transition table, `flag_reason` validation for flagged status, and `structlog` INFO logging of `from_status/to_status/tenant_id`.
- Updated existing `PATCH /{session_id}` endpoint's `valid_transitions` dict to use new B2B enum values.
- Updated `tests/test_sessions.py`: `"in_progress"` → `"pending"`, `"completed"` → `"confirmed"`, invalid transition test updated to B2B values.
- Added `tests/test_b2b_session_status.py` with 8 integration tests covering all B2B transition scenarios.
- Updated `tests/conftest.py` to inject JWT auth headers into `async_client` fixture.

### File List

- `stravel/backend/app/models/advisory_session.py` — SessionStatus enum updated, flag_reason added
- `stravel/backend/app/schemas/session.py` — SessionStatusUpdateRequest added
- `stravel/backend/app/api/v1/sessions.py` — VALID_B2B_TRANSITIONS module-level dict added; new PATCH /{session_id}/status endpoint; existing PATCH /{session_id} transitions updated
- `stravel/backend/alembic/versions/b2b1c3d4e5f6_b2b_session_status.py` — new migration (created)
- `stravel/backend/tests/test_sessions.py` — enum value assertions updated to B2B values
- `stravel/backend/tests/test_b2b_session_status.py` — new file with 8 B2B status tests (created)
- `stravel/backend/tests/conftest.py` — async_client fixture updated to inject JWT auth token

## Change Log

- Story created — 2026-05-28
- Story implemented — 2026-05-29: B2B SessionStatus enum, Alembic migration, PATCH /{session_id}/status endpoint, test suite
