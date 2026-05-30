# Story 10.4: SessionList & SessionRow (Virtualized)

Status: done

## Story

As a travel agent with 20+ active sessions,
I want a fast-scrolling session list with search and status filtering,
So that I can find any client session in under 3 seconds regardless of how many sessions I have.

## Acceptance Criteria

**AC1 — Virtualized rendering**
Given the `SessionList` component renders
When it mounts with any number of sessions
Then it uses `@tanstack/react-virtual` with a fixed row height of exactly 64px
And only the visible rows (~6–8 at desktop height) are in the DOM — rows outside the viewport are not rendered

**AC2 — Search filter**
Given a search query is typed in the session list search input
When the user types
Then the visible rows filter in real-time to sessions where the session ID or destination contains the query (case-insensitive)
And the virtualizer re-calculates for the filtered list without flickering

**AC3 — Status filter**
Given a status filter chip is tapped ("Pending", "Confirmed", "Modified", "Flagged")
When filtered
Then only sessions with that status are shown
And multiple status filters can be active simultaneously (toggle: tap selected filter to deselect)

**AC4 — SessionRow content**
Given a `SessionRow` renders
When evaluated
Then it shows: client avatar initials (2 uppercase chars from `session.id`), session ID display (8 chars + ellipsis), destination from `traveler_profile.destination_preferences[0]` (or "No destination"), `SessionStatusBadge`, and `updated_at` as relative time ("Xm ago", "Xh ago", "Xd ago", "Just now")
And the row height is exactly 64px (required for virtualizer correctness — UX-DR15)
And the row is keyboard focusable (`tabIndex={0}`); Enter or Space activates the session (calls `onSelect`)

**AC5 — Active session state**
Given a session is the active session (`session.id === activeSessionId`)
When `SessionRow` renders
Then the row has `aria-selected="true"` and a left accent bar using `var(--color-primary)` on the B2B palette
And inactive rows have `aria-selected="false"`

**AC6 — ARIA listbox pattern**
Given the `SessionList` container renders
When evaluated
Then it has `role="listbox"` and `aria-label="Client sessions"`
And each `SessionRow` has `role="option"`

**AC7 — B2BLayout wiring**
Given the B2BLayout currently has an inline `sessionList` variable with raw row JSX
When story 10.4 is complete
Then `B2BLayout` uses `<SessionList>` in both the desktop left panel and the overlay
And all existing B2BLayout tests continue to pass

## Tasks / Subtasks

- [x] Task 1: Install `@tanstack/react-virtual` dependency
  - [x] 1.1: Run `npm install @tanstack/react-virtual` in `stravel/frontend/`
  - [x] 1.2: Verify it appears in `package.json` dependencies (not devDependencies)

- [x] Task 2: Create `SessionRow` component (AC: 4, 5, 6)
  - [x] 2.1: Create `stravel/frontend/src/components/b2b/SessionRow.tsx`
    - Props: `{ session: AdvisorySession; isActive: boolean; onSelect: (session: AdvisorySession) => void; }`
    - `role="option"`, `aria-selected={isActive}`, `tabIndex={0}`
    - Height: fixed at exactly 64px via inline style `{ height: 64, minHeight: 64, maxHeight: 64 }`
    - Avatar: `session.id.slice(0, 2).toUpperCase()` in a 32×32 circle, `style={{ background: \`var(--status-${session.status})\` }}`; `aria-hidden="true"`
    - Session name: `Session ${session.id.slice(0, 8)}…` (no client_name field exists)
    - Destination: `session.traveler_profile?.destination_preferences?.[0] ?? 'No destination'`
    - Status: render `<SessionStatusBadge status={session.status} flag_reason={session.flag_reason} />`
    - Relative time: `formatRelativeTime(session.updated_at)` (define inline utility)
    - Active state: `style={{ borderLeft: '4px solid var(--color-primary)' }}` when `isActive`; `borderLeft: '4px solid transparent'` when inactive
    - `onKeyDown`: call `onSelect(session)` on Enter or Space
    - `onClick`: call `onSelect(session)`
    - `data-testid={`session-row-${session.id}`}`
  - [x] 2.2: Define `formatRelativeTime(isoString: string): string` as a module-level function in `SessionRow.tsx`:
    - `< 1 min` → `"Just now"`
    - `1–59 min` → `"Xm ago"`
    - `1–23 hrs` → `"Xh ago"`
    - `≥ 24 hrs` → `"Xd ago"`

- [x] Task 3: Create `SessionList` component with virtualizer (AC: 1, 2, 3, 6)
  - [x] 3.1: Replace `stravel/frontend/src/components/b2b/SessionList.tsx` entirely
    - Props: `{ sessions: AdvisorySession[]; activeSessionId?: string; onSelect: (session: AdvisorySession) => void; }`
    - Remove old `onArchive` prop — archive is not part of this story
    - State: `searchQuery: string`, `statusFilters: SessionStatus[]`
    - `filteredSessions`: filter by `searchQuery` (session.id OR destination_preferences[0], case-insensitive) and `statusFilters` (OR logic: item shown if its status is in the active filters, or no filters active)
    - Virtualizer setup:
      ```tsx
      const parentRef = useRef<HTMLDivElement>(null);
      const virtualizer = useVirtualizer({
        count: filteredSessions.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 64,
        overscan: 3,
      });
      ```
    - Container: `ref={parentRef}`, `role="listbox"`, `aria-label="Client sessions"`, `data-testid="session-list"`, `style={{ height: '100%', overflowY: 'auto' }}`
    - Inner div: `style={{ height: virtualizer.getTotalSize(), position: 'relative' }}`
    - Render `virtualizer.getVirtualItems()`: each as `<div key={vRow.key} style={{ position: 'absolute', top: vRow.start, left: 0, width: '100%', height: vRow.size }}>` containing a `<SessionRow>`
    - Search input: `data-testid="session-search"`, `aria-label="Search sessions"`, `placeholder="Search sessions…"`
    - Filter chips: one per status (`pending|confirmed|modified|flagged`), `data-testid={`filter-chip-${status}`}`, `aria-pressed={statusFilters.includes(status)}`, toggle on click
    - Empty state when `filteredSessions.length === 0`: `<div data-testid="session-list-empty">No sessions found</div>`

- [x] Task 4: Wire `SessionList` into `B2BLayout` (AC: 7)
  - [x] 4.1: Modify `stravel/frontend/src/components/b2b/B2BLayout.tsx`
    - Import `SessionList` from `./SessionList`
    - Replace the inline `sessionList` variable (the `<div>` with `sessions.map(...)`) with `<SessionList sessions={sessions} activeSessionId={activeSessionId} onSelect={handleSessionSelectFromOverlay} />`
    - The `sessionList` variable is used twice in B2BLayout (desktop left panel and overlay) — both must use the new component
    - Remove the `sessions.map(...)` block that B2BLayout currently renders inline
    - Verify `handleSessionSelectFromOverlay` still closes the overlay: `(session) => { onSelectSession(session); setOverlayOpen(false); }`

- [x] Task 5: Write tests (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] 5.1: Create `stravel/frontend/src/components/b2b/__tests__/SessionRow.test.tsx`:
    - Mock `@tanstack/react-virtual` (needed by SessionList but not SessionRow directly — skip here)
    - Tests:
      - Renders `role="option"` and `data-testid="session-row-{id}"`
      - Shows avatar initials from `session.id.slice(0,2).toUpperCase()`
      - Shows `Session abc12345…` truncated session name
      - Shows destination from `destination_preferences[0]`
      - Shows "No destination" when profile is null
      - `aria-selected="true"` when `isActive=true`; `aria-selected="false"` when false
      - Active row: `style.borderLeft` contains `var(--color-primary)`
      - Calls `onSelect` on click
      - Calls `onSelect` on Enter keydown
      - Calls `onSelect` on Space keydown
      - Has `tabIndex={0}`
      - Renders `SessionStatusBadge` (assert `data-testid="session-status-badge"` in DOM)
      - Renders relative time (assert text matches pattern `/ago|Just now/`)
  - [x] 5.2: Replace `stravel/frontend/src/components/b2b/__tests__/SessionList.test.tsx` entirely:
    - Add top-level `vi.mock('@tanstack/react-virtual', ...)` (see Dev Notes)
    - Tests:
      - Renders `role="listbox"` container with `aria-label="Client sessions"`
      - Renders all sessions when no filter active (virtualizer mock returns all)
      - Search input filters sessions by session ID substring
      - Search input filters sessions by destination substring (case-insensitive)
      - No results shows `data-testid="session-list-empty"`
      - Status filter chip toggles (click "Pending" chip → only pending sessions shown)
      - Multiple status filters active simultaneously (click "Pending" + "Confirmed" → both shown)
      - Deselecting filter restores all sessions
      - Calls `onSelect` when a session row is activated
  - [x] 5.3: Verify existing B2BLayout tests still pass after the wiring change (added `vi.mock('@tanstack/react-virtual')` to B2BLayout test file — required since SessionList now depends on it; all 9 tests pass)

### Review Findings

- [x] [Review][Patch] focusRingColor invalid CSS — search input has no visible focus ring (WCAG 2.4.7) [SessionList.tsx:61]
- [x] [Review][Patch] formatRelativeTime future/negative diff → garbled display ("-1m ago") [SessionRow.tsx:11-17]
- [x] [Review][Patch] Virtualizer index overflow → filteredSessions[vRow.index] undefined → TypeError crash [SessionList.tsx:105-106]
- [x] [Review][Defer] filteredSessions not memoized — recomputes every render [SessionList.tsx:25-34] — deferred, performance
- [x] [Review][Defer] role="option" in position:absolute wrapper div — ARIA ownership chain technically broken [SessionList.tsx:104-116] — deferred, pre-existing
- [x] [Review][Defer] Avatar background no fallback for unknown status — transparent circle [SessionRow.tsx:41-44] — deferred, cosmetic
- [x] [Review][Defer] Single destination search (destination_preferences[0] only) — multi-destination miss [SessionList.tsx:29] — deferred, scope
- [x] [Review][Defer] handleSessionSelectFromOverlay calls setOverlayOpen(false) on desktop — no-op but fragile [B2BLayout.tsx:29-32] — deferred, pre-existing (D1 from 10-2)
- [x] [Review][Defer] No error boundary around SessionList — unhandled error crashes full B2BLayout [B2BLayout.tsx:41-47] — deferred, scope

## Dev Notes

### Critical: New Dependency — `@tanstack/react-virtual`

`@tanstack/react-virtual` is NOT currently installed (verified from `package.json`). It MUST be installed:

```bash
cd stravel/frontend && npm install @tanstack/react-virtual
```

Install in `dependencies` (not `devDependencies`) — it is a runtime dependency.

After install, import in `SessionList.tsx`:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
```

### Critical: What Is Already Implemented — DO NOT RECREATE

- **`SessionStatus` type** (`domain.ts:26`): `"pending" | "confirmed" | "modified" | "flagged"` — already exported
- **`AdvisorySession` interface** (`domain.ts:39`): includes `status: SessionStatus`, `flag_reason?: string | null`, `updated_at: string`, `traveler_profile: TravelerProfile | null`
- **`SessionStatusBadge`** (`components/shared/SessionStatusBadge.tsx`): already fully implemented in story 10-3; import as `import { SessionStatusBadge } from '../shared/SessionStatusBadge'`
- **`--status-{status}` CSS custom properties**: defined in `tokens.css` under both `:root` and `.theme-b2b`
- **`--color-primary` CSS custom property**: `var(--color-primary)` resolves to B2B blue in `.theme-b2b` context
- **`B2BLayout.tsx`**: already implemented in story 10-2; contains inline `sessionList` variable to be replaced

### Old `SessionList.tsx` — FULLY REPLACE (Do Not Extend)

The existing `stravel/frontend/src/components/b2b/SessionList.tsx` is a Phase 1 legacy component with:
- `onArchive` prop — not needed in story 10-4
- Non-virtualized rendering
- Old `session-item-{id}` testids
- Inline style-based status badge (not using `SessionStatusBadge`)

**Replace the entire file** with the new virtualized implementation. Old tests (`SessionList.test.tsx`) must also be replaced entirely — they test the old interface and will break.

### No Client Name Field — Use Session ID

`AdvisorySession` has no `client_name` field. Display:
- **Avatar initials**: `session.id.slice(0, 2).toUpperCase()` — yields 2 uppercase hex chars (e.g. "A3", "B9"). Known cosmetic limitation (deferred D8 from story 10-2).
- **Session name**: `Session ${session.id.slice(0, 8)}…` — consistent with existing B2BLayout display

### No Icon Library — Inline SVG Only

No `lucide-react`, `@heroicons/react`, or `react-icons` installed. Any icons in status filter chips must be inline SVG or text only.

### No Tailwind `text-primary` or `text-status-*` Utilities

These text color utilities are NOT defined. Use inline styles:
- Active accent: `style={{ borderLeft: '4px solid var(--color-primary)' }}`
- Status avatar: `style={{ background: \`var(--status-${status})\` }}`
- `SessionStatusBadge` handles its own color via `style={{ color: \`var(--status-${status})\` }}`

Only `bg-status-*` Tailwind utilities exist (background only). For text/border color, always use inline CSS vars.

### No Hardcoded Hex Values (ARCH-9 ESLint)

All colors must reference CSS custom properties. No `#RRGGBB` or `#RGB` in any `.tsx` file.

### Virtualizer Mock Pattern for Tests

`@tanstack/react-virtual` depends on browser layout (`getBoundingClientRect`, `ResizeObserver`) which jsdom does not implement. All SessionList tests MUST mock the module:

```tsx
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        key: i,
        index: i,
        start: i * estimateSize(),
        size: estimateSize(),
      })),
    getTotalSize: () => count * estimateSize(),
  }),
}));
```

Place this at the top of `SessionList.test.tsx`, **before** any imports that use the module. This ensures all items are rendered as virtual items so tests can assert on DOM content.

### B2BLayout Wiring — Exact Change

In `B2BLayout.tsx`, the current `sessionList` variable is:
```tsx
const sessionList = (
  <div>
    {sessions.length === 0 ? (
      <div className="p-4 text-text-muted text-sm text-center">No sessions</div>
    ) : (
      sessions.map((session) => (
        <button key={session.id} ...>
          ...
        </button>
      ))
    )}
  </div>
);
```

Replace this variable with:
```tsx
const sessionList = (
  <SessionList
    sessions={sessions}
    activeSessionId={activeSessionId}
    onSelect={handleSessionSelectFromOverlay}
  />
);
```

The `sessionList` variable is rendered in two places in B2BLayout (desktop `<aside>` and overlay `<div>`) — both automatically use the new component with this single change.

`handleSessionSelectFromOverlay` already does `onSelectSession(session); setOverlayOpen(false)` which is correct for both usage sites.

### ARIA Listbox Pattern

The correct ARIA pattern for keyboard-navigable session list:

```tsx
// SessionList container:
<div role="listbox" aria-label="Client sessions" ...>
  {/* virtual items */}
  <SessionRow ... />
</div>

// SessionRow:
<div
  role="option"
  aria-selected={isActive}
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(session); } }}
  onClick={() => onSelect(session)}
  ...
>
```

Note: `Space` key default behavior (page scroll) must be prevented via `e.preventDefault()`.

### Test Setup

- Framework: `vitest` + `jsdom` + `@testing-library/react`
- Setup file: `src/test/setup.ts` (imports `@testing-library/jest-dom`)
- Test location: `src/components/b2b/__tests__/`

### Previous Story Learnings (Epic 10, Stories 10-2 and 10-3)

- No `text-primary` Tailwind utility — use `style={{ color: 'var(--color-primary)' }}`
- `fill="currentColor"` on SVG path inherits color CSS property
- `bg-status-*` Tailwind classes exist but `text-status-*` do NOT
- Inline SVG required for all icons (no icon library)
- `style={{ color: \`var(--status-${status})\` }}` is the correct pattern for status colors
- Tests that assert CSS custom properties: check for `var(--...)` in `style` attribute, not hex values

### File Locations

- New component: `stravel/frontend/src/components/b2b/SessionRow.tsx`
- Replace component: `stravel/frontend/src/components/b2b/SessionList.tsx`
- Modify: `stravel/frontend/src/components/b2b/B2BLayout.tsx`
- New tests: `stravel/frontend/src/components/b2b/__tests__/SessionRow.test.tsx`
- Replace tests: `stravel/frontend/src/components/b2b/__tests__/SessionList.test.tsx`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- 757/757 tests pass (81 test files) — 33 new tests added (19 SessionRow + 14 SessionList), zero regressions
- B2BLayout.test.tsx required `vi.mock('@tanstack/react-virtual')` after wiring — jsdom has no layout engine; virtualizer renders 0 items without mock

### Completion Notes List

- Installed `@tanstack/react-virtual@^3.13.26` as runtime dependency in `stravel/frontend/package.json`
- Created `SessionRow.tsx`: `role="option"`, `aria-selected`, `tabIndex=0`, Enter/Space keyboard activation, 64px fixed height, avatar initials from `session.id.slice(0,2).toUpperCase()`, destination from `traveler_profile.destination_preferences[0]`, `SessionStatusBadge` integration, `formatRelativeTime` utility, CSS var colors (no hardcoded hex)
- Replaced `SessionList.tsx` entirely: `@tanstack/react-virtual` virtualizer with 64px fixed row height, search filter (session ID + destination, case-insensitive), status filter chips (aria-pressed toggle), `role="listbox"`, empty state, CSS var colors
- Wired `SessionList` into `B2BLayout.tsx`: replaced the inline `sessionList` variable with `<SessionList sessions={sessions} activeSessionId={activeSessionId} onSelect={handleSessionSelectFromOverlay} />` — single change covers both desktop aside and tablet overlay usage sites
- Added `vi.mock('@tanstack/react-virtual')` to `B2BLayout.test.tsx` — required because SessionList now imports it; the mock returns all items as virtual items enabling DOM assertions

## File List

- `stravel/frontend/package.json` — added `@tanstack/react-virtual: ^3.13.26` to dependencies
- `stravel/frontend/package-lock.json` — updated by npm install
- `stravel/frontend/src/components/b2b/SessionRow.tsx` — new file
- `stravel/frontend/src/components/b2b/SessionList.tsx` — replaced entirely (new virtualized implementation)
- `stravel/frontend/src/components/b2b/B2BLayout.tsx` — wired SessionList component
- `stravel/frontend/src/components/b2b/__tests__/SessionRow.test.tsx` — new file (19 tests)
- `stravel/frontend/src/components/b2b/__tests__/SessionList.test.tsx` — replaced entirely (14 tests)
- `stravel/frontend/src/__tests__/B2BLayout.test.tsx` — added virtualizer mock

## Change Log

- Story created — 2026-05-29
- Story implemented — 2026-05-29: SessionRow + virtualized SessionList + B2BLayout wiring; @tanstack/react-virtual installed; 33 new tests (757 total, all pass)
- Code review patches applied — 2026-05-29: fixed focusRingColor→--tw-ring-color (WCAG 2.4.7); guarded formatRelativeTime against NaN/future diff; added null guard for virtualizer index overflow; 757/757 tests pass
