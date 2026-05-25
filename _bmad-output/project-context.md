---
project_name: 'STravel'
user_name: 'Fred'
date: '2026-05-25'
status: 'ALL 6 EPICS COMPLETE — 31/31 stories'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules', 'epic_2_rules', 'epic_3_rules', 'epic_4_rules', 'epic_5_rules', 'epic_6_rules']
existing_patterns_found: 42
---

# Project Context for AI Agents

_Critical rules and patterns for STravel. Compiled from bugs found and patches applied across all 6 epics._

---

## Technology Stack & Versions

**Backend:**
- Python 3.12+ (system has 3.14) / FastAPI 0.115+ / SQLModel 0.0.22+
- LangChain 0.3+ / LangGraph 0.2+ / langgraph-checkpoint-postgres
- PostgreSQL 16 / asyncpg 0.30+ / greenlet (required for async SQLAlchemy)
- Alembic 1.14+ / structlog 24.4+ / OpenTelemetry 1.27+
- Ollama (dev LLM) / vLLM (prod) / Qwen 3.x
- bcrypt (direct, NOT passlib) / python-jose / httpx
- sse-starlette / qdrant-client 1.18+ / sentence-transformers 5+
- redis 5+ / prometheus-client
- Pydantic Settings with `"extra": "ignore"` in model_config

**Frontend:**
- React 19 / TypeScript 5.6+ / Vite 6 / react-router-dom 7

**Infrastructure:**
- Docker Compose (dev) / Kubernetes (prod)
- GitHub Actions CI (ruff + pytest)
- Prometheus / Grafana / OpenTelemetry / Jaeger

**E2E Testing:**
- Playwright with serial project dependencies (Suite 1 → 2 → 3)

## Critical Implementation Rules

### SQLAlchemy Async — MOST COMMON BUG SOURCE

- **NEVER use `session.exec()`** with AsyncSession — use `session.execute()` instead
- **ALWAYS call `.scalars()` before `.first()` or `.all()`** on async results
- **Use `.scalar_one()` for COUNT queries**, not `.one()`
- **Require `greenlet` package** — async SQLAlchemy fails without it

```python
# ❌ WRONG — causes AttributeError at runtime
result = await session.exec(select(Model).where(...))
item = result.first()

# ✅ CORRECT
result = await session.execute(select(Model).where(...))
item = result.scalars().first()

# ✅ COUNT query
result = await session.execute(select(func.count()).select_from(Model).where(...))
total = result.scalar_one()
```

### SQLModel Relationships — CAUSES STARTUP CRASH

- **NEVER use `from __future__ import annotations`** in model files with Relationships
- **Use `Optional["ModelName"]`** with `# noqa: F821` instead

```python
# ❌ WRONG — crashes at import
from __future__ import annotations
traveler_profile: "TravelerProfile | None" = Relationship(...)

# ✅ CORRECT
from typing import Optional
traveler_profile: Optional["TravelerProfile"] = Relationship(  # noqa: F821
    back_populates="advisory_session",
    sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"},
)
```

### Datetime — CAUSES INSERT FAILURES

- **Use `datetime.utcnow()`** (naive UTC), NOT `datetime.now(timezone.utc)`
- asyncpg raises `DataError` with timezone-aware datetimes

### Pydantic Settings — CAUSES STARTUP CRASH

- **Add `"extra": "ignore"` to model_config** — .env files with extra vars (POSTGRES_USER etc.) cause ValidationError otherwise

```python
model_config = {"env_file": ".env", "case_sensitive": False, "extra": "ignore"}
```

### Authentication & Tenant Isolation

- **JWT auth** using `python-jose` + direct `bcrypt` (NOT passlib — broken on Python 3.14)
- **bcrypt 72-byte limit** — validate password length before hashing
- **Tenant context via `contextvars`** — `get_tenant_id()` for all downstream code
- **ALL database queries MUST filter by `tenant_id`** in B2B mode
- **SSE endpoints MUST verify session ownership** before streaming

### Agent Architecture (LangGraph)

- **Pydantic BaseModel for all state** — NOT TypedDict
- `AdvisoryState` is the shared state across all agent nodes
- **Agents communicate via shared state only** — no cross-agent imports
- **Errors go into `AdvisoryState.errors` list** — never raise exceptions inside agents
- **Protocol interfaces** (`LLMServiceProtocol`, `VectorStoreProtocol`, `CacheProtocol`) at all boundaries
- **LLM factory** `create_llm_service()` returns Ollama or vLLM based on `settings.llm_backend`

### RAG & Vector Store (Epic 2)

- **Qdrant** for vector storage, `QdrantVectorStore` implements `VectorStoreProtocol`
- **Hybrid search**: keyword + semantic with RRF merge, configurable weighting
- **Freshness tracking**: 7 days for prices, 30 days for descriptions
- **Entity IDs**: Use deterministic MD5 hash of `{type}:{region}:{name}` for deduplication
- **Embedding model**: `all-MiniLM-L6-v2` (384 dimensions), lazy-loaded

### Calculation Engine (Epic 3)

- **Budget allocation**: Integer-cent math to avoid rounding drift, remainder goes to buffer
- **Accommodation scoring**: 5-factor weighted (price 0.35, rating 0.25, style 0.20, freshness 0.10, location 0.10)
- **Routing**: Nearest-neighbor heuristic with Vietnam transport network data
- **Seasonal pricing**: Tet dates (2026-2030) hardcoded, Christmas Dec 20-Jan 5
- **Insurance**: **Word-boundary regex** for activity risk classification — NOT substring matching
  - `re.search(r"\b" + re.escape(term) + r"\b", activity)` prevents "diving" matching "driving"

### Guardrails (Epic 3)

- **Entity validator**: Requires exact/prefix name match against Vector Store — NOT just semantic similarity
- **Price validator**: 10% tolerance against Vector Store source price
- **Retrieve-then-generate**: LLM formats data from Vector Store, never invents entity names

### Compliance Engine (Epic 4)

- **8 checks**: visa, passport, health, travel advisory, age restrictions, seasonal, budget, accessibility
- **ComplianceSeverity**: BLOCK (prevents export), WARNING (surfaced, overridable), PASS
- **Phu Quoc trap**: E-visa nationals (AU, US, etc.) visiting Phu Quoc + mainland = BLOCK. Island-only = WARNING. Visa-free nationals (DE, JP, RU) = no trap
- **PHU_QUOC_IDENTIFIERS**: Must be space-stripped (`{"phuquoc", "phúquốc"}`) to match normalization pipeline
- **Passport**: 6-month (180 days) validity from departure date
- **Age restrictions**: Use word-boundary matching, provide alternatives (scuba→snorkeling)

### Demo Mode (Epic 5)

- **No auth** on `/demo` endpoints — added to `PUBLIC_PATHS`
- **IP-based rate limiting** — in-memory, per-worker (Redis in v2)
- **Ephemeral sessions** — in-memory with 1-hour TTL
- **`is_demo: true`** flag in DemoChatResponse to signal demo mode

### SSE Streaming

- `StreamingResponse` with `text/event-stream` media type
- Event names: dot-separated lowercase (`agent.profiling.question`, `stage.change`)
- 30-second heartbeat timeout
- K8S Ingress needs `proxy-buffering: off` annotation for SSE

### Frontend (React)

- **`useReducer` for streaming state** — NOT `useState`
- `components/shared/` for cross-surface primitives (reused by B2B and B2C)
- All interactive components need `data-testid` for Playwright
- Use `apiClient.ts` — NEVER raw `fetch()`
- `URL.revokeObjectURL()` after blob download to prevent memory leak

### Testing Rules

- **Unit tests pass without external services** — mock Vector Store, mock LLM
- Mark DB tests with `@pytest.mark.integration`
- Co-locate agent tests in `agents/{name}/tests/`
- **ruff** excludes `alembic/versions/*` from linting
- Integration test scripts: `scripts/manual-test-epic{N}.sh`

### Code Quality & Style

- **ruff** line length 120, Python 3.12 target, exclude alembic versions
- **structlog** for all logging — NEVER stdlib `logging`
- **snake_case** for DB/API/Python, **PascalCase** for classes/components

### File Structure

```
stravel/
├── backend/app/
│   ├── core/           # Config, auth, tenant, middleware, exceptions, database, rate_limiter, metrics
│   ├── api/v1/         # health, auth, sessions, streaming, demo
│   ├── agents/
│   │   ├── profiling/  # Fact-finding (8 context triggers)
│   │   ├── calculation/ # Budget, accommodation, routing, pricing, insurance
│   │   ├── proposal/   # Itinerary, export, schemas
│   │   ├── compliance/ # Visa, passport, health, advisory, age, seasonal, budget, accessibility, gate
│   │   ├── protocols.py, state.py, orchestrator.py, checkpointer.py
│   ├── models/         # AdvisorySession, TravelerProfile, Entity, Tenant, TenantUser
│   ├── schemas/        # session, profile, auth, streaming, demo, compliance
│   ├── services/       # llm, event_bus, cache, profile_validator, demo_session, client_history
│   ├── rag/            # vector_store, hybrid_search, embeddings, freshness
│   ├── etl/            # pipeline, hotels, attractions, restaurants, regulatory, deduplication
│   ├── guardrails/     # entity_validator, price_validator
│   └── prompts/        # base, personas
├── frontend/src/
│   ├── components/{shared,b2b,b2c}/
│   ├── hooks/, reducers/, services/, types/
├── infra/k8s/          # namespace, configmap, secret, ingress, kustomization + per-service dirs
├── e2e/                # Playwright tests (3 suites)
├── data/seed/          # Vietnam entities, visa rules, seasons
├── scripts/            # manual-test-epic{1-4}.sh
```

### Critical Anti-Patterns

```python
# ❌ Import another agent's internals
from app.agents.profiling.prompts import SYSTEM_PROMPT

# ❌ Generate entity names from LLM
hotels = await llm.generate("Suggest hotels in Hanoi")

# ❌ Query without tenant filter
sessions = await session.execute(select(AdvisorySession))

# ❌ Use passlib (broken on Python 3.14)
from passlib.context import CryptContext

# ❌ Use `from __future__ import annotations` in SQLModel files

# ❌ Use datetime.now(timezone.utc) for DB timestamps

# ❌ Use session.exec() with AsyncSession

# ❌ Substring matching for activity risk ("diving" in "driving" = True)
if any(h in activity for h in HIGH_RISK)  # Use re.search with \b instead

# ❌ Semantic similarity for entity validation (partial matches pass)
# Use exact/prefix name match instead

# ❌ Raw fetch() in React — use apiClient.ts
```

### All Phases Complete

| Phase | Services | Status |
|---|---|---|
| Phase 1 | FastAPI + PostgreSQL + Ollama | **COMPLETE (Epic 1)** |
| Phase 2 | + Qdrant + Redis | **COMPLETE (Epic 2)** |
| Phase 3 | + vLLM (replaces Ollama) | **COMPLETE (Epic 3)** |
| Phase 4 | + Kubernetes | **COMPLETE (Epic 6)** |

### Alembic Migration Notes

- Template at `alembic/script.py.mako` — must exist before `alembic revision --autogenerate`
- `alembic/env.py` imports `app.models` to register metadata
- PostgreSQL enum types need manual `DROP TYPE` on full reset
- Clean reset: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` then `alembic upgrade head`

### BMad Output Structure

```
_bmad-output/
├── project-context.md                    # THIS FILE
├── brainstorming/
├── planning-artifacts/                   # architecture.md, epics.md, PRD, briefs
└── implementation-artifacts/
    ├── sprint-status.yaml                # 31/31 done
    ├── index.md                          # Epic status overview
    ├── deferred-work.md
    ├── epic-1/ through epic-6/           # ALL COMPLETE
```
