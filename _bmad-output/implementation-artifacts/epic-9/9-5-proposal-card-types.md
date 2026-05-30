# Story 9.5: Proposal Card Types

Status: done

## Story

As a traveler reviewing my AI-generated proposal,
I want distinct card types for each aspect of my trip — flights, hotel, activities, budget, compliance, booking,
So that I can scan and understand the full proposal at a glance without reading a wall of text.

## Acceptance Criteria

**AC1 — Six card types rendered with correct field layouts**
Given the proposal SSE stream emits card.update events
When cards are rendered by TravelCard
Then the following card types display correctly in `forming` and `settled` states:
- `flight`: origin/destination, depart/return dates, airline, price, flightTimes
- `hotel`: neighborhood/location, star range, name, nightlyRate, highlights (≤3 bullet strings)
- `activities`: category, cityZone, venue, hours, cost, dayNumber, description
- `visa`: destinationCountry, nationality, processingTime, fee
- `budget`: total, currency, plus per-category breakdown: flights, accommodation, activities, misc
- `compliance`: visaRequirement text, passportCheck result, healthAdvisories array (collapsed by default, expandable)
- `booking`: "Book this trip" CTA button — visible only when deckState === 'committing'

**AC2 — Nascent shimmer field count per card type**
Given a card is in `nascent` state (completeness_score < 0.25)
When rendered
Then structural field placeholders show the card's field layout:
- flight: 4 shimmer rows
- hotel: 3 shimmer rows
- activities: 3 shimmer rows
- visa: 3 shimmer rows
- budget: 4 shimmer rows
- compliance: 3 shimmer rows
- booking: 1 shimmer row

**AC3 — HotelCard compliance dot badge**
Given a hotel card has `complianceSeverity` set in its delta data
When rendered in `forming` or `settled` state
Then a dot badge appears in the card header: 🔴 (block), 🟡 (warning), 🟢 (clear)
And the badge is tappable — fires `onComplianceBadgeTap(cardId)` prop when tapped
And the badge has `role="status"` and `aria-label="Compliance: [block|warning|clear]"`

**AC4 — ComplianceCard expandable advisories**
Given a compliance card renders
When `healthAdvisories` array has ≥1 items AND card is in `settled` state
Then a "Show advisories" toggle button is visible
And clicking it expands/collapses the advisories list inline
And the toggle aria-label reflects current state: "Show X advisories" / "Hide advisories"

**AC5 — BookingCard CTA active only in committing state**
Given a booking card is rendered
When deckState === 'browsing'
Then the "Book this trip" button is NOT rendered (card shows placeholder)
When deckState === 'committing'
Then the "Book this trip" button renders and is enabled

**AC6 — CardType union extended without regressions**
Given the new card types are added to `CardType`
When existing flight/hotel/activities/visa cards render
Then all existing tests and behavior are unchanged

---

## Tasks / Subtasks

- [x] Task 1: Extend type definitions (AC1, AC6)
  - [x] 1.1 In `src/types/domain.ts`: extend `CardType` union to `'flight' | 'hotel' | 'activities' | 'visa' | 'budget' | 'compliance' | 'booking'`
  - [x] 1.2 In `src/components/cards/cardUtils.ts`: add `BudgetCardData` interface with `total?: number; currency?: string; flights?: number; accommodation?: number; activities?: number; misc?: number`
  - [x] 1.3 Add `ComplianceCardData` interface with `visaRequirement?: string; passportCheck?: string; healthAdvisories?: string[]; isBlock?: boolean`
  - [x] 1.4 Add `BookingCardData` interface (empty — no data fields; presence of card triggers CTA)
  - [x] 1.5 Add `highlights?: string[]` and `complianceSeverity?: 'block' | 'warning' | 'clear'` to `HotelCardData`
  - [x] 1.6 Add `dayNumber?: number` and `description?: string` to `ActivityCardData`
  - [x] 1.7 Update `CardData` union type to include the 3 new interfaces
  - [x] 1.8 Write unit tests in `src/components/cards/__tests__/cardUtils.test.ts` confirming `cardDisplayState` still works correctly for all states

- [x] Task 2: Add BudgetCard fields component (AC1, AC2)
  - [x] 2.1 Add `budget` to `CARD_ICONS` in `TravelCard.tsx` (use 💰)
  - [x] 2.2 Add `BudgetFields` component in `TravelCard.tsx`:
    - Nascent: 4 ShimmerFields
    - Forming/settled: shows Total row with `${total} ${currency}` and category breakdown grid (flights / accommodation / activities / misc) — each row shows label + amount or `—`
    - Settled-only: show subtotal confirmation row
  - [x] 2.3 Wire `BudgetFields` into the `TravelCard` render switch
  - [x] 2.4 Write Vitest tests in `__tests__/TravelCard.budget.test.tsx`: renders total and breakdown in settled state; shows shimmers in nascent; shows `—` for missing fields

- [x] Task 3: Add ComplianceCard fields component (AC1, AC2, AC4)
  - [x] 3.1 Add `compliance` to `CARD_ICONS` (use 🛡️)
  - [x] 3.2 Add `ComplianceFields` component with internal `useState<boolean>(false)` for expand/collapse:
    - Nascent: 3 ShimmerFields
    - Forming/settled: visa requirement row; passport check row; "Show X advisories" toggle (only when advisories.length > 0)
    - When expanded: renders each advisory as a bullet `<li>`
    - Toggle `aria-label` = `"Show ${n} advisories"` (collapsed) / `"Hide advisories"` (expanded)
  - [x] 3.3 Wire `ComplianceFields` into the `TravelCard` render switch
  - [x] 3.4 Write Vitest tests in `__tests__/TravelCard.compliance.test.tsx`:
    - Shows toggle only when healthAdvisories.length > 0
    - Toggle expands/collapses advisories list
    - aria-label changes on toggle
    - Renders visa + passport rows in settled state

- [x] Task 4: Add BookingCard fields component (AC1, AC2, AC5)
  - [x] 4.1 Add `booking` to `CARD_ICONS` (use 📋)
  - [x] 4.2 Add `BookingFields` component:
    - When `deckState === 'browsing'`: single `ShimmerField` (placeholder — CTA not yet active)
    - When `deckState === 'committing'`: `<button>Book this trip</button>` with `aria-label="Book this trip"` and `data-testid="booking-cta"`; calls `onBook` prop
  - [x] 4.3 Wire `BookingFields` into the `TravelCard` render switch
  - [x] 4.4 Write Vitest tests in `__tests__/TravelCard.booking.test.tsx`:
    - Button not rendered when deckState === 'browsing'
    - Button rendered when deckState === 'committing'
    - Button click fires `onBook` prop

- [x] Task 5: Update HotelFields with highlights and compliance dot badge (AC1, AC3)
  - [x] 5.1 Update `HotelFields` in `TravelCard.tsx` to render `highlights` array in settled state: `<ul>` with max 3 `<li>` items
  - [x] 5.2 Add compliance dot badge in `HotelFields` header area when `complianceSeverity` is set:
    - 🔴 for 'block', 🟡 for 'warning', 🟢 for 'clear'
    - Wrapped in a `<button>` with `role="status"`, `aria-label="Compliance: ${severity}"`, calls `onComplianceBadgeTap?.(cardId)`
  - [x] 5.3 Add `onComplianceBadgeTap?: (cardId: string) => void` prop to `TravelCardProps` interface
  - [x] 5.4 Write Vitest tests in `__tests__/TravelCard.hotel.test.tsx`:
    - Highlights render as list items in settled state
    - Compliance badge renders with correct emoji and aria-label for each severity
    - Badge tap fires `onComplianceBadgeTap` with cardId

- [x] Task 6: Update ActivityFields with dayNumber and description (AC1)
  - [x] 6.1 Update `ActivityFields` in `TravelCard.tsx` to show `dayNumber` (e.g., "Day 3") in the header area when set
  - [x] 6.2 Show `description` in settled state (truncated to 2 lines via `line-clamp-2`)
  - [x] 6.3 Write Vitest tests in `__tests__/TravelCard.activity.test.tsx`: dayNumber renders; description renders in settled state only

- [x] Task 7: Update exports and run full test suite (AC6)
  - [x] 7.1 Update `src/components/cards/index.ts` to export new types: `BudgetCardData`, `ComplianceCardData`, `BookingCardData`
  - [x] 7.2 Run `npm test` — confirm all 552+ existing tests pass, new tests pass (590 passing)
  - [x] 7.3 TypeScript check: `npx tsc --noEmit` — zero new errors (only pre-existing errors remain)

### Review Follow-ups (AI)

- [x] [AI-Review][High] F1 — Fix duplicate Book button: guard `CardActions` "Book" from firing when `cardType === 'booking'` (BookingFields owns that CTA)
- [x] [AI-Review][Med] F2 — Move compliance badge into `TravelCard` header section (alongside icon + label) rather than inside `HotelFields` body

---

## Dev Notes

### Architecture Overview

This story is **purely additive** to the existing `TravelCard` component and its utilities. Do NOT refactor the state machine, shimmer, or CVA variant logic — they are already correct. Only add new card type branches.

**Files to MODIFY (existing):**
- `stravel/frontend/src/types/domain.ts` — extend `CardType` union
- `stravel/frontend/src/components/cards/cardUtils.ts` — add new interfaces
- `stravel/frontend/src/components/cards/TravelCard.tsx` — add new field components, extend switch

**Files to CREATE (new):**
- `stravel/frontend/src/components/cards/__tests__/TravelCard.budget.test.tsx`
- `stravel/frontend/src/components/cards/__tests__/TravelCard.compliance.test.tsx`
- `stravel/frontend/src/components/cards/__tests__/TravelCard.booking.test.tsx`
- `stravel/frontend/src/components/cards/__tests__/TravelCard.hotel.test.tsx`
- `stravel/frontend/src/components/cards/__tests__/TravelCard.activity.test.tsx`
- `stravel/frontend/src/components/cards/__tests__/cardUtils.test.ts`

### Existing TravelCard Architecture (DO NOT change)

The component in `TravelCard.tsx` follows this pattern:
1. `TravelCardProps` interface — add `onComplianceBadgeTap?: (cardId: string) => void` here
2. `CARD_ICONS` map — add new card type icons here
3. `cardVariants` CVA — **do not touch**
4. `ShimmerField` — **do not touch**; call it N times per card type in nascent state
5. Per-card field functions: `FlightFields`, `HotelFields`, `ActivityFields`, `VisaFields` — add `BudgetFields`, `ComplianceFields`, `BookingFields` following the same pattern
6. `TravelCard` main render: the `{cardType === 'xxx' && <XxxFields ... />}` block — add 3 new cases

### Existing CardData Interfaces (EXTEND, don't replace)

Current in `cardUtils.ts`:
```typescript
export interface FlightCardData { origin?; destination?; departDate?; returnDate?; airline?; price?; flightTimes? }
export interface HotelCardData { neighborhood?; starRange?; name?; nightlyRate? }         // add highlights, complianceSeverity
export interface ActivityCardData { category?; cityZone?; venue?; hours?; cost? }          // add dayNumber, description
export interface VisaCardData { destinationCountry?; nationality?; processingTime?; fee? }
export type CardData = FlightCardData | HotelCardData | ActivityCardData | VisaCardData;   // extend union
```

New interfaces to add:
```typescript
export interface BudgetCardData {
  total?: number;
  currency?: string;
  flights?: number;
  accommodation?: number;
  activities?: number;
  misc?: number;
}

export interface ComplianceCardData {
  visaRequirement?: string;
  passportCheck?: string;
  healthAdvisories?: string[];
  isBlock?: boolean;
}

export interface BookingCardData {
  // intentionally empty — presence triggers CTA; content driven by deckState
}
```

### CardType Extension

In `domain.ts`, extend the existing type:
```typescript
// Before:
export type CardType = 'flight' | 'hotel' | 'activities' | 'visa';
// After:
export type CardType = 'flight' | 'hotel' | 'activities' | 'visa' | 'budget' | 'compliance' | 'booking';
```

The `CardUpdateEvent.type` field uses `CardType` — this change is backward-compatible.

### BudgetFields Layout

```tsx
function BudgetFields({ data, isSettled }: { data: Partial<BudgetCardData>; isSettled: boolean }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between font-semibold border-b border-border pb-1">
        <span>Total</span>
        <span>{data.total != null ? `${data.currency ?? 'USD'} ${data.total.toLocaleString()}` : '—'}</span>
      </div>
      {isSettled && (
        <div className="grid grid-cols-2 gap-1 text-xs text-text-muted">
          <span>Flights</span><span className="text-right">{data.flights != null ? `$${data.flights}` : '—'}</span>
          <span>Accommodation</span><span className="text-right">{data.accommodation != null ? `$${data.accommodation}` : '—'}</span>
          <span>Activities</span><span className="text-right">{data.activities != null ? `$${data.activities}` : '—'}</span>
          <span>Misc</span><span className="text-right">{data.misc != null ? `$${data.misc}` : '—'}</span>
        </div>
      )}
    </div>
  );
}
```

### ComplianceFields Layout (with expand/collapse state)

```tsx
function ComplianceFields({ data, isSettled }: { data: Partial<ComplianceCardData>; isSettled: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const advisories = data.healthAdvisories ?? [];
  return (
    <div className="space-y-2 text-sm">
      <div>
        <span className="text-text-muted text-xs">Visa</span>
        <p>{data.visaRequirement ?? '—'}</p>
      </div>
      <div>
        <span className="text-text-muted text-xs">Passport</span>
        <p>{data.passportCheck ?? '—'}</p>
      </div>
      {isSettled && advisories.length > 0 && (
        <div>
          <button
            className="text-xs text-primary underline"
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? 'Hide advisories' : `Show ${advisories.length} advisories`}
          >
            {expanded ? 'Hide advisories' : `Show ${advisories.length} advisories`}
          </button>
          {expanded && (
            <ul className="mt-1 space-y-1 text-xs text-text-muted list-disc list-inside">
              {advisories.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

### BookingFields Layout

```tsx
function BookingFields({ deckState, onBook }: { deckState: 'browsing' | 'committing'; onBook?: () => void }) {
  if (deckState !== 'committing') {
    return <ShimmerField shimmerEnabled={false} />;
  }
  return (
    <button
      className="w-full py-3 rounded-lg bg-primary text-white font-semibold text-sm"
      onClick={onBook}
      aria-label="Book this trip"
      data-testid="booking-cta"
    >
      Book this trip
    </button>
  );
}
```

### HotelFields Compliance Dot Badge

The badge lives in the card header alongside the card type label. Pass `complianceSeverity` and `cardId` down to `HotelFields`:

```tsx
const COMPLIANCE_DOT: Record<string, string> = { block: '🔴', warning: '🟡', clear: '🟢' };

// In HotelFields, add badge next to settled content:
{data.complianceSeverity && (
  <button
    role="status"
    className="ml-auto text-base"
    aria-label={`Compliance: ${data.complianceSeverity}`}
    onClick={() => onComplianceBadgeTap?.(cardId)}
  >
    {COMPLIANCE_DOT[data.complianceSeverity]}
  </button>
)}
```

Pass `cardId` through from TravelCard's outer scope (it's already a prop as `cardId`).

### ActivityFields Updates

```tsx
// In ActivityFields, forming state: add Day number if present
{data.dayNumber != null && (
  <div className="text-xs text-text-muted">Day {data.dayNumber}</div>
)}

// In settled state: add description with line clamp
{isSettled && data.description && (
  <div className="col-span-2">
    <span className="text-text-muted text-xs">Description</span>
    <p className="line-clamp-2 text-xs">{data.description}</p>
  </div>
)}
```

### Shimmer Field Counts per Card Type

In the nascent branch of `TravelCard`, the existing code renders 3 `ShimmerField` components for all card types. Update to use the correct count per type:

```tsx
const SHIMMER_COUNT: Record<CardType, number> = {
  flight: 4, hotel: 3, activities: 3, visa: 3,
  budget: 4, compliance: 3, booking: 1,
};
```

Replace the hardcoded `<ShimmerField /><ShimmerField /><ShimmerField />` block with:
```tsx
{Array.from({ length: SHIMMER_COUNT[cardType] }).map((_, i) => (
  <ShimmerField key={i} shimmerEnabled={shimmerEnabled} />
))}
```

### Test Pattern (follow existing tests in __tests__ folder)

Study `TravelCard.assumedBadge.test.tsx` for the established test pattern:
- Import `TravelCard`, render with `formingProps` base, use `screen.getBy*` / `screen.queryBy*`
- The `formingProps` base is: `{ cardId: 'test', completenessScore: 0.5, isFinal: false, delta: {...}, deckState: 'browsing' }`
- For settled state tests: use `completenessScore: 0.9, isFinal: true`
- Vitest + `@testing-library/react` — no JSDOM special setup needed (vite.config.ts already has `environment: 'jsdom'`)

**Critical Vite resolve order:** `vite.config.ts` already has `extensions: ['.mjs', '.tsx', '.ts', '.jsx', '.js', '.json']` — `.tsx` resolves before `.js`. Do NOT change this.

### Anti-patterns to Avoid

1. **Do NOT** create separate component files for each card type — all field functions live inline in `TravelCard.tsx`, same as existing FlightFields/HotelFields/etc.
2. **Do NOT** add Redux or additional state management — ComplianceFields expand/collapse uses local `useState` only
3. **Do NOT** change the CVA card variant logic — the nascent/forming/settled/error state machine is correct and tested
4. **Do NOT** add `import { useState } from 'react'` — it is already imported at the top of `TravelCard.tsx`
5. **Do NOT** modify `cardDisplayState` — it is shared with tests and works correctly
6. **Do NOT** create a new `index.ts` re-export for `BookingCardData` or `ComplianceCardData` unless they are needed externally — check if `index.ts` needs updating
7. **Do NOT** change domain.ts `CardUpdateEvent.delta` type — it's already `Record<string, unknown>` which is fine

### References

- TravelCard component: `stravel/frontend/src/components/cards/TravelCard.tsx`
- cardUtils: `stravel/frontend/src/components/cards/cardUtils.ts`
- CardType + CardUpdateEvent: `stravel/frontend/src/types/domain.ts`
- Existing badge tests: `stravel/frontend/src/components/cards/__tests__/TravelCard.assumedBadge.test.tsx`
- UX-DR8 (card states): epics-v2.md line 107
- UX-DR23 (max 3 shimmer): epics-v2.md line 137
- AC source: epics-v2.md lines 933–963 (Story 3.5)
- Story 9-10 (compliance badges with scroll behavior) — does NOT need to be implemented now

---

## Senior Developer Review (AI)

**Review Date:** 2026-05-27
**Outcome:** Changes Requested
**Layers run:** Blind Hunter, Edge Case Hunter, Acceptance Auditor

### Action Items

- [x] [Review][Patch] F1 — Duplicate Book button: `BookingFields` + `CardActions` both fire `onBook` when booking card is `committing` + `settled` [TravelCard.tsx]
- [x] [Review][Patch] F2 — Compliance dot badge placed inside `HotelFields` body above grid, not in the card header element [TravelCard.tsx]
- [x] [Review][Defer] F3 — Stall timer resets on every `isFinal` heartbeat, preventing error state (3 sub-issues) [TravelCard.tsx] — deferred, pre-existing from story 7-3
- [x] [Review][Defer] F4 — `cardDisplayState` never settles final cards with score 0.25–0.74 (race-condition guard behavior) [cardUtils.ts] — deferred, pre-existing by design
- [x] [Review][Defer] F5 — `SessionStatus` rename breaks `"archived"` guard in `SessionList.tsx` [SessionList.tsx:28] — deferred, pre-existing from story 8-1
- [x] [Review][Defer] F6 — Backend tests + Alembic ENUM not updated for new `SessionStatus` values — deferred, pre-existing from story 8-1

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Extended `CardType` union in `domain.ts` to include `budget`, `compliance`, `booking`
- Added `BudgetCardData`, `ComplianceCardData`, `BookingCardData` interfaces to `cardUtils.ts`
- Extended `HotelCardData` with `highlights` and `complianceSeverity`; extended `ActivityCardData` with `dayNumber` and `description`
- Updated `CardData` union to include all 3 new types
- Added `CARD_ICONS` entries for 3 new card types; added `SHIMMER_COUNT` record replacing hardcoded 3 shimmers
- Added `BudgetFields`, `ComplianceFields`, `BookingFields` inline components in `TravelCard.tsx`
- Updated `HotelFields` with highlights list (max 3) and compliance dot badge; updated `ActivityFields` with dayNumber and description
- Added `onComplianceBadgeTap` prop to `TravelCardProps`
- Exported 3 new data types from `index.ts`
- 590 tests passing (38 new tests across 5 new test files); no new TypeScript errors

### File List

- stravel/frontend/src/types/domain.ts (modified)
- stravel/frontend/src/components/cards/cardUtils.ts (modified)
- stravel/frontend/src/components/cards/TravelCard.tsx (modified)
- stravel/frontend/src/components/cards/index.ts (modified)
- stravel/frontend/src/components/cards/__tests__/cardUtils.test.ts (modified)
- stravel/frontend/src/components/cards/__tests__/TravelCard.budget.test.tsx (created)
- stravel/frontend/src/components/cards/__tests__/TravelCard.compliance.test.tsx (created)
- stravel/frontend/src/components/cards/__tests__/TravelCard.booking.test.tsx (created)
- stravel/frontend/src/components/cards/__tests__/TravelCard.hotel.test.tsx (created)
- stravel/frontend/src/components/cards/__tests__/TravelCard.activity.test.tsx (created)

## Change Log

- 2026-05-27: Implemented story 9-5 — extended TravelCard from 4 to 7 card types with BudgetFields, ComplianceFields, BookingFields; added HotelFields highlights + compliance badge; added ActivityFields dayNumber + description; per-card-type shimmer counts via SHIMMER_COUNT record; 38 new Vitest tests
