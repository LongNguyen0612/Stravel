# Story 9.10: Compliance Inline Badges

Status: done

## Story

As a traveler reviewing my Vietnam proposal,
I want compliance status surfaced directly on relevant cards,
So that I never reach the booking step unaware of a visa requirement or health advisory.

## Acceptance Criteria

**AC1 — Dot badge on HotelCard and ActivitiesCard (DayCard)**
Given a HotelCard or ActivitiesCard (DayCard) has `complianceSeverity` in the SSE delta payload
When the card renders in `settled` state (or any state with the data present)
Then a dot badge is visible on the card: `🔴` (block — critical), `🟡` (warning — advisory), `🟢` (clear)

**AC2 — Accessibility: badge has role + aria-label**
Given the dot badge is rendered
When audited for accessibility
Then the badge has `role="status"` and `aria-label="Compliance: [block/warning/clear]"` — color alone does NOT convey status (WCAG 1.4.1)

**AC3 — Badge tap scrolls to ComplianceCard + pulse**
Given the dot badge is tapped
When tapped on HotelCard or ActivitiesCard
Then `onComplianceBadgeTap` fires, ConversationCanvas scrolls to the ComplianceCard (smooth scroll)
And the ComplianceCard briefly highlights with a 150ms ring pulse animation
And `prefers-reduced-motion` media query skips the pulse (no animation)

**AC4 — ComplianceCard expanded content**
Given the ComplianceCard is in `settled` state
When rendered
Then it shows:
- visa requirement text (or `—` if absent)
- passport expiry check result (or `—` if absent)
- health advisory text: "No current advisories" when `healthAdvisories` is empty or absent (in settled state)
- expandable advisories list when `healthAdvisories` has items (existing behavior ✓)
- "Check visa requirements →" link (renders only when `visaLink` is present in delta)

**AC5 — CTA disabled when compliance block present**
Given a `🔴` critical compliance badge is present on any card (i.e., `hasComplianceBlock` is true)
When the CardDeck enters `committing` state and renders the booking CTA
Then the booking CTA button has `aria-disabled="true"` and `title="Resolve compliance issues before booking"`
And the CardDeck still enters `committing` state visually — only the CTA is semantically disabled

## Tasks / Subtasks

- [x] Task 1: Extend data types (AC: 1, 4)
  - [x] 1.1: In `cardUtils.ts`, add `complianceSeverity?: 'block' | 'warning' | 'clear'` to `ActivityCardData`
  - [x] 1.2: In `cardUtils.ts`, add `visaLink?: string` to `ComplianceCardData`

- [x] Task 2: TravelCard — activities badge + compliance fields + booking gate (AC: 1, 2, 4, 5)
  - [x] 2.1: Add `pulse?: boolean` prop to `TravelCardProps` interface
  - [x] 2.2: Add `data-card-type={cardType}` attribute to the root `<div>` in `TravelCard` (enables scroll-to via `querySelector`)
  - [x] 2.3: Add `compliance-highlight` CSS class to root div when `pulse && isSettled` (plays the ring animation)
  - [x] 2.4: In the CardHeader section, add a dot badge for activities card (parallel to existing hotel badge)
  - [x] 2.5: In `ComplianceFields`, add "No current advisories" text when `isSettled && advisories.length === 0`
  - [x] 2.6: In `ComplianceFields`, add "Check visa requirements →" external link when `data.visaLink` is present
  - [x] 2.7: In `BookingFields`, add `aria-disabled` + `title` + `opacity-50 cursor-not-allowed` when `onBook` is `undefined`

- [x] Task 3: Add pulse animation CSS (AC: 3)
  - [x] 3.1: In `global.css`, added `@keyframes compliance-pulse` + `.compliance-highlight` class + `prefers-reduced-motion` suppression

- [x] Task 4: CardDeck — wire highlight prop (AC: 3)
  - [x] 4.1: Add `highlightComplianceCard?: boolean` to `CardDeckProps` interface
  - [x] 4.2: Destructure `highlightComplianceCard` in `CardDeck` function params
  - [x] 4.3: Pass `pulse={card.type === 'compliance' && highlightComplianceCard}` to `TravelCard`

- [x] Task 5: App.tsx — wire onComplianceBadgeTap + scroll + pulse (AC: 3)
  - [x] 5.1: Added `compliancePulseActive` state near `cardEditMode`
  - [x] 5.2: Added `handleComplianceBadgeTap` function with scrollIntoView + 200ms setTimeout reset
  - [x] 5.3: Pass `onComplianceBadgeTap={handleComplianceBadgeTap}` and `highlightComplianceCard={compliancePulseActive}` to `CardDeck`

- [x] Task 6: Tests (AC: 1, 2, 3, 4, 5)
  - [x] 6.1: New file `TravelCard.activitiesCompliance.test.tsx` — 12 tests: badge block/warning/clear, role="status", aria-label, tap callback, pulse class, data-card-type
  - [x] 6.2: Added 7 tests to `TravelCard.compliance.test.tsx` — "No current advisories", visa link present/absent
  - [x] 6.3: New file `TravelCard.bookingBlocked.test.tsx` — 7 tests: aria-disabled, tooltip, dimming, no-crash, data-card-type
  - [x] 6.4: New file `DemoPage.complianceBadgeTap.test.tsx` — 4 tests: onComplianceBadgeTap wired, initial false, tap sets true, 200ms reset

### Review Findings (AI)

Review date: 2026-05-28 | Reviewer: claude-sonnet-4-6

#### Decision-Needed

- [x] [Review][Decision→Defer] AC5 — `aria-disabled` "compliance" title shown during authorship-pending — deferred: authorship panel visually covers the booking card while `authorshipPending=true`, so the misleading title is never visible in practice. Not worth threading `hasComplianceBlock` into `BookingFields` for an invisible edge case.

#### Patches

- [x] [Review][Patch] `role="status"` on `<button>` violates ARIA semantics (AC2) [`TravelCard.tsx` hotel + activities badges] — moved `role="status"` + `aria-label` to inner `<span>`; button retains its native interactive role. `getByRole('status')` still finds the span.
- [x] [Review][Patch] `visaLink` renders without `isSettled` guard [`TravelCard.tsx` ComplianceFields] — added `isSettled &&` gate: `{isSettled && data.visaLink && ...}`
- [x] [Review][Patch] Rapid badge taps stack `setTimeout` timers [`App.tsx:handleComplianceBadgeTap`] — added `compliancePulseTimerRef`; `clearTimeout` called before each new `setTimeout`.
- [x] [Review][Patch] Pulse state fires when no compliance card in DOM [`App.tsx:handleComplianceBadgeTap`] — added `if (!el) return;` guard before `setCompliancePulseActive(true)`.
- [x] [Review][Patch] `COMPLIANCE_DOT[sev!]` returns `undefined` for unknown severity [`TravelCard.tsx` hotel + activities badges] — added `?? '⚪'` fallback on both badge lookups.

#### Deferred (pre-existing)

- [x] [Review][Defer] Duplicate `AssumedBadge` on both `departDate`/`returnDate` when `travel_dates` assumed [`TravelCard.tsx`] — deferred, pre-existing
- [x] [Review][Defer] `ShimmerField shimmerEnabled={false}` renders decorative blank bar with no aria label [`TravelCard.tsx`] — deferred, pre-existing
- [x] [Review][Defer] `cardDisplayState` `forming` state not gated on `isFinal` — final card 0.25–0.74 stuck in forming [`TravelCard.tsx`] — deferred, pre-existing
- [x] [Review][Defer] Tests use `fireEvent` not `userEvent` throughout test suite — masks real interaction semantics — deferred, pre-existing pattern
- [x] [Review][Defer] ComplianceFields advisories toggle missing `aria-expanded` attribute [`TravelCard.tsx`] — deferred, pre-existing
- [x] [Review][Defer] `handleAuthorshipSave` fire-and-forget — rejection silently swallowed, trip name lost without feedback [`CardDeck.tsx`] — deferred, pre-existing (also in 9-8 deferred-work.md D2)
- [x] [Review][Defer] `completenessScore > 1` produces ">100% complete" in aria-label [`TravelCard.tsx:cardDisplayState`] — deferred, pre-existing
- [x] [Review][Defer] `expanded` state persists across settled→forming→settled transitions — advisories auto-open on re-settle [`TravelCard.tsx:ComplianceFields`] — deferred, pre-existing

## Dev Notes

### What Is Already Implemented (DO NOT REWRITE)

These features were built in prior stories — do NOT touch them:

- **Hotel badge** (`TravelCard.tsx` ~line 403): Hotel card already shows `complianceSeverity` dot badge via `COMPLIANCE_DOT` constant. Your task adds the equivalent for `activities` card type only.
- **`COMPLIANCE_DOT` constant** (`TravelCard.tsx` line 64): `{ block: '🔴', warning: '🟡', clear: '🟢' }` — use as-is.
- **`onComplianceBadgeTap` prop** (`TravelCard.tsx` line 32, `CardDeck.tsx` line 13): Prop signatures already exist and flow through CardDeck → TravelCard. Task 4 adds `highlightComplianceCard` and Task 5 wires the actual handler.
- **`hasComplianceBlock` in CardDeck** (`CardDeck.tsx` line 72): `bookingCTAActive = deckState === 'committing' && !authorshipPending && !hasComplianceBlock` — already computes correct value. Task 2.7 only adds the `aria-disabled` + `title` attributes to the rendered button.
- **`hasComplianceBlock` in App.tsx** (`App.tsx` line 1101): `sseState.complianceFlags.some(f => f.severity === 'block')` — already wired, no change needed.
- **`ComplianceFields` basic content** (`TravelCard.tsx` lines 293-324): visa, passport, and toggle advisories already work. Task 2.5-2.6 only adds the "No current advisories" fallback and visa link.
- **`cardDeckRef`** (`App.tsx` line 372): `useRef<HTMLDivElement>(null)` pointing to `CardDeckZone` — use for scroll-to via `querySelector('[data-card-type="compliance"]')`.

### Data Flow: complianceSeverity on Activities Card

Activities card delta (`delta as Partial<ActivityCardData>`) will include `complianceSeverity` when the backend flags the activity location. The type is `'block' | 'warning' | 'clear'` — same as HotelCardData. After Task 1.1 adds the field to `ActivityCardData`, TypeScript will accept the cast.

### Pulse Implementation Pattern

The pulse is a CSS ring animation controlled by a React boolean state in App.tsx:

```
App.tsx: compliancePulseActive state
    ↓ passed as highlightComplianceCard={compliancePulseActive}
CardDeck.tsx: pulse={card.type === 'compliance' && highlightComplianceCard}
    ↓ passed as pulse={...}
TravelCard.tsx: className={cn(..., pulse && isSettled && 'compliance-highlight')}
```

The `compliance-highlight` CSS class is defined in `global.css` (Task 3). The `prefers-reduced-motion` media query is already in `global.css` — add the suppression in the same file.

Timing: `setTimeout(() => setCompliancePulseActive(false), 200)` gives 50ms buffer after the 150ms animation completes.

### Scroll-to-Compliance Approach

```tsx
const el = cardDeckRef.current?.querySelector<HTMLElement>('[data-card-type="compliance"]');
el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
```

`cardDeckRef` is the `CardDeckZone` div (App.tsx line 372). After Task 2.2 adds `data-card-type={cardType}` to TravelCard's root div, the compliance card will be queryable. The `block: 'nearest'` option avoids unnecessary scroll if the card is already visible.

### BookingFields aria-disabled Pattern

When `onBook` is `undefined` (compliance blocked), the existing button renders with no click handler. Task 2.7 adds:
```tsx
aria-disabled={!onBook ? true : undefined}
title={onBook ? undefined : "Resolve compliance issues before booking"}
```
Use `aria-disabled={true}` (not `disabled`) to keep the button focusable so assistive technology can read the tooltip. The visual dimming uses `opacity-50 cursor-not-allowed` conditional class. This was deferred from story 9-6 (deferred-work.md W1).

### "No current advisories" Rendering Rule

Show "No current advisories" only when:
- `isSettled` is true (same gate as existing advisories toggle)
- `(!data.healthAdvisories || data.healthAdvisories.length === 0)`

When there ARE advisories, show the toggle (existing behavior). When there are none, show the static "No current advisories" text. Both cases are mutually exclusive.

### File Locations

- `cardUtils.ts`: `stravel/frontend/src/components/cards/cardUtils.ts`
- `TravelCard.tsx`: `stravel/frontend/src/components/cards/TravelCard.tsx`
- `CardDeck.tsx`: `stravel/frontend/src/components/cards/CardDeck.tsx`
- `global.css`: `stravel/frontend/src/styles/global.css`
- `App.tsx`: `stravel/frontend/src/App.tsx`
- Test files: `stravel/frontend/src/components/cards/__tests__/` and `stravel/frontend/src/__tests__/`

### Existing Test Files to Extend (DO NOT RECREATE)

- `TravelCard.hotel.test.tsx`: hotel compliance badge tests already exist (lines 53–80). Use as reference for activities badge test pattern.
- `TravelCard.compliance.test.tsx`: add tests 6.2 here (new `describe` block or new `it` cases within existing describe).

### Test Pattern Reference

```tsx
// Standard TravelCard settled props pattern
const settledProps = {
  cardId: 'activities-test',
  cardType: 'activities' as const,
  completenessScore: 0.9,
  isFinal: true,
  deckState: 'browsing' as const,
};
render(<TravelCard {...settledProps} delta={{ complianceSeverity: 'block' }} />);
const badge = screen.getByRole('status');
expect(badge).toHaveAttribute('aria-label', 'Compliance: block');
```

For `BookingFields` — it only renders when `deckState === 'committing'`:
```tsx
const committingBookingProps = {
  cardId: 'booking-test',
  cardType: 'booking' as const,
  completenessScore: 0.9,
  isFinal: true,
  deckState: 'committing' as const,
};
// With onBook undefined (compliance blocked):
render(<TravelCard {...committingBookingProps} delta={{}} />);
// CTA renders but aria-disabled
```

### Previous Story Learnings (9-9)

- The `activities` card type uses `dietaryCardVisible` / `handleDietarySelect` (not `activitiesCardVisible`) — the slot key mismatch was a bug in 9-9 and was patched. Keep this in mind if you ever need to check slot mappings.
- Use `void api.sessions.run(sessionId)` (fire-and-forget) for synchronous handlers when calling the backend run endpoint.
- The `wasCardEditRestreamRef` pattern (ref-based boolean flag for one-shot effects) is now established in App.tsx — follow it if you need similar one-shot state.
- Test mocks for `useStreamContext` should include `moodTransition` in the return object (it was added in 9-9 and is now part of the interface).

### Source Hints

- FR-C3 implementation: `_bmad-output/planning-artifacts/epics-v2.md` line 44, 959, 1109
- COMPLIANCE_DOT constant: `stravel/frontend/src/components/cards/TravelCard.tsx` line 64
- Hotel badge JSX: `stravel/frontend/src/components/cards/TravelCard.tsx` lines 403–412
- ComplianceFields: `stravel/frontend/src/components/cards/TravelCard.tsx` lines 293–324
- BookingFields: `stravel/frontend/src/components/cards/TravelCard.tsx` lines 326–344
- CardDeck bookingCTAActive: `stravel/frontend/src/components/cards/CardDeck.tsx` line 72
- hasComplianceBlock wiring: `stravel/frontend/src/App.tsx` line 1101
- cardDeckRef: `stravel/frontend/src/App.tsx` line 372
- cardDeckRef used in scroll: `stravel/frontend/src/App.tsx` line 1095 (CardDeckZone ref)
- global.css keyframes: `stravel/frontend/src/styles/global.css` lines 75–98
- Deferred W1 (aria-disabled story 9-6): `_bmad-output/implementation-artifacts/deferred-work.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

(none)

### Completion Notes List

- Task 1 (Types): Added `complianceSeverity?: 'block' | 'warning' | 'clear'` to `ActivityCardData` and `visaLink?: string` to `ComplianceCardData` in `cardUtils.ts`.
- Task 2 (TravelCard): Added `pulse` prop + `data-card-type` attribute; activities dot badge mirrors hotel badge pattern; "No current advisories" text when settled and no advisories; "Check visa requirements →" external link when `visaLink` present; booking CTA `aria-disabled` + tooltip + opacity class when `onBook` undefined (resolves deferred W1 from story 9-6).
- Task 3 (CSS): `@keyframes compliance-pulse` ring animation (150ms) + `.compliance-highlight` class + `prefers-reduced-motion` suppression added to `global.css`.
- Task 4 (CardDeck): `highlightComplianceCard` prop added; routes `pulse={card.type === 'compliance' && highlightComplianceCard}` to TravelCard.
- Task 5 (App.tsx): `compliancePulseActive` state + `handleComplianceBadgeTap` (scroll via `cardDeckRef.current.querySelector('[data-card-type="compliance"]')` + 200ms pulse timeout); wired to CardDeck.
- Task 6 (Tests): 30 new tests across 4 files — all pass. 695 total tests, 0 regressions.

### File List

- `stravel/frontend/src/components/cards/cardUtils.ts` — added `complianceSeverity` to `ActivityCardData`, `visaLink` to `ComplianceCardData`
- `stravel/frontend/src/components/cards/TravelCard.tsx` — pulse prop, data-card-type, activities badge, ComplianceFields enhancements, BookingFields aria-disabled
- `stravel/frontend/src/components/cards/CardDeck.tsx` — highlightComplianceCard prop + pulse passthrough
- `stravel/frontend/src/styles/global.css` — compliance-pulse keyframes + .compliance-highlight class
- `stravel/frontend/src/App.tsx` — compliancePulseActive state, handleComplianceBadgeTap, CardDeck prop wiring
- `stravel/frontend/src/components/cards/__tests__/TravelCard.activitiesCompliance.test.tsx` — NEW (12 tests)
- `stravel/frontend/src/components/cards/__tests__/TravelCard.compliance.test.tsx` — extended (7 new tests)
- `stravel/frontend/src/components/cards/__tests__/TravelCard.bookingBlocked.test.tsx` — NEW (7 tests)
- `stravel/frontend/src/__tests__/DemoPage.complianceBadgeTap.test.tsx` — NEW (4 tests)

## Change Log

- Story created — 2026-05-28
- Implementation complete — 2026-05-28: all 6 tasks done, 30 new tests, 695 total passing
