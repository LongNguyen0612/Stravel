# MOOD_TRANSITION Rules

Reference document for the card-driven profile collection flow. Defines how the bot classifies user messages that change context mid-session and which cards regenerate as a result.

---

## 1. Linguistic Signal Taxonomy

A **correction** changes the session context in a way that affects multiple card types. An **edit** changes a single slot on an already-presented card with no cascade.

| # | User message | Kind | Why |
|---|---|---|---|
| 1 | "Actually, we want to go to Da Nang, not Hanoi." | correction | Destination change — invalidates flight routing, hotel location, experience recommendations, itinerary |
| 2 | "Wait, there will be 4 of us, not 2." | correction | Party size change — invalidates flight capacity, hotel room count, budget split, itinerary pacing |
| 3 | "Our budget is really more like $3,000 total." | correction | Budget change — invalidates hotel tier, experience selection, itinerary scope |
| 4 | "Let's change the trip to the last week of September instead." | correction | Dates change — invalidates flights, hotel availability, experience seasonality, itinerary |
| 5 | "This is more of a family trip, not a couple's vacation." | correction | Mood/traveler type change — invalidates experience type, accommodation suggestions, itinerary tone |
| 6 | "Can we extend by 3 more days?" | correction | Duration change — invalidates all time-dependent cards |
| 7 | "I meant beach activities, not city tours." | correction | Activity preference change — invalidates experience cards and itinerary |
| 8 | "Fix the hotel — I want a boutique guesthouse, not a 5-star." | edit | Accommodation style on an already-settled hotel card — hotel card only |
| 9 | "I need to update my passport expiry — it's March 2027, not 2026." | edit | Single field correction on passport card — compliance check only |
| 10 | "Change dietary to vegetarian." | edit | Dietary preference on already-settled preferences card — experience card only |
| 11 | "Swap the night market activity for a cooking class." | edit | Single activity on a settled itinerary day — itinerary card only |
| 12 | "The departure city is Ho Chi Minh City, not Hanoi." | correction | Origin change — invalidates all flight cards |

**Classification heuristic:** If a user message changes a structural parameter (destination, dates, party size, budget, origin) → always `correction`. If it targets a specific field on a rendered card ("fix the hotel", "change dietary", "update passport") → `edit`.

---

## 2. Card Dependency Graph

When a `correction` fires, the following card types are invalidated and queued for regeneration:

| Context Change | Cards That Regenerate |
|---|---|
| Destination | flight, hotel, experience, itinerary |
| Origin (departure city) | flight only |
| Travel dates | flight, hotel, experience, itinerary |
| Trip duration | flight, hotel, experience, itinerary |
| Party size | flight, hotel, experience, itinerary |
| Budget | hotel, experience, itinerary |
| Mood / trip type | experience, itinerary |
| Activity preference | experience, itinerary |
| Accommodation style | hotel only |
| Dietary restrictions | experience only |
| Passport expiry | (compliance re-check only — no card regeneration) |

An `edit` never cascades. It updates the one card whose slot was targeted and leaves all other cards intact.

---

## 3. Per-Card Default Question Strings

Used when context is ambiguous and the bot cannot determine the correct slot value from the user's message alone.

| Card Type | Default Clarifying Question |
|---|---|
| **flight** | "Where are you departing from, and are you flexible on the exact dates?" |
| **hotel** | "What style of accommodation works best — boutique guesthouse, mid-range hotel, or luxury resort?" |
| **experience** | "What type of activities do you enjoy most — cultural sites, outdoor adventures, food experiences, or a mix?" |
| **itinerary** | "How do you prefer to pace your days — packed with activities, relaxed with free time, or a balance of both?" |

---

## 4. MOOD_TRANSITION Reducer Contract

```typescript
// Domain type — exported from src/types/domain.ts
export type SlotKey =
  | 'mood'
  | 'destination'
  | 'travel_dates'
  | 'budget'
  | 'dietary'
  | 'activities'
  | 'passport_expiry'
  | 'traveler_count';

// Dispatched to streamReducer when user changes session context
type MoodTransitionAction = {
  type: 'MOOD_TRANSITION';
  payload: {
    kind: 'correction' | 'edit';
    affectedSlots: SlotKey[];
  };
};
```

**`kind: 'correction'`** — the bot detected a structural context change. Cards listed in the dependency graph above are invalidated (completeness_score reset to 0, isFinal set to false). The reducer removes affected card IDs from `cardUpdates` so they re-render in `nascent` state.

**`kind: 'edit'`** — the bot detected a single-card field update. Only the targeted card is updated via a standard `CARD_UPDATE` action with the new delta. `MOOD_TRANSITION` with `kind: 'edit'` is dispatched alongside it so the UI can display an "updated" affordance without cascade.

**`affectedSlots`** — the slot keys whose values changed. Used by future stories (Epic 8 slot-filling cards) to know which card prompts to re-present.

---

## 5. Implementation Notes

- `MOOD_TRANSITION` is a **future streamReducer action** — it is not yet handled in `streamReducer.ts` (Epic 8 stories will add it). This document defines the contract so all Epic 8 and 9 implementations are consistent.
- The bot LLM must classify each user message as `correction` or `edit` before dispatching — see the heuristic in Section 1.
- Cards that are currently `forming` when a `correction` fires should be cancelled (their `completeness_score` discarded); cards that are `settled` revert to `nascent`.
- A `correction` that overlaps with an `edit` (e.g., "change the hotel AND the destination") is always treated as a `correction` — the stricter classification wins.
