---
title: "PRD — STravel: AI Travel Advisory Platform"
status: draft
created: 2026-05-24
updated: 2026-05-24
---

# PRD: STravel

## 0. Document Purpose

This PRD defines the MVP requirements for STravel, an AI-powered travel advisory platform for Vietnam. It is written for downstream architecture, epic/story creation, and implementation workflows. This PRD builds on the product brief and addendum at `_bmad-output/planning-artifacts/briefs/brief-AIFU-2026-05-24/`. STravel is a learning project — commercial viability is a design constraint, not a launch target. Requirements are written as if this were a real SaaS product to ensure authentic architectural decisions.

## 1. Vision

STravel turns unstructured trip planning into a structured, multi-agent advisory workflow. Instead of a chatbot that generates generic itineraries, STravel orchestrates specialized AI agents through four stages — traveler profiling, plan calculation, proposal generation, and compliance validation — to produce verified, actionable trip proposals for Vietnam travel.

The platform serves travel agents as a real-time copilot: while the agent converses with a client, STravel surfaces relevant suggestions, runs calculations, drafts proposals, and flags compliance issues in a sidebar. A secondary B2C demo mode allows direct consumers to plan trips through a self-serve interface.

Every architectural decision serves a dual mandate: it must be justified as a real SaaS need AND must teach a core AI/ML engineering concept (multi-agent orchestration, RAG, fine-tuning, MLOps, observability, and 8 others documented in the brief addendum).

## 2. Target User

### 2.1 Primary Persona

**Linh — Vietnam Inbound Travel Agent.** Works at a boutique agency in Ho Chi Minh City handling international tourists visiting Vietnam. Manages multiple client inquiries per week. Knows Vietnam destinations well but spends hours per client on repetitive research (visa rules by nationality, seasonal suitability, price comparison) and manual proposal assembly in Word/Google Docs. Wants to spend time on client relationships, not data lookup.

### 2.2 Jobs To Be Done

- **Functional:** Produce a complete, accurate Vietnam trip proposal in minutes instead of hours.
- **Functional:** Catch visa, health, and seasonal compliance issues before the client sees a proposal.
- **Functional:** Compare accommodation and flight options with current pricing data, not stale memory.
- **Emotional:** Feel confident that every recommendation is verified and defensible.
- **Contextual:** Handle diverse client profiles (solo backpacker, luxury couple, family with kids, elderly group) without starting from scratch each time.
- **Builder (Fred):** Learn and implement all 13 AI/ML engineering concepts through a real product.

### 2.3 Non-Users (v1)

- Corporate travel managers (different workflow, policy engine complexity)
- Travel agents outside Vietnam inbound tourism
- Travelers who want to book directly (no booking integration in v1)

### 2.4 Key User Journeys

**UJ-1. Linh runs a new client advisory session with STravel as copilot.**
- **Persona + context:** Linh receives an inquiry from a German family of 4 wanting 10 days in Vietnam during Christmas.
- **Entry state:** Authenticated in STravel web app, copilot sidebar open.
- **Path:**
  1. Linh starts a new Advisory Session. The Profiling Agent presents structured fact-finding questions.
  2. Linh enters client details (or the client fills a shared form). The system detects "family with kids" and dynamically asks ages, school constraints, kid-friendly activity preferences.
  3. Linh enters travel dates (Dec 20-30). The system flags: North Vietnam is cold in December, Central Vietnam has heavy rain — recommends South-focused itinerary.
  4. Fact-finding completes. Linh triggers "Generate Proposal." Calculation agents run budget allocation, accommodation matching, and routing optimization.
  5. The Compliance Agent validates: German passport = 45-day visa-free (ok), checks age restrictions on planned activities, validates seasonal suitability per region, checks passport validity requirement.
  6. The Proposal Agent generates a day-by-day itinerary grounded in verified hotel/activity data, with comparison tables and budget breakdown.
  7. Linh reviews, makes minor adjustments, and exports as PDF for the client.
- **Climax:** Linh has a complete, compliance-checked proposal in under 10 minutes instead of 3 hours.
- **Resolution:** Proposal saved to client history. Linh moves to next client.
- **Edge case:** Compliance Agent detects a planned scuba diving activity but youngest child is 6 (minimum age 10). System blocks the activity and suggests snorkeling alternative.

**UJ-2. A direct consumer plans a Vietnam trip in demo mode.**
- **Persona + context:** Alex, an Australian backpacker, wants to plan a 3-week Vietnam trip on a budget.
- **Entry state:** Unauthenticated, lands on STravel public demo page.
- **Path:**
  1. Alex starts a new trip. The Profiling Agent asks structured questions in a conversational chat interface.
  2. Alex provides: solo traveler, 21 days, $1500 total budget, interests in food + culture + motorbike riding, flexible on dates.
  3. System calculates budget allocation ($70/day), matches hostels and budget hotels, optimizes a north-to-south route.
  4. Compliance checks: Australian passport = 90-day e-visa required ($25), no vaccinations strictly required but hepatitis A recommended, motorbike activities flagged for insurance coverage.
  5. Proposal generated with day-by-day itinerary, hostel options, street food recommendations, and a motorbike route advisory.
- **Climax:** Alex has a detailed, budget-aware itinerary with compliance warnings about e-visa and insurance.
- **Resolution:** Alex can download the proposal or share via link.

**UJ-3. Linh handles a compliance-blocked proposal.**
- **Persona + context:** Linh generates a proposal for a Russian client wanting to visit Phu Quoc + Ho Chi Minh City.
- **Entry state:** Proposal generation complete, compliance running.
- **Path:**
  1. Compliance Agent flags: Russian passport = 45-day visa-free, BUT Phu Quoc has a special 30-day visa-free rule only if staying exclusively on the island. Client wants to combine Phu Quoc + HCMC.
  2. System blocks the "visa-free for Phu Quoc" assumption and recommends: apply for e-visa ($25) to cover both destinations.
  3. Linh reviews the flag, confirms e-visa recommendation, and the proposal is updated with visa application instructions and timeline.
- **Climax:** A subtle visa trap that agents commonly miss is caught automatically.
- **Resolution:** Proposal updated with correct visa guidance. Compliance status turns green.

## 3. Glossary

- **Advisory Session** — A complete end-to-end workflow instance: fact-finding through proposal delivery for one client inquiry. Contains a Traveler Profile, one or more Calculations, a Proposal, and a Compliance Report.
- **Traveler Profile** — Structured data collected during fact-finding: traveler demographics, preferences, constraints, and requirements. One per Advisory Session.
- **Proposal** — The generated trip plan document: itinerary, accommodation comparisons, budget breakdown, and booking action items. Grounded in Entity data from the Vector Store.
- **Compliance Report** — The output of compliance validation: a list of checks run, pass/fail status, and flagged items with alternatives. Gates Proposal delivery.
- **Entity** — A real-world travel object indexed in the Vector Store: hotel, restaurant, attraction, or activity. Each Entity has a verified source and freshness timestamp.
- **Vector Store** — The vector database containing indexed Entities, reviews, destination guides, and regulatory documents. Supports hybrid search (keyword + semantic).
- **Copilot Sidebar** — The B2B interface: a real-time panel alongside the agent's client conversation showing AI suggestions, calculations, and compliance flags. [ASSUMPTION: Split-screen web layout — chat/form on left, AI sidebar on right.]
- **Profiling Agent** — The AI agent that runs fact-finding. Manages dynamic follow-up questions based on Traveler Profile context.
- **Calculation Agent** — Specialized agents that compute budget allocation, price comparisons, routing, and insurance estimates from live data.
- **Proposal Agent** — The AI agent that generates the Proposal document, grounding all content in Vector Store Entities.
- **Compliance Agent** — The AI agent that validates the Proposal against regulatory rules (visa, health, safety, accessibility). Can block Proposal delivery.
- **Data Pipeline** — Automated ETL processes that ingest travel data from external APIs into the Vector Store with freshness tracking.

## 4. Features

### 4.1 Fact-Finding (Traveler Profiling)

**Description:** The Profiling Agent conducts a structured, dynamic conversation to build a complete Traveler Profile. The conversation adapts follow-up questions based on previous answers — detecting family travel, adventure interest, dietary needs, mobility requirements, and budget level to ask relevant follow-ups. The agent never re-asks answered questions and never makes assumptions about unstated preferences. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-1: Start Advisory Session

Travel Agent (or Consumer in demo mode) can start a new Advisory Session, which initializes an empty Traveler Profile and launches the Profiling Agent.

**Consequences (testable):**
- System creates a new Advisory Session with unique ID and empty Traveler Profile.
- Profiling Agent presents the first round of fact-finding questions (who, when, budget, destination preference).

#### FR-2: Dynamic Follow-Up Questions

Profiling Agent can detect context triggers in traveler responses and present relevant follow-up questions.

**Consequences (testable):**
- "Family with kids" triggers: child ages, school holiday constraints, kid-friendly activity priority.
- "Dietary needs" triggers: specific type (vegan/halal/kosher/allergy), strictness level.
- "Mobility issues" triggers: wheelchair access, walking tolerance, elevator requirement.
- "Adventure interest" triggers: fitness level, risk tolerance, specific activities.
- "Flexible dates" triggers: price-date trade-off willingness, shoulder season acceptance.
- "Budget traveler" triggers: hostel tolerance, overnight transport, self-catering.
- "Luxury" triggers: private transfers, fine dining, premium accommodation.
- At least 8 context triggers with corresponding follow-up branches.

#### FR-3: Traveler Profile Completion

Profiling Agent can determine when the Traveler Profile has sufficient data to proceed to calculation and signal readiness.

**Consequences (testable):**
- System validates minimum required fields: traveler count, travel dates (or flexibility window), budget range, at least one destination preference or "open to suggestions."
- System presents a profile summary for agent/traveler confirmation before proceeding.
- Agent can edit any profile field before confirming.

#### FR-4: Profile Context Memory

Profiling Agent can track all previously answered questions within an Advisory Session and avoid redundant questions.

**Consequences (testable):**
- Agent does not re-ask a question whose answer is already in the Traveler Profile.
- If a traveler provides unsolicited information (e.g., mentions allergy mid-conversation), the agent incorporates it without re-asking.

**Feature-specific NFRs:**
- Fact-finding conversation must feel natural, not like a form. [ASSUMPTION: Achieved through prompt engineering, not a rigid decision tree.]

### 4.2 Calculation Engine

**Description:** Once the Traveler Profile is confirmed, Calculation Agents compute budget allocation, accommodation and flight comparisons, routing optimization, seasonal pricing analysis, and insurance estimation. All calculations use live data from the Data Pipeline — no prices, ratings, or availability are generated by the LLM. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-5: Budget Allocation

System can compute a recommended budget split across categories (flights, accommodation, activities, food, transport, insurance, buffer) based on total budget, trip duration, and destination cost index.

**Consequences (testable):**
- Budget allocation percentages are returned for each category.
- Allocation adjusts based on destination cost index (e.g., Phu Quoc resort area vs. Hanoi budget district).
- Total allocation equals stated budget (no rounding drift).

#### FR-6: Accommodation Matching

System can search the Vector Store for accommodation Entities matching the Traveler Profile and return a scored comparison list.

**Consequences (testable):**
- Results filtered by: budget per night, location, accommodation style, group size, accessibility needs.
- Each result includes: name, location, price per night, rating, source link, freshness timestamp, and a "why it fits" explanation grounded in profile match.
- Results ranked by price-to-value ratio.
- Zero results returned that do not exist as Entities in the Vector Store.

#### FR-7: Multi-City Routing Optimization

System can compute an optimized visit order for multi-destination Vietnam trips, minimizing transit time and cost.

**Consequences (testable):**
- Given a list of Vietnam destinations and date constraints, returns an optimized sequence with transport options (flight, train, bus) and estimated costs between each leg.
- Accounts for real transit options (e.g., no direct flight Sapa to Phu Quoc — requires connection via Hanoi).

#### FR-8: Seasonal Price Analysis

System can compare pricing across a flexible date window and surface cheaper travel periods.

**Consequences (testable):**
- Given a destination and a date flexibility window, returns a price comparison showing relative cost by week.
- Flags peak seasons (Tet holiday, Christmas) and shoulder seasons with price differentials.

#### FR-9: Travel Insurance Estimation

System can estimate travel insurance coverage needs and costs based on Traveler Profile (age, destination, duration, planned activities).

**Consequences (testable):**
- Flags high-risk activities (scuba diving, motorbike riding, trekking) that require additional coverage.
- Returns estimated premium range. [ASSUMPTION: Uses reference data rather than live insurance API integration for MVP.]

### 4.3 Proposal Generation (Summarization)

**Description:** The Proposal Agent generates a structured trip Proposal grounded in Vector Store data. Every hotel, restaurant, attraction, and activity in the Proposal must trace to an Entity with a verified source. The Proposal is formatted as a client-ready document. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-10: Day-by-Day Itinerary Generation

Proposal Agent can generate a day-by-day itinerary with morning, afternoon, and evening activities, transport between locations, and restaurant suggestions.

**Consequences (testable):**
- Each day has structured time blocks with specific venue names.
- Every venue name traces to an Entity in the Vector Store.
- Transport between venues includes method (taxi, walk, Grab) and estimated time.
- Restaurant suggestions respect dietary requirements from Traveler Profile.
- Bad weather alternatives included for outdoor activities. [ASSUMPTION: Weather alternatives are pre-mapped per activity type, not fetched from live weather API for MVP.]

#### FR-11: Accommodation Comparison Table

Proposal Agent can include a structured comparison table of recommended accommodations.

**Consequences (testable):**
- Table includes: name, location, price/night, rating, key amenities, and a "why it fits" rationale linked to profile.
- All entries are Entities with source links and freshness timestamps.
- Minimum 3 options per destination segment (budget permitting).

#### FR-12: Budget Breakdown

Proposal Agent can generate a categorized budget summary showing estimated costs.

**Consequences (testable):**
- Categories: flights, accommodation, activities, food, local transport, insurance, buffer.
- Each category shows estimated total with breakdown of major line items.
- Total matches or falls within stated budget range (with explicit flag if over).

#### FR-13: Booking Action Items

Proposal Agent can generate a prioritized list of booking actions with urgency reasoning.

**Consequences (testable):**
- Items ranked by time-sensitivity (e.g., "Book flights first — prices volatile" before "Reserve hotel — flexible cancellation until 14 days").
- Each item includes: what to book, suggested booking window, and reason for priority.

#### FR-14: Proposal Export

Travel Agent (or Consumer) can export the Proposal as a PDF or shareable link.

**Consequences (testable):**
- PDF export preserves formatting, tables, and budget charts.
- Shareable link is read-only and does not require authentication.

### 4.4 Compliance Validation

**Description:** Before any Proposal reaches the client, the Compliance Agent runs automated checks against the Traveler Profile and proposed itinerary. Non-compliant items are blocked with explanations and alternatives. The Compliance Agent can prevent Proposal delivery until issues are resolved. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-15: Visa Requirement Validation

Compliance Agent can check visa requirements based on traveler nationality against Vietnam entry rules.

**Consequences (testable):**
- Correctly identifies visa-free (45-day), visa-free (30-day), e-visa required, and embassy visa required based on nationality.
- Handles Phu Quoc special case (30-day visa-free only if staying exclusively on island).
- Returns: visa type required, cost, processing time, application link, and deadline relative to travel dates.

#### FR-16: Health & Vaccination Advisory

Compliance Agent can check health requirements and advisories for Vietnam travel.

**Consequences (testable):**
- Flags required and recommended vaccinations.
- Returns health advisory links from recognized sources.

#### FR-17: Travel Advisory Check

Compliance Agent can check government travel warnings for Vietnam or specific regions.

**Consequences (testable):**
- If a "Do Not Travel" advisory exists for any planned destination, the system blocks that destination from the Proposal and flags it.
- Lower-level advisories (exercise caution) are surfaced as warnings, not blocks.

#### FR-18: Age Restriction Validation

Compliance Agent can validate planned activities against traveler ages.

**Consequences (testable):**
- Activities with minimum age requirements (e.g., scuba diving min 10, motorbiking min 18) are checked against traveler ages in the profile.
- Non-compliant activities are removed and alternatives suggested.

#### FR-19: Seasonal Feasibility Check

Compliance Agent can validate destination suitability for planned travel dates using regional monsoon data.

**Consequences (testable):**
- Checks each destination's region (North/Central/South) against seasonal patterns.
- Flags destinations planned during their monsoon season with severity and alternatives (different dates or different region).
- Handles Vietnam's staggered monsoon: North May-Oct, Central Sep-Jan, South May-Oct.

#### FR-20: Budget Feasibility Validation

Compliance Agent can validate that the total estimated cost does not exceed the stated budget.

**Consequences (testable):**
- If estimated total exceeds budget by >10%, flags with cost-reduction suggestions.
- Suggestions prioritized by impact (e.g., "Switch to 3-star hotel saves $40/night" before "Skip one activity saves $15").

#### FR-21: Accessibility Validation

Compliance Agent can validate that selected accommodations and activities meet stated mobility/accessibility needs.

**Consequences (testable):**
- If Traveler Profile includes mobility requirements, checks each accommodation and activity Entity for accessibility attributes.
- Flags non-compliant items with accessible alternatives.

#### FR-22: Passport Validity Check

Compliance Agent can validate passport validity against the 6-month rule.

**Consequences (testable):**
- If passport expiry date is provided, checks that it is valid for at least 6 months beyond planned departure.
- Flags with renewal urgency if insufficient.

#### FR-23: Compliance Gate

Compliance Agent can block Proposal delivery when critical compliance issues are unresolved.

**Consequences (testable):**
- Critical issues (visa block, "Do Not Travel" advisory, age restriction violation) prevent Proposal export until resolved.
- Warnings (seasonal, budget, health advisory) are surfaced but do not block.
- Compliance Report shows pass/fail/warning for each check with resolution guidance.
- Travel Agent can override warnings (with acknowledgment logged) but cannot override blocks.

### 4.5 Copilot Interface (B2B)

**Description:** The primary B2B interface presents STravel as a real-time sidebar alongside the agent's workflow. The agent sees AI-generated suggestions, running calculations, and compliance flags as they emerge during an Advisory Session. [ASSUMPTION: Split-screen web layout — client-facing content on left, AI copilot sidebar on right.] Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-24: Real-Time Sidebar

System can display AI agent outputs (suggestions, calculations, compliance flags) in a sidebar that updates in real time as the Advisory Session progresses.

**Consequences (testable):**
- Sidebar updates without page refresh as agents produce outputs.
- Agent can see which workflow stage is active (fact-finding / calculating / generating / validating).
- Outputs appear within 5 seconds of agent completion. [ASSUMPTION: Latency target for streaming — depends on model serving infrastructure.]

#### FR-25: Advisory Session Management

Travel Agent can manage multiple Advisory Sessions (create, resume, archive).

**Consequences (testable):**
- Agent can have multiple in-progress Advisory Sessions.
- Sessions persist across browser sessions (server-side state).
- Agent can resume a session from where it was left off.

#### FR-26: Client History

System can store completed Advisory Sessions as client history accessible to the Travel Agent.

**Consequences (testable):**
- Completed sessions are searchable by client name, destination, and date.
- Agent can reference a previous session's Traveler Profile when starting a new session for the same client.

### 4.6 Demo Mode (B2C)

**Description:** A simplified self-serve interface for direct consumers. Uses the same backend agents but with a conversational chat UX instead of the copilot sidebar. Primarily for demonstration and testing. Realizes UJ-2.

**Functional Requirements:**

#### FR-27: Conversational Trip Planning

Consumer can plan a trip through a chat interface that runs the full four-stage workflow conversationally.

**Consequences (testable):**
- Chat interface guides fact-finding through natural conversation (not a form).
- Calculations, proposal, and compliance run automatically after profile completion.
- Consumer sees the Proposal inline in the chat with export option.

#### FR-28: No Authentication Required

Consumer can use demo mode without creating an account.

**Consequences (testable):**
- Demo mode is accessible without login.
- Session state persists for the browser session but is not saved long-term.
- Rate limiting prevents abuse. [ASSUMPTION: Simple IP-based rate limiting for MVP.]

### 4.7 Data Pipeline & Vector Store

**Description:** Automated ETL pipelines ingest travel data from external APIs and sources into the Vector Store. The Vector Store indexes Entities (hotels, restaurants, attractions, activities) with metadata for hybrid search (keyword + semantic). Freshness tracking ensures stale data is flagged.

**Functional Requirements:**

#### FR-29: Entity Ingestion Pipeline

System can ingest Entity data from external sources (travel APIs, web scraping, manual upload) into the Vector Store with structured metadata.

**Consequences (testable):**
- Each Entity has: name, type, location (lat/long + region), description, pricing, rating, source URL, and ingestion timestamp.
- Duplicate detection prevents the same real-world entity from being indexed twice.
- Ingestion logs record success/failure counts per run.

#### FR-30: Hybrid Search

System can search the Vector Store using both keyword matching (exact names, codes) and semantic search (natural language descriptions).

**Consequences (testable):**
- Keyword search: "Rex Hotel Saigon" returns exact match.
- Semantic search: "quiet beach resort with pool under $100 in Phu Quoc" returns relevant matches ranked by semantic similarity + metadata filters.
- Combined: hybrid mode merges keyword and semantic results with configurable weighting.

#### FR-31: Freshness Tracking

System can track data freshness per Entity and flag stale data.

**Consequences (testable):**
- Each Entity has an `ingested_at` and `expires_at` timestamp.
- Entities older than a configurable threshold (default: 7 days for prices, 30 days for descriptions) are flagged as stale.
- Stale Entities are excluded from Proposal generation or included with a staleness warning.

#### FR-32: Regulatory Data Ingestion

System can ingest and maintain regulatory data (visa rules, health advisories, travel warnings) in a structured format for the Compliance Agent.

**Consequences (testable):**
- Visa rules stored per nationality with: visa type, duration, cost, processing time, entry points.
- Health advisories and travel warnings stored with source URL and last-verified date.
- Regulatory data supports both keyword lookup (country code) and semantic search (regulation interpretation).

## 5. Non-Goals (Explicit)

- STravel is NOT a booking engine. It generates proposals and recommendations but does not process transactions.
- STravel does NOT replace the travel agent. It is a copilot that assists, not an autonomous agent that acts.
- STravel does NOT cover destinations outside Vietnam in v1.
- STravel does NOT provide legal or medical advice. Compliance checks surface regulatory information but do not constitute professional guidance.
- STravel does NOT handle group negotiation or consensus. [NON-GOAL for MVP — post-MVP Group Consensus Engine.]
- STravel does NOT proactively monitor prices. [NON-GOAL for MVP — post-MVP Predictive Pricing Agent.]
- STravel does NOT learn from post-trip feedback. [NON-GOAL for MVP — post-MVP Trip Memory System.]

## 6. MVP Scope

### 6.1 In Scope

- 10 Vietnam destination regions: Hanoi, Ha Long Bay, Sapa, Da Nang/Hoi An, Hue, Nha Trang, Da Lat, Ho Chi Minh City, Mekong Delta, Phu Quoc
- Four core workflows: fact-finding, calculation, summarization, compliance
- B2B copilot interface for travel agents
- B2C demo mode (simplified chat interface, no auth)
- Multi-agent orchestration via LangChain/LangGraph
- Open-source LLM (Qwen 3.x), open-source vector DB (Qdrant)
- Hybrid RAG (keyword + semantic search)
- Docker/Kubernetes deployment
- CI/CD pipeline (GitHub Actions)
- Observability stack (Prometheus/Grafana/OpenTelemetry)
- PDF export of proposals

### 6.2 Out of Scope for MVP

- Destinations outside Vietnam (deferred to v2 — SE Asia expansion)
- Booking or payment integration (deferred to v2)
- Group Consensus Engine (deferred to v2) [NOTE FOR PM: Strongest differentiator — prioritize for v2.]
- Predictive Pricing Agent (deferred to v2)
- Trip Memory / feedback loop system (deferred to v3)
- Cultural Intelligence Module (deferred to v2 — quick win, could be pulled into MVP if time permits)
- Mobile app (web-first, deferred to v3)
- Multi-language UI (English-first, Vietnamese UI deferred to v2)
- Real-time weather integration (use seasonal pattern data for MVP)
- Live flight/hotel booking API integration for real-time pricing [ASSUMPTION: MVP uses periodically refreshed data via ETL rather than real-time API calls during user sessions. Real-time API integration deferred to v2.]

## 7. Success Metrics

**Primary**

- **SM-1:** Proposal Completeness — ≥90% of generated Proposals contain all required sections (itinerary, accommodation table, budget breakdown, action items). Validates FR-10, FR-11, FR-12, FR-13.
- **SM-2:** Entity Verification Rate — 100% of Entities referenced in Proposals exist in the Vector Store with valid source links. Validates FR-6, FR-10, FR-11.
- **SM-3:** Compliance Coverage — ≥95% of applicable compliance checks pass or flag appropriately for a given Traveler Profile. Validates FR-15 through FR-23.

**Secondary**

- **SM-4:** Fact-Finding Efficiency — Profiling Agent reaches profile completion in ≤15 conversational exchanges for a standard traveler. Validates FR-1, FR-2, FR-3.
- **SM-5:** Learning Concept Coverage — All 13 AI/ML engineering concepts are implemented with production-grade patterns (validated by architecture review). Validates project learning objectives.

**Counter-metrics (do not optimize)**

- **SM-C1:** Session Length — do not minimize at the expense of profile quality. Rushing fact-finding to reduce exchanges produces shallow profiles and poor proposals. Counterbalances SM-4.
- **SM-C2:** Proposal Generation Speed — do not optimize latency at the expense of verification. A fast proposal with hallucinated hotels is worse than a slower verified one. Counterbalances SM-1.

## Cross-Cutting NFRs

- **Observability:** All agent invocations, RAG retrievals, and compliance checks must emit structured logs and traces (OpenTelemetry). Model performance metrics (latency, token usage, retrieval relevance) must be dashboardable.
- **Data Freshness:** No Entity with an expired freshness timestamp may appear in a Proposal without a staleness warning.
- **Guardrails:** The system must never present LLM-generated Entity names, prices, or ratings as factual. All factual claims in Proposals must trace to Vector Store Entities.
- **Multi-tenancy:** B2B mode must support multiple travel agencies as tenants with isolated client data. [ASSUMPTION: Logical isolation (shared infrastructure, tenant ID filtering) for MVP, not physical isolation.]
- **Scalability:** System must handle concurrent Advisory Sessions without degradation. [ASSUMPTION: Target 10 concurrent sessions for MVP, scaling via K8S horizontal pod autoscaling.]

## Constraints and Guardrails

**Data Accuracy:**
- Prices must never be generated by the LLM. All pricing data comes from the Data Pipeline with source attribution and timestamp.
- Hotels, restaurants, and attractions must exist as verified Entities. The Proposal Agent must reject any Entity not found in the Vector Store.

**Cost:**
- Open-source stack throughout — no paid API dependencies for core functionality. [ASSUMPTION: Travel data APIs (Amadeus, etc.) may have free tiers or require paid access for production volume. MVP operates within free-tier limits or uses web-scraped seed data.]
- Inference cost managed through model tiering, caching, and token budgeting.

**Privacy:**
- Traveler Profile data is stored per-tenant and not shared across agencies.
- Demo mode session data is ephemeral and not retained.

## Integration and Dependencies

| Dependency | Purpose | MVP Approach |
|---|---|---|
| Travel data (hotels, attractions) | Entity data for Vector Store | Seed dataset via web scraping + manual curation. Amadeus/Booking.com API for enrichment if free-tier available. |
| Flight data | Price comparison, routing | Seed dataset. Skyscanner/Amadeus API for enrichment. |
| Visa rules database | Compliance Agent | Manually curated from government sources, stored as structured regulatory data. |
| Health/travel advisories | Compliance Agent | Ingested from government travel advisory APIs/pages. |
| Weather/seasonal data | Seasonal feasibility checks | Static regional monsoon pattern data (not live weather API for MVP). |

## Risk and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Hallucinated Entities | HIGH | Strict RAG grounding — Proposal Agent only references Vector Store Entities. Guardrail rejects unknown entities. |
| Stale pricing data | HIGH | Freshness timestamps on all Entities. Staleness warnings in Proposals. ETL refresh schedules. |
| API dependency for travel data | MEDIUM | Adapter pattern with fallback providers. Aggressive caching. Seed dataset as baseline. |
| Model quality for Vietnamese context | MEDIUM | Qwen 3.x selected for Vietnamese language strength. Fine-tuning on Vietnam travel corpus. Evaluation benchmarks. |
| Scope creep beyond Vietnam | LOW-MED | Hard-coded to 10 Vietnam regions for MVP. Architecture supports future expansion but MVP enforces boundary. |

## 8. Open Questions

1. **OQ-1:** What specific travel data sources will be available within free-tier API limits for MVP? Determines whether seed dataset is manually curated or API-enriched.
2. **OQ-2:** What GPU infrastructure will be used for LLM serving and fine-tuning? Local machine, cloud spot instances, or managed inference service?
3. **OQ-3:** Should the Copilot Sidebar use WebSocket for real-time updates or SSE (Server-Sent Events)? Architecture decision.
4. **OQ-4:** How will the Vietnam Entity seed dataset be initially populated? Manual curation from TripAdvisor/Google Maps/Booking.com, or automated scraping pipeline?
5. **OQ-5:** What evaluation benchmarks will be used to validate fine-tuned model quality against the base model for Vietnam travel domain?

## 9. Assumptions Index

- **§2.4 / FR-24:** Copilot UI is a split-screen web layout — client-facing content on left, AI sidebar on right.
- **§4.1 / FR-2:** Natural conversation feel achieved through prompt engineering, not a rigid decision tree.
- **§4.2 / FR-9:** Travel insurance uses reference data rather than live insurance API for MVP.
- **§4.3 / FR-10:** Weather alternatives are pre-mapped per activity type, not live weather API.
- **§4.6 / FR-28:** Simple IP-based rate limiting for demo mode.
- **§4.5 / FR-24:** Real-time sidebar latency target of 5 seconds — depends on model serving infrastructure.
- **§6.2:** MVP uses periodically refreshed ETL data rather than real-time API calls during user sessions.
- **Cross-Cutting NFRs:** Multi-tenancy via logical isolation (tenant ID filtering), not physical isolation.
- **Cross-Cutting NFRs:** Target 10 concurrent sessions for MVP.
- **Constraints:** Travel data APIs may require paid access — MVP operates within free tiers or uses seed data.
