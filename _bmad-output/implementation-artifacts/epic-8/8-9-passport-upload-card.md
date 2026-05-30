# Story 8.9: Passport Upload Card

Status: done

## Story

As a traveler completing profile setup,
I want to photograph my passport and have the expiry date extracted automatically,
So that I don't have to type a date in a specific format.

## Acceptance Criteria

**AC1 — Card renders with upload affordances**

**Given** the bot asks for passport expiry (FR-B6)
**When** the passport upload card renders
**Then** a card with a camera icon, drag-and-drop zone, and "Take photo" / "Upload photo" buttons is shown inline in the chat thread
**And** a "Skip" link is visible below the upload zone

**AC2 — File selection triggers OCR and branches on result**

**Given** the user selects or drops a file
**When** the file is received
**Then** the card shows a loading shimmer and calls `POST /api/v1/passport/extract-expiry` with the file as multipart form data (`file` field)
**And** if OCR succeeds (`fallback_required: false`, `confidence >= 0.85`, `expiry_date` not null): the extracted date is shown in `DD/MM/YYYY` format with "Is this correct?" and Yes/No chips
**And** if `fallback_required: true` (or `confidence < 0.85` or `expiry_date` is null): a date text input is shown with "I couldn't read the date clearly — please enter it manually" and focus moves to the input immediately

**AC3 — Confirm extracted date (Yes chip)**

**Given** the card is in confirm state with an extracted date
**When** the user taps "Yes"
**Then** `onSelect({ slotKey, value: '<YYYY-MM-DD>' })` is called with the ISO-format extracted date
**And** the parent hides the card and updates the `passport_expiry` slot

**AC4 — Reject extracted date (No chip → manual fallback)**

**Given** the card is in confirm state
**When** the user taps "No"
**Then** the card transitions to manual state: a text input replaces the Yes/No chips, pre-filled with the extracted date in `YYYY-MM-DD` format for correction
**And** focus moves to the text input immediately

**AC5 — Skip affordance**

**Given** a "Skip" link is present in all states except `uploading`
**When** the user taps Skip
**Then** `onSkip({ slotKey })` is called
**And** the parent sets `passport_expiry` slot to `'skipped'` and shows a note that compliance checks may be incomplete

**AC6 — Keyboard accessibility + WCAG**

**Given** the card is navigated by keyboard
**When** Tab sequence reaches the upload zone
**Then** the zone has `role="button"`, `aria-label="Upload passport photo"`, `tabIndex={0}`, and activates the file picker via Enter or Space
**And** `axe-core` reports zero WCAG 2.1 AA violations in idle, confirm, and manual states

**AC7 — DemoPage integration (after dietary)**

**Given** the user completes the dietary card (any selection including empty)
**When** `handleDietarySelect` fires
**Then** `passportCardVisible` becomes `true` and the bot appends: `"Almost there! Could you snap or upload a photo of your passport? I'll read the expiry date automatically."`

**Given** the user confirms a date (Yes or manual submit) on the passport card
**When** `handlePassportSelect` fires
**Then** the passport card hides and the `passport_expiry` slot is updated
**And** a user bubble shows `"Passport expiry: DD/MM/YYYY"` (converted from YYYY-MM-DD) and the bot replies: `"Got it — I'll check your passport is valid for the trip."`

**Given** the user taps Skip on the passport card
**When** `handlePassportSkip` fires
**Then** the passport card hides and `passport_expiry` is set to `'skipped'`
**And** the bot sends: `"No problem — just note that compliance checks may be incomplete without your passport details."`

---

## Tasks / Subtasks

- [x] Task 1: Create `PassportUploadCard.tsx` component
  - [x] 1a: Define `PassportUploadCardProps` interface: `slotKey: SlotKey`, `onSelect: (update: { slotKey: SlotKey; value: string }) => void`, `onSkip: (event: { slotKey: SlotKey }) => void`, `className?: string`
  - [x] 1b: Define internal state type `type UploadState = 'idle' | 'uploading' | 'confirm' | 'manual'`; component state: `uploadState`, `extractedDate: string | null`, `manualInput: string`, `uploadError: string | null`
  - [x] 1c: Implement two hidden `<input type="file">` with refs: `takePhotoRef` (with `capture="environment"`, `accept="image/*"`) and `uploadPhotoRef` (no capture, `accept="image/jpeg,image/png,image/webp"`); both share `handleInputChange` handler
  - [x] 1d: Implement drag-and-drop on the upload zone div: `onDrop` (extract `e.dataTransfer.files[0]`, call `handleFileUpload`), `onDragOver` (call `e.preventDefault()`)
  - [x] 1e: Implement `handleFileUpload(file: File)`: set state to `'uploading'`; call OCR fetch with FormData; on response branch: `!data.fallback_required && data.confidence >= 0.85 && data.expiry_date !== null` → state `'confirm'`, else → state `'manual'`; on fetch error → state `'manual'` with `uploadError` message
  - [x] 1f: OCR fetch: `const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/v1/passport/extract-expiry', { method: 'POST', body: fd }); const data = await res.json()` — no `Content-Type` header (browser sets multipart with boundary)
  - [x] 1g: Confirm state JSX: date in `DD/MM/YYYY` via `formatDateForDisplay`, "Is this correct?" text, two buttons "Yes" and "No"; Yes calls `onSelect({ slotKey, value: extractedDate! })`; No sets `uploadState = 'manual'`, `manualInput = extractedDate ?? ''`
  - [x] 1h: Manual state JSX: optional error message, text input (`ref={manualInputRef}`, `type="text"`, `placeholder="YYYY-MM-DD"`, value=`manualInput`, `onChange`), submit button "Confirm date"; submit calls `onSelect({ slotKey, value: manualInput })`
  - [x] 1i: `useEffect` watching `uploadState`: when `uploadState === 'manual'`, call `manualInputRef.current?.focus()`
  - [x] 1j: Upload zone: `<div role="button" tabIndex={0} aria-label="Upload passport photo" onDrop={handleDrop} onDragOver={handleDragOver} onClick={() => uploadPhotoRef.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uploadPhotoRef.current?.click(); } }}>` — contains camera icon + prompt text
  - [x] 1k: "Take photo" button: calls `takePhotoRef.current?.click()`; "Upload photo" button: calls `uploadPhotoRef.current?.click()`
  - [x] 1l: Skip link: always visible except when `uploadState === 'uploading'`; `<button type="button" onClick={() => onSkip({ slotKey })} className="text-sm text-text-muted underline self-center ...">Skip</button>`
  - [x] 1m: Implement `formatDateForDisplay(iso: string): string`: `const [y, m, d] = iso.split('-'); return \`${d}/${m}/${y}\``

- [x] Task 2: Create `PassportUploadCard.js` counterpart (CRITICAL — Vitest resolves .js over .tsx)
  - [x] 2a: Re-implement using `_jsx`/`_jsxs` from `"react/jsx-runtime"` — NO JSX syntax
  - [x] 2b: All state, logic, and props identical to the .tsx version; use plain JS (no TypeScript annotations)
  - [x] 2c: Follow `BudgetSliderCard.js` as the exact structural template (same import style, same export pattern)

- [x] Task 3: Export from card index
  - [x] 3a: Add to `src/components/cards/index.ts`: `export { PassportUploadCard } from './PassportUploadCard'; export type { PassportUploadCardProps } from './PassportUploadCard';`
  - [x] 3b: Add equivalent export to `src/components/cards/index.js`

- [x] Task 4: Unit tests — `PassportUploadCard.test.tsx`
  - [x] 4a: AC1 — card renders upload zone with `role="button"`, "Take photo" button, "Upload photo" button, and "Skip" link
  - [x] 4b: AC2a — mock fetch success (confidence 0.9, fallback_required false, expiry_date '2027-06-30') → confirm state renders date '30/06/2027' + "Is this correct?" + Yes/No chips
  - [x] 4c: AC2c — mock fetch returning `{ fallback_required: true, confidence: 0.5, expiry_date: null }` → manual state: text input visible, error/fallback message visible
  - [x] 4d: AC3 — Yes chip calls `onSelect` with `{ slotKey: 'passport_expiry', value: '2027-06-30' }`
  - [x] 4e: AC4 — No chip transitions to manual state; text input pre-filled with `'2027-06-30'`
  - [x] 4f: AC5 — Skip button calls `onSkip` with `{ slotKey: 'passport_expiry' }`
  - [x] 4g: AC6 — upload zone `role="button"` and `aria-label="Upload passport photo"` present
  - [x] 4h: Network error — fetch rejects → manual state with error message, no crash

  **Note on mocking fetch:** Use `vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({...}) } as Response)`. After each test call `vi.restoreAllMocks()`.

  **Note on triggering file input in tests:** Use `fireEvent.change(input, { target: { files: [new File(['data'], 'p.jpg', { type: 'image/jpeg' })] } })` on the hidden input element found by `document.querySelector('input[type="file"]')` or by test id.

- [x] Task 5: Axe tests — `PassportUploadCard.axe.test.tsx`
  - [x] 5a: Idle state → zero WCAG 2.1 AA violations
  - [x] 5b: Confirm state (rendered directly with `uploadState='confirm'` via internal state manipulation or by triggering upload flow) → zero violations
  - [x] 5c: Manual state (rendered with text input visible) → zero violations

  **Pattern:** Follow `MultiSelectCard.axe.test.tsx` exactly.

- [x] Task 6: Integrate into `App.tsx` and `App.js`
  - [x] 6a: Import `PassportUploadCard` in `App.tsx`; import in `App.js` (using `_jsx` runtime pattern matches existing imports)
  - [x] 6b: Add `passportCardVisible` state (boolean, false) alongside `dietaryCardVisible`
  - [x] 6c: Modify `handleDietarySelect` to additionally `setPassportCardVisible(true)` and append one more message: `{ role: 'assistant', content: "Almost there! Could you snap or upload a photo of your passport? I'll read the expiry date automatically." }` — this message appends AFTER the existing dietary confirmation messages
  - [x] 6d: Implement `handlePassportSelect({ slotKey, value }: { slotKey: SlotKey; value: string })`: `dispatchStream SLOT_UPDATE`, `setPassportCardVisible(false)`, append `{ role: 'user', content: 'Passport expiry: ' + formatDateForDisplay(value) }` and `{ role: 'assistant', content: "Got it — I'll check your passport is valid for the trip." }`
  - [x] 6e: Implement `handlePassportSkip({ slotKey }: { slotKey: SlotKey })`: `dispatchStream SLOT_UPDATE` with value `'skipped'`, `setPassportCardVisible(false)`, append `{ role: 'assistant', content: "No problem — just note that compliance checks may be incomplete without your passport details." }`
  - [x] 6f: Add `formatDateForDisplay` helper in `App.tsx` at module level (identical to the one in the component); or import it from the component — use whichever is cleaner; keep both files in sync
  - [x] 6g: Render passport card after dietary card in JSX: `{passportCardVisible && <PassportUploadCard slotKey="passport_expiry" onSelect={handlePassportSelect} onSkip={handlePassportSkip} className="mx-4 mb-2" />}`
  - [x] 6h: Sync ALL changes to `App.js` (same logic, `_jsx` runtime)

- [x] Task 7: Integration tests — `DemoPage.passportCard.test.tsx`
  - [x] 7a: AC7a — after dietary card Done (with no selection), passport card group/label appears and bot message shows
  - [x] 7b: AC7b — mock fetch OCR success; trigger file upload; tap Yes → passport card hidden, user bubble + bot reply show
  - [x] 7c: AC7c — tap Skip on passport card → card hidden, `passport_expiry` dispatched as 'skipped', bot compliance note shows

### Review Findings (AI)

**Date:** 2026-05-26 | **Outcome:** Changes Requested | **Layers:** Blind Hunter + Edge Case Hunter + Acceptance Auditor

#### Action Items

- [x] [Review][Patch] **Check `res.ok` before calling `res.json()`** — `PassportUploadCard.tsx:handleFileUpload` — 4xx/5xx HTML error body causes JSON parse error or silent data corruption; add `if (!res.ok) throw new Error(...)` guard after `await fetch(...)`. [Severity: High] ✅ Fixed
- [x] [Review][Patch] **Guard against concurrent uploads** — `PassportUploadCard.tsx:handleInputChange, handleDrop` — both handlers can fire while `uploadState === 'uploading'`, starting a second race-condition fetch; add early return if `uploadState === 'uploading'`. [Severity: High] ✅ Fixed
- [x] [Review][Patch] **Guard `formatDateForDisplay` against null/malformed input** — `PassportUploadCard.tsx:formatDateForDisplay`, `App.tsx:formatDateForDisplay` — called with OCR-returned expiry_date and user-typed manualInput; no guard against null, empty string, or non-ISO format causes `undefined/undefined/undefined` render or TypeError. [Severity: Med] ✅ Fixed
- [x] [Review][Patch] **Validate manual date input format before submit** — `PassportUploadCard.tsx:handleManualSubmit` — arbitrary free-text (e.g. "abc", "99-99-9999") is passed to `onSelect` and propagated into slot state; add YYYY-MM-DD regex validation and surface an inline error if invalid. [Severity: Med] ✅ Fixed
- [x] [Review][Patch] **Add `aria-live` region for OCR state transition announcements** — `PassportUploadCard.tsx` — screen readers are not notified when state changes from `uploading` → `confirm` or `manual`, or when `uploadError` is set; add `role="status"` or `aria-live="polite"` region updated on transition. [Severity: Med] ✅ Fixed
- [x] [Review][Patch] **Add AbortController/timeout to OCR fetch** — `PassportUploadCard.tsx:handleFileUpload` — if network stalls (not rejects), the component stays in `uploading` state indefinitely with no escape; add an AbortController with a reasonable timeout (e.g. 30s). [Severity: Low] ✅ Fixed
- [x] [Review][Patch] **Debounce `handleYes` to prevent double-fire** — `PassportUploadCard.tsx:handleYes` — rapid double-click calls `onSelect` twice with the same value, triggering two `SLOT_UPDATE` dispatches; add a `useRef` in-flight guard or disable the button after first click. [Severity: Low] ✅ Fixed
- [x] [Review][Defer] **`formatDateForDisplay` duplicated in App.tsx and PassportUploadCard.tsx** — deferred, pre-existing pattern
- [x] [Review][Defer] **No client-side file size/type validation** — deferred, server-side concern
- [x] [Review][Defer] **No "start over" escape from confirm state** — deferred, UX enhancement

#### Review Follow-ups (AI)

- [x] [AI-Review] Fix `res.ok` guard in `handleFileUpload` [High]
- [x] [AI-Review] Fix concurrent upload race — guard in `handleInputChange`/`handleDrop` [High]
- [x] [AI-Review] Guard `formatDateForDisplay` against null/malformed input [Med]
- [x] [AI-Review] Validate YYYY-MM-DD format in `handleManualSubmit` [Med]
- [x] [AI-Review] Add `aria-live` for OCR state transition announcements [Med]
- [x] [AI-Review] Add AbortController/timeout to OCR fetch [Low]
- [x] [AI-Review] Debounce `handleYes` [Low]

---

## Dev Notes

### Architecture and Patterns

**`.js` counterpart requirement (critical):**
Every `.tsx` card component must have a matching `.js` using `_jsx`/`_jsxs` from `"react/jsx-runtime"` — NOT JSX syntax. Vitest resolves `.js` over `.tsx`; the `.js` file is what tests actually import. Follow `BudgetSliderCard.js` exactly for structure.

**OCR endpoint — use raw `fetch` + `FormData`, NOT `apiClient`:**
`apiClient.ts` hardcodes `Content-Type: application/json` and uses `JSON.stringify`. The OCR endpoint needs multipart. Do NOT set `Content-Type` manually — the browser sets `multipart/form-data; boundary=...` automatically when the body is a `FormData` instance:
```typescript
interface PassportOCRResult {
  expiry_date: string | null;
  confidence: number;
  fallback_required: boolean;
}

const fd = new FormData();
fd.append('file', file);
const res = await fetch('/api/v1/passport/extract-expiry', { method: 'POST', body: fd });
const data: PassportOCRResult = await res.json();
```
The endpoint does NOT require auth (no `Authorization` header needed — same pattern as `demo.py`).

**Confidence threshold:** Use `0.85` (same as backend `CONFIDENCE_THRESHOLD`). Show confirm state only when all three conditions hold: `!data.fallback_required && data.confidence >= 0.85 && data.expiry_date !== null`.

**Date format conversion:**
- OCR returns / slot stores: `YYYY-MM-DD` (ISO)
- User-facing display: `DD/MM/YYYY`
```typescript
function formatDateForDisplay(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}
```

**Two separate hidden file inputs (not one shared):**
```typescript
const takePhotoRef = useRef<HTMLInputElement>(null);
const uploadPhotoRef = useRef<HTMLInputElement>(null);

<input ref={takePhotoRef} type="file" accept="image/*" capture="environment" hidden onChange={handleInputChange} />
<input ref={uploadPhotoRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleInputChange} />
```
`handleInputChange`: `const file = e.target.files?.[0]; if (file) handleFileUpload(file);`

**Drag-and-drop:** `onDragOver` must call `e.preventDefault()` (otherwise `onDrop` doesn't fire). Extract `e.dataTransfer.files[0]`.

**Manual input focus:** Use `useEffect` + ref:
```typescript
const manualInputRef = useRef<HTMLInputElement>(null);
useEffect(() => {
  if (uploadState === 'manual') manualInputRef.current?.focus();
}, [uploadState]);
```

**`slotState` type for `passport_expiry`:** Already `string | string[]` from Story 8-7 widening. `'skipped'` is a valid `string`. No type changes needed in `streamReducer.ts` or `domain.ts`.

**`SlotKey` type already includes `'passport_expiry'`** (see `domain.ts` line 36).

### Integration test navigation helpers

Tests use the established pattern — copy the full helper chain into the new test file (do not import across test files):

```typescript
async function navigateToPassportCard() {
  // 1. send first message
  await sendMessage('Need a holiday');
  // 2. select mood
  await selectMoodChip(/Adventure/i);
  // 3. select destination
  await selectDestinationCard(/Hội An/i);
  // 4. pick dates (hardcoded indices from existing test — pre-existing pattern)
  const allDateButtons = screen.getAllByRole('gridcell').filter(
    el => el.tagName === 'BUTTON' && el.getAttribute('aria-label')
  );
  await act(async () => { fireEvent.click(allDateButtons[5]); });
  await act(async () => { fireEvent.click(allDateButtons[12]); });
  const confirmBtn = screen.getByRole('button', { name: /Confirm \d+ nights/i });
  await act(async () => { fireEvent.click(confirmBtn); });
  // 5. advance through budget card ("Use this" appears after 1s timer)
  await act(async () => { vi.advanceTimersByTime(1100); });
  const useThisBtn = screen.getByRole('button', { name: /Use this/i });
  await act(async () => { fireEvent.click(useThisBtn); });
  // 6. tap Done on dietary card (no selection = no restrictions)
  const doneBtn = screen.getByRole('button', { name: /^Done$/i });
  await act(async () => { fireEvent.click(doneBtn); });
}
```

**Note:** `vi.useFakeTimers()` in `beforeEach` is required because the budget card inactivity timer is in the navigation path. `vi.useRealTimers()` + `vi.restoreAllMocks()` in `afterEach`.

**Mocking fetch in integration tests:**
```typescript
beforeEach(() => {
  vi.spyOn(global, 'fetch');
  vi.useFakeTimers();
});
// In specific test:
(global.fetch as ReturnType<typeof vi.spyOn>).mockResolvedValueOnce({
  ok: true,
  json: async () => ({ expiry_date: '2027-06-30', confidence: 0.9, fallback_required: false }),
} as unknown as Response);
```

### Triggering file input in tests

The hidden `<input type="file">` elements can be found via:
```typescript
const inputs = document.querySelectorAll('input[type="file"]');
// inputs[0] = takePhoto (capture), inputs[1] = upload
fireEvent.change(inputs[1], {
  target: { files: [new File(['data'], 'passport.jpg', { type: 'image/jpeg' })] }
});
await act(async () => {}); // flush microtasks (the fetch mock resolves)
```
The `PassportUploadCard` calls `handleFileUpload(file)` which calls `fetch`, which is async. After `fireEvent.change`, you need at least one `await act(async () => {})` to resolve the mocked fetch.

### Previous Story Learnings

1. **`.js` counterpart is mandatory** — every `.tsx` card needs a matching `.js`; Vitest resolves `.js` first
2. **Both `index.ts` AND `index.js`** need the new export
3. **App.js must be kept in sync with App.tsx** — copy all logic changes (no JSX, use `_jsx`/`_jsxs`)
4. **`vi.useFakeTimers()` must be in `beforeEach`** for any test file that navigates through the budget card (it has a 1s timer)
5. **`vi.restoreAllMocks()` + `vi.useRealTimers()` in `afterEach`** — always pair with beforeEach setup
6. **`act(async () => {})` wrapping** — all fireEvent calls need this; async state updates (fetch response) need an extra `await act(async () => {})` after the trigger
7. **Hardcoded date indices `[5]`/`[12]`** in navigation helpers — pre-existing pattern from 8-5/8-6; carry forward as-is
8. **Focus testing** — `manualInputRef.current?.focus()` in useEffect: test by checking `document.activeElement` after state transition

### File List

Files to create:
- `stravel/frontend/src/components/cards/PassportUploadCard.tsx`
- `stravel/frontend/src/components/cards/PassportUploadCard.js`
- `stravel/frontend/src/components/cards/__tests__/PassportUploadCard.test.tsx`
- `stravel/frontend/src/components/cards/__tests__/PassportUploadCard.axe.test.tsx`
- `stravel/frontend/src/__tests__/DemoPage.passportCard.test.tsx`

Files to modify:
- `stravel/frontend/src/components/cards/index.ts`
- `stravel/frontend/src/components/cards/index.js`
- `stravel/frontend/src/App.tsx`
- `stravel/frontend/src/App.js`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No blocking issues encountered. All 7 tasks implemented cleanly on first attempt.

### Completion Notes List

- **Task 1**: `PassportUploadCard.tsx` — full state machine (`idle|uploading|confirm|manual`), raw `fetch` + `FormData` for OCR (not `apiClient` — would break multipart), two separate hidden file inputs (camera + file picker), drag-drop, keyboard zone, `useEffect` focus for manual state, `formatDateForDisplay` ISO→DD/MM/YYYY converter.
- **Task 2**: `PassportUploadCard.js` — JSX runtime counterpart using `_jsx`/`_jsxs` from `react/jsx-runtime`. This is the file Vitest actually imports (resolves `.js` before `.tsx`).
- **Task 3**: Both `index.ts` and `index.js` updated with named + type exports.
- **Task 4**: 13 unit tests covering AC1–AC6, error handling, and manual submit — all passing.
- **Task 5**: 3 axe tests (idle, confirm, manual states) — zero WCAG 2.1 AA violations in all states.
- **Task 6**: `App.tsx` and `App.js` updated — `passportCardVisible` state, `handlePassportSelect`, `handlePassportSkip`, `formatDateForDisplay` module-level helper, dietary handler extended. Both files kept in sync.
- **Task 7**: 3 integration tests (`DemoPage.passportCard.test.tsx`) — full navigation helper chain, `vi.useFakeTimers()` for budget card 1s timer, OCR fetch mock, all passing.
- **Final test run**: 506/506 tests across 55 test files — zero regressions (up from 487 before this story).

### File List

**Created:**
- `stravel/frontend/src/components/cards/PassportUploadCard.tsx`
- `stravel/frontend/src/components/cards/PassportUploadCard.js`
- `stravel/frontend/src/components/cards/__tests__/PassportUploadCard.test.tsx`
- `stravel/frontend/src/components/cards/__tests__/PassportUploadCard.axe.test.tsx`
- `stravel/frontend/src/__tests__/DemoPage.passportCard.test.tsx`

**Modified:**
- `stravel/frontend/src/components/cards/index.ts`
- `stravel/frontend/src/components/cards/index.js`
- `stravel/frontend/src/App.tsx`
- `stravel/frontend/src/App.js`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-05-26 | Story created | bmad-create-story |
| 2026-05-26 | Full implementation — PassportUploadCard component, .js counterpart, unit/axe/integration tests, App integration; 506/506 tests passing | claude-sonnet-4-6 |
