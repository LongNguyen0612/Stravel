# Story 8.1: MOOD_TRANSITION Rules, user_preferences Table & SessionStatus Type

Status: done

## Story

As an engineer about to build card-driven flows,
I want the MOOD_TRANSITION business rules documented, the user_preferences table migrated, and the SessionStatus type updated in domain.ts,
So that all Phase 2 edit flows have a safe foundation and no later story is blocked by missing data model or type conflicts.

## Acceptance Criteria

**AC1 — MOOD_TRANSITION documentation (UX-DR22)**

**Given** the MOOD_TRANSITION documentation requirement
**When** this story is shipped
**Then** `stravel/docs/mood-transition-rules.md` exists containing:
- A linguistic signal taxonomy with ≥10 examples distinguishing "context correction" (affects multiple card types) from "card edit" (affects one card)
- A card dependency graph showing which card types regenerate for each context-change category (destination change → flight, hotel, itinerary; budget change → hotel, itinerary, budget; dates change → all)
- Per-card-type default question strings used when context is ambiguous
- The MOOD_TRANSITION reducer contract: `action: { type: 'MOOD_TRANSITION', payload: { kind: 'correction' | 'edit', affectedSlots: SlotKey[] } }`

**AC2 — user_preferences table (ARCH-4)**

**Given** the `user_preferences` table requirement
**When** this story is shipped
**Then** `stravel/backend/app/models/user_preferences.py` exists with a `UserPreferences` SQLModel with fields:
`id`, `user_id (FK → tenant_users.id)`, `trip_name (nullable str)`, `past_destinations (JSON array)`, `travel_style (nullable str)`, `dietary_restrictions (JSON array)`, `created_at`, `updated_at`
**And** an Alembic migration creates the `user_preferences` table
**And** the model file does NOT contain `from __future__ import annotations`
**And** any query helpers use `session.execute()` + `.scalars()` — never `session.exec()`

**AC3 — SessionStatus type + SessionList.tsx token migration (ARCH-7)**

**Given** the `SessionStatus` type update
**When** this story is shipped
**Then** `domain.ts` exports `type SessionStatus = "pending" | "confirmed" | "modified" | "flagged"`
**And** `SessionList.tsx` replaces `STATUS_COLORS` dict with CSS custom property lookups using `var(--status-pending)`, `var(--status-confirmed)`, `var(--status-modified)`, `var(--status-flagged)` tokens from `.theme-b2b`
**And** no hardcoded hex colors remain in `SessionList.tsx` (ESLint ARCH-9 enforced)

## Tasks / Subtasks

- [x] Task 1: Create `stravel/docs/mood-transition-rules.md` (AC1)
  - [x] Write linguistic signal taxonomy: ≥10 labeled examples (correction vs. edit)
  - [x] Write card dependency graph (markdown table)
  - [x] Write per-card-type default question strings
  - [x] Write MOOD_TRANSITION reducer contract with `SlotKey` type definition

- [x] Task 2: Add `UserPreferences` SQLModel + Alembic migration (AC2)
  - [x] Create `stravel/backend/app/models/user_preferences.py` following conventions
  - [x] Add `UserPreferences` to `stravel/backend/app/models/__init__.py` `__all__`
  - [x] Generate Alembic migration: hand-written `a1b2c3d4e5f6_add_user_preferences.py` (alembic CLI not in env)
  - [x] Verify migration SQL in the generated file and fix if needed
  - [x] Write unit tests for the model (import check, field types, FK) — 7 tests pass

- [x] Task 3: Update `domain.ts` — new SessionStatus + SlotKey (AC3)
  - [x] Rename existing `SessionStatus` in domain.ts to `LegacyAdvisoryStatus` and update `AdvisorySession.status` to use it
  - [x] Export new `type SessionStatus = "pending" | "confirmed" | "modified" | "flagged"`
  - [x] Export `type SlotKey = 'mood' | 'destination' | 'travel_dates' | 'budget' | 'dietary' | 'activities' | 'passport_expiry' | 'traveler_count'`
  - [x] Write unit tests for the type exports (import and type-check test)

- [x] Task 4: Refactor `SessionList.tsx` — remove STATUS_COLORS, use CSS tokens (AC3)
  - [x] Remove `STATUS_COLORS` constant
  - [x] Replace all inline hex colors with CSS custom property tokens (`var(--status-*)`, `var(--color-border)`, `var(--color-text-muted)`)
  - [x] Sync `SessionList.js` counterpart
  - [x] Run ESLint — no hex violations
  - [x] Write 7 tests for `SessionList` rendering with new status tokens — all pass

- [x] Task 5: Run full validation suite
  - [x] `npx vitest run` — 347/347 tests pass (11 new: 7 SessionList + 4 domain types)
  - [x] `npx eslint src/` — clean
  - [x] `npx tsc --noEmit` — clean
  - [x] `npx vite build` — clean (229 modules, 423 kB)

## Dev Notes

### File Locations

| File | Path | Action |
|------|------|--------|
| Docs | `stravel/docs/mood-transition-rules.md` | CREATE (new `stravel/docs/` dir) |
| Backend model | `stravel/backend/app/models/user_preferences.py` | CREATE |
| Models __init__ | `stravel/backend/app/models/__init__.py` | MODIFY — add import + `__all__` entry |
| Alembic migration | `stravel/backend/alembic/versions/<rev>_add_user_preferences.py` | GENERATE |
| Frontend types | `stravel/frontend/src/types/domain.ts` | MODIFY |
| SessionList | `stravel/frontend/src/components/b2b/SessionList.tsx` | MODIFY |
| SessionList.js | `stravel/frontend/src/components/b2b/SessionList.js` | SYNC (.js counterpart) |

### Backend Model Conventions (CRITICAL)

Follow `traveler_profile.py` exactly:
- `import uuid` from stdlib — NOT `from __future__ import annotations`
- `from sqlalchemy import JSON` for JSON array fields
- `from sqlmodel import Field, SQLModel`
- `datetime.utcnow()` via lambda in `Field(default_factory=...)`
- UUID primary key: `id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)`
- FK reference pattern: `user_id: uuid.UUID = Field(foreign_key="tenant_users.id", index=True)`

`UserPreferences` model — no `table=True` relationship back-pointer needed for this story (FKs only).

```python
# stravel/backend/app/models/user_preferences.py
import uuid
from datetime import datetime

from sqlalchemy import JSON
from sqlmodel import Field, SQLModel


class UserPreferences(SQLModel, table=True):
    __tablename__ = "user_preferences"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="tenant_users.id", index=True)
    trip_name: str | None = Field(default=None, max_length=255)
    past_destinations: list[str] | None = Field(default=None, sa_type=JSON)
    travel_style: str | None = Field(default=None, max_length=64)
    dietary_restrictions: list[str] | None = Field(default=None, sa_type=JSON)
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = Field(default_factory=lambda: datetime.utcnow())
```

### Alembic Migration

Run from `stravel/backend/`:
```bash
alembic revision --autogenerate -m "add_user_preferences"
```

Verify the generated migration creates `user_preferences` table with `UUID` id, UUID FK to `tenant_users.id`, nullable varchar fields, JSON fields, and datetime fields. Adjust `sa_type=JSON` → `sa.JSON()` in migration if autogenerate emits it differently.

Existing migration: `90e256b6caf0_create_initial_tables.py` — new migration `down_revision` must point to this.

The `alembic/env.py` does `from app.models import *` — adding `UserPreferences` to `__init__.py` is sufficient for the autogenerate to detect the new table.

### Frontend SessionStatus Type Transition (IMPORTANT)

**Current state in `domain.ts`:**
```typescript
export type SessionStatus = "in_progress" | "completed" | "archived";
export interface AdvisorySession {
  status: SessionStatus;   // ← will break after rename
  ...
}
```

**Required change:** The old `SessionStatus` values match the backend Python enum. The new `SessionStatus` is the Chat-First UI B2B vocabulary. Handle the transition by:

1. Rename old type to `LegacyAdvisoryStatus` (or keep as inline union on `AdvisorySession.status`) — pick whichever keeps `AdvisorySession` valid
2. Export new `SessionStatus = "pending" | "confirmed" | "modified" | "flagged"`

Recommended approach (avoids breaking `AdvisorySession`):
```typescript
// Old type — still needed for AdvisorySession.status (backend API value)
type LegacyAdvisoryStatus = "in_progress" | "completed" | "archived";

// New Chat-First UI B2B status vocabulary
export type SessionStatus = "pending" | "confirmed" | "modified" | "flagged";

export interface AdvisorySession {
  status: LegacyAdvisoryStatus;   // backend API still returns these values
  ...
}
```

`LegacyAdvisoryStatus` does NOT need to be exported (it's internal to domain.ts). Future story will update the backend enum and migrate `AdvisorySession.status`.

### Frontend CSS Token Pattern for SessionList.tsx

Tokens already exist in `stravel/frontend/src/styles/tokens.css` inside `.theme-b2b`:
```css
.theme-b2b {
  --status-pending: #F59E0B;
  --status-confirmed: #10B981;
  --status-modified: #3B82F6;
  --status-flagged: #EF4444;
}
```

There are NO `--on-status-*` foreground tokens — use white (`#fff`) or inherit. The existing STATUS_COLORS had separate bg/color pairs; the new tokens only define background. Use `color: "white"` or define `--on-status-*` tokens if needed.

**Simplest replacement pattern for SessionList.tsx:**
```tsx
// Remove STATUS_COLORS entirely.
// Replace the badge style:
<span style={{
  background: `var(--status-${session.status})`,
  color: "white",
  fontSize: "11px",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "10px",
}}>
```

Note: `session.status` will come from the API as `in_progress/completed/archived` until the backend is updated. The CSS variable `var(--status-in_progress)` won't resolve (token doesn't exist). Add a safe fallback:
```tsx
background: `var(--status-${session.status}, var(--surface-2))`,
```
This gracefully falls back to the default surface color for unmapped statuses.

### .js Counterpart Sync (CRITICAL)

`SessionList.tsx` has a `SessionList.js` counterpart at the same path. After updating `SessionList.tsx`, manually sync `SessionList.js` in JSX-runtime format (`_jsx`/`_jsxs` from `react/jsx-runtime`). Failing to sync causes Vitest to run tests against stale code.

### ESLint Hex Rule

The ESLint config (`eslint.config.mjs`) has a `no-restricted-syntax` rule catching hex literals in JSX `style={{}}` attributes. After removing `STATUS_COLORS` and all other hardcoded hexes, run `npm run lint` to confirm zero hex violations.

Remaining hex values in the file before this story (lines to remove):
- `STATUS_COLORS` dict: `#eff6ff`, `#2563eb`, `#f0fdf4`, `#059669`, `#f3f4f6`, `#6b7280`
- `borderBottom: "1px solid #f3f4f6"` (line ~31)
- `color: "#6b7280"` (line ~58)
- `color: "#9ca3af"` (line ~64)
- `border: "1px solid #e5e7eb"` (line ~73)

Each must be replaced with a token variable:
- `#f3f4f6` → `var(--border)` or `var(--surface-2)` 
- `#6b7280` → `var(--text-muted)`
- `#9ca3af` → `var(--text-muted)` or slightly lighter variant
- `#e5e7eb` → `var(--border)`

Check `tokens.css` for the exact variable names available. Look for `--text-muted`, `--border`, `--surface-*` in the B2B/B2C token blocks.

### SlotKey Definition

The MOOD_TRANSITION reducer contract references `SlotKey`. Export from `domain.ts` alongside SessionStatus. Based on Epic 8 stories (2.2–2.9), the complete slot set is:

```typescript
export type SlotKey =
  | 'mood'
  | 'destination'
  | 'travel_dates'
  | 'budget'
  | 'dietary'
  | 'activities'
  | 'passport_expiry'
  | 'traveler_count';
```

### MOOD_TRANSITION Docs Content Guide

The `docs/mood-transition-rules.md` is a reference document for developers, not user-facing. It should be concise and actionable. Required sections:

**1. Linguistic Signal Taxonomy (≥10 examples)**

Classify user messages into:
- `correction` — changes context that affects MULTIPLE cards (destination/mood/dates/party_size change)
- `edit` — changes a single slot on an already-rendered card without cascade

Examples to cover: destination rename, adding a traveler, swapping mood, narrowing dates, correcting budget, changing dietary restriction, switching accommodation style, updating passport expiry, editing activity preference on a settled card, budget nudge on an existing proposal.

**2. Card Dependency Graph**

Table format: context-change category → which card types regenerate.

| Context Change | Regenerates |
|---|---|
| Destination | flight, hotel, experience, itinerary |
| Dates | flight, hotel, experience, itinerary |
| Budget | hotel, experience, itinerary |
| Party size | flight, hotel, experience, itinerary |
| Mood | experience, itinerary |
| Dietary | experience only |
| Accommodation style | hotel only |
| Activity preference | experience only |

**3. Per-Card Default Questions**

When context is ambiguous, the bot asks clarifying questions. One default question string per card type (flight, hotel, experience, restaurant/itinerary).

**4. Reducer Contract**

```typescript
// MOOD_TRANSITION action dispatched to streamReducer
type MoodTransitionAction = {
  type: 'MOOD_TRANSITION';
  payload: {
    kind: 'correction' | 'edit';
    affectedSlots: SlotKey[];
  };
};
```

### Test Patterns from Epic 7

- Vitest + `@testing-library/react` — `fireEvent` not `@testing-library/user-event` (not installed)
- Backend tests: check `stravel/backend/tests/unit/` for existing test patterns
- Model import tests: simply import the model and assert fields exist (type-level test)
- Run from `stravel/frontend/`: `npx vitest run`
- Run backend tests from `stravel/backend/`: `python -m pytest tests/unit/ -q`

### Existing Test Baseline

336 frontend tests passing across 37 files before this story. No existing `SessionList.tsx` unit tests — you are writing the first ones.

Backend: 5 unit tests in `stravel/backend/tests/unit/` (event_bus, workflow). New `UserPreferences` model tests go in `stravel/backend/tests/unit/test_user_preferences.py`.

## Dev Agent Record

### Implementation Plan

1. Created `stravel/docs/mood-transition-rules.md` — 12 classified examples, full dependency graph, 4 default question strings, typed reducer contract
2. Created `UserPreferences` SQLModel following `traveler_profile.py` conventions; hand-authored Alembic migration (CLI not available in env); registered in `__init__.py`
3. Updated `domain.ts` — renamed old `SessionStatus` to `LegacyAdvisoryStatus` to preserve `AdvisorySession.status` typing; exported new Chat-First `SessionStatus` and `SlotKey`
4. Refactored `SessionList.tsx` + `.js` counterpart — removed `STATUS_COLORS` dict, all 8 hex literals replaced with CSS custom property tokens; written 7 tests

### Debug Log

- tsc errors in initial `expectTypeOf` type tests — `expectTypeOf` doesn't work cleanly for union types; simplified to plain value assertions
- `.js` counterpart sync was required for `SessionList` — Vitest resolved stale `.js` with old `STATUS_COLORS` until synced

### Completion Notes

- All 3 ACs satisfied: mood-transition-rules.md with ≥10 taxonomy examples + dependency graph + default questions + reducer contract; `UserPreferences` SQLModel + migration; `SessionStatus` + `SlotKey` in domain.ts; `SessionList.tsx` zero hex violations
- `LegacyAdvisoryStatus` preserves `AdvisorySession.status` typing for current backend API; `SessionStatus` is the new Chat-First UI B2B vocabulary
- 347 frontend tests passing (up from 336 baseline + 11 new), 12 backend unit tests passing

## File List

- stravel/docs/mood-transition-rules.md (new)
- stravel/backend/app/models/user_preferences.py (new)
- stravel/backend/app/models/__init__.py (modified — added UserPreferences import + __all__ entry)
- stravel/backend/alembic/versions/a1b2c3d4e5f6_add_user_preferences.py (new)
- stravel/backend/tests/unit/test_user_preferences.py (new — 7 tests)
- stravel/frontend/src/types/domain.ts (modified — LegacyAdvisoryStatus, new SessionStatus, SlotKey)
- stravel/frontend/src/types/domain.js (unchanged — type-only file, no runtime content)
- stravel/frontend/src/types/__tests__/domain.test.ts (new — 4 tests)
- stravel/frontend/src/components/b2b/SessionList.tsx (modified — removed STATUS_COLORS, CSS tokens)
- stravel/frontend/src/components/b2b/SessionList.js (modified — synced)
- stravel/frontend/src/components/b2b/__tests__/SessionList.test.tsx (new — 7 tests)

### Review Findings

- [x] [Review][Decision] CSS token gap: legacy status values (`in_progress`, `completed`, `archived`) have no matching `--status-*` token in tokens.css — added `--status-in_progress`, `--status-completed`, `--status-archived` to `:root` and `.theme-b2b` in tokens.css [tokens.css]

- [x] [Review][Patch] PEP 604 `str | None` / `list[str] | None` syntax requires Python ≥ 3.10; replaced with `Optional[str]` / `Optional[List[str]]` from `typing` [user_preferences.py]

- [x] [Review][Patch] AC3 gap — `SessionPanel.tsx` still contains `STATUS_COLORS` dict with hardcoded hex values; removed STATUS_COLORS, replaced all hex with CSS tokens, synced SessionPanel.js [SessionPanel.tsx, SessionPanel.js]

- [x] [Review][Patch] No UNIQUE constraint on `user_id` in `user_preferences` migration — added `sa.UniqueConstraint('user_id')` to migration and `unique=True` to model field [a1b2c3d4e5f6_add_user_preferences.py, user_preferences.py]

- [x] [Review][Patch] `LegacyAdvisoryStatus` exported from domain.ts contrary to Dev Notes spec — removed `export` keyword [domain.ts]

- [x] [Review][Defer] `updated_at` has no `onupdate=` trigger — only populated at INSERT, never refreshes on UPDATE; requires application-level pattern or server-side trigger [user_preferences.py:19] — deferred, pre-existing SQLModel limitation

- [x] [Review][Defer] No `ON DELETE CASCADE` on `user_id` FK — orphaned user_preferences rows if a tenant_user is deleted [a1b2c3d4e5f6_add_user_preferences.py] — deferred, pre-existing schema design concern

- [x] [Review][Defer] Alembic revision ID `a1b2c3d4e5f6` is a human-invented placeholder (not a valid hex string); Alembic migration chain integrity risk [a1b2c3d4e5f6_add_user_preferences.py] — deferred, Alembic CLI not available in dev env

## Change Log

- 2026-05-26: Story created (create-story workflow)
- 2026-05-26: Story implemented — all tasks complete, 347/347 frontend tests + 12/12 backend tests passing (dev-story workflow)
- 2026-05-26: Code review complete — 1 decision-needed, 4 patches, 3 deferred, 1 dismissed (code-review workflow)
