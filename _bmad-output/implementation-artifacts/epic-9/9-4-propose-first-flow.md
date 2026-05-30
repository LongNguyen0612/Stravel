# Story 9.4: Propose-First Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a traveler who mentions a destination in my first message,
I want the AI to immediately start building my trip proposal with sensible defaults rather than asking profiling questions,
so that I see a proposal within seconds instead of going through a Q&A funnel.

## Acceptance Criteria

**AC1 — Intent detection on first message**
Given the user sends their first message to a session (no prior messages)
When the message contains a destination (city name, country, or "surprise me")
Then the frontend calls `POST /api/v1/advisory_sessions/{session_id}/propose-first` with `{ "message": "<user text>" }`
And the endpoint responds with `{ "bot_message": str, "extracted_slots": dict, "assumed_slots": list[str], "is_surprise_me": bool }`

**AC2 — Default slot filling**
Given a propose-first call where the user has NOT specified certain profile fields
When the backend builds the TravelerProfile for the advisory workflow
Then any unspecified slots are filled with documented defaults:
- `traveler_count = 2`
- `budget_total = 2500.0`, `budget_currency = "USD"`
- `accommodation_style = "mid-range"`
- `activity_preferences = ["sightseeing", "local food"]`
- `duration = 7` days (when not specified)
- `travel_start_date = today + 30 days`
And the response's `assumed_slots` list names every slot that was defaulted

**AC3 — Workflow triggered immediately**
Given the TravelerProfile is patched with extracted + default values
When `propose-first` endpoint completes
Then `run_advisory_workflow` is fired as `asyncio.create_task` (non-blocking)
And the HTTP response is returned to the client before the workflow completes
And the existing SSE stream endpoint continues to deliver events as cards stream in

**AC4 — Surprise me mode**
Given the user's first message contains "surprise me" (case-insensitive) with no explicit destination
When the endpoint handles the request
Then `destination` is selected randomly from the `VIETNAM_CITIES` constant list
And `duration` is selected randomly from `[5, 7, 10]`
And `is_surprise_me = true` in the response
And all other slots are set to defaults per AC2

**AC5 — Assumed slot badges on TravelCard**
Given the frontend receives a propose-first response with `assumed_slots`
When TravelCard renders a field whose slot key is in `assumedSlots`
Then an amber `(assumed)` badge is rendered inline next to that field value
And tapping the badge dispatches `OPEN_SLOT_CARD` with the slot key, opening the SlotFillingCard for that slot
And once the user submits the SlotFillingCard, the badge is removed for that slot

**AC5a — No profiling Q&A loop**
Given propose-first is triggered
When the workflow starts
Then the bot does NOT emit `agent.profiling.question` events for assumed slots
(The profiling agent sees a fully-populated profile and proceeds to calculation/proposal)

---

## Tasks / Subtasks

- [x] Task 1: Backend — `propose_first.py` service module (AC1, AC2, AC4)
  - [x] 1.1 Create `stravel/backend/app/services/propose_first.py`
  - [x] 1.2 Define `VIETNAM_CITIES` constant (20+ cities/destinations)
  - [x] 1.3 Implement `detect_intent(message: str) -> dict` — regex-based extraction of destination, duration, surprise-me flag; return `{"destination": str|None, "duration_days": int|None, "is_surprise_me": bool}`
  - [x] 1.4 Implement `build_profile_with_defaults(session_id: str, extracted: dict, db: AsyncSession) -> tuple[dict, list[str]]` — fetch existing TravelerProfile, apply extracted fields, fill unset fields with documented defaults, return `(profile_patch, assumed_slot_keys)`
  - [x] 1.5 Write unit tests in `tests/test_propose_first.py` covering: Vietnam city detection, duration extraction ("for a week" → 7, "3 nights" → 3, "10 days" → 10), surprise-me selection from VIETNAM_CITIES, assumed-slots list accuracy

- [x] Task 2: Backend — propose-first endpoint (AC1, AC3)
  - [x] 2.1 Add `ProposeFirstRequest` Pydantic model: `{ message: str }`
  - [x] 2.2 Add `ProposeFirstResponse` Pydantic model: `{ bot_message: str, extracted_slots: dict, assumed_slots: list[str], is_surprise_me: bool }`
  - [x] 2.3 Add `POST /{session_id}/propose-first` route to `app/api/v1/sessions.py` — call `detect_intent`, `build_profile_with_defaults`, PATCH TravelerProfile, `asyncio.create_task(run_advisory_workflow(...))`, return response
  - [x] 2.4 Add route to `app/api/v1/router.py` if not already included via sessions router
  - [x] 2.5 Write integration test in `tests/test_propose_first.py`: POST to endpoint returns 200 with valid response shape; TravelerProfile patched in DB; workflow task created (mock `run_advisory_workflow`)

- [x] Task 3: Frontend — type definitions and reducer (AC5)
  - [x] 3.1 Add `assumedSlots: string[]` to `StreamState` in `src/types/stream.ts`
  - [x] 3.2 Add `SET_ASSUMED_SLOTS` action `{ type: "SET_ASSUMED_SLOTS"; payload: string[] }` to `StreamAction` union in `src/types/stream.ts`
  - [x] 3.3 Add `ProposeFirstResponse` interface to `src/types/domain.ts`: `{ bot_message: string; extracted_slots: Record<string, unknown>; assumed_slots: string[]; is_surprise_me: boolean }`
  - [x] 3.4 Handle `SET_ASSUMED_SLOTS` in `src/reducers/streamReducer.ts` — set `state.assumedSlots = action.payload`
  - [x] 3.5 Add `assumedSlots: []` to `initialStreamState`
  - [x] 3.6 Write unit tests in `src/__tests__/streamReducer.proposeFirst.test.ts` for `SET_ASSUMED_SLOTS` action

- [x] Task 4: Frontend — API client and hook (AC1, AC3)
  - [x] 4.1 Add `sessions.proposeFirst(id: string, message: string): Promise<ProposeFirstResponse>` to `src/services/apiClient.ts`
  - [x] 4.2 Add `proposeFirst(sessionId: string, message: string): Promise<void>` to `UseStreamContextReturn` interface in `src/hooks/useStreamContext.ts`
  - [x] 4.3 Implement `proposeFirst` in `useStreamContext`: call `api.sessions.proposeFirst`, dispatch `SET_ASSUMED_SLOTS` with response `assumed_slots`, dispatch `AGENT_MESSAGE` with `bot_message` as `type: "question"`, call `connect(sessionId)` to start SSE stream

- [x] Task 5: Frontend — intent detection and ChatInterface wiring (AC1)
  - [x] 5.1 Add `isFirstMessage` guard in `src/components/b2c/ChatInterface.tsx` — track whether any message has been sent for this session; on first send, call `proposeFirst` if destination intent detected, else call existing `onSendMessage`
  - [x] 5.2 Add `classifyFirstMessage(text: string): boolean` helper (same detection logic as backend: Vietnam cities + generic destination phrases + "surprise me") — avoids round-trip for non-destination first messages
  - [x] 5.3 Export `VIETNAM_CITIES_FRONTEND` constant (mirrors backend list) from `src/constants/destinations.ts` (new file)

- [x] Task 6: Frontend — TravelCard assumed badge (AC5)
  - [x] 6.1 Add `assumedSlots?: SlotKey[]` prop and `onAssumedBadgeTap?: (slotKey: SlotKey) => void` to `TravelCard` in `src/components/cards/TravelCard.tsx`
  - [x] 6.2 Define slot→field mapping: `travel_dates` → FlightFields depart/return dates, `traveler_count` → passenger count, `budget` → budget display, `accommodation_style` → HotelFields style label, `activities` → ActivityFields categories
  - [x] 6.3 Render amber `(assumed)` badge (Tailwind: `text-amber-600 text-xs cursor-pointer underline`) next to each field whose slot key is in `assumedSlots`
  - [x] 6.4 Write Vitest unit tests: TravelCard renders assumed badge for each expected slot key; badge tap fires `onAssumedBadgeTap` with correct SlotKey

- [x] Task 7: End-to-end validation (all ACs)
  - [x] 7.1 Run full frontend test suite (`npm test`): no regressions, new tests pass
  - [x] 7.2 Run backend tests (`pytest tests/`): `test_propose_first.py` green
  - [x] 7.3 Manually verify golden path: open new session → type "I want to visit Hanoi" → bot responds with commitment message → SSE streams cards → assumed badges appear on travel_dates and traveler_count fields
  - [x] 7.4 Manually verify surprise-me path: "surprise me with a trip" → random Vietnam city selected → `is_surprise_me: true` in console

---

## Dev Notes

### Architecture Overview

This story adds a **fast-path** for sessions where the user's first message contains enough intent to start the advisory workflow immediately. The profiling Q&A loop (story 8-3 through 8-9) is bypassed; assumed slots are tracked so users can still correct them later via TravelCard badges.

**Guiding principle:** Reuse everything. `run_advisory_workflow` already tolerates defaulted fields (it applies its own defaults if `destination_preferences` is missing). The propose-first service just needs to extract what it can and fill the rest before calling it.

### Backend: `propose_first.py`

**New file:** `stravel/backend/app/services/propose_first.py`

**`detect_intent(message: str) -> dict`** — pure function, no DB access:
```python
import re, random
from datetime import date, timedelta

VIETNAM_CITIES = [
    "Hanoi", "Ho Chi Minh City", "Da Nang", "Hoi An", "Hue",
    "Nha Trang", "Phu Quoc", "Ha Long Bay", "Sapa", "Da Lat",
    "Can Tho", "Vung Tau", "Mui Ne", "Ninh Binh", "Quy Nhon",
    "Phan Thiet", "Con Dao", "Lang Co", "Bac Ha", "Mai Chau",
]

DESTINATION_PATTERNS = [
    r'\b(visit|go to|travel to|trip to|fly to)\s+([A-Z][a-zA-Z\s]+)',
    r'\b(?:' + '|'.join(re.escape(c) for c in VIETNAM_CITIES) + r')\b',
]

DURATION_PATTERNS = [
    (r'(\d+)\s+(?:days?|nights?)', lambda m: int(m.group(1))),
    (r'a\s+week', lambda m: 7),
    (r'(\d+)\s+weeks?', lambda m: int(m.group(1)) * 7),
]

def detect_intent(message: str) -> dict:
    is_surprise = bool(re.search(r'\bsurprise\s+me\b', message, re.I))
    destination = None
    for city in VIETNAM_CITIES:
        if re.search(r'\b' + re.escape(city) + r'\b', message, re.I):
            destination = city
            break
    ...
    return {"destination": destination, "duration_days": duration, "is_surprise_me": is_surprise}
```

**`build_profile_with_defaults`** merges extracted fields over existing profile fields, returns `(patch_dict, assumed_slots)`. `assumed_slots` lists every field that was NOT provided by the user but WAS set to a default.

**Default values** (document these in the service module as constants):
```python
DEFAULT_TRAVELER_COUNT = 2
DEFAULT_BUDGET_TOTAL = 2500.0
DEFAULT_BUDGET_CURRENCY = "USD"
DEFAULT_ACCOMMODATION_STYLE = "mid-range"
DEFAULT_ACTIVITY_PREFERENCES = ["sightseeing", "local food"]
DEFAULT_DURATION_DAYS = 7
DEFAULT_START_DAYS_FROM_NOW = 30
```

### Backend: Endpoint in `sessions.py`

Follow the pattern of the existing `POST /{session_id}/run` route (line ~201-227). Add ABOVE the `/run` route to avoid path conflicts:

```python
@router.post("/{session_id}/propose-first", response_model=ProposeFirstResponse)
async def propose_first_route(
    session_id: uuid.UUID,
    body: ProposeFirstRequest,
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_session),
) -> ProposeFirstResponse:
    session = await _get_session_or_404(session_id, tenant_id, db)
    extracted = detect_intent(body.message)
    profile_patch, assumed_slots = await build_profile_with_defaults(str(session_id), extracted, db)
    await _patch_traveler_profile(session_id, profile_patch, db)
    asyncio.create_task(run_advisory_workflow(str(session_id), profile_patch))
    bot_message = _compose_commitment_message(extracted, assumed_slots)
    return ProposeFirstResponse(
        bot_message=bot_message,
        extracted_slots=extracted,
        assumed_slots=assumed_slots,
        is_surprise_me=extracted["is_surprise_me"],
    )
```

`_compose_commitment_message` returns a string like: `"Great, I'll plan a 7-day trip to Hanoi for 2 travellers starting around {date}. Building your proposal now..."` — hardcoded template, no LLM call needed here.

### Frontend: Type Changes

**`src/types/stream.ts`** — add to `StreamState`:
```typescript
assumedSlots: string[];
```

Add to `StreamAction` union:
```typescript
| { type: "SET_ASSUMED_SLOTS"; payload: string[] }
```

**`src/types/domain.ts`** — add:
```typescript
export interface ProposeFirstResponse {
  bot_message: string;
  extracted_slots: Record<string, unknown>;
  assumed_slots: string[];
  is_surprise_me: boolean;
}
```

### Frontend: `streamReducer.ts`

In `initialStreamState`, add `assumedSlots: []`.

In the reducer switch, add:
```typescript
case "SET_ASSUMED_SLOTS":
  return { ...state, assumedSlots: action.payload };
```

### Frontend: `apiClient.ts`

Under `sessions`, add:
```typescript
proposeFirst: (id: string, message: string) =>
  request<ProposeFirstResponse>(`/advisory_sessions/${id}/propose-first`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  }),
```

### Frontend: `useStreamContext.ts`

Add to the hook interface and implementation:
```typescript
proposeFirst: async (sessionId: string, message: string) => {
  const res = await api.sessions.proposeFirst(sessionId, message);
  dispatch({ type: "SET_ASSUMED_SLOTS", payload: res.assumed_slots });
  dispatch({
    type: "AGENT_MESSAGE",
    payload: { id: crypto.randomUUID(), type: "question", content: res.bot_message, context: "propose_first", timestamp: Date.now() },
  });
  connect(sessionId);
},
```

### Frontend: `TravelCard.tsx` — assumed badge

The component already accepts `SlotKey[]` in surrounding domain types. Slot→field mapping (add near field render logic):

| SlotKey | Field location |
|---|---|
| `travel_dates` | FlightFields: depart + return date labels |
| `traveler_count` | FlightFields: passenger count; HotelFields: guests |
| `budget` | any price/budget display |
| `accommodation_style` | HotelFields: style chip |
| `activities` | ActivityFields: category chips |

Badge markup:
```tsx
{assumedSlots?.includes(slotKey) && (
  <button
    className="ml-1 text-xs text-amber-600 underline cursor-pointer"
    onClick={() => onAssumedBadgeTap?.(slotKey)}
    aria-label={`${slotKey} was assumed — tap to change`}
  >
    (assumed)
  </button>
)}
```

### Anti-patterns to Avoid

1. **Do NOT classify intent server-side during the normal chat flow** — classification only runs on the explicit propose-first endpoint call. Regular messages go through the existing workflow.
2. **Do NOT call the LLM to generate the commitment message** — use a hardcoded template. LLM latency here defeats the "immediate response" goal of propose-first.
3. **Do NOT block the HTTP response on workflow completion** — `asyncio.create_task` must be used (same pattern as `/run` endpoint). The propose-first response must return before any SSE events are emitted.
4. **Do NOT add assumed-slot logic to SlotFillingCard or MoodTransitionCard** — those components are unaffected by this story. Assumed-slot tracking lives only in `StreamState.assumedSlots` and `TravelCard`.
5. **Do NOT deduplicate or merge with existing session profile data in the reducer** — profile state lives in the backend; `assumedSlots` is purely a frontend display hint.

### Testing Standards

- Backend: pytest + `httpx.AsyncClient` via `ASGITransport`, mock `run_advisory_workflow` with `unittest.mock.patch("app.services.workflow.run_advisory_workflow")`
- Frontend: Vitest + `@testing-library/react` for component tests; plain `streamReducer` unit tests (no JSDOM needed) for reducer tests
- Do NOT mock the database in backend integration tests — use the test DB fixture

### Project Structure Notes

Files to create (new):
- `stravel/backend/app/services/propose_first.py`
- `stravel/backend/tests/test_propose_first.py`
- `stravel/frontend/src/constants/destinations.ts`
- `stravel/frontend/src/__tests__/streamReducer.proposeFirst.test.ts`

Files to modify (existing):
- `stravel/backend/app/api/v1/sessions.py` — add endpoint
- `stravel/frontend/src/types/stream.ts` — StreamState + StreamAction
- `stravel/frontend/src/types/domain.ts` — ProposeFirstResponse
- `stravel/frontend/src/reducers/streamReducer.ts` — SET_ASSUMED_SLOTS case + initial state
- `stravel/frontend/src/services/apiClient.ts` — proposeFirst method
- `stravel/frontend/src/hooks/useStreamContext.ts` — proposeFirst function
- `stravel/frontend/src/components/b2c/ChatInterface.tsx` — first-message routing
- `stravel/frontend/src/components/cards/TravelCard.tsx` — assumed badge

### References

- Propose-first AC source: [Source: _bmad-output/planning-artifacts/epics-v2.md — Epic 9, Story 3.4 (9-4), AC1–AC5]
- UX journey UJ-1: [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Section "User Journey UJ-1: Propose-First"]
- Assumed badge design: [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Section "Assumed Slot Badge"]
- `SlotKey` type definition: [Source: stravel/frontend/src/types/domain.ts]
- MOOD_TRANSITION slot keys: [Source: stravel/docs/mood-transition-rules.md]
- Existing `/run` endpoint pattern: [Source: stravel/backend/app/api/v1/sessions.py:201-227]
- `run_advisory_workflow` signature and null-safety: [Source: stravel/backend/app/services/workflow.py]
- TravelCard existing props and CVA variants: [Source: stravel/frontend/src/components/cards/TravelCard.tsx]
- `useStreamContext` hook interface: [Source: stravel/frontend/src/hooks/useStreamContext.ts]
- Fire-and-forget pattern: [Source: _bmad-output/planning-artifacts/architecture.md — "Async Task Creation"]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation proceeded cleanly.

### Completion Notes List

- Implemented `propose_first.py` with pure `detect_intent` (regex: city list, duration patterns, surprise-me flag) and async `build_profile_with_defaults` (fetches profile from DB, merges extracted slots + constants, returns assumed_slots list).
- Added `POST /advisory_sessions/{session_id}/propose-first` to sessions.py — pattern mirrors existing `/run` route; uses `asyncio.create_task` for fire-and-forget workflow trigger.
- Added `ProposeFirstRequest` / `ProposeFirstResponse` Pydantic models inline in sessions.py.
- Added `assumedSlots: string[]` to `StreamState` and `SET_ASSUMED_SLOTS` action; initialized to `[]` in `initialStreamState`.
- Added `proposeFirst` to `useStreamContext` hook — dispatches SET_ASSUMED_SLOTS + AGENT_MESSAGE then calls `connect()`.
- Rewired `ChatInterface` to use `hasMessagedRef` to detect first message and route to `proposeFirst` if `classifyFirstMessage()` returns true.
- Added `AssumedBadge` inline component to `TravelCard.tsx`; rendered on FlightFields depart/return (travel_dates) and ActivityFields category (activities); HotelFields and VisaFields not yet mapped.
- Fixed `vite.config.ts` resolve order to prefer `.tsx` over `.js` — the pre-compiled `.js` artifacts were silently shadowing source `.tsx` files in Vitest. This unblocked the badge rendering tests and is correct for all future tests.
- 22 backend unit tests added; 13 frontend tests added (6 reducer + 7 badge); full suite: 172 backend + 552 frontend passing.

### File List

stravel/backend/app/services/propose_first.py (new)
stravel/backend/app/api/v1/sessions.py (modified — ProposeFirstRequest, ProposeFirstResponse models; propose-first route)
stravel/backend/tests/test_propose_first.py (new)
stravel/frontend/src/types/stream.ts (modified — assumedSlots in StreamState, SET_ASSUMED_SLOTS action)
stravel/frontend/src/types/domain.ts (modified — ProposeFirstResponse interface)
stravel/frontend/src/reducers/streamReducer.ts (modified — SET_ASSUMED_SLOTS case, assumedSlots: [] in initialStreamState)
stravel/frontend/src/services/apiClient.ts (modified — sessions.proposeFirst)
stravel/frontend/src/hooks/useStreamContext.ts (modified — proposeFirst function)
stravel/frontend/src/components/b2c/ChatInterface.tsx (modified — first-message routing, classifyFirstMessage)
stravel/frontend/src/components/cards/TravelCard.tsx (modified — AssumedBadge, assumedSlots/onAssumedBadgeTap props, badge on FlightFields/ActivityFields)
stravel/frontend/src/constants/destinations.ts (new)
stravel/frontend/src/__tests__/streamReducer.proposeFirst.test.ts (new)
stravel/frontend/src/components/cards/__tests__/TravelCard.assumedBadge.test.tsx (new)
stravel/frontend/vite.config.ts (modified — resolve.extensions: tsx before js)

### Review Findings

- [x] [Review][Patch] Surprise-me path fires workflow with no destination — in `build_profile_with_defaults`, when `is_surprise_me=True` and `destination is None`, pick `random.choice(VIETNAM_CITIES)` and add it to the patch (satisfies AC4: "destination selected randomly") [`propose_first.py:build_profile_with_defaults`]
- [x] [Review][Patch] Falsy `if duration_days:` / `if not existing_count:` checks treat 0 as absent — use `is not None` / explicit `None` checks [`propose_first.py:build_profile_with_defaults`]
- [x] [Review][Patch] Mutable `DEFAULT_ACTIVITY_PREFERENCES` list aliased directly into patch dict — mutating the patch later would corrupt the module-level constant; use `list(DEFAULT_ACTIVITY_PREFERENCES)` [`propose_first.py`]
- [x] [Review][Patch] `profile=None` path skips DB update but fires `run_advisory_workflow` with stale/empty data — should return 404 or create a default profile before firing workflow [`sessions.py:propose_first_route`]
- [x] [Review][Patch] `proposeFirst` hook swallows all errors silently — user sees nothing if the API call fails; dispatch an error `AGENT_MESSAGE` or call `onError` callback [`useStreamContext.ts:proposeFirst`]
- [x] [Review][Patch] `hasMessagedRef` set to `true` before `await proposeFirst(...)` — if the call throws, ref is already set and the next send skips propose-first; set after success or reset in catch; also never reset when `sessionId` changes, so switching sessions permanently bypasses propose-first [`ChatInterface.tsx:handleSubmit`]
- [x] [Review][Patch] User's own message not shown in chat UI on propose-first path — `handleSubmit` calls `onProposeFirst` but never calls `addMessage` or `onSendMessage` with the user text; chat appears to swallow the first message (AC1) [`ChatInterface.tsx:handleSubmit`]
- [x] [Review][Patch] `onAssumedBadgeTap` wired in `TravelCard` but never connected in `ChatInterface` — badge tap fires into void; wire `onAssumedBadgeTap` to dispatch `OPEN_SLOT_CARD` with the slot key (AC5) [`ChatInterface.tsx`]
- [x] [Review][Patch] `assumedSlots` never cleared after user fills a slot — badge persists even after the SlotFillingCard is submitted; dispatch `REMOVE_ASSUMED_SLOT` (or filtered `SET_ASSUMED_SLOTS`) on slot submission (AC5) [`streamReducer.ts`, `useStreamContext.ts`]

## Change Log

- 2026-05-27: Implemented Story 9.4 Propose-First Flow. New backend service propose_first.py with intent detection and default slot filling; new POST endpoint; frontend SET_ASSUMED_SLOTS reducer action; proposeFirst hook function; ChatInterface first-message routing; TravelCard assumed badges. Fixed Vitest resolve order (tsx > js). 22 + 13 new tests added.
