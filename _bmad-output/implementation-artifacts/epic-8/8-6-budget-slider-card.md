# Story 8.6: Budget Slider Card

Status: done

## Story

As a traveler setting a trip budget,
I want an interactive slider that shows a real-time contextual label as I drag,
So that I can set a number instantly without typing and understand what it gets me.

## Acceptance Criteria

**AC1 — Slider range and real-time label**

**Given** the budget card renders
**When** rendered
**Then** a range input spans USD 200–10,000 in steps of USD 100
**And** the value label above the slider shows the current value in format `~$X,XXX · [Tier] · [Description]` (e.g. `~$2,500 · Mid-range · Covers flights + 3★ hotel`)
**And** the label updates immediately on every slider movement (no debounce on the label)

**Tier boundaries:**
| Range | Tier | Description |
|---|---|---|
| $200–$1,499 | Budget | Covers shared accommodation + local transport |
| $1,500–$3,999 | Mid-range | Covers flights + 3★ hotel |
| $4,000–$6,999 | Premium | Covers 4★ hotel + guided tours |
| $7,000–$10,000 | Luxury | Business class + 5★ resort |

**AC2 — Touch targets**

**Given** the slider is rendered
**When** measured
**Then** the slider track wrapper has `min-h-[44px]` (≥44px tall touch target)
**And** the slider thumb is ≥44×44px (via Tailwind arbitrary variants: `[&::-webkit-slider-thumb]:w-[44px] [&::-webkit-slider-thumb]:h-[44px]`)
**And** the value label is positioned above the slider and never overlaps the thumb

**AC3 — Real-time slot update and "Use this" chip**

**Given** the slider is at a value
**When** the user moves the slider
**Then** the `budget` slot is updated in real-time via `onChange` callback (no confirm needed)
**And** the "Use this" chip is hidden while the slider is actively moving
**And** after 1,000ms of inactivity on the slider, a "Use this — [Tier] budget" chip appears
**When** the user taps "Use this"
**Then** `onSelect({ slotKey: 'budget', value: String(amount) })` is called (advances to next slot)

**AC4 — Surprise me**

**Given** an `onSurprise` prop is provided
**When** the user taps the "Surprise me" chip
**Then** `onSurprise({ slotKey: 'budget' })` is called
**And** the parent derives the budget from `MOOD_BUDGET_MIDPOINTS` mapping based on the current `mood` slot value

**Mood-to-budget midpoints (defined in App.tsx `handleBudgetSurprise`):**
| Mood | Budget Midpoint |
|---|---|
| adventure | $2,000 |
| relaxation | $3,500 |
| cultural | $1,800 |
| family | $3,000 |
| luxury | $7,000 |
| (default) | $2,500 |

**AC5 — Keyboard and ARIA**

**Given** the slider input is focused
**When** keyboard keys are pressed
**Then** Left/Right Arrow keys change value by USD 100 (native `<input type="range">` behavior, no custom handler needed)
**And** Home key jumps to USD 200 (native behavior)
**And** End key jumps to USD 10,000 (native behavior)
**And** the slider has `aria-valuemin="200"`, `aria-valuemax="10000"`, `aria-valuenow={value}`, `aria-valuetext="approximately $X,XXX — [Tier] — [Description]"`

**AC6 — DemoPage integration**

**Given** the user has confirmed travel dates (calendar card confirms)
**When** `handleCalendarConfirm` fires
**Then** budget card becomes visible (calendar card already hidden by 8.5)
**And** the bot replies: `"[N] nights — noted! What's your total budget for this trip?"`

**Given** the user taps "Use this" on the budget card
**When** `handleBudgetSelect` fires
**Then** `SLOT_UPDATE` is dispatched for `budget` with the string value (e.g. `"2500"`)
**And** the budget card is hidden
**And** the user bubble shows: `"USD X,XXX · [Tier]"` (e.g. `"USD 2,500 · Mid-range"`)
**And** the bot replies: `"[Tier] budget — I'm starting on your plan now."`

---

## Tasks / Subtasks

- [x] Task 1: Create `BudgetSliderCard.tsx` + `.js` counterpart (AC1–AC5)
  - [x] Define `BudgetSliderCardProps`: `slotKey`, `onChange?`, `onSelect`, `onSurprise?`, `defaultValue?`, `className?`
  - [x] Define and export `BUDGET_TIERS` constant and `getBudgetTier(amount)` pure function
  - [x] Render `<input type="range" min={200} max={10000} step={100} />` with ARIA attributes
  - [x] Style track wrapper `min-h-[44px]` + thumb via Tailwind arbitrary variants
  - [x] Value label above slider: `~$X,XXX · [Tier] · [Description]` — updates in real-time
  - [x] `onChange` handler: update internal value + call `onChange?.()` prop + reset inactivity timer
  - [x] Inactivity timer (`useRef<ReturnType<typeof setTimeout>>`): 1,000ms → show "Use this" chip
  - [x] "Use this" chip: calls `onSelect({ slotKey, value: String(currentValue) })`
  - [x] "Surprise me" chip (when `onSurprise` provided): calls `onSurprise({ slotKey })`
  - [x] `useEffect` cleanup: clear inactivity timer on unmount
  - [x] Sync `BudgetSliderCard.js` counterpart (JSX-runtime format, no TS annotations)

- [x] Task 2: Write `BudgetSliderCard.test.tsx` unit tests (AC1–AC5)
  - [x] Renders slider with correct min/max/step attributes
  - [x] Value label shows correct tier text on initial render
  - [x] Slider onChange → label updates in real-time
  - [x] "Use this" chip NOT visible initially
  - [x] After 1,000ms inactivity → "Use this" chip appears (vi.useFakeTimers)
  - [x] "Use this" tap → `onSelect` called with `{ slotKey: 'budget', value: '2500' }`
  - [x] Slider movement → resets inactivity timer (chip disappears, reappears 1s later)
  - [x] Surprise me button visible when `onSurprise` provided
  - [x] Surprise me tap → `onSurprise` called
  - [x] `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` correct
  - [x] Slider wrapper has `min-h-[44px]` class

- [x] Task 3: Wire into DemoPage `App.tsx` + `App.js` (AC6)
  - [x] Import `BudgetSliderCard`, `getBudgetTier`, `MOOD_BUDGET_MIDPOINTS`
  - [x] Add `budgetCardVisible` state (`useState(false)`)
  - [x] Modify `handleCalendarConfirm`: add `setBudgetCardVisible(true)`, change bot reply to `"[N] nights — noted! What's your total budget for this trip?"`
  - [x] Add `handleBudgetChange`: dispatch `SLOT_UPDATE` for `budget` (real-time, no advance)
  - [x] Add `handleBudgetSelect`: dispatch `SLOT_UPDATE`, hide budget card, push user bubble + bot reply
  - [x] Add `handleBudgetSurprise`: read `streamState.slotState.mood`, look up `MOOD_BUDGET_MIDPOINTS`, dispatch, hide card, push messages
  - [x] Render `<BudgetSliderCard>` in ConversationCanvas when `budgetCardVisible`
  - [x] Sync `App.js` counterpart

- [x] Task 4: Write `DemoPage.budgetCard.test.tsx` integration tests (AC6)
  - [x] AC6a: calendar confirm → budget card visible (`<input type="range">` present), bot asks budget
  - [x] AC6b: "Use this" after 1s → card hidden, user bubble `"USD X,XXX · [Tier]"`, bot reply present
  - [x] AC6c: Surprise me on budget → card advances, fetch NOT called

- [x] Task 5: Run full validation suite
  - [x] `npx vitest run` — all tests pass, no regressions from 429 baseline
  - [x] `npx tsc --noEmit` — clean
  - [x] `npx eslint src/` — clean

### Review Findings (AI)

- [x] [Review][Decision] D1: "Use this" chip appears on mount after 1s with no slider interaction — kept intentional (better UX for default-happy users)
- [x] [Review][Decision] D2: `MOOD_BUDGET_MIDPOINTS` key mismatches — resolved as patch P2
- [x] [Review][Patch] P1: `getBudgetTier` non-null assertion `!` replaced with `?? BUDGET_TIERS[last]` fallback [BudgetSliderCard.tsx:31]
- [x] [Review][Patch] P2 (from D2): `MOOD_BUDGET_MIDPOINTS` fixed — `cultural→culture`, added `foodie:2000`, `romance:3500`, removed dead `family`/`luxury` [App.tsx:252]
- [x] [Review][Defer] W1: `navigateToBudgetCard` test helper uses hardcoded calendar array indices [5]/[12] — real-date-sensitive; could produce wrong date pair at certain month layouts [DemoPage.budgetCard.test.tsx:47-54] — deferred, pre-existing test pattern
- [x] [Review][Defer] W2: `BudgetSliderCard` always mounts at default $2,500, ignores prior `slotState.budget` — UX inconsistency if card is re-shown [App.tsx] — deferred, outside story 8-6 scope
- [x] [Review][Defer] W3: Integration test `selectMoodChip`/`selectDestinationCard` helpers rely on click+Enter to bypass SlotFillingCard's 300 ms timer under fake timers — fragile if card implementation changes [DemoPage.budgetCard.test.tsx] — deferred, pre-existing pattern

---

## Dev Notes

### File Locations

| File | Path | Action |
|------|------|--------|
| BudgetSliderCard | `stravel/frontend/src/components/cards/BudgetSliderCard.tsx` | CREATE |
| BudgetSliderCard JS | `stravel/frontend/src/components/cards/BudgetSliderCard.js` | CREATE |
| BudgetSliderCard tests | `stravel/frontend/src/components/cards/__tests__/BudgetSliderCard.test.tsx` | CREATE |
| DemoPage | `stravel/frontend/src/App.tsx` | MODIFY |
| DemoPage JS | `stravel/frontend/src/App.js` | MODIFY (sync) |
| DemoPage budget tests | `stravel/frontend/src/__tests__/DemoPage.budgetCard.test.tsx` | CREATE |

No backend changes. No `domain.ts` changes (`budget` already in `SlotKey`).

### Task 1 — BudgetSliderCard Component

**Props interface:**
```typescript
export interface BudgetSliderCardProps {
  slotKey: SlotKey;
  defaultValue?: number;   // defaults to 2500
  onChange?: (update: { slotKey: SlotKey; value: string }) => void;
  onSelect: (update: { slotKey: SlotKey; value: string }) => void;
  onSurprise?: (event: { slotKey: SlotKey }) => void;
  className?: string;
}
```

**Budget tier constant and helper (export both — used by App.tsx for user bubble and Surprise me):**
```typescript
export const MIN_BUDGET = 200;
export const MAX_BUDGET = 10000;
export const BUDGET_STEP = 100;

interface BudgetTier {
  label: string;
  description: string;
}

const BUDGET_TIERS: Array<{ maxExclusive: number } & BudgetTier> = [
  { maxExclusive: 1500,     label: 'Budget',    description: 'Covers shared accommodation + local transport' },
  { maxExclusive: 4000,     label: 'Mid-range', description: 'Covers flights + 3★ hotel' },
  { maxExclusive: 7000,     label: 'Premium',   description: 'Covers 4★ hotel + guided tours' },
  { maxExclusive: Infinity, label: 'Luxury',    description: 'Business class + 5★ resort' },
];

export function getBudgetTier(amount: number): BudgetTier {
  return BUDGET_TIERS.find(t => amount < t.maxExclusive)!;
}
```

**State:**
```typescript
const [value, setValue] = useState(defaultValue ?? 2500);
const [useThisVisible, setUseThisVisible] = useState(false);
const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**Timer cleanup on unmount:**
```typescript
useEffect(() => {
  return () => {
    if (inactivityRef.current != null) clearTimeout(inactivityRef.current);
  };
}, []);
```

**Slider onChange handler:**
```typescript
function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>) {
  const newValue = parseInt(e.target.value, 10);
  setValue(newValue);
  setUseThisVisible(false);
  onChange?.({ slotKey, value: String(newValue) });
  if (inactivityRef.current != null) clearTimeout(inactivityRef.current);
  inactivityRef.current = setTimeout(() => {
    setUseThisVisible(true);
  }, 1000);
}
```

**JSX structure:**
```tsx
export function BudgetSliderCard({ slotKey, defaultValue, onChange, onSelect, onSurprise, className }: BudgetSliderCardProps) {
  // state + handlers above
  const tier = getBudgetTier(value);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Value label — positioned above slider, never overlaps thumb */}
      <p className="text-center text-sm text-text-muted">
        <span className="text-lg font-semibold text-teal-700">
          ~${value.toLocaleString()}
        </span>
        {' · '}{tier.label}{' · '}{tier.description}
      </p>

      {/* Slider track wrapper — min-h-[44px] ensures touch target */}
      <div className="flex items-center min-h-[44px]">
        <input
          type="range"
          min={MIN_BUDGET}
          max={MAX_BUDGET}
          step={BUDGET_STEP}
          value={value}
          onChange={handleSliderChange}
          aria-label="Budget amount"
          aria-valuemin={MIN_BUDGET}
          aria-valuemax={MAX_BUDGET}
          aria-valuenow={value}
          aria-valuetext={`approximately $${value.toLocaleString()} — ${tier.label} — ${tier.description}`}
          className={cn(
            'w-full cursor-pointer appearance-none',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            '[&::-webkit-slider-track]:h-[6px] [&::-webkit-slider-track]:rounded-full [&::-webkit-slider-track]:bg-teal-200',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[44px] [&::-webkit-slider-thumb]:h-[44px]',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-600 [&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-moz-range-track]:h-[6px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-teal-200',
            '[&::-moz-range-thumb]:w-[44px] [&::-moz-range-thumb]:h-[44px]',
            '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-teal-600 [&::-moz-range-thumb]:border-0'
          )}
        />
      </div>

      {/* "Use this" chip — appears after 1s inactivity */}
      {useThisVisible && (
        <button
          type="button"
          onClick={() => onSelect({ slotKey, value: String(value) })}
          className={cn(
            'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full self-center',
            'bg-teal-600 text-white text-sm font-medium cursor-pointer',
            'min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            'transition-colors motion-reduce:transition-none'
          )}
        >
          Use this — {tier.label} budget
        </button>
      )}

      {/* Surprise me chip */}
      {onSurprise && (
        <button
          type="button"
          onClick={() => onSurprise({ slotKey })}
          className="text-sm text-text-muted underline self-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          Surprise me
        </button>
      )}
    </div>
  );
}
```

### Task 2 — BudgetSliderCard.js sync

Use JSX-runtime format (same pattern as `InlineCalendarCard.js`):
```javascript
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
// All constants, getBudgetTier, and component logic — no TypeScript annotations
// Use === null checks instead of != null for TypeScript idioms
```

**Critical**: Export `getBudgetTier`, `MIN_BUDGET`, `MAX_BUDGET`, `BUDGET_STEP` from `.js` too — App.js imports them.

### Task 3 — DemoPage Changes

**New state:**
```typescript
const [budgetCardVisible, setBudgetCardVisible] = useState(false);
```

**Import additions:**
```typescript
import { BudgetSliderCard, getBudgetTier } from "./components/cards/BudgetSliderCard";
```

**Modified `handleCalendarConfirm`** — add `setBudgetCardVisible(true)` and change bot message:
```typescript
const handleCalendarConfirm = ({ slotKey, value, nightCount }: { slotKey: SlotKey; value: string; nightCount: number }) => {
  dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
  setCalendarCardVisible(false);
  setBudgetCardVisible(true);           // ← NEW
  const [startStr, endStr] = value.split(',');
  const fmtDate = (s: string) =>
    new Date(s + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const userBubble = `${fmtDate(startStr)} – ${fmtDate(endStr)} · ${nightCount} night${nightCount === 1 ? '' : 's'}`;
  setMessages(prev => [...prev,
    { role: 'user', content: userBubble },
    { role: 'assistant', content: `${nightCount} nights — noted! What's your total budget for this trip?` },  // ← CHANGED
  ]);
};
```

**New `handleBudgetChange`** — real-time slot update only, no advance:
```typescript
const handleBudgetChange = ({ slotKey, value }: { slotKey: SlotKey; value: string }) => {
  dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
};
```

**New `handleBudgetSelect`** — "Use this" advance:
```typescript
const handleBudgetSelect = ({ slotKey, value }: { slotKey: SlotKey; value: string }) => {
  dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
  setBudgetCardVisible(false);
  const amount = parseInt(value, 10);
  const tier = getBudgetTier(amount);
  const userBubble = `USD ${amount.toLocaleString()} · ${tier.label}`;
  setMessages(prev => [...prev,
    { role: 'user', content: userBubble },
    { role: 'assistant', content: `${tier.label} budget — I'm starting on your plan now.` },
  ]);
};
```

**New `handleBudgetSurprise`:**
```typescript
const MOOD_BUDGET_MIDPOINTS: Record<string, number> = {
  adventure: 2000, relaxation: 3500, cultural: 1800, family: 3000, luxury: 7000,
};

const handleBudgetSurprise = ({ slotKey }: { slotKey: SlotKey }) => {
  const mood = (streamState.slotState.mood ?? '').toLowerCase();
  const amount = MOOD_BUDGET_MIDPOINTS[mood] ?? 2500;
  dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value: String(amount) } });
  setBudgetCardVisible(false);
  const tier = getBudgetTier(amount);
  setMessages(prev => [...prev,
    { role: 'user', content: 'Surprise me' },
    { role: 'assistant', content: `Based on your vibe I'm setting your budget to USD ${amount.toLocaleString()} — ${tier.label}. That should cover everything nicely.` },
  ]);
};
```

**JSX addition (after calendar card block):**
```tsx
{budgetCardVisible && (
  <BudgetSliderCard
    slotKey="budget"
    onChange={handleBudgetChange}
    onSelect={handleBudgetSelect}
    onSurprise={handleBudgetSurprise}
    className="mx-4 mb-2"
  />
)}
```

**`MOOD_BUDGET_MIDPOINTS` constant** — define at module level in `DemoPage` function scope (same pattern as `DESTINATION_OPTIONS`). It reads from `streamState.slotState.mood` which is accessible in scope.

### Task 4 — DemoPage Integration Test Strategy

**AC6a test setup** — navigate through full flow to budget card:
1. `sendMessage('Need a holiday')`
2. `selectMoodChip(/Adventure/i)`
3. `selectDestinationCard(/Hội An/i)`
4. Click start date + end date + Confirm in calendar → budget card appears

For calendar interaction in test: use the `allDateButtons[5]` / `allDateButtons[12]` pattern from `DemoPage.calendarCard.test.tsx` AC7c (pick any two dates 7 apart). After confirm, budget card should be visible.

Check: `expect(screen.getByRole('slider')).toBeInTheDocument()` (input type="range" has implicit role="slider")
Check: `expect(screen.getByText(/What's your total budget/i)).toBeInTheDocument()`

**AC6b test — "Use this" after 1s:**
```typescript
// After budget card visible:
vi.useFakeTimers();
// Wait for 1100ms without touching slider:
await act(async () => { vi.advanceTimersByTime(1100); });
const useThisBtn = screen.getByRole('button', { name: /Use this/i });
await act(async () => { fireEvent.click(useThisBtn); });
vi.useRealTimers();

expect(screen.queryByRole('slider')).not.toBeInTheDocument(); // budget card hidden
expect(screen.getByText(/USD .+ · /i)).toBeInTheDocument();   // user bubble
expect(screen.getByText(/budget — I'm starting/i)).toBeInTheDocument(); // bot reply
```

**AC6c test — Surprise me on budget:**
```typescript
const surpriseBtn = screen.getByRole('button', { name: /Surprise me/i });
await act(async () => { fireEvent.click(surpriseBtn); });
expect(screen.queryByRole('slider')).not.toBeInTheDocument();
expect(screen.getByText(/starting on your plan/i)).toBeInTheDocument();
```

### Task 5 — DemoPage.calendarCard.test.tsx regression check

`DemoPage.calendarCard.test.tsx` AC7c checks `expect(screen.getByText(/nights — noted!/i))`. After 8.6 change, the bot message becomes "N nights — noted! **What's your total budget for this trip?**" — the regex `/nights — noted!/i` still matches ✅.

The test also checks `screen.queryAllByRole('grid').length === 0` — budget slider has `role="slider"` not `"grid"` ✅.

### Critical Patterns from Prior Stories

- **`.js` counterpart sync**: Vitest resolves `.js` over `.tsx`; every new `.tsx` MUST have a matching `.js` using compiled `_jsx`/`_jsxs` format from `"react/jsx-runtime"` — NOT JSX syntax
- **Export helpers**: `getBudgetTier` and constants must be exported from both `.tsx` and `.js` — App.tsx/App.js import them
- **`noUnusedLocals: true`**: Any unused variable/import → TS6133 build error
- **Timer refs**: Use `useRef<ReturnType<typeof setTimeout> | null>(null)` matching SlotFillingCard's `timerRef` pattern (not `NodeJS.Timeout`)
- **Timer cleanup**: `useEffect(() => { return () => { if (ref.current != null) clearTimeout(ref.current); }; }, [])` — identical to SlotFillingCard
- **Fake timers in RTL**: Wrap `vi.advanceTimersByTime` inside `act(async () => { ... })`
- **`motion-reduce:transition-none`**: On all elements with `transition-*` classes
- **React `act()` for state**: Each interaction that updates state must be in its own `act()` block
- **Tailwind arbitrary range variants**: `[&::-webkit-slider-thumb]:...` — these are standard Tailwind v3 arbitrary variant syntax, no plugin needed

### Flow State After 8.6

```
User selects travel dates → calendar confirm
  → calendar card hidden, budget card shown
  → bot: "N nights — noted! What's your total budget for this trip?"

User drags slider to $2,500
  → label: "~$2,500 · Mid-range · Covers flights + 3★ hotel"
  → real-time SLOT_UPDATE dispatched

After 1s inactivity
  → "Use this — Mid-range budget" chip appears

User taps "Use this"
  → budget card hidden
  → user bubble: "USD 2,500 · Mid-range"
  → bot: "Mid-range budget — I'm starting on your plan now."

[Story 8.7 will show multi-select cards for activities/dietary]
```

---

## Dev Agent Record

### Implementation Plan

TDD red-green-refactor cycle:
1. Wrote BudgetSliderCard.test.tsx (26 unit tests) — all failing (red phase)
2. Implemented BudgetSliderCard.tsx with inactivity timer starting on mount, getBudgetTier helper, ARIA attributes, slider thumb via Tailwind arbitrary variants
3. Synced BudgetSliderCard.js counterpart (JSX-runtime format)
4. Wired into App.tsx + App.js: budgetCardVisible state, handleBudgetChange/Select/Surprise, MOOD_BUDGET_MIDPOINTS
5. Wrote DemoPage.budgetCard.test.tsx (3 integration tests AC6a/b/c)

### Debug Log

Timer starts on mount (not just on slider change) — required by AC3 test which expects chip after 1100ms without any slider movement. useEffect fires setTimeout(1000ms) immediately, cleanup clears it on unmount.

### Completion Notes

✅ All 5 tasks complete. 458 tests pass (up from 429 baseline, +29 new tests).
- BudgetSliderCard: range USD 200–10,000, step 100, real-time label, 1s inactivity chip, Surprise me, full ARIA
- DemoPage: calendar confirm → budget card → "Use this"/"Surprise me" → flow advances

## File List

- stravel/frontend/src/components/cards/BudgetSliderCard.tsx (CREATE)
- stravel/frontend/src/components/cards/BudgetSliderCard.js (CREATE)
- stravel/frontend/src/components/cards/__tests__/BudgetSliderCard.test.tsx (CREATE)
- stravel/frontend/src/__tests__/DemoPage.budgetCard.test.tsx (CREATE)
- stravel/frontend/src/App.tsx (MODIFY)
- stravel/frontend/src/App.js (MODIFY)

## Change Log

- 2026-05-26: Story created (bmad-create-story workflow)
- 2026-05-26: Implementation complete — BudgetSliderCard + DemoPage wiring, 458/458 tests pass
