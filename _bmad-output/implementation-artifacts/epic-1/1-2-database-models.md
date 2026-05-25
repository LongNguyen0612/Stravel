# Story 1.2: Database Models & Advisory Session API

Status: done

## Story

As a developer,
I want database models and API endpoints for advisory sessions,
so that the Profiling Agent has a data layer to store traveler profiles.

## Acceptance Criteria

1. SQLModel models exist for `AdvisorySession` and `TravelerProfile` with all required fields, relationships, and constraints
2. A session created via `POST /api/v1/advisory_sessions` returns a session with unique ID, status `IN_PROGRESS`, and an empty `TravelerProfile`
3. Alembic migration creates the `advisory_sessions` and `traveler_profiles` tables in PostgreSQL
4. `GET /api/v1/advisory_sessions/{session_id}` returns session details including the nested traveler profile
5. `PATCH /api/v1/advisory_sessions/{session_id}` can update session status (e.g., `IN_PROGRESS` -> `COMPLETED` or `ARCHIVED`)
6. `core/exceptions.py` is extended with domain-specific errors: `NotFoundError`, `ValidationError`, and a global exception handler registered on the FastAPI app
7. All API requests emit structured JSON logs via `structlog` including `session_id` where applicable
8. OpenTelemetry middleware creates a trace span for every request (already exists from Story 1.1; verify spans include `session_id` attribute)
9. All queries filter by `tenant_id` (use a hardcoded placeholder `"default"` tenant until Story 1.6 adds auth)
10. Request and response bodies use dedicated Pydantic schemas (not the SQLModel table models directly)

## Tasks / Subtasks

- [x] Task 1: Create SQLModel models (AC: #1)
  - [x] Create `app/models/advisory_session.py` with `AdvisorySession` model (see Dev Notes for schema)
  - [x] Create `app/models/traveler_profile.py` with `TravelerProfile` model (see Dev Notes for schema)
  - [x] Create `SessionStatus` enum in `app/models/advisory_session.py`
  - [x] Add `__all__` exports in `app/models/__init__.py` importing both models
  - [x] Verify SQLModel metadata picks up both tables

- [x] Task 2: Create Pydantic request/response schemas (AC: #10)
  - [x] Create `app/schemas/session.py` with `SessionCreateRequest`, `SessionUpdateRequest`, `SessionResponse`, `SessionListResponse`
  - [x] Create `app/schemas/profile.py` with `TravelerProfileResponse`, `TravelerProfileUpdateRequest`
  - [x] Add `__all__` exports in `app/schemas/__init__.py`

- [x] Task 3: Update database configuration for async sessions (AC: #1, #3)
  - [x] Update `app/core/database.py` to add `async_engine` and `AsyncSession` factory using `create_async_engine`
  - [x] Add `get_session` async dependency generator for FastAPI DI
  - [x] Update `pyproject.toml` to add `asyncpg` dependency (async PostgreSQL driver)
  - [x] Verify engine connects to PostgreSQL on startup

- [x] Task 4: Create Alembic migration (AC: #3)
  - [x] Import models in `alembic/env.py` so metadata is populated (add `import app.models`)
  - [x] Run `alembic revision --autogenerate -m "create advisory_sessions and traveler_profiles"`
  - [x] Review generated migration for correctness (indexes, constraints, foreign keys)
  - [x] Run `alembic upgrade head` to verify migration applies cleanly
  - [x] Run `alembic downgrade -1` and then `alembic upgrade head` to verify reversibility

- [x] Task 5: Extend exception handling (AC: #6)
  - [x] Add `NotFoundError(AppError)` subclass for 404 responses
  - [x] Add `ValidationError(AppError)` subclass for 422 responses
  - [x] Register global exception handler in `app/main.py` that catches `AppError` and returns consistent JSON format
  - [x] Ensure unhandled exceptions return a generic 500 with `INTERNAL_ERROR` code (no stack trace in response)

- [x] Task 6: Create advisory session API endpoints (AC: #2, #4, #5, #7, #9)
  - [x] Create `app/api/v1/sessions.py` with `POST /advisory_sessions` endpoint
  - [x] Implement `GET /advisory_sessions/{session_id}` with tenant_id filter
  - [x] Implement `PATCH /advisory_sessions/{session_id}` for status updates
  - [x] Implement `GET /advisory_sessions` list endpoint with pagination (limit/offset)
  - [x] Add `tenant_id` placeholder dependency in `app/core/dependencies.py` returning `"default"`
  - [x] Register sessions router in `app/api/v1/router.py`

- [x] Task 7: Add structlog context for session operations (AC: #7, #8)
  - [x] Bind `session_id` to structlog contextvars in session endpoints
  - [x] Bind `tenant_id` to structlog contextvars via the tenant dependency
  - [x] Add OpenTelemetry span attributes for `session_id` and `tenant_id` in middleware
  - [x] Log `session.created`, `session.retrieved`, `session.updated` events

- [x] Task 8: Write tests (AC: #1-#10)
  - [x] Create `tests/conftest.py` fixture for test database (use a separate test DB or transaction rollback)
  - [x] Create `tests/test_sessions.py` with tests:
    - [x] `test_create_session` — POST returns 201 with session_id, status IN_PROGRESS, and empty profile
    - [x] `test_get_session` — GET returns session with nested profile
    - [x] `test_get_session_not_found` — GET returns 404 with `ENTITY_NOT_FOUND` error code
    - [x] `test_update_session_status` — PATCH updates status correctly
    - [x] `test_update_session_invalid_status` — PATCH with invalid status returns 422
    - [x] `test_list_sessions` — GET returns paginated list filtered by tenant_id
    - [x] `test_tenant_isolation` — session created with tenant A is not visible to tenant B query
  - [x] All tests must pass with PostgreSQL (not SQLite)

- [x] Task 9: Address deferred items from Story 1.1 (AC: #1)
  - [x] Update `AdvisoryState` in `agents/state.py` to reference `TravelerProfile` Pydantic schema instead of bare `dict` for `traveler_profile` field

## Dev Notes

### Architecture Constraints

- **Python 3.12+** with modern syntax (`X | Y` union types, etc.)
- **SQLModel** for ORM models (combines SQLAlchemy + Pydantic)
- **Pydantic v2** schemas for request/response (separate from SQLModel table models)
- **structlog** for all logging -- never use stdlib `logging` directly
- **Async all the way** -- use `AsyncSession`, `async def` endpoints
- **snake_case** for table names (plural) and column names
- **PascalCase** for Python classes
- **No auth yet** -- Story 1.6 adds JWT. Use a placeholder `get_current_tenant_id()` dependency that returns `"default"`
- **PostgreSQL only** for tests -- no SQLite, no mocks for the database layer
- **Alembic** for migrations -- never use `SQLModel.metadata.create_all()` in production code

### SQLModel Model Definitions

```python
# app/models/advisory_session.py
import uuid
from datetime import datetime
from enum import Enum

from sqlmodel import Field, Relationship, SQLModel


class SessionStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class AdvisorySession(SQLModel, table=True):
    __tablename__ = "advisory_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    tenant_id: str = Field(index=True, max_length=64)
    status: SessionStatus = Field(default=SessionStatus.IN_PROGRESS)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship
    traveler_profile: "TravelerProfile | None" = Relationship(
        back_populates="advisory_session",
        sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"},
    )
```

```python
# app/models/traveler_profile.py
import uuid
from datetime import date, datetime

from sqlmodel import Field, Relationship, SQLModel


class TravelerProfile(SQLModel, table=True):
    __tablename__ = "traveler_profiles"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    advisory_session_id: uuid.UUID = Field(
        foreign_key="advisory_sessions.id", unique=True, index=True
    )
    tenant_id: str = Field(index=True, max_length=64)

    # Demographics
    traveler_count: int | None = None
    traveler_ages: list[int] | None = Field(default=None, sa_type=JSON)
    nationalities: list[str] | None = Field(default=None, sa_type=JSON)

    # Dates
    travel_start_date: date | None = None
    travel_end_date: date | None = None
    date_flexibility: str | None = None  # "fixed", "flexible_week", "flexible_month"

    # Budget
    budget_total: float | None = None
    budget_currency: str | None = Field(default="USD", max_length=3)

    # Preferences (stored as JSON for flexibility during profiling)
    destination_preferences: list[str] | None = Field(default=None, sa_type=JSON)
    accommodation_style: str | None = None  # "budget", "mid-range", "luxury"
    dietary_requirements: list[str] | None = Field(default=None, sa_type=JSON)
    accessibility_needs: list[str] | None = Field(default=None, sa_type=JSON)
    activity_preferences: list[str] | None = Field(default=None, sa_type=JSON)
    special_interests: list[str] | None = Field(default=None, sa_type=JSON)

    # Compliance-relevant
    passport_expiry_date: date | None = None

    # Metadata
    is_confirmed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship
    advisory_session: AdvisorySession | None = Relationship(
        back_populates="traveler_profile"
    )
```

**Note on JSON columns:** Use `sqlalchemy.types.JSON` for list fields. Import as `from sqlalchemy import JSON` -- SQLModel re-exports SQLAlchemy types.

### Pydantic Schema Pattern

```python
# app/schemas/session.py
import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.advisory_session import SessionStatus
from app.schemas.profile import TravelerProfileResponse


class SessionCreateRequest(BaseModel):
    """No body fields required -- session is created with defaults."""
    pass


class SessionUpdateRequest(BaseModel):
    status: SessionStatus


class SessionResponse(BaseModel):
    id: uuid.UUID
    tenant_id: str
    status: SessionStatus
    traveler_profile: TravelerProfileResponse | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    items: list[SessionResponse]
    total: int
```

### API Endpoint Pattern

```python
# app/api/v1/sessions.py
import uuid

import structlog
from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import get_session
from app.core.dependencies import get_current_tenant_id
from app.core.exceptions import NotFoundError
from app.models.advisory_session import AdvisorySession, SessionStatus
from app.models.traveler_profile import TravelerProfile
from app.schemas.session import (
    SessionCreateRequest,
    SessionListResponse,
    SessionResponse,
    SessionUpdateRequest,
)

logger = structlog.get_logger()
router = APIRouter(prefix="/advisory_sessions", tags=["advisory_sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    db: AsyncSession = Depends(get_session),
    tenant_id: str = Depends(get_current_tenant_id),
) -> SessionResponse:
    session = AdvisorySession(tenant_id=tenant_id)
    profile = TravelerProfile(
        advisory_session_id=session.id,
        tenant_id=tenant_id,
    )
    db.add(session)
    db.add(profile)
    await db.commit()
    await db.refresh(session)
    structlog.contextvars.bind_contextvars(session_id=str(session.id))
    logger.info("session.created", session_id=str(session.id), tenant_id=tenant_id)
    return session


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_by_id(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    tenant_id: str = Depends(get_current_tenant_id),
) -> SessionResponse:
    # Always filter by tenant_id
    statement = select(AdvisorySession).where(
        AdvisorySession.id == session_id,
        AdvisorySession.tenant_id == tenant_id,
    )
    result = await db.exec(statement)
    session = result.first()
    if not session:
        raise NotFoundError("advisory_session", str(session_id))
    logger.info("session.retrieved", session_id=str(session_id))
    return session
```

### Database Session Dependency Pattern

```python
# app/core/database.py
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings

# Convert postgresql:// to postgresql+asyncpg://
async_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://")
async_engine = create_async_engine(async_url, echo=settings.environment == "development")


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(async_engine) as session:
        yield session
```

### Tenant Placeholder Dependency

```python
# app/core/dependencies.py
import structlog


async def get_current_tenant_id() -> str:
    """Placeholder tenant dependency until Story 1.6 adds JWT auth.

    Story 1.6 will replace this with JWT extraction from the request.
    """
    tenant_id = "default"
    structlog.contextvars.bind_contextvars(tenant_id=tenant_id)
    return tenant_id
```

### Exception Hierarchy

```python
# app/core/exceptions.py (extended)
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class AppError(HTTPException):
    """Base application error with consistent format."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(status_code=status_code, detail={"code": code, "message": message})


class NotFoundError(AppError):
    """Resource not found."""

    def __init__(self, resource: str, resource_id: str) -> None:
        super().__init__(
            code="ENTITY_NOT_FOUND",
            message=f"{resource} with id '{resource_id}' not found",
            status_code=404,
        )


class ValidationError(AppError):
    """Business rule validation failure."""

    def __init__(self, message: str) -> None:
        super().__init__(code="VALIDATION_ERROR", message=message, status_code=422)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    import structlog
    logger = structlog.get_logger()
    logger.exception("unhandled_error", path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}},
    )
```

### Test Database Strategy

Use a separate PostgreSQL database for tests with transaction rollback per test. The test fixture should:

1. Create all tables before the test suite using `SQLModel.metadata.create_all()`
2. Use a session-scoped transaction that rolls back after each test
3. Override the `get_session` dependency in FastAPI's app

```python
# tests/conftest.py
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.dependencies import get_current_tenant_id
from app.main import app

# Use a test database
TEST_DB_URL = settings.database_url.replace("stravel", "stravel_test")
ASYNC_TEST_DB_URL = TEST_DB_URL.replace("postgresql://", "postgresql+asyncpg://")

test_engine = create_async_engine(ASYNC_TEST_DB_URL, echo=False)


@pytest.fixture(scope="session", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest.fixture
async def db_session():
    async with AsyncSession(test_engine) as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(db_session: AsyncSession):
    async def override_get_session():
        yield db_session

    async def override_get_tenant_id():
        return "test-tenant"

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_tenant_id] = override_get_tenant_id

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
```

### Anti-Patterns -- DO NOT

- **DO NOT** expose SQLModel table models directly as API response types -- use Pydantic schemas
- **DO NOT** use `SQLModel.metadata.create_all()` in production code -- Alembic only
- **DO NOT** use SQLite for tests -- PostgreSQL only
- **DO NOT** implement auth or JWT -- Story 1.6 concern
- **DO NOT** add LangGraph agent logic -- Story 1.3 concern
- **DO NOT** add SSE streaming -- Story 1.7 concern
- **DO NOT** create a generic `utils.py` file -- name modules by purpose
- **DO NOT** skip tenant_id filtering on any query -- even with the placeholder tenant
- **DO NOT** use stdlib `logging` -- use `structlog` only
- **DO NOT** use `datetime.utcnow()` directly -- use `datetime.now(UTC)` (Python 3.12 deprecation)

### Deferred Items from Story 1.1 Addressed

From Story 1.1 review findings:
- `AdvisoryState.traveler_profile` should be typed as the Pydantic schema instead of bare `dict` (Task 9)
- Health endpoint dependency checks (DB readiness) -- optional stretch, not required for this story

### File Paths Summary

New files to create:
- `backend/app/models/advisory_session.py`
- `backend/app/models/traveler_profile.py`
- `backend/app/schemas/session.py`
- `backend/app/schemas/profile.py`
- `backend/app/api/v1/sessions.py`
- `backend/app/core/dependencies.py`
- `backend/alembic/versions/xxxx_create_advisory_sessions_and_traveler_profiles.py` (auto-generated)
- `backend/tests/test_sessions.py`

Files to modify:
- `backend/app/models/__init__.py` -- add model imports
- `backend/app/schemas/__init__.py` -- add schema imports
- `backend/app/core/exceptions.py` -- add NotFoundError, ValidationError, handlers
- `backend/app/core/database.py` -- add async engine, get_session dependency
- `backend/app/api/v1/router.py` -- register sessions router
- `backend/app/main.py` -- register exception handlers
- `backend/app/agents/state.py` -- type traveler_profile field
- `backend/alembic/env.py` -- import models for autogenerate
- `backend/tests/conftest.py` -- add async DB test fixtures
- `backend/pyproject.toml` -- add asyncpg dependency

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- Data Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md -- API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 1, Story 1.2]
- [Source: _bmad-output/implementation-artifacts/1-1-project-setup.md -- Review Findings (deferred items)]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
