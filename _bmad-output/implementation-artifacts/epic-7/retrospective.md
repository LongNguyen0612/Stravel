# Epic 7 Retrospective — Unified Canvas & Live Conversation

**Date:** 2026-05-26
**Status:** done
**Stories:** 7/7 complete
**Tests at epic close:** 336 passing (up from ~190 baseline at epic start)
**New tests added this epic:** 146

---

## What We Built

Epic 7 delivered the full Chat-First UI shell: a Tailwind token layer, a fixed-layout ConversationCanvas, a card state machine, an SSE heartbeat/`is_final` protocol, a bot greeting + MessageBubble `role` system, a stage narrator + journey progress bar, and a WCAG-verified aria-live state machine. The B2C demo page is now a functioning conversational UI; the B2B CopilotPage has reconnect logic, a stage narrator, and a progress bar wired into the real SSE stream.

---

## What Went Well

**Red-green-refactor cycle held.** Every story followed the pattern: failing tests first, minimal implementation, then refactor. No story shipped with untested behaviour — the code review on 7.7 found a gap in ariaPhase coverage and the patch test (P4) caught a real edge case on first run.

**Code review catches real bugs.** Across 7 stories, reviews found and patched:
- A WCAG violation on `role="progressbar"` (CompletenessIndicator missing `aria-label`) — would have shipped silently
- Sentinel hardcoded `aria-live="polite"` downgrading error announcements — semantically wrong ARIA
- Sentinel absent in `agentMode=true` branch — violated the always-in-DOM invariant the story itself specified
- JWT decode without null-guard in useStreamContext
- `onerror` not closing the EventSource on the SSE client — resource leak

**The `.js` counterpart pattern was captured early.** Story 7.1's debug log noted the stale-counterpart risk on the first encounter. All subsequent stories synced `.js` files proactively, and zero test failures were caused by stale counterparts from 7.2 onward.

**Design tokens as a foundation paid off.** Having all hex values in `tokens.css` and enforced by ESLint meant zero token drift during the 7 stories. The lint rule (`no-restricted-syntax` on hex in JSX `style={}`) caught violations before review in three stories.

**jest-axe found a real WCAG violation.** The axe integration test for TravelCard failed on first run due to a progressbar without an accessible name — a genuine WCAG 2.1 AA issue that would not have been caught by standard unit tests or visual review.

---

## What Was Hard

**The `.js` counterpart sync was the biggest source of friction.** Vitest's module resolution resolves `.js` over `.tsx` in some import paths, meaning tests silently ran against stale compiled output. This cost debugging time in 7.4 and 7.5 before the pattern was fully internalised. The workaround (manual sync of `.js` files to match `.tsx` changes) is reliable but brittle — it is a pre-existing architectural constraint, not something introduced this epic.

**App.tsx / App.js edit failures due to encoding.** The `App.js` file is a single dense line (minified JSX-runtime output) with em dashes encoded as `—`. Multiple `Edit` calls failed on exact-string matching when the `old_string` had the literal `—` character. The fix was to use targeted smaller edits on clearly-unique surrounding context rather than large block replacements. This pattern should be the default for App.js edits going forward.

**Response body single-read in test mocks.** The consecutive-message test in 7.7 failed because `mockResolvedValue(new Response(...))` reuses the same Response object — the body is consumed on the first `response.json()` call, and the second read returns empty. The fix is always `mockResolvedValueOnce` per call. This is a subtle Fetch API behaviour that is easy to miss.

**Deferred-work list grew.** 34 items deferred across the 7 stories. Most are legitimate tradeoffs (AT + browser ARIA compatibility, Redis event buffer, `Last-Event-ID` replay), but a few (F2/F3 — TypeScript ESLint rules, react-hooks rules not installed) are gaps that will silently allow bugs. Epic 8 should close F2 and F3 as the first task before new stories.

---

## Patterns Worth Carrying Forward

**Dual sentinel, always-in-DOM.** Never use a single `aria-live` sentinel that changes politeness. Two divs — one `polite`, one `assertive` — always mounted, content cleared at send start. This is the correct WCAG pattern and should be applied in Epic 8 wherever new live regions appear.

**`ariaPhase` derivation pattern.**
```typescript
const ariaPhase: 'off' | 'polite' | 'assertive' =
  isLoading ? 'off' : hasError ? 'assertive' : 'polite';
```
Local phase mapping from loading/error state. Does not require SSEPhase to be exposed at the top level.

**`mockResolvedValueOnce` chain for fetch sequences.** Never use `mockResolvedValue` when a test sends multiple messages — each Response body is single-read. Chain `mockResolvedValueOnce` calls, one per network request in sequence order.

**`getByRole` over `container.firstChild` in axe tests.** `container.firstChild` breaks when wrappers are added. `getByRole('log')` is semantic and resilient.

**jest-axe as a smoke test, not a compliance guarantee.** jsdom does not enforce all ARIA rules browsers do, and axe-core has known gaps (e.g. focus-trap, colour contrast from CSS variables). It is excellent at structural violations (missing labels, invalid role combos) but does not replace real AT testing.

---

## Deferred Work to Address in Epic 8

From `deferred-work.md`, these should be resolved before Epic 8 stories begin or early in Epic 8:

| ID | Priority | Description |
|----|----------|-------------|
| F2 | High | Add `@typescript-eslint/recommended` ruleset — TypeScript safety rules currently inactive |
| F3 | High | Install `eslint-plugin-react-hooks` — rules-of-hooks and exhaustive-deps violations go undetected |
| F2 (7.2) | Medium | `DemoPage.handleSend` does not check `response.ok` — HTTP 4xx/5xx silently creates empty bubble |
| D1 (7.7) | Low | Rapid-resend sentinel clearing — use counter-based text or delay before clearing |
| D4 (7.7) | Low | Identical repeated error text not re-announced by AT — add counter suffix |

F2 and F3 from the design-tokens review are the highest risk: without `exhaustive-deps` enforcement, `useEffect` bugs in Epic 8's slot-filling cards will go undetected until they surface as runtime staleness bugs.

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 7 / 7 |
| Tests at epic start | ~190 |
| Tests at epic close | 336 |
| Net new tests | +146 |
| WCAG violations fixed | 1 (CompletenessIndicator progressbar) |
| Code review patches applied | 22 (across 7 stories) |
| Items deferred | 34 |
| Build status | Clean (tsc + vite, no warnings) |
| Lint status | Clean |

---

## Ready for Epic 8

The Chat-First UI shell is complete and stable. Epic 8 (Card-Driven Profile Collection) builds on:
- `TravelCard` + `cardDisplayState` + `CompletenessIndicator` (7.3)
- `CardDeckZone` + `useFooterHeight` (7.2)
- The `is_final` card envelope + `publish_card_event()` (7.4)
- The sentinel + ariaPhase pattern (7.7)

First story: **8.1 — Mood Transitions, User Prefs, Session Status** — sets up the session state machine that all slot-filling cards depend on.
