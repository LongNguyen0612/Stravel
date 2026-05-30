# Story 9.8: Progressive Proposal Streaming

Status: done

## Story

As a traveler waiting for my proposal,
I want to see each card appear and fill in progressively as the AI writes it,
So that I feel the AI is actively working rather than staring at a blank screen for 60 seconds.

## Acceptance Criteria

**AC1 — Nascent placeholders on stream start**
Given the SSE stream begins for proposal generation (FR-D1) (i.e., `ssePhase` transitions to `'streaming'`)
When the first SSE event arrives
Then all 5 expected card placeholders appear in `nascent` state simultaneously (amber shimmer, no content)
And they are rendered via the `CardDeck` component inside `CardDeckZone`

**AC2 — Transition to forming**
Given SSE delta events (`card.update`) arrive for a card
When `completeness_score` crosses 0.25
Then the card transitions to `forming`: structural fields appear, amber border, `scale-[0.98]`, read-only

**AC3 — Transition to settled**
Given `is_final: true` arrives for a card with `completeness_score ≥ 0.75`
When the event is processed
Then the card transitions to `settled` with 420ms spring animation (or instant + 150ms opacity if `prefers-reduced-motion`)

**AC4 — 90s stall fallback**
Given a card has been in `nascent` state for > 90 seconds without any `forming` events
When the 90s timeout fires
Then the card displays an amber "Taking longer than expected" state with a "Try again" button
And clicking "Try again" calls `connect(sessionId)` to reconnect the SSE stream
And the SSE stream is NOT disconnected by the timeout itself

**AC5 — will-change performance gating**
Given the CardDeck renders with >3 nascent cards simultaneously
When measured
Then only 3 cards have `will-change: transform` active (shimmer animation enabled)
And additional nascent cards beyond 3 use `will-change: auto` (shimmerEnabled=false)

**AC6 — Proposal-ready announcement**
Given the full proposal stream completes (`ssePhase` transitions to `'complete'`)
When the phase change is detected
Then the `aria-live` sentinel announces "Your trip proposal is ready"
And a stage-narrator message is added to the conversation: "🎉 Your proposal is ready! Scroll up to review your trip."
And the demo CardDeckZone button/TravelCard (demoScore) is no longer shown

## Tasks / Subtasks

- [x] Task 1: Replace demo card with live CardDeck in DemoPage
  - [x] 1.1: Remove `demoScore` state (App.tsx ~line 334) and the demo TravelCard + "Advance score" button from CardDeckZone (~lines 888-905)
  - [x] 1.2: Add `CardDeck` and `CardType` to imports: `import { CardDeck } from "./components/cards"` and `import type { SlotKey, CardType, CardUpdateEvent } from "./types/domain"`
  - [x] 1.3: Define `PROPOSAL_CARD_TYPES: CardType[]` constant above DemoPage function body: `['flight', 'hotel', 'activities', 'budget', 'compliance']`
  - [x] 1.4: Derive `isProposing` and `displayCards` in DemoPage body (see Dev Notes for exact derivation)
  - [x] 1.5: Render `<CardDeck>` inside CardDeckZone when `isProposing`, wired to `displayCards`, `sessionId`, `sseState.assumedSlots`, and `hasComplianceBlock` (see Dev Notes for props)

- [x] Task 2: Wire onRetry in CardDeck → connect
  - [x] 2.1: Add `onRetry?: () => void` to `CardDeckProps` interface in `CardDeck.tsx`
  - [x] 2.2: Pass `onRetry={onRetry}` to each `TravelCard`'s `onRetry` prop in CardDeck's render loop
  - [x] 2.3: In DemoPage, pass `onRetry={() => { if (sessionId) connect(sessionId); }}` to `CardDeck`

- [x] Task 3: aria-live announcement on proposal complete
  - [x] 3.1: Add `prevSsePhaseRef = useRef(sseState.ssePhase)` near `isConfirmingRef` (App.tsx ~line 358)
  - [x] 3.2: Add `useEffect` that detects `sseState.ssePhase` transitioning to `'complete'`: set `sentinelText('Your trip proposal is ready')` and append a stage-narrator message (see Dev Notes)

- [x] Task 4: Write tests — new file `DemoPage.proposalStreaming.test.tsx`
  - [x] 4.1: Test AC1 — when `status='proposing'`, 5 cards rendered via CardDeck mock; each starts with score=0
  - [x] 4.2: Test AC1 — when `ssePhase='streaming'` (without status), cards still render (streaming guard)
  - [x] 4.3: Test AC2/AC3 — when `cardUpdates` contains a real card, that card replaces its placeholder; partial updates preserve remaining placeholders
  - [x] 4.4: Test AC1 — 5 expected card types are all present; CardDeck data-card-count=5
  - [x] 4.5: Test AC6 — when ssePhase transitions from 'streaming' to 'complete' (rerender), aria-live region contains "Your trip proposal is ready"
  - [x] 4.6: Test AC6 — stage-narrator message appears; starting from complete does NOT re-fire sentinel

### Review Findings (AI)

- [x] [Review][Patch] `onRetry` silently no-ops when `sessionId` is null — when a TravelCard stalls and the user clicks "Try again", the guard `if (sessionId) connect(sessionId)` does nothing if `sessionId` is null with no user feedback. [App.tsx:929] — fixed: fallback to `setErrorSentinelText("Something went wrong. Please refresh the page.")`
- [x] [Review][Defer] Settle-timer race in CardDeck — when `allSettled` flips true→false within 500ms, previously-scheduled `committing` transition may fire before cleanup runs [CardDeck.tsx:48] — deferred, pre-existing from story 9-6
- [x] [Review][Defer] `handleAuthorshipSave` fire-and-forget — `api.userPreferences.saveTripName` rejection is silently swallowed; trip name lost with no user feedback [CardDeck.tsx:94] — deferred, pre-existing from story 9-6
- [x] [Review][Defer] `realCardsByType` deduplication by type — if the backend emits two cards of the same type with distinct `card_id`s, only the last survives; first is silently dropped [App.tsx:397] — deferred, design decision (one card per type per spec)
- [x] [Review][Defer] Five concurrent stall timers on placeholder cards — all 5 placeholders start the 90s stall timer at mount; if the backend is slow all 5 simultaneously show "Try again", triggering multiple `connect()` calls [TravelCard.tsx:~372] — deferred, pre-existing TravelCard behavior from story 9-6

## Dev Notes

### Architecture Overview

Story 9-8 wires the existing `CardDeck` component (built in story 9-6) to the live `sseState` from `useStreamContext` (already in DemoPage since story 9-7). The main change is in `DemoPage` in `App.tsx`: replace the demo `TravelCard`/`demoScore` stub with a real `CardDeck` driven by `sseState.cardUpdates`.

No new files are needed beyond the test file. Two existing files require minor additions: `CardDeck.tsx` (add `onRetry` forwarding) and `App.tsx` (wire it up).

**Data flow:**
```
SSE → useStreamContext → dispatch CARD_UPDATE → streamReducer.cardUpdates
                       → dispatch SSE_PHASE_CHANGE('complete') [on stage complete]
DemoPage derives:
  displayCards = PROPOSAL_CARD_TYPES.map(type => realCardsByType[type] ?? placeholder)
  → <CardDeck cards={displayCards} />
```

### File Locations

- **`stravel/frontend/src/App.tsx`** — DemoPage component. Remove `demoScore` state (~line 334). Add `PROPOSAL_CARD_TYPES`, `isProposing`, `displayCards`, `prevSsePhaseRef` (~lines 355-365). Add useEffect for proposal-ready sentinel. Replace CardDeckZone content (~lines 888-905).
- **`stravel/frontend/src/components/cards/CardDeck.tsx`** — Add `onRetry` to `CardDeckProps` and forward to each TravelCard.
- **`stravel/frontend/src/components/cards/index.ts`** — Already exports `CardDeck` — no change needed.
- **`stravel/frontend/src/__tests__/DemoPage.proposalStreaming.test.tsx`** — New test file (see Test Patterns below).

### State and Hook Usage

`sseState` comes from `useStreamContext()` (already destructured in DemoPage as `const { connect, state: sseState } = useStreamContext()`):
- `sseState.status: WorkflowStage` — `'proposing'` is dispatched by `handleAutoTriggerConfirm` via `dispatchStream({ type: 'STAGE_CHANGE', payload: 'proposing' })` in story 9-7. This goes to `streamState` (DemoPage's own useReducer), NOT sseState. **IMPORTANT**: See the two-reducer note below.
- `sseState.ssePhase: SSEPhase` — set to `'streaming'` on CONNECTED, `'complete'` on `stage.change → complete`
- `sseState.cardUpdates: Record<string, CardUpdateEvent>` — accumulated by CARD_UPDATE actions from `card.update` SSE events
- `sseState.assumedSlots: string[]` — available for propose-first assumed values
- `sseState.complianceFlags: ComplianceFlag[]` — used for `hasComplianceBlock` prop

### Two-Reducer Architecture (CRITICAL)

DemoPage has TWO separate stream states:
1. `streamState` from `useReducer(streamReducer, initialStreamState)` — DemoPage's own reducer; tracks slot state, moodCard, etc. The `STAGE_CHANGE` dispatch in `handleAutoTriggerConfirm` goes here.
2. `sseState` from `useStreamContext()` — the hook's internal state; tracks `ssePhase`, `cardUpdates`, `status` (from SSE `stage.change` events).

**Consequence for isProposing:**
`streamState.status` is set to `'proposing'` immediately by `handleAutoTriggerConfirm` (optimistic update, before SSE confirms). `sseState.ssePhase` becomes `'streaming'` when the SSE connection opens. The display condition should use BOTH:
```ts
const isProposing = streamState.status === 'proposing'
  || sseState.ssePhase === 'streaming'
  || sseState.ssePhase === 'complete';
```
This covers: optimistic display (streamState), live streaming (ssePhase=streaming), and already-done sessions (ssePhase=complete).

**For `displayCards`**, use `sseState.cardUpdates` (the SSE hook's state, not streamState):
```ts
const realCardsByType = Object.fromEntries(
  Object.values(sseState.cardUpdates).map(c => [c.type, c])
);
const displayCards: CardUpdateEvent[] = PROPOSAL_CARD_TYPES.map(type =>
  realCardsByType[type] ?? {
    card_id: type,
    type: type as CardType,
    completeness_score: 0,
    delta: {},
    is_final: false,
  }
);
```
Type `CardUpdateEvent` is from `./types/domain`. `CardType` is from `./types/domain`.

### CardDeck Props to Wire

```tsx
<CardDeck
  cards={displayCards}
  sessionId={sessionId ?? undefined}
  assumedSlots={sseState.assumedSlots}
  hasComplianceBlock={sseState.complianceFlags.some(f => f.severity === 'block')}
  onCardEdit={(cardId) => {
    // Story 9-9 will implement inline card editing
    console.log('[CardDeck] edit requested for', cardId);
  }}
  onRetry={() => {
    if (sessionId) connect(sessionId);
  }}
/>
```

Note: `onComplianceBadgeTap` and `onAssumedBadgeTap` are not required for this story — story 9-10 handles compliance badge taps; story 9-4's `proposeFirst` flow handles assumed slot taps. Leave them unset (undefined) for now.

### Adding onRetry to CardDeck

**CardDeck.tsx** change — add to interface and forward:
```ts
// In CardDeckProps:
onRetry?: () => void;

// In function signature:
export function CardDeck({ cards, sessionId, onBook, onCardEdit, onComplianceBadgeTap,
  onAssumedBadgeTap, assumedSlots, hasComplianceBlock = false, className, onRetry }: CardDeckProps) {

// In the cards.map() render:
<TravelCard
  ...
  onRetry={onRetry}
/>
```

`TravelCard` already accepts `onRetry?: () => void` and calls it when the "Try again" button is clicked (displayed when the card has been in nascent state for 90s via its internal `STALL_TIMEOUT_MS = 90_000` timer).

### Stall Timeout (AC4)

`TravelCard` already implements the 90s stall internally:
```ts
const STALL_TIMEOUT_MS = 90_000;
// ...
useEffect(() => {
  const state = cardDisplayState(completenessScore, isFinal);
  if (state !== 'nascent') return;
  const timer = setTimeout(() => setIsStalled(true), STALL_TIMEOUT_MS);
  return () => clearTimeout(timer);
}, [completenessScore, isFinal]);
```
When stalled, `displayState` becomes `'error'` and TravelCard renders "Taking longer than expected" + "Try again" button. The timer clears automatically when completeness_score updates (card progresses). Story 9-8 just needs to wire `onRetry` through CardDeck (Task 2) — no new stall logic needed in DemoPage.

### Shimmer Performance Gating (AC5)

`CardDeck` already implements shimmer gating via:
```ts
const shimmerMap: Record<string, boolean> = {};
let shimmerCount = 0;
for (const card of cards) {
  const isNascent = card.completeness_score < 0.25 && !card.is_final;
  if (isNascent && shimmerCount < 3) {
    shimmerMap[card.card_id] = true;
    shimmerCount++;
  } else {
    shimmerMap[card.card_id] = false;
  }
}
```
This is already correct for UX-DR23. No changes needed in CardDeck for this.

### aria-live Announcement on Proposal Complete (Task 3)

Add a `prevSsePhaseRef` near `isConfirmingRef` to detect transitions:
```ts
const prevSsePhaseRef = useRef(sseState.ssePhase);
```

Add a `useEffect` after the existing state declarations:
```ts
useEffect(() => {
  if (prevSsePhaseRef.current !== 'complete' && sseState.ssePhase === 'complete') {
    setSentinelText('Your trip proposal is ready');
    setMessages(prev => [
      ...prev,
      { role: 'stage-narrator', content: '🎉 Your proposal is ready! Scroll up to review your trip.' },
    ]);
  }
  prevSsePhaseRef.current = sseState.ssePhase;
}, [sseState.ssePhase]);
```

The `sentinelText` drives the existing `aria-live="polite"` div in the DemoPage render — look for `sentinelStyle` and the related render block. Setting `sentinelText` causes it to announce to screen readers.

### Test Patterns for DemoPage.proposalStreaming.test.tsx

Follow the pattern from `DemoPage.autoTrigger.test.tsx` exactly:
- Same mock structure for `useStreamContext`
- Use `let mockSsePhase`, `let mockSseStatus`, `let mockCardUpdates` variables controlled by tests
- For AC5 shimmer test: render with `cards={displayCards}` where all 5 are nascent → assert that cards with class `will-change-transform` appear at most 3 times. But since DemoPage renders the CardDeck internally, you'll need to query for `[data-testid="card-deck"]` and count shimmer children

Key mock shape needed:
```ts
let mockSsePhase: 'idle' | 'streaming' | 'complete' | 'error' = 'idle';
let mockSseStatus = 'idle';
let mockCardUpdates: Record<string, unknown> = {};
let mockAssumedSlots: string[] = [];
let mockComplianceFlags: unknown[] = [];

vi.mock('../hooks/useStreamContext', () => ({
  useStreamContext: () => ({
    connect: mockConnect,
    state: {
      ssePhase: mockSsePhase,
      status: mockSseStatus,
      isConnected: false,
      messages: [],
      complianceFlags: mockComplianceFlags,
      cardUpdates: mockCardUpdates,
      error: null,
      slotState: {},
      assumedSlots: mockAssumedSlots,
      openSlotKey: null,
    },
    disconnect: vi.fn(),
    hydrateFromHistory: vi.fn(),
    proposeFirst: vi.fn(),
    openSlotCard: vi.fn(),
    removeAssumedSlot: vi.fn(),
  }),
}));
```

For AC6 transition test (ssePhase idle → streaming → complete), use `rerender()`:
```ts
const { rerender } = render(<DemoPage />);
// First render: streaming
mockSsePhase = 'streaming';
mockSseStatus = 'proposing';
rerender(<DemoPage />);

// Simulate completion
mockSsePhase = 'complete';
mockSseStatus = 'complete';
await act(async () => { rerender(<DemoPage />); });

// aria-live region should announce
expect(screen.getByText(/your trip proposal is ready/i)).toBeInTheDocument();
```

### Imports to Add in App.tsx

Add `CardDeck` to the existing cards import (already has TravelCard):
```ts
import { TravelCard, CardDeck } from "./components/cards";
```

Add `CardType` to the domain types import:
```ts
import type { SlotKey, CardType } from "./types/domain";
```

Add constant above `DemoPage` function (with other constants like `EDIT_SLOT_OPTIONS`):
```ts
const PROPOSAL_CARD_TYPES: CardType[] = ['flight', 'hotel', 'activities', 'budget', 'compliance'];
```

### Imports to Add in DemoPage.proposalStreaming.test.tsx

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DemoPage } from '../App';
```

All DemoPage test files require these mocks (copy from DemoPage.autoTrigger.test.tsx):
- `react-markdown`
- `useFooterHeight`
- `TravelCard` (not needed here since CardDeck is being tested — but may need it if CardDeck is not mocked)
- `messageClassifier` (classifyMessage + classifyBuildTripIntent)
- `useStreamContext` (with variable mock state as shown above)
- `api` (for sessions.run, sessions.create)

**Note on TravelCard mock vs real component**: In this test file, we want to test CardDeck rendering actual TravelCard children to verify card states. Do NOT mock TravelCard — let CardDeck render real TravelCards so we can assert on `role="article"` and `aria-label`. Keep the mock for the standalone TravelCard mock only in tests where DemoPage's demo card was being tested.

### Anti-Patterns to Avoid

- **Do NOT** read from `streamState.cardUpdates` for proposal display — `streamState` is DemoPage's own useReducer and never receives `CARD_UPDATE` actions. Always use `sseState.cardUpdates`.
- **Do NOT** read from `streamState.ssePhase` for the isProposing guard — same reason. Use `sseState.ssePhase`.
- **Do NOT** use `streamState.status` as the only guard for `isProposing` — it's optimistic and won't cover reconnects where `streamState` is reset but `sseState` still says streaming.
- **Do NOT** add `BookingCard` to `PROPOSAL_CARD_TYPES` placeholders — it only appears when CardDeck enters `committing` state (all cards settled). CardDeck handles BookingCard rendering internally.
- **Do NOT** generate card_ids as UUIDs for placeholders — use the card type string (`'flight'`, `'hotel'`, etc.) as card_id. When real SSE events arrive, they'll have backend-assigned card_ids and will be keyed separately. The merge-by-type logic handles the mapping.
- **Do NOT** remove `demoScore` from `streamState` story test expectations in existing test files — `demoScore` is local state in DemoPage (not in streamState), and it's simply being deleted, so no existing test files reference it via streamState assertions.

### Previous Story Learnings (9-7)

- All DemoPage test files MUST mock both `classifyBuildTripIntent` (in `messageClassifier` mock) and the full `useStreamContext` shape. When adding a new test file, include both mocks from the start.
- The `isConfirmingRef` pattern (useRef for in-flight guard) is clean — use the same ref pattern for `prevSsePhaseRef`.
- `connect(sid)` is safe to call multiple times (idempotent — closes existing EventSource before opening new one). So the retry handler `() => { if (sessionId) connect(sessionId); }` is safe.
- DemoPage's `messages` array uses `{ role: "stage-narrator" }` for narrator-style messages. This is already rendered in ConversationCanvas with different styling. Use this for the "🎉 Your proposal is ready!" message.

### References

- Epic spec: `_bmad-output/planning-artifacts/epics-v2.md` — Story 3.8 (progressive-proposal-streaming)
- `CardDeck` component: `stravel/frontend/src/components/cards/CardDeck.tsx` (read fully before implementation)
- `TravelCard` component: `stravel/frontend/src/components/cards/TravelCard.tsx` — `STALL_TIMEOUT_MS = 90_000` at line 35; stall logic at lines 365-377; error render at lines 428-437
- `cardDisplayState`: `stravel/frontend/src/components/cards/cardUtils.ts:62` — nascent(score<0.25), forming(0.25≤score<0.75), settled(score≥0.75 AND is_final)
- `useStreamContext`: `stravel/frontend/src/hooks/useStreamContext.ts` — `card.update` listener dispatches `CARD_UPDATE`; `stage.change → "complete"` dispatches `SSE_PHASE_CHANGE("complete")`
- `streamReducer` `CARD_UPDATE` case: `stravel/frontend/src/reducers/streamReducer.ts:21` — `cardUpdates: { ...state.cardUpdates, [action.payload.card_id]: action.payload }`
- `CardUpdateEvent` type: `stravel/frontend/src/types/domain.ts` — `{ card_id, type: CardType, completeness_score, delta, is_final }`
- `CardType` type: `stravel/frontend/src/types/domain.ts` — `'flight' | 'hotel' | 'activities' | 'visa' | 'budget' | 'compliance' | 'booking'`
- `CardDeckZone` current render: `stravel/frontend/src/App.tsx:888` — replace inner content only, keep CardDeckZone wrapper
- `sentinelText` aria-live: look for `sentinelStyle` in App.tsx render — it drives the `aria-live="polite"` announcement region
- Prior CardDeck story for test patterns: `_bmad-output/implementation-artifacts/epic-9/9-6-carddeck-state-machine.md`
- Prior autoTrigger story for DemoPage test patterns: `_bmad-output/implementation-artifacts/epic-9/9-7-auto-trigger-analysis.md`

## Dev Agent Record

### Implementation Plan

1. RED: Wrote `DemoPage.proposalStreaming.test.tsx` (13 tests) — all failing since demo card still present and no isProposing logic
2. GREEN: Removed `demoScore` state; added `CardDeck` import + `PROPOSAL_CARD_TYPES` constant; derived `isProposing` (covers streamState.status, sseState.status, ssePhase); derived `displayCards` (merges placeholders + real cardUpdates by type); rendered `<CardDeck>` in CardDeckZone when isProposing; added `onRetry` to CardDeckProps and forwarded to TravelCard; added `prevSsePhaseRef` + `useEffect` for aria-live sentinel
3. REFACTOR: Fixed pre-existing `onClick={handleAutoTriggerConfirm}` type error on "Let's go" button (was passing MouseEvent as boolean param — would have suppressed user bubble); removed unused TravelCard import

### Debug Log

- `isProposing` initially only checked `streamState.status` (DemoPage's own reducer) and `sseState.ssePhase`. Tests that set `mockSseStatus = 'proposing'` failed because `sseState.status` wasn't included in the guard. Fixed by adding `sseState.status === 'proposing'` — also makes the guard more robust for reconnect scenarios.
- `getAllByTestId(/^card-/)` matched `card-deck` container too (6 elements instead of 5). Fixed tests to use explicit per-type assertions or `data-card-count` attribute.

### Completion Notes

- `demoScore` state removed; demo TravelCard/button replaced with real `CardDeck` driven by `sseState.cardUpdates`
- `isProposing` covers: `streamState.status==='proposing'` (optimistic, set in handleAutoTriggerConfirm), `sseState.status==='proposing'` (reconnect confirmation), `ssePhase==='streaming'` (active stream), `ssePhase==='complete'` (hydrated/finished)
- `displayCards` always contains 5 entries: `PROPOSAL_CARD_TYPES` placeholders (score=0, is_final=false) merged with any real `sseState.cardUpdates` keyed by card type
- `onRetry` added to `CardDeckProps` and forwarded to each `TravelCard`; DemoPage passes `connect(sessionId)` as retry handler — triggers SSE reconnect to replay buffered events (story 9-2)
- `prevSsePhaseRef` + `useEffect` detects `idle/streaming → complete` transition; sets `sentinelText` and adds stage-narrator message; does NOT fire if starting from complete (AC6 test 3 verifies)
- Bonus fix: `onClick={() => void handleAutoTriggerConfirm()}` on "Let's go" chip — was `onClick={handleAutoTriggerConfirm}` which passed MouseEvent as first arg, making `skipUserBubble=truthy`, silently suppressing the "Let's go!" user bubble
- 650 tests passing (637 baseline + 13 new)

## File List

- stravel/frontend/src/App.tsx
- stravel/frontend/src/components/cards/CardDeck.tsx
- stravel/frontend/src/__tests__/DemoPage.proposalStreaming.test.tsx (new)

## Change Log

- 2026-05-28: Story created for epic-9 progressive proposal streaming
- 2026-05-28: Implemented — replaced demo TravelCard/demoScore with live CardDeck; added isProposing + displayCards derivation; wired onRetry for SSE reconnect; added proposal-ready aria-live sentinel. Fixed pre-existing "Let's go" onClick type bug. 650 tests passing.
