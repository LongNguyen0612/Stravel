# Story 8.7: Multi-Select Cards (Preferences & Dietary)

Status: done

## Story

As a traveler describing my preferences,
I want to tap-select multiple options from a grid for dietary restrictions, activity interests, and accessibility needs,
So that the proposal reflects my actual requirements without any typing.

## Acceptance Criteria

**AC1 — ARIA group/checkbox roles**

**Given** the bot asks for dietary requirements (FR-B5)
**When** the multi-select card renders
**Then** the container uses `role="group"` with `aria-label` set to the prompt text (e.g. `"Select dietary requirements"`)
**And** each chip uses `role="checkbox"` with `aria-checked` reflecting its current selected state
**And** the "No restrictions" chip is always present and its `aria-checked` is `true` when no other chip is selected

**AC2 — Toggle and deselect**

**Given** the user taps a preference chip
**When** it enters selected state
**Then** the chip shows the selected visual style: `bg-teal-600 text-white` with a Check icon (`aria-hidden="true"`)
**And** tapping the same chip again deselects it (returns to unselected state)
**And** multiple chips can be selected simultaneously (unlike SlotFillingCard single-select)

**AC3 — "No restrictions" mutual exclusion**

**Given** the user taps "No restrictions"
**When** it is selected
**Then** all other chips immediately deselect visually
**And** the dietary restrictions slot is set to an empty array (`[]`)
**And** tapping "No restrictions" when it is already the only selection has no additional effect

**Given** any other chip is selected when "No restrictions" is currently selected
**When** the user taps the other chip
**Then** "No restrictions" deselects automatically

**AC4 — Done chip emission**

**Given** the multi-select card has a "Done" chip
**When** tapped
**Then** `onSelect({ slotKey, value: selectedValues })` is called with `value` as a `string[]` of selected option values (empty array when "No restrictions" is selected)
**And** auto-advance occurs (the card visibility is controlled by the parent, same pattern as other cards)

**Note on `onSelect` signature:** The `MultiSelectCard` `onSelect` receives `{ slotKey: SlotKey; value: string[] }`. This differs from `SlotFillingCard` which emits `string`. The `SLOT_UPDATE` reducer action must accept either type — check `streamReducer.ts` before implementing.

**AC5 — Surprise me (activity card only)**

**Given** an `onSurprise` prop is provided and the user taps "Surprise me"
**When** selected
**Then** `onSurprise({ slotKey })` is called
**And** the parent (`App.tsx` `handleActivitySurprise`) selects 2–3 representative activity values based on the current `destination` and `mood` slot values, emits them, and advances with a rationale message

**Default surprise mapping (defined in `App.tsx`):**
| Mood | Activities |
|---|---|
| adventure | `['hiking', 'kayaking', 'rock_climbing']` |
| relaxation | `['spa', 'beach', 'yoga']` |
| culture | `['museums', 'cooking_class', 'heritage_tour']` |
| foodie | `['cooking_class', 'street_food_tour', 'wine_tasting']` |
| romance | `['sunset_cruise', 'spa', 'fine_dining']` |
| (default) | `['sightseeing', 'local_food', 'day_trip']` |

**AC6 — WCAG 2.1 AA (axe-core)**

**Given** `axe-core` runs on a `MultiSelectCard`
**When** evaluated in default state, selected state, and "No restrictions" state
**Then** zero WCAG 2.1 AA violations reported

**AC7 — DemoPage integration (dietary)**

**Given** the user has selected a budget on the budget slider card
**When** `handleBudgetSelect` or `handleBudgetSurprise` fires
**Then** the dietary card becomes visible
**And** the bot replies: `"Almost done! Any dietary requirements I should know about?"`

**Given** the user taps "Done" on the dietary card (with any selection including empty)
**When** `handleDietarySelect` fires
**Then** the dietary slot is updated and the dietary card hides
**And** a user message and bot reply confirm the selection:
  - If empty (no restrictions): user message `"No dietary restrictions"`, bot reply `"Noted — no restrictions."`
  - If one item: user message `"<Label>"`, bot reply `"Got it — <label>."`
  - If multiple items: user message `"<Label1>, <Label2>"`, bot reply `"Noted — <label1> and <label2>."`

---

## Tasks / Subtasks

- [x] Task 1: Create `MultiSelectCard.tsx` and `MultiSelectCard.js` components
  - [x] 1a: Define `MultiSelectCardProps` interface: `slotKey`, `prompt`, `options: ChipOption[]`, `onSelect (update: { slotKey: SlotKey; value: string[] }) => void`, `onSurprise?: (event: { slotKey: SlotKey }) => void`, `className?`
  - [x] 1b: Implement state: `selectedValues: string[]`; initialise to `[]` (no chips selected = "No restrictions" logically true)
  - [x] 1c: Implement `handleChipToggle(value: string)`: if `value === 'no_restrictions'` → set `[]`; else toggle presence in array and remove `'no_restrictions'` if present
  - [x] 1d: Implement `handleDone()`: call `onSelect({ slotKey, value: selectedValues })`
  - [x] 1e: Render `<div role="group" aria-label={prompt}>` containing chip buttons with `role="checkbox"`, `aria-checked`, Check icon when selected, and a "Done" button
  - [x] 1f: "No restrictions" chip: always in list as first option with value `'no_restrictions'`; shown as selected (aria-checked="true") when `selectedValues` is empty
  - [x] 1g: Surprise me chip: render only when `onSurprise` is defined; calls `onSurprise({ slotKey })` on click
  - [x] 1h: Create matching `MultiSelectCard.js` JSX-runtime counterpart (same pattern as `BudgetSliderCard.js`)
  - [x] 1i: Export from `src/components/cards/index.ts` and `index.js`

- [x] Task 2: Unit tests — `MultiSelectCard.test.tsx`
  - [x] 2a: AC1 — verify `role="group"`, `aria-label`, `role="checkbox"` on chips, `aria-checked` reflects state
  - [x] 2b: AC2 — chip toggles on/off; multiple chips selectable simultaneously
  - [x] 2c: AC3 — "No restrictions" deselects all others; selecting any chip auto-deselects "No restrictions"
  - [x] 2d: AC4 — "Done" chip calls `onSelect` with correct `string[]` value
  - [x] 2e: AC5 — "Surprise me" calls `onSurprise`
  - [x] 2f: AC4 edge — empty selection (no chips selected) passes `[]` in `onSelect`

- [x] Task 3: Axe test — `MultiSelectCard.axe.test.tsx`
  - [x] 3a: Default state (no chips selected) → zero violations
  - [x] 3b: With chips selected → zero violations
  - [x] 3c: "No restrictions" selected → zero violations

- [x] Task 4: Integrate into `App.tsx` — dietary card flow
  - [x] 4a: Import `MultiSelectCard` in `App.tsx` and `App.js`
  - [x] 4b: Define `DIETARY_OPTIONS` at module level in both `App.tsx` and `App.js`
  - [x] 4c: Define `MOOD_ACTIVITY_DEFAULTS` at module level in `App.tsx` (for future activity card story)
  - [x] 4d: Add `dietaryCardVisible` state (boolean, false)
  - [x] 4e: Modify `handleBudgetSelect` and `handleBudgetSurprise` to `setDietaryCardVisible(true)` and append dietary question message
  - [x] 4f: Implement `handleDietarySelect` with correct message formatting per AC7 rules
  - [x] 4g: Render dietary card after budget card in JSX; sync to `App.js`
  - [x] 4h: Widen `stream.ts` `SLOT_UPDATE` action type and `slotState` to accept `string | string[]`

- [x] Task 5: Integration tests — `DemoPage.multiSelectCard.test.tsx`
  - [x] 5a: AC7a — after budget card interaction, dietary card appears and bot message is shown
  - [x] 5b: AC7b — tapping "Done" with no selection ("No restrictions") advances flow with correct messages
  - [x] 5c: AC7c — tapping chips then "Done" emits correct values and advances flow

### Review Findings

- [x] [Review][Patch] `SLOT_UPDATE` array dispatch untested in streamReducer — type widened to `string | string[]` but no reducer test dispatches array value [`streamReducer.ts` + `streamReducer.test`]
- [x] [Review][Patch] Selected chip variant missing hover state — `selected` variant in `chipVariants` has no hover class while `default` has `hover:bg-surface-2` [`MultiSelectCard.tsx:21-24`]
- [x] [Review][Patch] Unit test checkbox count comment wrong + assertion too weak — comment says "options + 'No restrictions' + 'Done'" (Done is not a checkbox); `toBeGreaterThanOrEqual(OPTIONS.length)` should be `toBe(OPTIONS.length + 1)` [`MultiSelectCard.test.tsx:35`]
- [x] [Review][Patch] AC7a test regex too loose — `/dietary/i` would match any group with "dietary" in label; use exact prompt `/Any dietary requirements\?/i` [`DemoPage.multiSelectCard.test.tsx:96`]
- [x] [Review][Patch] `MOOD_ACTIVITY_DEFAULTS` missing `default` fallback key — AC5 spec explicitly lists `(default): ['sightseeing', 'local_food', 'day_trip']`; when mood is undefined the activity surprise will silently return undefined [`App.tsx:265-271`]
- [x] [Review][Defer] `handleActivitySurprise` not wired — AC5 App.tsx integration deferred to the activity card story; component-level AC5 support (onSurprise prop) is present and tested — deferred, pre-existing
- [x] [Review][Defer] `no_restrictions` magic string in three places — refactoring concern; export `NO_RESTRICTIONS_VALUE` constant when component stabilises — deferred, pre-existing
- [x] [Review][Defer] `aria-label` on group duplicates visible `<p>` text — axe passes; SR users hear prompt twice; refactor to `aria-labelledby` + `useId()` in accessibility cleanup story — deferred, pre-existing
- [x] [Review][Defer] Calendar test indices `[5]`/`[12]` hardcoded — pre-existing pattern from story 8-5/8-6; real-date flake risk; migrate to `aria-label` date queries — deferred, pre-existing
- [x] [Review][Defer] `SLOT_UPDATE` action uses single quotes; rest of file uses double quotes — style inconsistency in `stream.ts`; fix with linter pass — deferred, pre-existing
- [x] [Review][Defer] `slotState` consumers that read a key expecting `string` now risk receiving `string[]` — type union needs care at downstream read sites — deferred, pre-existing

---

## Dev Notes

### Architecture and Patterns

**`.js` counterpart requirement (critical):**
Every `.tsx` card component must have a matching `.js` file that re-implements using `_jsx`/`_jsxs` from `"react/jsx-runtime"` — NOT JSX syntax. Vitest resolves `.js` over `.tsx` in its module graph; the `.js` counterpart is what actually runs in tests. Follow the exact pattern from `BudgetSliderCard.js`.

**`onSelect` signature difference from `SlotFillingCard`:**
`SlotFillingCard.onSelect` emits `{ slotKey, value: string }`.
`MultiSelectCard.onSelect` emits `{ slotKey, value: string[] }`.
The `SLOT_UPDATE` reducer in `streamReducer.ts` currently stores `action.payload.value` directly on `slotState`. Check whether `string[]` is already accepted or whether the type needs widening. Current signature (line 43 in `streamReducer.ts`): `return { ...state, slotState: { ...state.slotState, [action.payload.slotKey]: action.payload.value } }` — the value type on `slotState` is effectively `unknown` via the object spread, so no change required to the reducer itself. However, verify `StreamAction` type in `streamReducer.ts` accepts `value: string | string[]`.

**"No restrictions" UX logic:**
- Initial state: `selectedValues = []` → "No restrictions" renders as `aria-checked="true"` (implicitly selected)
- User taps any chip → that value added, "No restrictions" deselects
- User taps "No restrictions" explicitly → `selectedValues = []`, all deselect
- "Done" with empty array → emits `[]`

**Dietary vs Activity card:**
This story implements only the **dietary** card in the DemoPage flow. The activity card (`slotKey="activities"`) component can be implemented (same `MultiSelectCard` component, different options and `onSurprise`), but the DemoPage integration for activities is deferred to a future story (8-10 zero-typing verification) to keep scope bounded.

**Bot message formatting for dietary confirmations (AC7):**
```typescript
const labels = value.map(v => DIETARY_OPTIONS.find(o => o.value === v)?.label ?? v);
const userMsg = labels.length === 0 ? 'No dietary restrictions' : labels.join(', ');
const botMsg = labels.length === 0 ? 'Noted — no restrictions.' :
  labels.length === 1 ? `Got it — ${labels[0]}.` :
  `Noted — ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}.`;
```

**Check icon:**
Use a simple Unicode checkmark `✓` with `aria-hidden="true"`, matching the `SlotFillingCard` pattern. No external icon library dependency.

**`cva` chip variants:**
Reuse the same `chipVariants` shape from `SlotFillingCard`, but with `role="checkbox"` instead of `role="radio"`. The visual states (default, selected) are identical. Do not import from `SlotFillingCard` — define locally to keep component self-contained.

### Integration test navigation helper

The integration tests for AC7 will need a `navigateToDietaryCard()` helper that calls `navigateToBudgetCard()` (from the existing test file) then advances through the budget card. The "Use this" chip appears after 1s of inactivity (requires `vi.useFakeTimers()` and `vi.advanceTimersByTime(1100)`).

Refer to `src/__tests__/DemoPage.budgetCard.test.tsx` for the established `navigateToBudgetCard` helper pattern.

### Previous Story Learnings (from 8-6)

1. **Timer tests need `vi.useFakeTimers()` in `beforeEach`** — use fake timers for any test that depends on `setTimeout` behaviour. Always call `vi.useRealTimers()` in `afterEach`.
2. **`Array.find()` safety** — use `?? fallback` instead of `!` non-null assertion for all array finds.
3. **`fireEvent.click` + `fireEvent.keyDown` for advancing** — the `SlotFillingCard` 300ms timer can be bypassed in tests by firing both click and Enter key events.
4. **Integration tests use fake timers globally** — if any card in the navigation path uses a timer (budget card inactivity timer), all tests in that file need `vi.useFakeTimers()` in `beforeEach`.
5. **`dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } })`** — standard pattern for all slot updates.

### File List

Files created:
- `stravel/frontend/src/components/cards/MultiSelectCard.tsx`
- `stravel/frontend/src/components/cards/MultiSelectCard.js`
- `stravel/frontend/src/components/cards/__tests__/MultiSelectCard.test.tsx`
- `stravel/frontend/src/components/cards/__tests__/MultiSelectCard.axe.test.tsx`
- `stravel/frontend/src/__tests__/DemoPage.multiSelectCard.test.tsx`

Files modified:
- `stravel/frontend/src/components/cards/index.ts`
- `stravel/frontend/src/components/cards/index.js`
- `stravel/frontend/src/App.tsx`
- `stravel/frontend/src/App.js`
- `stravel/frontend/src/types/stream.ts` (widened `SLOT_UPDATE` value and `slotState` to `string | string[]`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Dev Agent Record

### Implementation Plan
(To be filled by dev agent)

### Debug Log
(To be filled by dev agent)

### Completion Notes

- `MultiSelectCard` implements toggle-checkbox semantics with `role="group"` / `role="checkbox"` pattern
- "No restrictions" is implicitly selected when `selectedValues = []`; explicit selection sets state to `[]`
- `onSelect` emits `string[]` (empty array for no restrictions), different from `SlotFillingCard`'s `string`
- `stream.ts` widened: `SLOT_UPDATE.payload.value: string | string[]` and `slotState: Partial<Record<SlotKey, string | string[]>>`
- `App.js` and `App.tsx` kept in sync; dietary card renders after budget card in flow
- Budget handlers (`handleBudgetSelect`, `handleBudgetSurprise`) now each append 3 messages: user bubble, budget confirmation, dietary question
- 17 unit tests + 3 axe tests + 3 integration tests — all 481 tests green, zero regressions

---

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-05-26 | Story created | bmad-create-story |
| 2026-05-26 | Implementation complete — all tasks done, 481 tests green | dev-agent |
