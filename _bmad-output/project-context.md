---
project_name: 'STravel'
user_name: 'Fred'
date: '2026-05-29'
status: 'ALL 10 EPICS COMPLETE — 63/63 stories'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules', 'epic_2_rules', 'epic_3_rules', 'epic_4_rules', 'epic_5_rules', 'epic_6_rules', 'epic_7_rules', 'epic_8_rules', 'epic_9_rules', 'epic_10_rules']
existing_patterns_found: 57
---

# Project Context for AI Agents

_Critical rules and patterns for STravel. Compiled from bugs found and patches applied across all 10 epics._

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
- Use `apiClient.ts` — NEVER raw `fetch()` (ESLint `no-restricted-globals` rule enforces this)
- `URL.revokeObjectURL()` after blob download to prevent memory leak

### Frontend — Phase 2: Chat-First UI (Epics 7–10)

- **Dual-sentinel `aria-live` pattern**: Two always-in-DOM sentinels — one `role="status" aria-live="polite"` and one `role="alert" aria-live="assertive"`. Never dynamically change `aria-live` on the same element (AT reads the value at mount time). See `stravel/docs/aria-patterns.md`.
- **`aria-disabled` vs `disabled` in focus traps**: Use `aria-disabled={true}` + onClick guard for buttons inside modal focus traps. `disabled` removes the element from the tab order, breaking Tab cycling. See `aria-patterns.md` §3.
- **Focus trap pattern**: `onKeyDown` Tab/Shift+Tab on the modal container div; compare `document.activeElement` to first/last focusable refs to cycle.
- **triggerRef focus restoration**: Store `useRef` to the button that opened a modal; restore focus synchronously in cancel handler (`triggerRef.current?.focus()`). WCAG 2.1 SC 2.4.3. (UX-DR18: focus defaults to Cancel on open, not Confirm.)
- **`aria-describedby` on dialogs**: Always link the description paragraph to `role="dialog"` via `aria-describedby` + `id` pair. Without it, AT may not read the description automatically.
- **Status transition announcements**: Use `useRef` (not `useState`) to track previous prop value for detecting specific transitions (e.g., `confirmed → modified`) — avoids re-render on prev-value change.
- **ESLint flat config (`eslint.config.mjs`)**: ESLint 9 format. `@typescript-eslint/flat/recommended` rules loaded via IIFE (handles both array and object config shapes). `react-hooks` v7: use only `rules-of-hooks: error` + `exhaustive-deps: warn` (not `recommended-latest` which includes experimental React Compiler rules).
- **`@tanstack/react-virtual` v3.13.26**: Virtualizer requires mock in jsdom tests:
  ```ts
  vi.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: (opts: { count: number }) => ({
      getVirtualItems: () => Array.from({ length: opts.count }, (_, i) => ({ index: i, start: i * 50, size: 50, key: i, lane: 0 })),
      getTotalSize: () => opts.count * 50,
    }),
  }));
  ```
- **`.js` counterpart sync**: Every `.tsx` component has a generated `.js` counterpart. After editing a `.tsx` file, the `.js` file must also be updated (or deleted if unused — confirm with `git status`).
- **`--tw-ring-color` CSS variable**: Tailwind v3 injects `--tw-ring-color` via utilities. If you use ring-color in CSS without Tailwind's JIT, define it manually: `--tw-ring-color: var(--color-primary);`.
- **Async modal cancel guard**: Check `confirming` flag at the top of all cancel/close handlers — if an async operation is in-flight, return early. Also applies to backdrop click and Escape key handlers.
- **Error state in modals**: Never use empty `catch {}` in async confirm handlers. Show `role="alert"` error inside the modal; clear it with `setError(null)` when the modal reopens. Modal stays open on error (user can retry).

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
│   ├── components/cards/         # SlotCard, MultiSelectCard, PassportUploadCard, etc.
│   ├── hooks/, reducers/, services/, types/
├── docs/
│   └── aria-patterns.md          # Canonical ARIA accessibility patterns (Epics 7–10)
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

# ❌ Raw fetch() in React — use apiClient.ts (ESLint enforces this)

# ❌ disabled={true} on a button inside a modal focus trap — use aria-disabled + onClick guard
# ❌ Dynamically change aria-live attribute — use dual-sentinel pattern (aria-patterns.md §1)
# ❌ Empty catch {} in async modal confirm — show role="alert" error in modal (aria-patterns.md §8)
# ❌ Landmark roles (banner/main/navigation) on sub-components — use role="region" or role="alert"
```

### All Phases Complete

| Phase | Services / Focus | Stories | Status |
|---|---|---|---|
| Backend Phase 1 | FastAPI + PostgreSQL + Ollama | Epic 1 | **COMPLETE** |
| Backend Phase 2 | + Qdrant + Redis (RAG) | Epic 2 | **COMPLETE** |
| Backend Phase 3 | + vLLM + Calculation engine | Epic 3 | **COMPLETE** |
| Backend Phase 4 | + Compliance engine | Epic 4 | **COMPLETE** |
| Backend Phase 5 | + Demo mode | Epic 5 | **COMPLETE** |
| Backend Phase 6 | + Kubernetes / infra | Epic 6 | **COMPLETE** |
| **UI Phase 2** | **Chat-first UI (B2C + B2B)** | **Epics 7–10 (32 stories)** | **COMPLETE** |

**Grand total: 63/63 stories done. 778 frontend tests passing. 0 rework stories.**

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
    ├── sprint-status.yaml                # 63/63 done
    ├── index.md                          # Epic status overview
    ├── deferred-work.md
    ├── epic-1/ through epic-10/          # ALL COMPLETE
    └── epic-phase2-retro-2026-05-29.md  # Phase 2 retrospective (Epics 7–10)
```
