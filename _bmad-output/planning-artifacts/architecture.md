---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-05-24'
inputDocuments: ['prd.md', 'brief.md', 'addendum.md']
workflowType: 'architecture'
project_name: 'AIFU'
user_name: 'Fred'
date: '2026-05-24'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
32 FRs across 7 features. The system decomposes into three architectural layers:

1. **Advisory Workflow Layer** (FR-1 to FR-23): The core 4-stage pipeline — Profiling → Calculation → Proposal → Compliance. Each stage is owned by specialized agents orchestrated via LangGraph. The Compliance Agent has veto authority over Proposal delivery (FR-23).

2. **Interface Layer** (FR-24 to FR-28): Two UX surfaces from a shared backend — B2B copilot sidebar (real-time, streaming) and B2C demo chat (conversational, stateless). Both consume the same agent APIs.

3. **Data Layer** (FR-29 to FR-32): Background ETL pipelines, Vector Store (Qdrant), hybrid search, freshness tracking, and regulatory data management. Operates independently of the advisory workflow.

**Non-Functional Requirements:**
- **Zero hallucination policy**: All Entities in Proposals must exist in Vector Store. Architectural implication: Proposal Agent cannot free-generate venue names — must retrieve-then-generate.
- **Observability**: All agent invocations emit structured traces (OpenTelemetry). Model performance metrics dashboardable.
- **Multi-tenancy**: Logical isolation via tenant ID filtering across all data access patterns.
- **Real-time updates**: Copilot sidebar must stream agent outputs within 5 seconds of completion.
- **Scalability**: 10 concurrent Advisory Sessions for MVP via K8S horizontal autoscaling.

**Scale & Complexity:**
- Primary domain: Full-stack AI/ML platform
- Complexity level: High
- Estimated architectural components: ~15 (6 agents, 2 frontends, API gateway, orchestrator, vector store, ETL pipeline, regulatory store, auth/tenancy, observability stack)

### Technical Constraints & Dependencies

- **Stack locked**: Python, LangChain/LangGraph, Qwen 3.x, Qdrant, Docker/K8S, GitHub Actions
- **Open-source mandate**: No paid SaaS dependencies for core functionality. Travel data APIs constrained to free tiers or seed data.
- **MVP data strategy**: Periodically refreshed ETL (not real-time API calls during sessions). Seed dataset + API enrichment.
- **GPU requirements**: Open question (OQ-2) — LLM serving and fine-tuning infrastructure TBD.
- **External dependencies**: Amadeus/Skyscanner/Booking.com APIs (free tier), government visa/health data sources, weather/seasonal pattern data (static for MVP).

### Cross-Cutting Concerns Identified

1. **Data Integrity / Guardrails**: The zero-hallucination policy is the system's defining constraint. Every architectural decision around the Proposal Agent must enforce retrieve-then-generate. Guardrail middleware must intercept and validate Entity references before Proposal delivery.

2. **Observability**: Not an afterthought — it's a learning objective. Every agent call, RAG retrieval, and compliance check must be traceable. Architecture must bake in OpenTelemetry from Day 1, not bolt it on.

3. **Freshness Management**: Stale data is a cross-cutting risk. Affects Calculation (stale prices), Proposal (closed venues), and Compliance (outdated visa rules). Architecture needs a freshness-aware retrieval layer that propagates staleness warnings to consumers.

4. **Multi-tenancy**: Tenant isolation must be enforced at the API layer and propagated to Vector Store queries, session storage, and client history. Architecture needs a tenant context that flows through the entire request path.

5. **Cost Management**: 6 agent types × 20+ exchanges per session × multiple concurrent sessions = significant inference cost. Architecture needs model tiering (small model for simple routing, large model for generation), caching (popular destination data), and token budgeting per session.

6. **Dual UX Pattern**: Two frontends (copilot sidebar, demo chat) from one backend. Architecture needs a clean API contract that both UIs consume, with the real-time streaming layer abstracted from business logic.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack AI/ML platform with three distinct layers: React frontend, FastAPI + LangGraph backend, and ML infrastructure (vLLM + Qdrant).

### Starter Options Considered

| Option | Verdict |
|---|---|
| Full Stack FastAPI Template (38.6K stars) | Selected — proven, includes React + PostgreSQL + Docker + CI/CD |
| FastAPI LangGraph Agent Template | Pattern reference — agent directory structure, state management, observability patterns adopted |
| Custom from scratch | Rejected — slow start, risk of poor structure |

### Selected Approach: Official FastAPI Template + LangGraph Patterns + Progressive Infrastructure

**Rationale:** Use the official template as scaffold, integrate LangGraph agent patterns, but introduce services progressively — each new service tied to a specific AI/ML learning concept. The full architecture is the target; the starting state is intentionally minimal.

**Party Mode Review Finding:** All four reviewers (Architect, Engineer, UX Designer, Business Analyst) agreed the full service count (7 services) is too high for Day 1. The fix is reordering, not descoping.

### Confirmed Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Backend | Python 3.12+ / FastAPI (async) | AI/ML ecosystem, LangChain native, WebSocket/SSE support |
| Frontend | React + TypeScript | Widely known, strong streaming/state patterns, good for solo dev |
| Agent Framework | LangChain + LangGraph | Most mature Python orchestration for multi-agent workflows |
| Database (structured) | PostgreSQL + SQLModel | Sessions, profiles, tenants. Non-negotiable |
| Vector DB | Qdrant | Lightweight, fast filtered search, open-source. Introduced in Phase 2 |
| Cache / Pub-Sub | Redis | Caching, real-time sidebar streaming, LangGraph checkpoints. Introduced in Phase 2 |
| LLM Serving (dev) | Ollama | CPU-friendly, OpenAI-compatible API, zero GPU requirement for dev |
| LLM Serving (prod) | vLLM + Qwen 3.x | Production inference. Introduced in Phase 3 with fine-tuning |
| Infrastructure (dev) | Docker Compose | All services with one command. K8S deferred to Phase 4 |
| Infrastructure (prod) | Kubernetes | Introduced in Phase 4 as its own learning module |
| CI/CD | GitHub Actions | Standard, free tier |
| Observability | Prometheus / Grafana / OpenTelemetry | Baked in from Day 1 at the middleware level |

### Progressive Infrastructure Plan

Services are introduced as each AI/ML concept demands them:

| Phase | Services Running | AI/ML Concepts Unlocked |
|---|---|---|
| **Phase 1** (Weeks 1-4) | FastAPI + PostgreSQL + Ollama + Docker Compose | Multi-Agent Systems, Prompt Engineering, CI/CD, basic Observability |
| **Phase 2** (Weeks 5-8) | + Qdrant + Redis | Vector DB Scaling, RAG Advanced/Hybrid, Data Pipelines & ETL |
| **Phase 3** (Weeks 9-12) | + vLLM (replaces Ollama) | LLM Fine-Tuning, Training, Cost Optimization, Model Evaluation |
| **Phase 4** (Weeks 13-16) | + Kubernetes (replaces Docker Compose for prod) | Docker & K8S, Observability & Monitoring (full stack), MLOps |

### Project Structure (Target State)

```
stravel/
├── backend/
│   ├── app/
│   │   ├── api/v1/              # FastAPI route handlers
│   │   ├── agents/              # LangGraph agent graphs
│   │   │   ├── profiling/       # Fact-finding agent
│   │   │   ├── calculation/     # Budget, routing, pricing agents
│   │   │   ├── proposal/        # Proposal generation agent
│   │   │   ├── compliance/      # Compliance validation agent
│   │   │   ├── protocols.py     # Typed Protocol interfaces (all agent boundaries)
│   │   │   └── orchestrator.py  # LangGraph workflow graph
│   │   ├── rag/                 # RAG pipeline + Qdrant client
│   │   ├── etl/                 # Data pipeline jobs
│   │   ├── models/              # SQLModel ORM models
│   │   ├── schemas/             # Pydantic request/response
│   │   ├── services/            # Business logic services
│   │   ├── prompts/             # System prompt templates
│   │   ├── guardrails/          # Entity validation, hallucination prevention
│   │   ├── core/                # Config, auth, middleware, tenant context
│   │   └── evals/               # Model evaluation benchmarks
│   ├── alembic/                 # Database migrations
│   ├── tests/
│   │   ├── unit/                # Green on PostgreSQL only — no vector store, no LLM
│   │   ├── integration/         # Full service stack
│   │   └── conftest.py          # Fixture stubs for every external service
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── shared/          # StreamMessage, TypingIndicator, MessageBubble
│   │   │   ├── b2b/             # Copilot sidebar components
│   │   │   └── b2c/             # Demo chat components
│   │   ├── hooks/
│   │   │   ├── useStreamContext.ts  # Dual-context: explicit query vs proactive insight
│   │   │   └── useAdvisorySession.ts
│   │   ├── services/            # API client
│   │   └── types/               # TypeScript types
│   └── Dockerfile
├── infra/
│   ├── k8s/                     # Kubernetes manifests (Phase 4)
│   ├── vllm/                    # vLLM serving config (Phase 3)
│   └── monitoring/              # Prometheus/Grafana configs
├── docker-compose.yml           # Minimal (Phase 1: FastAPI + PostgreSQL + Ollama)
├── docker-compose.full.yml      # Full stack (all services)
├── .github/workflows/           # CI/CD
└── README.md
```

### Key Architectural Decisions from Party Mode Review

1. **Typed Protocol interfaces** at all agent boundaries (`agents/protocols.py`). Unit tests must pass with PostgreSQL only — no vector store, no LLM required.
2. **Ollama for dev, vLLM for prod.** Same OpenAI-compatible API contract — swap is transparent. Removes GPU requirement for daily development.
3. **`components/shared/`** for cross-surface UI primitives. `useReducer` for streaming state, not `useState`. `useStreamContext` hook distinguishes explicit queries from proactive suggestions.
4. **Docker Compose only until Phase 4.** K8S is a learning module, not a prerequisite.
5. **Two `docker-compose` files:** minimal (Phase 1) and full (all services). Progressive complexity.
6. **Concept-driven service introduction.** Each new service enters when an AI/ML concept demands it, not when the architecture diagram says so.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Dual state management: LangGraph checkpointer for agent state + SQLModel for business data
- SSE for real-time streaming (not WebSocket)
- Tenant context middleware for multi-tenancy enforcement
- Typed Protocol interfaces at all agent boundaries

**Important Decisions (Shape Architecture):**
- JWT + OAuth2 for B2B auth, no auth for B2C demo
- Redis caching with TTL aligned to Entity freshness
- useReducer + React Context for frontend state (no Redux)
- Structured JSON logging with structlog

**Deferred Decisions (Post-MVP):**
- WebSocket for bidirectional copilot interaction (if SSE proves insufficient)
- Global state management library (if surfaces grow beyond 2)
- CDN/edge caching for static assets
- Rate limiting beyond simple IP-based for demo mode

### Data Architecture

| Decision | Choice | Rationale |
|---|---|---|
| Agent execution state | LangGraph PostgreSQL checkpointer | Native to LangGraph, handles workflow state, step tracking, intermediate outputs |
| Business data | SQLModel + PostgreSQL | Traveler Profiles, Proposals, Compliance Reports, Client History, Advisory Sessions |
| Migrations | Alembic | Standard for SQLModel/SQLAlchemy |
| Vector data | Qdrant (Phase 2) | Entity embeddings, hybrid search. Stub interface until Phase 2 |
| Caching | Redis with TTL (Phase 2) | Popular queries, Entity lookups. In-memory stubs until Phase 2 |
| Cache invalidation | TTL-based | 7 days for prices, 30 days for descriptions. Aligned with Entity freshness |
| Validation | Pydantic (API) + SQLModel (DB) + Guardrails (Entity existence) | Three-layer validation strategy |

### Authentication & Security

| Decision | Choice | Rationale |
|---|---|---|
| B2B auth | JWT + OAuth2 (FastAPI built-in) | Tenant-scoped tokens, included in official template |
| B2C auth | None (session-based, IP rate limited) | Demo mode — minimal friction |
| Multi-tenancy | Tenant context middleware | Extracts tenant_id from JWT, propagates to all queries |
| Tenant isolation | Logical (tenant_id filter on all queries) | Shared infrastructure, filtered access |
| Data encryption | TLS in transit, PostgreSQL encryption at rest | Standard practices |

### API & Communication Patterns

| Decision | Choice | Rationale |
|---|---|---|
| Real-time streaming | SSE (Server-Sent Events) | Server-to-client push for agent outputs. Simpler than WebSocket, works through proxies |
| Client-to-server | REST (POST/GET) | Start sessions, confirm profiles, trigger proposals. Standard REST actions |
| API design | REST + versioned endpoints (/api/v1/) | Auto-documented via FastAPI OpenAPI |
| Inter-agent comms | LangGraph shared state | Agents communicate via graph state, not HTTP/messages |
| External services | Typed Protocol interfaces | Qdrant, Redis, PostgreSQL accessed via service layer with Protocol classes |
| Error handling | FastAPI exception handlers | Consistent error response format across all endpoints |

### Frontend Architecture

| Decision | Choice | Rationale |
|---|---|---|
| Streaming state | useReducer | Handles out-of-order messages from SSE |
| Session state | React Context | Advisory Session, Traveler Profile — scoped, not global |
| Global state library | None (deferred) | Unnecessary for 2 surfaces. Add only if complexity demands it |
| API client | Auto-generated from OpenAPI schema | Type-safe, stays in sync with backend |
| SSE client | EventSource API | Native browser API for server-sent events |
| Shared components | components/shared/ | StreamMessage, TypingIndicator, MessageBubble reused across B2B and B2C |

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|---|---|---|
| Environment config | .env files (dev) → ConfigMaps/Secrets (K8S, Phase 4) | Standard progression |
| Logging | structlog (structured JSON) | Queryable, parseable, production-grade |
| Tracing | OpenTelemetry | All agent calls, RAG retrievals, compliance checks emit traces |
| Metrics | Prometheus | Request latency, agent execution time, cache hit rate, Entity freshness |
| Dashboards | Grafana | System health, model performance, data freshness |
| Scaling (Phase 1-3) | Single instance, Docker Compose | Sufficient for 10 concurrent sessions |
| Scaling (Phase 4) | K8S HPA | CPU/memory autoscaling. vLLM scaled independently |

### Decision Impact Analysis

**Implementation Sequence:**
1. PostgreSQL + SQLModel models + Alembic migrations (Week 1)
2. FastAPI endpoints + JWT auth + tenant middleware (Week 1-2)
3. LangGraph orchestrator + Profiling Agent + Protocol interfaces (Week 2-3)
4. React frontend + SSE streaming + useReducer (Week 3-4)
5. Qdrant + RAG pipeline + Redis caching (Phase 2)
6. vLLM serving + fine-tuning pipeline (Phase 3)
7. K8S deployment + full observability (Phase 4)

**Cross-Component Dependencies:**
- Tenant context middleware → affects all DB queries, Vector Store queries, and session management
- Protocol interfaces → all agents depend on these contracts; must be defined before agent implementation
- SSE streaming → frontend useReducer pattern depends on SSE event format; define contract early
- Entity freshness → affects caching TTL, Proposal guardrails, and Compliance checks

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (SQLModel/PostgreSQL):**

| Element | Convention | Example |
|---|---|---|
| Table names | snake_case, plural | `advisory_sessions`, `traveler_profiles`, `compliance_reports` |
| Column names | snake_case | `tenant_id`, `created_at`, `passport_expiry_date` |
| Foreign keys | `{referenced_table_singular}_id` | `traveler_profile_id`, `advisory_session_id` |
| Indexes | `ix_{table}_{column}` | `ix_advisory_sessions_tenant_id` |
| Enums | PascalCase class, UPPER_SNAKE values | `class SessionStatus(str, Enum): IN_PROGRESS = "in_progress"` |
| Timestamps | `created_at`, `updated_at` on all tables | Always UTC, `datetime` type |

**API (FastAPI):**

| Element | Convention | Example |
|---|---|---|
| Endpoints | snake_case, plural nouns | `/api/v1/advisory_sessions`, `/api/v1/traveler_profiles` |
| Path params | snake_case | `/api/v1/advisory_sessions/{session_id}` |
| Query params | snake_case | `?tenant_id=abc&status=in_progress` |
| Request/Response JSON | snake_case | `{ "traveler_count": 4, "travel_dates": {...} }` |
| SSE event names | dot-separated, lowercase | `agent.profiling.question`, `agent.compliance.flag`, `proposal.ready` |

**Python Backend:**

| Element | Convention | Example |
|---|---|---|
| Files/modules | snake_case | `profiling_agent.py`, `visa_checker.py` |
| Classes | PascalCase | `ProfilingAgent`, `TravelerProfile`, `ComplianceReport` |
| Functions/methods | snake_case | `run_compliance_checks()`, `get_accommodation_matches()` |
| Constants | UPPER_SNAKE | `MAX_SESSION_EXCHANGES = 30`, `PRICE_FRESHNESS_DAYS = 7` |
| Protocol interfaces | PascalCase with Protocol suffix | `VectorStoreProtocol`, `LLMServiceProtocol` |
| Pydantic schemas | PascalCase with suffix | `SessionCreateRequest`, `ProposalResponse`, `ComplianceCheckResult` |

**React Frontend (TypeScript):**

| Element | Convention | Example |
|---|---|---|
| Components | PascalCase file + export | `CopilotSidebar.tsx`, `StreamMessage.tsx` |
| Hooks | camelCase with `use` prefix | `useStreamContext.ts`, `useAdvisorySession.ts` |
| Services | camelCase file | `apiClient.ts`, `sseClient.ts` |
| Types/Interfaces | PascalCase with no suffix | `TravelerProfile`, `ProposalData`, `ComplianceFlag` |
| Event handlers | `handle` + Event | `handleProfileSubmit`, `handleComplianceOverride` |
| CSS/styles | CSS modules, camelCase | `styles.sidebarPanel`, `styles.messageBubble` |

### Structure Patterns

**Backend file organization — by feature, not by type:**

```
# CORRECT: Feature-grouped
backend/app/agents/profiling/
├── __init__.py
├── agent.py          # LangGraph node definition
├── prompts.py        # System prompts for this agent
├── schemas.py        # Pydantic models specific to profiling
└── tests/
    └── test_profiling_agent.py
```

**Test location:** Co-located `tests/` directory within each feature module for unit tests. Top-level `tests/integration/` for cross-feature tests.

**Shared utilities:** `backend/app/core/` for cross-cutting concerns. No generic `utils.py` — name by purpose (`date_helpers.py`, `currency.py`).

### Format Patterns

**API Response Format:**

```python
# Success: return data directly (FastAPI convention, no wrapper)
@router.get("/advisory_sessions/{session_id}")
async def get_session(session_id: str) -> SessionResponse:
    return session

# Error: consistent exception format
# {"detail": {"code": "ENTITY_NOT_FOUND", "message": "Hotel 'xyz' not found in Vector Store"}}
```

**SSE Event Format:**

```
event: agent.profiling.question
data: {"type": "question", "content": "How old are the children?", "context": "family_detected"}

event: agent.compliance.flag
data: {"type": "flag", "severity": "block", "check": "visa", "message": "E-visa required", "alternative": "Apply at evisa.gov.vn"}

event: proposal.ready
data: {"type": "proposal", "session_id": "abc-123"}
```

**Date/Time:** ISO 8601 strings in all JSON. UTC everywhere. Frontend formats for display only.

### Communication Patterns

**LangGraph State Convention:**

```python
class AdvisoryState(BaseModel):
    session_id: str
    tenant_id: str
    stage: Literal["profiling", "calculating", "proposing", "validating"]
    traveler_profile: TravelerProfile | None = None
    calculations: CalculationResults | None = None
    proposal: Proposal | None = None
    compliance_report: ComplianceReport | None = None
    errors: list[AgentError] = []
```

**Protocol Interface Convention:**

```python
class VectorStoreProtocol(Protocol):
    async def search(self, query: str, filters: dict, limit: int = 10) -> list[Entity]: ...
    async def get_by_id(self, entity_id: str) -> Entity | None: ...

class LLMServiceProtocol(Protocol):
    async def generate(self, prompt: str, **kwargs) -> str: ...
    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]: ...
```

**Tenant Context Flow:**

```python
from contextvars import ContextVar
_tenant_id: ContextVar[str] = ContextVar("tenant_id")

def get_tenant_id() -> str:
    return _tenant_id.get()
# Every DB query and Vector Store search MUST include tenant_id
```

### Process Patterns

**Error Handling:**

| Layer | Pattern |
|---|---|
| API boundary | FastAPI exception handlers → `{"detail": {"code": "...", "message": "..."}}` |
| Agent errors | Append to `AdvisoryState.errors`, continue workflow |
| Compliance blocks | Return `ComplianceFlag(severity="block")`, aggregate in Compliance Agent |
| External service failures | Retry 3x with exponential backoff, then graceful degradation |
| LLM failures | Retry once, then structured error in agent state |

**Logging Convention:**

```python
# Always include: tenant_id, session_id, agent_name
logger.info("agent.completed",
    tenant_id=tenant_id, session_id=session_id,
    agent="profiling", exchanges=12, duration_ms=3400)
# Levels: DEBUG (internals), INFO (lifecycle), WARNING (stale data), ERROR (failures)
```

**Frontend Streaming State:**

```typescript
type StreamState = {
  status: 'idle' | 'profiling' | 'calculating' | 'proposing' | 'validating' | 'complete';
  messages: StreamMessage[];
  complianceFlags: ComplianceFlag[];
  error: string | null;
};
// Always useReducer, never useState for streaming state
```

### Enforcement Guidelines

**All AI Agents implementing STravel MUST:**

1. Follow naming conventions — no exceptions
2. Use Protocol interfaces for all external service access — never import implementations directly
3. Include `tenant_id` in every database query and Vector Store search in B2B mode
4. Use `structlog` with `tenant_id` + `session_id` + `agent_name` in every log entry
5. Never generate Entity names, prices, or ratings via LLM — all factual data from Vector Store only
6. Use Pydantic BaseModel for all LangGraph state (not TypedDict)
7. Co-locate tests with feature modules
8. Return errors via `AdvisoryState.errors` list, never raise exceptions inside agents

**Anti-Patterns:**

```python
# ❌ Agent imports another agent's internals
from app.agents.profiling.prompts import PROFILING_SYSTEM_PROMPT

# ✅ Agent reads from shared state
profile = state.traveler_profile

# ❌ Generating hotel names from LLM
response = llm.generate("Suggest 3 hotels in Hanoi")

# ✅ Retrieving from Vector Store, then formatting
hotels = await vector_store.search("hotels in Hanoi", filters={"type": "hotel"})
response = llm.generate(f"Format these hotels for the proposal: {hotels}")

# ❌ Missing tenant context
sessions = await db.query(Session).all()

# ✅ Tenant-scoped query
sessions = await db.query(Session).where(Session.tenant_id == get_tenant_id()).all()
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
stravel/
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml                    # Phase 1: FastAPI + PostgreSQL + Ollama
├── docker-compose.full.yml               # Phase 2+: adds Qdrant + Redis
├── Makefile                              # Common dev commands
│
├── .github/workflows/
│   ├── ci.yml                            # Lint, test, build on PR
│   └── cd.yml                            # Deploy on merge to main (Phase 4)
│
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/versions/
│   ├── app/
│   │   ├── main.py                       # FastAPI app factory
│   │   ├── core/                         # Cross-cutting infrastructure
│   │   │   ├── config.py                 # Pydantic Settings
│   │   │   ├── auth.py                   # JWT + OAuth2
│   │   │   ├── tenant.py                 # Tenant context middleware
│   │   │   ├── middleware.py             # OpenTelemetry, logging, CORS
│   │   │   ├── database.py              # SQLModel engine
│   │   │   ├── dependencies.py           # FastAPI DI providers
│   │   │   └── exceptions.py             # AppError, error handlers
│   │   ├── models/                       # SQLModel ORM models
│   │   │   ├── advisory_session.py
│   │   │   ├── traveler_profile.py
│   │   │   ├── proposal.py
│   │   │   ├── compliance_report.py
│   │   │   ├── entity.py
│   │   │   └── tenant.py
│   │   ├── schemas/                      # Pydantic request/response
│   │   │   ├── session.py
│   │   │   ├── profile.py
│   │   │   ├── proposal.py
│   │   │   ├── compliance.py
│   │   │   ├── streaming.py              # SSE event schemas
│   │   │   └── auth.py
│   │   ├── api/v1/                       # Route handlers
│   │   │   ├── router.py
│   │   │   ├── sessions.py               # /advisory_sessions
│   │   │   ├── profiles.py               # /traveler_profiles
│   │   │   ├── proposals.py              # /proposals
│   │   │   ├── compliance.py             # /compliance_reports
│   │   │   ├── streaming.py              # /stream SSE endpoint
│   │   │   ├── auth.py
│   │   │   ├── demo.py                   # /demo B2C (no auth)
│   │   │   └── health.py
│   │   ├── agents/                       # LangGraph agents
│   │   │   ├── protocols.py              # Service Protocol interfaces
│   │   │   ├── state.py                  # AdvisoryState (shared)
│   │   │   ├── orchestrator.py           # LangGraph StateGraph
│   │   │   ├── profiling/                # FR-1 to FR-4
│   │   │   │   ├── agent.py, prompts.py, schemas.py, tests/
│   │   │   ├── calculation/              # FR-5 to FR-9
│   │   │   │   ├── agent.py, budget.py, routing.py, accommodation.py, pricing.py, insurance.py, schemas.py, tests/
│   │   │   ├── proposal/                 # FR-10 to FR-14
│   │   │   │   ├── agent.py, prompts.py, export.py, schemas.py, tests/
│   │   │   └── compliance/               # FR-15 to FR-23
│   │   │       ├── agent.py, visa.py, health.py, travel_advisory.py, age_restrictions.py, seasonal.py, budget_check.py, accessibility.py, passport.py, schemas.py, rules/*.json, tests/
│   │   ├── rag/                          # Phase 2
│   │   │   ├── vector_store.py, hybrid_search.py, embeddings.py, freshness.py, tests/
│   │   ├── etl/                          # Phase 2
│   │   │   ├── pipeline.py, hotels.py, attractions.py, restaurants.py, regulatory.py, deduplication.py, tests/
│   │   ├── services/
│   │   │   ├── llm.py, session_manager.py, client_history.py, cache.py
│   │   ├── guardrails/
│   │   │   ├── entity_validator.py, price_validator.py, tests/
│   │   ├── prompts/
│   │   │   ├── base.py, personas.py
│   │   └── evals/                        # Phase 3
│   │       ├── entity_accuracy.py, compliance_accuracy.py, proposal_quality.py, benchmarks/
│   └── tests/
│       ├── conftest.py
│       ├── integration/
│       └── fixtures/
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json, tsconfig.json, vite.config.ts
│   └── src/
│       ├── main.tsx, App.tsx
│       ├── components/
│       │   ├── shared/                    # StreamMessage, TypingIndicator, MessageBubble, ComplianceBadge
│       │   ├── b2b/                       # CopilotLayout, CopilotSidebar, SessionPanel, ProfileForm, CompliancePanel, ProposalViewer, SessionList, ClientHistory
│       │   └── b2c/                       # DemoLayout, ChatInterface, ProposalInline, ExportButton
│       ├── hooks/                         # useStreamContext, useAdvisorySession, useAuth, useProposal
│       ├── reducers/streamReducer.ts
│       ├── services/                      # apiClient, sseClient
│       ├── types/                         # api, stream, domain
│       └── styles/
│
├── infra/
│   ├── k8s/                              # Phase 4 (full K8S manifests)
│   ├── vllm/                             # Phase 3 (vLLM serving config)
│   └── monitoring/                        # OpenTelemetry, Prometheus, Grafana
│
└── data/
    ├── seed/                              # Vietnam hotel, attraction, restaurant, visa JSON
    └── scripts/seed_vector_store.py
```

### Architectural Boundaries

**Boundary Rules:**

| Boundary | Rule |
|---|---|
| `api/` → `agents/` | Via `services/session_manager.py` only. Never direct import |
| `agents/` → `rag/` | Via `VectorStoreProtocol`. DI injection |
| `agents/` → `services/llm.py` | Via `LLMServiceProtocol`. Never direct Ollama/vLLM import |
| `agents/*` → `agents/*` | Via `AdvisoryState` shared state only. No cross-agent imports |
| `b2b/` → `b2c/` | No imports between surfaces. Shared code in `shared/` |
| `etl/` → `rag/` | ETL writes via `VectorStoreProtocol`. Same interface agents read |

**Data Store Ownership:**

| Store | Owner | Readers | Access Pattern |
|---|---|---|---|
| PostgreSQL | `models/`, `alembic/` | `api/`, `services/`, `agents/` (via state) | SQLModel + tenant_id filter |
| Qdrant | `rag/`, `etl/` | `agents/` (via Protocol) | Hybrid search + metadata filter |
| Redis | `services/cache.py` | `agents/`, `api/` | TTL cache + pub/sub for SSE |
| LangGraph checkpoints | `agents/orchestrator.py` | `services/session_manager.py` | PostgreSQL-backed checkpointer |

### Requirements to Structure Mapping

| Feature (FRs) | Backend Location | Frontend Location |
|---|---|---|
| Fact-Finding (FR-1 to FR-4) | `agents/profiling/` | `b2b/ProfileForm`, `b2c/ChatInterface` |
| Calculation (FR-5 to FR-9) | `agents/calculation/` | `b2b/CopilotSidebar` (streaming) |
| Proposal (FR-10 to FR-14) | `agents/proposal/` | `b2b/ProposalViewer`, `b2c/ProposalInline` |
| Compliance (FR-15 to FR-23) | `agents/compliance/` + `rules/` | `b2b/CompliancePanel`, `shared/ComplianceBadge` |
| Copilot (FR-24 to FR-26) | `api/v1/streaming.py`, `api/v1/sessions.py` | `b2b/CopilotLayout`, `b2b/SessionList` |
| Demo Mode (FR-27 to FR-28) | `api/v1/demo.py` | `b2c/DemoLayout`, `b2c/ChatInterface` |
| Data Pipeline (FR-29 to FR-32) | `etl/`, `rag/` | N/A |

### Data Flow

**Advisory Session Lifecycle:**

```
1. Client Request → api/v1/sessions.py → services/session_manager.py → agents/orchestrator.py
2. Profiling Agent → SSE questions → frontend → REST profile updates → back to agent
3. Calculation Agent → rag/vector_store.py (search) → SSE results → frontend
4. Proposal Agent → rag/vector_store.py (retrieve) → llm (generate grounded text) → guardrails (validate) → SSE proposal → frontend
5. Compliance Agent → rules/*.json → SSE flags → frontend
6. If no blocks → api/v1/proposals.py (export PDF/link)
```

**ETL Flow:** External APIs → `etl/*.py` → `deduplication.py` → `rag/vector_store.py` → Qdrant

### Development Workflow

```bash
# Phase 1 startup
docker compose up -d                      # PostgreSQL + Ollama
cd backend && alembic upgrade head
cd backend && python -m app.main          # FastAPI hot reload
cd frontend && npm run dev                # React hot reload

# Phase 2 startup
docker compose -f docker-compose.full.yml up -d   # + Qdrant + Redis
python data/scripts/seed_vector_store.py

# Testing
cd backend && pytest app/ -m "not integration"     # Unit (PostgreSQL only)
cd backend && pytest tests/integration/            # Full stack
cd frontend && npm test
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** FastAPI (async) + LangGraph (async) + Qdrant (async) + Redis (async) — all async-compatible. Ollama/vLLM both expose OpenAI-compatible API — transparent swap. SQLModel + Alembic + PostgreSQL — proven. SSE + REST — clean separation.

**Pattern Consistency:** snake_case in Python/DB/API, PascalCase/camelCase in TypeScript/React — follows language conventions. Protocol interfaces enforce clean boundaries. AdvisoryState prevents cross-agent imports.

**Structure Alignment:** Feature-grouped backend matches LangGraph node-per-agent. `shared/` prevents B2B/B2C drift. Co-located tests match structure.

### Requirements Coverage ✅

All 32 FRs architecturally supported:

| FRs | Feature | Support |
|---|---|---|
| FR-1 to FR-4 | Fact-Finding | `agents/profiling/` + SSE streaming |
| FR-5 to FR-9 | Calculation | `agents/calculation/` + `rag/` |
| FR-10 to FR-14 | Proposal | `agents/proposal/` + `guardrails/` + export |
| FR-15 to FR-23 | Compliance | `agents/compliance/` + `rules/` + gate |
| FR-24 to FR-26 | Copilot | SSE endpoint + `b2b/` components |
| FR-27 to FR-28 | Demo Mode | `api/v1/demo.py` + `b2c/` components |
| FR-29 to FR-32 | Data Pipeline | `etl/` + `rag/` + freshness |

All 5 NFRs covered: zero hallucination, observability, multi-tenancy, real-time streaming, scalability.

### Gap Analysis

**Critical Gaps:** None.

**Important Gaps (non-blocking, decide during implementation):**
1. PDF export library (FR-14): `weasyprint` or `reportlab`
2. Embedding model (Phase 2): Qwen embeddings or `sentence-transformers`
3. Frontend router: `react-router-dom`

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Progressive infrastructure plan prevents Day 1 overwhelm
- Typed Protocol interfaces enable clean testing and service swapping
- Zero-hallucination guardrails architecturally enforced
- All 13 AI/ML concepts have genuine homes in the architecture
- Party Mode review resolved service count + frontend streaming issues early

**Areas for Future Enhancement:**
- PDF export library selection (Phase 1)
- Embedding model selection (Phase 2)
- K8S production hardening (Phase 4)
- Performance benchmarking framework (Phase 4)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions

**First Implementation Priority:**
1. Clone Full Stack FastAPI Template
2. Restructure to match STravel project structure
3. Set up Docker Compose (PostgreSQL + Ollama)
4. Implement `core/` module (config, auth, tenant, middleware, exceptions)
5. Define `agents/protocols.py` and `agents/state.py`
6. Build Profiling Agent as first LangGraph node
