---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - prds/prd-AIFU-2026-05-25/prd.md
  - architecture.md
  - ux-design-specification.md
storySummary:
  epic1: 7 stories (1.1–1.7) — Unified Canvas & Live Conversation
  epic2: 10 stories (2.1–2.10) — Card-Driven Profile Collection
  epic3: 10 stories (3.1–3.10) — Propose-First & Interactive Proposal Deck
  epic4: 5 stories (4.1–4.5) — B2B Agent Mode
  total: 32 stories
---

# STravel Chat-First UI — Epic Breakdown

## Overview

This document provides the epic and story breakdown for the STravel Chat-First UI feature, decomposing requirements from the Chat-First UI PRD (prd-AIFU-2026-05-25), the platform Architecture, and the completed UX Design Specification into implementable stories.

The existing platform (Epics 1–6, 31 stories) is complete. These epics cover the new conversational interface layer built on top of that platform.

---

## Requirements Inventory

### Functional Requirements

**Phase 1 — MVP (in scope)**

FR-A1: Idle State Bot Greeting — idle canvas renders bot greeting and active chat input on page load; no form shown
FR-A2: Mood-First Entry Option — bot surfaces 5 mood cards when first message is ambiguous; mood infers destination/activity defaults
FR-A3: Propose-First Flow — when user provides destination in first message, bot generates opinionated draft proposal immediately using inferred defaults; user corrects via natural language or card edit
FR-B1: Single-Question Progressive Disclosure — bot asks one question per turn; each question accompanied by its corresponding input card; text input always available as alternative
FR-B2: Destination Cards — bot renders up to 6 tappable destination cards with name, one-line description, cost tier; "Surprise me" always included
FR-B3: Inline Calendar Card — mini calendar card rendered inline in chat thread for date selection; no modal or page navigation
FR-B4: Budget Slider Card — interactive slider card (USD 200–10,000, step USD 100) with real-time contextual label
FR-B5: Multi-Select Cards — dietary requirements, activity preferences, accessibility needs collected via tappable toggle card grids; "No restrictions" deselects all
FR-B6: Passport Photo Upload Card — OCR extraction of passport expiry date from uploaded photo; extracted date shown for confirmation; manual text fallback always available; image not stored
FR-B7: "Surprise Me" Option — every card-based selection step includes a Surprise Me option; bot selects and provides 1-sentence rationale
FR-B8: Zero-Typing Profile Completion — full traveler profile completable via card taps only; no keyboard input required at any step
FR-C1: Proposal Card Deck — advisory output renders as interactive card deck (DayCard, HotelCard, BudgetCard, ComplianceCard, BookingCard); each card collapsed by default, tap to expand
FR-C2: Inline Card Editing — each proposal card has an edit affordance; tapping reopens the corresponding bot question; only the affected card(s) are regenerated
FR-C3: Compliance Inline Badges — compliance status (🔴/🟡/🟢) surfaced as dot badge on DayCard and HotelCard; tapping badge scrolls to ComplianceCard
FR-D1: Live Proposal Streaming — proposal streams word-by-word via existing SSE infrastructure; cards appear progressively as each section completes
FR-D2: Stage Narrator in Typing Indicator — typing indicator cycles through stage-specific messages tied to backend stage events (Reading profile / Calculating budget / Optimising route / Writing proposal / Running compliance checks)
FR-D3: Journey Progress Bar — persistent horizontal progress bar (Profile · Budget · Proposal · Review); highlights on stage completion; tapping completed stage scrolls to content
FR-D4: Auto-Trigger Analysis — bot auto-triggers advisory workflow when profile is complete; confirms with user before triggering; no "Run Analysis" button required
FR-E1: Single-Column Chat Interface — split-panel layout replaced by single full-width chat thread; existing split-panel retained as opt-in "agent mode" for B2B users (localStorage toggle)

**Phase 2 — Deferred (not in scope for these epics)**

FR-A4: Returning User Memory — authenticated returning users greeted with session history; Continue / Start Fresh options
FR-A5: Personalised Idle Cards — Spotify-style suggestion cards based on session history and trending destinations
FR-C4: Budget Drill-Down — BudgetCard expands to show editable line items with proportional re-balancing
FR-E2: Animated Stage Transitions — slide-in card animations, progress bar smooth transitions, stage label morphing

---

### Non-Functional Requirements

NFR-1: Time-to-First-Card — bot greeting and at least one card option appear within 500ms of page load for authenticated users; 1s for unauthenticated
NFR-2: Time-to-Proposal — end-to-end from profile-complete trigger to first streamed proposal token ≤ 5s on Ollama backend
NFR-3: Mobile-First Responsive — all card types fully functional on screens ≥ 375px wide; no horizontal scrolling; tap targets ≥ 44×44px
NFR-4: Accessibility — all interactive cards keyboard-navigable and screen-reader-compatible (ARIA roles, expanded/collapsed, selected); animations comply with prefers-reduced-motion
NFR-5: SSE Compatibility — card-streaming implementation must not break existing SSE proxy configuration in vite.config.ts (no buffering, x-accel-buffering: no, setNoDelay)
NFR-6: No New Backend APIs for MVP — MVP UI built on existing /api/v1/advisory_sessions and /api/v1/stream endpoints; passport OCR endpoint (FR-B6) is the only new backend requirement

---

### Additional Requirements

**From Architecture / Engineering (UX spec party mode findings):**

- ARCH-1: SSE generation decoupled from SSE connection lifecycle — LLM generation must continue server-side if client disconnects; current implementation ties generation to SSE handler
- ARCH-2: Redis event buffer (TTL'd) — enables SSE replay for iOS Safari tab-backgrounding and network interruption; Last-Event-ID reconnect header
- ARCH-3: Durable session state per delta — each SSE delta persisted as it arrives, not at session end
- ARCH-4: user_preferences table — separate from session state; stores authorship trip names, past destinations, travel style
- ARCH-5: is_final flag on SSE card envelope — `is_final: boolean` added to backend SSE card event; TravelCard settles on is_final OR completeness_score ≥ 0.75 (prevents race condition)
- ARCH-6: SSE heartbeat — server sends `: keep-alive\n\n` comment every 15s; client watchdog reconnects if no event received within 30s
- ARCH-7: SessionStatus type update — `domain.ts` SessionStatus type updated to `"pending" | "confirmed" | "modified" | "flagged"`; STATUS_COLORS replaced with CSS token approach
- ARCH-8: B2B session state machine API — session status transitions and API surface must be defined in FastAPI before Phase 3 B2B component work begins
- ARCH-9: ESLint rule — `no-restricted-syntax` to catch hardcoded hex in JSX/TSX files; enforced before Phase 1 build

---

### UX Design Requirements

**Foundation (tokens, layout, tooling):**

UX-DR1: Design token system — implement `.theme-b2c` / `.theme-b2b` scoped CSS variable selectors; B2C Warm Coastal palette (teal-600 primary #0D9488, amber accent #F59E0B); B2B Professional Slate (blue-700 primary #1D4ED8, slate #64748B); no hardcoded hex in component files
UX-DR2: CVA configuration — class-variance-authority for card state variants (nascent | forming | settled) and card-type variants; B2B/B2C register differences in CSS variables only, never in CVA compound variants
UX-DR3: Inter variable font — load with font-display: swap; Vietnamese Unicode subset (U+1E00–U+1EFF + Latin Extended); resolve Vite content-hash preload strategy; verify glyph coverage for "Đà Nẵng", "Hội An", "Phú Quốc"
UX-DR4: Tailwind config extension — custom breakpoints (tablet 768px, desktop-sm 1024px, desktop 1280px); touch-pan-y utility; dvh height utilities; safe-area padding utilities

**Layout shells:**

UX-DR5: B2CLayout shell — full-height single column; h-dvh (not h-screen); no overflow: hidden/auto on root shell; safe-area insets for iOS home indicator; overscroll-behavior: contain on scroll container
UX-DR6: B2BLayout shell — 1280px+ desktop split panel (320px SessionList left, flex right); 64px icon-rail at 1024–1279px; collapses to B2CLayout below 1024px; no layout toggle component

**ConversationCanvas and fixed layout:**

UX-DR7: ConversationCanvas fixed layout — role="log", aria-live driven by SSE state machine; ChatInput position-fixed bottom with env(safe-area-inset-bottom); CardDeckZone position-fixed above ChatInput; ConversationCanvas padding-bottom driven by ResizeObserver on both fixed elements; CardDeckZone slot placeholder built in Phase 1 even if CardDeck is Phase 2

**Core B2C components (Phase 1):**

UX-DR8: TravelCard — nascent (amber shimmer, no tap affordance) / forming (structural fields, amber border, scale-98, read-only) / settled (full fidelity, slate border, spring shadow, scale-100, edit icon + conditional booking CTA); 420ms spring cubic-bezier(0.34, 1.56, 0.64, 1); failure/timeout amber state after 90s stall; is_final guard for settled transition; card types: flight, hotel, activities, visa
UX-DR9: CompletenessIndicator — per-card progress bar; amber-400 when score < 0.75; teal-500 (B2C) / blue-600 (B2B) at ≥ 0.75; transitions with card state
UX-DR10: MessageBubble — bot / user / stage-narrator variants; stage-narrator: text-slate-400 12px centered, no bubble chrome, 400ms lag after SSE event, persists in scroll history
UX-DR11: StageNarrator — persistent in DOM from initial render (never mounts/unmounts); aria-live="polite" aria-atomic="true"; single text node content contract; 400ms lag after SSE stage.change event; maps IDLE/INTAKE/PLANNING/PROPOSAL_READY/BOOKING stages

**Phase 2 B2C components:**

UX-DR12: SlotFillingCard — role="radiogroup"; chips as role="radio"; auto-advance 300ms after chip tap; Escape → free-text fallback (chips hidden, input shown, focus moves to input immediately); emits structured slot update `{ slotKey, value }` not raw string; chip visual states: unselected/hovered/focused/selected/focused+selected (amber ring-2 on focused+selected)
UX-DR13: CardDeck — browsing/committing state machine; committing triggers when all cards completeness ≥ 0.75 AND 500ms elapsed; authorship moment ("What would you name this trip?") fires on committing entry; "Book this" CTA appears only in committing state; authorship dismiss: unnamed trip persists; authorship re-queues on card edit back to browsing

**B2B components (Phase 3):**

UX-DR14: SessionStatusBadge — pending/confirmed/modified/flagged; icon + label always (never color-only); flagged state blocks booking action; flag reason required (free-text, stored in session metadata); DOM: role="status" aria-label="Status: [label]"; icon aria-hidden
UX-DR15: SessionRow + SessionList — fixed 64px row height (required for @tanstack/react-virtual); SessionList virtualized via @tanstack/react-virtual; search + filter by status
UX-DR16: StagingGate — amber banner ("working draft — not yet shared with client"); "Mark as client-ready →" triggers confirmation modal; confirmation writes session status to CONFIRMED via API; does not lock draft from further edits (further edits → status MODIFIED); role="banner" aria-live="polite" on confirmation

**Accessibility (cross-cutting):**

UX-DR17: aria-live state machine — ConversationCanvas aria-live driven by SSE phase: off during streaming, polite on complete (SSE [DONE]), assertive on error; streaming message rendered aria-hidden="true" outside live region; persistent sentinel div (role="status" aria-live="polite" aria-atomic="true") receives completion announcement
UX-DR18: Focus management matrix — all 16 state transitions implemented per spec (nascent→forming, forming→settled, edit open/cancel/save, slot chip advance, slot last→ChatInput, Escape→free-text, CardDeck authorship, message append, session switch, StagingGate modal open/confirm/cancel, StageNarrator update); triggerRef pattern for all overlays; focus trap in StagingGate modal
UX-DR19: Reduced motion — prefers-reduced-motion: spring → instant state change + 150ms opacity fade; applies to all animated elements including shimmer; Framer Motion useReducedMotion() hook if spring library used
UX-DR20: Chip visual states — 5 states: unselected (bg-white, border-teal-200), hovered (bg-teal-50, border-teal-400, suppress on hover:none), focused:focus-visible (border-2 border-teal-600, ring-2 ring-teal-300), selected (bg-teal-600, text-white, Check icon), focused+selected (bg-teal-700, border-2, ring-2 ring-amber-400 ring-offset-2)
UX-DR21: touch-action: pan-y on TravelCard container; "Xem lựa chọn khác" / "See other options" ghost button affordance on settled cards (min-h-44 touch target, self-end); no swipe-to-dismiss gesture for MVP

**Pre-implementation required:**

UX-DR22: MOOD_TRANSITION rules documentation — linguistic signal taxonomy distinguishing context correction from card edit; card dependency graph (which card types invalidate which on which context changes); per-card-type default questions when context is ambiguous — must be documented before Phase 2 edit flow stories are started

**Shimmer performance:**

UX-DR23: Shimmer will-change concurrency — gate will-change: transform on nascent TravelCards; maximum 3 simultaneous active shimmer elements (beyond 3 = GPU memory exhaustion on Galaxy A-series); enforce via CardDeck render logic

---

### FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR-E1 | Epic 1 | Unified canvas replaces split-panel; agent mode toggle |
| FR-A1 | Epic 1 | Idle bot greeting on canvas load |
| FR-D2 | Epic 1 | Stage narrator in typing indicator |
| FR-D3 | Epic 1 | Journey progress bar |
| FR-A2 | Epic 2 | Mood-first entry option |
| FR-B1 | Epic 2 | Single-question progressive disclosure |
| FR-B2 | Epic 2 | Destination cards |
| FR-B3 | Epic 2 | Inline calendar card |
| FR-B4 | Epic 2 | Budget slider card |
| FR-B5 | Epic 2 | Multi-select cards |
| FR-B6 | Epic 2 | Passport photo upload + OCR |
| FR-B7 | Epic 2 | Surprise Me option |
| FR-B8 | Epic 2 | Zero-typing profile completion (verification) |
| FR-A3 | Epic 3 | Propose-First flow |
| FR-C1 | Epic 3 | Proposal card deck |
| FR-C2 | Epic 3 | Inline card editing |
| FR-C3 | Epic 3 | Compliance inline badges |
| FR-D1 | Epic 3 | Live proposal streaming |
| FR-D4 | Epic 3 | Auto-trigger analysis |
| NFR-1 | Epic 1 | Time-to-first-card (500ms auth / 1s unauth) |
| NFR-2 | Epic 3 | Time-to-proposal (≤5s first token) |
| NFR-3 | Epic 2 | Mobile-first responsive (≥375px, 44×44px targets) |
| NFR-4 | All | Accessibility woven per-component across all epics |
| NFR-5 | Epic 1 | SSE compatibility (no vite.config.ts breakage) |
| NFR-6 | Epic 2 | No new backend APIs except OCR endpoint |
| ARCH-1 | Epic 3 | SSE decoupled from connection lifecycle |
| ARCH-2 | Epic 3 | Redis event buffer (TTL'd) |
| ARCH-3 | Epic 3 | Durable session state per delta |
| ARCH-4 | Epic 2 | user_preferences table |
| ARCH-5 | Epic 1 | is_final flag on SSE card envelope |
| ARCH-6 | Epic 1 | SSE heartbeat (15s server / 30s client watchdog) |
| ARCH-7 | Epic 2+4 | SessionStatus type update (domain.ts) |
| ARCH-8 | Epic 4 | B2B session state machine API |
| ARCH-9 | Epic 1 | ESLint no hardcoded hex rule |

---

## Epic List

### Epic 1: Unified Canvas & Live Conversation
Transform the split-panel layout into a unified single-column conversational canvas; establish the complete design system and component foundation; deliver bot greeting, stage narration, and progress bar so users immediately experience an active AI partner instead of a static form.
**FRs covered:** FR-E1, FR-A1, FR-D2, FR-D3
**ARCH covered:** ARCH-5, ARCH-6, ARCH-9
**UX-DR covered:** UX-DR1–11, UX-DR17, UX-DR19, UX-DR21

### Epic 2: Card-Driven Profile Collection
Enable users to complete a full traveler profile — mood, destination, dates, budget, dietary preferences, passport expiry — through card taps alone with zero keyboard input required.
**FRs covered:** FR-A2, FR-B1, FR-B2, FR-B3, FR-B4, FR-B5, FR-B6, FR-B7, FR-B8
**ARCH covered:** ARCH-4, ARCH-7
**UX-DR covered:** UX-DR12, UX-DR18, UX-DR20, UX-DR21, UX-DR22

### Epic 3: Propose-First & Interactive Proposal Deck
Give decisive users an immediate proposal on first message; give all users a streaming interactive proposal card deck with inline editing and compliance visibility; harden the SSE infrastructure for production resilience.
**FRs covered:** FR-A3, FR-C1, FR-C2, FR-C3, FR-D1, FR-D4
**ARCH covered:** ARCH-1, ARCH-2, ARCH-3
**UX-DR covered:** UX-DR13, UX-DR18, UX-DR23

### Epic 4: B2B Agent Mode
Enable travel agents to manage multiple client sessions in a desktop split-panel with professional staging controls, status badge scanning, and confirmed-before-client session workflow.
**FRs covered:** (Agent mode extension of FR-E1)
**ARCH covered:** ARCH-7, ARCH-8
**UX-DR covered:** UX-DR6, UX-DR14, UX-DR15, UX-DR16

---

## Epic 1: Unified Canvas & Live Conversation

Transform the split-panel layout into a unified single-column conversational canvas; establish the complete design system and component foundation; deliver bot greeting, stage narration, and progress bar so users immediately experience an active AI partner instead of a static form.

### Story 1.1: Design Token System, Tailwind Config & B2CLayout Shell

As a developer,
I want a complete design token system with scoped CSS variables, a configured Tailwind setup, and a B2CLayout shell,
So that all UI components use consistent, themeable values without hardcoded colors and the mobile canvas is structurally correct from day one.

**Acceptance Criteria:**

**Given** the Tailwind config is updated
**When** a component applies a CSS utility class
**Then** it resolves to the correct token value from the scoped `.theme-b2c` or `.theme-b2b` selector — never a hardcoded hex value in JSX/TSX files

**Given** the ESLint rule is active
**When** a developer commits a file containing a hardcoded hex value (e.g. `#0D9488`) in a JSX/TSX file
**Then** the lint check fails with a descriptive error pointing to the violation

**Given** a user opens STravel on an iPhone 14
**When** the app renders in B2CLayout
**Then** the layout fills the full viewport using `h-dvh` (not `h-screen`), the root shell has no `overflow: hidden` or `overflow: auto`, and the home indicator safe area is respected via `env(safe-area-inset-bottom, 0px)` on the bottom container

**Given** the B2CLayout is active
**When** the user scrolls the conversation
**Then** `overscroll-behavior: contain` prevents the browser bounce from interfering with the layout

**Given** the Inter variable font is configured with Vietnamese Unicode subset
**When** the app loads
**Then** `font-display: swap` is applied, the preload link references the correct hashed filename (Vite config verified), and glyphs for "Đà Nẵng", "Hội An", "Phú Quốc" render without system font fallback

**And** custom Tailwind breakpoints exist: `tablet: 768px`, `desktop-sm: 1024px`, `desktop: 1280px`

---

### Story 1.2: ConversationCanvas Fixed Layout Architecture

As a traveler,
I want the chat input pinned at the bottom of the screen at all times,
So that I can send a message without scrolling down and my typed messages are never obscured by the keyboard.

**Acceptance Criteria:**

**Given** the ConversationCanvas is rendered in B2CLayout
**When** the user scrolls up through conversation history
**Then** `ChatInput` remains fixed at the bottom of the viewport and `CardDeckZone` (an empty placeholder slot) remains fixed directly above it

**Given** ChatInput and CardDeckZone are both `position: fixed`
**When** either element changes height (e.g. ChatInput grows with multiline input)
**Then** a `ResizeObserver` updates `ConversationCanvas` `padding-bottom` dynamically so no conversation content is hidden behind the fixed footer

**Given** the keyboard opens on an Android device
**When** the viewport resizes
**Then** the ResizeObserver re-fires and the padding adjusts correctly — no content is clipped

**Given** the ConversationCanvas scroll container
**When** it renders
**Then** it has `role="log"`, `aria-label="Travel advisory conversation"`, and `aria-live` attribute present (value controlled by SSE state machine, default `"polite"`)

**And** the existing SSE proxy configuration in `vite.config.ts` is unchanged — no buffering, `x-accel-buffering: no`, `setNoDelay` preserved (NFR-5)

---

### Story 1.3: TravelCard Component (State Machine + Accessibility)

As a traveler,
I want to see AI-generated travel cards animate from a shimmering placeholder to a complete card,
So that I understand the AI is building my trip in real time and I know when each part of my proposal is ready to review.

**Acceptance Criteria:**

**Given** a TravelCard is in `nascent` state (completeness_score < 0.25)
**When** it renders
**Then** it shows an amber shimmer animation on skeleton fields, has no tap affordance, and does not respond to user interaction

**Given** a TravelCard transitions to `forming` state (score 0.25–0.75)
**When** the transition fires
**Then** structural fields populate, the border is `border-amber-200`, and the card renders at `scale-[0.98]` with CompletenessIndicator showing amber-400

**Given** a TravelCard transitions from `forming` → `settled` (score ≥ 0.75 AND `is_final: true`)
**When** the transition fires
**Then** the card animates with the 420ms spring `cubic-bezier(0.34, 1.56, 0.64, 1)`, border transitions to `border-slate-200`, scale to `scale-100`, and CompletenessIndicator turns teal-500 (B2C)

**Given** `prefers-reduced-motion: reduce` is set
**When** a card transitions state
**Then** the spring animation is replaced by an instant state change + 150ms opacity fade

**Given** a TravelCard has been in `nascent` state for > 90 seconds without a state update
**When** the timeout fires
**Then** the card renders an amber error variant with "Taking longer than expected" and a [Try again] ghost button

**Given** `touch-action: pan-y` is set on the TravelCard container
**When** a user swipes horizontally on the card
**Then** the browser does not capture the horizontal gesture for navigation

**And** all four card types are implemented: flight, hotel, activities, visa — each with its own field grid layout
**And** TravelCard has `role="article"`, `aria-label="[type] card, [n]% complete"`, and a visually-hidden child `<span>` carrying `aria-live="polite"` for completeness updates (not the card root)
**And** will-change: transform is gated — maximum 3 simultaneous nascent TravelCards have `will-change: transform` active (prevents GPU memory exhaustion on Galaxy A-series)

---

### Story 1.4: SSE Heartbeat & is_final Card Envelope

As a traveler on iOS Safari,
I want my proposal to continue loading after I switch apps and return,
So that I don't lose the AI's work when my browser backgrounds the tab.

**Acceptance Criteria:**

**Given** the SSE backend is streaming card events
**When** a card event is emitted
**Then** the payload includes `is_final: boolean` alongside `card_id`, `type`, `completeness_score`, and `delta`

**Given** a TravelCard's `completeness_score` reaches ≥ 0.75
**When** `is_final` is `false`
**Then** the card stays in `forming` state — it does not transition to `settled` prematurely

**Given** the SSE connection is open
**When** no event (including heartbeat) is received for 30 seconds
**Then** the client-side watchdog closes the `EventSource`, sets `ssePhase = 'error'`, and surfaces a reconnect prompt — it does not auto-reconnect silently

**Given** the server-side SSE endpoint is connected
**When** 15 seconds elapse without a data event
**Then** a comment-only keepalive (`:\n\n`) is sent — this does not trigger `onmessage` and does not interfere with the data event stream

**And** `event_bus.py` is updated to emit the heartbeat comment and include `is_final` in card events
**And** the SSE envelope schema is updated in `streaming.py` and corresponding TypeScript types in `types/domain.ts`

---

### Story 1.5: Bot Greeting & MessageBubble Component

As a traveler,
I want to see a friendly greeting the moment I open STravel,
So that I know immediately the AI is ready to help me plan my trip — not waiting for me to fill out a form.

**Acceptance Criteria:**

**Given** an authenticated user opens STravel
**When** the canvas renders
**Then** the bot greeting ("Hi! Where are you dreaming of going in Vietnam?") appears within 500ms and ChatInput is active (NFR-1)

**Given** an unauthenticated user opens STravel
**When** the canvas renders
**Then** the bot greeting appears within 1s (NFR-1 unauthenticated)

**Given** a bot message is rendered in ConversationCanvas
**When** it appears
**Then** it uses the `MessageBubble` component with `role="bot"` — correct bubble chrome, teal-600 accent

**Given** a user sends a message
**When** it appears
**Then** it uses `MessageBubble` with `role="user"` — right-aligned, user-accent styling

**Given** a stage-narrator message is rendered
**When** it appears
**Then** it uses the stage-narrator variant: `text-slate-400`, 12px, centered, no bubble chrome — appears 400ms after the triggering SSE event

**And** stage-narrator messages persist in scroll history
**And** no form elements, sidebar panels, or split-panel layout are rendered — canvas is conversation-only (FR-E1)
**And** an agent mode toggle button in the header reads from localStorage key `stravel_agent_mode`; when active it switches to B2BLayout shell stub

---

### Story 1.6: StageNarrator Component & Journey Progress Bar

As a traveler,
I want to see exactly what the AI is doing as it builds my proposal, with a progress bar tracking the stages,
So that I feel confident the system is working and I know how close I am to seeing my trip.

**Acceptance Criteria:**

**Given** the StageNarrator component mounts
**When** it renders initially
**Then** it is present in the DOM with empty content and never mounts/unmounts on stage changes (required for `aria-live` to work correctly with screen readers)

**Given** an SSE `stage.change` event arrives with stage `PLANNING`
**When** 400ms elapses
**Then** StageNarrator updates its single text node to "💰 Calculating budget…"

**Given** the StageNarrator has `aria-live="polite"` and `aria-atomic="true"`
**When** stage text updates
**Then** screen readers announce the full new stage text without interrupting user activity

**Given** the journey progress bar renders while the workflow is idle
**When** checked
**Then** the progress bar is hidden

**Given** the first bot question appears
**When** the user begins the flow
**Then** the progress bar appears with 4 stages: `Profile · Budget · Proposal · Review`, current stage highlighted

**Given** a completed stage marker is tapped
**When** the tap registers
**Then** ConversationCanvas scrolls to the content for that stage

---

### Story 1.7: aria-live State Machine & Unified Canvas Integration

As a screen reader user,
I want AI-generated content to be announced clearly when it's complete rather than stuttering through every token,
So that I can follow the conversation without my screen reader being overwhelmed by streaming updates.

**Acceptance Criteria:**

**Given** an SSE stream begins
**When** the first token arrives
**Then** `ConversationCanvas` `aria-live` is set to `"off"` and the streaming message renders in a separate `aria-hidden="true"` container outside the log region

**Given** the SSE stream completes (`[DONE]` event)
**When** the final message is committed to the log
**Then** `ConversationCanvas` `aria-live` switches back to `"polite"` in the same React render batch, and the persistent sentinel `<div role="status" aria-live="polite" aria-atomic="true">` receives the completion announcement text

**Given** an SSE error occurs
**When** the error state fires
**Then** `ConversationCanvas` `aria-live` is set to `"assertive"` and the sentinel div announces the error immediately

**Given** the page has loaded with all Epic 1 components integrated
**When** `axe-core` runs via `jest-axe`
**Then** zero WCAG 2.1 AA violations are reported for the canvas, greeting, TravelCard skeleton, StageNarrator, and progress bar

**And** the full B2C flow (canvas load → greeting → stage narration → progress bar) works end-to-end on the existing SSE infrastructure without modifying `vite.config.ts`

---

## Epic 2: Card-Driven Profile Collection

Enable users to complete a full traveler profile — mood, destination, dates, budget, dietary preferences, passport expiry — through card taps alone with zero keyboard input required.

**FRs covered:** FR-A2, FR-B1, FR-B2, FR-B3, FR-B4, FR-B5, FR-B6, FR-B7, FR-B8
**ARCH covered:** ARCH-4, ARCH-7
**UX-DR covered:** UX-DR12, UX-DR18, UX-DR20, UX-DR21, UX-DR22

---

### Story 2.1: MOOD_TRANSITION Rules, user_preferences Table & SessionStatus Type

As an engineer about to build card-driven flows,
I want the MOOD_TRANSITION business rules documented, the user_preferences table migrated, and the SessionStatus type updated in domain.ts,
So that all Phase 2 edit flows have a safe foundation and no later story is blocked by missing data model or type conflicts.

**Acceptance Criteria:**

**Given** the MOOD_TRANSITION documentation requirement (UX-DR22)
**When** this story is shipped
**Then** a `docs/mood-transition-rules.md` file exists at the project root containing:
- A linguistic signal taxonomy with ≥10 examples distinguishing "context correction" (affects multiple card types) from "card edit" (affects one card)
- A card dependency graph showing which card types are regenerated for each context-change category (e.g., destination change → regenerates flight, hotel, itinerary; budget change → regenerates hotel, itinerary, budget; dates change → regenerates all)
- Per-card-type default question strings used when context is ambiguous and the bot must ask a clarifying question
- The MOOD_TRANSITION reducer contract: `action: { type: 'MOOD_TRANSITION', payload: { kind: 'correction' | 'edit', affectedSlots: SlotKey[] } }`

**Given** the `user_preferences` table requirement (ARCH-4)
**When** this story is shipped
**Then** a SQLModel `UserPreferences` model exists with fields: `id`, `user_id (FK)`, `trip_name (nullable str)`, `past_destinations (JSON array)`, `travel_style (nullable str)`, `dietary_restrictions (JSON array)`, `created_at`, `updated_at`
**And** an Alembic migration creates the `user_preferences` table
**And** the `UserPreferences` model file does not contain `from __future__ import annotations` (project convention)
**And** `session.execute()` + `.scalars()` is used in all queries — never `session.exec()`

**Given** the `SessionStatus` type in `domain.ts` (ARCH-7)
**When** this story is shipped
**Then** `domain.ts` exports `type SessionStatus = "pending" | "confirmed" | "modified" | "flagged"`
**And** `STATUS_COLORS` in `SessionList.tsx` is replaced with CSS custom property tokens: `--status-pending`, `--status-confirmed`, `--status-modified`, `--status-flagged` defined in the `.theme-b2b` selector
**And** no hardcoded hex colors remain in `SessionList.tsx` (ESLint rule ARCH-9 enforced)

---

### Story 2.2: SlotFillingCard Component Base

As a traveler answering the bot's questions,
I want an accessible, keyboard-navigable chip-based card component for selecting options,
So that every preference question can be answered by tapping or pressing a chip without switching to a text input.

**Acceptance Criteria:**

**Given** the `SlotFillingCard` renders with a set of chip options
**When** rendered
**Then** the card container has `role="radiogroup"` and each chip has `role="radio"` with `aria-checked` reflecting selection state

**Given** a chip is focused
**When** the user triggers the chip (click or Enter/Space)
**Then** the chip enters selected state (bg-teal-600, text-white, Check icon visible)
**And** 300ms after selection the card auto-advances to the next bot question (emitting `{ slotKey, value }` structured update)
**And** the 300ms delay is skipped if the user presses Enter on a currently-focused selected chip (immediate advance)

**Given** a chip is in the focused+selected state
**When** rendered
**Then** it applies `bg-teal-700 border-2 ring-2 ring-amber-400 ring-offset-2` — the amber ring is the critical differentiator from selected-only state (UX-DR20)

**Given** the user presses Escape while a SlotFillingCard is active
**When** Escape fires
**Then** chips are hidden and a free-text input is shown
**And** focus moves to the text input immediately (no layout jump, no re-mount)
**And** the card remains in the DOM — it does not unmount

**Given** `prefers-reduced-motion: reduce` is active
**When** a chip is selected and auto-advance occurs
**Then** the 300ms auto-advance delay is preserved (it is user-facing timing, not animation) but all CSS transitions on the chip are disabled (transition: none)

**Given** a chip option labelled "Surprise me" exists in the card
**When** tapped
**Then** the bot immediately emits a SURPRISE_ME event for that slot, selects a random value, and displays a 1-sentence rationale in the next MessageBubble (FR-B7)

**Given** `axe-core` runs on a rendered SlotFillingCard
**When** evaluated
**Then** zero WCAG 2.1 AA violations are reported (FR-B1, NFR-4)

---

### Story 2.3: Mood-First Entry Point

As a traveler who opens STravel without a specific destination in mind,
I want the bot to offer me a mood-based starting point instead of asking where I want to go,
So that I can discover a destination that matches how I feel right now.

**Acceptance Criteria:**

**Given** the user's first message is conversationally ambiguous (no destination, dates, or budget mentioned)
**When** the bot classifies the message
**Then** the bot responds with a mood prompt ("How are you feeling about this trip?") and renders a SlotFillingCard with ≥5 mood options: Adventure, Relaxation, Culture, Foodie, Romance (FR-A2)

**Given** the user taps a mood chip
**When** the 300ms auto-advance elapses
**Then** the selected mood is stored in the current session's slot state
**And** the bot narrates its inference ("Great — let me suggest some places that match that vibe")
**And** the destination card step begins (Story 2.4)

**Given** the user ignores the mood card and types a destination directly
**When** the text message is sent
**Then** the mood card closes without selection logged and the destination slot is populated from the typed message
**And** the bot moves to the next unfilled slot (no mood required)

**Given** a "Surprise me" chip appears in the mood card
**When** tapped
**Then** the bot selects a mood at random, announces the selection with rationale, and continues to destination cards

---

### Story 2.4: Destination Cards

As a traveler selecting where to go,
I want a card grid showing destination options with name, description, and cost tier,
So that I can make an informed choice by tapping rather than typing a destination name.

**Acceptance Criteria:**

**Given** the bot renders destination cards (FR-B2)
**When** rendered on mobile (375px viewport)
**Then** up to 6 destination cards are shown in a 2-column grid within the SlotFillingCard container
**And** a "Surprise me" chip is always present as the last option (FR-B7)
**And** each card shows: destination name, one-line description (≤60 chars), cost tier badge (💸 Budget / 💰 Mid-range / 💎 Premium)

**Given** a destination card is tapped
**When** selected
**Then** the `destination` slot is populated with the destination name + metadata
**And** auto-advance to the next slot begins after 300ms (if mood-first) or the bot triggers Propose-First if enough context exists (FR-A3)

**Given** the user's first message already contained a destination
**When** the bot detects this
**Then** the destination card step is skipped entirely and the destination slot is pre-populated

**Given** "Surprise me" is tapped
**When** selected
**Then** the bot selects one destination, reveals its name with a 1-sentence rationale ("I picked Hội An — it's perfect for a relaxing cultural escape in May"), and advances

**Given** cards are rendered at 375px
**When** each card is measured
**Then** tap targets are ≥44×44px (NFR-3)

---

### Story 2.5: Inline Calendar Card

As a traveler selecting travel dates,
I want to pick my dates from a mini calendar card inline in the chat,
So that I never navigate away from the conversation to use a date picker.

**Acceptance Criteria:**

**Given** the bot asks for travel dates (FR-B3)
**When** the calendar card renders
**Then** a two-month mini calendar is shown inline in the chat thread (not a modal, not a bottom sheet, not a separate page)
**And** the current month is always shown left; next month right; both months visible without scrolling at 375px (single-column stacked if needed)

**Given** the user taps a start date on the calendar
**When** the tap registers
**Then** the start date is highlighted in teal-600 and the calendar awaits an end date tap
**And** a "Nights: —" counter appears below the calendar

**Given** the user taps an end date
**When** the end date is ≥1 day after start date
**Then** the date range is highlighted; "Nights: N" counter updates; a "Confirm" chip appears
**And** tapping "Confirm" populates the `travel_dates` slot and auto-advances

**Given** the user selects an end date earlier than the start date
**When** the invalid selection is made
**Then** the calendar resets to start-date selection mode (end date cleared); no error message; purely visual reset

**Given** `prefers-reduced-motion: reduce` is active
**When** dates are selected
**Then** no date range fill animation plays; teal highlight appears instantly

**Given** the calendar is rendered
**When** keyboard navigation is used (Tab, Arrow keys, Enter, Space)
**Then** individual dates are navigable by arrow keys; Enter/Space selects; Tab moves to Confirm chip; all dates have `aria-label="[Day of week], [Month] [Day], [Year]"`; selected range dates have `aria-selected="true"`

---

### Story 2.6: Budget Slider Card

As a traveler setting a budget,
I want an interactive slider that shows a real-time label for what my budget means,
So that I can quickly set a number without typing and understand what it gets me.

**Acceptance Criteria:**

**Given** the bot asks for budget (FR-B4)
**When** the budget slider card renders
**Then** a range input is shown spanning USD 200–10,000 in steps of USD 100
**And** the current value label updates in real-time as the slider moves ("~$2,500 · Mid-range · Covers flights + 3★ hotel")

**Given** the slider is at a value
**When** rendered at various breakpoints
**Then** the slider track is ≥44px tall touch target; the thumb is ≥44×44px; the value label never overlaps the thumb

**Given** the slider value changes
**When** value changes
**Then** the `budget` slot is updated in real-time (no confirm needed); a "Use this" chip appears after 1s of inactivity on the slider
**And** tapping "Use this" auto-advances to the next slot

**Given** a "Surprise me" chip exists alongside the slider
**When** tapped
**Then** the bot selects a budget value at the midpoint of the user's mood-inferred range and advances with rationale

**Given** the budget card is navigated with keyboard
**When** focused on the slider input
**Then** Left/Right arrows change value by USD 100; Home/End jump to min/max; `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` are present with the contextual label text

---

### Story 2.7: Multi-Select Cards (Preferences & Dietary)

As a traveler describing my preferences,
I want to tap-select multiple options from a grid for dietary restrictions, activity interests, and accessibility needs,
So that the proposal reflects my actual requirements without any typing.

**Acceptance Criteria:**

**Given** the bot asks for dietary requirements (FR-B5)
**When** the multi-select card renders
**Then** the card uses `role="group"` with `aria-label="Select dietary requirements"` and each chip uses `role="checkbox"` with `aria-checked`
**And** a "No restrictions" chip is always present and deselects all other chips when tapped

**Given** the user taps a preference chip
**When** it enters selected state
**Then** the chip shows the selected visual state (bg-teal-600, text-white, Check icon)
**And** the chip can be deselected by tapping again (unlike SlotFillingCard single-select)

**Given** the user taps "No restrictions"
**When** it is selected
**Then** all other chips immediately deselect visually and the dietary restrictions slot is set to an empty array

**Given** the multi-select card has a "Done" chip
**When** tapped
**Then** the selected values are emitted as `{ slotKey: 'dietary', value: string[] }` and auto-advance occurs

**Given** a "Surprise me" option is tapped on the activity preferences card
**When** selected
**Then** the bot selects 2–3 representative activities for the chosen destination and mood combination, announces them, and advances

**Given** `axe-core` runs on a multi-select card
**When** evaluated
**Then** zero WCAG 2.1 AA violations reported

---

### Story 2.8: Passport OCR Backend Endpoint

As a traveler who needs to verify passport expiry,
I want the backend to extract my passport expiry date from a photo I upload,
So that compliance checks run automatically without me typing the date manually.

**Acceptance Criteria:**

**Given** a `POST /api/v1/passport/extract-expiry` endpoint (FR-B6, NFR-6 — sole new backend endpoint)
**When** called with a multipart form upload containing an image
**Then** the endpoint returns `{ expiry_date: "YYYY-MM-DD" | null, confidence: float, fallback_required: bool }`
**And** `fallback_required: true` when confidence < 0.85 or when expiry_date is null

**Given** the endpoint processes an image
**When** the processing is complete
**Then** the uploaded image is NOT stored anywhere — it is processed in memory only and discarded after extraction
**And** the endpoint logs only `{ confidence, fallback_required }` — no image data, no passport fields other than expiry_date

**Given** an unsupported file type is uploaded (not jpg/png/webp)
**When** the request arrives
**Then** the endpoint returns HTTP 422 with `{ detail: "Unsupported image format" }`

**Given** an image larger than 10MB is uploaded
**When** the request arrives
**Then** the endpoint returns HTTP 413

**Given** the Passport OCR implementation (OQ-2 deferred decision)
**When** initially shipped
**Then** the implementation uses Ollama LLaVA vision model (zero additional cost, already in stack per addendum) with the option documented in `PASSPORT_OCR_PROVIDER` env var for future migration to Google Vision or Textract

**Given** the endpoint is called
**When** processing takes > 15s
**Then** the endpoint returns HTTP 504 with `{ detail: "OCR timeout" }` and `fallback_required: true`

---

### Story 2.9: Passport Upload Card

As a traveler completing profile setup,
I want to photograph my passport and have the expiry date extracted automatically,
So that I don't have to type a date in a specific format.

**Acceptance Criteria:**

**Given** the bot asks for passport expiry (FR-B6)
**When** the passport upload card renders
**Then** a card with a camera icon, drag-and-drop zone, and "Take photo" / "Upload photo" buttons is shown inline in the chat thread

**Given** the user selects or drops an image
**When** the image is received
**Then** the card shows a loading shimmer and calls the OCR endpoint (Story 2.8)
**And** if OCR succeeds (confidence ≥ 0.85): the extracted date is shown in `DD/MM/YYYY` format with "Is this correct?" and Yes/No chips
**And** if `fallback_required: true`: a date text input is shown with the message "I couldn't read the date clearly — please enter it manually" and focus moves to the input immediately

**Given** the user taps "Yes" to confirm the extracted date
**When** confirmed
**Then** the `passport_expiry` slot is populated and auto-advance occurs

**Given** the user taps "No" to reject the extracted date
**When** rejected
**Then** a text input replaces the Yes/No chips with the extracted date pre-filled for correction; focus moves to the input

**Given** a "Skip" link is always present below the upload zone
**When** tapped
**Then** the `passport_expiry` slot is marked as `skipped` and the bot moves to the next slot with a note that compliance checks may be incomplete

**Given** the card is navigated by keyboard
**When** Tab sequence reaches the upload zone
**Then** the zone has `role="button"` aria-label="Upload passport photo" and activates via Enter/Space

---

### Story 2.10: Zero-Typing Profile Verification Screen

As a traveler who completed profile setup via cards,
I want to see a summary of everything the bot collected so I can confirm before generating my proposal,
So that I catch any errors before the 60-second LLM generation begins.

**Acceptance Criteria:**

**Given** all mandatory profile slots are filled (destination, dates, budget, traveler count)
**When** the profile is complete
**Then** the bot sends a summary MessageBubble listing all collected values in a structured readable format:
```
📍 Destination: Hội An, Vietnam
📅 Dates: 15 Jun – 22 Jun (7 nights)
💰 Budget: ~$2,500
👥 Travelers: 2 adults
🍽️ Dietary: Vegetarian
🛂 Passport expiry: 12/03/2028
```
**And** a "Looks good — build my trip!" CTA chip and an "Edit something" chip are shown

**Given** the user taps "Looks good — build my trip!"
**When** tapped
**Then** the profile is submitted, the bot responds "Starting your proposal…", and the SSE advisory workflow is triggered (FR-D4)
**And** the StageNarrator and progress bar update to PLANNING stage

**Given** the user taps "Edit something"
**When** tapped
**Then** a new SlotFillingCard renders listing all collected fields as chips ("Destination", "Dates", "Budget", "Dietary", etc.)
**And** tapping a field chip replays that specific question's card; only that slot is updated; no full restart

**Given** the profile has only optional slots missing (dietary, passport expiry)
**When** mandatory slots are all filled
**Then** the bot still shows the verification screen — it does not silently trigger without user confirmation (FR-D4 "confirms with user before triggering")

**Given** the entire flow from canvas load to verification screen is completed with no keyboard input
**When** verified end-to-end on mobile (375px, touch only)
**Then** the flow is completable by taps alone (FR-B8)

---

## Epic 3: Propose-First & Interactive Proposal Deck

Give decisive users an immediate proposal on first message; give all users a streaming interactive proposal card deck with inline editing and compliance visibility; harden the SSE infrastructure for production resilience.

**FRs covered:** FR-A3, FR-C1, FR-C2, FR-C3, FR-D1, FR-D4
**ARCH covered:** ARCH-1, ARCH-2, ARCH-3
**UX-DR covered:** UX-DR13, UX-DR18, UX-DR23

---

### Story 3.1: Decouple SSE Generation from Connection Lifecycle

As the platform,
I want LLM generation to continue server-side if a client disconnects during streaming,
So that an iOS Safari tab-background or network hiccup does not cancel a 60-second proposal generation.

**Acceptance Criteria:**

**Given** the current SSE handler ties `run_advisory_workflow` to the SSE response lifecycle (ARCH-1)
**When** this story is shipped
**Then** `run_advisory_workflow` is dispatched as a background task (FastAPI `BackgroundTasks` or equivalent) before the SSE response is opened
**And** the SSE response handler reads events from a queue/Redis channel rather than awaiting the generation directly
**And** if the client disconnects mid-stream, the generation continues to completion and events are buffered (Story 3.2)

**Given** a background generation task is running
**When** a new SSE connection arrives for the same session (reconnect)
**Then** the connection is served from the buffered events (Story 3.2) — generation is NOT restarted

**Given** a background generation task completes while no client is connected
**When** the client reconnects
**Then** all buffered events are replayed in order from the Last-Event-ID checkpoint

**Given** `structlog` is used for all logging (project convention)
**When** the generation lifecycle is logged
**Then** log entries include `session_id`, `event_count`, `generation_status`, and connection events at INFO level; no PII

---

### Story 3.2: Redis Event Buffer with Last-Event-ID Replay

As a traveler on a mobile connection,
I want my proposal to resume from where it left off if my connection drops,
So that a brief network interruption doesn't force a 60-second regeneration.

**Acceptance Criteria:**

**Given** each SSE event is emitted (ARCH-2)
**When** emitted
**Then** the event is written to a Redis list keyed by `sse:session:{session_id}` with the event's `id` field set to a monotonically increasing integer
**And** the Redis list has TTL of 2 hours (reset on each write)

**Given** a client reconnects with `Last-Event-ID: N` in the HTTP request header
**When** the SSE endpoint receives the reconnect
**Then** all events with id > N are replayed from Redis in order before resuming live streaming

**Given** a session's Redis buffer does not exist (first connection, or TTL expired)
**When** a client connects
**Then** the SSE stream begins fresh with event id starting at 1

**Given** Redis is unavailable
**When** a client connects or reconnects
**Then** the SSE stream falls back to live-only (no replay) with a warning logged; the endpoint does NOT return 500
**And** `structlog` WARNING includes `{ "event": "redis_buffer_unavailable", "session_id": "..." }`

**Given** the SSE server heartbeat (ARCH-6, from Story 1.4)
**When** the heartbeat `: keep-alive\n\n` comment is emitted every 15s
**Then** heartbeat comments are NOT stored in the Redis buffer (SSE spec comment events have no id)

---

### Story 3.3: Durable Session State Per Delta

As a traveler who may return to a proposal later,
I want each piece of my proposal saved as the AI writes it,
So that I can close the tab and return to find my proposal intact rather than triggering a full regeneration.

**Acceptance Criteria:**

**Given** each SSE delta event arrives at the backend (ARCH-3)
**When** the delta is emitted
**Then** the delta is persisted to the session's `events` JSON column (or a dedicated `session_events` table) before the event is sent to Redis and the SSE stream
**And** the persistence does NOT block the SSE emit — it is fire-and-forget with error logging

**Given** a session with persisted deltas is loaded
**When** the user returns to that session URL
**Then** the ConversationCanvas replays the persisted events in order, rendering the conversation and card deck to their saved state without re-running the LLM

**Given** a session's LLM generation fails mid-stream
**When** the user returns to the session
**Then** the partial proposal cards that were persisted are shown in their last `forming` state (not nascent)
**And** a "Resume" or "Regenerate" action is offered depending on how far the proposal progressed

**Given** the persisted state is replayed
**When** replaying
**Then** SSE is NOT re-emitted — replay goes through a separate `hydrateFromHistory()` code path that does not touch the SSE infrastructure

---

### Story 3.4: Propose-First Flow

As a decisive traveler who opens STravel with a specific destination in mind,
I want the AI to generate an immediate opinionated proposal based on what I told it,
So that I see a draft trip in front of me rather than being interrogated through 10 questions first.

**Acceptance Criteria:**

**Given** the user's first message contains a destination (e.g., "I want to go to Đà Nẵng for a week") (FR-A3)
**When** the bot classifies the message
**Then** the bot responds with "Great — let me draft something based on what you told me" and immediately triggers the advisory workflow with:
- `destination` = extracted from message
- `duration` = extracted or defaulted to 7 days
- all other fields = contextual defaults (documented in MOOD_TRANSITION rules from Story 2.1)
**And** the `[ASSUMPTION]` Option A approach (existing `run_advisory_workflow` with defaults) is used per addendum decision

**Given** the Propose-First workflow triggers
**When** the SSE stream begins
**Then** all proposal cards appear in `nascent` state immediately (before any content arrives)
**And** cards transition to `forming` as content arrives via SSE deltas

**Given** default values are used for missing profile fields
**When** the proposal cards render
**Then** each card with a defaulted field shows an amber "assumed" badge on that field: "2 adults (assumed)" / "7 nights (assumed)"

**Given** the user sees an assumed value they want to change
**When** they tap the "assumed" badge
**Then** the corresponding SlotFillingCard re-opens inline with the assumed value pre-selected; correcting the value triggers targeted regeneration of affected cards only (same path as Story 3.9)

**Given** a "Surprise me" user opens STravel with just "surprise me" or equivalent
**When** classified
**Then** the bot applies full random defaults across all slots and immediately triggers Propose-First

---

### Story 3.5: Proposal Card Types

As a traveler reviewing my AI-generated proposal,
I want distinct card types for each aspect of my trip — flights, hotel, activities, budget, compliance, booking,
So that I can scan and understand the full proposal at a glance without reading a wall of text.

**Acceptance Criteria:**

**Given** the proposal SSE stream completes (FR-C1)
**When** cards are rendered
**Then** the following card types are implemented with their required fields:
- `FlightCard`: route, airline, departure/arrival times, price, outbound + return legs
- `HotelCard`: name, location, star rating, price/night, highlights (≤3), compliance dot badge
- `ActivityCard`: name, duration, price, day number, description
- `BudgetCard`: total, breakdown by category (flights / accommodation / activities / misc), currency
- `ComplianceCard`: visa requirement, passport expiry check, health advisories (expandable)
- `BookingCard`: "Book this" CTA (only in CardDeck committing state)

**Given** a card is in `nascent` state
**When** rendered
**Then** structural field placeholders (grey shimmer bars) show the card's field layout before content arrives; shimmer uses amber animation; max 3 simultaneous `will-change: transform` (UX-DR23)

**Given** a card's `is_final: true` event arrives and completeness_score ≥ 0.75 (UX-DR8)
**When** the transition fires
**Then** the card enters `settled` state with 420ms spring cubic-bezier(0.34, 1.56, 0.64, 1); slate border; spring shadow; scale-100; edit icon visible

**Given** a HotelCard or DayCard has a compliance issue
**When** rendered (FR-C3)
**Then** a dot badge (🔴 critical / 🟡 advisory / 🟢 clear) is visible on the card without expanding
**And** tapping the badge scrolls ConversationCanvas to the ComplianceCard

---

### Story 3.6: CardDeck State Machine & Authorship Moment

As a traveler whose proposal is complete,
I want to see a "Book this" action only once all my cards are finalized, and be invited to name my trip,
So that booking is not accessible until the proposal is trustworthy and the experience feels personal.

**Acceptance Criteria:**

**Given** the CardDeck renders a set of proposal cards (UX-DR13)
**When** all cards have `completeness_score ≥ 0.75` AND 500ms has elapsed since the last card settled
**Then** the CardDeck transitions from `browsing` to `committing` state

**Given** the CardDeck enters `committing` state
**When** the transition fires
**Then** the authorship moment fires: a MessageBubble from the bot asks "What would you like to name this trip?" with a text input ChipCard

**Given** the user types a trip name and submits
**When** submitted
**Then** the trip name is saved to `user_preferences.trip_name` (from Story 2.1 schema)
**And** the `BookingCard` "Book this" CTA becomes active

**Given** the user dismisses the authorship prompt (Escape or "Skip")
**When** dismissed
**Then** the trip name remains null; the `BookingCard` CTA still becomes active (unnamed trip is allowed)
**And** the authorship prompt does NOT re-appear on the same session

**Given** the user edits a settled card (Story 3.9) after reaching `committing` state
**When** the edit triggers targeted regeneration
**Then** the CardDeck returns to `browsing` state; "Book this" CTA deactivates; the authorship moment re-queues for the next `committing` entry

**Given** `axe-core` runs on the CardDeck in both `browsing` and `committing` states
**When** evaluated
**Then** zero WCAG 2.1 AA violations reported

---

### Story 3.7: Auto-Trigger Analysis

As a traveler who has just finished profile collection,
I want the AI to automatically confirm before starting my proposal,
So that I'm never surprised by a 60-second generation I didn't initiate, but I don't have to find a "Run" button.

**Acceptance Criteria:**

**Given** the profile verification screen confirms (Story 2.10) or the bot detects a complete slot set (FR-D4)
**When** the auto-trigger condition is met
**Then** the bot sends a confirmation MessageBubble: "Ready to build your trip proposal. This takes about 60 seconds — shall I start?" with "Let's go" and "Not yet" chips

**Given** the user taps "Let's go"
**When** tapped
**Then** the advisory workflow triggers; the StageNarrator updates to PLANNING; proposal cards appear in nascent state; progress bar highlights the Proposal stage

**Given** the user taps "Not yet"
**When** tapped
**Then** the bot responds "No problem — just say 'build my trip' whenever you're ready" and the chat input remains active

**Given** the user types "build my trip" or equivalent at any point after profile completion
**When** the message is classified
**Then** the advisory workflow triggers directly without another confirmation (intent is explicit)

**Given** the workflow is already running (SSE stream active)
**When** the user attempts to trigger again
**Then** the trigger is ignored; no duplicate generation; a bot message "Your proposal is already being generated" is shown

---

### Story 3.8: Progressive Proposal Streaming

As a traveler waiting for my proposal,
I want to see each card appear and fill in progressively as the AI writes it,
So that I feel the AI is actively working rather than staring at a blank screen for 60 seconds.

**Acceptance Criteria:**

**Given** the SSE stream begins for proposal generation (FR-D1)
**When** the first SSE event arrives
**Then** all expected card placeholders appear in `nascent` state simultaneously (amber shimmer, no content)

**Given** SSE delta events arrive for a card
**When** `completeness_score` crosses 0.25
**Then** the card transitions to `forming`: structural fields appear, amber border, scale-98, read-only

**Given** `is_final: true` arrives for a card with `completeness_score ≥ 0.75`
**When** the event is processed
**Then** the card transitions to `settled` with 420ms spring animation (or instant + 150ms opacity if `prefers-reduced-motion`)

**Given** a card has been in `nascent` state for > 90 seconds without any `forming` events
**When** the 90s timeout fires
**Then** the card displays an amber "Still generating…" state with a retry affordance; the SSE stream is not disconnected

**Given** the CardDeck renders with >3 nascent cards simultaneously
**When** measured
**Then** only 3 cards have `will-change: transform` active; additional nascent cards use `will-change: auto` (UX-DR23, prevents GPU exhaustion on Galaxy A-series)

**Given** the full proposal stream completes (all cards settled)
**When** the last `[DONE]` event arrives
**Then** the StageNarrator updates to PROPOSAL_READY; progress bar highlights the Review stage; the persistent sentinel `aria-live` div announces "Your trip proposal is ready"

---

### Story 3.9: Inline Card Editing & Targeted Regeneration

As a traveler reviewing my proposal,
I want to edit one aspect of my trip without regenerating the entire proposal,
So that I can quickly correct a hotel choice without waiting 60 seconds for everything to rerun.

**Acceptance Criteria:**

**Given** a card is in `settled` state and has an edit icon (UX-DR8) (FR-C2)
**When** the edit icon is tapped
**Then** the card visually opens an edit affordance (does NOT re-enter nascent — it stays settled with an edit overlay)
**And** focus moves to the first editable field in the edit affordance (focus management matrix UX-DR18)

**Given** the user modifies a field and confirms
**When** confirmed
**Then** the `streamReducer` dispatches `MOOD_TRANSITION` with `{ kind: 'edit', affectedSlots: [editedSlotKey] }`
**And** per the dependency graph (Story 2.1), only the directly affected card types enter `forming` state and are re-streamed
**And** unaffected cards remain `settled` — no full deck regeneration

**Given** a structural context change (e.g., destination changed)
**When** the `MOOD_TRANSITION` action is `kind: 'correction'`
**Then** all cards in the dependency graph for "destination" enter `forming` state and all are re-streamed
**And** cards not in the dependency graph remain `settled`

**Given** the user cancels an edit (Escape or "Cancel" button)
**When** the cancel fires
**Then** the card reverts to its settled visual state; focus returns to the edit icon (triggerRef pattern from UX-DR18)
**And** no regeneration occurs

**Given** a card enters `forming` after targeted regeneration
**When** `is_final: true` arrives for the re-streamed card
**Then** the card re-enters `settled` with the 420ms spring animation

---

### Story 3.10: Compliance Inline Badges

As a traveler with a Vietnam proposal,
I want to see compliance status (visa, passport, health advisories) surfaced directly on relevant cards,
So that I never reach the booking step unaware of a visa requirement.

**Acceptance Criteria:**

**Given** a HotelCard or DayCard has compliance data in the SSE payload (FR-C3)
**When** the card renders in `settled` state
**Then** a dot badge is visible on the card: `🔴` (critical — blocks booking), `🟡` (advisory — warning), `🟢` (clear)

**Given** the dot badge is rendered
**When** audited for accessibility
**Then** the badge has `role="status"` and `aria-label="Compliance: [critical/advisory/clear]"` — color alone does NOT convey status (WCAG 1.4.1)

**Given** the badge is tapped
**When** tapped
**Then** ConversationCanvas smoothly scrolls to the ComplianceCard; the ComplianceCard briefly highlights with a pulse animation (150ms, `prefers-reduced-motion` skips the pulse)

**Given** the ComplianceCard is expanded
**When** rendered
**Then** it shows: visa requirement text, passport expiry check result (pass/warn/fail with expiry date), health advisory text (or "No current advisories"), and a "Check visa requirements →" external link

**Given** a `🔴` critical compliance badge is present on any card
**When** the CardDeck attempts to enter `committing` state
**Then** the `BookingCard` CTA remains disabled with `aria-disabled="true"` and a tooltip: "Resolve compliance issues before booking"
**And** the CardDeck still enters `committing` state visually — only the CTA is blocked

---

## Epic 4: B2B Agent Mode

Enable travel agents to manage multiple client sessions in a desktop split-panel with professional staging controls, status badge scanning, and confirmed-before-client session workflow.

**FRs covered:** (Agent mode extension of FR-E1)
**ARCH covered:** ARCH-7, ARCH-8
**UX-DR covered:** UX-DR6, UX-DR14, UX-DR15, UX-DR16, UX-DR18

---

### Story 4.1: B2B Session State Machine API

As a travel agent using the B2B copilot,
I want the backend to track session status transitions (pending → confirmed → modified → flagged),
So that the frontend status badges and staging gate have a reliable server-side state to reflect.

**Acceptance Criteria:**

**Given** the session state machine requirements (ARCH-8)
**When** this story is shipped
**Then** a `PATCH /api/v1/advisory_sessions/{session_id}/status` endpoint exists
**And** it accepts `{ status: "pending" | "confirmed" | "modified" | "flagged", flag_reason?: str }`
**And** it validates transitions: `pending → confirmed`, `confirmed → modified`, `modified → confirmed`, any state → `flagged`
**And** it rejects invalid transitions with HTTP 422 `{ "detail": "Invalid status transition: {from} → {to}" }`

**Given** the `AdvisorySession` model
**When** the migration runs
**Then** the `status` column is `VARCHAR` with a CHECK constraint on the four valid values
**And** a `flag_reason` nullable TEXT column is added
**And** the Alembic migration file does not use `from __future__ import annotations` (project convention)

**Given** a status is updated to `"flagged"`
**When** `flag_reason` is not provided
**Then** the endpoint returns HTTP 422 `{ "detail": "flag_reason required when status is flagged" }`

**Given** the `SessionStatus` type was already updated in `domain.ts` (Story 2.1)
**When** the frontend consumes the status field
**Then** no additional type changes are needed — the API response aligns with the existing `SessionStatus` type

**Given** the endpoint is called
**When** the transition succeeds
**Then** `structlog` records `{ session_id, from_status, to_status, agent_id }` at INFO level

---

### Story 4.2: B2BLayout Shell

As a travel agent on a desktop browser,
I want a split-panel layout with a session list on the left and the conversation on the right,
So that I can manage multiple client sessions without switching tabs.

**Acceptance Criteria:**

**Given** the `stravel_agent_mode` localStorage key is `"true"` (UX-DR6, decision log #4)
**When** the app loads
**Then** `B2BLayout` shell renders instead of `B2CLayout`

**Given** a viewport width ≥ 1280px (desktop breakpoint)
**When** `B2BLayout` renders
**Then** a 320px fixed-width `SessionList` panel renders on the left; the right panel takes remaining space and renders `ConversationCanvas` for the active session

**Given** a viewport width of 1024–1279px (desktop-sm breakpoint)
**When** `B2BLayout` renders
**Then** a 64px icon-rail replaces the full `SessionList`; each session represented by a status-colored circle avatar; tapping opens the full session list as an overlay

**Given** a viewport width < 1024px
**When** `B2BLayout` renders
**Then** the layout collapses to the `B2CLayout` single-column shell (no split panel on mobile — UX-DR6)

**Given** the agent mode toggle in the AppHeader
**When** toggled off
**Then** `stravel_agent_mode` is set to `"false"` in localStorage and the app re-renders in `B2CLayout` without a page reload

**Given** `B2BLayout` renders
**When** `.theme-b2b` scoped CSS variables are applied
**Then** all color tokens resolve to the B2B Professional Slate palette (blue-700 primary, slate secondary) — no teal-600 appears in B2B mode (UX-DR1)

---

### Story 4.3: SessionStatusBadge Component

As a travel agent scanning a session list,
I want each session's status to be immediately readable as text and icon, not just color,
So that I can identify flagged or confirmed sessions at a glance even without perfect color vision.

**Acceptance Criteria:**

**Given** the `SessionStatusBadge` component renders (UX-DR14)
**When** given a `status` prop of any valid SessionStatus value
**Then** it renders an icon AND a label — never color alone:
- `pending`: `ClockIcon` + "Pending"
- `confirmed`: `CheckCircleIcon` + "Confirmed"
- `modified`: `PencilIcon` + "Modified"
- `flagged`: `FlagIcon` + "Flagged"

**Given** the badge renders
**When** evaluated
**Then** the container has `role="status"` and `aria-label="Status: [label]"`
**And** the icon has `aria-hidden="true"` (icon is decorative; label carries the meaning)

**Given** the status is `"flagged"`
**When** rendered
**Then** the badge additionally shows the `flag_reason` as a truncated tooltip (max 80 chars) on hover/focus
**And** a `title` attribute contains the full `flag_reason`

**Given** the badge's color tokens
**When** applied
**Then** colors resolve from `--status-pending`, `--status-confirmed`, `--status-modified`, `--status-flagged` CSS custom properties (set in `.theme-b2b` selector from Story 2.1)
**And** no hardcoded hex colors are present in the component file (ESLint ARCH-9)

**Given** `axe-core` runs on all four badge states
**When** evaluated
**Then** zero WCAG 2.1 AA violations reported

---

### Story 4.4: SessionList & SessionRow (Virtualized)

As a travel agent with 20+ active sessions,
I want a fast-scrolling session list with search and status filtering,
So that I can find any client session in under 3 seconds regardless of how many sessions I have.

**Acceptance Criteria:**

**Given** the `SessionList` component renders (UX-DR15)
**When** it mounts
**Then** it uses `@tanstack/react-virtual` with a fixed row height of exactly 64px (mandatory for virtualizer correctness — UX-DR15)

**Given** 50 sessions are loaded
**When** the list renders
**Then** only the visible rows (~6–8 at 1280px height) are in the DOM; rows outside the viewport are not rendered

**Given** a search query is typed in the session list search input
**When** the user types
**Then** the visible rows filter in real-time to sessions where the client name or destination contains the query (case-insensitive)
**And** the virtualizer re-calculates for the filtered list without flickering

**Given** a status filter chip is tapped ("Pending", "Confirmed", "Modified", "Flagged")
**When** filtered
**Then** only sessions with that status are shown; multiple status filters can be active simultaneously

**Given** a `SessionRow` renders
**When** evaluated
**Then** it shows: client avatar initials (2 letters), client name (truncated at 24 chars), destination, `SessionStatusBadge`, and last-updated relative time
**And** the row height is exactly 64px (required for virtualizer)
**And** the row is keyboard focusable (`tabIndex=0`); Enter/Space activates the session (loads it in the right panel)

**Given** a session is selected
**When** `SessionRow` renders for the active session
**Then** the row has `aria-selected="true"` and a left accent bar in the B2B primary color

**Given** the `SessionList` has `role="listbox"` with `aria-label="Client sessions"`
**When** evaluated
**Then** each `SessionRow` has `role="option"` and the listbox manages keyboard navigation per ARIA Listbox pattern

---

### Story 4.5: StagingGate Component

As a travel agent who has finished preparing a client's proposal,
I want a clear "draft" banner and a staged confirmation flow before the proposal is marked as client-ready,
So that I never accidentally share an unfinished proposal with a client.

**Acceptance Criteria:**

**Given** a session has `status: "pending"` or `status: "modified"` (UX-DR16)
**When** the session is active in `B2BLayout`
**Then** an amber banner renders at the top of the right panel: "Working draft — not yet shared with client"
**And** the banner has `role="banner"` and `aria-live="polite"` so status changes are announced

**Given** the banner renders
**When** inspected
**Then** a "Mark as client-ready →" button (primary action) is present; the button is keyboard-focusable and activates via Enter/Space

**Given** the agent clicks "Mark as client-ready →"
**When** clicked
**Then** a confirmation modal opens (not a toast, not inline confirm — a modal): "Share this proposal with [Client Name]? This cannot be undone without editing." with "Confirm" and "Cancel" buttons
**And** focus moves to the "Cancel" button on modal open (safe default — UX-DR18 focus management)
**And** the modal traps focus (Tab/Shift+Tab cycle between Cancel and Confirm only while modal is open)

**Given** the agent confirms in the modal
**When** "Confirm" is clicked
**Then** `PATCH /api/v1/advisory_sessions/{id}/status` is called with `{ status: "confirmed" }`
**And** on success: the amber banner disappears; a green "Shared with client" banner appears briefly; `aria-live="polite"` announces "Session confirmed and shared with client"
**And** focus returns to the trigger button's position (triggerRef pattern — UX-DR18)

**Given** the agent cancels the modal
**When** "Cancel" is clicked or Escape is pressed
**Then** the modal closes; focus returns to the "Mark as client-ready →" button (triggerRef pattern)
**And** no API call is made

**Given** a session is in `status: "confirmed"` and the agent edits a card
**When** the edit triggers targeted regeneration (Story 3.9)
**Then** the session status is automatically updated to `"modified"` via the API (ARCH-7)
**And** the amber staging banner reappears; `aria-live` announces "Session returned to draft"

**Given** a session has `status: "flagged"`
**When** the session is active
**Then** the amber staging banner is replaced by a red `role="alert"` banner: "Flagged: [flag_reason]"
**And** the "Mark as client-ready →" button is absent — a flagged session cannot be confirmed until the flag is resolved
