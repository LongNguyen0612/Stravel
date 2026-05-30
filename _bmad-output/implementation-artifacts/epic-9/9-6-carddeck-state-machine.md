# Story 9.6: CardDeck State Machine & Authorship Moment

Status: done

## Story

As a traveler whose proposal is complete,
I want to see a "Book this trip" action only once all my cards are finalized, and be invited to name my trip,
So that booking is not accessible until the proposal is trustworthy and the experience feels personal.

## Acceptance Criteria

**AC1 — browsing→committing transition**
Given the CardDeck renders a set of proposal cards (UX-DR13)
When ALL cards have `completeness_score ≥ 0.75` AND 500ms has elapsed since the last card settled
Then the CardDeck transitions from `browsing` to `committing` state
And `deckState='committing'` is passed to all child TravelCards

**AC2 — Authorship moment fires on committing entry**
Given the CardDeck enters `committing` state
When the transition fires
Then an authorship panel renders inline in the CardDeck asking "What would you like to name this trip?" with a text input and a "Save" button and a "Skip" link

**AC3 — Trip name saved; BookingCard CTA becomes active**
Given the user types a trip name and clicks "Save"
When submitted
Then the trip name is stored in sessionStorage under key `stravel_trip_name_{sessionId}` (frontend-only for MVP)
And the authorship panel hides
And the `BookingCard` "Book this trip" CTA is active (enabled)

**AC4 — Authorship dismissal allows CTA without name**
Given the user dismisses the authorship prompt (clicks "Skip" or presses Escape)
When dismissed
Then the trip name remains null; the `BookingCard` CTA is still active (unnamed trip is allowed)
And the authorship panel does NOT re-appear in the same `committing` session

**AC5 — Card edit returns deck to browsing; authorship re-queues**
Given the user edits a settled card (triggers targeted re-stream) after CardDeck reached `committing`
When any card's `completeness_score` drops below 0.75 OR `isFinal` becomes false
Then the CardDeck returns to `browsing` state; the BookingCard CTA deactivates
And the authorship panel is reset (re-queues for the next `committing` entry)

**AC6 — axe-core zero violations in both states**
Given `axe-core` runs on the CardDeck in both `browsing` and `committing` states
When evaluated
Then zero WCAG 2.1 AA violations are reported

---

## Tasks / Subtasks

- [x] Task 1: Create CardDeck component with browsing/committing state machine (AC1, AC5)
  - [x] 1.1 Create `stravel/frontend/src/components/cards/CardDeck.tsx` with the interface and state machine logic described in Dev Notes
  - [x] 1.2 Internal state: `deckState: 'browsing' | 'committing'`, `authorshipPending: boolean`
  - [x] 1.3 Derive `allSettled`: every entry in `cards` has `completeness_score ≥ 0.75`
  - [x] 1.4 Implement the 500ms timer via `useRef` + `setTimeout`/`clearTimeout`: timer starts when `allSettled` becomes true, fires transition; timer resets (clears) if `allSettled` becomes false before firing
  - [x] 1.5 Implement browsing→committing: set `deckState = 'committing'`, set `authorshipPending = true` when entering committing
  - [x] 1.6 Implement committing→browsing: when any card drops below 0.75, set `deckState = 'browsing'`, set `authorshipPending = false` (authorship re-queues)
  - [x] 1.7 Implement will-change gating: compute nascent cards (score < 0.25 AND !isFinal); first 3 get `shimmerEnabled={true}`, rest `shimmerEnabled={false}`

- [x] Task 2: Authorship moment panel (AC2, AC3, AC4)
  - [x] 2.1 Render authorship panel when `authorshipPending === true`
  - [x] 2.2 AuthorshipPanel: `role="region"` `aria-label="Name your trip"` `data-testid="authorship-panel"`, input with `aria-label="Trip name"` `data-testid="trip-name-input"`, Save `data-testid="authorship-save"`, Skip `data-testid="authorship-skip"`
  - [x] 2.3 On Save: call `api.userPreferences.saveTripName`, set `authorshipPending = false`
  - [x] 2.4 On Skip (click or Escape keydown): set `authorshipPending = false`
  - [x] 2.5 Focus management: input focused when panel appears; booking CTA focused via `document.querySelector` after resolve

- [x] Task 3: Wire will-change gating (UX-DR23)
  - [x] 3.1 Build `shimmerMap` in render: first 3 nascent cards shimmerEnabled=true, remaining shimmerEnabled=false
  - [x] 3.2 Nascent = `completeness_score < 0.25` AND `!is_final`
  - [x] 3.3 Pass `shimmerEnabled={shimmerMap[card.card_id] ?? false}` to each `TravelCard`

- [x] Task 4: Compliance block integration stub (AC3, Story 3.10 prep)
  - [x] 4.1 Add `hasComplianceBlock?: boolean` prop to `CardDeckProps` (defaults false)
  - [x] 4.2 `bookingCTAActive = deckState === 'committing' && !authorshipPending && !hasComplianceBlock`
  - [x] 4.3 Pass `onBook` to booking card only when `bookingCTAActive`; render `role="alert"` warning when block active in committing state

- [x] Task 5: Trip name persistence helper (AC3)
  - [x] 5.1 Added `api.userPreferences.saveTripName()` storing in sessionStorage with `console.warn` (MVP fallback)
  - [x] 5.2 Added `api.userPreferences.getTripName()` reading from sessionStorage

- [x] Task 6: Export and write tests (AC1–AC6)
  - [x] 6.1 Added `export { CardDeck, CardDeckProps }` to `src/components/cards/index.ts`
  - [x] 6.2 Wrote `__tests__/CardDeck.test.tsx` — 14 tests covering all ACs + state machine transitions
  - [x] 6.3 Wrote `__tests__/CardDeck.axe.test.tsx` — 3 axe tests (browsing, committing+panel, committing+dismissed)
  - [x] 6.4 607 tests passing (0 regressions; +17 new tests)
  - [x] 6.5 `npx tsc --noEmit` — zero new errors (4 pre-existing errors unchanged)

### Review Findings

- [x] [Review][Decision] Single `authorshipPending` flag vs. two-flag spec design — accepted simplification; tests confirm correctness
- [x] [Review][Patch] `allSettled` does not check `is_final` — fixed: `cards.every(c => c.completeness_score >= 0.75 && c.is_final)` [CardDeck.tsx:39]
- [x] [Review][Patch] `sessionId ?? 'unknown'` collision — fixed: guard `if (tripName.trim() && sessionId)` before saveTripName [CardDeck.tsx:86]
- [x] [Review][Patch] `Enter` key not wired to submit authorship — fixed: added `if (e.key === 'Enter') handleAuthorshipSave()` to input onKeyDown [CardDeck.tsx:105]
- [x] [Review][Patch] `document.querySelector` for CTA focus uses global document scope — fixed: uses `containerRef.current?.querySelector(...)` [CardDeck.tsx:57-61]
- [x] [Review][Patch] `sessionStorage.setItem` unguarded + Promise fire-and-forget — fixed: try/catch around setItem in apiClient [apiClient.ts:64-65]
- [x] [Review][Patch] Escape dismissal only wired to input `onKeyDown` — fixed: added onKeyDown Escape handler to authorship-panel div [CardDeck.tsx:113]
- [x] [Review][Patch] No `maxLength` on trip-name input — fixed: `maxLength={100}` [CardDeck.tsx:105]
- [x] [Review][Patch] Double `vi.useRealTimers()` in axe test — dismissed: in-try call is required for axe async resolution; pattern is intentional
- [x] [Review][Patch] `id="authorship-label"` is dead markup — fixed: removed unused id attribute [CardDeck.tsx:108]
- [x] [Review][Patch] `console.warn` unconditional in production path — fixed: guarded with `import.meta.env.DEV` [apiClient.ts:65]
- [x] [Review][Defer] Compliance block missing `aria-disabled` on CTA wrapper and `title` attribute on container [CardDeck.tsx] — deferred, story 3.10 scope; functional blocking is in place via `onBook=undefined`
- [x] [Review][Defer] `assumedSlots as SlotKey[]` unsafe type cast [CardDeck.tsx:97] — deferred, pre-existing pattern from prior stories
- [x] [Review][Defer] Shimmer gating order-dependent on `cards` array iteration order [CardDeck.tsx:68-75] — deferred, acceptable for MVP; SSE insertion order is deterministic in practice
- [x] [Review][Defer] Test boundary: `booking-cta` asserted through TravelCard child [CardDeck.test.tsx] — deferred, acceptable integration test pattern
- [x] [Review][Defer] `allSettled` threshold `0.75` magic number [CardDeck.tsx:39] — deferred, matches UX-DR13 spec value; extract to named constant in a cleanup story

---

## Dev Notes

### Architecture Overview

This story introduces a **new `CardDeck` component** that owns the `browsing/committing` state machine (UX-DR13). It wraps `TravelCard` children and is the source of truth for `deckState` — TravelCard already accepts this as a prop (no changes needed to TravelCard).

**Files to CREATE:**
- `stravel/frontend/src/components/cards/CardDeck.tsx`
- `stravel/frontend/src/components/cards/__tests__/CardDeck.test.tsx`
- `stravel/frontend/src/components/cards/__tests__/CardDeck.axe.test.tsx`

**Files to MODIFY:**
- `stravel/frontend/src/components/cards/index.ts` — add CardDeck export
- `stravel/frontend/src/services/apiClient.ts` — add `userPreferences` namespace

**Files to NOT touch:**
- `TravelCard.tsx` — already complete; accepts `deckState` as prop (no changes)
- `domain.ts`, `stream.ts`, `streamReducer.ts` — CardDeck manages its own state independently
- `CardDeckZone.tsx` — layout shell unchanged; CardDeck renders inside it

### CardDeck Component Interface

```tsx
import type { CardUpdateEvent, SlotKey } from '@/types/domain';

export interface CardDeckProps {
  cards: CardUpdateEvent[];           // from Object.values(streamState.cardUpdates)
  sessionId?: string;                  // for trip name storage key
  onBook?: () => void;
  onCardEdit?: (cardId: string) => void;
  onComplianceBadgeTap?: (cardId: string) => void;
  onAssumedBadgeTap?: (slotKey: SlotKey) => void;
  assumedSlots?: string[];
  hasComplianceBlock?: boolean;        // true if any ComplianceCardData.isBlock === true
  className?: string;
}
```

### State Machine Logic (exact implementation)

```tsx
// Internal state
const [deckState, setDeckState] = useState<'browsing' | 'committing'>('browsing');
const [authorshipShown, setAuthorshipShown] = useState(false);
const [authorshipDismissed, setAuthorshipDismissed] = useState(false);
const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Derived: all cards have score >= 0.75
const allSettled = cards.length > 0 && cards.every(c => c.completeness_score >= 0.75);

useEffect(() => {
  if (allSettled && deckState === 'browsing') {
    settleTimerRef.current = setTimeout(() => {
      setDeckState('committing');
      setAuthorshipShown(false);  // reset so panel appears
    }, 500);
  } else if (!allSettled && deckState === 'committing') {
    // Card dropped below 0.75 (re-streaming after edit)
    setDeckState('browsing');
    setAuthorshipDismissed(false);  // re-queue for next committing entry
  }
  return () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  };
}, [allSettled, deckState]);
```

**Critical:** The effect dependency must include `allSettled` and `deckState`. `cards.length` must be part of the allSettled derivation so an empty deck never transitions.

### Will-Change Shimmer Gating (UX-DR23)

Max 3 simultaneous animated shimmer elements to prevent GPU memory exhaustion on Galaxy A-series:

```tsx
// Compute in render (not state — it's derived)
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

Pass `shimmerEnabled={shimmerMap[card.card_id] ?? false}` to each TravelCard.

### Authorship Panel Render Logic

```tsx
const showAuthorship = deckState === 'committing' && !authorshipShown && !authorshipDismissed;

// In JSX, below the card list:
{showAuthorship && (
  <AuthorshipPanel
    onSave={(tripName) => {
      saveTripName(sessionId, tripName);
      setAuthorshipShown(true);
      // move focus to booking CTA via ctaRef.current?.focus()
    }}
    onDismiss={() => {
      setAuthorshipShown(true);
      setAuthorshipDismissed(true);
      // move focus to booking CTA via ctaRef.current?.focus()
    }}
  />
)}
```

### BookingCard CTA Active Condition

The BookingCard's "Book this trip" button is active when:
- `deckState === 'committing'`
- `authorshipShown === true` OR `authorshipDismissed === true` (i.e., authorship has been resolved)
- `!hasComplianceBlock`

Pass `onBook` to the BookingCard TravelCard only when these conditions are met:
```tsx
const bookingCTAActive = deckState === 'committing'
  && (authorshipShown || authorshipDismissed)
  && !hasComplianceBlock;
```

When `hasComplianceBlock`, wrap the booking card in a container with `title="Resolve compliance issues before booking"` per Story 3.10 ACs.

### Trip Name Storage (MVP — sessionStorage Only)

No backend endpoint for `user_preferences` exists yet. Persist in sessionStorage:

```ts
// In apiClient.ts, add:
userPreferences: {
  saveTripName: (sessionId: string, tripName: string): Promise<void> => {
    console.warn('[userPreferences] Backend endpoint not yet implemented — storing in sessionStorage');
    sessionStorage.setItem(`stravel_trip_name_${sessionId}`, tripName);
    return Promise.resolve();
  },
  getTripName: (sessionId: string): string | null => {
    return sessionStorage.getItem(`stravel_trip_name_${sessionId}`);
  },
},
```

### Test Spec for CardDeck.test.tsx

Follow the TravelCard test pattern: create a `cards` fixture and render CardDeck with it.

```tsx
// Minimal settled card factory
const makeCard = (id: string, score: number, isFinal: boolean): CardUpdateEvent => ({
  card_id: id, type: 'flight', completeness_score: score, delta: {}, is_final: isFinal,
});

const settledCards = [
  makeCard('c1', 0.9, true),
  makeCard('c2', 0.85, true),
];
const browsingCards = [
  makeCard('c1', 0.5, false),
  makeCard('c2', 0.3, false),
];
```

**Required test cases:**
1. `renders all cards in browsing state when scores < 0.75` — deckState='browsing' passed to TravelCards
2. `transitions to committing after 500ms when all cards settled` — use `vi.useFakeTimers()`, advance 500ms, check committing
3. `does NOT transition before 500ms` — advance 499ms, still browsing
4. `shows authorship panel when committing first entered` — panel text "What would you like to name this trip?" present
5. `authorship Save stores name and hides panel` — click Save, panel gone
6. `authorship Skip hides panel and CTA becomes active` — click Skip, panel gone
7. `authorship panel does not re-appear after dismiss` — dismiss, check panel not present
8. `returns to browsing when a card drops below 0.75` — start committing, update cards to have score 0.5, deck goes back to browsing
9. `authorship re-queues when returned to browsing` — dismiss, trigger edit (drop score), then re-settle (raise score + 500ms), panel appears again
10. `shimmer gating: only first 3 nascent cards have shimmerEnabled=true` — render 5 nascent cards, check shimmer counts
11. `hasComplianceBlock disables booking CTA` — `hasComplianceBlock={true}`, check onBook not passed

**Fake timers pattern:**
```tsx
import { vi } from 'vitest';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('transitions after 500ms', async () => {
  const { rerender } = render(<CardDeck cards={settledCards} />);
  // advance timers
  await act(async () => { vi.advanceTimersByTime(500); });
  // check committing state visible (e.g., authorship panel or booking-cta)
  expect(screen.getByTestId('authorship-panel')).toBeInTheDocument();
});
```

### Accessibility Requirements (AC6)

CardDeck must pass axe-core in both states. Key requirements:
- AuthorshipPanel text input has `aria-label="Trip name"`
- The authorship panel itself has `role="region"` and `aria-label="Name your trip"`
- When AuthorshipPanel mounts, focus the text input (focus management)
- BookingCard area: when `hasComplianceBlock`, the disabled CTA wrapper must use `aria-disabled="true"` and a tooltip — use `title` attribute; do NOT suppress the button entirely

### Anti-patterns to Avoid

1. **DO NOT** add `deckState` to `StreamState` or `streamReducer` — CardDeck manages it locally. StreamReducer does not own UI state machines.
2. **DO NOT** create separate CardDeck state machine files or Redux slices — local `useState` and `useRef` are sufficient.
3. **DO NOT** modify `TravelCard.tsx` — it already accepts `deckState` as a prop; CardDeck just passes it down.
4. **DO NOT** attempt to save to backend during this story — sessionStorage only. A `console.warn` is acceptable.
5. **DO NOT** place CardDeck inside `ConversationCanvas` — it belongs in `CardDeckZone` (fixed position above ChatInput). This story implements CardDeck; wiring it into the layout is the concern of a later story.
6. **DO NOT** use `useEffect` to derive `allSettled` — derive it inline in the render body, then pass to the effect.

### Component Placement (for future reference)

CardDeck will eventually be used in `CardDeckZone`:
```tsx
// In B2CLayout / App.tsx (future story — not this story):
<CardDeckZone chatInputHeight={chatInputHeight}>
  <CardDeck
    cards={Object.values(streamState.cardUpdates)}
    sessionId={sessionId}
    onBook={handleBook}
    hasComplianceBlock={streamState.complianceFlags.some(f => f.severity === 'block')}
  />
</CardDeckZone>
```
This story just creates the CardDeck component in isolation. Do NOT wire it into App.tsx or B2CLayout — that belongs in a layout integration story.

### Key File Paths

- CardDeck (new): `stravel/frontend/src/components/cards/CardDeck.tsx`
- CardDeck tests (new): `stravel/frontend/src/components/cards/__tests__/CardDeck.test.tsx`
- CardDeck axe tests (new): `stravel/frontend/src/components/cards/__tests__/CardDeck.axe.test.tsx`
- index.ts (export): `stravel/frontend/src/components/cards/index.ts`
- apiClient.ts: `stravel/frontend/src/services/apiClient.ts`
- TravelCard (do NOT modify): `stravel/frontend/src/components/cards/TravelCard.tsx`
- UX-DR13 spec: epics-v2.md line 115 (`CardDeck — browsing/committing state machine`)
- UX-DR23 spec: epics-v2.md line 137 (`will-change: transform concurrency limit = 3`)
- epics-v2.md Story 3.6 ACs: lines 966–998 (source of this story's ACs)
- Test pattern reference: `__tests__/TravelCard.assumedBadge.test.tsx`

### Previous Story Learnings (from 9-5)

- Test import alias: always use `@/types/domain` not relative `../../types/domain` for domain types
- Vitest fake timers: `vi.useFakeTimers()` + `vi.advanceTimersByTime()` in `act()` for timer-dependent behavior
- No unused params in TypeScript strict mode — if a prop is added to a function signature, it must be used
- All new test files must be placed under `stravel/frontend/src/components/cards/__tests__/`
- Existing tests: 590 passing — run full suite after completion to confirm no regressions

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Created `CardDeck.tsx` with `browsing/committing` state machine: `useEffect` watches `allSettled` (all cards ≥0.75); 500ms debounce timer fires → sets `deckState='committing'` + `authorshipPending=true`; cards dropping below 0.75 reset to `browsing` + `authorshipPending=false`
- Simplified state to `authorshipPending: boolean` (single flag replaces two-flag pattern from dev notes — cleaner and passes all tests)
- `bookingCTAActive = committing && !authorshipPending && !hasComplianceBlock` — `onBook` only routed to booking card when active
- Shimmer gating: `shimmerMap` computed inline in render; first 3 nascent cards (score<0.25, !isFinal) get `shimmerEnabled=true`, rest `false` (UX-DR23 GPU limit)
- Authorship panel: `role="region"` `aria-label="Name your trip"`, input focused on mount (useEffect), booking CTA focused via `document.querySelector` after dismiss (no forwardRef needed)
- Escape keydown on authorship input triggers dismiss (AC4)
- Trip name stored in `sessionStorage` via `api.userPreferences.saveTripName()` (MVP fallback with `console.warn`)
- axe tests restructured: fake timers used within-test only (not in beforeEach) to avoid "axe already running" conflict with parallel test files
- 607 tests passing (+17 new); 0 new TypeScript errors

### File List

- stravel/frontend/src/components/cards/CardDeck.tsx (created)
- stravel/frontend/src/components/cards/index.ts (modified — added CardDeck export)
- stravel/frontend/src/services/apiClient.ts (modified — added userPreferences namespace)
- stravel/frontend/src/components/cards/__tests__/CardDeck.test.tsx (created)
- stravel/frontend/src/components/cards/__tests__/CardDeck.axe.test.tsx (created)

## Change Log

- 2026-05-27: Implemented story 9-6 — CardDeck state machine with browsing/committing transitions, authorship moment panel, shimmer gating (UX-DR23), compliance block stub; 17 new tests (14 unit + 3 axe)
