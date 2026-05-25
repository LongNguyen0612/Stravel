# Story 4.4: Compliance Gate & Agent Override

Status: draft

## Story

As a travel agent,
I want the Compliance Agent to block proposal delivery when critical issues exist, while allowing me to override non-critical warnings,
so that unsafe proposals never reach clients but I retain professional judgment on warnings.

## Acceptance Criteria

1. All compliance checks from Stories 4.1-4.3 are aggregated into a single `ComplianceReport` by the Compliance Agent at `agents/compliance/agent.py`
2. Critical issues (visa block, "Do Not Travel" advisory, age restriction violation, passport expiry block) set the compliance status to `block` and prevent proposal export
3. Non-critical warnings (seasonal feasibility, budget over threshold, health advisory, accessibility concern) set the compliance status to `warning` but do not block proposal delivery
4. When all checks pass with no issues, the compliance status is `pass`
5. The `ComplianceReport` shows pass/warning/block for each individual check with resolution guidance for any flagged item
6. Travel agents can override warnings via `POST /api/v1/compliance_reports/{report_id}/override` with a logged acknowledgment
7. Overrides are recorded with: agent user ID, timestamp, override reason, and the specific flags being acknowledged
8. After a successful override, the compliance status changes from `warning` to `pass` (but original flags remain visible in the report)
9. Critical blocks cannot be overridden -- the override endpoint returns `400 Bad Request` if any `block`-severity flags exist
10. The compliance status is visible in the copilot sidebar as pass (green), warning (yellow), or block (red) via SSE events
11. The `agents/orchestrator.py` is updated to replace the compliance stub node with the real Compliance Agent as the final stage before proposal delivery
12. The orchestrator's compliance node reads the proposal and traveler profile from `AdvisoryState`, runs all checks, and writes the `ComplianceReport` back to state
13. Proposal export endpoints (`POST /api/v1/proposals/{proposal_id}/export` and `/share`) are guarded by compliance status -- `block` status returns `403 Forbidden` with the blocking flags
14. The `ComplianceReport` is persisted to the database via a `compliance_reports` table linked to the advisory session

## Tasks / Subtasks

- [ ] Task 1: Create compliance Pydantic schemas (AC: #1, #4, #5)
  - [ ] Create `backend/app/schemas/compliance.py` with the following schemas:
    - `ComplianceSeverity` -- `str` enum with values: `pass`, `warning`, `block`
    - `ComplianceCheckType` -- `str` enum with values: `visa`, `passport`, `health`, `travel_advisory`, `age_restriction`, `seasonal`, `budget`, `accessibility`
    - `ComplianceFlag` -- individual check result with fields: `check_type: ComplianceCheckType`, `severity: ComplianceSeverity`, `title: str`, `message: str`, `resolution: str = ""`, `alternative: str = ""`, `metadata: dict = {}`
    - `ComplianceReport` -- aggregate report with fields: `session_id: str`, `overall_status: ComplianceSeverity`, `flags: list[ComplianceFlag]`, `checked_at: datetime`, `overridden: bool = False`, `override_details: OverrideDetails | None = None`
    - `OverrideDetails` -- with fields: `user_id: str`, `timestamp: datetime`, `reason: str`, `acknowledged_flags: list[str]`
    - `ComplianceOverrideRequest` -- API request with fields: `reason: str`
    - `ComplianceReportResponse` -- API response extending `ComplianceReport` with `id: str`
  - [ ] Ensure `ComplianceFlag` in `schemas/streaming.py` remains for SSE events (separate concern from the full compliance schema)
  - [ ] Add `ComplianceSeverity` computation logic: `block` if any flag is `block`, else `warning` if any flag is `warning`, else `pass`

- [ ] Task 2: Create `ComplianceReport` SQLModel database model (AC: #14)
  - [ ] Create `backend/app/models/compliance_report.py` with fields:
    - `id: uuid.UUID` (PK)
    - `advisory_session_id: uuid.UUID` (FK to `advisory_sessions.id`, indexed)
    - `tenant_id: uuid.UUID` (indexed, required for multi-tenancy)
    - `overall_status: str` (pass/warning/block)
    - `flags: dict` (JSON column storing the list of `ComplianceFlag` dicts)
    - `checked_at: datetime` (UTC)
    - `overridden: bool` (default False)
    - `overridden_by: uuid.UUID | None` (FK to `users.id`)
    - `overridden_at: datetime | None`
    - `override_reason: str | None`
    - `created_at: datetime` (UTC)
    - `updated_at: datetime` (UTC)
  - [ ] Use `Optional["AdvisorySession"]` for relationship (NOT `from __future__ import annotations`)
  - [ ] Use `datetime.utcnow` for all default datetime factories (NOT `datetime.now(timezone.utc)`)
  - [ ] Register model in `models/__init__.py`
  - [ ] Create Alembic migration: `alembic revision --autogenerate -m "add_compliance_reports"`
  - [ ] Verify migration runs cleanly with `alembic upgrade head`

- [ ] Task 3: Implement Compliance Agent LangGraph node (AC: #1, #2, #3, #4, #12)
  - [ ] Create `backend/app/agents/compliance/agent.py`
  - [ ] Implement `compliance_gate_node(state: AdvisoryState) -> dict` as the LangGraph node function
  - [ ] The node must:
    - Read `state.traveler_profile` and `state.proposal` from `AdvisoryState`
    - Import and invoke individual check functions from Stories 4.1-4.3 modules:
      - `agents/compliance/visa.py` -- `check_visa_requirements()`
      - `agents/compliance/passport.py` -- `check_passport_validity()`
      - `agents/compliance/health.py` -- `check_health_requirements()`
      - `agents/compliance/travel_advisory.py` -- `check_travel_advisory()`
      - `agents/compliance/age_restrictions.py` -- `check_age_restrictions()`
      - `agents/compliance/seasonal.py` -- `check_seasonal_feasibility()`
      - `agents/compliance/budget_check.py` -- `check_budget_feasibility()`
      - `agents/compliance/accessibility.py` -- `check_accessibility()`
    - Aggregate all returned `ComplianceFlag` items into a `ComplianceReport`
    - Compute `overall_status` from the highest severity across all flags
    - Write the `ComplianceReport` to `state.compliance_report`
    - Return errors in `AdvisoryState.errors` list -- never raise exceptions
  - [ ] Log with structlog: `agent="compliance"`, `session_id`, `tenant_id`, `overall_status`, `flag_count`, `block_count`, `warning_count`
  - [ ] If `state.proposal` is None (upstream failure), append an error and return without crashing
  - [ ] If individual check modules are not yet implemented (Stories 4.1-4.3 incomplete), handle `ImportError` gracefully and log a warning

- [ ] Task 4: Define check function Protocol and stub interfaces (AC: #1, #12)
  - [ ] Create `backend/app/agents/compliance/protocols.py` defining the expected signature for each check function:
    ```python
    async def check_visa_requirements(
        traveler_profile: TravelerProfileResponse,
        proposal: dict,
    ) -> list[ComplianceFlag]: ...
    ```
  - [ ] If Stories 4.1-4.3 check modules do not yet exist, create stub implementations that return empty lists
  - [ ] Stubs must log a warning: `"compliance.check.stub"` with the check name so it is obvious they are not real

- [ ] Task 5: Update orchestrator to use real compliance node (AC: #11, #12)
  - [ ] In `backend/app/agents/orchestrator.py`, replace the stub `compliance_node` with the real `compliance_gate_node` from `agents/compliance/agent.py`
  - [ ] The compliance node must be the final node before `END` in the graph
  - [ ] Graph flow remains: `START -> profiling -> calculation -> proposal -> compliance -> END`
  - [ ] The compliance node receives the full `AdvisoryState` including `traveler_profile`, `calculations`, and `proposal` from prior nodes
  - [ ] Verify the graph still compiles and all existing tests pass after the swap

- [ ] Task 6: Create compliance API endpoint for override (AC: #6, #7, #8, #9, #13)
  - [ ] Create `backend/app/api/v1/compliance.py` with the following endpoints:
    - `GET /api/v1/compliance_reports/{report_id}` -- returns the compliance report (tenant-scoped)
    - `GET /api/v1/compliance_reports/session/{session_id}` -- returns the latest compliance report for a session (tenant-scoped)
    - `POST /api/v1/compliance_reports/{report_id}/override` -- accepts `ComplianceOverrideRequest`, processes the override
  - [ ] Override endpoint logic:
    - Verify report belongs to the requesting tenant (return 404 if not, never 403)
    - Check if any flags have severity `block` -- if so, return `400 Bad Request` with `{"detail": {"code": "CRITICAL_BLOCK_CANNOT_OVERRIDE", "message": "Cannot override critical compliance blocks. Resolve blocking issues first.", "blocking_flags": [...]}}`
    - Update the report: set `overridden=True`, `overridden_by=get_user_id()`, `overridden_at=datetime.utcnow()`, `override_reason=request.reason`
    - Update `overall_status` from `warning` to `pass`
    - Persist to database
    - Log the override with structlog: `tenant_id`, `user_id`, `report_id`, `reason`, `flag_count`
  - [ ] All endpoints require auth via `Depends(require_auth)`
  - [ ] All queries filter by `tenant_id` from `get_tenant_id()`
  - [ ] Register compliance router in `api/v1/router.py`

- [ ] Task 7: Guard proposal export with compliance status (AC: #13)
  - [ ] Update proposal export endpoints (when they exist from Story 3.7) to check compliance status before allowing export
  - [ ] If compliance status is `block`, return `403 Forbidden` with:
    ```json
    {
      "detail": {
        "code": "COMPLIANCE_BLOCK",
        "message": "Proposal export blocked by compliance checks",
        "blocking_flags": [...]
      }
    }
    ```
  - [ ] If compliance status is `warning` and not overridden, return `400 Bad Request` with guidance to review and override warnings first
  - [ ] If proposal export endpoints do not yet exist (Story 3.7 not implemented), create a guard utility in `agents/compliance/guards.py` that can be applied as a FastAPI dependency:
    ```python
    async def require_compliance_pass(
        session_id: str,
        db: AsyncSession,
    ) -> ComplianceReport:
        """FastAPI dependency that blocks if compliance is not passed."""
    ```

- [ ] Task 8: Emit compliance SSE events (AC: #10)
  - [ ] When the compliance node completes, emit SSE events for each flag:
    - `event: agent.compliance.flag\ndata: {"type": "flag", "severity": "...", "check": "...", "message": "...", "alternative": "..."}`
  - [ ] Emit overall compliance result:
    - `event: agent.compliance.result\ndata: {"type": "compliance_result", "overall_status": "pass|warning|block", "flag_count": N}`
  - [ ] Emit on override:
    - `event: agent.compliance.override\ndata: {"type": "override", "overall_status": "pass", "overridden_by": "...", "reason": "..."}`
  - [ ] Use the existing event bus pattern from `services/event_bus.py` (asyncio.Queue per session)

- [ ] Task 9: Update AdvisoryState for typed compliance report (AC: #12)
  - [ ] Update `agents/state.py` to replace `compliance_report: dict | None = None` with `compliance_report: ComplianceReport | None = None` (import from `schemas/compliance.py`)
  - [ ] Ensure backward compatibility -- existing tests that set `compliance_report` as `dict` must still work or be updated
  - [ ] Verify all existing orchestrator tests pass after the type change

- [ ] Task 10: Write unit tests (AC: all)
  - [ ] Create `backend/app/agents/compliance/tests/test_compliance_agent.py`
  - [ ] Test: compliance node with no issues returns `overall_status="pass"` and empty flags
  - [ ] Test: compliance node with visa block sets `overall_status="block"`
  - [ ] Test: compliance node with travel advisory "Do Not Travel" sets `overall_status="block"`
  - [ ] Test: compliance node with age restriction violation sets `overall_status="block"`
  - [ ] Test: compliance node with only warnings (seasonal, budget, health) sets `overall_status="warning"`
  - [ ] Test: compliance node with mixed warnings and blocks sets `overall_status="block"` (highest severity wins)
  - [ ] Test: compliance node with missing proposal (`state.proposal=None`) appends error and does not crash
  - [ ] Test: overall status computation -- `block` > `warning` > `pass`
  - [ ] Create `backend/app/api/v1/tests/test_compliance.py`
  - [ ] Test: `GET /compliance_reports/{id}` returns report with correct structure
  - [ ] Test: `GET /compliance_reports/{id}` returns 404 for other tenant's report
  - [ ] Test: `POST /override` with only warnings succeeds -- status changes to `pass`, `overridden=True`
  - [ ] Test: `POST /override` with blocking flags returns 400
  - [ ] Test: `POST /override` records `overridden_by`, `overridden_at`, `override_reason`
  - [ ] Test: override is tenant-scoped -- cannot override another tenant's report
  - [ ] Test: export guard blocks when status is `block`, allows when `pass`
  - [ ] All tests pass with PostgreSQL only -- no Qdrant, no Redis, no LLM required
  - [ ] Mock individual check functions (visa, health, etc.) -- do NOT require Stories 4.1-4.3 to be implemented

## Dev Notes

### Critical Architecture Constraints

- **Pydantic BaseModel for state** -- `ComplianceReport` in `AdvisoryState` uses Pydantic, NOT TypedDict
- **Errors in state, not exceptions** -- the compliance node appends errors to `AdvisoryState.errors`, never raises
- **Protocol-based DI** -- compliance check functions are invoked via known signatures, not through direct cross-agent imports
- **Tenant isolation** -- all database queries for compliance reports MUST filter by `tenant_id`
- **Return 404 not 403** -- for cross-tenant access attempts, to prevent enumeration
- **structlog everywhere** -- include `tenant_id`, `session_id`, `agent_name` in every log entry
- **No `from __future__ import annotations`** in SQLModel files -- causes startup crash
- **Use `datetime.utcnow()`** -- NOT `datetime.now(timezone.utc)` for DB timestamps
- **Use `session.execute()`** -- NOT `session.exec()` with AsyncSession
- **Use `.scalars().first()`** -- on async query results

### Existing Code Context

**AdvisoryState** at `app/agents/state.py`:
```python
class AdvisoryState(BaseModel):
    session_id: str
    tenant_id: str
    stage: Literal["profiling", "calculating", "proposing", "validating"] = "profiling"
    traveler_profile: TravelerProfileResponse | None = None
    calculations: dict | None = None
    proposal: dict | None = None
    compliance_report: dict | None = None  # Will be typed to ComplianceReport
    errors: list[dict] = []
```

**Current orchestrator** at `app/agents/orchestrator.py` has a stub `compliance_node`:
```python
async def compliance_node(state: AdvisoryState) -> dict:
    """Stub -- passes through with stage update."""
    logger.info("agent.compliance.started", session_id=state.session_id)
    return {"stage": "validating"}
```

This stub must be replaced with the real compliance gate node.

**Existing ComplianceFlag** in `schemas/streaming.py` (for SSE events):
```python
class ComplianceFlag(BaseModel):
    type: str = "flag"
    severity: str  # "block", "warning"
    check: str
    message: str
    alternative: str = ""
```

The new `schemas/compliance.py` will define a richer `ComplianceFlag` for the full compliance report. The streaming schema remains separate for SSE event serialization.

**Existing compliance rules JSON** in `agents/compliance/rules/`:
- `vietnam_visa.json` -- visa rules by nationality
- `vietnam_health.json` -- health advisories
- `vietnam_travel_warnings.json` -- travel advisory levels
- `vietnam_seasons.json` -- monsoon patterns by region

**Compliance check modules** (from Stories 4.1-4.3, may or may not exist yet):
- `agents/compliance/visa.py`
- `agents/compliance/passport.py`
- `agents/compliance/health.py`
- `agents/compliance/travel_advisory.py`
- `agents/compliance/age_restrictions.py`
- `agents/compliance/seasonal.py`
- `agents/compliance/budget_check.py`
- `agents/compliance/accessibility.py`

### Compliance Severity Logic

```python
# The overall_status is computed from the highest severity across all flags.
# block > warning > pass

def compute_overall_status(flags: list[ComplianceFlag]) -> ComplianceSeverity:
    """Determine overall compliance status from individual flags."""
    if any(f.severity == ComplianceSeverity.BLOCK for f in flags):
        return ComplianceSeverity.BLOCK
    if any(f.severity == ComplianceSeverity.WARNING for f in flags):
        return ComplianceSeverity.WARNING
    return ComplianceSeverity.PASS
```

### Critical vs Non-Critical Classification

| Check | Critical (block) | Non-Critical (warning) |
|---|---|---|
| Visa | Required visa not obtained, overstay risk | Processing time tight |
| Passport | Expires within 6 months of travel | Expiry date not provided |
| Travel Advisory | "Do Not Travel" (Level 4) | Level 2-3 advisories |
| Age Restriction | Activity violates minimum age | Close to minimum age |
| Health | -- | Required/recommended vaccinations |
| Seasonal | -- | Monsoon season travel |
| Budget | -- | Budget exceeded by >10% |
| Accessibility | -- | Venue accessibility uncertain |

### Compliance Agent Node Pattern

```python
# agents/compliance/agent.py
import structlog
from datetime import datetime

from app.agents.state import AdvisoryState
from app.schemas.compliance import ComplianceFlag, ComplianceReport, ComplianceSeverity

logger = structlog.get_logger()


async def compliance_gate_node(state: AdvisoryState) -> dict:
    """LangGraph node: runs all compliance checks and produces a ComplianceReport.

    This is the final node before END in the advisory workflow.
    Critical flags (block) prevent proposal export.
    Warning flags are surfaced but do not block.
    """
    logger.info(
        "agent.compliance.started",
        agent="compliance",
        session_id=state.session_id,
        tenant_id=state.tenant_id,
    )

    if state.proposal is None:
        logger.error(
            "agent.compliance.no_proposal",
            session_id=state.session_id,
        )
        return {
            "stage": "validating",
            "errors": [
                *state.errors,
                {"agent": "compliance", "message": "No proposal to validate"},
            ],
        }

    all_flags: list[ComplianceFlag] = []

    # Run each check, catch failures individually
    checks = [
        ("visa", _run_visa_check),
        ("passport", _run_passport_check),
        ("health", _run_health_check),
        ("travel_advisory", _run_travel_advisory_check),
        ("age_restriction", _run_age_restriction_check),
        ("seasonal", _run_seasonal_check),
        ("budget", _run_budget_check),
        ("accessibility", _run_accessibility_check),
    ]

    for check_name, check_fn in checks:
        try:
            flags = await check_fn(state)
            all_flags.extend(flags)
        except Exception as e:
            logger.error(
                "agent.compliance.check_failed",
                check=check_name,
                error=str(e),
                session_id=state.session_id,
            )
            all_flags.append(ComplianceFlag(
                check_type=check_name,
                severity=ComplianceSeverity.WARNING,
                title=f"{check_name} check failed",
                message=f"Could not complete {check_name} check: {str(e)}",
                resolution="Manual verification required",
            ))

    overall_status = compute_overall_status(all_flags)

    report = ComplianceReport(
        session_id=state.session_id,
        overall_status=overall_status,
        flags=all_flags,
        checked_at=datetime.utcnow(),
    )

    block_count = sum(1 for f in all_flags if f.severity == ComplianceSeverity.BLOCK)
    warning_count = sum(1 for f in all_flags if f.severity == ComplianceSeverity.WARNING)

    logger.info(
        "agent.compliance.completed",
        agent="compliance",
        session_id=state.session_id,
        overall_status=overall_status,
        flag_count=len(all_flags),
        block_count=block_count,
        warning_count=warning_count,
    )

    return {
        "stage": "validating",
        "compliance_report": report.model_dump(),
    }
```

### Override Endpoint Pattern

```python
# api/v1/compliance.py
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.dependencies import get_db, require_auth
from app.core.tenant import get_tenant_id, get_user_id
from app.core.exceptions import AppError

router = APIRouter(prefix="/compliance_reports", tags=["compliance"])


@router.post("/{report_id}/override")
async def override_compliance_warnings(
    report_id: str,
    request: ComplianceOverrideRequest,
    db: AsyncSession = Depends(get_db),
    _auth=Depends(require_auth),
):
    tenant_id = get_tenant_id()
    user_id = get_user_id()

    # Fetch report (tenant-scoped -- returns 404 for wrong tenant)
    report = await _get_report(report_id, tenant_id, db)

    # Check for blocking flags -- cannot override critical blocks
    blocking_flags = [f for f in report.flags if f["severity"] == "block"]
    if blocking_flags:
        raise AppError(
            "CRITICAL_BLOCK_CANNOT_OVERRIDE",
            "Cannot override critical compliance blocks. Resolve blocking issues first.",
            status_code=400,
            extra={"blocking_flags": blocking_flags},
        )

    # Apply override
    report.overridden = True
    report.overridden_by = user_id
    report.overridden_at = datetime.utcnow()
    report.override_reason = request.reason
    report.overall_status = "pass"

    db.add(report)
    await db.commit()
    await db.refresh(report)

    logger.info(
        "compliance.override",
        tenant_id=tenant_id,
        user_id=user_id,
        report_id=report_id,
        reason=request.reason,
        flag_count=len(report.flags),
    )

    return report
```

### SSE Event Patterns for Compliance

```
# Individual flag emitted during compliance check
event: agent.compliance.flag
data: {"type": "flag", "severity": "block", "check": "visa", "message": "E-visa required for Russian nationals visiting mainland Vietnam", "alternative": "Apply at evisa.gov.vn at least 5 business days before departure"}

# Overall compliance result
event: agent.compliance.result
data: {"type": "compliance_result", "overall_status": "block", "flag_count": 3, "block_count": 1, "warning_count": 2}

# Override acknowledgment
event: agent.compliance.override
data: {"type": "override", "overall_status": "pass", "overridden_by": "user-uuid", "reason": "Client has confirmed visa application submitted"}
```

### Database Schema

```sql
CREATE TABLE compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advisory_session_id UUID NOT NULL REFERENCES advisory_sessions(id),
    tenant_id UUID NOT NULL,
    overall_status VARCHAR(10) NOT NULL,  -- 'pass', 'warning', 'block'
    flags JSONB NOT NULL DEFAULT '[]',
    checked_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    overridden BOOLEAN NOT NULL DEFAULT FALSE,
    overridden_by UUID REFERENCES users(id),
    overridden_at TIMESTAMP WITHOUT TIME ZONE,
    override_reason TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_compliance_reports_session_id ON compliance_reports(advisory_session_id);
CREATE INDEX ix_compliance_reports_tenant_id ON compliance_reports(tenant_id);
```

### Export Guard Pattern

```python
# agents/compliance/guards.py
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from app.core.dependencies import get_db
from app.core.exceptions import AppError
from app.core.tenant import get_tenant_id
from app.models.compliance_report import ComplianceReport


async def require_compliance_pass(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> ComplianceReport:
    """FastAPI dependency: blocks proposal export if compliance is not passed.

    Returns the compliance report if status is 'pass'.
    Raises 403 if status is 'block'.
    Raises 400 if status is 'warning' (must override first).
    Raises 404 if no report exists.
    """
    tenant_id = get_tenant_id()

    result = await db.execute(
        select(ComplianceReport)
        .where(
            ComplianceReport.advisory_session_id == session_id,
            ComplianceReport.tenant_id == tenant_id,
        )
        .order_by(ComplianceReport.checked_at.desc())
    )
    report = result.scalars().first()

    if not report:
        raise AppError(
            "COMPLIANCE_NOT_RUN",
            "Compliance checks have not been run for this session",
            status_code=404,
        )

    if report.overall_status == "block":
        blocking_flags = [f for f in report.flags if f.get("severity") == "block"]
        raise AppError(
            "COMPLIANCE_BLOCK",
            "Proposal export blocked by compliance checks",
            status_code=403,
            extra={"blocking_flags": blocking_flags},
        )

    if report.overall_status == "warning" and not report.overridden:
        raise AppError(
            "COMPLIANCE_WARNINGS_UNACKNOWLEDGED",
            "Override compliance warnings before exporting proposal",
            status_code=400,
            extra={"warning_count": sum(1 for f in report.flags if f.get("severity") == "warning")},
        )

    return report
```

### Dependencies on Prior Stories

| Dependency | Story | Status | Fallback |
|---|---|---|---|
| Visa check module | 4.1 | Prerequisite | Stub returning empty list |
| Passport check module | 4.1 | Prerequisite | Stub returning empty list |
| Health check module | 4.2 | Prerequisite | Stub returning empty list |
| Travel advisory module | 4.2 | Prerequisite | Stub returning empty list |
| Age restriction module | 4.2 | Prerequisite | Stub returning empty list |
| Seasonal check module | 4.3 | Prerequisite | Stub returning empty list |
| Budget check module | 4.3 | Prerequisite | Stub returning empty list |
| Accessibility module | 4.3 | Prerequisite | Stub returning empty list |
| Orchestrator graph | 1.3 | Complete | N/A -- exists |
| Auth + tenant middleware | 1.6 | Complete | N/A -- exists |
| SSE streaming | 1.7 | Complete | N/A -- exists |
| Proposal export endpoint | 3.7 | May not exist | Create guard utility for future use |

If Stories 4.1-4.3 are not yet implemented, this story can still be completed using stub check functions. The stubs return empty flag lists, and the compliance gate, override endpoint, and export guard are fully functional. When 4.1-4.3 are implemented, the stubs are replaced with real check logic -- no changes to the gate or override code are needed.

### File Structure After This Story

```
backend/app/
├── agents/
│   ├── orchestrator.py              # MODIFIED -- real compliance node
│   ├── state.py                     # MODIFIED -- typed ComplianceReport
│   └── compliance/
│       ├── __init__.py              # EXISTS
│       ├── agent.py                 # NEW -- compliance gate LangGraph node
│       ├── guards.py               # NEW -- export guard dependency
│       ├── protocols.py            # NEW -- check function signatures
│       ├── rules/                   # EXISTS -- JSON rule files
│       └── tests/
│           ├── __init__.py          # EXISTS
│           └── test_compliance_agent.py  # NEW
├── models/
│   ├── __init__.py                  # MODIFIED -- register ComplianceReport
│   └── compliance_report.py         # NEW -- SQLModel
├── schemas/
│   ├── compliance.py                # NEW -- Pydantic schemas
│   └── streaming.py                 # EXISTS (keep existing ComplianceFlag for SSE)
├── api/v1/
│   ├── compliance.py                # NEW -- override endpoint
│   ├── router.py                    # MODIFIED -- register compliance router
│   └── tests/
│       └── test_compliance.py       # NEW
```

### Anti-Patterns -- DO NOT

- **DO NOT** allow overriding critical blocks -- `block` severity flags can NEVER be overridden
- **DO NOT** raise exceptions inside the compliance agent node -- always append to `AdvisoryState.errors`
- **DO NOT** import check module internals -- invoke via the defined function signature
- **DO NOT** return 403 for cross-tenant compliance report access -- return 404
- **DO NOT** skip `tenant_id` filtering on any compliance report query
- **DO NOT** use `from __future__ import annotations` in the `ComplianceReport` model file
- **DO NOT** use `datetime.now(timezone.utc)` for DB timestamps -- use `datetime.utcnow()`
- **DO NOT** use `session.exec()` with AsyncSession -- use `session.execute()`
- **DO NOT** delete or modify the existing `ComplianceFlag` in `schemas/streaming.py` -- it serves a different purpose (SSE events)
- **DO NOT** make the compliance node conditional or skippable -- it is always the final stage
- **DO NOT** use `MemorySaver` for production checkpointing -- use `AsyncPostgresSaver`
- **DO NOT** implement the individual check logic (visa, health, etc.) -- that belongs to Stories 4.1-4.3

### Testing Strategy

All tests must pass with PostgreSQL only. No Qdrant, Redis, or LLM required.

```python
# Mock check functions for testing
class MockChecks:
    """Provides mock compliance check functions for unit tests."""

    @staticmethod
    async def visa_pass(profile, proposal) -> list:
        return []

    @staticmethod
    async def visa_block(profile, proposal) -> list:
        return [ComplianceFlag(
            check_type=ComplianceCheckType.VISA,
            severity=ComplianceSeverity.BLOCK,
            title="Visa required",
            message="E-visa required for Russian nationals",
            resolution="Apply at evisa.gov.vn",
        )]

    @staticmethod
    async def seasonal_warning(profile, proposal) -> list:
        return [ComplianceFlag(
            check_type=ComplianceCheckType.SEASONAL,
            severity=ComplianceSeverity.WARNING,
            title="Monsoon season",
            message="Central Vietnam monsoon Oct-Dec",
            resolution="Consider alternative dates or Southern Vietnam",
        )]


# Override test fixtures
@pytest.fixture
async def compliance_report_with_warnings(db_session, test_session):
    report = ComplianceReportModel(
        advisory_session_id=test_session.id,
        tenant_id=test_session.tenant_id,
        overall_status="warning",
        flags=[{
            "check_type": "seasonal",
            "severity": "warning",
            "title": "Monsoon season",
            "message": "Travel during monsoon",
            "resolution": "Consider alternatives",
        }],
        checked_at=datetime.utcnow(),
    )
    db_session.add(report)
    await db_session.commit()
    return report


@pytest.fixture
async def compliance_report_with_blocks(db_session, test_session):
    report = ComplianceReportModel(
        advisory_session_id=test_session.id,
        tenant_id=test_session.tenant_id,
        overall_status="block",
        flags=[{
            "check_type": "visa",
            "severity": "block",
            "title": "Visa block",
            "message": "Visa required",
            "resolution": "Apply for e-visa",
        }],
        checked_at=datetime.utcnow(),
    )
    db_session.add(report)
    await db_session.commit()
    return report
```

### FR Traceability

| FR | Coverage |
|---|---|
| FR-23 | Full -- compliance gate blocks critical, warns non-critical, agent override with log |
| FR-15 | Aggregated -- visa check results consumed from Story 4.1 |
| FR-16 | Aggregated -- health check results consumed from Story 4.2 |
| FR-17 | Aggregated -- travel advisory results consumed from Story 4.2 |
| FR-18 | Aggregated -- age restriction results consumed from Story 4.2 |
| FR-19 | Aggregated -- seasonal check results consumed from Story 4.3 |
| FR-20 | Aggregated -- budget check results consumed from Story 4.3 |
| FR-21 | Aggregated -- accessibility results consumed from Story 4.3 |
| FR-22 | Aggregated -- passport check results consumed from Story 4.1 |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- LangGraph State Convention, Protocol Interface Convention]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Data Architecture: LangGraph checkpointer, compliance_reports table]
- [Source: _bmad-output/planning-artifacts/architecture.md -- API & Communication Patterns: SSE event format]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Error Handling: Compliance blocks return ComplianceFlag]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Boundary Rules: agents communicate via AdvisoryState only]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 4, Story 4.4: Compliance Gate & Agent Override]
- [Source: _bmad-output/planning-artifacts/epics.md -- FR-23: Compliance Gate]
- [Source: _bmad-output/project-context.md -- Critical Implementation Rules]
- [Source: _bmad-output/project-context.md -- SQLAlchemy Async patterns, Datetime rules]
- [Source: backend/app/agents/orchestrator.py -- Current stub compliance_node]
- [Source: backend/app/agents/state.py -- Current AdvisoryState with untyped compliance_report]
- [Source: backend/app/schemas/streaming.py -- Existing ComplianceFlag for SSE]

## Dev Agent Record

### Agent Model Used

(To be filled by implementing agent)

### Debug Log References

(To be filled during implementation)

### Completion Notes List

(To be filled during implementation)

### Change Log

- 2026-05-24: Story spec created -- ready for dev

### File List

(To be filled during implementation)
