# Story 5.2: Client History Search & Profile Reference

Status: pending

## Story

As a travel agent,
I want to search past advisory sessions and reference previous client profiles when starting new sessions,
so that returning clients don't have to repeat their information.

## Acceptance Criteria

1. `GET /api/v1/advisory_sessions?search=...` accepts a `search` query parameter and returns sessions matching by client name, destination, or date
2. Search results are always scoped to the requesting agent's tenant (`tenant_id` filtering enforced)
3. Search by client name performs case-insensitive partial matching against `AdvisorySession.client_name`
4. Search by destination performs case-insensitive partial matching against `TravelerProfile.destination_preferences` (JSON array field)
5. Search by date filters sessions whose `TravelerProfile.travel_start_date` or `TravelerProfile.travel_end_date` falls within the provided date range
6. Search parameters can be combined (e.g., client name + destination) with AND logic
7. `POST /api/v1/advisory_sessions` accepts an optional `source_session_id` field; when provided, the new session's `TravelerProfile` is pre-populated from the referenced session's profile
8. Pre-populated profile fields are fully editable -- the agent can modify any field before confirming via `PATCH /api/v1/traveler_profiles/{profile_id}`
9. Pre-populated profile has `is_confirmed` set to `false` so the agent must explicitly confirm after review
10. The source session must belong to the same tenant; if not found or cross-tenant, return 404
11. `components/b2b/ClientHistory.tsx` provides a search UI with input fields for client name, destination, and date range
12. Search results display in a list with client name, destinations, travel dates, session status, and a "Use Profile" action
13. Clicking "Use Profile" on a past session creates a new session with that profile pre-populated and navigates to the session view

## Tasks

- [ ] Task 1: Add `client_name` field to `AdvisorySession` model (AC: #3)
  - [ ] Add `client_name: str | None = Field(default=None, max_length=255, index=True)` to `AdvisorySession` model in `models/advisory_session.py`
  - [ ] Create Alembic migration: `alembic revision --autogenerate -m "add_client_name_to_advisory_sessions"`
  - [ ] Verify migration applies and reverses cleanly

- [ ] Task 2: Add search query schemas (AC: #1, #5, #6)
  - [ ] Add `SessionSearchParams` to `schemas/session.py`:
    - `search: str | None = None` (general search term for client name or destination)
    - `client_name: str | None = None` (explicit client name filter)
    - `destination: str | None = None` (explicit destination filter)
    - `date_from: date | None = None` (start of date range)
    - `date_to: date | None = None` (end of date range)
    - `status: SessionStatus | None = None` (filter by session status)
  - [ ] Add `SessionSearchResponse` extending `SessionListResponse` with `search_query: str | None` metadata

- [ ] Task 3: Update `SessionCreateRequest` with `source_session_id` (AC: #7)
  - [ ] Add `source_session_id: uuid.UUID | None = None` to `SessionCreateRequest` in `schemas/session.py`
  - [ ] Add `client_name: str | None = None` to `SessionCreateRequest`
  - [ ] Add `client_name: str | None = None` to `SessionResponse`

- [ ] Task 4: Create `services/client_history.py` -- search logic (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Implement `search_sessions(tenant_id, search_params, db) -> tuple[list[AdvisorySession], int]`
  - [ ] Build dynamic SQLAlchemy query with conditional WHERE clauses based on provided search params
  - [ ] Client name search: `AdvisorySession.client_name.ilike(f"%{search}%")`
  - [ ] Destination search: use PostgreSQL JSON containment or cast `destination_preferences` to text for ILIKE matching across JSON array elements
  - [ ] Date range search: `TravelerProfile.travel_start_date >= date_from` AND/OR `TravelerProfile.travel_end_date <= date_to`
  - [ ] General `search` parameter: search across client_name AND destination_preferences (OR logic within general search, AND logic between explicit filters)
  - [ ] Always filter by `tenant_id` -- enforce tenant isolation
  - [ ] Return paginated results ordered by `updated_at DESC` (most recently touched first)
  - [ ] Log search queries with `structlog`: `logger.info("client_history.search", tenant_id=..., search_query=..., result_count=...)`

- [ ] Task 5: Implement profile pre-population logic in `services/client_history.py` (AC: #7, #8, #9, #10)
  - [ ] Implement `clone_profile_from_session(source_session_id, new_session, tenant_id, db) -> TravelerProfile`
  - [ ] Load source session with tenant_id filter; raise `NotFoundError` if not found or cross-tenant
  - [ ] Copy all profile fields EXCEPT: `id`, `advisory_session_id`, `tenant_id`, `is_confirmed`, `created_at`, `updated_at`
  - [ ] Set `is_confirmed = False` on the new profile (agent must re-confirm)
  - [ ] Copy `client_name` from source session to new session
  - [ ] Log: `logger.info("client_history.profile_cloned", source_session_id=..., new_session_id=..., tenant_id=...)`

- [ ] Task 6: Extend `api/v1/sessions.py` with search endpoint (AC: #1, #2, #6)
  - [ ] Update existing `GET /api/v1/advisory_sessions` (list_sessions) to accept search query parameters via `Depends(SessionSearchParams)`
  - [ ] When any search param is provided, delegate to `search_sessions()` from `services/client_history.py`
  - [ ] When no search params are provided, fall back to existing list behavior (all sessions, paginated)
  - [ ] Maintain existing pagination support (`limit`, `offset`)
  - [ ] Join `TravelerProfile` eagerly when search involves destination or date filters

- [ ] Task 7: Update `create_session` endpoint for profile pre-population (AC: #7, #8, #9, #10)
  - [ ] In `api/v1/sessions.py`, update `create_session` to check for `body.source_session_id`
  - [ ] If `source_session_id` is provided, call `clone_profile_from_session()` instead of creating an empty profile
  - [ ] If `body.client_name` is provided, set it on the new session
  - [ ] If `source_session_id` is provided but `client_name` is not, copy `client_name` from source session
  - [ ] Return the new session with pre-populated profile in response

- [ ] Task 8: Create `components/b2b/ClientHistory.tsx` -- search UI (AC: #11, #12, #13)
  - [ ] Create search form with inputs: client name (text), destination (text), date range (two date inputs), and status filter (select)
  - [ ] Add `data-testid="client-history-search"` on the search form container
  - [ ] Add `data-testid="search-input-client-name"`, `data-testid="search-input-destination"`, `data-testid="search-input-date-from"`, `data-testid="search-input-date-to"` on respective inputs
  - [ ] Debounce search input (300ms) to avoid excessive API calls
  - [ ] Display results as a list/table with columns: client name, destinations (comma-separated), travel dates, status, actions
  - [ ] Add `data-testid="search-results-list"` on the results container
  - [ ] Add `data-testid="search-result-item"` on each result row
  - [ ] Add "Use Profile" button on each result row with `data-testid="use-profile-button"`
  - [ ] "Use Profile" calls `POST /api/v1/advisory_sessions` with `source_session_id` and navigates to the new session
  - [ ] Show empty state message when no results found: "No matching sessions found"
  - [ ] Show loading state during search
  - [ ] Use `apiClient.ts` for all API calls -- never raw `fetch()`

- [ ] Task 9: Integrate `ClientHistory` into B2B layout (AC: #11)
  - [ ] Add `ClientHistory` component to the `SessionList` view or as a dedicated tab/section in the B2B layout
  - [ ] Ensure routing to `/history` or equivalent path renders `ClientHistory`
  - [ ] After "Use Profile" creates a new session, navigate to `/sessions/{new_session_id}`

- [ ] Task 10: Write backend unit tests (AC: all backend ACs)
  - [ ] Test search by client name: case-insensitive, partial match
  - [ ] Test search by destination: matches sessions where any destination_preference contains the search term
  - [ ] Test search by date range: returns sessions with travel dates within range
  - [ ] Test combined search: client name + destination (AND logic)
  - [ ] Test general `search` parameter: matches across client_name OR destination_preferences
  - [ ] Test tenant isolation: Tenant A's search does not return Tenant B's sessions
  - [ ] Test empty search results: returns `{"items": [], "total": 0}`
  - [ ] Test profile pre-population: new session has cloned profile with `is_confirmed = false`
  - [ ] Test profile pre-population copies all expected fields
  - [ ] Test profile pre-population skips `id`, `advisory_session_id`, `created_at`, `updated_at`
  - [ ] Test cross-tenant source_session_id returns 404
  - [ ] Test non-existent source_session_id returns 404
  - [ ] Test creating session without source_session_id still works (backwards compatibility)
  - [ ] All tests pass with PostgreSQL only -- no Qdrant, no Redis, no LLM

- [ ] Task 11: Write frontend component tests (AC: #11, #12, #13)
  - [ ] Test search form renders with all input fields
  - [ ] Test search triggers API call with correct query parameters
  - [ ] Test results list renders session data correctly
  - [ ] Test "Use Profile" button calls create session API with source_session_id
  - [ ] Test empty state renders when no results
  - [ ] Test loading state during search

## Dev Notes

### Search Query Patterns

The search endpoint extends the existing `GET /api/v1/advisory_sessions` list endpoint. Search parameters are additive filters applied via query parameters.

**URL patterns:**

```
# General search (searches client_name and destination_preferences)
GET /api/v1/advisory_sessions?search=nguyen

# Explicit client name search
GET /api/v1/advisory_sessions?client_name=nguyen

# Destination search
GET /api/v1/advisory_sessions?destination=phu%20quoc

# Date range search
GET /api/v1/advisory_sessions?date_from=2026-06-01&date_to=2026-06-30

# Combined search (AND logic)
GET /api/v1/advisory_sessions?client_name=nguyen&destination=hanoi

# With pagination
GET /api/v1/advisory_sessions?search=nguyen&limit=10&offset=0

# Filter by status
GET /api/v1/advisory_sessions?status=completed&search=nguyen
```

### Search Implementation Strategy

```python
# services/client_history.py

import structlog
from datetime import date
from sqlalchemy import or_, func, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.exceptions import NotFoundError
from app.models.advisory_session import AdvisorySession
from app.models.traveler_profile import TravelerProfile

logger = structlog.get_logger()


async def search_sessions(
    tenant_id: str,
    search: str | None = None,
    client_name: str | None = None,
    destination: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    status: str | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = None,
) -> tuple[list[AdvisorySession], int]:
    """Search advisory sessions with multi-field filtering.

    All searches are scoped to tenant_id. Explicit filters use AND logic.
    The general 'search' param matches across client_name OR destination.
    """
    # Base query with tenant isolation
    stmt = select(AdvisorySession).where(AdvisorySession.tenant_id == tenant_id)

    # Join TravelerProfile for destination/date searches
    needs_join = destination or date_from or date_to or search
    if needs_join:
        stmt = stmt.join(
            TravelerProfile,
            TravelerProfile.advisory_session_id == AdvisorySession.id,
            isouter=True,
        )

    # General search: client_name OR destination (OR logic)
    if search:
        search_term = f"%{search}%"
        stmt = stmt.where(
            or_(
                AdvisorySession.client_name.ilike(search_term),
                cast(TravelerProfile.destination_preferences, String).ilike(search_term),
            )
        )

    # Explicit client name filter (AND with other filters)
    if client_name:
        stmt = stmt.where(AdvisorySession.client_name.ilike(f"%{client_name}%"))

    # Explicit destination filter
    if destination:
        stmt = stmt.where(
            cast(TravelerProfile.destination_preferences, String).ilike(f"%{destination}%")
        )

    # Date range filter
    if date_from:
        stmt = stmt.where(
            or_(
                TravelerProfile.travel_start_date >= date_from,
                TravelerProfile.travel_end_date >= date_from,
            )
        )
    if date_to:
        stmt = stmt.where(
            or_(
                TravelerProfile.travel_start_date <= date_to,
                TravelerProfile.travel_end_date <= date_to,
            )
        )

    # Status filter
    if status:
        stmt = stmt.where(AdvisorySession.status == status)

    # Count total matches
    count_stmt = select(func.count()).select_from(stmt.subquery())
    count_result = await db.execute(count_stmt)
    total = count_result.scalar_one()

    # Apply pagination and ordering
    stmt = stmt.order_by(AdvisorySession.updated_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()

    logger.info(
        "client_history.search",
        tenant_id=tenant_id,
        search=search,
        client_name=client_name,
        destination=destination,
        date_from=str(date_from) if date_from else None,
        date_to=str(date_to) if date_to else None,
        result_count=len(items),
        total=total,
    )
    return items, total
```

### Profile Pre-Population Logic

```python
# services/client_history.py (continued)

# Fields to COPY from source profile to new profile
CLONEABLE_PROFILE_FIELDS = [
    "traveler_count",
    "traveler_ages",
    "nationalities",
    "travel_start_date",
    "travel_end_date",
    "date_flexibility",
    "budget_total",
    "budget_currency",
    "destination_preferences",
    "accommodation_style",
    "dietary_requirements",
    "accessibility_needs",
    "activity_preferences",
    "special_interests",
    "passport_expiry_date",
]

# Fields to NEVER copy (identity/metadata fields)
# id, advisory_session_id, tenant_id, is_confirmed, created_at, updated_at


async def clone_profile_from_session(
    source_session_id: str,
    new_session: AdvisorySession,
    tenant_id: str,
    db: AsyncSession,
) -> TravelerProfile:
    """Clone a TravelerProfile from a past session into a new session.

    The cloned profile has is_confirmed=False so the agent must review
    and confirm before proceeding to the calculation stage.
    """
    # Load source session with tenant scoping
    source_stmt = select(AdvisorySession).where(
        AdvisorySession.id == source_session_id,
        AdvisorySession.tenant_id == tenant_id,
    )
    result = await db.execute(source_stmt)
    source_session = result.scalars().first()
    if not source_session:
        raise NotFoundError("AdvisorySession", str(source_session_id))

    # Load source profile
    await db.refresh(source_session, attribute_names=["traveler_profile"])
    source_profile = source_session.traveler_profile
    if not source_profile:
        # Source session has no profile -- create empty profile instead
        logger.warning(
            "client_history.clone_no_source_profile",
            source_session_id=str(source_session_id),
            tenant_id=tenant_id,
        )
        return TravelerProfile(
            advisory_session_id=new_session.id,
            tenant_id=tenant_id,
            is_confirmed=False,
        )

    # Clone fields
    clone_data = {}
    for field in CLONEABLE_PROFILE_FIELDS:
        value = getattr(source_profile, field, None)
        if value is not None:
            # Deep copy lists to avoid shared references
            if isinstance(value, list):
                clone_data[field] = list(value)
            else:
                clone_data[field] = value

    new_profile = TravelerProfile(
        advisory_session_id=new_session.id,
        tenant_id=tenant_id,
        is_confirmed=False,  # Agent must re-confirm
        **clone_data,
    )

    # Copy client_name to new session if not already set
    if not new_session.client_name and source_session.client_name:
        new_session.client_name = source_session.client_name

    logger.info(
        "client_history.profile_cloned",
        source_session_id=str(source_session_id),
        new_session_id=str(new_session.id),
        tenant_id=tenant_id,
        fields_cloned=len(clone_data),
    )
    return new_profile
```

### Updated Session Endpoint Pattern

```python
# api/v1/sessions.py -- updated create_session

@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    body: SessionCreateRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> AdvisorySession:
    advisory_session = AdvisorySession(
        tenant_id=tenant_id,
        client_name=body.client_name,
    )
    session.add(advisory_session)
    await session.flush()

    if body.source_session_id:
        # Pre-populate from previous session
        profile = await clone_profile_from_session(
            source_session_id=str(body.source_session_id),
            new_session=advisory_session,
            tenant_id=tenant_id,
            db=session,
        )
    else:
        # Create empty profile (existing behavior)
        profile = TravelerProfile(
            advisory_session_id=advisory_session.id,
            tenant_id=tenant_id,
        )

    session.add(profile)
    await session.commit()
    await session.refresh(advisory_session, attribute_names=["traveler_profile"])

    structlog.contextvars.bind_contextvars(
        session_id=str(advisory_session.id),
        tenant_id=tenant_id,
    )
    logger.info(
        "session.created",
        status=advisory_session.status.value,
        source_session_id=str(body.source_session_id) if body.source_session_id else None,
    )
    return advisory_session
```

### Updated List/Search Endpoint Pattern

```python
# api/v1/sessions.py -- updated list_sessions

@router.get("", response_model=SessionListResponse)
async def list_sessions(
    tenant_id: str = Depends(get_current_tenant_id),
    session: AsyncSession = Depends(get_session),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, max_length=255),
    client_name: str | None = Query(default=None, max_length=255),
    destination: str | None = Query(default=None, max_length=255),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    status: SessionStatus | None = Query(default=None),
) -> dict:
    has_search = any([search, client_name, destination, date_from, date_to, status])

    if has_search:
        items, total = await search_sessions(
            tenant_id=tenant_id,
            search=search,
            client_name=client_name,
            destination=destination,
            date_from=date_from,
            date_to=date_to,
            status=status.value if status else None,
            limit=limit,
            offset=offset,
            db=session,
        )
    else:
        # Existing list behavior (unchanged)
        count_stmt = select(func.count()).select_from(AdvisorySession).where(
            AdvisorySession.tenant_id == tenant_id
        )
        count_result = await session.execute(count_stmt)
        total = count_result.scalar_one()

        stmt = (
            select(AdvisorySession)
            .where(AdvisorySession.tenant_id == tenant_id)
            .offset(offset)
            .limit(limit)
            .order_by(AdvisorySession.created_at.desc())
        )
        result = await session.execute(stmt)
        items = result.scalars().all()

    for item in items:
        await session.refresh(item, attribute_names=["traveler_profile"])

    logger.info("session.listed", count=len(items), total=total, tenant_id=tenant_id)
    return {"items": items, "total": total, "limit": limit, "offset": offset}
```

### PostgreSQL JSON Search Strategy

The `destination_preferences` field is stored as a PostgreSQL JSON array (e.g., `["Hanoi", "Phu Quoc", "Da Nang"]`). For search, cast the JSON to text and use ILIKE:

```python
from sqlalchemy import cast, String

# This works for simple substring matching within JSON arrays:
cast(TravelerProfile.destination_preferences, String).ilike(f"%phu quoc%")
# Matches: ["Hanoi", "Phu Quoc"] because the text representation contains "phu quoc"
```

For more precise matching (e.g., avoiding false positives where "Da" matches "Da Nang" and "Madagascar"), consider using PostgreSQL's `jsonb` operators in a future iteration. The cast-to-text approach is sufficient for MVP.

### Frontend Component Structure

```typescript
// components/b2b/ClientHistory.tsx

interface ClientHistoryProps {
  onSessionCreated?: (sessionId: string) => void;
}

interface SearchParams {
  search?: string;
  client_name?: string;
  destination?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
}

interface SessionResult {
  id: string;
  client_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  traveler_profile: {
    destination_preferences: string[] | null;
    travel_start_date: string | null;
    travel_end_date: string | null;
    traveler_count: number | null;
  } | null;
}

// State managed with useReducer (not useState) per project convention
type SearchState = {
  status: 'idle' | 'searching' | 'error';
  results: SessionResult[];
  total: number;
  query: SearchParams;
  error: string | null;
};

type SearchAction =
  | { type: 'SEARCH_START'; query: SearchParams }
  | { type: 'SEARCH_SUCCESS'; results: SessionResult[]; total: number }
  | { type: 'SEARCH_ERROR'; error: string }
  | { type: 'CLEAR' };
```

### data-testid Inventory

| Element | data-testid |
|---|---|
| Search form container | `client-history-search` |
| Client name input | `search-input-client-name` |
| Destination input | `search-input-destination` |
| Date from input | `search-input-date-from` |
| Date to input | `search-input-date-to` |
| Status filter select | `search-input-status` |
| Search button | `search-button` |
| Results container | `search-results-list` |
| Each result row | `search-result-item` |
| Use Profile button | `use-profile-button` |
| Empty state message | `search-empty-state` |
| Loading indicator | `search-loading` |

### Architecture Constraints

- **AsyncSession** with `session.execute()` + `.scalars()` -- NEVER use `session.exec()`
- **structlog** for all logging -- NEVER use stdlib `logging`
- **Tenant isolation enforced** on every query -- ALL searches filter by `tenant_id`
- **Pydantic BaseModel** for all request/response schemas -- NOT TypedDict
- **SQLModel** for all database models
- **UUID** for all primary keys
- **snake_case** for all API endpoints, DB columns, and Python code
- **PascalCase** for Python classes and Pydantic models
- **`apiClient.ts`** for all frontend API calls -- NEVER raw `fetch()`
- **`useReducer`** for component state management -- NOT `useState` for complex state
- **`data-testid`** attributes on all interactive elements for Playwright E2E
- **datetime.utcnow()** for timestamps -- NEVER `datetime.now(timezone.utc)`
- **No `from __future__ import annotations`** in SQLModel model files

### Dependency on Prior Stories

- **Story 1.2** (Database Models & Advisory Session API): Provides `AdvisorySession`, `TravelerProfile` models and `GET/POST/PATCH /advisory_sessions` endpoints that this story extends
- **Story 1.6** (Auth, Tenant & Multi-tenancy): Provides JWT auth, `get_current_tenant_id` dependency, and `TenantMiddleware` -- all search queries use tenant_id from JWT
- **Story 1.8** (React Copilot Sidebar): Provides the B2B layout, `SessionList`, and shared components that `ClientHistory` integrates with

### Files Created / Modified

**New files:**
- `backend/app/services/client_history.py` -- search logic and profile cloning
- `backend/alembic/versions/xxxx_add_client_name_to_advisory_sessions.py` -- migration (auto-generated)
- `frontend/src/components/b2b/ClientHistory.tsx` -- search UI component
- `backend/tests/test_client_history.py` -- backend unit tests

**Modified files:**
- `backend/app/models/advisory_session.py` -- add `client_name` field
- `backend/app/schemas/session.py` -- add `SessionSearchParams`, update `SessionCreateRequest` and `SessionResponse`
- `backend/app/api/v1/sessions.py` -- add search query params to list endpoint, update create endpoint with `source_session_id` support
- `frontend/src/components/b2b/SessionList.tsx` -- integrate `ClientHistory` or link to it

### Anti-Patterns -- DO NOT

- **DO NOT** create a separate `/api/v1/client_history` endpoint -- extend the existing `/api/v1/advisory_sessions` endpoint with search params per the epics spec
- **DO NOT** allow cross-tenant profile cloning -- source session must belong to same tenant
- **DO NOT** set `is_confirmed = true` on cloned profiles -- agent must explicitly review and confirm
- **DO NOT** use `session.exec()` -- use `session.execute()` with `.scalars()`
- **DO NOT** skip `tenant_id` filtering on search queries
- **DO NOT** use raw SQL for JSON field searching -- use SQLAlchemy's `cast()` operator
- **DO NOT** use stdlib `logging` -- use `structlog` only
- **DO NOT** use `useState` for search state in the React component -- use `useReducer`
- **DO NOT** use raw `fetch()` in the frontend -- use `apiClient.ts`
- **DO NOT** copy `id`, `advisory_session_id`, `tenant_id`, `created_at`, or `updated_at` when cloning profiles
- **DO NOT** create a generic `utils.py` -- the service file is `client_history.py`

### Testing Strategy

All backend tests must pass with PostgreSQL only. No Qdrant, Redis, or LLM required.

```python
# tests/test_client_history.py

import pytest
from httpx import AsyncClient


@pytest.fixture
async def sessions_with_profiles(client, auth_headers):
    """Create several completed sessions with varied profiles for search testing."""
    sessions = []

    # Session 1: Nguyen family, Phu Quoc + Hanoi
    resp = await client.post(
        "/api/v1/advisory_sessions",
        headers=auth_headers,
        json={"client_name": "Nguyen Van A"},
    )
    session_1 = resp.json()
    await client.patch(
        f"/api/v1/traveler_profiles/{session_1['traveler_profile']['id']}",
        headers=auth_headers,
        json={
            "destination_preferences": ["Phu Quoc", "Hanoi"],
            "travel_start_date": "2026-07-01",
            "travel_end_date": "2026-07-14",
            "traveler_count": 4,
        },
    )
    sessions.append(session_1)

    # Session 2: Smith, Da Nang
    resp = await client.post(
        "/api/v1/advisory_sessions",
        headers=auth_headers,
        json={"client_name": "John Smith"},
    )
    session_2 = resp.json()
    await client.patch(
        f"/api/v1/traveler_profiles/{session_2['traveler_profile']['id']}",
        headers=auth_headers,
        json={
            "destination_preferences": ["Da Nang", "Hoi An"],
            "travel_start_date": "2026-08-01",
            "travel_end_date": "2026-08-10",
            "traveler_count": 2,
        },
    )
    sessions.append(session_2)

    return sessions


# --- Search Tests ---

async def test_search_by_client_name(client, auth_headers, sessions_with_profiles):
    resp = await client.get(
        "/api/v1/advisory_sessions?client_name=nguyen",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert all("nguyen" in item["client_name"].lower() for item in data["items"])


async def test_search_by_destination(client, auth_headers, sessions_with_profiles):
    resp = await client.get(
        "/api/v1/advisory_sessions?destination=phu%20quoc",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1


async def test_search_by_date_range(client, auth_headers, sessions_with_profiles):
    resp = await client.get(
        "/api/v1/advisory_sessions?date_from=2026-07-01&date_to=2026-07-31",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1


async def test_search_case_insensitive(client, auth_headers, sessions_with_profiles):
    resp = await client.get(
        "/api/v1/advisory_sessions?client_name=NGUYEN",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


async def test_search_tenant_isolation(client, auth_headers_tenant_a, auth_headers_tenant_b):
    # Tenant A creates a session
    await client.post(
        "/api/v1/advisory_sessions",
        headers=auth_headers_tenant_a,
        json={"client_name": "Tenant A Client"},
    )
    # Tenant B cannot find it
    resp = await client.get(
        "/api/v1/advisory_sessions?client_name=Tenant%20A",
        headers=auth_headers_tenant_b,
    )
    assert resp.json()["total"] == 0


async def test_search_empty_results(client, auth_headers):
    resp = await client.get(
        "/api/v1/advisory_sessions?client_name=nonexistent_client_xyz",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == {"items": [], "total": 0, "limit": 20, "offset": 0}


# --- Profile Pre-Population Tests ---

async def test_create_session_with_source(client, auth_headers, sessions_with_profiles):
    source_id = sessions_with_profiles[0]["id"]
    resp = await client.post(
        "/api/v1/advisory_sessions",
        headers=auth_headers,
        json={"source_session_id": source_id},
    )
    assert resp.status_code == 201
    new_session = resp.json()
    profile = new_session["traveler_profile"]
    assert profile["is_confirmed"] is False
    assert profile["destination_preferences"] == ["Phu Quoc", "Hanoi"]
    assert profile["traveler_count"] == 4


async def test_create_session_without_source_backwards_compatible(client, auth_headers):
    resp = await client.post(
        "/api/v1/advisory_sessions",
        headers=auth_headers,
        json={},
    )
    assert resp.status_code == 201
    profile = resp.json()["traveler_profile"]
    assert profile["is_confirmed"] is False
    assert profile["destination_preferences"] is None


async def test_create_session_cross_tenant_source_returns_404(
    client, auth_headers_tenant_a, auth_headers_tenant_b
):
    # Tenant B creates a session
    resp = await client.post(
        "/api/v1/advisory_sessions",
        headers=auth_headers_tenant_b,
        json={"client_name": "Tenant B Client"},
    )
    source_id = resp.json()["id"]

    # Tenant A tries to clone it
    resp = await client.post(
        "/api/v1/advisory_sessions",
        headers=auth_headers_tenant_a,
        json={"source_session_id": source_id},
    )
    assert resp.status_code == 404
```

### References

- [Source: architecture.md -- Data Architecture]
- [Source: architecture.md -- API & Communication Patterns]
- [Source: architecture.md -- Frontend Architecture]
- [Source: architecture.md -- Tenant Context Flow]
- [Source: architecture.md -- Implementation Patterns & Consistency Rules]
- [Source: architecture.md -- Requirements to Structure Mapping (FR-26)]
- [Source: epics.md -- Epic 5, Story 5.2: Client History Search & Profile Reference]
- [Source: epics.md -- FR-26: Client History]
- [Source: epics.md -- NFR-3: Multi-tenancy]
- [Source: project-context.md -- SQLAlchemy Async rules]
- [Source: project-context.md -- Naming Conventions]
- [Source: project-context.md -- Critical Anti-Patterns]

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
