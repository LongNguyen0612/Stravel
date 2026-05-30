# Story 7.3: TravelCard Component (State Machine + Accessibility)

Status: done

## Story

As a traveler,
I want to see AI-generated travel cards animate from a shimmering placeholder to a complete card,
So that I understand the AI is building my trip in real time and I know when each part of my proposal is ready to review.

## Acceptance Criteria

1. **Given** a TravelCard is in `nascent` state (`completenessScore < 0.25`)
   **When** it renders
   **Then** it shows an amber shimmer animation on skeleton fields, has no tap affordance, and does not respond to user interaction

2. **Given** a TravelCard transitions to `forming` state (`0.25 ≤ score < 0.75`)
   **When** the transition fires
   **Then** structural fields populate, the border is `border-amber-200`, the card renders at `scale-[0.98]`, and `CompletenessIndicator` shows amber-400

3. **Given** a TravelCard transitions from `forming` → `settled` (`completenessScore ≥ 0.75` AND `isFinal: true`)
   **When** the transition fires
   **Then** the card animates with the 420ms spring `cubic-bezier(0.34, 1.56, 0.64, 1)` across box-shadow/border/opacity/scale, border transitions to `border-slate-200`, scale to `scale-100`, and `CompletenessIndicator` turns `text-status-confirmed` (teal)

4. **Given** `prefers-reduced-motion: reduce` is set
   **When** a card transitions state
   **Then** the spring animation is replaced by an instant state change + 150ms opacity fade (`transition: opacity 150ms ease-out`)

5. **Given** a TravelCard has been in `nascent` state for > 90 seconds without a `completenessScore` update
   **When** the timeout fires
   **Then** the card renders an amber error variant with "Taking longer than expected" text and a [Try again] ghost button; the `onRetry` callback fires when the button is tapped

6. `touch-action: pan-y` is set on the TravelCard container; horizontal swipes are not captured by the browser

7. All four card types are implemented — `flight`, `hotel`, `activities`, `visa` — each with its own field grid layout showing structural fields in `forming` and both structural + evaluative fields in `settled`

8. TravelCard has `role="article"`, `aria-label="[type] card, [n]% complete"`, and a visually-hidden child `<span>` carrying `aria-live="polite"` for completeness updates (NOT on the card root)

9. `will-change: transform` on nascent shimmer is gated via a `shimmerEnabled` prop — maximum 3 simultaneous nascent TravelCards should have `shimmerEnabled={true}` (enforced by CardDeck in a future story; Story 7.3 implements the prop interface only)

## Tasks / Subtasks

- [x] Task 1: Add `transition-card-settle` Tailwind utility and reduced-motion CSS (AC: #3, #4)
  - [x] In `tailwind.config.js` `addUtilities`, add `.transition-card-settle` — the 4-property spring transition
  - [x] In `src/styles/global.css`, add `@media (prefers-reduced-motion: reduce) { .transition-card-settle { transition: opacity 150ms ease-out !important; } }`
  - [x] No new dependencies — uses existing Tailwind plugin + global.css patterns from Story 7.1
  - [x] `npm run build` still passes after config change

- [x] Task 2: Create CardData types and `cardDisplayState` utility (AC: #1, #2, #3, #7)
  - [x] Create `src/components/cards/cardUtils.ts`
  - [x] Export `CardState = 'nascent' | 'forming' | 'settled' | 'error'`
  - [x] Export `CardType = 'flight' | 'hotel' | 'activities' | 'visa'`
  - [x] Export typed interfaces: `FlightCardData`, `HotelCardData`, `ActivityCardData`, `VisaCardData`, and union `CardData`
  - [x] Export pure function `cardDisplayState(score: number, isFinal: boolean): Exclude<CardState, 'error'>` — returns `'nascent' | 'forming' | 'settled'` based on score + isFinal guard
  - [x] Write tests: `__tests__/cardUtils.test.ts` — all state boundaries (0, 0.24, 0.25, 0.74, 0.75+) with both `isFinal` values

- [x] Task 3: Create `CompletenessIndicator` component (AC: #2, #3)
  - [x] Create `src/components/cards/CompletenessIndicator.tsx`
  - [x] Props: `score: number`, `state: CardState`, `className?: string`
  - [x] Renders a `<div role="progressbar" aria-valuenow={Math.round(score*100)} aria-valuemin={0} aria-valuemax={100}>` with an inner fill bar
  - [x] Fill bar color: `bg-status-pending` (amber) when `state !== 'settled'`; `bg-status-confirmed` (teal) when `state === 'settled'`
  - [x] Width: `style={{ width: \`${Math.round(score * 100)}%\` }}` (inline style — dynamic value)
  - [x] Write tests: `__tests__/CompletenessIndicator.test.tsx` — renders progressbar role, correct aria values, amber vs teal class by state

- [x] Task 4: Create `TravelCard` component (AC: #1–#9)
  - [x] Create `src/components/cards/TravelCard.tsx`
  - [x] Props interface (see Dev Notes below for full definition)
  - [x] Use `cva` for state variants (`nascent | forming | settled | error`) and type variants (`flight | hotel | activities | visa`)
  - [x] **Nascent state**: amber shimmer on skeleton divs; `will-change: transform` only when `shimmerEnabled={true}`; pointer-events-none on card body; `animate-shimmer bg-gradient-to-r from-surface via-surface-2 to-surface bg-[length:200%_100%]`
  - [x] **Forming state**: structural fields visible; `border border-amber-200 scale-[0.98]`; evaluative fields hidden with `invisible`; `transition-card-settle` class applied
  - [x] **Settled state**: all fields visible; `border border-slate-200 scale-100 shadow-md`; edit icon appears; `transition-card-settle` class applied
  - [x] **Error state**: amber border + amber-50 bg; "Taking longer than expected" message; `<button>Try again</button>` ghost button calling `onRetry`
  - [x] 90-second stall timeout: `useEffect` sets timeout on mount when state is `nascent`; clears on prop change or unmount; fires `setIsStalled(true)` → renders error state
  - [x] Reset stall timeout on `completenessScore` change
  - [x] `role="article"`, `aria-label={\`${cardType} card, ${Math.round(completenessScore * 100)}% complete\`}`
  - [x] Visually-hidden `<span className="sr-only" aria-live="polite">` updates with `${Math.round(completenessScore * 100)}% complete`
  - [x] `touch-pan-y` class on outer container
  - [x] Card anatomy: `CardHeader` (icon + type label + CompletenessIndicator) → `CardBody` (type-specific field grid) → `CardActions` (edit icon settled-only; book CTA settled + committing only) → `CardFooter` (timestamp forming+)
  - [x] Write tests: `__tests__/TravelCard.test.tsx` — all four states, all four card types, 90s timeout (vi.useFakeTimers), aria attributes, error state + retry, shimmerEnabled prop

- [x] Task 5: Create `src/components/cards/index.ts` exports (AC: all)
  - [x] Export `TravelCard`, `CompletenessIndicator`, `cardDisplayState`, `CardState`, `CardType`, `CardData`, `FlightCardData`, `HotelCardData`, `ActivityCardData`, `VisaCardData`

- [x] Task 6: Update `DemoPage` in `App.tsx` to wire real `chatInputHeight` and show a demo TravelCard (AC: #1, #2)
  - [x] Split `useFooterHeight` calls: add `const chatInputHeight = useFooterHeight([chatInputRef])` (ChatInput height only)
  - [x] Keep `const footerHeight = useFooterHeight([chatInputRef, cardDeckRef])` (total for ConversationCanvas padding)
  - [x] Pass `chatInputHeight={chatInputHeight}` (not `0`) to `CardDeckZone`
  - [x] Import `TravelCard` from `@/components/cards`
  - [x] Add demo state: `const [demoScore, setDemoScore] = useState(0.1)` and a button to cycle through states for visual testing
  - [x] Render `<TravelCard cardId="demo" cardType="flight" completenessScore={demoScore} isFinal={demoScore >= 0.75} delta={{}} deckState="browsing" shimmerEnabled={true} />` as child of `CardDeckZone`
  - [x] `npm run build` passes after App.tsx changes

- [x] Task 7: Run full test suite and validate all ACs (AC: #1–#9)
  - [x] `npm test` — 166/166 tests pass (80 from Stories 7.1–7.2 + 43 new + 43 pre-existing)
  - [x] `npm run lint` — clean
  - [x] `npm run build` — clean (227 modules, 1.83s)
  - [x] `vite.config.ts` unchanged in Story 7.3 — pre-existing Story 7.1 diff only (verified)

## Dev Notes

### Current Codebase State (after Story 7.2)

```
stravel/frontend/src/
├── components/
│   ├── layout/
│   │   ├── B2CLayout.tsx          — outer shell (theme-b2c, h-dvh, flex flex-col, overflow-hidden)
│   │   ├── ConversationCanvas.tsx — flex-1 scroll, role="log", aria-live, dynamic paddingBottom
│   │   ├── CardDeckZone.tsx       — position:fixed, forwardRef, bottom: chatInputHeight px
│   │   ├── ChatInput.tsx          — position:fixed bottom-0, forwardRef, pb-safe
│   │   └── index.ts               — exports all four
│   ├── shared/
│   │   ├── MessageBubble.tsx      — user/agent bubble
│   │   ├── TypingIndicator.tsx    — animated dots
│   │   └── ComplianceBadge.tsx    — bg-status-* token classes
│   └── cards/                    ← THIS STORY creates this directory
├── hooks/
│   ├── useFooterHeight.ts         — ResizeObserver sum hook
│   └── useStreamContext.ts
├── styles/
│   ├── tokens.css                 — all hex values, .theme-b2c and .theme-b2b
│   └── global.css                 — shimmer, typing-bounce, base styles
├── lib/utils.ts                   — cn() helper
└── App.tsx                        — DemoPage uses three-zone layout
```

**Tests at start of story:** 80/80 passing. New story adds components with full test coverage.

### Three-Zone Layout — Where TravelCard Lives

```
B2CLayout root  (theme-b2c, h-dvh, flex flex-col, overflow-hidden)
├── ConversationCanvas  (flex-1, overflow-y-auto)
│   └── [messages + padding-bottom = footerHeight]
│
├── CardDeckZone  (fixed, bottom: chatInputHeight px)  ← TravelCard renders here
│   └── <TravelCard ... />   ← Story 7.3 fills this slot
│
└── ChatInput  (fixed, bottom-0)
```

`CardDeckZone` is already `forwardRef`-wrapped and connected to `useFooterHeight` via `cardDeckRef`. When TravelCard makes CardDeckZone non-zero height, `useFooterHeight` will automatically update `footerHeight` → `ConversationCanvas.paddingBottom` adjusts. **No changes to CardDeckZone or useFooterHeight are needed.**

### DemoPage chatInputHeight Fix (Task 6)

Story 7.2 hardcoded `chatInputHeight={0}` because CardDeckZone was empty. Story 7.3 must wire the real ChatInput height:

```tsx
// Before (Story 7.2):
const footerHeight = useFooterHeight([chatInputRef, cardDeckRef]);
// ...
<CardDeckZone ref={cardDeckRef} chatInputHeight={0} />

// After (Story 7.3):
const chatInputHeight = useFooterHeight([chatInputRef]);        // ChatInput height only
const footerHeight = useFooterHeight([chatInputRef, cardDeckRef]); // total
// ...
<CardDeckZone ref={cardDeckRef} chatInputHeight={chatInputHeight} />
```

Two separate hook calls → two separate ResizeObservers. This is intentional and correct.

### TravelCard Props Interface

```typescript
export interface TravelCardProps {
  cardId: string;
  cardType: CardType;                     // 'flight' | 'hotel' | 'activities' | 'visa'
  completenessScore: number;              // 0–1, drives state via cardDisplayState()
  isFinal: boolean;                       // from SSE envelope (Story 7.4 wires backend)
  delta: Partial<CardData>;              // incremental field data
  deckState: 'browsing' | 'committing'; // injected by CardDeck (future story)
  shimmerEnabled?: boolean;              // default true; CardDeck sets false beyond 3 nascent
  onEdit?: () => void;                   // only called when settled
  onBook?: () => void;                   // only called when settled + committing
  onRetry?: () => void;                  // called on error state [Try again] tap
  className?: string;
}
```

### CardData Types — Structural vs. Evaluative Split

**Structural fields** (visible in `forming` + `settled`):
- Flight: `origin`, `destination`, `departDate`, `returnDate`
- Hotel: `neighborhood`, `starRange`
- Activity: `category`, `cityZone`
- Visa: `destinationCountry`, `nationality`

**Evaluative fields** (visible in `settled` only):
- Flight: `airline`, `price`, `flightTimes`
- Hotel: `name`, `nightlyRate`
- Activity: `venue`, `hours`, `cost`
- Visa: `processingTime`, `fee`

```typescript
export interface FlightCardData {
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  airline?: string;
  price?: number;
  flightTimes?: string;
}

export interface HotelCardData {
  neighborhood?: string;
  starRange?: string;
  name?: string;
  nightlyRate?: number;
}

export interface ActivityCardData {
  category?: string;
  cityZone?: string;
  venue?: string;
  hours?: string;
  cost?: number;
}

export interface VisaCardData {
  destinationCountry?: string;
  nationality?: string;
  processingTime?: string;
  fee?: number;
}

export type CardData = FlightCardData | HotelCardData | ActivityCardData | VisaCardData;
```

### `cardDisplayState` — The Single Source of Truth

```typescript
export function cardDisplayState(
  score: number,
  isFinal: boolean
): Exclude<CardState, 'error'> {
  if (score >= 0.75 && isFinal) return 'settled';
  if (score >= 0.25) return 'forming';
  return 'nascent';
}
```

**Note:** `error` state is driven by the 90-second stall timeout, NOT by this function. The timeout is internal `TravelCard` state via `useEffect`.

**State boundaries for testing:**
- `score=0, isFinal=false` → `'nascent'`
- `score=0.249, isFinal=false` → `'nascent'`
- `score=0.25, isFinal=false` → `'forming'`
- `score=0.749, isFinal=false` → `'forming'`
- `score=0.75, isFinal=false` → `'forming'` (score ≥ 0.75 BUT isFinal=false → still forming)
- `score=0.75, isFinal=true` → `'settled'`
- `score=1.0, isFinal=true` → `'settled'`
- `score=1.0, isFinal=false` → `'forming'` (race condition guard — no settle without is_final)

### CVA Usage (already installed: `class-variance-authority`)

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const cardVariants = cva(
  // base classes
  'relative rounded-xl border p-4 touch-pan-y',
  {
    variants: {
      state: {
        nascent: 'border-border bg-surface-2 pointer-events-none scale-[0.98]',
        forming: 'border-amber-200 bg-surface scale-[0.98] transition-card-settle',
        settled: 'border-slate-200 bg-surface scale-100 shadow-md transition-card-settle',
        error:   'border-status-pending bg-amber-50',
      },
      // card type used for icon/label differentiation (not border changes)
    },
  }
);
```

**No hardcoded hex** — `border-amber-200` and `border-slate-200` are Tailwind's built-in color utilities (not custom tokens), which is safe — they don't map to CSS variables that the ESLint rule covers. The ESLint rule bans `#hex` literal strings, not Tailwind color class names. ✓

### `transition-card-settle` CSS Utility (Task 1)

Add to `tailwind.config.js` inside `addUtilities`:

```javascript
'.transition-card-settle': {
  transition: [
    'box-shadow 420ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    'border-color 420ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    'opacity 360ms ease-out 60ms',
    'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  ].join(', '),
},
```

Add reduced-motion override to `src/styles/global.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .transition-card-settle {
    transition: opacity 150ms ease-out !important;
  }
}
```

### Shimmer Skeleton Markup (Nascent State)

```tsx
// Shimmer field placeholder — reuse for each skeleton line
<div
  className={cn(
    'h-4 rounded bg-gradient-to-r from-surface via-surface-2 to-surface bg-[length:200%_100%]',
    shimmerEnabled ? 'animate-shimmer' : '',
    shimmerEnabled ? 'will-change-transform' : ''
  )}
/>
```

`animate-shimmer` and the `shimmer` keyframe are already in `tailwind.config.js` from Story 7.1.

`will-change-transform` is Tailwind's built-in utility for `will-change: transform`. Use it; don't write it inline.

### 90-Second Stall Timeout

```typescript
const STALL_TIMEOUT_MS = 90_000;

// Inside TravelCard component:
const [isStalled, setIsStalled] = useState(false);
const lastScoreRef = useRef(completenessScore);

useEffect(() => {
  // Reset stall flag when score changes
  if (completenessScore !== lastScoreRef.current) {
    lastScoreRef.current = completenessScore;
    setIsStalled(false);
  }
}, [completenessScore]);

useEffect(() => {
  const state = cardDisplayState(completenessScore, isFinal);
  if (state !== 'nascent') return; // only time-out nascent cards

  const timer = setTimeout(() => setIsStalled(true), STALL_TIMEOUT_MS);
  return () => clearTimeout(timer);
}, [completenessScore, isFinal]); // re-arm on score change
```

**Test pattern** (vi.useFakeTimers):
```typescript
vi.useFakeTimers();
render(<TravelCard ... completenessScore={0.1} isFinal={false} />);
vi.advanceTimersByTime(90_001);
expect(screen.getByText('Taking longer than expected')).toBeInTheDocument();
```

### Accessibility Requirements

```tsx
<div
  role="article"
  aria-label={`${cardType} card, ${Math.round(completenessScore * 100)}% complete`}
  className={cn(cardVariants({ state: displayState }), 'touch-pan-y', className)}
>
  {/* Visually-hidden live region — NOT on the root */}
  <span className="sr-only" aria-live="polite">
    {Math.round(completenessScore * 100)}% complete
  </span>

  {/* CardHeader, CardBody, CardActions, CardFooter... */}
</div>
```

**`sr-only` class** — this is a Tailwind built-in utility (visually hides but keeps accessible). It IS available without any custom configuration.

**`aria-live="polite"` on the inner `<span>`** — NOT on the card root. Screen readers only announce the completeness percentage updates, not the entire card re-render.

### CardType Icons (No External Library)

Use inline SVG or emoji placeholders for card type icons in `CardHeader`. For Story 7.3, emoji icons are acceptable:
- `flight` → ✈️ (`✈️`)
- `hotel` → 🏨 (`Ἶ8`)
- `activities` → 🎯 (`ἺF`)
- `visa` → 🛂 (`Ὤ2`)

Do NOT add a new icon library dependency for this story.

### Testing `prefers-reduced-motion` in Vitest

```typescript
// Mock matchMedia to simulate reduced motion
window.matchMedia = vi.fn().mockImplementation((query) => ({
  matches: query === '(prefers-reduced-motion: reduce)',
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));
```

The CSS media query behavior itself isn't testable in jsdom, but the `transition-card-settle` class application and the relevant class presence can be verified.

### NFR-5: vite.config.ts Unchanged

Do NOT modify `vite.config.ts`. Verify with `git diff stravel/frontend/vite.config.ts` = empty after all tasks.

### Project Structure — New Files This Story

```
stravel/frontend/src/
├── components/cards/               ← NEW DIRECTORY
│   ├── TravelCard.tsx              (new)
│   ├── CompletenessIndicator.tsx   (new)
│   ├── cardUtils.ts                (new)
│   ├── index.ts                    (new)
│   └── __tests__/
│       ├── TravelCard.test.tsx     (new)
│       ├── CompletenessIndicator.test.tsx (new)
│       └── cardUtils.test.ts       (new)
├── styles/
│   └── global.css                  (modified — add reduced-motion rule)
└── App.tsx                         (modified — chatInputHeight wiring + demo TravelCard)
tailwind.config.js                  (modified — add .transition-card-settle utility)
```

### References

- UX-DR8: TravelCard states — [ux-design-specification.md §Custom Components §TravelCard]
- UX-DR9: CompletenessIndicator — [ux-design-specification.md §CompletenessIndicator]
- UX-DR19: Reduced motion — [ux-design-specification.md §Responsive Design §Reduced motion]
- UX-DR21: touch-action, swipe affordance — [ux-design-specification.md §touch-action on TravelCard]
- UX-DR23: Shimmer will-change concurrency — [ux-design-specification.md §Performance]
- ARCH-5: `is_final` flag — gating condition for `settled` transition; Story 7.4 wires backend
- Story 7.2: CardDeckZone placeholder, three-zone layout, useFooterHeight pattern
- Story 7.4 (next): SSE heartbeat + `is_final` card envelope — Story 7.3's `isFinal` prop comes from there

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- TravelCard timeout tests needed `act()` wrapper around `vi.advanceTimersByTime()` to flush React state updates
- Footer text test needed `container.querySelector` to disambiguate sr-only span from footer div (both contain "N% complete")

### Completion Notes List

- Task 1: `transition-card-settle` utility added to `tailwind.config.js`; reduced-motion override added to `global.css`
- Task 2: `cardUtils.ts` created with all types + `cardDisplayState` pure function; 12 boundary tests pass
- Task 3: `CompletenessIndicator.tsx` created; 10 tests pass — progressbar role, amber/teal fill by state
- Task 4: `TravelCard.tsx` created with `cva` state variants, 90s stall timeout, all 4 card types, full a11y; 21 tests pass
- Task 5: `src/components/cards/index.ts` created with all exports
- Task 6: `DemoPage` updated — split `useFooterHeight` into `chatInputHeight` + `footerHeight`, demo TravelCard in CardDeckZone
- Task 7: 166/166 tests pass, lint clean, build clean (227 modules)

### File List

- `stravel/frontend/tailwind.config.js` — modified: added `.transition-card-settle` utility
- `stravel/frontend/src/styles/global.css` — modified: added prefers-reduced-motion override for `.transition-card-settle`
- `stravel/frontend/src/components/cards/cardUtils.ts` — new
- `stravel/frontend/src/components/cards/CompletenessIndicator.tsx` — new
- `stravel/frontend/src/components/cards/TravelCard.tsx` — new
- `stravel/frontend/src/components/cards/index.ts` — new
- `stravel/frontend/src/components/cards/__tests__/cardUtils.test.ts` — new
- `stravel/frontend/src/components/cards/__tests__/CompletenessIndicator.test.tsx` — new
- `stravel/frontend/src/components/cards/__tests__/TravelCard.test.tsx` — new
- `stravel/frontend/src/App.tsx` — modified: split useFooterHeight, demo TravelCard in CardDeckZone

### Change Log

- 2026-05-26: Story 7.3 implemented — TravelCard state machine, CompletenessIndicator, cardUtils; 43 new tests; 166 total passing
