# Deferred Work

## Deferred from: code review of 10-5-staginggate (2026-05-29)

- D1: Stale `session.id` closure if parent swaps `session` prop while modal is open — `handleConfirm` would use the new session's id on next render; complex fix requires snapshotting `session.id` at modal-open time. [`StagingGate.tsx:52`]
- D2: Draft + success banners can coexist during parent update delay — after confirm, `justConfirmed=true` shows success banner while `session.status` is still `pending/modified` until parent propagates `onStatusChange`; timing-dependent. [`StagingGate.tsx:103-133`]
- D3: No persistent confirmed indicator after 3s auto-dismiss — parent's `SessionStatusBadge` handles confirmed state display; StagingGate shows nothing for confirmed sessions per AC6. [`StagingGate.tsx`]
- D4: `prevStatusRef` fragility on remount — if component unmounts/remounts with same session, `prevStatusRef` resets; benign in practice since React preserves component identity when key is stable. [`StagingGate.tsx:19`]
- D5: `role="banner"` ARIA landmark misuse — creates spurious page-level landmark in sub-component; AC1 explicitly prescribes it so fix requires changing story spec. [`StagingGate.tsx:105`]

## Deferred from: code review of 10-4-sessionlist-sessionrow (2026-05-29)

- D1: `filteredSessions` not memoized with `useMemo` — recomputes on every parent render; performance concern for 100+ session lists. [`SessionList.tsx:25-34`]
- D2: `role="option"` wrapped in position:absolute container div — ARIA spec requires direct parent/child listbox/option ownership; wrapper divs technically break the ownership chain. [`SessionList.tsx:104-116`]
- D3: Avatar background has no CSS fallback for unknown status values — renders transparent circle. [`SessionRow.tsx:41-44`]
- D4: Search only checks `destination_preferences[0]` — sessions with multiple destinations only match on the first; multi-destination miss. [`SessionList.tsx:29`]
- D5: `handleSessionSelectFromOverlay` passed to desktop aside — calls `setOverlayOpen(false)` which is always a no-op on desktop; fragile if future code checks overlay state. Pre-existing from D1 of 10-2 review. [`B2BLayout.tsx:29-32`]
- D6: No error boundary around SessionList — a virtualizer or session data error crashes the entire B2BLayout with no recovery. [`B2BLayout.tsx:41-47`]

## Deferred from: code review of 10-3-sessionstatusbadge (2026-05-29)

- D1: `flag_reason.length > 80` strict boundary — exactly-80-char strings are not truncated; AC3 says ">80 chars" so behavior matches spec verbatim, but typical "max 80 chars" UX phrasing implies ≥80 should truncate; minor inconsistency only. [`SessionStatusBadge.tsx:50`]
- D2: Backend `SessionStatus` Python enum still has `.COMPLETED` value — incompatible with frontend `SessionStatus` vocabulary (`pending|confirmed|modified|flagged`) after story 10-1 migration; backend enum cleanup needed. [`backend`]
- D3: `apiClient.ts` constructs session status filter using `"archived"` string — no longer valid with `SessionStatus` vocabulary; filter will always return zero results until updated to valid status values. [`stravel/frontend/src/services/apiClient.ts`]

## Deferred from: code review of 10-2-b2blayout-shell (2026-05-29)

- D1: `handleSessionSelectFromOverlay` used as click handler in desktop panel — calls `setOverlayOpen(false)` unnecessarily (always no-op when no overlay is open); separate into distinct `handleDesktopSelect` and `handleOverlaySelect` handlers for clarity. [`B2BLayout.tsx:26-29`]
- D2: `session-row-{id}` data-testid duplicated in DOM when overlay is open — desktop aside and overlay both render sessionList with the same testids; `screen.getByTestId('session-row-xyz')` will throw "found multiple" in tests that open the overlay. [`B2BLayout.tsx:57`]
- D3: Active border-left mixes Tailwind `border-l-4` utility with inline `borderLeftColor` style — works correctly (inline style wins), but mixing width-utility + inline color is inconsistent with the no-inline-hex convention; consider using only `style={{ borderLeft: '4px solid var(--color-primary)' }}` on the active case. [`B2BLayout.tsx:47-55`]
- D4: `sessions={[]}` hardcoded in App.tsx B2BLayout mount — intentional per story 10-2 spec (unauthenticated demo context); wire up real sessions from API in stories 10-3 or 10-4. [`App.tsx`]
- D5: `AdvisorySession.status` type mismatch — `domain.ts` still types status as `LegacyAdvisoryStatus ("in_progress"|"completed"|"archived")` while B2B CSS vars only cover `pending|confirmed|modified|flagged`; avatar circles will render transparent when sessions carry legacy status strings. Pre-existing from story 10-1 state machine. [`domain.ts`, `B2BLayout.tsx:61`]
- D6: Avatar click opens overlay without pre-highlighting the clicked session — spec-compliant (AC3 says avatar opens overlay; user then selects from the list); consider passing `initialHighlightId` to the overlay for UX improvement in a future polish story. [`B2BLayout.tsx:133`]
- D7: `.theme-b2b` class on layout div (not `:root`) — CSS variables cascade correctly to all current children; if a future portal renders outside the `.theme-b2b` container it will receive `:root` tokens instead of B2B palette. [`B2BLayout.tsx:82`]
- D8: `session.id.slice(0,2)` for avatar initials always yields hex characters (e.g. "A3") — cosmetic in demo context; replace with client name initials when real AdvisorySession data includes a client name field. [`B2BLayout.tsx:64,139`]
- D9: Hardcoded English strings throughout B2BLayout — "Agent Mode", "Chat Mode", "STravel Advisory", "Select a session to begin", "No sessions", "Sessions" — no i18n framework in project; pre-existing pattern. [`B2BLayout.tsx`]

## Deferred from: code review of 10-1-b2b-session-state-machine-api (2026-05-29)

- D1: `SessionResponse` schema does not include `flag_reason` — callers cannot verify persisted flag reason without a separate GET; pre-existing schema design decision. [`schemas/session.py:SessionResponse`]
- D2: Concurrent PATCH race condition — no `SELECT FOR UPDATE` on the session fetch; two simultaneous transitions can both pass the state check and both commit. Pre-existing pattern across all session endpoints. [`sessions.py:update_session_b2b_status`]
- D3: Whitespace-only `flag_reason` (e.g. `"   "`) bypasses the `not body.flag_reason` guard and is stored as a valid compliance annotation. [`sessions.py:~154`, `schemas/session.py:SessionStatusUpdateRequest`]
- D4: Migration `ELSE 'pending'` fallback maps any unrecognised status value silently to `pending` with no error or log. Acceptable migration safety net but masks data anomalies. [`migration:b2b1c3d4e5f6_b2b_session_status.py`]
- D5: `datetime.now(timezone.utc)` in pre-existing `update_session` vs `datetime.utcnow()` (project convention) — inconsistency introduced in a prior uncommitted change, not this story. [`sessions.py:update_session`]

## Deferred from: code review of 9-10-compliance-inline-badges (2026-05-28)

- D1: Duplicate `AssumedBadge` on both `departDate`/`returnDate` when `travel_dates` assumed — user sees "(assumed)" twice, implying two slots. [`TravelCard.tsx`]
- D2: `ShimmerField shimmerEnabled={false}` renders decorative blank bar with no accessible label in BookingFields non-committing branch. [`TravelCard.tsx`]
- D3: `cardDisplayState` `forming` state not gated on `isFinal` — a final card with score 0.25–0.74 stays in `forming` indefinitely with no recovery path. [`TravelCard.tsx:cardDisplayState`]
- D4: Tests use `fireEvent` not `userEvent` throughout suite — masks real pointer/focus/keyboard interaction semantics in accessibility-sensitive code. All test files.
- D5: ComplianceFields advisories toggle button missing `aria-expanded` attribute — screen readers do not get disclosure widget state. [`TravelCard.tsx:ComplianceFields`]
- D6: `expanded` state in ComplianceFields persists across settled→forming→settled transitions — advisories auto-expand on re-settle without user action. [`TravelCard.tsx:ComplianceFields`]
- D7: `completenessScore > 1` produces ">100% complete" in aria-label — no clamping at system boundary. [`TravelCard.tsx:cardDisplayState`]
- D8: AC5 — `aria-disabled` "compliance" title shown during authorship-pending — when `authorshipPending=true` + deckState=committing, booking CTA shows "Resolve compliance issues before booking" even though authorship is the blocker. Authorship panel visually covers the card so practically invisible; not worth threading `hasComplianceBlock` into BookingFields. [`TravelCard.tsx:BookingFields`, `CardDeck.tsx:bookingCTAActive`]

## Deferred from: code review of 9-9-inline-card-editing (2026-05-28)

- D1: Stale Escape key useEffect closure comment — comment in the `[cardEditMode]` useEffect says `handleCancelCardEdit` is "stable (defined at component scope)" but it is not wrapped in `useCallback`; functionally safe because it only calls stable state setters and refs, but misleads future readers. [`App.tsx:411`]

## Deferred from: code review of 9-8-progressive-proposal-streaming (2026-05-28)

- D1: Settle-timer race in CardDeck — when `allSettled` flips true→false within 500ms, previously-scheduled `committing` transition may fire before cleanup runs. Pre-existing from story 9-6 CardDeck implementation. [`CardDeck.tsx:48`]
- D2: `handleAuthorshipSave` fire-and-forget — `api.userPreferences.saveTripName` rejection is silently swallowed; trip name lost with no user feedback or retry path. Pre-existing from story 9-6. [`CardDeck.tsx:94`]
- D3: `realCardsByType` deduplication by type — if backend emits two cards of the same `type` with distinct `card_id`s, only the last survives; first is silently dropped. Design decision: one-card-per-type architecture per spec. [`App.tsx:397`]
- D4: Five concurrent stall timers on placeholder cards — all 5 placeholders start the 90s stall timer at mount; slow backend causes all 5 to simultaneously show "Try again", triggering multiple `connect()` calls in rapid succession. Pre-existing TravelCard behavior from story 9-6. [`TravelCard.tsx:~372`]

## Deferred from: code review of 9-7-auto-trigger-analysis (2026-05-28)

- D1: Two separate reducer instances — `streamState` (DemoPage `useReducer`) and `sseState` (`useStreamContext`) are independent; guard correctly uses `sseState.ssePhase` but the architectural split is fragile for future readers. [`App.tsx:336,349`]
- D2: `"let's go"` in `BUILD_TRIP_PATTERNS` exactly matches the chip-injected user bubble `"Let's go!"` — harmless in current code (messages are never re-fed through `handleSend`) but a latent trap if message-history replay is ever added. [`messageClassifier.ts:27`, `App.tsx:693`]
- D3: `autoTriggerConfirmVisible` resets to `false` on component remount (React strict-mode dev double-invoke) while `streamState.status` stays `'profiling'` — stuck confirm prompt in strict-mode dev. Not a production issue. [`App.tsx:347`]

## Deferred from: code review of 9-6-carddeck-state-machine (2026-05-27)

- W1: Compliance block (`hasComplianceBlock`) missing `aria-disabled` on CTA wrapper and `title` on container — story 3.10 prep; functional blocking is in place via `onBook=undefined`. [`CardDeck.tsx`]
- W2: `assumedSlots as SlotKey[]` unsafe type cast — pre-existing from prior stories; valid SlotKey values enforced at data source. [`CardDeck.tsx:97`]
- W3: Shimmer gating order-dependent on `cards` array iteration order — acceptable for MVP; order matches SSE insertion order in practice. [`CardDeck.tsx:68-75`]
- W4: Test boundary: `booking-cta` asserted through TravelCard child — acceptable integration test; will break if TravelCard changes its `data-testid`. [`CardDeck.test.tsx`]
- W5: `allSettled` threshold `0.75` magic number — matches UX-DR13 spec value; extract to named constant in a cleanup story. [`CardDeck.tsx:39`]

## Deferred from: code review of 9-5-proposal-card-types (2026-05-27)

- F3: Stall timer in `TravelCard` resets on every `isFinal` heartbeat — card that receives periodic `isFinal=false` pings never enters error state regardless of elapsed time; also `isStalled` never cleared if `isFinal` flips without a score change. Pre-existing from story 7-3. [`TravelCard.tsx`, stall-detection `useEffect`]
- F4: `cardDisplayState` returns `'forming'` when `isFinal=true` and score is 0.25–0.74 — intentional race-condition guard (score may arrive before `isFinal`), but means server-final cards at 60% completeness never settle. Pre-existing behavior, covered by existing tests. [`cardUtils.ts`]
- F5: `SessionStatus` rename to `"pending"|"confirmed"|"modified"|"flagged"` leaves `session.status !== "archived"` guard in `SessionList.tsx:28` always `true` — Archive button renders on every session. Pre-existing from story 8-1. [`SessionList.tsx:28`]
- F6: Backend integration tests assert old `SessionStatus` string values (`"in_progress"`, `"completed"`) and Alembic migration lacks new ENUM values — will fail if backend is updated to the new vocabulary. Pre-existing from story 8-1. [`backend/tests/test_sessions.py`, `alembic/versions/`]

## Deferred from: code review of 9-3-durable-session-state (2026-05-26)

- W1: `asyncio.create_task(run_advisory_workflow)` in `run_session` not tracked in `_pending_tasks` — GC can discard mid-execution on CPython; pre-existing from story 9-1. [`sessions.py`]
- W2: `result.scalars().first()` discard pattern (no variable assignment) in `update_profile` — fragile, easy to reuse exhausted iterator on refactor; pre-existing. [`sessions.py`]
- W3: No warning logged when TravelerProfile is missing before `run_session` fires workflow with empty profile dict — pre-existing. [`sessions.py`]
- W4: `get_events` endpoint uses two independent DB sessions (injected for ownership check, `async_session_factory` for event fetch) — concurrent `clear_session_buffer` can delete events in the window between the two; returns 200+[] silently. Low probability. [`sessions.py`, `event_persistence.py`]
- W5: `SessionEvent` objects returned by `get_session_events()` are detached after the context manager exits — accessing lazy-loaded relationships would raise `DetachedInstanceError`; safe now (no relationships defined), fragile on schema evolution. [`event_persistence.py`]

## Deferred from: code review of 9-2-redis-event-buffer (2026-05-26)

- TTL-expired Redis buffer falls back to in-memory replay (AC3 violation) — 2h TTL expiry while process is running with live in-memory buffer is near-impossible in production; address with `_redis_available` flag in a reliability hardening story. [`event_bus.py, subscribe()`]
- Counter/buffer deletion race while `publish_event` in-flight — prevented in practice by single-workflow-per-session state machine (story 9-1 ARCH-1); session state machine concern. [`event_bus.py`]
- `buf.pop(0)` O(N) in `publish_event` — pre-existing from story 9-1, not introduced by 9-2. [`event_bus.py:31`]
- `gap_events` second read of `_event_buffer` after Redis await could see evicted entries — near-impossible in practice (would require 200+ events published during a sub-millisecond Redis await). [`event_bus.py, subscribe()`]

## Deferred from: code review of 9-1-decouple-sse-generation (2026-05-26)

- D1: Module-level state (_subscribers/_event_buffer/_session_counters) concurrent access — asyncio single-thread mitigates most races but subscribe/publish reconnect gap is real; story 9-2 Redis pub/sub will resolve. [`event_bus.py`]
- D2: Buffer eviction O(N) buf.pop(0) and silent gap when overflow exceeds _MAX_BUFFER=200 — story 9-2 Redis scope. [`event_bus.py:27`]
- D3: Reconnect race — new subscriber appended to _subscribers AFTER buffer replay, may miss event published in that window — story 9-2 scope. [`event_bus.py:40`]
- D4: Fire-and-forget asyncio.create_task handle discarded immediately — no shutdown registry to cancel pending tasks on graceful exit; deliberate ARCH-1 pattern, separate infrastructure story. [`sessions.py:183`]
- D5: Workflow DB write uses separate async_session_factory session with no log when advisory_session not found — pre-existing architectural pattern in background task. [`workflow.py:205`]
- D6: Concurrent run_session calls for same session_id reset sse_id counter mid-stream — session state machine should prevent duplicate runs; higher-level concern. [`sessions.py:183`]
- D7: get_tenant_id_for_stream Bearer prefix check is case-sensitive (auth.startswith('Bearer ')) — RFC 7235 scheme matching; standard behavior for this API's clients. [`streaming.py:28`]

## Deferred from: code review of 8-7-multi-select-cards (2026-05-26)

- W1: `handleActivitySurprise` not wired in App.tsx — AC5 activity-card integration deferred to the activity card story; component onSurprise support is present. [`App.tsx`]
- W2: `no_restrictions` hardcoded magic string in 3 places in MultiSelectCard — export `NO_RESTRICTIONS_VALUE` constant when component stabilises. [`MultiSelectCard.tsx`]
- W3: `aria-label` on `role="group"` duplicates visible `<p>` prompt — SR users hear prompt twice; refactor to `aria-labelledby` + `useId()` pattern (matches SlotFillingCard) in accessibility story. [`MultiSelectCard.tsx:59`]
- W4: Calendar test helpers use hardcoded array indices `[5]`/`[12]` — real-date sensitive; migrate to aria-label date queries in a test-quality story. [`DemoPage.multiSelectCard.test.tsx:51-56`]
- W5: `SLOT_UPDATE` action type uses single quotes; rest of `stream.ts` uses double quotes — style inconsistency; fix in a lint-pass story. [`stream.ts`]
- W6: `slotState` widened to `string | string[]` — downstream consumers reading a key expecting `string` may now receive `string[]`; audit read sites before adding more array slots. [`stream.ts`, `streamReducer.ts`]

## Deferred from: code review of 8-8-passport-ocr-backend (2026-05-26)

- W1: No authentication on passport endpoint — spec-intentional per dev notes; passport images are sensitive PII; reconsider auth before production. [`passport.py`]
- W2: MIME type validated via client-supplied `Content-Type` header, not magic bytes — attacker can upload any file with `Content-Type: image/jpeg` and bypass format guard. Beyond spec scope. [`passport.py:29`]
- W3: No rate limiting on GPU-intensive OCR endpoint — a single unauthenticated client can saturate the Ollama service. Not in spec scope. [`passport.py`]
- W4: `_parse_date` returns past expiry dates with `confidence=0.9` — expired passports get `fallback_required=False`; downstream compliance checker handles validation. Not a spec requirement. [`ocr.py:78`]
- W5: Timeout test does not exercise actual `asyncio.wait_for` wall-clock timeout — mock raises `TimeoutError` immediately; the 15-second `_OCR_TIMEOUT` constant is effectively untested. [`test_passport_ocr.py:155-169`]
- W6: No `ocr.complete` log on timeout path — AC2 logs required "when processing is complete"; timeout = incomplete. Borderline compliance. [`passport.py:37-38`]

## Deferred from: code review of 8-6-budget-slider-card (2026-05-26)

- W1: `navigateToBudgetCard` test helper uses hardcoded calendar array indices [5]/[12] — real-date-sensitive; on certain month layouts the selected dates may produce a wrong range. Use explicit aria-label date selection instead. [`DemoPage.budgetCard.test.tsx:47-54`]
- W2: `BudgetSliderCard` always mounts at default $2,500, ignoring prior `slotState.budget` — if the card is re-shown, user's prior adjustment is lost. Pass `defaultValue={streamState.slotState.budget}` from App.tsx to fix. [`App.tsx`]
- W3: Integration test navigation helpers rely on click+Enter double-dispatch to bypass SlotFillingCard's 300 ms timer under `vi.useFakeTimers()` — fragile if card implementation changes. Add `vi.advanceTimersByTime(300)` between nav steps as a safer pattern. [`DemoPage.budgetCard.test.tsx`]

## Deferred from: code review of 8-4-destination-cards (2026-05-26)

- D1: `handleSend` does not reset `destinationCardVisible` when user sends free-text while destination card is showing — destination card persists alongside the sent message. The equivalent 8.3 AC3 covered mood card dismiss-on-free-text; destination card needs the same treatment as a future AC (e.g. in story 8.5 or a dedicated cleanup story). [`App.tsx:handleSend`]

## Deferred from: code review of 8-3-mood-first-entry (2026-05-26)

- D1: `'visit'` destination verb too broad — "visiting family" → `specific`; false-specific low-harm in travel context. [`messageClassifier.ts:9`]
- D2: `'hue'` city name substring matches color word "hue" — acceptable in Vietnam travel context where "hue" nearly always means the city. [`messageClassifier.ts:5`]
- D3: `'budget'` matches non-travel budget mentions — acceptable over-eager detection; specific is less harmful than ambiguous. [`messageClassifier.ts:13`]
- D4: Abbreviated month forms miss end-of-sentence (e.g. `"Jun."`) — full month names cover the common case. [`messageClassifier.ts:18`]
- D5: `firstMessageSent` not reset on session change — Story 8.4 will handle session lifecycle. [`App.tsx`]
- D6: After mood selection, no API call fires — "let me suggest…" cosmetic until Story 8.4 wires mood to backend. Intentional by story 8.3 design. [`App.tsx`]
- D7: `_streamState` explicitly unused — intentional underscore prefix; Story 8.4 will consume slot state. [`App.tsx`]
- D8: Initial greeting contradicts mood-first UX — "Where are you dreaming of going?" steers users toward specific messages; updating greeting is a UX design decision for a future story. [`App.tsx`]
- D9: AC3 `slotState.mood` negative assertion not directly testable — behavior implicitly verified via message content assertions in existing AC3 test. [`DemoPage.moodCard.test.tsx`]

## Deferred from: code review of 8-2-slotfillingcard-base (2026-05-26)

- D1: Arrow key navigation missing in radiogroup — ARIA APG best practice (roving tabIndex + ArrowUp/Down); Tab+Enter satisfies WCAG SC 2.1.1 so not a current AA violation. [`SlotFillingCard.tsx`]
- D2: Stale closure in `scheduleAdvance` — `onSelect` captured at render time; 300ms timer may call stale callback if parent changes reference within the window. Parent should use `useCallback`. [`SlotFillingCard.tsx:58-62`]
- D3: `onSurprise` silent no-op when `surprise_me` option present but prop not passed — interface contract; caller responsibility. [`SlotFillingCard.tsx:71`]
- D4: `freeTextMode` one-way — no path back to chip mode after Escape. AC4 doesn't require it; design decision for future story. [`SlotFillingCard.tsx`]
- D5: `freeTextValue` not reset on `slotKey` prop change — parent should `key` the component to reset state on slot change. [`SlotFillingCard.tsx`]
- D6: Empty `options` array has no guard — renders empty radiogroup; defensive programming out of story scope. [`SlotFillingCard.tsx`]

## Deferred from: code review of 8-1-mood-transition-user-prefs-session-status (2026-05-26)

- D1: `updated_at` no `onupdate=` trigger — only populated at INSERT, never refreshes on UPDATE; requires application-level pattern or server-side trigger. [`user_preferences.py:19`]
- D2: No `ON DELETE CASCADE` on `user_id` FK — orphaned `user_preferences` rows if a `tenant_user` is deleted. Schema design concern out of story scope. [`a1b2c3d4e5f6_add_user_preferences.py`]
- D3: Alembic revision ID `a1b2c3d4e5f6` is a human-invented placeholder — not a valid hex string; Alembic migration chain integrity risk. Alembic CLI not available in dev env. [`a1b2c3d4e5f6_add_user_preferences.py`]

## Deferred from: code review of 7-7-aria-live-state-machine (2026-05-26)

- D1: Rapid-resend sentinel clearing — `setSentinelText("")` at start of `handleSend` clears before AT finishes reading previous announcement; use counter-based text ("Message received. (N)") or introduce a brief delay before clearing. [`App.tsx`]
- D2: `role="log"` + explicit `aria-live` override — some AT+browser combinations (older NVDA+Firefox, VoiceOver+Safari) may not honour the explicit `aria-live="off"` override and keep announcing during streaming. Pre-existing architecture decision; revisit if AT testing reveals real user impact. [`ConversationCanvas.tsx`]
- D3: Sentinel `position:absolute` without `position:relative` parent — sentinel may anchor to viewport root rather than B2CLayout container; add `position:relative` to the layout wrapper when refactoring B2CLayout. [`App.tsx`]
- D4: Identical repeated error text not re-announced by AT — consecutive errors with identical "Something went wrong." text produce no DOM mutation and are silently dropped by AT. Add counter suffix or alternate phrasing in cleanup story. [`App.tsx`]
- D5: `aria-live="off"` + `aria-relevant="additions"` on ConversationCanvas in the same render — ARIA spec leaves `aria-relevant` behaviour undefined when `aria-live="off"`; conditionally omit `aria-relevant` when passing `ariaLive="off"`. [`ConversationCanvas.tsx`]

## Deferred from: code review of 7-1-design-tokens-layout-shell (2026-05-26)

- F1: 44+ hardcoded hex values in legacy B2B components (`App.tsx`, `SessionList.tsx`, `SessionPanel.tsx`, `CopilotSidebar.tsx`) — migrate to token classes when those components are refactored in Epics 7–10.
- F2: No TypeScript safety rules active in ESLint (`@typescript-eslint` installed but no rules enabled) — add `recommended` ruleset in a dedicated tech-debt story.
- F3: `eslint-plugin-react-hooks` not installed — rules-of-hooks and exhaustive-deps violations go undetected. Add to ESLint config.
- F4: `colors['text-base']` naming ambiguity with Tailwind's built-in `text-base` font-size — consider renaming to `text-default` or similar.
- F5: `timeout:0` / `proxyTimeout:0` disables all dev-server proxy timeouts — acceptable for SSE but masks backend hangs. Revisit if dev experience degrades.
- F6: `B2CLayout` wraps `DemoLayout` — Story 7.2 will replace `DemoPage` with ConversationCanvas-based layout; remove the double-wrap then.
- F7: `.theme-b2c` block duplicates `:root` — defensive isolation; revisit if dark-mode or multi-theme story is planned.
- F8: `.pb-safe` utility defined but not applied — ChatInput's safe-area padding is Story 7.2 responsibility.
- F9: `lint` script missing `--max-warnings 0` — tighten CI lint gate before release.
- F10: `prefers-reduced-motion` block missing `scroll-behavior: auto !important` — minor accessibility gap.
- F11: `react-markdown` in production `dependencies` — confirm usage in ChatInterface; move to deps or remove if unused.
- F12: `animation-iteration-count: 1 !important` under `prefers-reduced-motion` leaves typing dots at intermediate scale — rename keyframe and set `0%` / `100%` to `scale(0)` as final state fix.

## Deferred from: code review of 7-4-sse-heartbeat-is-final (2026-05-26)

- R1: Replay buffer does not honour `Last-Event-ID` header — clients that reconnect always receive the full buffer from position 0 regardless of what they already received; deferred to Story 9-2 (Redis event buffer). [`event_bus.py`]
- R2: `cleanup_session` and `clear_session_buffer` have ambiguous dual-ownership of `_event_buffer` — calling one without the other leaves dangling state; document ownership contract (or merge into `cleanup_session`) in a follow-up. [`event_bus.py`]
- R3: `UseStreamContextReturn` does not expose `ssePhase` as a top-level field — Dev Notes explicitly decided `state.ssePhase` is sufficient; revisit in Story 7.7 when consumers of `ssePhase` appear. [`useStreamContext.ts`]
- R4: `set_tenant_id` called in dependency function rather than inside the SSE generator — works correctly because FastAPI propagates contextvars to async generators; document this assumption or move into the generator if context behaviour ever changes. [`streaming.py`]
- R5: `_event_buffer` trimmed via `list.pop(0)` (O(n)) — for max-200 buffer this is negligible; upgrade to `collections.deque(maxlen=200)` in a cleanup story. [`event_bus.py`]
- R6: `request.is_disconnected()` call in SSE generator not wrapped in exception handler — pre-existing pattern; wrap in try/except if platform upgrade changes `is_disconnected` semantics. [`streaming.py`]

## Deferred from: code review of 7-6-stagenarrator-progress-bar (2026-05-26)

- D1: `scrollIntoView` conflict between `messagesEndRef` and `handleStageScroll` — when a user navigates to a past stage, the next incoming SSE message fires `useEffect` and immediately re-scrolls to the bottom, overriding user navigation intent. Requires a "userIsScrollingBack" guard. Deferred — UX design decision beyond story scope. [`CopilotSidebar.tsx`]
- D2: Stale narrator text during rapid stage transitions — the 400ms debounce cancels all intermediate stage announcements; screen reader users receive no feedback when multiple stage changes occur within the debounce window. Inherent tradeoff of the 400ms design specified in Story 7.4. [`StageNarrator.tsx`]

## Deferred from: code review of 7-5-bot-greeting-messagebubble (2026-05-26)

- W1: `ChatInterface` `Message.role` type does not include `"stage-narrator"` — DemoPage no longer uses ChatInterface directly, so low current impact; update if ChatInterface is ever re-wired for stage-narrator messages. [`src/components/b2c/ChatInterface.tsx:6`]
- W2: `DemoGreeting.test.tsx` missing `vi.resetModules()` between test cases — dynamic `await import('../../../App')` may return cached module state when mutation tests are added later. [`src/components/shared/__tests__/DemoGreeting.test.tsx`]

## Deferred from: code review of 7-2-conversationcanvas-fixed-layout (2026-05-26)

- F1: `useFooterHeight` skips null refs at mount — if a ref's `.current` is null when `useEffect` fires, that element is never added to the ResizeObserver. Works for current DemoPage (all refs always rendered), but will silently fail with conditional rendering. Fix: re-observe on ref change, or check/re-attach in the measure callback. [`src/hooks/useFooterHeight.ts`]
- F2: `DemoPage.handleSend` does not check `response.ok` — HTTP 4xx/5xx from the demo API resolves without throwing; `chatData.reply` becomes undefined and an empty assistant bubble is pushed. Add `if (!resp.ok) throw new Error(...)` guard and an error state in DemoPage. [`App.tsx`]
- F3: `SessionListPage.useEffect` has no `.catch()` — network failure leaves the component in a permanent "Loading…" spinner with no retry path. Add `.catch((err) => { setError(err); setLoading(false); })`. [`App.tsx`]
- F4: `handleCreate` (SessionListPage) and `handleRun` (CopilotPage) swallow errors silently — add try/catch and surface error state to the user. [`App.tsx`]
- F5: `AuthGuard` multi-instance token divergence — two independent `AuthGuard` instances (for `/sessions` and `/sessions/:id`) each hold their own `useState` token; logout in one does not cascade to the other's in-memory state, and multi-tab sessions diverge. Consider a shared context or token-expiry interceptor in `apiClient`. [`App.tsx`]
- F6: `LoginPage` form inputs not associated with labels — no `htmlFor`/`id` pairing; screen readers cannot programmatically link label to control. WCAG 1.3.1. [`App.tsx`]
- F7: `ChatInput` `<input>` has no accessible label — relies solely on `placeholder` which is not an accessible name substitute. Add `aria-label="Message"` or wrap in `<label>`. WCAG 1.3.1. [`src/components/layout/ChatInput.tsx`]
- F8: `CopilotPage.useEffect` includes `connect` in deps — if `connect` from `useStreamContext` is not memoized, the effect re-runs on every render, re-fetching the session and re-connecting the SSE stream. Verify `connect` is stable or wrap in `useCallback`. [`App.tsx`]
- F9: `MessageBubble key={i}` uses array index — if messages are ever prepended, inserted, or removed (e.g. optimistic rollback), React will incorrectly reuse DOM nodes. Use a stable message ID. [`App.tsx`]

## Deferred from: code review of story-1.1 (2026-05-24)

- Unvalidated request_id from header — log injection risk [backend/app/core/middleware.py]
- Production Dockerfile installs dev dependencies — multi-stage build needed [backend/Dockerfile]
- Database engine created at import time — crashes on missing env vars [backend/app/core/database.py]
- AdvisoryState uses bare dict fields — should be typed Pydantic models when Story 1.2 defines them [backend/app/agents/state.py]
- VectorStoreProtocol.search returns list[dict] — should return typed Entity when Epic 2 defines it [backend/app/agents/protocols.py]
- Health endpoint checks no dependencies — add readiness probe when DB models exist [backend/app/api/v1/health.py]
- Test suite has no env isolation before import — add test Settings override [backend/tests/conftest.py]

## Deferred from: code review of 8-9-passport-upload-card (2026-05-26)

- D1: `formatDateForDisplay` duplicated verbatim in `App.tsx` and `PassportUploadCard.tsx` — extract to a shared utility to prevent future divergence. [`App.tsx`, `PassportUploadCard.tsx`]
- D2: No client-side file size or MIME-type validation before POSTing to OCR endpoint — oversized files or wrong types will fail server-side; client-side early rejection would improve UX. [`PassportUploadCard.tsx:handleFileUpload`]
- D3: No "start over" / re-upload escape from the `confirm` state — user can press "No" to reach manual input but cannot restart the photo upload from confirm. Consider adding a "Try again" option. [`PassportUploadCard.tsx`]

## Deferred from: code review of 8-10-zero-typing-verification (2026-05-26)

- D1: No user bubble for passport Skip in normal (non-edit) flow — UX consistency; spec does not require it. [`App.tsx:603-608`]
- D2: "Starting your proposal…" hardcoded message with no backend call in demo mode — SSE/advisory integration is Epic 9 scope. [`App.tsx:657-664`]
- D3: `new Date(s + 'T00:00')` format missing seconds/timezone — DST edge case in date display; pre-existing pattern used elsewhere. [`App.tsx:622-625`]
- D4: `ProfileVerificationCard` container has no `role="region"` or `aria-label` — screen reader region labelling enhancement beyond current AC7 spec. [`ProfileVerificationCard.tsx:23`]
- D5: `handleVerificationConfirm` does not reset `editingSlot` — defensive fix; state is null in normal flow. [`App.tsx:656`]
- D6: `key={item.label}` on list items — duplicate key risk if two items share a label; labels are unique from `computeVerificationItems`. [`ProfileVerificationCard.tsx:32`]
- D7: `slotKey="mood"` on edit menu `SlotFillingCard` — Escape-to-freetext path could leave `editingSlot` stuck with invalid value; address in Epic 9 edit flow refactor. [`App.tsx:791`]
