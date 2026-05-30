# Story 10.5: StagingGate Component

Status: done

## Story

As a travel agent who has finished preparing a client's proposal,
I want a clear "draft" banner and a staged confirmation flow before the proposal is marked as client-ready,
So that I never accidentally share an unfinished proposal with a client.

## Acceptance Criteria

**AC1 — Draft banner for pending/modified sessions**
Given a session has `status: "pending"` or `status: "modified"`
When `StagingGate` renders
Then an amber banner appears at the top of the right panel with text "Working draft — not yet shared with client"
And the banner has `role="banner"` and `aria-live="polite"`
And a "Mark as client-ready →" button is present and keyboard-focusable (Enter/Space activates)

**AC2 — Confirmation modal opens on button click**
Given the agent clicks "Mark as client-ready →"
When clicked
Then a confirmation modal opens (not a toast, not inline — a modal)
And the modal contains "Share this proposal with the client? This cannot be undone without editing." with "Confirm" and "Cancel" buttons
And focus moves to the "Cancel" button on modal open (safe default per UX-DR18)
And the modal traps focus: Tab/Shift+Tab cycle only between "Cancel" and "Confirm" while open

**AC3 — Cancel closes modal and restores focus**
Given the confirmation modal is open
When "Cancel" is clicked or Escape is pressed
Then the modal closes
And no API call is made
And focus returns to the "Mark as client-ready →" button (triggerRef pattern per UX-DR18)

**AC4 — Confirm calls API and shows success state**
Given the agent clicks "Confirm" in the modal
When the API call to `PATCH /api/v1/advisory_sessions/{id}/status` succeeds with `{ status: "confirmed" }`
Then the amber banner disappears
And a green "Shared with client ✓" success banner appears briefly (auto-dismisses after 3 seconds)
And `aria-live="polite"` announces "Session confirmed and shared with client"
And focus returns to the right panel (where the trigger button was, now gone)

**AC5 — Flagged session shows red alert banner**
Given a session has `status: "flagged"`
When `StagingGate` renders
Then a red `role="alert"` banner appears: "Flagged: [flag_reason]"
And the "Mark as client-ready →" button is absent — a flagged session cannot be confirmed until the flag is resolved

**AC6 — Confirmed session shows no draft banner**
Given a session has `status: "confirmed"` (and not in transient just-confirmed success state)
When `StagingGate` renders
Then no banner is rendered at all — the panel is unobstructed

**AC7 — Modified status reappears amber banner with announcement**
Given a session transitions from `confirmed` to `modified` (parent updates session prop)
When `StagingGate` re-renders with the updated session
Then the amber draft banner reappears
And the persistent `aria-live` sentinel announces "Session returned to draft"

**AC8 — B2BLayout wiring**
Given `B2BLayout` receives an `activeSession` prop and `onStatusChange` callback
When the session has a non-confirmed status
Then `StagingGate` renders at the top of the right panel, above `children`
And all existing B2BLayout tests continue to pass

## Tasks / Subtasks

- [x] Task 1: Add `sessions.updateStatus` to `apiClient.ts`
  - [x] 1.1: Add to `api.sessions`:
    ```ts
    updateStatus: (id: string, status: SessionStatus, flag_reason?: string) =>
      request<AdvisorySession>(`/advisory_sessions/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(flag_reason ? { flag_reason } : {}) }),
      }),
    ```
  - [x] 1.2: Verify `SessionStatus` is imported from `types/domain` (already exported)

- [x] Task 2: Create `StagingGate` component (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] 2.1: Create `stravel/frontend/src/components/b2b/StagingGate.tsx`
  - [x] 2.2: Implement amber draft banner (AC1)
  - [x] 2.3: Implement red flagged banner (AC5)
  - [x] 2.4: Implement transient confirmed success banner (AC4)
  - [x] 2.5: Implement confirmation modal (AC2, AC3, AC4)
  - [x] 2.6: Implement `handleConfirm` (AC4)
  - [x] 2.7: Implement `handleCancel` (AC3)
  - [x] 2.8: Implement persistent sr-only `aria-live` sentinel for announcements (AC4, AC7)
  - [x] 2.9: No visible banner for confirmed + !justConfirmed state (AC6)

- [x] Task 3: Wire `StagingGate` into `B2BLayout` (AC: 8)
  - [x] 3.1: Modify `stravel/frontend/src/components/b2b/B2BLayout.tsx`

- [x] Task 4: Write tests (AC: 1–8)
  - [x] 4.1: Create `stravel/frontend/src/components/b2b/__tests__/StagingGate.test.tsx` (15 tests)
  - [x] 4.2: Update `stravel/frontend/src/__tests__/B2BLayout.test.tsx` (2 new tests, 11 total)

### Review Findings

- [x] [Review][Patch] P1 [HIGH] Focus trap broken during in-flight confirm — `confirming=true` sets `disabled={confirming}` on Confirm button, removing it from tab order; Tab escapes modal, Shift+Tab from Cancel dead-ends [StagingGate.tsx:176-184]
- [x] [Review][Patch] P2 [HIGH] Backdrop click not guarded during in-flight confirm — `handleCancel` closes modal while API is in-flight; `onStatusChange` + `justConfirmed` still fire on resolution, showing success banner the user did not intend [StagingGate.tsx:151-153]
- [x] [Review][Patch] P3 [MED] No error feedback on API failure — empty catch block silently swallows errors; user sees modal stay open with no message [StagingGate.tsx:52-65]
- [x] [Review][Patch] P4 [MED] Redundant `aria-live="polite"` on draft banner div — sr-only sentinel already handles announcements; two live regions risk double-announcement by screen readers [StagingGate.tsx:104]
- [x] [Review][Patch] P5 [LOW] Missing `aria-describedby` on dialog — description paragraph not programmatically linked to the modal; add `id` to `<p>` and `aria-describedby` to dialog div [StagingGate.tsx:159,164]
- [x] [Review][Patch] P6 [LOW] Missing test: AC2 focus trap Tab/Shift+Tab cycling behavior not covered in test suite [StagingGate.test.tsx]
- [x] [Review][Patch] P7 [LOW] Missing test: AC7 `confirmed→modified` transition announcement not explicitly tested [StagingGate.test.tsx]
- [x] [Review][Defer] D1 Stale `session.id` closure if parent swaps session while modal is open [StagingGate.tsx:52] — deferred, pre-existing race condition
- [x] [Review][Defer] D2 Draft + success banners can coexist during parent update delay [StagingGate.tsx:103-133] — deferred, design limitation
- [x] [Review][Defer] D3 No persistent confirmed indicator after 3s auto-dismiss — deferred, parent SessionStatusBadge handles status display
- [x] [Review][Defer] D4 `prevStatusRef` fragility on remount — deferred, benign in practice
- [x] [Review][Defer] D5 `role="banner"` ARIA landmark misuse in sub-component — deferred, AC1 explicitly prescribes it; fix requires story spec change [StagingGate.tsx:105]

## Dev Notes

### What Is Already Implemented — DO NOT RECREATE

- **`SessionStatus` type** (`domain.ts:26`): `"pending" | "confirmed" | "modified" | "flagged"` — already exported
- **`AdvisorySession` interface** (`domain.ts:39`): `status: SessionStatus`, `flag_reason?: string | null`, `id: string`, `tenant_id: string`, `created_at/updated_at: string`, `traveler_profile: TravelerProfile | null`
- **`SessionStatusBadge`** (`components/shared/SessionStatusBadge.tsx`): already implemented (story 10-3); do NOT recreate status display logic
- **`B2BLayout`** (`components/b2b/B2BLayout.tsx`): already implemented (story 10-2); ONLY add the optional props and StagingGate wiring
- **`api.sessions.archive`** (`services/apiClient.ts:40-43`): shows the PATCH pattern; the new `updateStatus` uses a different endpoint (`/status` suffix) per story 4.1 API spec
- **CSS custom properties for status**: `var(--status-pending)`, `var(--status-confirmed)`, `var(--status-modified)`, `var(--status-flagged)` defined in `.theme-b2b`
- **`--color-primary`**: resolves to B2B blue in `.theme-b2b` context

### API Endpoint (from Story 10-1 / 4.1)

The PATCH endpoint is: `PATCH /api/v1/advisory_sessions/{session_id}/status`
- Body: `{ status: "pending" | "confirmed" | "modified" | "flagged", flag_reason?: str }`
- Response: `AdvisorySession` (full updated session object)
- NOT the same as `api.sessions.archive` which uses `PATCH /advisory_sessions/{id}` (root endpoint)

Add to `api.sessions` in `apiClient.ts`:
```ts
updateStatus: (id: string, status: SessionStatus, flag_reason?: string) =>
  request<AdvisorySession>(`/advisory_sessions/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, ...(flag_reason ? { flag_reason } : {}) }),
  }),
```
Import `SessionStatus` from `../types/domain` at the top of `apiClient.ts`.

### No Hardcoded Hex (ARCH-9 ESLint)

All colors via CSS custom properties. For amber/warning color if no dedicated token exists, use:
```tsx
style={{ background: 'var(--color-warning, var(--status-modified))' }}
```
The amber "staging" color can piggyback on `--status-modified` (amber) which is already defined. Do NOT write `#f59e0b` or any hex.

For the green success banner, use `var(--status-confirmed)` (already defined as green in `.theme-b2b`).

For the red flagged banner, use `var(--status-flagged)` (already defined as red in `.theme-b2b`).

### No Icon Library — Inline SVG Only

All icons must be inline SVG. For the "×" close or checkmark in the success banner, use a simple text character or inline `<svg>`. No `lucide-react`, no `@heroicons/react`.

### Focus Management — triggerRef Pattern (UX-DR18)

```tsx
const triggerRef = useRef<HTMLButtonElement>(null);
const cancelRef = useRef<HTMLButtonElement>(null);

function openModal() {
  setModalOpen(true);
  // focus moves to cancelRef in useEffect
}

function handleCancel() {
  setModalOpen(false);
  // restore focus synchronously
  triggerRef.current?.focus();
}

useEffect(() => {
  if (modalOpen) {
    cancelRef.current?.focus();
  }
}, [modalOpen]);
```

### Focus Trap Implementation

```tsx
function handleModalKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  if (e.key === 'Escape') {
    handleCancel();
    return;
  }
  if (e.key === 'Tab') {
    const focusable = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLButtonElement[];
    if (focusable.length < 2) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}
```
Apply `onKeyDown={handleModalKeyDown}` to the modal overlay div.

### Announcement Pattern for AC7 (status → modified)

Use a `useEffect` tracking `session.status` with a `prevStatusRef` to detect transitions:
```tsx
const prevStatusRef = useRef<string>(session.status);
useEffect(() => {
  if (prevStatusRef.current === 'confirmed' && session.status === 'modified') {
    setAnnouncement('Session returned to draft');
  }
  prevStatusRef.current = session.status;
}, [session.status]);
```
This fires the announcement only on the `confirmed → modified` transition, not on initial render.

### B2BLayout Wiring — Minimal Change

The existing `rightPanelContent` variable is used in 3 places (desktop, tablet, mobile). To minimize changes and avoid breaking existing tests:
```tsx
// New props (optional):
// activeSession?: AdvisorySession
// onStatusChange?: (session: AdvisorySession) => void

const stagingGate = activeSession && onStatusChange ? (
  <StagingGate session={activeSession} onStatusChange={onStatusChange} />
) : null;

// In each panel slot, wrap with a flex-col container:
const rightPanelWithGate = (
  <div className="flex flex-col h-full overflow-hidden">
    {stagingGate}
    <div className="flex-1 overflow-hidden">{rightPanelContent}</div>
  </div>
);
```
Use `rightPanelWithGate` in all three panel slots instead of `rightPanelContent`. Existing tests don't pass `activeSession` so `stagingGate` is `null` — no banner renders and all 9 existing tests pass.

### Test Mock Pattern for apiClient

```tsx
// At top of test file, before imports:
vi.mock('../../../services/apiClient', () => ({
  api: {
    sessions: {
      updateStatus: vi.fn(),
    },
  },
}));

// In each test that calls the API:
import { api } from '../../../services/apiClient';
const mockUpdateStatus = vi.mocked(api.sessions.updateStatus);
mockUpdateStatus.mockResolvedValueOnce({ ...mockSessionBase, status: 'confirmed' });
```

### Auto-Dismiss Timer — Clean useEffect

```tsx
useEffect(() => {
  if (!justConfirmed) return;
  const timer = setTimeout(() => setJustConfirmed(false), 3000);
  return () => clearTimeout(timer);
}, [justConfirmed]);
```

### Test Setup

- Framework: `vitest` + `jsdom` + `@testing-library/react`
- Setup: `src/test/setup.ts` (imports `@testing-library/jest-dom`)
- Test location: `src/components/b2b/__tests__/`
- Timer mocking: `vi.useFakeTimers()` for the 3s auto-dismiss test; reset with `vi.useRealTimers()` in afterEach

### File Locations

- New: `stravel/frontend/src/components/b2b/StagingGate.tsx`
- New: `stravel/frontend/src/components/b2b/__tests__/StagingGate.test.tsx`
- Modify: `stravel/frontend/src/services/apiClient.ts` — add `sessions.updateStatus`
- Modify: `stravel/frontend/src/components/b2b/B2BLayout.tsx` — add optional `activeSession`/`onStatusChange` props, wire StagingGate
- Modify: `stravel/frontend/src/__tests__/B2BLayout.test.tsx` — add 1 test for StagingGate wiring

### Previous Story Learnings (Epic 10, Stories 10-2 through 10-4)

- No `text-primary` Tailwind utility — use `style={{ color: 'var(--color-primary)' }}`
- No `text-status-*` utilities — use inline CSS vars for status colors
- `bg-status-*` Tailwind classes exist but `text-status-*` do NOT
- Inline SVG required for all icons (no icon library)
- `--tw-ring-color` (not `focusRingColor`) for setting focus ring color on Tailwind `focus:ring-*`
- Tests that assert CSS custom properties: check for `var(--...)` in `style` attribute, not hex values
- `vi.mock('@tanstack/react-virtual')` needed in any test file that imports components using `SessionList` (not needed for StagingGate)
- `SessionStatusBadge` has a null guard: `if (!Icon || !label) return null` — works correctly with all 4 valid statuses

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- 774/774 tests pass (82 test files) — 17 new tests added (15 StagingGate + 2 B2BLayout), zero regressions
- AC6 "confirmed = nothing rendered" implemented as "no visible banner"; sr-only aria-live sentinel always present for announcement support

### Completion Notes List

- Added `api.sessions.updateStatus(id, status, flag_reason?)` to `apiClient.ts`: PATCH `/advisory_sessions/{id}/status`; imported `SessionStatus` type
- Created `StagingGate.tsx`: amber draft banner (`role="banner"` `aria-live="polite"`) for pending/modified; red `role="alert"` for flagged with flag_reason; transient green success banner (auto-dismiss 3s) after confirm; confirmation modal with focus trap (Tab/Shift+Tab between Cancel/Confirm); triggerRef focus restoration on cancel; `prevStatusRef` to detect `confirmed→modified` transition for "Session returned to draft" announcement; persistent sr-only `role="status"` sentinel for all aria-live announcements; all colors via `var(--status-*)` CSS custom properties, no hardcoded hex
- Modified `B2BLayout.tsx`: added optional `activeSession?` and `onStatusChange?` props; `rightPanelWithGate` wrapper renders StagingGate above children in all three panel slots (desktop/tablet/mobile); existing tests pass because props are optional

## File List

- `stravel/frontend/src/services/apiClient.ts` — added `sessions.updateStatus`, imported `SessionStatus`
- `stravel/frontend/src/components/b2b/StagingGate.tsx` — new file
- `stravel/frontend/src/components/b2b/B2BLayout.tsx` — added optional activeSession/onStatusChange props, StagingGate wiring
- `stravel/frontend/src/components/b2b/__tests__/StagingGate.test.tsx` — new file (15 tests)
- `stravel/frontend/src/__tests__/B2BLayout.test.tsx` — added apiClient mock, 2 new StagingGate wiring tests

## Change Log

- Story created — 2026-05-29
- Story implemented — 2026-05-29: StagingGate component + B2BLayout wiring; api.sessions.updateStatus added; 17 new tests (774 total, all pass)
- Code review patches applied — 2026-05-29: P1 aria-disabled focus trap; P2 handleCancel confirming guard; P3 error state in modal; P4 removed redundant aria-live from banner; P5 aria-describedby on dialog; P6 focus trap Tab/Shift+Tab tests; P7 confirmed→modified transition test; 4 new tests (778 total, all pass)
