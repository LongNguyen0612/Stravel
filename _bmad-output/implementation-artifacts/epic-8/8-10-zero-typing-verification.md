# Story 8.10: Zero-Typing Profile Verification Screen

Status: done

## Story

As a traveler who completed profile setup via cards,
I want to see a summary of everything the bot collected so I can confirm before generating my proposal,
So that I catch any errors before the AI generation begins without having to type anything.

## Acceptance Criteria

**AC1 — Verification screen appears after passport card**

**Given** the user completes (or skips) the passport upload card
**When** `handlePassportSelect` or `handlePassportSkip` fires in `DemoPage`
**Then** `verificationCardVisible` becomes `true`
**And** the `ProfileVerificationCard` renders inline in the conversation thread after the passport card hides
**And** a bot message "Here's what I've got — does everything look right?" precedes the card

**AC2 — Summary lists all collected slots**

**Given** the verification card renders
**When** rendered with a filled slotState (destination, travel_dates, budget, dietary, passport_expiry)
**Then** the card shows a structured summary:
```
📍 Destination: <destination label>
📅 Dates: <start> – <end> · <N> nights
💰 Budget: ~$<amount>
🍽️ Dietary: <labels> | No restrictions
🛂 Passport expiry: <DD/MM/YYYY> | Skipped
```
**And** optional slots that were not collected (`traveler_count` if absent, `passport_expiry` if skipped) are omitted or show "Skipped"
**And** mandatory slots always appear (destination, dates, budget)

**AC3 — "Looks good — build my trip!" CTA**

**Given** the verification card is visible
**When** the user taps "Looks good — build my trip!"
**Then** `onConfirm` is called
**And** in `DemoPage`, `verificationCardVisible` becomes `false`
**And** a user bubble "Looks good — build my trip!" is appended
**And** a bot bubble "Starting your proposal… I'll analyse your requirements and put together a trip." is appended
**And** `dispatchStream({ type: 'STAGE_CHANGE', payload: 'profiling' })` is dispatched

**AC4 — "Edit something" CTA**

**Given** the verification card is visible
**When** the user taps "Edit something"
**Then** `onEdit` is called
**And** in `DemoPage`, `verificationCardVisible` becomes `false` and `editSlotMenuVisible` becomes `true`
**And** the edit-slot menu renders as a `SlotFillingCard` with chips for each filled slot:
  - "Destination" if `destination` is filled
  - "Dates" if `travel_dates` is filled
  - "Budget" if `budget` is filled
  - "Dietary" if `dietary` is filled
  - "Passport expiry" if `passport_expiry` is filled and not `'skipped'`
**And** tapping a chip sets `editingSlot` to that SlotKey and shows the appropriate card

**AC5 — Edit slot replay and return to verification**

**Given** the user is in edit mode (editingSlot is set)
**When** the user completes the card for the editing slot (confirms or skips)
**Then** the card hides and `verificationCardVisible` becomes `true` again
**And** `editingSlot` is reset to `null`
**And** the updated value is reflected in the summary (slotState is updated via SLOT_UPDATE)
**And** a user bubble reflects the new value for that slot

**AC6 — Zero-typing E2E**

**Given** the entire flow from canvas load to verification screen
**When** completed using only card taps and button clicks (no keyboard text input)
**Then** the verification screen is reachable and "Looks good — build my trip!" is tappable
**And** no keyboard input is required at any step (FR-B8)

**AC7 — Keyboard accessibility + WCAG**

**Given** the `ProfileVerificationCard` is navigated by keyboard
**When** Tab reaches the card
**Then** both CTA buttons have visible focus rings and are activatable via Enter/Space
**And** the summary list has `role="list"` with each row as `role="listitem"`
**And** `axe-core` reports zero WCAG 2.1 AA violations

---

## Tasks / Subtasks

- [x] Task 1: Create `ProfileVerificationCard.tsx` component
  - [x] 1a: Define `ProfileVerificationItem` interface: `{ icon: string; label: string; value: string }`
  - [x] 1b: Define `ProfileVerificationCardProps`: `{ items: ProfileVerificationItem[]; onConfirm: () => void; onEdit: () => void; className?: string }`
  - [x] 1c: Render summary section: `<ul role="list">` with `<li role="listitem">` per item; each row: `<span>{icon}</span> <span className="font-medium">{label}:</span> <span>{value}</span>`
  - [x] 1d: Render CTA buttons: `<button onClick={onConfirm}>Looks good — build my trip!</button>` and `<button onClick={onEdit}>Edit something</button>`; both `min-h-[44px]` for touch target compliance
  - [x] 1e: Button styles — "Looks good" uses primary style (`bg-teal-600 text-white hover:bg-teal-700`); "Edit something" uses ghost/outline style (`border border-border bg-surface hover:bg-surface-2`)
  - [x] 1f: Card wrapper: apply `className` prop; use consistent card styling matching other cards in the codebase (`rounded-2xl border border-border bg-surface p-4 shadow-sm`)
  - [x] 1g: Add `data-testid="profile-verification-card"` on the root element for test queries

- [x] Task 2: Create `ProfileVerificationCard.js` counterpart (CRITICAL — Vitest resolves .js over .tsx)
  - [x] 2a: Re-implement using `_jsx`/`_jsxs` from `"react/jsx-runtime"` — NO JSX syntax
  - [x] 2b: All props, structure, and logic identical to the .tsx version; plain JS (no TypeScript annotations)
  - [x] 2c: Follow `BudgetSliderCard.js` as the exact structural template

- [x] Task 3: Export from card index
  - [x] 3a: Add to `src/components/cards/index.ts`: `export { ProfileVerificationCard } from './ProfileVerificationCard'; export type { ProfileVerificationCardProps, ProfileVerificationItem } from './ProfileVerificationCard';`
  - [x] 3b: Add equivalent export to `src/components/cards/index.js`

- [x] Task 4: Unit tests — `ProfileVerificationCard.test.tsx`
  - [x] 4a: AC2 — renders all items with icon, label, value; `role="list"` and `role="listitem"` present
  - [x] 4b: AC3 — "Looks good — build my trip!" button calls `onConfirm`
  - [x] 4c: AC4 — "Edit something" button calls `onEdit`
  - [x] 4d: AC7 — both buttons have accessible labels; card element is in the document

- [x] Task 5: Axe tests — `ProfileVerificationCard.axe.test.tsx`
  - [x] 5a: Zero WCAG 2.1 AA violations with populated items
  - [x] 5b: Zero violations with single item (edge case)
  - [x] **Pattern:** Follow `MultiSelectCard.axe.test.tsx` exactly

- [x] Task 6: Integrate into `App.tsx` — verification states
  - [x] 6a: Add states: `verificationCardVisible` (boolean, false), `editSlotMenuVisible` (boolean, false), `editingSlot: SlotKey | null` (null)
  - [x] 6b: Import `ProfileVerificationCard` in `App.tsx`
  - [x] 6c: Modify `handlePassportSelect`: after updating slot and hiding passport card, also `setVerificationCardVisible(true)` and append bot message `"Here's what I've got — does everything look right?"`
  - [x] 6d: Modify `handlePassportSkip`: same as 6c — set `verificationCardVisible(true)` and append bot message
  - [x] 6e: Implement `handleVerificationConfirm`: `setVerificationCardVisible(false)`, append user bubble `"Looks good — build my trip!"`, append bot bubble `"Starting your proposal… I'll analyse your requirements and put together a trip."`, dispatch `STAGE_CHANGE` to `'profiling'`
  - [x] 6f: Implement `handleVerificationEdit`: `setVerificationCardVisible(false)`, `setEditSlotMenuVisible(true)`, append bot message `"Sure — which part would you like to change?"`
  - [x] 6g: Add `computeVerificationItems(slotState, streamState)` helper in `DemoPage` scope: maps slot keys to display items; use `DESTINATION_OPTIONS` for destination label lookup; format travel_dates as "start – end · N nights"; format budget as "~$X,XXX"; format dietary as joined labels or "No restrictions"; format passport_expiry as DD/MM/YYYY or "Skipped"; skip traveler_count if undefined
  - [x] 6h: Render `ProfileVerificationCard` after `passportCardVisible` block in JSX: `{verificationCardVisible && <ProfileVerificationCard items={computeVerificationItems(streamState.slotState)} onConfirm={handleVerificationConfirm} onEdit={handleVerificationEdit} className="mx-4 mb-2" />}`

- [x] Task 7: Integrate into `App.tsx` — edit slot menu
  - [x] 7a: Define `EDIT_SLOT_OPTIONS` constant: array of `{ label: string; value: string }` mapping display names to SlotKey values; include only slots that have dedicated cards: destination, travel_dates, budget, dietary, passport_expiry
  - [x] 7b: Implement `handleEditFieldSelect({ value }: { slotKey: SlotKey; value: string })`: set `editingSlot` to `value as SlotKey`, set `editSlotMenuVisible(false)`, switch on value to show the right card
  - [x] 7c: Compute `editableSlotOptions`: filter `EDIT_SLOT_OPTIONS` to only slots with a filled slotState value; convert to `ChipOption[]`
  - [x] 7d: Render edit-slot `SlotFillingCard` after verification card block: `{editSlotMenuVisible && <SlotFillingCard slotKey="mood" prompt="Which would you like to change?" options={editableSlotOptions} onSelect={handleEditFieldSelect} className="mx-4 mb-2" />}` (slotKey="mood" is a placeholder — the value field carries the slot to edit; no SLOT_UPDATE is dispatched for this card)
  - [x] 7e: **CRITICAL note:** `handleEditFieldSelect` must NOT call `dispatchStream(SLOT_UPDATE)` — it is routing logic, not a slot update. The normal card handler that fires after edit does the dispatch.

- [x] Task 8: Modify card handlers for edit mode in `App.tsx`
  - [x] 8a: Modify `handleDestinationSelect`: if `editingSlot === 'destination'`, after SLOT_UPDATE and hiding card, set `editingSlot(null)` and `verificationCardVisible(true)` with a brief user bubble showing the new destination label; do NOT show calendar card
  - [x] 8b: Modify `handleCalendarConfirm`: if `editingSlot === 'travel_dates'`, after SLOT_UPDATE and hiding calendar, set `editingSlot(null)` and `verificationCardVisible(true)` with user bubble showing new dates; do NOT show budget card
  - [x] 8c: Modify `handleBudgetSelect` and `handleBudgetSurprise`: if `editingSlot === 'budget'`, after SLOT_UPDATE and hiding budget card, set `editingSlot(null)` and `verificationCardVisible(true)` with user bubble showing new budget; do NOT show dietary card
  - [x] 8d: Modify `handleDietarySelect`: if `editingSlot === 'dietary'`, after SLOT_UPDATE and hiding dietary card, set `editingSlot(null)` and `verificationCardVisible(true)` with user bubble; do NOT show passport card
  - [x] 8e: Modify `handlePassportSelect` and `handlePassportSkip`: if `editingSlot === 'passport_expiry'`, after SLOT_UPDATE and hiding passport card, set `editingSlot(null)` and `verificationCardVisible(true)` with user bubble; (normal path already shows verification)

- [x] Task 9: Sync `App.js`
  - [x] 9a: Mirror all changes from Task 6–8 in `App.js` using `_jsx`/`_jsxs` runtime; no JSX syntax
  - [x] 9b: Import `ProfileVerificationCard` in `App.js` using the same pattern as existing card imports

- [x] Task 10: Integration tests — `DemoPage.verificationCard.test.tsx`
  - [x] 10a: AC1 — after passport Skip, verification card appears with `data-testid="profile-verification-card"` and bot message "does everything look right?"
  - [x] 10b: AC2 — verification card shows destination label, budget, and dates from slotState
  - [x] 10c: AC3 — tap "Looks good — build my trip!": card hides, user bubble shows, bot "Starting your proposal…" shows
  - [x] 10d: AC4/AC5 — tap "Edit something": edit menu chip list appears; tap "Budget" chip: budget card reappears; confirm budget: budget card hides, verification card reappears with updated budget value
  - [x] 10e: AC6 — full zero-typing path: navigate to passport, skip passport, tap "Looks good" — no `fireEvent.change` on text inputs used throughout the whole flow

### Review Findings

- [x] [Review][Patch] AC4 violation — passport chip appears in edit menu when passport_expiry='skipped'; filter `!== undefined` does not exclude the 'skipped' value [App.tsx:793]
- [x] [Review][Patch] AC5 gap — no user bubble added when handlePassportSkip resolves in edit mode; all other edit-path handlers append a user bubble before returning to verification [App.tsx:598-601]
- [x] [Review][Patch] handleEditFieldSelect switch missing default case — if value is not a recognised SlotKey, editingSlot is set with no card opened (stuck state) [App.tsx:679-685]
- [x] [Review][Patch] handleVerificationEdit should reset editingSlot to null before opening edit menu to prevent stale state from any interrupted prior edit [App.tsx:666-673]
- [x] [Review][Patch] Test gap: AC1 — no test covers passport SELECT path reaching verification card + bot message "does everything look right?" [DemoPage.verificationCard.passportSelect.test.tsx]
- [x] [Review][Patch] Test gap: AC2 — integration test only asserts 2 of 5 summary slots (Hội An, Budget); Dates, Dietary, Passport expiry ("Skipped") not verified [DemoPage.verificationCard.test.tsx]
- [x] [Review][Patch] Test gap: AC5 — only Budget edit path tested; Destination, Dates, Dietary, and Passport edit paths unverified [DemoPage.verificationCard.test.tsx]
- [x] [Review][Patch] Test gap: AC3 — STAGE_CHANGE dispatch to 'profiling' not asserted in integration test [DemoPage.verificationCard.test.tsx]
- [x] [Review][Defer] No user bubble for passport Skip in normal (non-edit) flow [App.tsx:603-608] — deferred, UX consistency improvement; not mandated by spec
- [x] [Review][Defer] "Starting your proposal…" hardcoded message with no backend trigger in demo mode [App.tsx:657-664] — deferred, SSE integration is Epic 9 scope
- [x] [Review][Defer] new Date(s + 'T00:00') format missing timezone — DST edge case risk in date display [App.tsx:622-625] — deferred, pre-existing pattern; low risk in browser
- [x] [Review][Defer] ProfileVerificationCard container has no role="region" or aria-label — screen reader region labelling [ProfileVerificationCard.tsx:23] — deferred, enhancement beyond AC7 spec
- [x] [Review][Defer] handleVerificationConfirm does not clear editingSlot — defensive reset; unreachable in normal flow but harmless fix [App.tsx:656] — deferred, low risk
- [x] [Review][Defer] key={item.label} on list items — duplicate key risk if two items share label [ProfileVerificationCard.tsx:32] — deferred, labels are unique from computeVerificationItems; no real-world collision
- [x] [Review][Defer] slotKey="mood" on edit menu SlotFillingCard — Escape-to-freetext could leave editingSlot stuck with invalid value [App.tsx:791] — deferred, pending Epic 9 edit flow refactor

---

## Dev Notes

### Architecture and Patterns

**`.js` counterpart requirement (critical):**
Every `.tsx` card component must have a matching `.js` using `_jsx`/`_jsxs` from `"react/jsx-runtime"` — NOT JSX syntax. Vitest resolves `.js` over `.tsx`; the `.js` file is what tests actually import. Follow `BudgetSliderCard.js` as the exact structural template.

**`SlotFillingCard` re-use for edit menu:**
The edit-slot menu reuses the existing `SlotFillingCard` with `slotKey="mood"` as a placeholder. The `value` field of each chip option is the SlotKey to edit (e.g. `"destination"`, `"travel_dates"`). `handleEditFieldSelect` handles routing and must NOT dispatch `SLOT_UPDATE` — it is routing-only. The normal per-card handlers dispatch SLOT_UPDATE when the user completes the replayed card.

**Edit mode detection pattern:**
Check `editingSlot !== null` in each card handler. When in edit mode, after the card completes:
```typescript
if (editingSlot) {
  setEditingSlot(null);
  setVerificationCardVisible(true);
  // append minimal user bubble for the updated value
  return;
}
// normal flow: show next card
```

**`computeVerificationItems` helper:**
This pure function reads `streamState.slotState` and returns display-ready items. Place it inside `DemoPage` (not at module level) since it closes over `DESTINATION_OPTIONS` and `DIETARY_OPTIONS`. Example:

```typescript
function computeVerificationItems(
  slotState: Partial<Record<SlotKey, string | string[]>>
): ProfileVerificationItem[] {
  const items: ProfileVerificationItem[] = [];

  // Destination (mandatory)
  if (slotState.destination) {
    const dest = DESTINATION_OPTIONS.find(o => o.value === slotState.destination);
    items.push({ icon: '📍', label: 'Destination', value: dest?.label ?? String(slotState.destination) });
  }

  // Dates (mandatory)
  if (slotState.travel_dates && typeof slotState.travel_dates === 'string') {
    const [start, end] = (slotState.travel_dates as string).split(',');
    if (start && end) {
      const fmtDate = (s: string) =>
        new Date(s + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const nights = Math.round((new Date(end + 'T00:00').getTime() - new Date(start + 'T00:00').getTime()) / 86400000);
      items.push({ icon: '📅', label: 'Dates', value: `${fmtDate(start)} – ${fmtDate(end)} · ${nights} night${nights === 1 ? '' : 's'}` });
    }
  }

  // Budget (mandatory)
  if (slotState.budget) {
    const amount = parseInt(String(slotState.budget), 10);
    if (!isNaN(amount)) {
      items.push({ icon: '💰', label: 'Budget', value: `~$${amount.toLocaleString()}` });
    }
  }

  // Dietary (optional — show even if empty array = "No restrictions")
  if (slotState.dietary !== undefined) {
    const vals = Array.isArray(slotState.dietary) ? slotState.dietary as string[] : [];
    const labels = vals.map(v => DIETARY_OPTIONS.find(o => o.value === v)?.label ?? v);
    items.push({ icon: '🍽️', label: 'Dietary', value: labels.length ? labels.join(', ') : 'No restrictions' });
  }

  // Passport expiry (optional)
  if (slotState.passport_expiry) {
    const val = String(slotState.passport_expiry);
    items.push({
      icon: '🛂',
      label: 'Passport expiry',
      value: val === 'skipped' ? 'Skipped' : formatDateForDisplay(val),
    });
  }

  return items;
}
```

**STAGE_CHANGE dispatch for advisory trigger:**
`WorkflowStage` is `"idle" | "profiling" | "calculating" | "proposing" | "validating" | "complete"` (see `src/types/stream.ts`). Use `'profiling'` as the stage to represent the PLANNING stage in the demo. No backend call is needed in this story — the actual SSE advisory integration is Epic 9.

**`formatDateForDisplay` is already defined at module level in App.tsx (P3 guard added in story 8-9):**
```typescript
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function formatDateForDisplay(iso: string): string {
  if (!iso || !DATE_REGEX.test(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}
```

**Edit flow slot → card mapping:**
```typescript
switch (slotToEdit) {
  case 'destination': setDestinationCardVisible(true); break;
  case 'travel_dates': setCalendarCardVisible(true); break;
  case 'budget': setBudgetCardVisible(true); break;
  case 'dietary': setDietaryCardVisible(true); break;
  case 'passport_expiry': setPassportCardVisible(true); break;
}
```

**Note on `editableSlotOptions`:**
Build this dynamically from `streamState.slotState` to only show chips for slots that have been filled:
```typescript
const EDIT_SLOT_OPTIONS = [
  { label: 'Destination', value: 'destination' },
  { label: 'Dates', value: 'travel_dates' },
  { label: 'Budget', value: 'budget' },
  { label: 'Dietary', value: 'dietary' },
  { label: 'Passport expiry', value: 'passport_expiry' },
] as const;

const editableSlotOptions: ChipOption[] = EDIT_SLOT_OPTIONS.filter(
  opt => streamState.slotState[opt.value as SlotKey] !== undefined
);
```

**Learnings from story 8-9:**
- Use `getAllByText` instead of `getByText` when the same text may appear in multiple DOM nodes (e.g. aria-live regions + visible UI)
- Integration tests that navigate through the budget card MUST use `vi.useFakeTimers()` because of the 1s inactivity timer
- Never use `apiClient` for non-JSON endpoints; `ProfileVerificationCard` has no fetch calls so this does not apply here

### Integration test navigation helper

```typescript
async function navigateToVerificationCard() {
  await sendMessage('Need a holiday');
  await selectMoodChip(/Adventure/i);
  await selectDestinationCard(/Hội An/i);

  // Pick dates
  const allDateButtons = screen.getAllByRole('gridcell').filter(
    el => el.tagName === 'BUTTON' && el.getAttribute('aria-label')
  );
  await act(async () => { fireEvent.click(allDateButtons[5]); });
  await act(async () => { fireEvent.click(allDateButtons[12]); });
  const confirmBtn = screen.getByRole('button', { name: /Confirm \d+ nights/i });
  await act(async () => { fireEvent.click(confirmBtn); });

  // Budget card inactivity timer (1s)
  await act(async () => { vi.advanceTimersByTime(1100); });
  const useThisBtn = screen.getByRole('button', { name: /Use this/i });
  await act(async () => { fireEvent.click(useThisBtn); });

  // Dietary — Done with no selection
  const doneBtn = screen.getByRole('button', { name: /^Done$/i });
  await act(async () => { fireEvent.click(doneBtn); });

  // Skip passport
  const skipBtn = screen.getByRole('button', { name: /Skip/i });
  await act(async () => { fireEvent.click(skipBtn); });
}
```

### Test mocking pattern

All integration tests require these mocks and timer setup:
```typescript
vi.mock('../hooks/useFooterHeight', () => ({ useFooterHeight: () => 0 }));
vi.mock('../components/cards/TravelCard', () => ({ TravelCard: () => <div data-testid="travel-card" /> }));
vi.mock('../utils/messageClassifier', () => ({ classifyMessage: vi.fn(() => 'ambiguous') }));
vi.mock('react-markdown', () => ({ default: ({ children }: { children: string }) => <span>{children}</span> }));

beforeEach(() => { localStorage.removeItem('stravel_agent_mode'); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
```

---

## Dev Agent Record

### Implementation Plan
ProfileVerificationCard.tsx + .js: pure presentational card with role="list" summary + two CTA buttons. computeVerificationItems() closure in DemoPage reads slotState and maps to display-ready ProfileVerificationItem[]. Edit flow reuses SlotFillingCard with routing-only handleEditFieldSelect (no SLOT_UPDATE). Each card handler checks editingSlot !== null to short-circuit to verification instead of proceeding to next card. Advisory trigger dispatches STAGE_CHANGE('profiling') and shows bot message — actual SSE workflow deferred to Epic 9.

### Debug Log
- SlotFillingCard edit menu chip has 300ms auto-advance timer; integration test needed `vi.advanceTimersByTime(400)` after chip tap before budget card appeared.

### Completion Notes
✅ ProfileVerificationCard.tsx + ProfileVerificationCard.js created (9 unit tests, 2 axe tests — 11 passing)
✅ App.tsx: 3 new states, computeVerificationItems, handleVerificationConfirm, handleVerificationEdit, handleEditFieldSelect, all 7 card handlers updated for edit mode
✅ App.js: all changes mirrored in _jsx/_jsxs runtime
✅ DemoPage.verificationCard.test.tsx: 6 integration tests (AC1–AC6) — all passing
✅ Full suite: 523/523 tests passing, zero regressions

---

## File List

- stravel/frontend/src/components/cards/ProfileVerificationCard.tsx (new)
- stravel/frontend/src/components/cards/ProfileVerificationCard.js (new)
- stravel/frontend/src/components/cards/index.ts (modified — added ProfileVerificationCard export)
- stravel/frontend/src/components/cards/index.js (modified — added ProfileVerificationCard export)
- stravel/frontend/src/components/cards/__tests__/ProfileVerificationCard.test.tsx (new)
- stravel/frontend/src/components/cards/__tests__/ProfileVerificationCard.axe.test.tsx (new)
- stravel/frontend/src/App.tsx (modified — verification + edit flow)
- stravel/frontend/src/App.js (modified — verification + edit flow)
- stravel/frontend/src/__tests__/DemoPage.verificationCard.test.tsx (new)

---

## Change Log

| Date | Description |
|------|-------------|
| 2026-05-26 | Story created from epics-v2.md Story 2.10 (FR-B8, FR-D4); learnings from story 8-9 incorporated |
| 2026-05-26 | Implementation complete: ProfileVerificationCard component + full verification/edit flow in App.tsx/App.js; 523/523 tests passing |
