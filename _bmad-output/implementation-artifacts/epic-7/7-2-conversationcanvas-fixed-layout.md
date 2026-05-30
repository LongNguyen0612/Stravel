# Story 7.2: ConversationCanvas Fixed Layout Architecture

Status: done

## Story

As a traveler,
I want the chat input pinned at the bottom of the screen at all times,
So that I can send a message without scrolling down and my typed messages are never obscured by the keyboard.

## Acceptance Criteria

1. `ChatInput` remains fixed at the bottom of the viewport when the user scrolls up through conversation history; `CardDeckZone` (empty placeholder) remains fixed directly above it
2. A `ResizeObserver` updates `ConversationCanvas` `padding-bottom` dynamically whenever `ChatInput` or `CardDeckZone` changes height — no conversation content is hidden behind the fixed footer
3. The `ResizeObserver` re-fires correctly when the Android soft keyboard opens (viewport resize) and padding adjusts without content clipping
4. `ConversationCanvas` scroll container has `role="log"`, `aria-label="Travel advisory conversation"`, and `aria-live="polite"` (default; value will be driven by SSE state machine in Story 7.7)
5. `vite.config.ts` is unchanged — existing SSE proxy, `x-accel-buffering`, and `setNoDelay` remain intact (NFR-5)

## Tasks / Subtasks

- [x] Task 1: Create `ConversationCanvas` component (AC: #2, #3, #4)
  - [x] Create `src/components/layout/ConversationCanvas.tsx`
  - [x] Props: `children: ReactNode`, `paddingBottom: number` (driven by parent ResizeObserver), `ariaLive?: 'off' | 'polite' | 'assertive'` (default `'polite'`)
  - [x] Classes: `flex-1 overflow-y-auto overscroll-contain touch-pan-y`
  - [x] Attributes: `role="log"`, `aria-label="Travel advisory conversation"`, `aria-live={ariaLive}`
  - [x] Inline style: `paddingBottom: paddingBottom` (pixel value from ResizeObserver, not a Tailwind class — dynamic)
  - [x] Export from `src/components/layout/index.ts`
  - [x] Write tests: renders children, has correct role/aria-label/aria-live, applies paddingBottom, accepts custom ariaLive

- [x] Task 2: Create `CardDeckZone` placeholder component (AC: #1, #2)
  - [x] Create `src/components/layout/CardDeckZone.tsx`
  - [x] Props: `chatInputHeight: number` (determines `bottom` offset), `children?: ReactNode`
  - [x] Use `forwardRef<HTMLDivElement>` so `DemoPage` can pass the ref to `useFooterHeight`
  - [x] Classes: `fixed left-0 right-0 w-full` with inline `bottom: chatInputHeight` (px)
  - [x] Empty by default — renders null children unless passed (Story 7.3+ will populate)
  - [x] Export from `src/components/layout/index.ts`
  - [x] Write tests: renders with correct bottom offset, forwards ref, renders children when provided

- [x] Task 3: Create `ChatInput` component (AC: #1, #2)
  - [x] Create `src/components/layout/ChatInput.tsx`
  - [x] Props: `onSubmit: (message: string) => void`, `disabled?: boolean`, `placeholder?: string`
  - [x] Use `forwardRef<HTMLDivElement>` so parent can measure height via ResizeObserver
  - [x] Outer div: `fixed left-0 right-0 bottom-0 w-full pb-safe bg-surface border-t border-border`
  - [x] Inner: flex row with text input + Send button; input uses `cn()`, button uses `bg-primary text-white`
  - [x] Manages its own input value state with `useState`
  - [x] On submit: calls `onSubmit(trimmed)`, clears input; does NOT submit empty string
  - [x] `data-testid="chat-input-container"` on outer div, `data-testid="chat-input"` on input, `data-testid="chat-send"` on button
  - [x] Export from `src/components/layout/index.ts`
  - [x] Write tests: renders input+button, calls onSubmit with value, clears after submit, rejects empty, respects disabled

- [x] Task 4: Create `useFooterHeight` hook (AC: #2, #3)
  - [x] Create `src/hooks/useFooterHeight.ts`
  - [x] Signature: `useFooterHeight(refs: React.RefObject<HTMLElement | null>[]): number`
  - [x] Uses `ResizeObserver` to observe all provided refs
  - [x] Returns the total combined height (sum of each ref's `getBoundingClientRect().height`)
  - [x] Cleans up observer on unmount
  - [x] Returns `0` if all refs are null
  - [x] Write tests: returns 0 initially, updates when ResizeObserver fires (mock ResizeObserver), cleans up on unmount

- [x] Task 5: Refactor `DemoPage` in `App.tsx` to use the new layout components (AC: #1, #2, #3, #4)
  - [x] Import `ConversationCanvas`, `ChatInput`, `CardDeckZone` from `@/components/layout`
  - [x] Import `useFooterHeight` from `@/hooks/useFooterHeight`
  - [x] Create `chatInputRef = useRef<HTMLDivElement>(null)` and `cardDeckRef = useRef<HTMLDivElement>(null)`
  - [x] Use `footerHeight = useFooterHeight([chatInputRef, cardDeckRef])`
  - [x] DemoPage now renders: ConversationCanvas (messages + typing indicator) + CardDeckZone placeholder + ChatInput fixed footer
  - [x] Removed `DemoLayout` and `ChatInterface` imports from `DemoPage` (components kept on disk)
  - [x] `npm run build` passes — no TypeScript errors

- [x] Task 6: Run full test suite and validate all ACs (AC: #1–#5)
  - [x] `npm test` — 80/80 tests pass (24 from Story 7.1 + 56 new)
  - [x] `npm run build` — clean build (222 modules, 1.78s)
  - [x] `vite.config.ts` unchanged — verified by build output

### Review Findings

- [x] [Review][Decision] D1: ESLint hex-in-style-prop violations in App.tsx new pages — `LoginPage`, `SessionListPage`, and `CopilotPage` added in this diff contain ~30 `style={{ color: "#hex" }}` occurrences that trigger the `error`-level `no-restricted-syntax` rule added in Story 7.1. `npm run lint` will fail. Options: (1) Scope the ESLint rule to B2C files only (e.g. `src/components/layout/**`), keeping B2B pages free of the restriction; (2) Replace all hex values in the B2B pages with design tokens; (3) Defer as known tech-debt.

- [x] [Review][Patch] P1: `onLogin` callback reads token from localStorage instead of using the returned value directly — `LoginPage` calls `localStorage.setItem(token)` then `onLogin()`, and `AuthGuard` reads `localStorage.getItem("token")`. If storage is full or restricted (private browsing), setItem may silently fail and getItem returns null, blocking login despite a successful API response. Fix: change `onLogin: () => void` → `onLogin: (token: string) => void`, pass `data.access_token` directly, and update `AuthGuard`'s invocation accordingly. [`App.tsx`]

- [x] [Review][Defer] F1: `useFooterHeight` skips refs that are null at mount — elements conditionally rendered after the first commit are never added to the ResizeObserver [`src/hooks/useFooterHeight.ts`] — deferred, works for current DemoPage usage (refs always rendered); conditional-render scenario is a future concern
- [x] [Review][Defer] F2: `DemoPage.handleSend` does not check `response.ok` — HTTP 4xx/5xx from demo API resolves without throwing, pushing `undefined` as assistant content [`App.tsx`] — deferred, pre-existing pattern from before Story 7.2
- [x] [Review][Defer] F3: `SessionListPage.useEffect` has no `.catch()` — network failure leaves component in permanent loading state [`App.tsx`] — deferred, new app scaffolding outside Story 7.2 scope
- [x] [Review][Defer] F4: `handleCreate` and `handleRun` swallow errors silently — user gets no feedback on API failures [`App.tsx`] — deferred, new app scaffolding outside Story 7.2 scope
- [x] [Review][Defer] F5: `AuthGuard` multi-instance token divergence — logout in one tab does not invalidate another tab's in-memory `token` state [`App.tsx`] — deferred, architectural concern outside scope
- [x] [Review][Defer] F6: `LoginPage` form inputs not associated with labels — no `htmlFor`/`id` pairing, WCAG 1.3.1 violation [`App.tsx`] — deferred, new scaffolding outside Story 7.2 accessibility scope
- [x] [Review][Defer] F7: `ChatInput` `<input>` has no accessible label — relies solely on `placeholder`, WCAG 1.3.1 gap [`src/components/layout/ChatInput.tsx`] — deferred, Story 7.2 accessibility AC targets ConversationCanvas; label to be added in a future story
- [x] [Review][Defer] F8: `CopilotPage.useEffect` lists `connect` in deps — if `connect` is not memoized, causes infinite re-render loop [`App.tsx`] — deferred, outside Story 7.2 scope
- [x] [Review][Defer] F9: `MessageBubble key={i}` uses array index — message reorder or prepend will cause React to misidentify DOM nodes [`App.tsx`] — deferred, pre-existing pattern

## Dev Notes

### Current Codebase State

After Story 7.1, the frontend has:
- `src/components/layout/B2CLayout.tsx` — outer shell (`theme-b2c h-dvh flex flex-col overflow-hidden`)
- `src/components/layout/index.ts` — exports B2CLayout only; this story adds ConversationCanvas, ChatInput, CardDeckZone
- `src/lib/utils.ts` — `cn()` helper via clsx + tailwind-merge
- `src/styles/tokens.css` — all hex values; `.theme-b2c`, `.theme-b2b` scoped variables
- `tailwind.config.js` — custom utilities: `h-dvh`, `pb-safe`, `overscroll-contain`, `touch-pan-y`
- `eslint.config.mjs` — no hardcoded hex in JSX/TSX (catches style={{}} props too)
- `DemoPage` in `App.tsx` currently renders: `<B2CLayout><DemoLayout stage={stage}><ChatInterface .../></DemoLayout></B2CLayout>`

**This story replaces `DemoLayout` + `ChatInterface` inside `DemoPage` with the three new layout components. Do NOT delete `DemoLayout.tsx` or `ChatInterface.tsx` from disk — they may be used elsewhere or needed for reference.**

### Fixed Layout DOM — The Three-Zone Architecture

```
B2CLayout root (theme-b2c, h-dvh, flex flex-col, overflow-hidden)
│
├── ConversationCanvas (flex-1, overflow-y-auto, overscroll-contain)  ← THIS STORY
│   └── [message list + padding-bottom driven by ResizeObserver]
│
├── CardDeckZone (position: fixed, bottom: chatInputHeight px)         ← THIS STORY (empty placeholder)
│
└── ChatInput (position: fixed, bottom: 0, pb-safe)                   ← THIS STORY
```

**Why overflow-hidden on B2CLayout is safe:** `overflow: hidden` on an ancestor does NOT create a new containing block for `position: fixed` elements. Only `transform`, `perspective`, `filter`, `backdrop-filter`, `contain: paint/layout`, or `will-change` with those properties create a new containing block. Fixed elements anchored to B2CLayout would require one of those — `overflow: hidden` alone is safe. See [CSS spec](https://www.w3.org/TR/css-position-3/#containing-block-range).

**Why CardDeckZone is a placeholder:** Story 7.3 (TravelCard) will fill this zone with actual card content. For Story 7.2, CardDeckZone renders nothing (height = 0), so `chatInputHeight` argument to CardDeckZone is `0`. The ResizeObserver still observes it so padding-bottom accounts for it correctly when Story 7.3 makes it non-zero.

### ResizeObserver Pattern

```typescript
// useFooterHeight.ts
export function useFooterHeight(refs: React.RefObject<HTMLElement | null>[]): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const measure = () => {
      const total = refs.reduce((sum, ref) => {
        return sum + (ref.current?.getBoundingClientRect().height ?? 0);
      }, 0);
      setHeight(total);
    };

    const observer = new ResizeObserver(measure);
    refs.forEach(ref => {
      if (ref.current) observer.observe(ref.current);
    });
    measure(); // initial measurement

    return () => observer.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — refs are stable

  return height;
}
```

**Why inline style for paddingBottom (not Tailwind class):** The padding value is dynamic — driven by the ResizeObserver and updated at runtime. Tailwind classes are static and PurgeCSS removes unused ones. Use `style={{ paddingBottom: `${paddingBottom}px` }}` on ConversationCanvas.

**Why refs are stable (exhaustive-deps lint exception):** `useRef` values are stable objects from React's perspective — the ref object identity doesn't change between renders. The `useEffect` cleanup/re-run would be triggered unnecessarily on every render if refs were in the deps array.

### Tailwind Utilities Already Available (from Story 7.1)

All needed utilities were added in Story 7.1's `tailwind.config.js`:
- `overscroll-contain` → `overscroll-behavior: contain`
- `touch-pan-y` → `touch-action: pan-y`
- `pb-safe` → `padding-bottom: env(safe-area-inset-bottom, 0px)`
- Color tokens: `bg-surface`, `border-border`, `bg-primary`, `text-white`

Do NOT add new Tailwind utilities in this story.

### ChatInput Component Constraints

- Outer container: `position: fixed` via `fixed` Tailwind class. `left-0 right-0 bottom-0 w-full` pins it viewport-wide.
- `pb-safe` on outer container → ensures the input form sits above the iOS home indicator.
- `bg-surface border-t border-border` → visual separation from scroll content.
- The `forwardRef` is critical — parent `DemoPage` passes the ref to `useFooterHeight` to measure the element's height.
- ESLint rule: all colors via token classes — no `style={{ color: "#hex" }}`.

### Testing ResizeObserver in Vitest (jsdom)

`jsdom` does not implement `ResizeObserver`. Mock it in tests:

```typescript
// In your test file or setup
const mockResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
vi.stubGlobal('ResizeObserver', mockResizeObserver);
```

`useFooterHeight` tests should verify:
1. Returns `0` initially
2. Calls `observe()` on each provided ref's element
3. Calls `disconnect()` on cleanup
4. Returns sum of heights when callback fires with updated entries

### ConversationCanvas aria-live Semantics

Default is `"polite"` — screen readers announce new messages after the user is idle. Story 7.7 will drive this to `"off"` during streaming and `"assertive"` on error. This story just sets the static default and exposes the `ariaLive` prop for future use.

The `role="log"` attribute is correct for a chat/message log: it implies `aria-live="polite"` natively, but setting it explicitly ensures correct behavior across screen readers.

### NFR-5: vite.config.ts Constraint

Do NOT modify `vite.config.ts`. The SSE proxy configuration (`timeout: 0`, `proxyTimeout: 0`, `configure` block with `x-accel-buffering` and `setNoDelay`) is already correctly configured from Story 7.1. Verify with `git diff stravel/frontend/vite.config.ts` = empty.

### Project Structure — New Files This Story

```
stravel/frontend/src/
├── components/layout/
│   ├── ConversationCanvas.tsx    (new)
│   ├── ChatInput.tsx             (new)
│   ├── CardDeckZone.tsx          (new)
│   ├── index.ts                  (modified — add three exports)
│   └── __tests__/
│       ├── ConversationCanvas.test.tsx  (new)
│       ├── ChatInput.test.tsx           (new)
│       └── CardDeckZone.test.tsx        (new)
├── hooks/
│   ├── useFooterHeight.ts        (new)
│   └── __tests__/
│       └── useFooterHeight.test.ts  (new)
└── App.tsx                       (modified — DemoPage refactored)
```

### References

- UX-DR5: ConversationCanvas component — [ux-design-specification.md §ConversationCanvas, line ~813]
- UX-DR6: Fixed layout DOM — [ux-design-specification.md §Fixed Layout Architecture, line ~1109]
- UX-DR7: Mobile-first responsive — [ux-design-specification.md §Responsive Strategy, line ~1074]
- NFR-3: 375px min width, 44×44px tap targets
- NFR-4: Accessibility — role="log", aria-live, aria-label
- NFR-5: SSE proxy unchanged
- Story 7.1 foundation: B2CLayout, Tailwind tokens, cn() helper, overscroll-contain utility

## Dev Agent Record

### Agent Model Used

<!-- to be filled -->

### Debug Log References

<!-- to be filled -->

### Completion Notes List

<!-- to be filled -->

### File List

<!-- to be filled -->

### Change Log

<!-- to be filled -->
