---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-05-24'
inputDocuments: ['prds/prd-AIFU-2026-05-24/prd.md', 'architecture.md']
---

# STravel - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for STravel, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

- FR-1: Start Advisory Session — create session with unique ID, empty Traveler Profile, launch Profiling Agent
- FR-2: Dynamic Follow-Up Questions — detect context triggers, present relevant follow-ups (8+ triggers)
- FR-3: Traveler Profile Completion — validate minimum fields, present summary for confirmation
- FR-4: Profile Context Memory — track answered questions, avoid redundancy within session
- FR-5: Budget Allocation — compute category split by budget, duration, destination cost index
- FR-6: Accommodation Matching — search Vector Store, scored comparison, zero hallucinated entities
- FR-7: Multi-City Routing Optimization — optimized visit order with transport options and costs
- FR-8: Seasonal Price Analysis — compare pricing across flexible date window, flag peaks
- FR-9: Travel Insurance Estimation — coverage needs based on profile, premium range
- FR-10: Day-by-Day Itinerary Generation — time blocks, venues traced to Vector Store entities
- FR-11: Accommodation Comparison Table — min 3 options, source links, freshness timestamps
- FR-12: Budget Breakdown — categorized costs, flag if over budget
- FR-13: Booking Action Items — prioritized by time-sensitivity with reasoning
- FR-14: Proposal Export — PDF and shareable link
- FR-15: Visa Requirement Validation — by nationality, Phu Quoc special case
- FR-16: Health & Vaccination Advisory — required/recommended vaccinations
- FR-17: Travel Advisory Check — block "Do Not Travel", warn lower levels
- FR-18: Age Restriction Validation — activities vs traveler ages, suggest alternatives
- FR-19: Seasonal Feasibility Check — regional monsoon data, per-region validation
- FR-20: Budget Feasibility Validation — flag >10% over, cost-reduction suggestions
- FR-21: Accessibility Validation — hotels/activities vs mobility needs
- FR-22: Passport Validity Check — 6-month rule
- FR-23: Compliance Gate — block critical, warn non-critical, agent override with log
- FR-24: Real-Time Sidebar — SSE streaming, <5s latency, stage visibility
- FR-25: Advisory Session Management — create, resume, archive
- FR-26: Client History — search past sessions, reference previous profiles
- FR-27: Conversational Trip Planning — chat UI, full 4-stage workflow
- FR-28: No Authentication Required — session-based, IP rate limiting
- FR-29: Entity Ingestion Pipeline — metadata, deduplication, logging
- FR-30: Hybrid Search — keyword + semantic, configurable weighting
- FR-31: Freshness Tracking — timestamps, staleness threshold, exclude/warn stale
- FR-32: Regulatory Data Ingestion — visa, health, advisory structured + searchable

### NonFunctional Requirements

- NFR-1: Zero hallucination — all Entities in Proposals must exist in Vector Store with verifiable source
- NFR-2: Observability — all agent invocations, RAG retrievals, compliance checks emit structured traces (OpenTelemetry)
- NFR-3: Multi-tenancy — logical isolation via tenant_id filtering across all data access
- NFR-4: Real-time — copilot sidebar streams agent outputs within 5 seconds
- NFR-5: Scalability — 10 concurrent Advisory Sessions via K8S HPA
- NFR-6: Data freshness — no expired Entity in Proposal without staleness warning
- NFR-7: Cost management — model tiering, caching, token budgeting per session
- NFR-8: Privacy — Traveler Profile data per-tenant, demo mode data ephemeral

### Additional Requirements

- AR-1: Clone Full Stack FastAPI Template, restructure to STravel project structure
- AR-2: Progressive infrastructure — Phase 1: FastAPI + PostgreSQL + Ollama. Phase 2: + Qdrant + Redis. Phase 3: + vLLM. Phase 4: + K8S
- AR-3: Two Docker Compose files — docker-compose.yml (minimal) and docker-compose.full.yml (all services)
- AR-4: Typed Protocol interfaces at all agent boundaries (VectorStoreProtocol, LLMServiceProtocol, etc.)
- AR-5: LangGraph state using Pydantic BaseModel AdvisoryState as shared agent state
- AR-6: Dual state management — LangGraph checkpointer for agent state + SQLModel for business data
- AR-7: SSE for streaming copilot sidebar, REST for client-to-server actions
- AR-8: JWT + OAuth2 for B2B auth with tenant-scoped tokens. No auth for B2C demo
- AR-9: Tenant context middleware — extract tenant_id from JWT, propagate to all queries
- AR-10: Ollama for dev, vLLM for prod — same OpenAI-compatible API contract
- AR-11: React + TypeScript frontend with useReducer for streaming, useStreamContext hook, components/shared/ for cross-surface primitives
- AR-12: Seed data — Vietnam hotel, attraction, restaurant, visa JSON files + seed_vector_store.py
- AR-13: E2E Testing with Playwright — test all user journeys after implementation. Order: B2C demo first, then B2B copilot, then compliance edge cases

### UX Design Requirements

No UX Design document found. UX requirements derived from PRD user journeys (UJ-1, UJ-2, UJ-3) and architecture decisions (split-screen copilot, chat demo, shared components).

### FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR-1 | Epic 1 | Start Advisory Session |
| FR-2 | Epic 1 | Dynamic Follow-Up Questions |
| FR-3 | Epic 1 | Traveler Profile Completion |
| FR-4 | Epic 1 | Profile Context Memory |
| FR-5 | Epic 3 | Budget Allocation |
| FR-6 | Epic 3 | Accommodation Matching |
| FR-7 | Epic 3 | Multi-City Routing Optimization |
| FR-8 | Epic 3 | Seasonal Price Analysis |
| FR-9 | Epic 3 | Travel Insurance Estimation |
| FR-10 | Epic 3 | Day-by-Day Itinerary Generation |
| FR-11 | Epic 3 | Accommodation Comparison Table |
| FR-12 | Epic 3 | Budget Breakdown |
| FR-13 | Epic 3 | Booking Action Items |
| FR-14 | Epic 3 | Proposal Export |
| FR-15 | Epic 4 | Visa Requirement Validation |
| FR-16 | Epic 4 | Health & Vaccination Advisory |
| FR-17 | Epic 4 | Travel Advisory Check |
| FR-18 | Epic 4 | Age Restriction Validation |
| FR-19 | Epic 4 | Seasonal Feasibility Check |
| FR-20 | Epic 4 | Budget Feasibility Validation |
| FR-21 | Epic 4 | Accessibility Validation |
| FR-22 | Epic 4 | Passport Validity Check |
| FR-23 | Epic 4 | Compliance Gate |
| FR-24 | Epic 1 | Real-Time Sidebar |
| FR-25 | Epic 1 | Advisory Session Management |
| FR-26 | Epic 5 | Client History |
| FR-27 | Epic 5 | Conversational Trip Planning |
| FR-28 | Epic 5 | No Authentication Required |
| FR-29 | Epic 2 | Entity Ingestion Pipeline |
| FR-30 | Epic 2 | Hybrid Search |
| FR-31 | Epic 2 | Freshness Tracking |
| FR-32 | Epic 2 | Regulatory Data Ingestion |

## Epic List

### Epic 1: Foundation & Traveler Profiling (8 stories)
A travel agent can start an advisory session, profile a traveler through dynamic AI-guided conversation, and see real-time agent outputs in a copilot sidebar. Wow moment at Story 1.4.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-24, FR-25
**ARs covered:** AR-1 to AR-11
**NFRs covered:** NFR-2 (basic), NFR-3, NFR-4, NFR-8
**Phase:** 1

### Epic 2: Travel Data Intelligence (7 stories)
The system has searchable Vietnam travel data — hotels, attractions, restaurants, and regulatory information — with freshness tracking and hybrid search. Includes vLLM setup (moved from Epic 3).
**FRs covered:** FR-29, FR-30, FR-31, FR-32
**ARs covered:** AR-10, AR-12
**NFRs covered:** NFR-6
**Phase:** 2

### Epic 3: Trip Planning & Proposal Generation (7 stories)
The system calculates optimal trip plans and generates complete, verified proposals with itineraries, accommodation comparisons, budget breakdowns, and booking actions — all grounded in real data. vLLM setup moved to Epic 2.
**FRs covered:** FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14
**NFRs covered:** NFR-1, NFR-7
**Phase:** 3

### Epic 4: Compliance & Safety Validation
Before any proposal reaches a client, the system validates visa requirements, health advisories, travel warnings, age restrictions, seasonal feasibility, budget, accessibility, and passport validity — blocking unsafe recommendations.
**FRs covered:** FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23
**Phase:** 4

### Epic 5: Consumer Demo & Client History
Direct consumers can plan Vietnam trips through a chat interface without login. Travel agents can search past advisory sessions and reference previous client profiles.
**FRs covered:** FR-26, FR-27, FR-28
**Phase:** After Epic 1 (demo), after Epic 3 (history)

### Epic 6: Production Deployment & Quality Assurance
The system runs on production-grade infrastructure with auto-scaling, full observability, and comprehensive end-to-end test coverage.
**ARs covered:** AR-2 (Phase 4 K8S), AR-13 (Playwright E2E)
**NFRs covered:** NFR-2 (full), NFR-5
**Phase:** 4

---

<!-- PARTY MODE CHANGES APPLIED:
  Winston: Split Story 1.4 into orchestrator skeleton + profiling agent. Moved vLLM (was 3.8) to Epic 2.7.
  John: Reordered Epic 1 — wow moment (profiling agent) at Story 1.4 instead of Story 7. Auth/tenant moved after profiling works.
  Amelia: Added data-testid contracts, negative ACs to Epic 3/4, unit test callouts on calculation stories, traceability to 6.3.
  Total stories: 31 (was 30, +1 from 1.4 split)
-->

## Epic 1: Foundation & Traveler Profiling

A travel agent can start an advisory session, profile a traveler through dynamic AI-guided conversation, and see real-time agent outputs in a copilot sidebar. Reordered to deliver the "wow moment" (AI profiling) by Story 1.4.

### Story 1.1: Project Setup & Infrastructure Foundation

As a developer,
I want the STravel project scaffolded with Docker Compose, CI/CD, and core module structure,
So that I have a working development environment to build features on.

**Acceptance Criteria:**

**Given** the Full Stack FastAPI Template is cloned
**When** the project is restructured to the STravel directory layout (backend/app/agents/, rag/, etl/, core/, models/, schemas/, api/v1/, services/, guardrails/, prompts/, evals/)
**Then** `docker compose up` starts FastAPI + PostgreSQL + Ollama successfully
**And** FastAPI serves a health endpoint at `/api/v1/health` returning `{"status": "ok"}`
**And** GitHub Actions CI runs linting (ruff) and pytest on PR
**And** `docker-compose.yml` contains only Phase 1 services (FastAPI, PostgreSQL, Ollama)
**And** `docker-compose.full.yml` exists as a placeholder for Phase 2+ services
**And** `pyproject.toml` includes dependencies: fastapi, sqlmodel, langchain, langgraph, structlog, opentelemetry-api
**And** `.env.example` documents all required environment variables

### Story 1.2: Database Models & Advisory Session API

As a developer,
I want database models and API endpoints for advisory sessions,
So that the Profiling Agent has a data layer to store traveler profiles.

**Acceptance Criteria:**

**Given** SQLModel models exist for `AdvisorySession` and `TravelerProfile`
**When** a session is created via `POST /api/v1/advisory_sessions`
**Then** the system creates a session with unique ID, status `IN_PROGRESS`, and empty `TravelerProfile`
**And** Alembic migration creates the `advisory_sessions` and `traveler_profiles` tables
**And** `GET /api/v1/advisory_sessions/{session_id}` returns session details with traveler profile
**And** `PATCH /api/v1/advisory_sessions/{session_id}` can update session status
**And** `core/exceptions.py` provides `AppError` with consistent error format
**And** all requests emit structured JSON logs via `structlog`
**And** OpenTelemetry middleware creates a trace span for every request

### Story 1.3: LangGraph Orchestrator Skeleton

As a developer,
I want a LangGraph StateGraph with stub nodes for all 4 workflow stages,
So that the agent pipeline infrastructure is proven before implementing agent logic.

**Acceptance Criteria:**

**Given** `agents/state.py` defines `AdvisoryState` as Pydantic BaseModel with `session_id`, `tenant_id`, `stage`, `traveler_profile`, `errors`
**And** `agents/protocols.py` defines `LLMServiceProtocol` and `VectorStoreProtocol`
**When** `agents/orchestrator.py` defines a LangGraph `StateGraph`
**Then** the graph has nodes: profiling (active), calculation (stub), proposal (stub), compliance (stub)
**And** the graph transitions correctly from profiling → calculation → proposal → compliance
**And** `services/llm.py` implements `LLMServiceProtocol` using Ollama with OpenAI-compatible API
**And** LangGraph checkpointer stores agent state in PostgreSQL
**And** a test can invoke the graph and verify it reaches each stub node in sequence
**And** unit tests pass with PostgreSQL only — no Qdrant or Redis required

### Story 1.4: Profiling Agent — Dynamic Fact-Finding

As a travel agent,
I want an AI agent to guide structured fact-finding by asking dynamic follow-up questions based on my client's responses,
So that I build a complete traveler profile without missing critical details.

**Acceptance Criteria:**

**Given** the LangGraph orchestrator from Story 1.3 is running
**When** an advisory session is started and the Profiling Agent is invoked via `agents/profiling/agent.py`
**Then** the agent asks Round 1 questions (who, when, budget, destination preference)
**And** when a response contains "family with kids", the agent asks child ages, school constraints, kid-friendly priorities
**And** when a response contains "dietary needs", the agent asks specific type and strictness
**And** when a response contains "mobility issues", the agent asks wheelchair access, walking tolerance, elevator needs
**And** when a response contains "adventure", the agent asks fitness level, risk tolerance
**And** at least 8 distinct context triggers produce relevant follow-up branches
**And** the agent never re-asks a question already answered in the session (FR-4)
**And** the agent never makes assumptions about unstated preferences
**And** `agents/profiling/prompts.py` contains system prompts and follow-up templates
**And** unit tests verify each context trigger produces the expected follow-up branch

### Story 1.5: Traveler Profile Completion & Confirmation

As a travel agent,
I want to see a summary of the collected traveler profile and confirm it before proceeding,
So that I can verify all details are correct and complete.

**Acceptance Criteria:**

**Given** the Profiling Agent has collected responses from a traveler
**When** minimum required fields are present (traveler count, travel dates or flexibility, budget range, at least one destination preference)
**Then** the agent signals profile completion and presents a structured profile summary
**And** the summary includes all collected data organized by category (demographics, dates, budget, preferences, constraints)
**And** the travel agent can edit any profile field via `PATCH /api/v1/traveler_profiles/{profile_id}`
**And** the travel agent confirms the profile to proceed to the next workflow stage
**And** if minimum fields are missing, the agent indicates which fields still need answers

### Story 1.6: Auth, Tenant & Multi-tenancy

As a travel agent,
I want to authenticate with my agency credentials and have my data isolated from other agencies,
So that my client information is secure and private.

**Acceptance Criteria:**

**Given** `core/auth.py` implements JWT + OAuth2 and `core/tenant.py` implements tenant middleware
**When** a travel agent sends a login request to `/api/v1/auth/login` with valid credentials
**Then** the system returns a JWT token containing `tenant_id` claim
**And** tenant context middleware extracts `tenant_id` from the JWT on every subsequent request
**And** `get_tenant_id()` is available via `contextvars` for all downstream code
**And** all advisory session queries filter by `tenant_id` — Tenant A cannot see Tenant B's sessions
**And** requests without valid JWT to B2B endpoints return 401 Unauthorized
**And** SQLModel `Tenant` model is created with Alembic migration
**And** existing session endpoints are updated to enforce tenant isolation

### Story 1.7: SSE Streaming Endpoint

As a travel agent,
I want to see AI agent outputs appear in real time as the advisory session progresses,
So that I can follow along without waiting for the entire process to finish.

**Acceptance Criteria:**

**Given** `api/v1/streaming.py` implements an SSE endpoint at `GET /api/v1/stream/{session_id}`
**When** the Profiling Agent generates a question or the workflow stage changes
**Then** an SSE event is emitted with format `event: agent.profiling.question\ndata: {"type": "question", "content": "...", "context": "..."}`
**And** stage changes emit `event: stage.change\ndata: {"stage": "profiling"}`
**And** errors emit `event: agent.error\ndata: {"agent": "profiling", "message": "..."}`
**And** events arrive at the frontend within 5 seconds of agent completion
**And** the SSE connection handles client reconnection gracefully
**And** a simple test HTML page can connect to the SSE endpoint and display events (dev verification)

### Story 1.8: React Copilot Sidebar & Profile Form

As a travel agent,
I want a split-screen web interface with a client data panel on the left and AI copilot sidebar on the right,
So that I can enter client information while seeing AI suggestions in real time.

**Acceptance Criteria:**

**Given** the React frontend is set up with TypeScript and Vite
**When** a travel agent logs in and opens an advisory session
**Then** a split-screen layout renders with `SessionPanel` on the left and `CopilotSidebar` on the right
**And** the `CopilotSidebar` connects to the SSE endpoint and displays streaming messages using `useReducer` (not `useState`)
**And** `useStreamContext` hook manages the SSE connection and distinguishes message types
**And** `StreamMessage`, `TypingIndicator`, and `MessageBubble` components exist in `components/shared/` with `data-testid` attributes for E2E testing
**And** `ProfileForm` in `components/b2b/` allows entering and editing traveler profile data
**And** `SessionList` in `components/b2b/` shows all sessions for the agent with create/resume/archive actions
**And** the sidebar shows which workflow stage is active (profiling / calculating / proposing / validating)
**And** the frontend uses auto-generated TypeScript types from the FastAPI OpenAPI schema
**And** all interactive components have `data-testid` attributes for Playwright

---

## Epic 2: Travel Data Intelligence

The system has searchable Vietnam travel data — hotels, attractions, restaurants, and regulatory information — with freshness tracking and hybrid search.

### Story 2.1: Qdrant Vector Store Setup & Entity Model

As a developer,
I want a Vector Store service with typed Protocol interface connected to Qdrant,
So that agents can search travel entities through a clean, testable abstraction.

**Acceptance Criteria:**

**Given** `docker-compose.full.yml` includes a Qdrant service
**When** `docker compose -f docker-compose.full.yml up` is run
**Then** Qdrant starts and is accessible on its configured port
**And** `rag/vector_store.py` implements `VectorStoreProtocol` with `search()` and `get_by_id()` methods
**And** the SQLModel `Entity` model in `models/entity.py` stores metadata (name, type, location, region, description, pricing, rating, source_url, ingested_at, expires_at)
**And** `rag/embeddings.py` wraps an embedding model for generating vector representations
**And** unit tests in `rag/tests/` pass with a mock Vector Store (no Qdrant required)

### Story 2.2: Entity Ingestion Pipeline

As a system operator,
I want automated ETL pipelines that ingest hotel, attraction, and restaurant data into the Vector Store,
So that the system has verified travel entities to recommend.

**Acceptance Criteria:**

**Given** `etl/pipeline.py` defines a base pipeline class with `extract()`, `transform()`, `load()` methods
**When** `etl/hotels.py` runs against a data source (JSON file or API)
**Then** hotel entities are ingested with: name, type="hotel", location (lat/long + region), description, pricing, rating, source_url, ingested_at timestamp
**And** `etl/deduplication.py` prevents the same real-world entity from being indexed twice (matching on name + location)
**And** `etl/attractions.py` and `etl/restaurants.py` follow the same pipeline pattern
**And** ingestion logs record success/failure counts per run
**And** each ingested entity has an `expires_at` timestamp (default: 7 days for prices, 30 days for descriptions)

### Story 2.3: Hybrid Search

As a travel agent (via the system),
I want to search for travel entities using both exact names and natural language descriptions,
So that the system finds relevant results whether I search "Rex Hotel Saigon" or "quiet beach resort with pool under $100."

**Acceptance Criteria:**

**Given** `rag/hybrid_search.py` implements combined keyword and semantic search
**When** a keyword search for "Rex Hotel Saigon" is executed
**Then** the exact match is returned as the top result
**When** a semantic search for "quiet beach resort with pool under $100 in Phu Quoc" is executed
**Then** relevant entities ranked by semantic similarity + metadata filters are returned
**And** hybrid mode merges keyword and semantic results with configurable weighting
**And** results can be filtered by metadata: region, type, price range, rating
**And** search returns within 2 seconds for the seed dataset

### Story 2.4: Freshness Tracking & Staleness Warnings

As a system,
I want to track how fresh each entity's data is and flag stale entries,
So that proposals never present outdated prices or closed venues without warning.

**Acceptance Criteria:**

**Given** `rag/freshness.py` implements freshness checking logic
**When** an entity's `ingested_at` is older than its staleness threshold (7 days for prices, 30 days for descriptions)
**Then** the entity is flagged as stale
**And** stale entities are excluded from Proposal generation by default
**And** if included (fallback), a staleness warning is attached to the entity
**And** `services/cache.py` implements `CacheProtocol` backed by Redis with TTL aligned to freshness thresholds
**And** popular search queries are cached in Redis to reduce Qdrant load

### Story 2.5: Regulatory Data Ingestion

As a system,
I want visa rules, health advisories, and travel warnings stored in structured, searchable format,
So that the Compliance Agent can validate proposals against current regulations.

**Acceptance Criteria:**

**Given** `etl/regulatory.py` ingests regulatory data from JSON source files
**When** visa rules are ingested from `data/seed/visa_rules.json`
**Then** rules are stored per nationality with: visa type, duration, cost, processing time, entry points
**And** the Phu Quoc special case (30-day visa-free only on island) is correctly represented
**And** health advisories and travel warnings are stored with source URL and last-verified date
**And** regulatory data supports both keyword lookup (country code) and semantic search (regulation interpretation)
**And** `agents/compliance/rules/` JSON files are populated with Vietnam-specific data

### Story 2.6: Vietnam Seed Data Loading

As a developer,
I want a seed data script that populates the Vector Store with Vietnam travel data,
So that the system has real entities to work with during development and testing.

**Acceptance Criteria:**

**Given** `data/seed/` contains JSON files for hotels, attractions, restaurants across Vietnam destinations (Hanoi, HCMC, Da Nang, Phu Quoc, Sapa, Hoi An, Hue, Nha Trang, Da Lat, Mekong Delta)
**When** `python data/scripts/seed_vector_store.py` is run
**Then** all seed entities are ingested into Qdrant with embeddings and metadata
**And** at least 10 hotels, 10 attractions, and 10 restaurants per major destination are seeded
**And** visa rules for at least 20 nationalities are loaded
**And** regional monsoon pattern data is loaded
**And** the script is idempotent (running twice does not create duplicates)

### Story 2.7: vLLM Serving Setup

As a developer,
I want to swap from Ollama to vLLM for production-quality inference with Qwen 3.x,
So that I can fine-tune the model and optimize inference costs in Phase 3.

**Acceptance Criteria:**

**Given** `docker-compose.full.yml` includes a vLLM service with `vllm/vllm-openai:latest` image
**When** vLLM is started with `--model Qwen/Qwen3-...`
**Then** the service exposes an OpenAI-compatible API on its configured port
**And** `services/llm.py` switches from Ollama to vLLM via environment variable (same `LLMServiceProtocol` interface)
**And** no agent code changes are required for the swap (transparent via Protocol)
**And** token usage is logged per request for cost tracking
**And** `infra/vllm/serve.sh` documents the serving command with recommended parameters
**And** unit tests verify `LLMServiceProtocol` works with both Ollama and vLLM backends

---

## Epic 3: Trip Planning & Proposal Generation

The system calculates optimal trip plans and generates complete, verified proposals with itineraries, accommodation comparisons, budget breakdowns, and booking actions — all grounded in real data.

### Story 3.1: Budget Allocation Agent

As a travel agent,
I want the system to compute a recommended budget split across categories based on my client's total budget and trip parameters,
So that I can show clients how their money will be distributed.

**Acceptance Criteria:**

**Given** a completed Traveler Profile with total budget, trip duration, and destination preferences
**When** the Calculation Agent runs budget allocation
**Then** the system returns percentage splits for: flights, accommodation, activities, food, local transport, insurance, buffer
**And** allocation adjusts based on destination cost index (e.g., Phu Quoc resort area vs Hanoi budget district)
**And** total allocation equals the stated budget (no rounding drift)
**And** `agents/calculation/budget.py` contains the allocation logic
**And** results are written to `AdvisoryState.calculations`
**And** unit tests cover: zero budget, extremely high budget, single-day trip, 30-day trip, all-inclusive resort vs backpacker allocation differences

### Story 3.2: Accommodation Matching Agent

As a travel agent,
I want the system to search for and score accommodations that match my client's profile,
So that I can present a curated list of options with clear reasoning.

**Acceptance Criteria:**

**Given** a completed Traveler Profile with budget per night, location, style, group size, and accessibility needs
**When** the Calculation Agent runs accommodation matching via `agents/calculation/accommodation.py`
**Then** the system searches the Vector Store for matching hotel entities
**And** results are filtered by budget, location, style, group size, and accessibility attributes
**And** each result includes: name, location, price/night, rating, source link, freshness timestamp, and "why it fits" explanation
**And** results are ranked by price-to-value ratio
**And** zero results are returned that do not exist as entities in the Vector Store
**And** if no matches found within budget, the system returns the closest options with a budget warning
**And** if Vector Store returns zero results for the region, the system returns an empty list with explanation (not a hallucinated list)
**And** unit tests cover: exact budget match, over-budget filtering, zero results, accessibility filtering, group size filtering

### Story 3.3: Multi-City Routing & Seasonal Pricing

As a travel agent,
I want the system to optimize multi-city Vietnam itineraries and show pricing across date ranges,
So that my clients get efficient routes and the best value dates.

**Acceptance Criteria:**

**Given** a Traveler Profile with multiple Vietnam destinations and date constraints
**When** `agents/calculation/routing.py` runs routing optimization
**Then** the system returns an optimized visit sequence with transport options (flight, train, bus) and estimated costs between legs
**And** the system accounts for real transit options (e.g., no direct flight Sapa→Phu Quoc, requires Hanoi connection)
**And** if only one destination, routing optimization is skipped gracefully
**When** `agents/calculation/pricing.py` runs seasonal price analysis on a flexible date window
**Then** the system returns a price comparison showing relative cost by week
**And** peak seasons (Tet holiday, Christmas) and shoulder seasons are flagged with price differentials

### Story 3.4: Travel Insurance Estimation

As a travel agent,
I want the system to estimate travel insurance needs based on the client's profile and planned activities,
So that I can flag coverage gaps before the client books.

**Acceptance Criteria:**

**Given** a Traveler Profile with age, destination, duration, and planned activities
**When** `agents/calculation/insurance.py` runs insurance estimation
**Then** high-risk activities (scuba diving, motorbike riding, trekking) are flagged as requiring additional coverage
**And** an estimated premium range is returned based on reference data
**And** results are written to `AdvisoryState.calculations`

### Story 3.5: Proposal Agent — Itinerary Generation

As a travel agent,
I want the system to generate a day-by-day itinerary grounded in verified venue data,
So that my client receives a specific, actionable trip plan they can follow.

**Acceptance Criteria:**

**Given** a completed Traveler Profile and Calculation results in `AdvisoryState`
**When** the Proposal Agent runs via `agents/proposal/agent.py`
**Then** a day-by-day itinerary is generated with morning, afternoon, and evening activities
**And** every venue name (hotel, restaurant, attraction) traces to an entity in the Vector Store
**And** transport between venues includes method (taxi, walk, Grab) and estimated time
**And** restaurant suggestions respect dietary requirements from the Traveler Profile
**And** bad weather alternatives are included for outdoor activities
**And** `guardrails/entity_validator.py` validates all entity references before the proposal is finalized
**And** if an entity reference fails validation, the Proposal Agent replaces it with a verified alternative
**And** if Vector Store has insufficient entities for a destination, the proposal indicates limited data rather than hallucinating venues

### Story 3.6: Proposal — Comparison Table, Budget & Actions

As a travel agent,
I want the proposal to include accommodation comparisons, a budget breakdown, and prioritized booking actions,
So that my client has all the information needed to make decisions and book.

**Acceptance Criteria:**

**Given** the Proposal Agent has generated an itinerary
**When** additional proposal sections are generated
**Then** an accommodation comparison table includes min 3 options per destination with: name, location, price/night, rating, amenities, "why it fits" — all with source links and freshness timestamps
**And** a categorized budget breakdown shows: flights, accommodation, activities, food, transport, insurance, buffer — with line items
**And** total matches or falls within stated budget (with explicit flag if >10% over)
**And** booking action items are prioritized by time-sensitivity with reasoning (e.g., "Book flights first — prices volatile")
**And** `guardrails/price_validator.py` ensures no prices are LLM-generated — all from Vector Store entities

### Story 3.7: Proposal Export — PDF & Shareable Link

As a travel agent,
I want to export the proposal as a PDF or generate a shareable link,
So that I can send a professional document to my client.

**Acceptance Criteria:**

**Given** a completed Proposal in `AdvisoryState`
**When** the agent requests export via `POST /api/v1/proposals/{proposal_id}/export`
**Then** a PDF is generated preserving formatting, tables, and budget charts
**And** `POST /api/v1/proposals/{proposal_id}/share` generates a read-only shareable link
**And** the shareable link does not require authentication to view
**And** `agents/proposal/export.py` handles PDF generation
**And** proposals are stored in the database linked to their advisory session

---

## Epic 4: Compliance & Safety Validation

Before any proposal reaches a client, the system validates visa requirements, health advisories, travel warnings, age restrictions, seasonal feasibility, budget, accessibility, and passport validity — blocking unsafe recommendations.

### Story 4.1: Visa & Document Compliance Checks

As a travel agent,
I want the system to validate visa requirements and passport validity for my client's nationality,
So that my client is not stranded at a border or denied entry.

**Acceptance Criteria:**

**Given** a Traveler Profile with nationality and passport expiry date
**When** the Compliance Agent runs visa checks via `agents/compliance/visa.py`
**Then** the system correctly identifies: visa-free (45-day), visa-free (30-day ASEAN), e-visa required, or embassy visa required
**And** the Phu Quoc special case is handled (30-day visa-free only if staying exclusively on island — if combined with mainland, e-visa required)
**And** the result includes: visa type, cost, processing time, application link, deadline relative to travel dates
**And** if nationality is not found in the rules database, the system returns "manual verification required" (not a guess)
**When** `agents/compliance/passport.py` checks passport validity
**Then** the system flags if passport expires within 6 months of departure with renewal urgency
**And** if passport expiry date is not provided, the system warns "passport validity not verified"

### Story 4.2: Health, Travel Advisory & Age Restriction Checks

As a travel agent,
I want the system to check health requirements, government travel warnings, and age restrictions for planned activities,
So that my client's safety is protected and unsuitable activities are flagged.

**Acceptance Criteria:**

**Given** a Traveler Profile with destination, travel dates, and traveler ages
**When** `agents/compliance/health.py` checks health requirements
**Then** required and recommended vaccinations are flagged with health authority links
**When** `agents/compliance/travel_advisory.py` checks government warnings
**Then** "Do Not Travel" advisories block the destination from the Proposal
**And** lower-level advisories are surfaced as warnings (not blocks)
**When** `agents/compliance/age_restrictions.py` checks activities against traveler ages
**Then** activities with minimum age requirements (e.g., scuba min 10, motorbike min 18) are validated
**And** non-compliant activities are removed and alternatives suggested

### Story 4.3: Seasonal, Budget & Accessibility Checks

As a travel agent,
I want the system to validate seasonal suitability, budget feasibility, and accessibility for my client's trip,
So that my client doesn't travel during monsoon season, exceed their budget, or encounter inaccessible venues.

**Acceptance Criteria:**

**Given** a Traveler Profile with dates, budget, and accessibility needs
**When** `agents/compliance/seasonal.py` checks destination suitability
**Then** each destination's region (North/Central/South) is checked against monsoon patterns
**And** destinations planned during monsoon season are flagged with severity and alternatives
**And** Vietnam's staggered monsoon is handled correctly (North May-Oct, Central Sep-Jan, South May-Oct)
**When** `agents/compliance/budget_check.py` validates total cost
**Then** costs exceeding budget by >10% are flagged with cost-reduction suggestions prioritized by impact
**When** `agents/compliance/accessibility.py` validates accommodations and activities
**Then** items not meeting stated mobility requirements are flagged with accessible alternatives

### Story 4.4: Compliance Gate & Agent Override

As a travel agent,
I want the Compliance Agent to block proposal delivery when critical issues exist, while allowing me to override non-critical warnings,
So that unsafe proposals never reach clients but I retain professional judgment on warnings.

**Acceptance Criteria:**

**Given** all compliance checks have run and produced a `ComplianceReport`
**When** critical issues exist (visa block, "Do Not Travel", age restriction violation)
**Then** the Compliance Gate prevents proposal export until issues are resolved
**And** the Compliance Report shows pass/fail/warning for each check with resolution guidance
**When** only non-critical warnings exist (seasonal, budget, health advisory)
**Then** warnings are surfaced but do not block proposal delivery
**And** the travel agent can override warnings via `POST /api/v1/compliance_reports/{id}/override`
**And** overrides are logged with agent ID, timestamp, and acknowledgment
**And** the compliance status is visible in the copilot sidebar as pass (green), warning (yellow), or block (red)
**And** the `agents/orchestrator.py` is updated to include the compliance node as the final stage before proposal delivery

---

## Epic 5: Consumer Demo & Client History

Direct consumers can plan Vietnam trips through a chat interface without login. Travel agents can search past advisory sessions and reference previous client profiles.

### Story 5.1: B2C Demo Chat Interface

As a consumer,
I want to plan a Vietnam trip through a conversational chat interface without creating an account,
So that I can experience the advisory workflow quickly and easily.

**Acceptance Criteria:**

**Given** the B2C demo page at `/demo`
**When** a consumer starts a new trip planning session
**Then** no login or account creation is required
**And** the chat interface guides fact-finding through natural conversation (not a form)
**And** calculations, proposal, and compliance run automatically after profile completion
**And** the consumer sees the Proposal inline in the chat with an export option
**And** `api/v1/demo.py` handles B2C requests without JWT authentication
**And** session state persists for the browser session but is not saved long-term
**And** IP-based rate limiting prevents abuse (configurable max sessions per IP per hour)
**And** `components/b2c/DemoLayout.tsx`, `ChatInterface.tsx`, `ProposalInline.tsx`, and `ExportButton.tsx` are implemented
**And** shared components (`StreamMessage`, `TypingIndicator`, `MessageBubble`) are reused from `components/shared/`

### Story 5.2: Client History Search & Profile Reference

As a travel agent,
I want to search past advisory sessions and reference previous client profiles when starting new sessions,
So that returning clients don't have to repeat their information.

**Acceptance Criteria:**

**Given** a travel agent has completed advisory sessions in the past
**When** the agent searches client history via `GET /api/v1/advisory_sessions?search=...`
**Then** sessions are searchable by client name, destination, and date
**And** results are scoped to the agent's tenant (tenant_id filtering)
**When** the agent starts a new session and references a previous client
**Then** the previous Traveler Profile is pre-populated into the new session
**And** the agent can modify any pre-populated field before confirming
**And** `components/b2b/ClientHistory.tsx` provides the search UI

---

## Epic 6: Production Deployment & Quality Assurance

The system runs on production-grade infrastructure with auto-scaling, full observability, and comprehensive end-to-end test coverage.

### Story 6.1: Kubernetes Deployment

As a system operator,
I want the system deployed on Kubernetes with auto-scaling,
So that the platform handles concurrent users and scales with demand.

**Acceptance Criteria:**

**Given** K8S manifests exist in `infra/k8s/`
**When** the manifests are applied to a cluster
**Then** all services deploy: backend, frontend, PostgreSQL, Qdrant, Redis, vLLM
**And** backend pods have a Horizontal Pod Autoscaler scaling on CPU/memory
**And** vLLM pods scale independently from API pods (GPU node selector)
**And** PostgreSQL and Qdrant use StatefulSets with persistent volumes
**And** ConfigMaps store non-sensitive configuration
**And** Secrets store database passwords, JWT secret, API keys
**And** an Ingress routes external traffic to frontend and API
**And** liveness and readiness probes are configured for all services

### Story 6.2: Full Observability Stack

As a system operator,
I want dashboards showing system health, agent performance, and data freshness,
So that I can monitor the system and detect issues before users are affected.

**Acceptance Criteria:**

**Given** Prometheus, Grafana, and OpenTelemetry Collector are deployed
**When** the system is running under load
**Then** Prometheus scrapes metrics: request latency, agent execution time, cache hit rate, token usage, Entity freshness distribution
**And** Grafana dashboards display: system health overview, agent performance per type, data freshness status, error rates
**And** `infra/k8s/monitoring/` contains Prometheus config and Grafana dashboard JSON files
**And** OpenTelemetry traces are queryable — showing the full lifecycle of an advisory session across all agents
**And** alerts fire when: error rate >5%, agent latency >10s, stale entity count >20%

### Story 6.3: Playwright E2E Tests

As a developer,
I want comprehensive end-to-end tests covering all user journeys,
So that I can verify the full system works correctly before releases.

**Acceptance Criteria:**

**Given** Playwright is installed and configured for the frontend
**And** all interactive UI components have `data-testid` attributes (from Story 1.8)
**When** E2E tests are run against the full system (all services up)
**Then** the following test suites pass in order:

**Suite 1 — B2C Demo Flow (UJ-2):**
**Given** a consumer opens the demo page
**When** they complete fact-finding (solo backpacker, 3 weeks, Vietnam, $1500 budget)
**Then** a proposal is generated with itinerary, accommodations, and budget
**And** compliance warnings appear (e-visa required for test nationality)
**And** the proposal can be exported as PDF

**Suite 2 — B2B Copilot Flow (UJ-1):**
**Given** a travel agent logs in with valid credentials
**When** they create an advisory session for a German family of 4 visiting Vietnam in December
**Then** the Profiling Agent asks dynamic follow-ups (kids ages, school constraints)
**And** the copilot sidebar streams calculation results in real time
**And** a proposal is generated with verified hotel and activity entities
**And** the compliance check passes (German = 45-day visa-free)
**And** the proposal exports as PDF

**Suite 3 — Compliance Edge Cases (UJ-3):**
**Given** a travel agent creates a session for a Russian client visiting Phu Quoc + HCMC
**When** compliance checks run
**Then** the Phu Quoc visa trap is caught (e-visa required for combined itinerary)
**And** the compliance gate blocks the proposal until resolved
**And** after resolution, the proposal exports successfully

**Traceability:**
| E2E Suite | Stories Covered |
|---|---|
| Suite 1 (B2C Demo) | 5.1, 1.4, 3.5, 3.7, 4.1 |
| Suite 2 (B2B Copilot) | 1.4, 1.7, 1.8, 3.2, 3.5, 3.6, 3.7, 4.1 |
| Suite 3 (Compliance Edge) | 4.1, 4.4 |
