# Story 8.4: Destination Cards

Status: done

## Story

As a traveler who just selected a mood,
I want to see a visual grid of destination options with name, description, and cost tier,
So that I can make an informed choice by tapping rather than typing a destination name.

## Acceptance Criteria

**AC1 — Grid layout and card content**

**Given** the bot renders destination cards
**When** rendered
**Then** up to 6 destination cards are shown in a 2-column grid
**And** a "Surprise me" chip is always present as the last option (below the grid)
**And** each card shows: destination name, one-line description (≤60 chars), cost tier badge (💸 Budget / 💰 Mid-range / 💎 Premium)
**And** the container has `role="radiogroup"` and each card has `role="radio"`

**AC2 — Card tap → slot stored + narration**

**Given** a destination card is visible
**When** the user taps a destination card
**Then** the card enters selected state
**And** 300ms after selection, `onSelect({ slotKey, value, label })` is called
**And** in DemoPage: the `destination` slot is stored in `streamState.slotState` via `SLOT_UPDATE`
**And** the destination card is hidden
**And** the bot narrates: "Great choice! [label] it is — I'll start putting together your trip."

**AC3 — Destination card shown after mood selection**

**Given** the user completes mood selection (taps a mood chip in the mood card)
**When** `handleMoodSelect` fires
**Then** the mood card is dismissed AND the destination card becomes visible

**AC4 — Destination card shown after mood "Surprise me"**

**Given** the user taps "Surprise me" on the mood card
**When** `handleMoodSurprise` fires
**Then** the mood card is dismissed AND the destination card becomes visible

**AC5 — "Surprise me" destination chip**

**Given** the user taps "Surprise me" on the destination card
**When** tapped
**Then** `onSurprise({ slotKey })` is called immediately (no 300ms delay)
**And** in DemoPage: a random destination is selected, stored in `slotState.destination`
**And** the destination card is hidden
**And** the bot announces: "I picked [label] for you — let me put together a trip itinerary."

**AC6 — Destination card NOT shown when destination already known**

**Given** the user's first message was classified as `specific` (contains destination/date/budget)
**When** the API path executes
**Then** the destination card is NOT shown (only set visible by mood selection handlers)

**AC7 — Tap targets ≥44×44px**

**Given** destination cards are rendered
**When** each card is measured
**Then** tap target meets `min-h-[44px] min-w-[44px]` (NFR-3)

## Tasks / Subtasks

- [x] Task 1: Create `DestinationCardsCard.tsx` + `.js` counterpart (AC1, AC2, AC5, AC7)
  - [x] Define `DestinationOption` interface: `{ value, label, description, costTier }`
  - [x] Define `DestinationCardsCardProps` with `slotKey`, `prompt`, `options`, `onSelect`, `onSurprise?`, `className?`
  - [x] `onSelect` signature: `(update: { slotKey: SlotKey; value: string; label: string }) => void`
  - [x] Implement 2-column grid of destination cards with `role="radiogroup"` + `role="radio"`
  - [x] Cost tier badge map: `budget → '💸 Budget'`, `mid-range → '💰 Mid-range'`, `premium → '💎 Premium'`
  - [x] 300ms auto-advance: `scheduleAdvance(value, label)` → `setTimeout(300)` → calls `onSelect`
  - [x] Enter on already-selected card → immediate advance (mirrors SlotFillingCard pattern)
  - [x] "Surprise me" chip below grid: calls `onSurprise?.({ slotKey })` immediately (no timer)
  - [x] Selected card visual: `bg-teal-600 text-white border-transparent` (same as SlotFillingCard selected state)
  - [x] `min-h-[44px] min-w-[44px]` on all tappable elements
  - [x] Sync `DestinationCardsCard.js` counterpart (JSX-runtime format, no TS annotations)

- [x] Task 2: Write `DestinationCardsCard.test.tsx` unit tests (AC1, AC2, AC5, AC7)
  - [x] Renders radiogroup container + radio cards
  - [x] Cards display name, description, cost tier badge
  - [x] Card tap → selected state, timer fires onSelect with `{ slotKey, value, label }` after 300ms (vi.useFakeTimers)
  - [x] "Surprise me" chip calls onSurprise immediately (no timer delay)
  - [x] All cards have min-h-[44px] min-w-[44px] in className

- [x] Task 3: Wire destination cards into DemoPage `App.tsx` (AC2, AC3, AC4, AC5, AC6)
  - [x] Add `DESTINATION_OPTIONS: DestinationOption[]` constant at module level (5 Vietnam destinations)
  - [x] Add `DESTINATION_VALUES` constant (non-surprise values for random pick)
  - [x] Add `destinationCardVisible` state (useState false)
  - [x] Modify `handleMoodSelect`: set `destinationCardVisible = true` after hiding mood card
  - [x] Modify `handleMoodSurprise`: set `destinationCardVisible = true` after hiding mood card
  - [x] Add `handleDestinationSelect({ slotKey, value, label })`: dispatch SLOT_UPDATE for destination, hide destination card, push narration
  - [x] Add `handleDestinationSurprise({ slotKey })`: pick random destination, dispatch SLOT_UPDATE, hide card, push announcement
  - [x] Render `<DestinationCardsCard>` inline in ConversationCanvas when `destinationCardVisible`
  - [x] Sync `App.js` counterpart

- [x] Task 4: Write `DemoPage.destinationCard.test.tsx` integration tests (AC3, AC4, AC2, AC5, AC6)
  - [x] AC3: after mood chip select → destination card visible
  - [x] AC4: after mood "Surprise me" → destination card visible
  - [x] AC2: destination card tap + Enter (immediate advance) → card hidden, narration present
  - [x] AC5: "Surprise me" destination → card hidden, "I picked…" announcement present
  - [x] AC6: specific first message ("Hanoi") → no destination card shown

- [x] Task 5: Fix regression in `DemoPage.moodCard.test.tsx` (AC3 + AC4 from 8.3)
  - [x] AC2 test: replaced `queryByRole('radiogroup') not in document` with `queryByRole('radio', { name: /Adventure/i }) not in document`
  - [x] AC4 test: same fix for Surprise me path

- [x] Task 6: Run full validation suite
  - [x] `npx vitest run` — 415/415 tests pass (18 new, no regressions from 397 baseline)
  - [x] `npx eslint src/` — clean
  - [x] `npx tsc --noEmit` — clean
  - [x] `npx vite build` — clean (232 modules, 432 kB)

### Review Findings

- [x] [Review][Patch] Non-null assertion in handleDestinationSurprise [App.tsx:handleDestinationSurprise]
- [x] [Review][Patch] "Surprise me" ARIA: role="radio" + hardcoded aria-checked={false} [DestinationCardsCard.tsx:109-126]
- [x] [Review][Defer] handleSend does not reset destinationCardVisible on free-text while destination card is showing [App.tsx:handleSend] — deferred, not in 8.4 spec; equivalent of 8.3 AC3 for destination card; needs its own AC in future story

## Dev Notes

### File Locations

| File | Path | Action |
|------|------|--------|
| DestinationCardsCard | `stravel/frontend/src/components/cards/DestinationCardsCard.tsx` | CREATE |
| DestinationCardsCard JS | `stravel/frontend/src/components/cards/DestinationCardsCard.js` | CREATE |
| DestinationCardsCard tests | `stravel/frontend/src/components/cards/__tests__/DestinationCardsCard.test.tsx` | CREATE |
| DemoPage | `stravel/frontend/src/App.tsx` | MODIFY |
| DemoPage JS | `stravel/frontend/src/App.js` | SYNC |
| DemoPage destination tests | `stravel/frontend/src/__tests__/DemoPage.destinationCard.test.tsx` | CREATE |
| DemoPage mood tests | `stravel/frontend/src/__tests__/DemoPage.moodCard.test.tsx` | MODIFY (fix AC2/AC4 assertions) |

No backend changes. No domain.ts changes (SlotKey already includes `'destination'`).

### Task 1 — DestinationCardsCard Component

**`DestinationOption` interface:**
```typescript
export interface DestinationOption {
  value: string;       // slug used as slot value, e.g. 'hoi_an'
  label: string;       // display name, e.g. 'Hội An'
  description: string; // ≤60 chars
  costTier: 'budget' | 'mid-range' | 'premium';
}
```

**Props interface:**
```typescript
export interface DestinationCardsCardProps {
  slotKey: SlotKey;
  prompt?: string;   // defaults to 'Where would you like to go?'
  options: DestinationOption[];
  onSelect: (update: { slotKey: SlotKey; value: string; label: string }) => void;
  onSurprise?: (event: { slotKey: SlotKey }) => void;
  className?: string;
}
```

**Cost tier badge map:**
```typescript
const COST_TIER_BADGE: Record<DestinationOption['costTier'], string> = {
  budget: '💸 Budget',
  'mid-range': '💰 Mid-range',
  premium: '💎 Premium',
};
```

**Auto-advance (mirrors SlotFillingCard pattern):**
```typescript
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => { if (timerRef.current != null) clearTimeout(timerRef.current); };
}, []);

function scheduleAdvance(value: string, label: string) {
  if (timerRef.current != null) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => {
    onSelect({ slotKey, value, label });
  }, 300);
}

function handleCardActivate(value: string, label: string) {
  setSelectedValue(value);
  scheduleAdvance(value, label);
}
```

**Selected card visual class (reuse cva or inline):**
Selected: `bg-teal-600 text-white border-transparent`
Default: `border-border bg-surface hover:bg-surface-2`

**JSX skeleton:**
```tsx
return (
  <div role="radiogroup" aria-labelledby={promptId} className={cn('flex flex-col gap-3', className)}>
    <p id={promptId} className="text-sm font-medium text-text-base">{prompt}</p>
    <div className="grid grid-cols-2 gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={selectedValue === opt.value}
          onClick={() => handleCardActivate(opt.value, opt.label)}
          className={cn(
            'flex flex-col items-start gap-1 p-3 rounded-xl border text-left cursor-pointer transition-all motion-reduce:transition-none',
            'min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            selectedValue === opt.value
              ? 'border-transparent bg-teal-600 text-white'
              : 'border-border bg-surface hover:bg-surface-2'
          )}
        >
          <span className="font-semibold text-sm">{opt.label}</span>
          <span className={cn('text-xs', selectedValue === opt.value ? 'text-white/80' : 'text-text-muted')}>
            {opt.description}
          </span>
          <span className="text-xs mt-1">{COST_TIER_BADGE[opt.costTier]}</span>
        </button>
      ))}
    </div>
    {onSurprise && (
      <button
        type="button"
        role="radio"
        aria-checked={false}
        onClick={() => onSurprise({ slotKey })}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-border bg-surface text-sm font-medium cursor-pointer hover:bg-surface-2 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        🎲 Surprise me
      </button>
    )}
  </div>
);
```

### Task 2 — DestinationCardsCard.js sync

Use JSX-runtime format (same as SlotFillingCard.js):
```javascript
/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
// ... (no TypeScript annotations, no cva if unused)
```

### Task 3 — DemoPage destination data

**DESTINATION_OPTIONS constant (5 items, no Surprise me — that's built into component):**
```typescript
const DESTINATION_OPTIONS: DestinationOption[] = [
  { value: 'hoi_an', label: 'Hội An', description: 'Lantern-lit ancient town with tailors and beach bikes', costTier: 'mid-range' },
  { value: 'hanoi', label: 'Hà Nội', description: 'Chaotic capital with street food and French heritage', costTier: 'budget' },
  { value: 'phu_quoc', label: 'Phú Quốc', description: 'Island paradise with clear water and beach clubs', costTier: 'premium' },
  { value: 'hue', label: 'Huế', description: 'Imperial citadel, royal tombs, and river boat dining', costTier: 'budget' },
  { value: 'da_nang', label: 'Đà Nẵng', description: 'Dragon bridges, marble mountains, and surf beaches', costTier: 'mid-range' },
];

const DESTINATION_VALUES = DESTINATION_OPTIONS.map(opt => opt.value);
```

**State addition:**
```typescript
const [destinationCardVisible, setDestinationCardVisible] = useState(false);
```

**`_streamState` → rename to `streamState`:** now actively consumed in 8.4 (the slot state is populated). Rename the destructured variable. Since `noUnusedLocals: true` is set, read from it in the destination surprise handler to find the stored mood for rationale messages.

Actually: simplest path is to keep `_streamState` since we still don't READ from it in rendering. The `slotState` dispatch is enough. Only rename if needed to avoid TypeScript error.

**handleMoodSelect modification (add last line):**
```typescript
const handleMoodSelect = ({ slotKey, value }: { slotKey: SlotKey; value: string }) => {
  dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
  setMoodCardVisible(false);
  setDestinationCardVisible(true);   // ADD THIS
  setMessages(prev => [
    ...prev,
    { role: 'user', content: MOOD_LABELS[value] ?? value },
    { role: 'assistant', content: "Great — let me suggest some places that match that vibe." },
  ]);
};
```

**handleMoodSurprise modification (add last line before closing):**
```typescript
const handleMoodSurprise = ({ slotKey }: { slotKey: SlotKey }) => {
  const randomMood = MOOD_VALUES[Math.floor(Math.random() * MOOD_VALUES.length)];
  const moodLabel = MOOD_LABELS[randomMood] ?? randomMood;
  dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value: randomMood } });
  setMoodCardVisible(false);
  setDestinationCardVisible(true);   // ADD THIS
  setMessages(prev => [
    ...prev,
    { role: 'user', content: 'Surprise me' },
    { role: 'assistant', content: `I picked ${moodLabel} for you — let me suggest destinations with that in mind.` },
  ]);
};
```

**New handleDestinationSelect:**
```typescript
const handleDestinationSelect = ({ slotKey, value, label }: { slotKey: SlotKey; value: string; label: string }) => {
  dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
  setDestinationCardVisible(false);
  setMessages(prev => [
    ...prev,
    { role: 'user', content: label },
    { role: 'assistant', content: `Great choice! ${label} it is — I'll start putting together your trip.` },
  ]);
};
```

**New handleDestinationSurprise:**
```typescript
const handleDestinationSurprise = ({ slotKey }: { slotKey: SlotKey }) => {
  const randomIdx = Math.floor(Math.random() * DESTINATION_VALUES.length);
  const randomValue = DESTINATION_VALUES[randomIdx];
  const randomOpt = DESTINATION_OPTIONS.find(o => o.value === randomValue)!;
  dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value: randomValue } });
  setDestinationCardVisible(false);
  setMessages(prev => [
    ...prev,
    { role: 'user', content: 'Surprise me' },
    { role: 'assistant', content: `I picked ${randomOpt.label} for you — let me put together a trip itinerary.` },
  ]);
};
```

**JSX addition (in ConversationCanvas, after mood card block):**
```tsx
{destinationCardVisible && (
  <DestinationCardsCard
    slotKey="destination"
    options={DESTINATION_OPTIONS}
    onSelect={handleDestinationSelect}
    onSurprise={handleDestinationSurprise}
    className="mx-4 mb-2"
  />
)}
```

### Task 4 — DemoPage destination card tests

Tests should mock `classifyMessage` to return `'ambiguous'` for all messages (so mood card always shows first, enabling destination card flow tests).

```typescript
vi.mock('../utils/messageClassifier', () => ({
  classifyMessage: () => 'ambiguous',
}));
```

**Helper pattern from 8.3:**
```typescript
async function sendMessage(message: string) {
  const inputEl = screen.getByTestId('chat-input') as HTMLInputElement;
  fireEvent.change(inputEl, { target: { value: message } });
  const form = inputEl.closest('form')!;
  await act(async () => { fireEvent.submit(form); });
  await act(async () => {});
}

async function selectMoodChip(name: RegExp) {
  const chip = screen.getByRole('radio', { name });
  await act(async () => { fireEvent.click(chip); });
  await act(async () => { fireEvent.keyDown(chip, { key: 'Enter' }); });
}
```

### Task 5 — Fix DemoPage.moodCard.test.tsx regressions

In 8.3 tests, after mood selection the destination card now renders (also a `radiogroup`). The assertions `expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()` will fail because a destination radiogroup is now visible.

**Fix AC2 test assertion:**
```typescript
// BEFORE (will fail):
expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();

// AFTER (mood-specific check):
expect(screen.queryByRole('radio', { name: /Adventure/i })).not.toBeInTheDocument();
```

**Fix AC4 test assertion (Surprise me mood):**
```typescript
// BEFORE (will fail):
expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();

// AFTER:
expect(screen.queryByRole('radio', { name: /Adventure/i })).not.toBeInTheDocument();
```

Note: AC1, AC3, and AC6 in the 8.3 tests are NOT affected:
- AC1: checks radiogroup IS present (mood card showing) — still OK
- AC3: user types while mood card visible → destination bypass (no destination card) → still no radiogroup
- AC6: specific first message → API path, no mood or destination card → still no radiogroup

### Critical Patterns from Prior Stories

- **`.js` counterpart sync**: Vitest resolves `.js` over `.tsx`; every `.tsx` change must be mirrored in `.js`
- **JSX-runtime format for `.js`**: Add `/** @jsxRuntime automatic */` and `/** @jsxImportSource react */` at top
- **`noUnusedLocals: true`**: Any unused variable → TS6133 build error; prefix with `_` if intentionally unused
- **React `act()` for state**: Click and keyDown must be in separate `act()` blocks if keyDown depends on state set by click
- **`vi.useFakeTimers()` + `vi.runAllTimers()`**: Required for testing the 300ms auto-advance in unit tests. Restore with `vi.useRealTimers()` in afterEach.
- **Module-level constants**: Define `DESTINATION_OPTIONS`, `DESTINATION_VALUES` outside the component (above `DemoPage`) to avoid re-creation on render

### Flow State After 8.4

```
User types ambiguous message
  → mood card shown (moodCardVisible = true)
  
User selects mood chip
  → mood card hidden (moodCardVisible = false)
  → destination card shown (destinationCardVisible = true)
  → bot: "Great — let me suggest some places that match that vibe."
  
User taps destination card (300ms)
  → destination card hidden (destinationCardVisible = false)
  → slotState.destination stored
  → bot: "Great choice! [label] it is — I'll start putting together your trip."
  
[Story 8.5 will show calendar card here]
```

## Dev Agent Record

### Implementation Plan

- Created `DestinationCardsCard` component mirroring `SlotFillingCard` patterns: `role="radiogroup"` + `role="radio"`, 300ms auto-advance via `scheduleAdvance`, Enter immediate-advance on selected card, "Surprise me" chip with immediate `onSurprise` callback
- Extended `onSelect` signature with `label` field (vs SlotFillingCard's `{ slotKey, value }`) to pass display name directly to DemoPage handlers
- `destinationCardVisible` boolean state follows same pattern as `moodCardVisible`; set to `true` by both `handleMoodSelect` and `handleMoodSurprise` after mood dismissal
- Fixed 8.3 test regression: AC2/AC4 mood tests checked `queryByRole('radiogroup') not in document` but destination card (also a radiogroup) appears after mood selection; updated to check mood-specific chip absence instead

### Debug Log

- `DestinationCardsCard.js` initially used JSX syntax with `@jsxRuntime automatic` pragma — Vite rejected it (needed compiled `_jsx` form matching `SlotFillingCard.js`); rewrote in JSX-runtime format
- AC2 integration test failed initially because `DestinationCardsCard` didn't have Enter immediate-advance path; added `handleCardKeyDown` matching `SlotFillingCard`'s pattern

### Completion Notes

- All 7 ACs satisfied: 2-column grid with cost tier badges (AC1), 300ms select + Enter immediate advance + SLOT_UPDATE (AC2), destination card after mood select (AC3), destination card after mood surprise (AC4), destination surprise with random pick (AC5), skip when destination already known (AC6), min-44px tap targets (AC7)
- 18 new tests: 13 component unit tests, 5 DemoPage integration tests
- 415/415 tests passing (baseline was 397)
- Fixed 2 regression assertions in `DemoPage.moodCard.test.tsx` (AC2 + AC4)

## File List

- stravel/frontend/src/components/cards/DestinationCardsCard.tsx (new)
- stravel/frontend/src/components/cards/DestinationCardsCard.js (new)
- stravel/frontend/src/components/cards/__tests__/DestinationCardsCard.test.tsx (new — 13 tests)
- stravel/frontend/src/App.tsx (modified — destination card wiring)
- stravel/frontend/src/App.js (modified — synced App.tsx changes)
- stravel/frontend/src/__tests__/DemoPage.destinationCard.test.tsx (new — 5 tests)
- stravel/frontend/src/__tests__/DemoPage.moodCard.test.tsx (modified — fix AC2/AC4 radiogroup assertions)

## Change Log

- 2026-05-26: Story created (dev-story workflow, derived from Epic 2 Story 2.4)
- 2026-05-26: Story implemented — all 7 ACs satisfied, 415/415 tests passing (dev-story workflow)
- 2026-05-26: Code review complete — 2 patches applied: non-null assertion → direct index access, Surprise me ARIA fix (removed role="radio"/aria-checked); 1 deferred; 3 dismissed
