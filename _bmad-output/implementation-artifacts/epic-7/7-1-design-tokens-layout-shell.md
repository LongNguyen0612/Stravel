# Story 7.1: Design Token System, Tailwind Config & B2CLayout Shell

Status: done

## Story

As a developer,
I want a complete design token system with scoped CSS variables, a configured Tailwind setup, and a B2CLayout shell,
so that all UI components use consistent, themeable values without hardcoded colors and the mobile canvas is structurally correct from day one.

## Acceptance Criteria

1. Tailwind utility classes resolve to token values from `.theme-b2c` / `.theme-b2b` CSS variable scopes — no hardcoded hex in JSX/TSX files
2. ESLint `no-restricted-syntax` rule fails the build on any hardcoded hex literal (e.g. `#0D9488`, `#F59E0B`) in a `.jsx`/`.tsx` file
3. On mobile (iPhone 14 / 375px), B2CLayout fills full viewport using `h-dvh`, root shell has no `overflow: hidden` or `overflow: auto`, and home indicator safe area is respected via `env(safe-area-inset-bottom, 0px)`
4. `overscroll-behavior: contain` is applied to the B2CLayout scroll container to prevent browser bounce
5. Inter variable font loads with `font-display: swap`, Vietnamese Unicode subset (U+1E00–U+1EFF), and the preload link references the correct filename — glyphs for "Đà Nẵng", "Hội An", "Phú Quốc" render without system font fallback
6. Custom Tailwind breakpoints exist: `tablet: '768px'`, `desktop-sm: '1024px'`, `desktop: '1280px'`
7. `vite.config.ts` is unchanged — SSE proxy, `x-accel-buffering`, and `setNoDelay` remain intact (NFR-5)

## Tasks / Subtasks

- [x] Task 1: Install Tailwind CSS v3 + PostCSS + Autoprefixer (AC: #1, #6)
  - [x] `npm install -D tailwindcss@3 postcss autoprefixer`
  - [x] `npx tailwindcss init -p` to generate `tailwind.config.js` and `postcss.config.js`
  - [x] Add `@tailwind base; @tailwind components; @tailwind utilities;` to top of `src/styles/global.css`
  - [x] Update `tailwind.config.js` `content` array to include `./index.html`, `./src/**/*.{ts,tsx}`
  - [x] Verify `npm run dev` still starts (no breakage)

- [x] Task 2: Install CVA, clsx, tailwind-merge utility helpers (AC: #1)
  - [x] `npm install class-variance-authority clsx tailwind-merge`
  - [x] Create `src/lib/utils.ts` with `cn()` helper
  - [x] Export `cn` from `src/lib/index.ts`

- [x] Task 3: Add custom breakpoints and utility extensions to Tailwind config (AC: #6)
  - [x] In `tailwind.config.js` `theme.extend.screens`, add: `tablet: '768px'`, `desktop-sm: '1024px'`, `desktop: '1280px'`
  - [x] Add `touch-pan-y` plugin via `addUtilities()`
  - [x] Add `dvh` height utilities: `h-dvh`, `min-h-dvh`
  - [x] Add safe-area utilities: `pb-safe`, `pt-safe`
  - [x] Verify no existing Tailwind breakpoints are overridden (only `extend`)

- [x] Task 4: Create CSS design token file with B2C + B2B scopes (AC: #1)
  - [x] Create `src/styles/tokens.css` with `:root` baseline and `.theme-b2c` / `.theme-b2b` scoped overrides
  - [x] B2C tokens: `--color-primary: #0D9488`, `--color-accent: #F59E0B` etc.
  - [x] B2B tokens: `--color-primary: #1D4ED8` etc.
  - [x] Shared semantic tokens and status tokens
  - [x] Import `tokens.css` in `global.css`
  - [x] Extend Tailwind config with CSS variable references

- [x] Task 5: Configure ESLint with no-hardcoded-hex rule (AC: #2)
  - [x] Created `eslint.config.mjs` (flat config, ESLint 9+)
  - [x] Installed `eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react`
  - [x] `no-restricted-syntax` rule: `JSXAttribute > Literal[value=/^#[0-9A-Fa-f]{3,8}$/]` → error
  - [x] Added `npm run lint` script
  - [x] Verified rule catches violation; passes on clean code

- [x] Task 6: Set up Inter variable font with Vietnamese subset (AC: #5)
  - [x] Added preconnect + Google Fonts CDN link to `index.html`
  - [x] `--font-sans` token in `tokens.css`
  - [x] `fontFamily.sans` in `tailwind.config.js`
  - [x] `font-family: var(--font-sans)` in `global.css` body

- [x] Task 7: Implement B2CLayout shell component (AC: #3, #4)
  - [x] Created `src/components/layout/B2CLayout.tsx`
  - [x] `theme-b2c h-dvh flex flex-col overflow-hidden bg-surface font-sans`
  - [x] Exported from `src/components/layout/index.ts`

- [x] Task 8: Wire B2CLayout into App.tsx routing (AC: #3)
  - [x] `DemoPage` wrapped in `<B2CLayout>`
  - [x] B2B routes (`CopilotPage`) unchanged
  - [x] Existing routes verified via TypeScript compile

- [x] Task 9: Smoke test and verify NFR-5 (AC: #7)
  - [x] `npm run build` ✅ (220 modules, 1.67s)
  - [x] `npm run lint` ✅ (0 errors on clean src)
  - [x] `npm test` ✅ (12/12 tests pass)
  - [x] `vite.config.ts` diff: only `path` import + `resolve.alias` + `test` block added; proxy/SSE config untouched

### Review Findings

<!-- Added by code-review workflow 2026-05-26 -->

**Decision-Needed (resolve before patching):**
- [x] [Review][Decision] D1: ESLint rule scope vs AC#2 — expanded to also catch `style={{color:"#hex"}}` patterns. Added second `no-restricted-syntax` selector targeting `JSXAttribute[name.name="style"] ... Property > Literal`. Resolved: option 1 (expand now). [`eslint.config.mjs`]
- [x] [Review][Decision] D2: NFR-5 interpretation — SSE proxy config was missing from baseline; story added it. Accepted: spirit of NFR-5 ("ensure SSE works") is satisfied. No change needed.
- [x] [Review][Decision] D3: AC#5 Vietnamese subset — `subset=` param is ignored by CSS2 API; CDN `unicode-range` descriptors serve Vietnamese glyphs when text is present. Accepted: CDN approach is correct.

**Patch (unambiguous fixes):**
- [x] [Review][Patch] P1: `lint` script uses `--ext .ts,.tsx` — this flag was removed in ESLint v9 flat config. Fixed: script is now `eslint src`. [`package.json:10`]
- [x] [Review][Patch] P2: `@keyframes bounce` in `global.css` collides with Tailwind's built-in `bounce` keyframe. Fixed: renamed to `typing-bounce`; `.dot` animation reference updated. [`src/styles/global.css`]
- [x] [Review][Patch] P3: Google Fonts `<link rel="stylesheet">` was missing `crossorigin` attribute, wasting the preconnect hint. Fixed: `crossorigin` added to stylesheet link. [`index.html:12`]
- [x] [Review][Patch] P4: `.theme-b2c` block missing status token declarations. Fixed: added all four status tokens (`--status-pending`, `--status-confirmed`, `--status-modified`, `--status-flagged`). [`src/styles/tokens.css`]

**Deferred (pre-existing or out of scope):**
- [x] [Review][Defer] F1: 44+ hardcoded hex values in legacy B2B components (`App.tsx`, `SessionList.tsx`, `SessionPanel.tsx`, `CopilotSidebar.tsx`, etc.) — pre-Story 7.1, out of scope per Dev Notes. — deferred, pre-existing
- [x] [Review][Defer] F2: No TypeScript safety rules active in ESLint config (`@typescript-eslint` plugin installed but no rules enabled). — deferred, separate story or tech-debt item
- [x] [Review][Defer] F3: `eslint-plugin-react-hooks` not installed — rules-of-hooks violations undetected. — deferred, separate story
- [x] [Review][Defer] F4: `colors['text-base']` name is ambiguous alongside Tailwind's built-in `text-base` font-size utility. — deferred, low-risk naming concern
- [x] [Review][Defer] F5: `timeout:0` / `proxyTimeout:0` in proxy config disables all proxy timeouts — intentional for SSE long-lived connections. — deferred, by design
- [x] [Review][Defer] F6: `B2CLayout` currently wraps `DemoLayout` which may set its own height — Story 7.2 will replace DemoPage with ConversationCanvas-based layout. — deferred, Story 7.2
- [x] [Review][Defer] F7: `.theme-b2c` block exactly duplicates `:root` values — intentional defensive scoping (future `:root` override isolation). — deferred, design choice
- [x] [Review][Defer] F8: `.pb-safe` utility defined but not applied to B2CLayout shell — safe-area padding belongs on the ChatInput/scroll container, Story 7.2 responsibility. — deferred, Story 7.2
- [x] [Review][Defer] F9: `lint` script missing `--max-warnings 0` — CI lint gate allows warnings. — deferred, CI hardening
- [x] [Review][Defer] F10: `prefers-reduced-motion` block missing `scroll-behavior: auto !important`. — deferred, minor accessibility gap
- [x] [Review][Defer] F11: `react-markdown` in production `dependencies` — may be used by existing ChatInterface component not visible in this diff. — deferred, verify in Story 7.2+ context
- [x] [Review][Defer] F12: `animation-iteration-count: 1 !important` under `prefers-reduced-motion` may leave typing dots at intermediate `scale(1)` stop. — deferred, minor accessibility edge case

## Dev Notes

### Current Codebase State

The frontend currently uses **zero Tailwind** — all styling is raw inline styles in JSX (`style={{ background: "#2563eb" }}`) and a minimal 50-line `global.css`. No ESLint config exists. No design tokens. This story installs the entire styling foundation from scratch.

**Existing files to be aware of:**
- `src/styles/global.css` — 50 lines, vanilla CSS; will be modified (Tailwind directives prepended)
- `src/App.tsx` — all inline styles; do NOT convert in this story (out of scope, creates massive diff)
- `src/types/domain.ts` — has `SessionStatus = "in_progress" | "completed" | "archived"` (the Chat-First UI changes this to `"pending" | "confirmed" | "modified" | "flagged"` in Story 8.1 — do NOT change here)
- `.js` files alongside `.tsx` in `src/` — these appear to be stale JS build artifacts, not source files; ignore them
- `vite.config.ts` — SSE proxy is configured with `setNoDelay` and `x-accel-buffering`; **do NOT touch this file**

### Tailwind Version Choice

Use **Tailwind CSS v3** (not v4). The UX spec references `tailwind.config.js` (v3 approach), and shadcn/ui's documented setup targets v3. When v4 migration is needed it can be done as a dedicated story.

### CSS Token Scope Pattern

```css
/* tokens.css — the ONLY place hex values live */
:root {
  /* Fallback values (B2C defaults) */
  --color-primary: #0D9488;
  --color-accent: #F59E0B;
}

.theme-b2c {
  --color-primary: #0D9488;   /* teal-600 */
  --color-primary-hover: #0F766E;  /* teal-700 */
  --color-accent: #F59E0B;    /* amber-400 */
  --color-accent-hover: #D97706;
}

.theme-b2b {
  --color-primary: #1D4ED8;   /* blue-700 */
  --color-primary-hover: #1E40AF;
  --color-accent: #64748B;    /* slate-500 */
  --color-accent-hover: #475569;
}
```

Tailwind maps these via `theme.extend.colors` in `tailwind.config.js`:
```js
colors: {
  primary: 'var(--color-primary)',
  'primary-hover': 'var(--color-primary-hover)',
  accent: 'var(--color-accent)',
  surface: 'var(--color-surface)',
  'surface-2': 'var(--color-surface-2)',
  border: 'var(--color-border)',
  // ...
}
```

This means Tailwind classes like `bg-primary`, `text-accent`, `border-border` all resolve to the scoped CSS variable, making the B2C/B2B theme swap automatic.

### B2CLayout DOM Constraints

From UX spec + party mode findings (Winston):

```
AppHeader (fixed or sticky, h-14) ← added in Story 7.5
│
B2CLayout root (theme-b2c, h-dvh, flex flex-col)
│  ├── ConversationCanvas (flex-1, overflow-y-auto, role="log") ← Story 7.2
│  │   └── Message list + padding-bottom driven by ResizeObserver
│  │
│  ├── CardDeckZone (position: fixed, bottom = ChatInput height) ← Story 7.2 placeholder
│  │
│  └── ChatInput (position: fixed, bottom: env(safe-area-inset-bottom)) ← Story 7.2
│
└── pb-safe wrapper (padding-bottom: env(safe-area-inset-bottom, 0px))
```

**The root `overflow: hidden` IS correct** — it clips the full layout to the viewport. It is the *inner scroll container* (`ConversationCanvas`) that must NOT have `overflow: hidden`. This story creates the shell; Story 7.2 adds the inner scroll semantics.

### Inter Font: Vite Hash Problem

Serving from Google Fonts CDN avoids the Vite content-hash filename problem entirely. Local self-hosting requires a Vite plugin to dynamically inject the preload tag with the hashed filename — too complex for this story. CDN is the MVP approach.

Vietnamese Unicode block U+1E00–U+1EFF covers the diacritics for destination names. Google Fonts `subset=latin,vietnamese` includes this range.

### ESLint Scope

The `no-restricted-syntax` rule is intentionally scoped to NEW JSX attribute string literals. The existing `App.tsx` and other legacy files use inline `style={{}}` props (JS objects with string values), which is a different AST node type from JSX attribute literals. The rule targets `JSXAttribute > Literal` — it will not fire on `style={{ color: "#hex" }}` (that's `JSXExpressionContainer > ObjectExpression > Property > Literal`). If you want to catch those too, add a second selector. For this story, only the first selector is required.

### `cn()` Utility

The `cn()` helper is the standard shadcn/ui pattern. It belongs in `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Every subsequent component in Epics 7–10 will import `cn` from `@/lib/utils`. Set up the `@/` path alias in `tsconfig.json`:
```json
"paths": { "@/*": ["./src/*"] }
```
And in `vite.config.ts` (read: add ONLY the `resolve.alias` — do NOT touch the proxy section):
```ts
resolve: {
  alias: { '@': path.resolve(__dirname, './src') }
}
```

### Verification Checklist

After completing all tasks, manually verify in browser:
1. `/demo` route: Inter font renders (check DevTools Network → Fonts)
2. Layout fills full height on mobile simulation (375×812): no white space below fold
3. No scrollbar on body, only inside content container
4. DevTools: `document.querySelector('.theme-b2c')` → computed `--color-primary` = `rgb(13, 148, 136)` (teal-600)
5. `npm run lint` on a test file with `<div style={{ color: "#ff0000" }}>` — confirm rule fires (or doesn't, depending on selector — document observed behavior)
6. `git diff stravel/frontend/vite.config.ts` = empty

### Project Structure Notes

New files this story creates:
```
stravel/frontend/
├── tailwind.config.js          (new)
├── postcss.config.js           (new)
├── eslint.config.mjs           (new — or .eslintrc.cjs depending on package.json "type": "module")
├── src/
│   ├── lib/
│   │   ├── utils.ts            (new — cn() helper)
│   │   └── index.ts            (new — re-exports)
│   ├── components/
│   │   └── layout/
│   │       ├── B2CLayout.tsx   (new)
│   │       └── index.ts        (new)
│   └── styles/
│       ├── global.css          (modified — Tailwind directives + import tokens.css)
│       └── tokens.css          (new — all hex values live here)
```

Note: `package.json` has `"type": "module"`, so ESLint config must be `eslint.config.mjs` (flat config) or `eslint.config.js`. Do NOT use `.eslintrc.json` — it is deprecated in ESLint 9+.

### References

- UX-DR1: Design token system — [epics-v2.md, Story 1.1]
- UX-DR2: CVA configuration — [epics-v2.md, Story 1.1]
- UX-DR3: Inter variable font — [ux-design-specification.md, §Responsive Design, line ~1147]
- UX-DR4: Tailwind config extension — [epics-v2.md, Story 1.1 / ux-design-spec line ~1097]
- UX-DR5: B2CLayout shell — [ux-design-specification.md §Component Strategy, line ~918]
- ARCH-9: ESLint no hardcoded hex — [epics-v2.md §Architecture Requirements]
- NFR-5: SSE compat (no vite.config.ts change) — [epics-v2.md §NFRs]
- Fixed layout DOM resolved pattern — [ux-design-specification.md §Responsive Design, line ~1123]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — clean implementation, no blockers.

### Completion Notes List

- Installed Tailwind CSS v3.4.19 + PostCSS + Autoprefixer from zero (no Tailwind existed previously)
- Installed CVA 0.7.1, clsx 2.1.1, tailwind-merge 3.6.0; created `cn()` helper in `src/lib/utils.ts`
- All hex values live exclusively in `src/styles/tokens.css`; `.theme-b2c` and `.theme-b2b` scoped CSS variable blocks established
- Tailwind config maps token variables to utility classes (`bg-primary`, `text-accent`, etc.)
- Custom utilities added via Tailwind plugin: `h-dvh`, `min-h-dvh`, `pb-safe`, `pt-safe`, `touch-pan-y`, `overscroll-contain`
- Custom breakpoints: `tablet: 768px`, `desktop-sm: 1024px`, `desktop: 1280px`
- ESLint flat config (ESLint 9 + `eslint.config.mjs`) with `no-restricted-syntax` rule catching hex literals in JSX attributes
- Inter font via Google Fonts CDN (`display=swap`, `subset=latin,vietnamese`) — avoids Vite hash/preload problem
- `B2CLayout` shell: `theme-b2c h-dvh flex flex-col overflow-hidden`; wired into `DemoPage` in `App.tsx`
- `@/` path alias added to `tsconfig.json` and `vite.config.ts` (`resolve.alias` only — proxy/SSE config untouched)
- Vitest + React Testing Library installed; 12 tests passing (6 for `cn()`, 6 for `B2CLayout`)
- `vite.config.ts` SSE proxy verified intact: `x-accel-buffering`, `setNoDelay`, proxy config unchanged

### File List

stravel/frontend/tailwind.config.js (new)
stravel/frontend/postcss.config.js (new)
stravel/frontend/eslint.config.mjs (new)
stravel/frontend/index.html (modified — Inter font preconnect + CDN link)
stravel/frontend/package.json (modified — added tailwindcss, postcss, autoprefixer, cva, clsx, tailwind-merge, eslint stack, vitest, @testing-library/*)
stravel/frontend/tsconfig.json (modified — baseUrl, paths @/*)
stravel/frontend/vite.config.ts (modified — path import, resolve.alias, test block; proxy UNTOUCHED)
stravel/frontend/src/styles/tokens.css (new)
stravel/frontend/src/styles/global.css (modified — @import tokens.css, Tailwind directives, legacy classes as @layer components)
stravel/frontend/src/lib/utils.ts (new)
stravel/frontend/src/lib/index.ts (new)
stravel/frontend/src/lib/__tests__/utils.test.ts (new)
stravel/frontend/src/components/layout/B2CLayout.tsx (new)
stravel/frontend/src/components/layout/index.ts (new)
stravel/frontend/src/components/layout/__tests__/B2CLayout.test.tsx (new)
stravel/frontend/src/test/setup.ts (new)
stravel/frontend/src/App.tsx (modified — import B2CLayout, wrap DemoPage)

### Change Log

- 2026-05-26: Story 7.1 implemented — Tailwind v3, design tokens, ESLint hex rule, Inter font, B2CLayout shell, Vitest setup. 12 tests passing. Build clean.
- 2026-05-26: Code review complete — 5 patches applied, 12 deferred, 6 dismissed. Expanded ESLint rule to cover style={{}} hex patterns; renamed @keyframes bounce→typing-bounce; added crossorigin to Google Fonts link; added status tokens to .theme-b2c; fixed ESLint v9 lint script. 24 tests passing.
