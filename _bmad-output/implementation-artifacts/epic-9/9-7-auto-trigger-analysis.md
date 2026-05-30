# Story 9.7: Auto-Trigger Analysis

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a traveler who has just finished profile collection,
I want the AI to automatically confirm before starting my proposal,
so that I'm never surprised by a 60-second generation I didn't initiate, but I don't have to find a "Run" button.

## Acceptance Criteria

**AC1 — Auto-trigger confirmation message**
Given the profile verification screen confirms (Story 2.10 / `handleVerificationConfirm`) or the bot detects a complete slot set (FR-D4)
When the auto-trigger condition is met
Then the bot posts a MessageBubble: "Ready to build your trip proposal. This takes about 60 seconds — shall I start?"
And two QuickReply chips appear: "Let's go" and "Not yet"
And the advisory workflow is NOT yet triggered

**AC2 — "Let's go" triggers the advisory workflow**
Given the auto-trigger confirmation message is visible
When the user taps "Let's go"
Then `api.sessions.run(sessionId)` is called to start the backend workflow
And `connect(sessionId)` is called to open the SSE stream
And the StageNarrator updates to PLANNING stage
And proposal cards appear in nascent state (shimmer)
And the progress bar highlights the Proposal stage

**AC3 — "Not yet" dismisses without triggering**
Given the auto-trigger confirmation message is visible
When the user taps "Not yet"
Then the bot responds: "No problem — just say 'build my trip' whenever you're ready"
And the chat input remains active
And no API call is made

**AC4 — "build my trip" intent triggers directly**
Given the user has a complete profile (mandatory slots: destination, travel_dates, budget)
And the SSE workflow has NOT already started (`ssePhase !== 'streaming'`)
When the user types a message matching the "build my trip" intent
Then the advisory workflow triggers directly (no second confirmation shown)
And the same flow as AC2 executes (run + connect + PLANNING stage)

**AC5 — Duplicate generation guard**
Given the SSE workflow is already running (`ssePhase === 'streaming'`)
When the user attempts to trigger again (either chip or text intent)
Then the trigger is ignored
And a bot message is shown: "Your proposal is already being generated"
And no duplicate `api.sessions.run()` call is made

## Tasks / Subtasks

- [x] Task 1: Add `autoTriggerConfirmVisible` state and update `handleVerificationConfirm` (AC: 1)
  - [x] 1.1: Add `const [autoTriggerConfirmVisible, setAutoTriggerConfirmVisible] = useState(false)` to `DemoPage` state block (~line 344)
  - [x] 1.2: Rewrite `handleVerificationConfirm` to: hide verification card, add user message "Looks good!", set `autoTriggerConfirmVisible = true`, dispatch `STAGE_CHANGE` to `'profiling'` — do NOT call the API yet
  - [x] 1.3: Add `autoTriggerConfirmVisible && !streamState.isConnected` render block in the message list area: render a bot MessageBubble with the confirmation text and two chips ("Let's go", "Not yet")

- [x] Task 2: Implement "Let's go" handler (AC: 2)
  - [x] 2.1: Add `handleAutoTriggerConfirm` async function: check `ssePhase !== 'streaming'` guard (AC5), call `api.sessions.run(sessionId)` if sessionId is truthy, call `connect(sessionId)` from `useStreamContext`, hide the confirm chips, add user "Let's go" message
  - [x] 2.2: Add `dispatchStream({ type: 'STAGE_CHANGE', payload: 'proposing' })` in the handler to update StageNarrator to PLANNING/proposing stage
  - [x] 2.3: Wire `handleAutoTriggerConfirm` to the "Let's go" chip `onClick`

- [x] Task 3: Implement "Not yet" handler (AC: 3)
  - [x] 3.1: Add `handleAutoTriggerDecline` function: hide confirm chips (`setAutoTriggerConfirmVisible(false)`), add bot message "No problem — just say 'build my trip' whenever you're ready"
  - [x] 3.2: Wire to "Not yet" chip `onClick`

- [x] Task 4: Add "build my trip" intent detection in `handleSend` (AC: 4, 5)
  - [x] 4.1: Add `BUILD_TRIP_PATTERNS` constant to `messageClassifier.ts`: `['build my trip', 'start my trip', 'generate my trip', 'make my trip', 'create my trip', 'let\'s go', 'go ahead', 'start now', 'run it']`
  - [x] 4.2: Export new `classifyBuildTripIntent(text: string): boolean` from `messageClassifier.ts`
  - [x] 4.3: In `handleSend`, after the early-return guards (mood card, etc.), check: if `classifyBuildTripIntent(message)` AND profile is complete AND `ssePhase !== 'streaming'` → call `handleAutoTriggerConfirm()` and return early
  - [x] 4.4: Define `isProfileComplete` helper in `DemoPage`: `slotState.destination && slotState.travel_dates && slotState.budget` (mandatory slots per epics-v2.md)
  - [x] 4.5: Duplicate guard in `handleSend` for already-streaming: if `classifyBuildTripIntent(message)` AND `ssePhase === 'streaming'` → show "Your proposal is already being generated" bot message and return

- [x] Task 5: Wire `connect` from `useStreamContext` into `DemoPage` (AC: 2)
  - [x] 5.1: `DemoPage` currently instantiates its own SSE handling via `useStreamContext` hook — confirm that `connect` is already returned from the hook and accessible
  - [x] 5.2: Ensure `sessionId` is not null before calling `connect`; create a new advisory session via `api.sessions.create()` if `sessionId` is null

- [x] Task 6: Write unit tests for `classifyBuildTripIntent` (AC: 4)
  - [x] 6.1: Add tests to `src/utils/__tests__/messageClassifier.test.ts` covering: exact match "build my trip", case-insensitive, partial sentence "can you build my trip please", negative cases ("tell me about trips", "what's my budget")

- [x] Task 7: Write component tests for auto-trigger flow (AC: 1–5)
  - [x] 7.1: Create `src/__tests__/DemoPage.autoTrigger.test.tsx` with vitest + testing-library
  - [x] 7.2: Test: `handleVerificationConfirm` shows confirmation chips (not in streaming state)
  - [x] 7.3: Test: "Let's go" chip calls `api.sessions.run` and `connect`
  - [x] 7.4: Test: "Not yet" chip shows decline message, no API call
  - [x] 7.5: Test: duplicate guard — when `ssePhase === 'streaming'`, "Let's go" shows already-running message, no second `api.sessions.run` call
  - [x] 7.6: Test: "build my trip" text intent triggers workflow when profile is complete

### Review Findings (AI)

- [x] [Review][Patch] In-flight lock missing — double-tap or chip+handleSend race fires `api.sessions.run` twice before `ssePhase` becomes `streaming` [App.tsx:686]
- [x] [Review][Patch] `connect(sid)` called after `await api.sessions.run(sid)` — server may emit events before client EventSource subscribes, silently dropping early stream messages [App.tsx:700–701]
- [x] [Review][Patch] `STAGE_CHANGE → 'profiling'` dispatched in `handleVerificationConfirm` before user confirms — stage is never reset if user taps "Not yet", leaving StageNarrator in `profiling` with no stream behind it [App.tsx:683]
- [x] [Review][Patch] Double user message in `handleSend` intent path — user message appended by `handleSend`, then `handleAutoTriggerConfirm` also appends "Let's go!" as a second user bubble [App.tsx:378]
- [x] [Review][Patch] Ultra-short patterns in `BUILD_TRIP_PATTERNS` (`'go ahead'`, `'run it'`, `'do it'`, `'ok let'`) match unrelated sentences mid-conversation [messageClassifier.ts:3–11]
- [x] [Review][Patch] No error handling in `handleAutoTriggerConfirm` — `api.sessions.create()` or `api.sessions.run()` rejection leaves `autoTriggerConfirmVisible=false` and stage set to `'proposing'` with no stream, no retry path [App.tsx:686]
- [x] [Review][Defer] Two separate reducer instances (`streamState` from `useReducer` and `sseState` from `useStreamContext`) — guard correctly reads `sseState.ssePhase` but architectural split is fragile [App.tsx:336,349] — deferred, pre-existing architecture
- [x] [Review][Defer] `"let's go"` in `BUILD_TRIP_PATTERNS` matches the chip-injected user bubble `"Let's go!"` — harmless now but a trap if message history is ever replayed through `handleSend` [messageClassifier.ts:27, App.tsx:693] — deferred, future-code risk only
- [x] [Review][Defer] `autoTriggerConfirmVisible` resets to `false` on component unmount/remount (React strict-mode dev double-invoke) while `streamState.status` stays `'profiling'` — stuck confirm state [App.tsx:347] — deferred, dev-only strict-mode scenario

## Dev Notes

### Architecture Overview

This story bridges profile collection (Epic 2 / stories 8.x) and proposal generation (stories 9.1–9.6).
The current `handleVerificationConfirm` (App.tsx:657) directly adds messages and calls `dispatchStream({ type: 'STAGE_CHANGE', payload: 'profiling' })` but does NOT start the advisory workflow. This story converts that point into a confirm-first UX gate.

The key state machine change:
```
Before: verification confirm → messages → STAGE_CHANGE (profiling)
After:  verification confirm → messages → autoTriggerConfirmVisible = true → [chips]
           "Let's go" → api.sessions.run + connect + STAGE_CHANGE (proposing)
           "Not yet"  → bot message, wait for text intent
```

### File Locations

- **`stravel/frontend/src/App.tsx`** — Main DemoPage component. Add state at ~line 344, update `handleVerificationConfirm` at ~line 657, add handlers alongside `handleVerificationEdit`.
- **`stravel/frontend/src/utils/messageClassifier.ts`** — Add `BUILD_TRIP_PATTERNS` and `classifyBuildTripIntent`. Existing `classifyMessage` function pattern: lowercase → array `.some()` check → return type.
- **`stravel/frontend/src/utils/__tests__/messageClassifier.test.ts`** — Existing test file for classifier; add `classifyBuildTripIntent` tests here.
- **`stravel/frontend/src/hooks/useStreamContext.ts`** — `connect(sessionId: string)` is already exported (line 9). `DemoPage` uses `useStreamContext()` at the top of the component.
- **`stravel/frontend/src/services/apiClient.ts`** — `api.sessions.run(id)` already exists (line 46): `POST /advisory_sessions/{id}/run`.

### State and Hook Usage

`DemoPage` already uses `useStreamContext` — verify which fields are destructured from it. Check that `connect` is accessible. The `streamState.ssePhase` is already available from `streamReducer`. The `CONNECTED` action sets `ssePhase: 'streaming'` (streamReducer.ts:40).

`isProfileComplete` should check `streamState.slotState`:
```ts
const isProfileComplete = Boolean(
  streamState.slotState.destination &&
  streamState.slotState.travel_dates &&
  streamState.slotState.budget
);
```

Mandatory slots per epics-v2.md Story 2.10 / verification card: `destination`, `travel_dates`, `budget` (traveler_count is optional).

### Session Creation Guard

`sessionId` may be `null` when the auto-trigger fires (user went straight through card-driven flow without sending a free-text first message that created a demo session). Before calling `api.sessions.run()`, check `sessionId`:
- If null: call `api.sessions.create()` → set `sessionId` state → proceed
- If truthy: proceed directly

`api.sessions.create()` returns `AdvisorySession` with `id` field.

### "Let's go" / "Not yet" Chip Rendering

Render chips as part of the existing `messages` array OR as a separate overlay. Recommended: add chips as a conditional block after the messages list (before the input), similar to how MoodCard and DestinationCard are rendered. Use `data-testid="lets-go-chip"` and `data-testid="not-yet-chip"` for testability.

The confirmation message should be rendered as a `MessageBubble` with `role="assistant"` in the messages array (so it scrolls with the conversation). The chips appear below it while `autoTriggerConfirmVisible === true`.

### Intent Detection Patterns

Keep `classifyBuildTripIntent` intentionally broad — it is only reached after profile is complete, so false positives are low-risk. Patterns to match (case-insensitive, substring):
```ts
const BUILD_TRIP_PATTERNS = [
  'build my trip', 'start my trip', 'generate my trip',
  'make my trip', 'create my trip', "let's go", 'go ahead',
  'start now', 'run it', 'do it', 'yes please', 'ok let',
];
```

### StageNarrator Integration

After `connect(sessionId)`, dispatch `STAGE_CHANGE` to `'proposing'` immediately (optimistic). The SSE `stage.change` event will update it again when the backend confirms. This matches the existing pattern in story 9.4 (propose-first flow) where `StageNarrator` updates to PLANNING as cards begin streaming.

### Test Patterns from Prior Stories

From story 9-6 (CardDeck) learnings:
- Import types via `@/types/domain` alias, not relative paths
- Mock `api` with `vi.mock('../services/apiClient', ...)` or `vi.mock('@/services/apiClient', ...)`
- Use `vi.useFakeTimers()` / `vi.advanceTimersByTime()` in `act()` only where timers are needed
- 610 tests currently passing — must not regress

For `handleSend` tests that involve async API calls, use `vi.fn().mockResolvedValue(...)`.

### Anti-Patterns to Avoid

- **Do NOT** call `api.sessions.run()` twice. The duplicate guard must be checked before every call.
- **Do NOT** remove the STAGE_CHANGE dispatch from `handleVerificationConfirm` — it must still fire to update StageNarrator from idle.
- **Do NOT** add the confirmation chips to the `messages` array as `DemoMessage` objects — they are UI-only and should not be part of message history.
- **Do NOT** re-show the confirmation chips if they've already been dismissed and the user is already in streaming state.

### Project Structure Notes

- Alignment: all new state lives in `DemoPage` function body alongside existing state. No new files needed except the test file and `classifyBuildTripIntent` addition.
- `api.sessions.run()` (apiClient.ts:46) posts to `/advisory_sessions/{id}/run` with an empty body — already implemented in story 9.1.
- The `useStreamContext` hook's `connect` function is idempotent (closes existing EventSource before opening a new one) — safe to call from `handleAutoTriggerConfirm`.

### References

- Epic spec: `_bmad-output/planning-artifacts/epics-v2.md` — Story 3.7 (lines 1002–1029)
- `handleVerificationConfirm` current impl: `stravel/frontend/src/App.tsx:657`
- `handleSend` current impl: `stravel/frontend/src/App.tsx:361`
- `classifyMessage` function: `stravel/frontend/src/utils/messageClassifier.ts:24`
- `api.sessions.run`: `stravel/frontend/src/services/apiClient.ts:46`
- `connect` function: `stravel/frontend/src/hooks/useStreamContext.ts:33`
- `ssePhase` type: `stravel/frontend/src/types/stream.ts:11` — `'idle' | 'streaming' | 'complete' | 'error'`
- `CONNECTED` action → sets `ssePhase: 'streaming'`: `stravel/frontend/src/reducers/streamReducer.ts:40`
- Prior propose-first story for workflow-trigger pattern: `_bmad-output/implementation-artifacts/epic-9/9-4-propose-first-flow.md`
- Prior CardDeck story for test patterns: `_bmad-output/implementation-artifacts/epic-9/9-6-carddeck-state-machine.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `classifyBuildTripIntent` added to `messageClassifier.ts` with `BUILD_TRIP_PATTERNS` constant; intentionally broad (11 patterns) since it only fires post-profile-complete.
- `DemoPage` updated to use `useStreamContext()` for `connect` and `sseState.ssePhase`. The hook's internal state is separate from `streamState` (DemoPage's own reducer), which continues to manage slot state. `sseState.ssePhase` is used for the duplicate guard.
- `handleVerificationConfirm` now sets `autoTriggerConfirmVisible = true` instead of posting "Starting your proposal" — breaks old test expectations on AC3, which were updated.
- Session creation guard: if `sessionId === null` when "Let's go" fires, `api.sessions.create()` is called first (occurs when user completed all card-driven flows without sending a free-text message that would have created a demo session).
- All 8 DemoPage test files updated to mock `classifyBuildTripIntent` and `useStreamContext` since DemoPage now imports both.
- 633 tests total passing (610 baseline + 11 `classifyBuildTripIntent` unit + 12 auto-trigger component).

### File List

- stravel/frontend/src/App.tsx
- stravel/frontend/src/utils/messageClassifier.ts
- stravel/frontend/src/utils/__tests__/messageClassifier.test.ts
- stravel/frontend/src/__tests__/DemoPage.autoTrigger.test.tsx (new)
- stravel/frontend/src/__tests__/DemoPage.verificationCard.test.tsx
- stravel/frontend/src/__tests__/DemoPage.ariaPhase.test.tsx
- stravel/frontend/src/__tests__/DemoPage.budgetCard.test.tsx
- stravel/frontend/src/__tests__/DemoPage.calendarCard.test.tsx
- stravel/frontend/src/__tests__/DemoPage.destinationCard.test.tsx
- stravel/frontend/src/__tests__/DemoPage.moodCard.test.tsx
- stravel/frontend/src/__tests__/DemoPage.multiSelectCard.test.tsx
- stravel/frontend/src/__tests__/DemoPage.passportCard.test.tsx
- stravel/frontend/src/__tests__/DemoPage.verificationCard.passportSelect.test.tsx

## Change Log

- 2026-05-28: Implemented story 9-7 — auto-trigger confirmation flow before advisory workflow start. Added `classifyBuildTripIntent`, updated `handleVerificationConfirm`, added `handleAutoTriggerConfirm`/`handleAutoTriggerDecline`, wired `useStreamContext.connect` into DemoPage. 633 tests passing.
- 2026-05-28: Applied 6 code-review patches — in-flight lock (isConfirmingRef), connect-before-run ordering, removed premature STAGE_CHANGE from handleVerificationConfirm, skipUserBubble param, pruned broad BUILD_TRIP_PATTERNS, try/catch with retry. Added AC4 test and 2 negative classifier tests. 637 tests passing.
