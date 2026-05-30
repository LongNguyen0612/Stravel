# Story 7.6: StageNarrator Component & Journey Progress Bar

Status: done

## Story

As a traveler,
I want to see exactly what the AI is doing as it builds my proposal, with a progress bar tracking the stages,
So that I feel confident the system is working and I know how close I am to seeing my trip.

## Acceptance Criteria

1. **Given** the StageNarrator component mounts
   **When** it renders initially
   **Then** it is present in the DOM with empty content and never mounts/unmounts on stage changes (required for `aria-live` to work correctly with screen readers)

2. **Given** an SSE `stage.change` event arrives with stage `calculating`
   **When** 400ms elapses
   **Then** StageNarrator updates its text to "💰 Calculating budget…"

3. **Given** the StageNarrator has `aria-live="polite"` and `aria-atomic="true"`
   **When** stage text updates
   **Then** screen readers announce the full new stage text without interrupting user activity

4. **Given** the workflow is idle (`state.status === "idle"` and `state.messages.length === 0`)
   **When** the JourneyProgressBar renders
   **Then** the progress bar is hidden

5. **Given** the first SSE message arrives (`state.messages.length > 0`)
   **When** the JourneyProgressBar renders
   **Then** the progress bar is visible with 4 stages: `Profile · Budget · Proposal · Review`, current stage highlighted

6. **Given** a completed stage marker is clicked
   **When** the click registers
   **Then** ConversationCanvas (CopilotSidebar scroll container) scrolls to the first message belonging to that stage

## Tasks / Subtasks

- [x] Task 1: Create `StageNarrator` component (AC: #1, #2, #3)
  - [x] Create `src/components/shared/StageNarrator.tsx` — always mounted, `aria-live="polite"` `aria-atomic="true"`, 400ms delayed text via `setTimeout`
  - [x] Stage text map: `idle`→`""`, `profiling`→`"🗺️ Learning your travel preferences…"`, `calculating`→`"💰 Calculating budget…"`, `proposing`→`"✈️ Building your travel proposal…"`, `validating`→`"✅ Checking compliance and safety…"`, `complete`→`""`
  - [x] Timer cleared on stage prop change and on unmount
  - [x] Styled via `MessageBubble role="stage-narrator"` (already defined in Story 7.5)
  - [x] Create `src/components/shared/StageNarrator.js` (stale `.js` counterpart — same pattern as all prior stories)
  - [x] Create `src/components/shared/__tests__/StageNarrator.test.tsx` with fake timers: initial empty content, 400ms delay, aria attrs, timer cleared on stage change, no remount on stage change

- [x] Task 2: Create `JourneyProgressBar` component (AC: #4, #5, #6)
  - [x] Create `src/components/shared/JourneyProgressBar.tsx` with props: `stage: WorkflowStage`, `hasStarted: boolean`, `onStageClick: (stage: WorkflowStage) => void`
  - [x] 4 stage labels: `{ key: "profiling", label: "Profile" }`, `{ key: "calculating", label: "Budget" }`, `{ key: "proposing", label: "Proposal" }`, `{ key: "validating", label: "Review" }`
  - [x] Hidden (`display: none` or `hidden`) when `!hasStarted`; visible otherwise
  - [x] Current stage highlighted (teal-600 text + underline); completed stages muted (slate-400); future stages slate-300
  - [x] Stage order: profiling < calculating < proposing < validating; "complete" maps to all 4 highlighted
  - [x] `onStageClick` called with the stage key when a completed stage is clicked
  - [x] Create `src/components/shared/JourneyProgressBar.js` (stale `.js` counterpart)
  - [x] Create `src/components/shared/__tests__/JourneyProgressBar.test.tsx`: hidden when not started, visible when started, current stage highlighted, click handler called

- [x] Task 3: Wire into `CopilotSidebar.tsx` (AC: #1–#6)
  - [x] Import `StageNarrator` and `JourneyProgressBar` into `CopilotSidebar.tsx`
  - [x] Add `<StageNarrator stage={state.status} />` inside the scrollable content area (after messages, before the `messagesEndRef` div)
  - [x] Add `<JourneyProgressBar stage={state.status} hasStarted={state.messages.length > 0} onStageClick={handleStageScroll} />` just below the stage indicator header
  - [x] Implement `handleStageScroll(stage)` — finds the first message element with `data-stage={stage}` using `ref` to the scroll container, then calls `.scrollIntoView({ behavior: "smooth" })`
  - [x] Tag each message `<div>` in the messages map with `data-stage={msg.type === "question" ? "profiling" : msg.type === "result" ? "calculating" : "proposing"}` for scroll targeting
  - [x] Update `src/components/b2b/CopilotSidebar.js` (stale `.js` counterpart — full resync)

- [x] Task 4: Run validation suite (AC: all)
  - [x] `npx vitest run` — all tests pass, no regressions (275 passing, 28 files)
  - [x] `npm run lint` — clean
  - [x] `npm run build` — clean (tsc + vite)
  - [x] Confirm `StageNarrator` is always present in DOM; confirm text updates only after 400ms delay

## Dev Notes

### Current Codebase State (after Story 7.5)

```
stravel/frontend/src/
├── components/
│   ├── shared/
│   │   ├── MessageBubble.tsx        — role: "bot" | "user" | "stage-narrator"
│   │   ├── TypingIndicator.tsx
│   │   ├── StreamMessage.tsx
│   │   └── ComplianceBadge.tsx
│   ├── b2b/
│   │   └── CopilotSidebar.tsx       — renders state.messages; already has STAGE_CONFIG map
│   └── layout/
│       ├── ConversationCanvas.tsx
│       ├── B2CLayout.tsx
│       ├── CardDeckZone.tsx
│       └── ChatInput.tsx
├── hooks/
│   └── useStreamContext.ts          — SSE stage.change event → STAGE_CHANGE → state.status
├── reducers/
│   └── streamReducer.ts             — STAGE_CHANGE sets state.status (WorkflowStage)
├── types/
│   └── stream.ts                    — WorkflowStage, StreamState
└── styles/
    └── global.css                   — .message-bubble--stage-narrator already defined
```

**Frontend tests at start of story:** 248 passing (26 files).

### SSE Stage Infrastructure (Already Wired in Story 7.4)

`useStreamContext.ts` (lines 72–79) already handles `stage.change`:
```typescript
es.addEventListener("stage.change", (e) => {
  resetWatchdog();
  const data = parseEventData(e.data);
  if (!data) return;
  dispatch({ type: "STAGE_CHANGE", payload: data.stage as WorkflowStage });
  if (data.stage === "complete") {
    dispatch({ type: "SSE_PHASE_CHANGE", payload: "complete" });
  }
});
```

`streamReducer.ts` handles it:
```typescript
case "STAGE_CHANGE":
  return { ...state, status: action.payload };
```

`WorkflowStage` type (from `src/types/stream.ts`):
```typescript
export type WorkflowStage =
  | "idle" | "profiling" | "calculating" | "proposing" | "validating" | "complete";
```

**Critical:** The epics-v2.md and UX spec use stage names `PLANNING`, `INTAKE`, `PROPOSAL_READY`. These do NOT match `WorkflowStage`. Use the actual TypeScript type values: `profiling`, `calculating`, `proposing`, `validating`. AC#2 says "stage PLANNING → 💰 Calculating budget…" — this maps to `calculating` in the codebase.

### StageNarrator Implementation Spec

```typescript
// src/components/shared/StageNarrator.tsx
import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import type { WorkflowStage } from "../../types/stream";

const STAGE_TEXT: Record<WorkflowStage, string> = {
  idle:        "",
  profiling:   "🗺️ Learning your travel preferences…",
  calculating: "💰 Calculating budget…",
  proposing:   "✈️ Building your travel proposal…",
  validating:  "✅ Checking compliance and safety…",
  complete:    "",
};

interface Props {
  stage: WorkflowStage;
}

export function StageNarrator({ stage }: Props) {
  const [displayText, setDisplayText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDisplayText(STAGE_TEXT[stage] ?? "");
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stage]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      data-testid="stage-narrator"
    >
      {displayText && (
        <MessageBubble role="stage-narrator">{displayText}</MessageBubble>
      )}
    </div>
  );
}
```

**Key design decisions:**
- Outer `<div>` is ALWAYS in the DOM (never unmounted) — this preserves `aria-live` registration with screen readers. Only the inner MessageBubble conditionally renders.
- 400ms delay via `useEffect` + `setTimeout`, cleared on every stage change
- `data-testid="stage-narrator"` on outer div for test targeting
- Uses `MessageBubble role="stage-narrator"` for styling (already defined in Story 7.5: `text-slate-400 text-xs self-stretch text-center`)

### JourneyProgressBar Implementation Spec

```typescript
// src/components/shared/JourneyProgressBar.tsx
import type { WorkflowStage } from "../../types/stream";

const STAGES: { key: WorkflowStage; label: string }[] = [
  { key: "profiling",   label: "Profile" },
  { key: "calculating", label: "Budget" },
  { key: "proposing",   label: "Proposal" },
  { key: "validating",  label: "Review" },
];

const STAGE_ORDER: Record<WorkflowStage, number> = {
  idle: -1, profiling: 0, calculating: 1, proposing: 2, validating: 3, complete: 4,
};

interface Props {
  stage: WorkflowStage;
  hasStarted: boolean;
  onStageClick: (stage: WorkflowStage) => void;
}

export function JourneyProgressBar({ stage, hasStarted, onStageClick }: Props) {
  if (!hasStarted) return null;

  const currentOrder = STAGE_ORDER[stage] ?? -1;

  return (
    <div data-testid="journey-progress-bar" style={{ display: "flex", gap: "4px", padding: "8px 16px", alignItems: "center" }}>
      {STAGES.map(({ key, label }, i) => {
        const order = STAGE_ORDER[key];
        const isCurrent = key === stage;
        const isDone = order < currentOrder;
        return (
          <button
            key={key}
            data-testid={`stage-step-${key}`}
            onClick={() => isDone && onStageClick(key)}
            disabled={!isDone}
            style={{
              flex: 1,
              fontSize: "11px",
              fontWeight: isCurrent ? 700 : 400,
              color: isCurrent ? "#0d9488" : isDone ? "#94a3b8" : "#cbd5e1",
              background: "none",
              border: "none",
              borderBottom: isCurrent ? "2px solid #0d9488" : "2px solid transparent",
              padding: "4px 2px",
              cursor: isDone ? "pointer" : "default",
              textAlign: "center",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

### CopilotSidebar Wiring

`CopilotSidebar.tsx` already has `STAGE_CONFIG` and inline stage indicator. Changes:

1. Import new components:
```typescript
import { StageNarrator } from "../shared/StageNarrator";
import { JourneyProgressBar } from "../shared/JourneyProgressBar";
```

2. Add `scrollContainerRef` for scroll-to-stage:
```typescript
const scrollContainerRef = useRef<HTMLDivElement>(null);
```

3. `handleStageScroll` callback:
```typescript
const handleStageScroll = (targetStage: WorkflowStage) => {
  const el = scrollContainerRef.current?.querySelector(`[data-stage="${targetStage}"]`);
  el?.scrollIntoView({ behavior: "smooth" });
};
```

4. Add `JourneyProgressBar` after the stage indicator `<div>`:
```tsx
<JourneyProgressBar
  stage={state.status}
  hasStarted={state.messages.length > 0}
  onStageClick={handleStageScroll}
/>
```

5. Add `ref={scrollContainerRef}` to the scrollable content `<div>`.

6. Tag each message with `data-stage`:
```tsx
{state.messages.map((msg) => (
  <div
    key={msg.id}
    data-stage={msg.type === "question" ? "profiling" : msg.type === "result" ? "calculating" : "proposing"}
    ...
  >
```

7. Add `<StageNarrator stage={state.status} />` inside the scroll container, after messages and compliance flags, before `messagesEndRef`:
```tsx
<StageNarrator stage={state.status} />
<div ref={messagesEndRef} />
```

### Testing Approach

**`StageNarrator.test.tsx`** — must use `vi.useFakeTimers()`:
```typescript
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StageNarrator } from '../StageNarrator';

describe('StageNarrator', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('renders outer container with aria-live="polite" on mount', () => {
    render(<StageNarrator stage="idle" />);
    const el = screen.getByTestId('stage-narrator');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(el).toHaveAttribute('aria-atomic', 'true');
  });

  it('shows empty content immediately on mount (idle)', () => {
    render(<StageNarrator stage="idle" />);
    expect(screen.getByTestId('stage-narrator')).toBeEmptyDOMElement();
  });

  it('does not show text before 400ms elapses', () => {
    render(<StageNarrator stage="calculating" />);
    expect(screen.getByTestId('stage-narrator')).toBeEmptyDOMElement();
  });

  it('shows stage text after 400ms', async () => {
    render(<StageNarrator stage="calculating" />);
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(screen.getByTestId('stage-narrator')).toHaveTextContent('💰 Calculating budget…');
  });

  it('clears text when stage returns to idle', async () => {
    const { rerender } = render(<StageNarrator stage="calculating" />);
    await act(async () => { vi.advanceTimersByTime(400); });
    rerender(<StageNarrator stage="idle" />);
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(screen.getByTestId('stage-narrator')).toBeEmptyDOMElement();
  });
});
```

**`JourneyProgressBar.test.tsx`**:
```typescript
it('renders null when hasStarted is false');
it('renders 4 stage labels when hasStarted is true');
it('current stage has teal-600 color and bold weight');
it('onStageClick called when completed stage clicked');
it('does not call onStageClick for future/current stage');
```

### Stale `.js` Counterpart Pattern (Critical — from Stories 7.3/7.4/7.5)

**Every new `.tsx` file MUST have a matching `.js` counterpart.** Vitest resolves `.js` over `.tsx` in some module resolution paths. New files needing counterparts:

| TypeScript source | `.js` counterpart |
|---|---|
| `src/components/shared/StageNarrator.tsx` | `src/components/shared/StageNarrator.js` |
| `src/components/shared/JourneyProgressBar.tsx` | `src/components/shared/JourneyProgressBar.js` |

Additionally, `CopilotSidebar.tsx` modification → resync `CopilotSidebar.js`.

**Pattern for `.js` files:** Hand-write the JSX-runtime equivalent:
```js
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
// ... mirror the .tsx exactly using _jsx/_jsxs notation
```

Check existing `.js` files (e.g., `MessageBubble.js`, `TypingIndicator.js`) for the exact pattern.

### Vitest `act()` Requirement (from Story 7.4)

All fake-timer advancements that trigger state updates MUST be wrapped in `await act(async () => { vi.advanceTimersByTime(N); })`. Bare `vi.advanceTimersByTime()` calls without `act()` will miss React state flushes and make tests flaky.

### CSS — No New Rules Needed

`.message-bubble--stage-narrator` was fully defined in Story 7.5:
```css
.message-bubble--stage-narrator {
  @apply text-slate-400 text-xs self-stretch text-center my-1 px-0 py-1 bg-transparent rounded-none max-w-full;
}
```

No CSS changes required for this story.

### File List (Files to Change This Story)

```
stravel/frontend/src/components/shared/StageNarrator.tsx          — new
stravel/frontend/src/components/shared/StageNarrator.js           — new (stale .js counterpart)
stravel/frontend/src/components/shared/JourneyProgressBar.tsx     — new
stravel/frontend/src/components/shared/JourneyProgressBar.js      — new (stale .js counterpart)
stravel/frontend/src/components/shared/__tests__/StageNarrator.test.tsx    — new
stravel/frontend/src/components/shared/__tests__/JourneyProgressBar.test.tsx — new
stravel/frontend/src/components/b2b/CopilotSidebar.tsx            — modified (wire components)
stravel/frontend/src/components/b2b/CopilotSidebar.js             — modified (resync)
```

### References

- [Source: epics-v2.md Story 1.6] — User story, AC, Dev Notes
- [Source: ux-design-specification.md §Component Strategy → StageNarrator] — Styling, timing, persistence spec
- [Source: src/hooks/useStreamContext.ts:72-79] — stage.change SSE event handler (already wired)
- [Source: src/reducers/streamReducer.ts:27] — STAGE_CHANGE reducer
- [Source: src/types/stream.ts] — WorkflowStage type definition
- [Source: src/components/b2b/CopilotSidebar.tsx] — Target integration point
- [Source: src/components/shared/MessageBubble.tsx] — role="stage-narrator" (from Story 7.5)
- [Source: src/styles/global.css:70-73] — .message-bubble--stage-narrator CSS (from Story 7.5)
- Story 7.4 learnings — Vitest `act()` + fake timers pattern
- Story 7.5 learnings — stale `.js` counterpart pattern now includes `components/shared/` and `components/b2b/`

## Senior Developer Review (AI)

**Review Date:** 2026-05-26
**Outcome:** Changes Requested
**Layers:** Blind Hunter · Edge Case Hunter · Acceptance Auditor

### Action Items

- [x] [Review][Patch] `hasStarted` gate: changed to `messages.length > 0 || state.status !== "idle"` — bar stays hidden when truly idle, appears as soon as first stage change OR first message arrives [Decision: Option 1 applied] [`CopilotSidebar.tsx` — JourneyProgressBar hasStarted prop]
- [x] [Review][Dismissed] `complete` stage visual treatment — slate-400 "done" style accepted as correct interpretation of "all 4 highlighted"; no code change needed [Decision: Option 1 keep current]
- [x] [Review][Patch] `validating` stage `data-stage` fix — added `data-stage="validating"` to compliance flags container so "Review" progress step scroll works correctly [`CopilotSidebar.tsx` + `CopilotSidebar.js`]
- [x] [Review][Dismissed] Test wrong mock — false positive; the test already passes `onStageClick={onStageClick}` (the correct variable) to the component [`JourneyProgressBar.test.tsx:103`]
- [x] [Review][Defer] `scrollIntoView` conflict between `messagesEndRef` and `handleStageScroll` — when a user clicks a past stage step to navigate back, the next incoming SSE message fires the `useEffect` and scrolls the view back to the bottom, overriding user navigation intent. Requires a "user is scrolling back" guard. [`CopilotSidebar.tsx` — useEffect + handleStageScroll] — deferred, UX design decision beyond story scope
- [x] [Review][Defer] Stale narrator text during rapid stage transitions — debounce cancels announcements for stages that change within the 400ms window; screen reader users receive no feedback for intermediate stages. Known debounce design tradeoff from Story 7.4 spec. [`StageNarrator.tsx`] — deferred, inherent to 400ms design

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — clean implementation, all tests passed on first run.

### Completion Notes List

- ✅ Task 1: StageNarrator.tsx created with 400ms timer, aria-live/aria-atomic, outer div always mounted. 12/12 tests passing. StageNarrator.js counterpart synced. Full suite: 260 tests passing, 0 regressions.
- ✅ Task 2: JourneyProgressBar.tsx created — returns null when !hasStarted, renders 4 stage buttons with teal/muted/future color states, disabled for non-completed stages. 15/15 tests passing. JourneyProgressBar.js counterpart synced (linter auto-formatted).
- ✅ Task 3: CopilotSidebar.tsx wired — StageNarrator + JourneyProgressBar imported, scrollContainerRef + handleStageScroll added (useCallback), JourneyProgressBar placed after stage indicator, StageNarrator placed before messagesEndRef, message divs tagged with data-stage. CopilotSidebar.js fully resynced.
- ✅ Task 4: Validation suite — 275/275 tests passing (28 files), lint clean, build clean (tsc + vite, 229 modules).

### File List

stravel/frontend/src/components/shared/StageNarrator.tsx
stravel/frontend/src/components/shared/StageNarrator.js
stravel/frontend/src/components/shared/__tests__/StageNarrator.test.tsx
stravel/frontend/src/components/shared/JourneyProgressBar.tsx
stravel/frontend/src/components/shared/JourneyProgressBar.js
stravel/frontend/src/components/shared/__tests__/JourneyProgressBar.test.tsx
stravel/frontend/src/components/b2b/CopilotSidebar.tsx
stravel/frontend/src/components/b2b/CopilotSidebar.js

### Change Log

- Task 1 complete: StageNarrator component + tests + .js counterpart (2026-05-26)
- Tasks 2–4 complete: JourneyProgressBar component + tests + .js counterpart; CopilotSidebar wired with both components; full validation suite green 275/275 (2026-05-26)
