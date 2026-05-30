# Story 7.7: aria-live State Machine & Unified Canvas Integration

Status: done

## Story

As a screen reader user,
I want AI-generated content to be announced clearly when it's complete rather than stuttering through every token,
So that I can follow the conversation without my screen reader being overwhelmed by streaming updates.

## Acceptance Criteria

1. **Given** an SSE stream begins (first token / `CONNECTED` dispatch sets `ssePhase: "streaming"`)
   **When** DemoPage derives its aria phase from `isLoading`
   **Then** `ConversationCanvas` `aria-live` is set to `"off"` during loading (stream active analog)

2. **Given** the loading completes (SSE `[DONE]` analog — `isLoading` transitions to `false`)
   **When** DemoPage aria phase updates
   **Then** `ConversationCanvas` `aria-live` switches to `"polite"` in the same React render batch, and the persistent sentinel `<div role="status" aria-live="polite" aria-atomic="true">` receives the completion announcement text "Message received."

3. **Given** an error occurs (chat fetch fails)
   **When** the error is surfaced
   **Then** `ConversationCanvas` `aria-live` is set to `"assertive"` and the sentinel div announces the error immediately with text "Something went wrong."

4. **Given** `ConversationCanvas` is rendered
   **When** its attributes are inspected
   **Then** it carries `aria-relevant="additions"` in addition to the existing `role="log"` and `aria-label="Travel advisory conversation"`

5. **Given** the page has loaded with all Epic 7 components integrated (ConversationCanvas, MessageBubble, StageNarrator, JourneyProgressBar, TravelCard)
   **When** `axe-core` runs via `jest-axe` against each component in isolation
   **Then** zero WCAG 2.1 AA violations are reported

6. **Given** the full B2C flow (canvas load → greeting → chat → stage narration → progress bar)
   **When** it runs end-to-end in the existing dev/test infrastructure
   **Then** it works without modifying `vite.config.ts` and all existing tests continue to pass (≥302 passing)

## Tasks / Subtasks

- [x] Task 1: Add `aria-relevant="additions"` to ConversationCanvas + sync .js counterpart (AC: #4)
  - [x] In `src/components/layout/ConversationCanvas.tsx`: add `aria-relevant="additions"` to the root div
  - [x] Sync `src/components/layout/ConversationCanvas.js`: update JSX-runtime counterpart to match

- [x] Task 2: Wire aria-live state machine in DemoPage + add sentinel div (AC: #1, #2, #3)
  - [x] In `App.tsx` (DemoPage): derive `ariaPhase: 'off' | 'polite' | 'assertive'` from `isLoading` and error state:
    - `isLoading === true` → `'off'`
    - error occurred → `'assertive'`
    - otherwise → `'polite'`
  - [x] Added `hasError` and `sentinelText` state; `handleSend` sets sentinel on completion/error and resets on next send
  - [x] Pass `ariaLive={ariaPhase}` to `<ConversationCanvas>` in DemoPage
  - [x] Add persistent sentinel div (role="status", aria-live="polite", aria-atomic="true", visually hidden) before ConversationCanvas
  - [x] Sync `App.js`: update JSX-runtime counterpart to match DemoPage changes

- [x] Task 3: Install jest-axe and write axe tests (AC: #5)
  - [x] Installed: `jest-axe` + `@types/jest-axe` (49 packages added)
  - [x] Created `src/components/layout/__tests__/ConversationCanvas.axe.test.tsx`: 4 tests (3 ariaLive variants + aria-relevant attr check) — all pass
  - [x] Created `src/components/shared/__tests__/accessibility.axe.test.tsx`: 8 tests (MessageBubble 3 roles, StageNarrator 2 states, JourneyProgressBar 2 stages, sentinel div) — all pass
  - [x] Created `src/components/cards/__tests__/TravelCard.axe.test.tsx`: 2 tests (nascent skeleton, settled card) — all pass
  - [x] Fixed real WCAG violation: `role="progressbar"` in CompletenessIndicator.tsx was missing aria-label → added `aria-label="{pct}% complete"`, synced .js counterpart

- [x] Task 4: Run full validation suite (AC: #6)
  - [x] `npx vitest run` — 330/330 tests, 36 files, all pass (14 new axe tests)
  - [x] `npm run lint` — clean
  - [x] `npm run build` — clean (423 kB bundle, no tsc errors)

## Dev Notes

### Architecture Context

- **ConversationCanvas** (`src/components/layout/ConversationCanvas.tsx`): Already has `role="log"`, `aria-label="Travel advisory conversation"`, `aria-live={ariaLive}` prop (defaults to `'polite'`). Task 1 only adds `aria-relevant`. No structural changes.
- **DemoPage** (`src/App.tsx`): Uses ConversationCanvas but has no SSE — chat is a simple `fetch()`. Task 2 derives a local `ariaPhase` from `isLoading` and `messages` state (no new state variable needed for phase — just a derived value). `sentinelText` IS new state (`useState<string>("")`).
- **ssePhase in StreamState**: Already exists (`src/types/stream.ts`). `CONNECTED` already dispatches `ssePhase: "streaming"`, `onerror` dispatches `ssePhase: "error"`, `stage.change complete` dispatches `ssePhase: "complete"`. B2B CopilotPage doesn't use ConversationCanvas so no change needed there.

### ariaLive Map (reference — not directly used as B2C uses isLoading)

```typescript
const ariaLiveMap: Record<SSEPhase, 'off' | 'polite' | 'assertive'> = {
  idle: 'polite',
  streaming: 'off',
  complete: 'polite',
  error: 'assertive',
};
```

DemoPage derives this locally from `isLoading` + error detection in messages.

### Sentinel Div Pattern

The sentinel is **always in the DOM** (never conditionally rendered) — this is required for `aria-live` regions to work correctly with screen readers. The content changes, not the element's presence.

Place it as a sibling of ConversationCanvas, visually hidden via 1px clip trick (NOT `display:none` or `visibility:hidden` — those hide it from screen readers too).

### jest-axe Usage Pattern

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('has no a11y violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

jest-axe runs `axe-core` synchronously in jsdom — needs `async/await`. Does NOT need a running browser.

### Stale .js Counterpart Pattern

Every `.tsx`/`.ts` file must have a compiled `.js` counterpart in JSX-runtime format. Vitest resolves `.js` over `.tsx` in some module paths — failing to sync causes tests to run against stale compiled code. Files to sync:
- `ConversationCanvas.tsx` → `ConversationCanvas.js`
- `App.tsx` → `App.js`

The `.js` files use `{ jsx as _jsx, jsxs as _jsxs }` from `"react/jsx-runtime"` (NOT `React.createElement`).

### Test Framework

- **Vitest** with **@testing-library/react** and `fireEvent` (NOT `@testing-library/user-event` — not installed)
- **jsdom** environment
- Run tests from `stravel/frontend/` directory: `npx vitest run`
- Current baseline: 302 passing tests across 30 test files

### axe Test Environment Notes

- jsdom does not enforce some ARIA rules that browsers do; axe-core runs fine in jsdom for structural violations
- `aria-relevant` is a valid ARIA attribute — will not cause axe violations
- TravelCard uses `role="article"` and aria-label — these should pass WCAG AA
- StageNarrator's always-mounted div with `aria-live="polite"` and empty content is valid — axe won't flag it

### Learnings from Prior Stories

- **7-4**: `CONNECTED` dispatch already sets `ssePhase: "streaming"` in streamReducer. `onerror` already dispatches `SSE_PHASE_CHANGE("error")`.
- **7-6**: `.js` counterpart must be synced manually; linter auto-formats it (JSX-runtime format). Adding `data-testid` attributes is valid.
- **7-5**: `fireEvent` from `@testing-library/react` for click events; `@testing-library/user-event` not installed.
- **7-3**: `aria-live` outer container must never unmount/remount — only content changes. This is already satisfied by sentinel pattern.

## Dev Agent Record

### Implementation Plan

1. Add `aria-relevant="additions"` to ConversationCanvas (one-liner — component already had all other aria attrs)
2. Wire aria-live state machine in DemoPage via `ariaPhase` derived value + `hasError`/`sentinelText` state; add always-mounted sentinel div
3. Install jest-axe; write axe tests for all Epic 7 components
4. While running axe tests, discovered real WCAG violation in CompletenessIndicator (`role="progressbar"` without aria-label) — fixed it as part of this story

### Debug Log

- axe test TravelCard settled state failed: `aria-progressbar-name` violation in CompletenessIndicator — missing `aria-label` on `role="progressbar"`. Fixed by adding `aria-label="{pct}% complete"` to CompletenessIndicator.tsx and .js counterpart.
- App.js edit required multiple targeted edits due to the file being on a single dense line; used line-by-line edits to avoid regex/emoji encoding mismatches.

### Completion Notes

- All 4 ACs satisfied: aria-relevant on ConversationCanvas, ariaPhase wiring in DemoPage, sentinel div with completion/error text, zero axe violations
- Fixed bonus WCAG violation: CompletenessIndicator progressbar now has accessible name
- 330 tests passing (up from 302 baseline pre-Sprint-2 → +28 in Sprint 2, +14 this story)
- AC5 (axe zero violations) verified across: ConversationCanvas (3 aria-live variants), MessageBubble (3 roles), StageNarrator (2 stages), JourneyProgressBar (2 stages), sentinel div, TravelCard (2 states)

## File List

- stravel/frontend/src/components/layout/ConversationCanvas.tsx (modified — added aria-relevant)
- stravel/frontend/src/components/layout/ConversationCanvas.js (modified — synced aria-relevant)
- stravel/frontend/src/App.tsx (modified — DemoPage: hasError state, sentinelText state, ariaPhase, sentinel div, ariaLive prop)
- stravel/frontend/src/App.js (modified — synced DemoPage changes)
- stravel/frontend/src/components/cards/CompletenessIndicator.tsx (modified — added aria-label to progressbar)
- stravel/frontend/src/components/cards/CompletenessIndicator.js (modified — synced aria-label)
- stravel/frontend/src/components/layout/__tests__/ConversationCanvas.axe.test.tsx (new — 4 axe tests)
- stravel/frontend/src/components/shared/__tests__/accessibility.axe.test.tsx (new — 8 axe tests)
- stravel/frontend/src/components/cards/__tests__/TravelCard.axe.test.tsx (new — 2 axe tests)
- stravel/frontend/package.json (modified — jest-axe + @types/jest-axe devDependencies)
- stravel/frontend/package-lock.json (modified — lockfile update for jest-axe)

### Review Findings

- [x] [Review][Patch] P1: Sentinel hardcoded `aria-live="polite"` — error path silently downgraded; needs separate assertive region or dynamic polite/assertive on sentinel [src/App.tsx — sentinel div, line ~327]
- [x] [Review][Patch] P2: Sentinel absent in `agentMode=true` early-return branch — violates always-in-DOM spec requirement; move sentinel outside the early return [src/App.tsx — agentMode conditional, line ~296]
- [x] [Review][Patch] P3: `container.firstChild` fragile in axe test — replace with `getByRole('log')` for resilience [src/components/layout/__tests__/ConversationCanvas.axe.test.tsx:39]
- [x] [Review][Patch] P4: No test for `ariaPhase` transition logic in DemoPage — `isLoading→'off'`, `hasError→'assertive'`, success→`'polite'` entirely untested; regression risk [src/App.tsx — ariaPhase logic]
- [x] [Review][Defer] D1: Rapid-resend clears sentinelText before AT finishes announcing — timing tradeoff; use counter-based text or delay in cleanup story [src/App.tsx]
- [x] [Review][Defer] D2: `role="log"` + explicit `aria-live` override inconsistently honoured in NVDA/VoiceOver — inherent ARIA tradeoff, pre-existing architecture [src/components/layout/ConversationCanvas.tsx]
- [x] [Review][Defer] D3: `position:absolute` sentinel without `position:relative` on B2CLayout parent — 1px sentinel may anchor to viewport root; add `position:relative` to layout wrapper [src/App.tsx]
- [x] [Review][Defer] D4: Identical repeated error text not re-announced by AT (same string = no DOM mutation) — add counter suffix in cleanup story [src/App.tsx]
- [x] [Review][Defer] D5: `aria-live="off"` + `aria-relevant="additions"` on same ConversationCanvas element — spec-undefined state when live is off [src/components/layout/ConversationCanvas.tsx]

## Change Log

- 2026-05-26: Story created (create-story workflow)
- 2026-05-26: Story implemented — all tasks complete, 330/330 tests passing (dev-story workflow)
- 2026-05-26: Code review complete — 4 patches, 5 defers, 7 dismissed
- 2026-05-26: All 4 patches applied — dual sentinel, agentMode fix, axe test resilience, ariaPhase integration tests; 336/336 tests passing
