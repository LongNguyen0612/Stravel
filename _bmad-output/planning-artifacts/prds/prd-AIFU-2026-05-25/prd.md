---
title: "PRD — STravel Chat-First UI: Conversational Advisory Interface"
status: draft
created: 2026-05-25
updated: 2026-05-25
---

# PRD: STravel Chat-First UI

## 0. Document Purpose

This PRD defines requirements for replacing STravel's static prefill form with a chat-first, card-driven conversational interface. It scopes the MVP feature set and one follow-on phase. It is written for downstream UX design, architecture delta, and epic/story creation. It builds on the brainstorming session at `_bmad-output/brainstorming/brainstorming-session-2026-05-25-2200.md` and the platform PRD at `_bmad-output/planning-artifacts/prds/prd-AIFU-2026-05-24/prd.md`.

---

## 1. Problem Statement

The current STravel interface requires users to complete a 12-field form before the AI advisor can respond. This creates three compounding problems:

1. **Front-loaded cognitive load.** Users must know what they want before the system helps them discover what they want. Destination, dates, budget, dietary requirements, and passport expiry are all demanded upfront.
2. **Dead silence.** The system waits passively for form completion. There is no engagement, guidance, or progressive value until the user clicks "Run Analysis."
3. **Archaeology problem.** Once the workflow runs, results appear as a wall of markdown text in a sidebar. Critical trip details — itinerary, budget breakdown, compliance flags — are buried in scrollback and cannot be individually edited without restarting.

Research confirms these are the leading failure modes in conversational travel UX: capability ambiguity, looping/brittleness, and the archaeology problem. The fix is a chat-first interface where the bot leads, cards replace text input, and proposals are interactive artifacts — not read-only text.

---

## 2. Vision

**The bot has an opinion. The user's job is to refine it — not create from scratch.**

STravel's advisor opens a conversation the moment a user lands. It asks one question at a time, offers opinionated suggestions as tappable cards, and — for users who just want to go — proposes a trip immediately and refines it through correction. The result is a structured, interactive proposal card deck, not a markdown document.

---

## 3. Users

### 3.1 Primary — Self-Serve Traveler (B2C)

A traveler planning a Vietnam trip independently. Mobile-first. Likely on a phone. May be browsing casually before committing. Has limited patience for forms but is open to guided conversation.

**Goal:** Get from "I want to go somewhere in Vietnam" to a verified, actionable trip proposal in under 3 minutes.
**Pain:** Current form requires deliberate effort upfront. No guidance on what's reasonable for budget, dates, or destinations.

### 3.2 Secondary — Travel Agent Copilot (B2B)

A travel agent using STravel while on a call with a client. The chat interface serves as a structured intake tool — bot asks the right questions, agent feeds in client answers, proposal is generated in real time.

**Goal:** Complete a client profile and generate a proposal during a 10-minute intake call.
**Pain:** Current form requires the agent to gather all data before the system produces anything useful.

---

## 4. User Journeys

### UJ-1: Propose-First (Decisive Traveler)

1. User lands on STravel. Bot greets: *"Where are you thinking of going in Vietnam?"*
2. User types or taps a destination card (e.g. Hanoi).
3. Bot immediately proposes: *"Here's a 3-day Hanoi trip for ~$1,200. Does this match what you had in mind?"*
4. User corrects: *"Actually 5 days and budget is $2,000."*
5. Bot adjusts the proposal card deck in real-time, streaming the updated itinerary.
6. User taps ✏️ on the Hotel card to swap style from mid-range to luxury. Bot regenerates that card only.
7. Compliance cards surface passport and visa status. All green. User receives a complete, shareable proposal.

### UJ-2: Card-Guided (Exploratory Traveler)

1. Bot greets and shows mood cards: `Adventurous · Relaxed · Romantic · Cultural · Off-grid`.
2. User taps `Relaxed`. Bot shows destination cards matching that mood: `Phu Quoc · Hoi An · Da Lat`.
3. User taps `Hoi An`. Bot shows date picker card inline — user selects Jun 10–15.
4. Bot shows budget slider card. User drags to $1,500.
5. Bot asks dietary preference via multi-select cards. User taps `Vegetarian`.
6. Profile complete. Bot auto-triggers analysis — no "Run" button needed.
7. Proposal streams word-by-word. Stage narrator shows: *"⏳ Calculating budget… 🗺️ Routing… ✍️ Writing your proposal…"*
8. Proposal appears as interactive card deck.

### UJ-3: Returning User

1. User returns. Bot recognises them: *"Welcome back! Last time you were planning Phu Quoc for 4 days. Continue that or start fresh?"*
2. User taps `Start fresh`. Spotify-style idle cards appear: *"New trip?" · "Trending: Hoi An in June" · "Your last budget: $1,500 — try again?"*
3. User taps a suggestion card and enters UJ-1 or UJ-2 flow.

---

## 5. Features

### Feature Group A — Conversation-First Entry

**FR-A1: Idle State Bot Greeting**
The idle state renders a bot message and open prompt the moment a user lands. No form, no instructions. Default greeting: *"Hi! Where are you dreaming of going in Vietnam?"*
- The chat input is active and focused immediately.
- [ASSUMPTION] Unauthenticated users are shown the greeting; profile memory requires authentication.

**FR-A2: Mood-First Entry Option**
On first message, the bot optionally surfaces 5 mood cards before destination: `Adventurous · Relaxed · Romantic · Cultural · Off-grid`. Mood selection infers destination and activity preference defaults passed to the profiling stage.
- Bot presents mood cards when the user's first message is ambiguous (e.g. "I don't know where to go").
- Mood-to-destination mapping is configurable.

**FR-A3: Propose-First Flow**
When the user provides a destination (and optionally a budget or duration) in their first message, the bot generates an opinionated draft proposal immediately rather than completing a full profile first.
- Draft proposal uses inferred defaults for missing fields: 3-day duration, mid-range accommodation, USD 1,200 base budget.
- All `[ASSUMPTION]` fields are surfaced as editable cards on the proposal.
- User corrects by replying naturally or tapping edit on a card; bot regenerates the affected card only.
- Full profile is reconstructed from corrections — no separate profile form shown.

**FR-A4: Returning User Memory**
Authenticated returning users are greeted with session history on landing.
- Bot surfaces: last destination, last dates, last budget.
- Options: `Continue last session` · `Start fresh`.
- "Start fresh" triggers Spotify-style personalised idle cards (FR-A5).

**FR-A5: Personalised Idle Cards**
On idle or "Start fresh", the bot surface 3 contextual suggestion cards based on session history and trending destinations.
- Cards: `Resume [last trip]` · `Trending: [destination] in [month]` · `Your last budget: [amount] — plan again?`
- [ASSUMPTION] Trending data is manually curated initially; algorithmic ranking is Phase 2.

---

### Feature Group B — Card-Driven Input System

**FR-B1: Single-Question Progressive Disclosure**
The bot asks one question per turn. It never presents more than one question at a time in the active conversation thread.
- Each bot question is accompanied by its corresponding input card where applicable (see FR-B2 through FR-B6).
- Text input remains available as an alternative for all card interactions.

**FR-B2: Destination Cards**
When asking for destination, bot renders tappable destination cards (up to 6) relevant to the current context (mood, season, budget range).
- Cards show: destination name, a one-line description, estimated cost tier.
- Tapping a card confirms the selection and collapses the card to a confirmation bubble.
- "Surprise me" is always a card option — bot selects and explains its choice.

**FR-B3: Inline Calendar Card**
When asking for travel dates, bot renders a mini calendar card inline in the chat thread.
- User taps start date, then end date. Duration is auto-calculated and confirmed.
- No modal, no page navigation — entire interaction stays in the chat thread.

**FR-B4: Budget Slider Card**
When asking for budget, bot renders an interactive horizontal slider card.
- Range: USD 200 – USD 10,000. Step: USD 100.
- Slider shows real-time label: *"$1,500 — comfortable mid-range for 2 people, 4 days"*.
- Confirmed with a tap or "Looks good" message.

**FR-B5: Multi-Select Cards**
Dietary requirements, activity preferences, and accessibility needs are collected via multi-select card grids.
- Cards are tappable toggles. Selected state visually distinct.
- `No restrictions` / `None` option deselects all others when tapped.
- Confirmed with a "Done" tap or natural language confirmation.

**FR-B6: Passport Photo Upload Card**
When asking for passport expiry, bot offers: *"Type the date or upload a photo of your passport — I'll read it for you."*
- Upload triggers OCR extraction of expiry date.
- Extracted date shown for user confirmation before saving.
- Manual text fallback always available.
- [ASSUMPTION] OCR is implemented via a backend vision endpoint; passport image is not stored.

**FR-B7: "Surprise Me" Option**
Every card-based selection step includes a `Surprise me` option.
- Bot selects the option and provides a 1-sentence rationale.
- User can override immediately without penalty.

**FR-B8: Zero-Typing Profile Completion**
A user must be able to complete a full traveler profile — from idle to confirmed — using only card taps. No keyboard input required at any step.
- Verified by a documented test path through all required fields using only card interactions.

---

### Feature Group C — Proposal as Interactive Card Deck

**FR-C1: Proposal Card Deck**
The final advisory output renders as a structured deck of cards, not a markdown text block.

Card types and content:

| Card Type | Content |
|-----------|---------|
| `DayCard` | Day number, location, activities, estimated cost |
| `HotelCard` | Hotel name, style, price range, booking link placeholder |
| `BudgetCard` | Total cost + expandable breakdown (flights, hotels, activities, food, insurance, buffer) |
| `ComplianceCard` | Severity badge (🔴/🟡/🟢), check name, message, CTA action |
| `BookingCard` | Key booking actions with deadlines |

- Each card defaults to collapsed preview. Tap to expand full detail.
- Card deck is scrollable within the chat thread.

**FR-C2: Inline Card Editing**
Each proposal card includes an ✏️ edit affordance.
- Tapping ✏️ reopens that card's corresponding bot question in the chat thread.
- Bot regenerates only the affected card(s) after the user responds.
- Unchanged cards are not re-generated.

**FR-C3: Compliance Inline Badges**
Compliance status is surfaced inline on `DayCard` and `HotelCard` where relevant.
- A small dot badge: 🟢 pass / 🟡 warning / 🔴 block — visible without expanding the card.
- Tapping the badge scrolls to the relevant `ComplianceCard`.

**FR-C4: Budget Drill-Down**
`BudgetCard` expands to show itemised breakdown.
- Each line item (flights, accommodation, activities, food, transport, insurance, buffer) is editable.
- Editing a line item re-balances the remaining allocation proportionally and updates the total.

---

### Feature Group D — Real-Time Feedback

**FR-D1: Live Proposal Streaming**
Proposal text streams word-by-word as the LLM generates it, rendered within the chat thread.
- Streaming uses the existing SSE infrastructure.
- Cards appear progressively as each section completes (DayCards before BudgetCard before ComplianceCards).

**FR-D2: Stage Narrator in Typing Indicator**
While the AI processes, the typing indicator cycles through stage-specific messages:
- `⏳ Reading your profile…`
- `💰 Calculating budget…`
- `🗺️ Optimising your route…`
- `✍️ Writing your proposal…`
- `✅ Running compliance checks…`
- Messages rotate every 3–5 seconds, tied to actual backend stage events where available.

**FR-D3: Journey Progress Bar**
A persistent horizontal progress indicator at the top of the chat:
`Profile · Budget · Proposal · Review`
- Each stage highlights as it completes.
- Tapping a completed stage scrolls the chat to that stage's content.
- Hidden in idle state; appears on first bot question.

**FR-D4: Auto-Trigger Analysis**
When the bot determines the profile is complete, it begins the advisory workflow automatically.
- No "Run Analysis" / "Start AI Analysis" button required.
- Bot confirms before triggering: *"I have everything I need — generating your proposal now."*
- The existing manual run endpoint remains available as a fallback for the B2B copilot flow.

---

### Feature Group E — Unified Canvas

**FR-E1: Single-Column Chat Interface**
The split-panel layout (SessionPanel left, CopilotSidebar right) is replaced by a single full-width chat thread.
- Profile collection, proposal display, and compliance checks all appear as messages and cards within one scrollable thread.
- The existing sidebar layout is retained as an opt-in "agent mode" for B2B users who prefer the split view.
- [ASSUMPTION] Agent mode toggle is a user-level setting, persisted in localStorage initially.

**FR-E2: Animated Stage Transitions**
Visual animations play when the workflow transitions between stages.
- Cards slide in from below on appearance.
- Progress bar fills with a smooth transition.
- Stage label in the typing indicator morphs between states.
- Animations respect `prefers-reduced-motion`.

---

## 6. Non-Functional Requirements

**NFR-1: Time-to-First-Card**
The bot's first message and at least one card option must appear within 500ms of page load for authenticated users; 1s for unauthenticated.

**NFR-2: Time-to-Proposal**
End-to-end from profile-complete trigger to first streamed proposal token: ≤ 5s on the existing Ollama backend. Streaming must begin within 5s even if the full proposal takes longer.

**NFR-3: Mobile-First Responsive**
All card types must be fully functional on screens ≥ 375px wide. Cards must not require horizontal scrolling. Tap targets ≥ 44×44px.

**NFR-4: Accessibility**
All interactive cards must be keyboard-navigable and screen-reader-compatible (ARIA roles for card state, expanded/collapsed, selected).
Animations comply with `prefers-reduced-motion`.

**NFR-5: SSE Compatibility**
The card-streaming implementation must not break the existing SSE proxy configuration in `vite.config.ts` (no buffering, `x-accel-buffering: no`, `setNoDelay`).

**NFR-6: No New Backend APIs Required for MVP**
MVP card-driven UI is built on existing API endpoints (`/api/v1/advisory_sessions`, `/api/v1/stream`). The passport OCR endpoint (FR-B6) and voice input (post-MVP) are the only new backend requirements.

---

## 7. Success Metrics

| Metric | Baseline (current) | MVP Target |
|--------|-------------------|------------|
| Session completion rate (profile confirmed → proposal received) | [ASSUMPTION: ~40%] | ≥ 65% |
| Time-to-proposal (landing → proposal visible) | [ASSUMPTION: ~5–8 min] | ≤ 3 min |
| Profile completion via card-only (no keyboard) | 0% | ≥ 60% of sessions |
| Proposal edit rate (at least one card edited) | 0% (editing not possible) | ≥ 25% |
| Returning user session start rate | [ASSUMPTION: low] | +30% vs. baseline |

**Counter-metrics** (watch for regressions):
- Proposal quality score (human-rated) must not drop vs. form-based baseline.
- Backend LLM call count per session must not increase > 20% (card edits trigger targeted re-generation, not full reruns).

---

## 8. Out of Scope (Post-MVP)

The following ideas from the brainstorming session are confirmed out of scope for this PRD:

- **Voice input** (#16) — requires new backend speech-to-text endpoint; deferred to Phase 2.
- **Chat + Map hybrid** (#18) — significant additional component work; Phase 2.
- **Duolingo streak / gamification** (#20) — requires user profile system beyond current scope.
- **B2B Copilot mode as distinct product** (#25) — the `agent mode` toggle (FR-E1) is the MVP bridge; full B2B mode is a separate initiative.
- **Shareable travel brief** (#24) — Phase 2 after proposal card deck is stable.
- **Algorithmic trending destinations** — Phase 2; manually curated list for MVP.

---

## 9. Open Questions

| # | Question | Owner | Blockers |
|---|----------|-------|---------|
| OQ-1 | What is the actual session completion rate baseline? Needs analytics instrumentation before A/B test is meaningful. | Fred | No analytics currently in place |
| OQ-2 | Passport OCR: use a third-party vision API (Google Vision, AWS Textract) or the existing Ollama vision model? Cost and accuracy tradeoff. | Fred | Decision needed before FR-B6 story |
| OQ-3 | Should the Propose-First flow (FR-A3) replace the card-guided flow entirely, or run as a parallel path? Current PRD specifies parallel — confirm. | Fred | — |
| OQ-4 | Agent mode (split-panel) retention: is there a B2B user segment actively using the current layout? If not, the toggle adds complexity for no gain. | Fred | — |

---

## 10. Phasing

### Phase 1 — MVP (this PRD)
Core conversation paradigm shift. Deliverable: users can complete a full advisory session via chat + cards, no form required.

- FR-A1 Silent Waiter / Idle Bot
- FR-A2 Mood-First Entry
- FR-A3 Propose-First Flow
- FR-B1–B8 Full Card-Driven Input System
- FR-C1–C3 Proposal Card Deck + Inline Edit + Compliance Badges
- FR-D1–D4 Streaming + Stage Narrator + Progress Bar + Auto-Trigger
- FR-E1 Unified Canvas (with agent mode toggle)

### Phase 2 — Delight & Growth
- FR-A4–A5 Returning User Memory + Personalised Idle Cards
- FR-C4 Budget Drill-Down
- FR-E2 Animated Stage Transitions
- Voice input, Map hybrid, Shareable brief, Gamification

---

## Appendix: Brainstorming Ideas Reference

Full idea inventory in `_bmad-output/brainstorming/brainstorming-session-2026-05-25-2200.md`.

Ideas mapped to FRs:

| Brainstorming ID | Idea | FR |
|---|---|---|
| #1 | Silent Waiter | FR-A1 |
| #2 | Progressive Disclosure Bot | FR-B1 |
| #3 | Memory Bot | FR-A4 |
| #4 | Suggestion-First Flow | FR-B2 |
| #5 | Mood-First Planning | FR-A2 |
| #6 | Budget Slider Card | FR-B4 |
| #7 | Passport Photo Card | FR-B6 |
| #8 | Calendar Drop-in Card | FR-B3 |
| #9 | Surprise Me Card | FR-B7 |
| #10 | Zero-Typing Workflow | FR-B8 |
| #11 | Live Proposal Streaming | FR-D1 |
| #12 | Proposal as Card Deck | FR-C1 |
| #13 | Inline Edit Cards | FR-C2 |
| #14 | Compliance Badge Cards | FR-C3 |
| #15 | Typing Indicator as Stage Narrator | FR-D2 |
| #17 | Journey Progress Bar | FR-D3 |
| #19 | Compliance inline on proposal | FR-C3 |
| #21 | Spotify Idle Cards | FR-A5 |
| #22 | Budget Drill-Down | FR-C4 (Phase 2) |
| #23 | Animated Stage Transitions | FR-E2 (Phase 2) |
| #26 | Kill Run Button | FR-D4 |
| #27 | Kill the Sidebar | FR-E1 |
| #28 | Propose First, Refine After | FR-A3 |
| #29 | User Asks the Bot | FR-B1 |
