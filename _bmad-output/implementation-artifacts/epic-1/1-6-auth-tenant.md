# Story 1.6: Auth, Tenant & Multi-tenancy

Status: done

## Story

As a travel agent,
I want to authenticate with my agency credentials and have my data isolated from other agencies,
so that my client information is secure and private.

## Acceptance Criteria

1. `core/auth.py` implements JWT + OAuth2 using `python-jose` and `passlib`
2. `core/tenant.py` implements tenant context middleware using `contextvars` with `get_tenant_id()` available to all downstream code
3. `POST /api/v1/auth/login` accepts valid credentials and returns a JWT token containing `tenant_id` and `user_id` claims
4. `POST /api/v1/auth/register` creates a new tenant and first user (for dev/testing bootstrap)
5. Tenant context middleware extracts `tenant_id` from the JWT on every authenticated request and sets it in `contextvars`
6. All advisory session queries filter by `tenant_id` -- Tenant A cannot see Tenant B's sessions
7. Requests without a valid JWT to B2B endpoints return `401 Unauthorized` with `{"detail": {"code": "UNAUTHORIZED", "message": "..."}}`
8. Requests with an expired JWT return `401 Unauthorized` with `{"detail": {"code": "TOKEN_EXPIRED", "message": "..."}}`
9. SQLModel `Tenant` model is created with Alembic migration
10. SQLModel `User` model is created with hashed password storage (never store plaintext)
11. Existing session endpoints (from Story 1.2: `POST /api/v1/advisory_sessions`, `GET /api/v1/advisory_sessions/{session_id}`, `PATCH /api/v1/advisory_sessions/{session_id}`) are updated to enforce tenant isolation
12. Health endpoint (`GET /api/v1/health`) remains public (no auth required)
13. B2C demo endpoints (future `api/v1/demo.py`) remain excluded from auth requirements

## Tasks

- [x] Task 1: Add auth-related settings to `core/config.py` (AC: #1)
  - [x] Add `jwt_secret_key: str` (separate from `secret_key`, defaults to `secret_key` in dev)
  - [x] Add `jwt_algorithm: str = "HS256"`
  - [x] Add `jwt_access_token_expire_minutes: int = 480` (8 hours)
  - [x] Add `bcrypt_rounds: int = 12`
  - [x] Add production validator: `jwt_secret_key` must differ from default in non-dev environments

- [x] Task 2: Create `models/tenant.py` -- Tenant SQLModel (AC: #9)
  - [x] Define `Tenant` model with fields: `id` (UUID, PK), `name` (str, unique), `slug` (str, unique, indexed), `is_active` (bool, default True), `created_at` (datetime, UTC), `updated_at` (datetime, UTC)
  - [x] Add index `ix_tenants_slug` on `slug` column
  - [x] Add index `ix_tenants_is_active` on `is_active` column

- [x] Task 3: Create `models/user.py` -- User SQLModel (AC: #10)
  - [x] Define `User` model with fields: `id` (UUID, PK), `email` (str, unique, indexed), `hashed_password` (str), `full_name` (str), `tenant_id` (UUID, FK to `tenants.id`, indexed), `is_active` (bool, default True), `created_at` (datetime, UTC), `updated_at` (datetime, UTC)
  - [x] Add index `ix_users_email` on `email` column
  - [x] Add index `ix_users_tenant_id` on `tenant_id` column
  - [x] NEVER store plaintext passwords

- [x] Task 4: Create Alembic migration for `tenants` and `users` tables (AC: #9, #10)
  - [x] Generate migration with `alembic revision --autogenerate -m "add_tenants_and_users"`
  - [x] Verify migration creates both tables with correct columns, indexes, and foreign keys
  - [x] Verify `alembic upgrade head` runs cleanly
  - [x] Verify `alembic downgrade -1` reverses cleanly

- [x] Task 5: Create `core/auth.py` -- JWT + OAuth2 (AC: #1, #3, #7, #8)
  - [x] Implement `create_access_token(data: dict, expires_delta: timedelta | None = None) -> str` using `python-jose`
  - [x] Implement `verify_token(token: str) -> TokenPayload` that decodes and validates JWT
  - [x] Implement `hash_password(password: str) -> str` using `passlib` bcrypt
  - [x] Implement `verify_password(plain_password: str, hashed_password: str) -> bool`
  - [x] Define `TokenPayload` Pydantic schema with `sub` (user_id), `tenant_id`, `exp`, `iat`
  - [x] Define `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")`
  - [x] Implement `get_current_user` FastAPI dependency that extracts user from JWT
  - [x] Raise `AppError("UNAUTHORIZED", ...)` with 401 for missing/invalid tokens
  - [x] Raise `AppError("TOKEN_EXPIRED", ...)` with 401 for expired tokens

- [x] Task 6: Create `core/tenant.py` -- Tenant context middleware (AC: #2, #5)
  - [x] Define `_tenant_id: ContextVar[str] = ContextVar("tenant_id")`
  - [x] Define `_user_id: ContextVar[str] = ContextVar("user_id")`
  - [x] Implement `get_tenant_id() -> str` that returns current tenant from contextvar (raises `AppError("TENANT_CONTEXT_MISSING", ...)` if not set)
  - [x] Implement `get_user_id() -> str` that returns current user from contextvar
  - [x] Implement `set_tenant_context(tenant_id: str, user_id: str) -> None`
  - [x] Implement `TenantMiddleware` as ASGI middleware that: extracts JWT from Authorization header, decodes tenant_id and user_id, sets contextvars, skips auth for public paths (health, docs, demo)
  - [x] Public path list: `/api/v1/health`, `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/demo/`, `/docs`, `/redoc`, `/openapi.json`

- [x] Task 7: Create `schemas/auth.py` -- Request/response schemas (AC: #3, #4)
  - [x] `LoginRequest` with `email: str` and `password: str`
  - [x] `LoginResponse` with `access_token: str`, `token_type: str = "bearer"`, `tenant_id: str`, `user_id: str`
  - [x] `RegisterRequest` with `email: str`, `password: str`, `full_name: str`, `tenant_name: str`
  - [x] `RegisterResponse` with `user_id: str`, `tenant_id: str`, `message: str`
  - [x] `TokenPayload` with `sub: str`, `tenant_id: str`, `exp: datetime`, `iat: datetime`
  - [x] `UserResponse` with `id: str`, `email: str`, `full_name: str`, `tenant_id: str`, `is_active: bool`

- [x] Task 8: Create `api/v1/auth.py` -- Auth endpoints (AC: #3, #4)
  - [x] `POST /api/v1/auth/login` -- validates credentials, returns JWT with tenant_id claim
  - [x] `POST /api/v1/auth/register` -- creates tenant + first user, returns confirmation (dev/test convenience)
  - [x] `GET /api/v1/auth/me` -- returns current user info from JWT (requires auth)
  - [x] Register endpoint creates both `Tenant` and `User` in a single transaction
  - [x] Login checks `is_active` on both User and Tenant before issuing token

- [x] Task 9: Register auth routes and tenant middleware in app (AC: #5, #12, #13)
  - [x] Add auth router to `api/v1/router.py`
  - [x] Add `TenantMiddleware` to FastAPI app in `main.py` (before request_logging_middleware so tenant_id is available in logs)
  - [x] Update `request_logging_middleware` to bind `tenant_id` and `user_id` from contextvars (if set)
  - [x] Verify health endpoint remains accessible without auth
  - [x] Verify `/docs` and `/redoc` remain accessible without auth

- [x] Task 10: Create `core/dependencies.py` -- FastAPI dependency injection (AC: #6, #11)
  - [x] Implement `get_db` async generator dependency for SQLModel sessions
  - [x] Implement `require_auth` dependency that calls `get_current_user` and sets tenant context
  - [x] Implement `get_tenant_scoped_session` dependency that wraps DB session with automatic tenant_id filtering
  - [x] All B2B route handlers must use `Depends(require_auth)` to enforce authentication

- [x] Task 11: Update existing session endpoints for tenant isolation (AC: #6, #11)
  - [x] NOTE: If Story 1.2 is not yet implemented, create the session endpoints with tenant isolation from the start
  - [x] `POST /api/v1/advisory_sessions` -- auto-populate `tenant_id` from `get_tenant_id()`, require auth
  - [x] `GET /api/v1/advisory_sessions/{session_id}` -- filter by `tenant_id`, return 404 if session belongs to different tenant
  - [x] `PATCH /api/v1/advisory_sessions/{session_id}` -- filter by `tenant_id`, return 404 if session belongs to different tenant
  - [x] `GET /api/v1/advisory_sessions` (list) -- filter all results by `tenant_id`
  - [x] Add `tenant_id` column (UUID, indexed) to `AdvisorySession` model if not already present

- [x] Task 12: Write unit tests (AC: all)
  - [x] Test `create_access_token` produces valid JWT with expected claims
  - [x] Test `verify_token` accepts valid tokens, rejects expired/tampered tokens
  - [x] Test `hash_password` and `verify_password` round-trip correctly
  - [x] Test `TenantMiddleware` sets contextvars on authenticated requests
  - [x] Test `TenantMiddleware` skips public paths
  - [x] Test `TenantMiddleware` returns 401 for missing/invalid/expired tokens
  - [x] Test `POST /auth/login` with valid credentials returns JWT
  - [x] Test `POST /auth/login` with invalid credentials returns 401
  - [x] Test `POST /auth/register` creates tenant and user
  - [x] Test `GET /auth/me` returns current user
  - [x] Test session endpoints return only tenant-scoped data (create two tenants, verify isolation)
  - [x] Test that Tenant A cannot access Tenant B's session by ID (returns 404, not 403)
  - [x] All tests pass with PostgreSQL only -- no Qdrant, no Redis, no LLM

## Dev Notes

### Critical Architecture Constraints

- **python-jose** for JWT encoding/decoding -- already in `pyproject.toml`
- **passlib[bcrypt]** for password hashing -- already in `pyproject.toml`
- **contextvars** for tenant propagation -- NOT thread-local, NOT middleware state
- **FastAPI OAuth2PasswordBearer** for token extraction -- standard FastAPI pattern
- **structlog** for all logging -- include `tenant_id` and `user_id` in every log entry
- **AppError** from `core/exceptions.py` for all error responses -- consistent format
- **Pydantic BaseModel** for all schemas -- NOT TypedDict
- **SQLModel** for all database models -- NOT raw SQLAlchemy
- **UUID** for all primary keys -- NOT auto-increment integers

### JWT Token Structure

```python
# Token payload (encoded in JWT)
{
    "sub": "user-uuid-here",        # user_id (JWT standard "subject" claim)
    "tenant_id": "tenant-uuid-here", # custom claim for multi-tenancy
    "exp": 1716566400,               # expiration timestamp (UTC)
    "iat": 1716537600                # issued-at timestamp (UTC)
}

# Creating a token
from jose import jwt
from datetime import datetime, timedelta, timezone

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes))
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

# Verifying a token
def verify_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return TokenPayload(**payload)
    except jwt.ExpiredSignatureError:
        raise AppError("TOKEN_EXPIRED", "Access token has expired", status_code=401)
    except jwt.JWTError:
        raise AppError("UNAUTHORIZED", "Invalid authentication token", status_code=401)
```

### Tenant Context Middleware Pattern

```python
# core/tenant.py
from contextvars import ContextVar
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

_tenant_id: ContextVar[str] = ContextVar("tenant_id")
_user_id: ContextVar[str] = ContextVar("user_id")

# Public paths that skip authentication
PUBLIC_PATHS = frozenset({
    "/api/v1/health",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/docs",
    "/redoc",
    "/openapi.json",
})

def _is_public_path(path: str) -> bool:
    """Check if path is public (no auth required)."""
    if path in PUBLIC_PATHS:
        return True
    if path.startswith("/api/v1/demo/"):
        return True
    return False

def get_tenant_id() -> str:
    try:
        return _tenant_id.get()
    except LookupError:
        raise AppError("TENANT_CONTEXT_MISSING", "Tenant context not set", status_code=500)

def get_user_id() -> str:
    try:
        return _user_id.get()
    except LookupError:
        raise AppError("USER_CONTEXT_MISSING", "User context not set", status_code=500)

def set_tenant_context(tenant_id: str, user_id: str) -> None:
    _tenant_id.set(tenant_id)
    _user_id.set(user_id)

class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if _is_public_path(request.url.path):
            return await call_next(request)

        # Extract and validate JWT
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": {"code": "UNAUTHORIZED", "message": "Missing authorization header"}},
            )

        token = auth_header.split(" ", 1)[1]
        payload = verify_token(token)  # raises AppError on failure
        set_tenant_context(tenant_id=payload.tenant_id, user_id=payload.sub)

        return await call_next(request)
```

### Tenant-Scoped Query Pattern

```python
# EVERY query in B2B mode must include tenant_id filtering.
# This is the defining multi-tenancy pattern for STravel.

from app.core.tenant import get_tenant_id

# --- Creating a session (auto-populate tenant_id) ---
async def create_session(session_data: SessionCreateRequest, db: AsyncSession):
    tenant_id = get_tenant_id()
    session = AdvisorySession(
        tenant_id=tenant_id,
        **session_data.model_dump(),
    )
    db.add(session)
    await db.commit()
    return session

# --- Querying sessions (always filter by tenant_id) ---
async def get_sessions(db: AsyncSession):
    tenant_id = get_tenant_id()
    statement = select(AdvisorySession).where(
        AdvisorySession.tenant_id == tenant_id
    )
    results = await db.exec(statement)
    return results.all()

# --- Getting a single session (filter by tenant_id, return 404 not 403) ---
async def get_session(session_id: str, db: AsyncSession):
    tenant_id = get_tenant_id()
    statement = select(AdvisorySession).where(
        AdvisorySession.id == session_id,
        AdvisorySession.tenant_id == tenant_id,
    )
    session = (await db.exec(statement)).first()
    if not session:
        raise AppError("SESSION_NOT_FOUND", f"Session {session_id} not found", status_code=404)
    return session

# ANTI-PATTERN: Never query without tenant_id
# sessions = await db.exec(select(AdvisorySession))  # WRONG -- leaks cross-tenant data
```

### Tenant and User Model Details

```python
# models/tenant.py
import uuid
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field

class Tenant(SQLModel, table=True):
    __tablename__ = "tenants"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=255, unique=True)
    slug: str = Field(max_length=100, unique=True, index=True)
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# models/user.py
class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(max_length=255, unique=True, index=True)
    hashed_password: str = Field(max_length=255)
    full_name: str = Field(max_length=255)
    tenant_id: uuid.UUID = Field(foreign_key="tenants.id", index=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

### Password Hashing

```python
# core/auth.py -- password utilities
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=settings.bcrypt_rounds)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
```

### Config Additions

```python
# Add to core/config.py Settings class
jwt_secret_key: str = "change-me-in-production"  # defaults to secret_key in dev
jwt_algorithm: str = "HS256"
jwt_access_token_expire_minutes: int = 480  # 8 hours
bcrypt_rounds: int = 12
```

### Middleware Registration Order in main.py

```python
# The order matters. Outermost middleware runs first.
# 1. CORS (outermost -- must run before anything else)
# 2. TenantMiddleware (extracts JWT, sets contextvars)
# 3. request_logging_middleware (logs with tenant_id from contextvars)

def create_app() -> FastAPI:
    setup_structlog()
    app = FastAPI(...)

    # 1. CORS
    app.add_middleware(CORSMiddleware, ...)

    # 2. Tenant context (sets contextvars before logging reads them)
    app.add_middleware(TenantMiddleware)

    # 3. Request logging (reads tenant_id from contextvars)
    app.middleware("http")(request_logging_middleware)

    setup_opentelemetry(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app
```

### Updated Logging with Tenant Context

```python
# Update request_logging_middleware in core/middleware.py
async def request_logging_middleware(request: Request, call_next):
    logger = structlog.get_logger()
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request.headers.get("x-request-id", "")[:64],
        method=request.method,
        path=request.url.path,
    )
    # Bind tenant context if available (set by TenantMiddleware)
    try:
        from app.core.tenant import get_tenant_id, get_user_id
        structlog.contextvars.bind_contextvars(
            tenant_id=get_tenant_id(),
            user_id=get_user_id(),
        )
    except Exception:
        pass  # Public routes have no tenant context
    # ... rest of middleware
```

### Security Considerations

- Return `404 Not Found` (not `403 Forbidden`) when a user tries to access another tenant's resource. This prevents tenant enumeration attacks.
- Never log plaintext passwords. Log `email` on failed login attempts for audit trails but never the password value.
- JWT tokens should NOT contain sensitive data (no password hashes, no PII beyond user_id).
- Validate `tenant.is_active` and `user.is_active` on every token verification, not just at login time. If a tenant is deactivated, existing tokens should be rejected.
- Bcrypt rounds set to 12 (default) -- sufficient for current hardware. Do not reduce for "performance."

### Dependency on Story 1.2

Story 1.2 defines `AdvisorySession` and `TravelerProfile` models. If Story 1.2 is already implemented when this story starts:
- Add `tenant_id` column to `AdvisorySession` model
- Update all session endpoint queries to filter by `tenant_id`
- Create a new Alembic migration for the `tenant_id` column addition

If Story 1.2 is NOT yet implemented (current state based on codebase inspection):
- The session endpoint tenant isolation work in Task 11 should be coordinated with Story 1.2
- At minimum, define the `tenant_id` requirement so Story 1.2 includes it from the start
- Focus this story on auth infrastructure (Tasks 1-10, 12) and leave Task 11 for when Story 1.2 models exist

### Files Created / Modified

**New files:**
- `backend/app/core/auth.py` -- JWT + OAuth2 + password hashing
- `backend/app/core/tenant.py` -- tenant context middleware + contextvars
- `backend/app/models/tenant.py` -- Tenant SQLModel
- `backend/app/models/user.py` -- User SQLModel
- `backend/app/schemas/auth.py` -- auth request/response schemas
- `backend/app/api/v1/auth.py` -- auth route handlers
- `backend/alembic/versions/xxxx_add_tenants_and_users.py` -- migration

**Modified files:**
- `backend/app/core/config.py` -- add JWT/bcrypt settings
- `backend/app/core/middleware.py` -- bind tenant_id/user_id to structlog context
- `backend/app/core/dependencies.py` -- add auth dependencies (create file if it doesn't exist)
- `backend/app/api/v1/router.py` -- register auth router
- `backend/app/main.py` -- register TenantMiddleware
- `backend/app/models/__init__.py` -- export Tenant and User

### Anti-Patterns -- DO NOT

- **DO NOT** store plaintext passwords -- always hash with bcrypt via passlib
- **DO NOT** use thread-local for tenant context -- use `contextvars` (async-safe)
- **DO NOT** return 403 for cross-tenant access -- return 404 to prevent enumeration
- **DO NOT** put business logic in middleware -- middleware only extracts and sets context
- **DO NOT** skip tenant_id filtering on any B2B database query
- **DO NOT** hardcode public paths as a mutable list -- use `frozenset`
- **DO NOT** validate tenant/user active status only at login -- check on every request
- **DO NOT** use stdlib `logging` -- use `structlog` only
- **DO NOT** create a `utils.py` -- name files by purpose

### Testing Strategy

All tests must pass with PostgreSQL only. No Qdrant, Redis, or LLM required.

```python
# Test fixture: create test tenant and user
@pytest.fixture
async def test_tenant(db_session):
    tenant = Tenant(name="Test Agency", slug="test-agency")
    db_session.add(tenant)
    await db_session.commit()
    return tenant

@pytest.fixture
async def test_user(db_session, test_tenant):
    user = User(
        email="agent@test-agency.com",
        hashed_password=hash_password("test-password"),
        full_name="Test Agent",
        tenant_id=test_tenant.id,
    )
    db_session.add(user)
    await db_session.commit()
    return user

@pytest.fixture
async def auth_headers(test_user, test_tenant):
    token = create_access_token({"sub": str(test_user.id), "tenant_id": str(test_tenant.id)})
    return {"Authorization": f"Bearer {token}"}

# Tenant isolation test pattern
async def test_tenant_isolation(client, auth_headers_tenant_a, auth_headers_tenant_b):
    # Tenant A creates a session
    resp = await client.post("/api/v1/advisory_sessions", headers=auth_headers_tenant_a, json={...})
    session_id = resp.json()["id"]

    # Tenant B cannot access it (gets 404, not 403)
    resp = await client.get(f"/api/v1/advisory_sessions/{session_id}", headers=auth_headers_tenant_b)
    assert resp.status_code == 404
```

### References

- [Source: architecture.md -- Authentication & Security]
- [Source: architecture.md -- Tenant Context Flow]
- [Source: architecture.md -- Implementation Patterns & Consistency Rules]
- [Source: architecture.md -- Enforcement Guidelines]
- [Source: epics.md -- Story 1.6: Auth, Tenant & Multi-tenancy]
- [Source: epics.md -- AR-8: JWT + OAuth2 for B2B auth]
- [Source: epics.md -- AR-9: Tenant context middleware]
- [Source: epics.md -- NFR-3: Multi-tenancy]
- [Source: epics.md -- NFR-8: Privacy]

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
