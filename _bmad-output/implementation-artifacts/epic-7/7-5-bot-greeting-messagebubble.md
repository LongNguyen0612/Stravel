# Story 7.5: Bot Greeting & MessageBubble Component

Status: done

## Story

As a traveler,
I want to see a friendly greeting the moment I open STravel,
So that I know immediately the AI is ready to help me plan my trip — not waiting for me to fill out a form.

## Acceptance Criteria

1. **Given** an authenticated user opens STravel
   **When** the canvas renders
   **Then** the bot greeting "Hi! Where are you dreaming of going in Vietnam?" appears within 500ms and ChatInput is active (NFR-1)

2. **Given** an unauthenticated user opens STravel (demo route)
   **When** the canvas renders
   **Then** the bot greeting appears within 1s (NFR-1 unauthenticated)

3. **Given** a bot message is rendered in ConversationCanvas
   **When** it appears
   **Then** it uses `MessageBubble` with `role="bot"` — left-aligned, `bg-surface-2` chrome, teal-600 accent

4. **Given** a user sends a message
   **When** it appears
   **Then** it uses `MessageBubble` with `role="user"` — right-aligned, `bg-primary text-white` styling

5. **Given** a stage-narrator message is rendered in ConversationCanvas
   **When** it appears
   **Then** it uses `MessageBubble` with `role="stage-narrator"` — no bubble chrome, centered text, `text-slate-400`, 12px font size, persists in scroll history

6. **Given** the `MessageBubble` `role` prop is set
   **When** rendered
   **Then** the correct CSS variant class is applied: `message-bubble--bot`, `message-bubble--user`, or `message-bubble--stage-narrator`

7. **Given** an existing render of `MessageBubble` with `sender="agent"`
   **When** the story is complete
   **Then** all call sites updated to use `role="bot"` instead (no remaining `sender` prop usage)

## Tasks / Subtasks

- [x] Task 1: Update `MessageBubble` component to use `role` prop (AC: #3, #4, #5, #6, #7)
  - [x] In `src/components/shared/MessageBubble.tsx`: renamed prop from `sender: "agent" | "user"` to `role: "bot" | "user" | "stage-narrator"`, updated CSS class to `message-bubble--${role}`
  - [x] In `src/styles/global.css`: renamed `.message-bubble--agent` → `.message-bubble--bot`; added `.message-bubble--stage-narrator` rule with no bubble chrome
  - [x] Updated `src/App.tsx` (DemoPage), `src/components/b2c/ChatInterface.tsx`: `sender` → `role` prop, `"agent"` → `"bot"` value
  - [x] Also updated stale `.js` counterparts: `MessageBubble.js`, `App.js`, `ChatInterface.js`
  - [x] Created `src/components/shared/__tests__/MessageBubble.test.tsx`: 6 tests, all pass

- [x] Task 2: Bot greeting in DemoPage (AC: #1, #2)
  - [x] DemoPage initial state set to `[{ role: "assistant", content: "Hi! Where are you dreaming of going in Vietnam?" }]` — greeting present on first render, well within 500ms
  - [x] Greeting renders as `role="bot"` MessageBubble in ConversationCanvas
  - [x] `DemoPage` exported as named export from `App.tsx` to enable testing
  - [x] Created `src/components/shared/__tests__/DemoGreeting.test.tsx`: 2 tests asserting greeting text and `message-bubble--bot` class

- [x] Task 3: Stage-narrator variant in DemoPage (AC: #5)
  - [x] DemoPage `handleSend` immediately appends `{ role: "stage-narrator", content: "🤖 Thinking about your trip…" }` to messages before API call
  - [x] Stage-narrator messages render with `role="stage-narrator"` MessageBubble; persist in scroll history (not cleared)

- [x] Task 4: Agent-mode toggle in DemoPage header (Dev Notes requirement)
  - [x] `agentMode` state reads from `localStorage.getItem("stravel_agent_mode")`
  - [x] Toggle button (`data-testid="agent-mode-toggle"`) at top of DemoPage writes back to localStorage
  - [x] When `agentMode === true`, renders B2B stub with link to `/sessions` and "Switch to Chat Mode" button

- [x] Task 5: Run validation suite (AC: all)
  - [x] `npx vitest run` — 248/248 tests, 26 files, all pass
  - [x] `npm run lint` — clean (no ESLint errors)
  - [x] `npm run build` — clean (tsc + vite, 420 kB bundle)
  - [x] Confirmed: no `message-bubble--agent` class emitted anywhere; `message-bubble--bot` used throughout

### Review Findings

- [x] [Review][Decision→Patch] AC#3: teal-600 accent missing from bot message bubbles — resolved: added `border-l-[3px] border-teal-600` to `.message-bubble--bot` [src/styles/global.css]
- [x] [Review][Patch] No catch block in handleSend — thrown exception leaves stage-narrator "Thinking" orphaned in history [src/App.tsx:handleSend]
- [x] [Review][Patch] HTTP non-ok responses not checked in fetch calls — session create and chat POST do not check resp.ok/chatResp.ok [src/App.tsx:handleSend]
- [x] [Review][Patch] chatData.reply not null-guarded — undefined reply renders visible "undefined" string in bot bubble [src/App.tsx:handleSend]
- [x] [Review][Patch] .message-bubble base rounded-xl/max-w-[80%] not overridden for stage-narrator — added `rounded-none max-w-full` [src/styles/global.css]
- [x] [Review][Defer] ChatInterface Message.role type does not include "stage-narrator" [src/components/b2c/ChatInterface.tsx:6] — deferred, DemoPage no longer uses ChatInterface directly; low impact
- [x] [Review][Defer] DemoGreeting.test.tsx missing vi.resetModules() between test cases [src/components/shared/__tests__/DemoGreeting.test.tsx] — deferred, only matters when mutation tests are added

## Dev Notes

### Current Codebase State (after Story 7.4)

```
stravel/frontend/src/
├── components/
│   ├── shared/
│   │   ├── MessageBubble.tsx        — prop: sender: "agent" | "user"; class: message-bubble--${sender}
│   │   ├── TypingIndicator.tsx      — shows three-dot animation when isActive
│   │   └── StreamMessage.tsx        — (exists, not used by DemoPage directly)
│   ├── b2b/
│   │   └── CopilotSidebar.tsx       — renders state.messages with inline styles; does NOT use MessageBubble
│   ├── layout/
│   │   ├── ConversationCanvas.tsx   — scrollable flex-col container with paddingBottom
│   │   ├── B2CLayout.tsx            — outer shell for DemoPage
│   │   ├── CardDeckZone.tsx
│   │   └── ChatInput.tsx
│   └── cards/
│       └── TravelCard.tsx
├── hooks/
│   ├── useStreamContext.ts          — SSE connect/disconnect, StreamState
│   └── useFooterHeight.ts
├── reducers/
│   └── streamReducer.ts             — state: { messages, complianceFlags, cardUpdates, ssePhase, ... }
├── types/
│   ├── stream.ts                    — StreamMessage, StreamState, SSEPhase
│   └── domain.ts                   — CardUpdateEvent, CardType, TravelerProfile
└── styles/
    ├── global.css                   — .message-bubble, .message-bubble--agent, .message-bubble--user
    └── tokens.css                   — design tokens
```

**Frontend tests at start of story:** 232 passing (22 files).

### MessageBubble Current Implementation

```typescript
// src/components/shared/MessageBubble.tsx
interface Props {
  children: ReactNode;
  sender: "agent" | "user";  // ← rename to role
}
export function MessageBubble({ children, sender }: Props) {
  return (
    <div
      data-testid="message-bubble"
      className={`message-bubble message-bubble--${sender}`}
    >
      {children}
    </div>
  );
}
```

**Required change:** rename `sender` → `role`, add `"stage-narrator"` to type. One call site in DemoPage uses `sender` (update it). CopilotSidebar does NOT use MessageBubble (inline styles only) — no change needed there.

### CSS Changes Required

**`src/styles/global.css` — inside `@layer components {`:**

```css
/* Rename: */
.message-bubble--bot {            /* was .message-bubble--agent */
  @apply bg-surface-2 self-start;
}

/* Keep unchanged: */
.message-bubble--user {
  @apply bg-primary text-white self-end;
}

/* Add: */
.message-bubble--stage-narrator {
  @apply text-slate-400 text-xs self-stretch text-center my-1 px-0 py-1 bg-transparent;
  /* No border, no background — purely text annotation in scroll history */
}
```

### Bot Greeting Implementation (DemoPage)

DemoPage in `src/App.tsx` (line ~231) currently starts with `messages = []`.

**Greeting approach:** Set the greeting synchronously in the initial state to ensure it's present on first render (within browser frame, well under 500ms):

```tsx
// Change:
const [messages, setMessages] = useState<DemoMessage[]>([]);

// To:
const [messages, setMessages] = useState<DemoMessage[]>([
  { role: "assistant", content: "Hi! Where are you dreaming of going in Vietnam?" }
]);
```

This is simpler and more reliable than `useEffect` — the greeting is always present on first render, no async delay. AC1 says "within 500ms" not "after 500ms", so immediate is correct.

**Rendering in ConversationCanvas:**
```tsx
{messages.map((msg, i) => (
  <MessageBubble key={i} role={msg.role === "user" ? "user" : "bot"}>
    {msg.content}
  </MessageBubble>
))}
```

### Stage-Narrator Variant Scoping

**Story 7.5 scope:** Define the `role="stage-narrator"` variant in MessageBubble and demonstrate it with a static usage in DemoPage.

**Story 7.6 scope (next story):** Full SSE-driven stage-narrator that listens to `stage.change` events and shows contextual narration text with 400ms delay.

For Story 7.5's Task 3, a minimal implementation in DemoPage is sufficient:
```tsx
// When isLoading becomes true, show a stage-narrator hint
{isLoading && (
  <MessageBubble role="stage-narrator">
    🤖 Thinking about your trip…
  </MessageBubble>
)}
```
This establishes the component variant without needing SSE wiring.

### Agent-Mode Toggle

```tsx
function DemoPage() {
  const [agentMode, setAgentMode] = useState(
    () => localStorage.getItem("stravel_agent_mode") === "true"
  );
  
  const handleToggleMode = () => {
    const next = !agentMode;
    localStorage.setItem("stravel_agent_mode", String(next));
    setAgentMode(next);
  };
  
  if (agentMode) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>B2B Agent Mode — <a href="/sessions">Open Advisory Sessions</a></p>
        <button onClick={handleToggleMode}>Switch to Chat Mode</button>
      </div>
    );
  }
  
  // ... existing DemoPage render
}
```

The toggle button can live at the top of the DemoPage render (inside B2CLayout header area or as a floating button).

### Testing Approach

**`MessageBubble.test.tsx`** (create at `src/components/shared/__tests__/`):
```typescript
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';

it('applies message-bubble--bot class for role="bot"', () => {
  render(<MessageBubble role="bot">Hello</MessageBubble>);
  expect(screen.getByTestId('message-bubble')).toHaveClass('message-bubble--bot');
});

it('applies message-bubble--user class for role="user"', () => {
  render(<MessageBubble role="user">Hello</MessageBubble>);
  expect(screen.getByTestId('message-bubble')).toHaveClass('message-bubble--user');
});

it('applies message-bubble--stage-narrator class for role="stage-narrator"', () => {
  render(<MessageBubble role="stage-narrator">Stage text</MessageBubble>);
  expect(screen.getByTestId('message-bubble')).toHaveClass('message-bubble--stage-narrator');
});

it('does NOT apply bot/user class to stage-narrator', () => {
  render(<MessageBubble role="stage-narrator">Stage text</MessageBubble>);
  const el = screen.getByTestId('message-bubble');
  expect(el).not.toHaveClass('message-bubble--bot');
  expect(el).not.toHaveClass('message-bubble--user');
});
```

No `vi.useFakeTimers()` needed — these are purely synchronous render tests.

### Critical Anti-Patterns to Avoid

1. **Do NOT rename CopilotSidebar messages rendering** — CopilotSidebar uses inline styles and has its own message rendering logic. It does NOT use `MessageBubble`. Do not refactor it.
2. **Do NOT add role prop to `StreamMessage` type** — `StreamMessage.type` already encodes `"question" | "result" | "proposal" | "error"`. No type change needed.
3. **Do NOT sync `.js` file for MessageBubble** — `MessageBubble.tsx` has no `.js` counterpart (it's not in the `hooks/` directory that had stale `.js` files). Only `hooks/` and `reducers/` files had `.js` counterparts to keep in sync.
4. **Do NOT change `vite.config.ts`** — NFR-5 from epics.

### Stale `.js` Counterpart Pattern (from Story 7.4)

Files that have `.js` counterparts requiring sync when `.ts` changes:
- `src/hooks/useStreamContext.ts` → `useStreamContext.js`
- `src/reducers/streamReducer.ts` → `streamReducer.js`

Story 7.5 does NOT touch these files. Only `MessageBubble.tsx`, `global.css`, and `App.tsx` change.

### File List (Files to Change This Story)

```
stravel/frontend/src/components/shared/MessageBubble.tsx     — role prop, drop sender
stravel/frontend/src/styles/global.css                       — --agent→--bot, add --stage-narrator
stravel/frontend/src/App.tsx                                  — DemoPage: greeting, stage-narrator, agent-mode toggle
stravel/frontend/src/components/shared/__tests__/MessageBubble.test.tsx  — new test file
```

### References

- [Source: epics-v2.md Story 1.5] — User story, AC, Dev Notes
- [Source: epics-v2.md Story 1.6] — Stage-narrator full scope (Story 7.6)
- [Source: src/styles/global.css:58-68] — Current .message-bubble CSS rules
- [Source: src/components/shared/MessageBubble.tsx] — Current component implementation
- [Source: src/App.tsx:~265-280] — DemoPage ConversationCanvas render
- ARCH: `shared/` boundary rule — shared components used by both B2B and B2C surfaces
- Story 7.4 learnings — stale `.js` counterpart pattern, Vitest `act()` requirement

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `MessageBubble.js` was stale (used `sender` prop) — same stale `.js` counterpart pattern as Stories 7.3/7.4; updated to use `role`
- `App.js` was stale — DemoPage used `sender="agent"`, no greeting, no export; synced fully
- `ChatInterface.js` also had stale `sender="agent"` — found via `grep -rn "sender="` after build error; updated
- `DemoPage` not exported from `App.tsx` — added `export` keyword to enable isolated testing; test imports via `{ DemoPage } = await import('../../../App')`
- Greeting implemented as initial state value (not `useEffect`) — synchronous, guaranteed within first render frame

### Completion Notes List

- All 7 ACs satisfied. `MessageBubble` now accepts `role: "bot" | "user" | "stage-narrator"` — breaking change: `sender` prop removed entirely. CSS renamed `.message-bubble--agent` → `.message-bubble--bot`; `.message-bubble--stage-narrator` added (no chrome, centered slate-400 12px text).
- Bot greeting "Hi! Where are you dreaming of going in Vietnam?" appears on DemoPage initial render via initial state — no delay needed.
- Stage-narrator appended to message history on each `handleSend` call; persists in scroll history.
- Agent-mode toggle reads/writes `localStorage("stravel_agent_mode")`; renders B2B stub when active.
- 3 stale `.js` counterparts updated: `MessageBubble.js`, `App.js`, `ChatInterface.js`.
- 248 frontend tests pass (8 new tests across 2 new test files), lint clean, build clean.

### File List

```
stravel/frontend/src/components/shared/MessageBubble.tsx
stravel/frontend/src/components/shared/MessageBubble.js
stravel/frontend/src/components/shared/__tests__/MessageBubble.test.tsx
stravel/frontend/src/components/shared/__tests__/DemoGreeting.test.tsx
stravel/frontend/src/styles/global.css
stravel/frontend/src/App.tsx
stravel/frontend/src/App.js
stravel/frontend/src/components/b2c/ChatInterface.tsx
stravel/frontend/src/components/b2c/ChatInterface.js
```

### Change Log

- 2026-05-26: Story 7.5 implemented — MessageBubble `role` prop, bot greeting, stage-narrator variant, agent-mode toggle; 8 new tests, 248 total passing
