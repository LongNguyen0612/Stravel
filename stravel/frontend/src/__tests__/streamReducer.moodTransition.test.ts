import { describe, it, expect } from 'vitest';
import { streamReducer, initialStreamState } from '../reducers/streamReducer';
import type { StreamState } from '../types/stream';
import type { CardUpdateEvent } from '../types/domain';

function makeCard(card_id: string, type: CardUpdateEvent['type'], completeness_score = 0.8): CardUpdateEvent {
  return { card_id, type, completeness_score, delta: {}, is_final: true };
}

function stateWithCards(cards: CardUpdateEvent[]): StreamState {
  return {
    ...initialStreamState,
    ssePhase: 'complete',
    cardUpdates: Object.fromEntries(cards.map(c => [c.card_id, c])),
  };
}

describe('streamReducer MOOD_TRANSITION', () => {
  it('clears only flight and activities cards for travel_dates', () => {
    const state = stateWithCards([
      makeCard('c-flight', 'flight'),
      makeCard('c-hotel', 'hotel'),
      makeCard('c-activities', 'activities'),
      makeCard('c-budget', 'budget'),
      makeCard('c-compliance', 'compliance'),
    ]);
    const next = streamReducer(state, {
      type: 'MOOD_TRANSITION',
      payload: { kind: 'edit', affectedSlots: ['travel_dates'] },
    });
    expect(Object.keys(next.cardUpdates)).not.toContain('c-flight');
    expect(Object.keys(next.cardUpdates)).not.toContain('c-activities');
    expect(next.cardUpdates['c-hotel']).toBeDefined();
    expect(next.cardUpdates['c-budget']).toBeDefined();
    expect(next.cardUpdates['c-compliance']).toBeDefined();
  });

  it('clears flight, hotel, activities, compliance for destination', () => {
    const state = stateWithCards([
      makeCard('c-flight', 'flight'),
      makeCard('c-hotel', 'hotel'),
      makeCard('c-activities', 'activities'),
      makeCard('c-budget', 'budget'),
      makeCard('c-compliance', 'compliance'),
    ]);
    const next = streamReducer(state, {
      type: 'MOOD_TRANSITION',
      payload: { kind: 'correction', affectedSlots: ['destination'] },
    });
    expect(Object.keys(next.cardUpdates)).not.toContain('c-flight');
    expect(Object.keys(next.cardUpdates)).not.toContain('c-hotel');
    expect(Object.keys(next.cardUpdates)).not.toContain('c-activities');
    expect(Object.keys(next.cardUpdates)).not.toContain('c-compliance');
    expect(next.cardUpdates['c-budget']).toBeDefined();
  });

  it('leaves untouched cards intact when budget slot edited', () => {
    const state = stateWithCards([
      makeCard('c-flight', 'flight'),
      makeCard('c-hotel', 'hotel'),
      makeCard('c-activities', 'activities'),
      makeCard('c-budget', 'budget'),
      makeCard('c-compliance', 'compliance'),
    ]);
    const next = streamReducer(state, {
      type: 'MOOD_TRANSITION',
      payload: { kind: 'edit', affectedSlots: ['budget'] },
    });
    expect(next.cardUpdates['c-flight']).toBeDefined();
    expect(next.cardUpdates['c-compliance']).toBeDefined();
    expect(Object.keys(next.cardUpdates)).not.toContain('c-hotel');
    expect(Object.keys(next.cardUpdates)).not.toContain('c-activities');
    expect(Object.keys(next.cardUpdates)).not.toContain('c-budget');
  });

  it('clears union of dep sets for multiple affected slots', () => {
    const state = stateWithCards([
      makeCard('c-flight', 'flight'),
      makeCard('c-hotel', 'hotel'),
      makeCard('c-activities', 'activities'),
      makeCard('c-budget', 'budget'),
      makeCard('c-compliance', 'compliance'),
    ]);
    const next = streamReducer(state, {
      type: 'MOOD_TRANSITION',
      payload: { kind: 'edit', affectedSlots: ['destination', 'budget'] },
    });
    // destination → flight, hotel, activities, compliance
    // budget → hotel, budget, activities
    // union → flight, hotel, activities, compliance, budget — all 5 cleared
    expect(Object.keys(next.cardUpdates)).toHaveLength(0);
  });

  it('does NOT reset ssePhase', () => {
    const state = stateWithCards([makeCard('c-flight', 'flight')]);
    const next = streamReducer(state, {
      type: 'MOOD_TRANSITION',
      payload: { kind: 'edit', affectedSlots: ['travel_dates'] },
    });
    expect(next.ssePhase).toBe('complete');
  });

  it('is a no-op for an unknown/unmapped slot', () => {
    const state = stateWithCards([makeCard('c-flight', 'flight')]);
    const next = streamReducer(state, {
      type: 'MOOD_TRANSITION',
      payload: { kind: 'edit', affectedSlots: ['traveler_count'] },
    });
    // traveler_count → flight, hotel, activities, budget → flight cleared
    expect(Object.keys(next.cardUpdates)).not.toContain('c-flight');
  });
});
