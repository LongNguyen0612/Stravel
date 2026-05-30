import { describe, it, expect } from 'vitest';
import { initialStreamState, streamReducer } from '../streamReducer';
import type { CardUpdateEvent } from '../../types/domain';

const flightCard: CardUpdateEvent = {
  card_id: 'flight-1',
  type: 'flight',
  completeness_score: 0.9,
  delta: { origin: 'HAN' },
  is_final: true,
};

describe('streamReducer — CARD_UPDATE', () => {
  it('stores a card update keyed by card_id', () => {
    const state = streamReducer(initialStreamState, { type: 'CARD_UPDATE', payload: flightCard });
    expect(state.cardUpdates['flight-1']).toEqual(flightCard);
  });

  it('overwrites an existing card entry for the same card_id', () => {
    const first = { ...flightCard, completeness_score: 0.5, is_final: false };
    const second = { ...flightCard, completeness_score: 0.9, is_final: true };
    let state = streamReducer(initialStreamState, { type: 'CARD_UPDATE', payload: first });
    state = streamReducer(state, { type: 'CARD_UPDATE', payload: second });
    expect(state.cardUpdates['flight-1'].completeness_score).toBe(0.9);
    expect(state.cardUpdates['flight-1'].is_final).toBe(true);
  });

  it('stores multiple card types independently', () => {
    const hotelCard: CardUpdateEvent = {
      card_id: 'hotel-1', type: 'hotel', completeness_score: 0.6, delta: {}, is_final: false,
    };
    let state = streamReducer(initialStreamState, { type: 'CARD_UPDATE', payload: flightCard });
    state = streamReducer(state, { type: 'CARD_UPDATE', payload: hotelCard });
    expect(state.cardUpdates['flight-1']).toBeDefined();
    expect(state.cardUpdates['hotel-1']).toBeDefined();
  });
});

describe('streamReducer — SSE_PHASE_CHANGE', () => {
  it('sets ssePhase to streaming', () => {
    const state = streamReducer(initialStreamState, { type: 'SSE_PHASE_CHANGE', payload: 'streaming' });
    expect(state.ssePhase).toBe('streaming');
  });

  it('sets ssePhase to complete', () => {
    const state = streamReducer(initialStreamState, { type: 'SSE_PHASE_CHANGE', payload: 'complete' });
    expect(state.ssePhase).toBe('complete');
  });

  it('sets ssePhase to error', () => {
    const state = streamReducer(initialStreamState, { type: 'SSE_PHASE_CHANGE', payload: 'error' });
    expect(state.ssePhase).toBe('error');
  });

  it('sets ssePhase to idle', () => {
    const streaming = streamReducer(initialStreamState, { type: 'SSE_PHASE_CHANGE', payload: 'streaming' });
    const state = streamReducer(streaming, { type: 'SSE_PHASE_CHANGE', payload: 'idle' });
    expect(state.ssePhase).toBe('idle');
  });
});

describe('streamReducer — CONNECTED', () => {
  it('sets ssePhase to streaming on connect', () => {
    const state = streamReducer(initialStreamState, { type: 'CONNECTED' });
    expect(state.ssePhase).toBe('streaming');
  });

  it('sets isConnected to true', () => {
    const state = streamReducer(initialStreamState, { type: 'CONNECTED' });
    expect(state.isConnected).toBe(true);
  });

  it('clears error on connect', () => {
    const errored = streamReducer(initialStreamState, { type: 'ERROR', payload: 'network error' });
    const state = streamReducer(errored, { type: 'CONNECTED' });
    expect(state.error).toBeNull();
  });
});

describe('streamReducer — RESET', () => {
  it('resets ssePhase to idle', () => {
    const streaming = streamReducer(initialStreamState, { type: 'SSE_PHASE_CHANGE', payload: 'streaming' });
    const state = streamReducer(streaming, { type: 'RESET' });
    expect(state.ssePhase).toBe('idle');
  });

  it('resets cardUpdates to empty object', () => {
    const withCard = streamReducer(initialStreamState, { type: 'CARD_UPDATE', payload: flightCard });
    const state = streamReducer(withCard, { type: 'RESET' });
    expect(state.cardUpdates).toEqual({});
  });
});

describe('streamReducer — SLOT_UPDATE', () => {
  it('sets the slot value for the given slotKey', () => {
    const state = streamReducer(initialStreamState, { type: 'SLOT_UPDATE', payload: { slotKey: 'mood', value: 'adventure' } });
    expect(state.slotState.mood).toBe('adventure');
  });

  it('preserves existing slot values when adding a new one', () => {
    let state = streamReducer(initialStreamState, { type: 'SLOT_UPDATE', payload: { slotKey: 'mood', value: 'relaxation' } });
    state = streamReducer(state, { type: 'SLOT_UPDATE', payload: { slotKey: 'destination', value: 'Hoi An' } });
    expect(state.slotState.mood).toBe('relaxation');
    expect(state.slotState.destination).toBe('Hoi An');
  });

  it('overwrites an existing slot value', () => {
    let state = streamReducer(initialStreamState, { type: 'SLOT_UPDATE', payload: { slotKey: 'mood', value: 'adventure' } });
    state = streamReducer(state, { type: 'SLOT_UPDATE', payload: { slotKey: 'mood', value: 'culture' } });
    expect(state.slotState.mood).toBe('culture');
  });

  it('RESET clears slotState', () => {
    const withSlot = streamReducer(initialStreamState, { type: 'SLOT_UPDATE', payload: { slotKey: 'mood', value: 'foodie' } });
    const reset = streamReducer(withSlot, { type: 'RESET' });
    expect(reset.slotState).toEqual({});
  });

  it('accepts a string[] value for multi-select slots', () => {
    const state = streamReducer(initialStreamState, {
      type: 'SLOT_UPDATE',
      payload: { slotKey: 'dietary', value: ['vegetarian', 'halal'] },
    });
    expect(state.slotState.dietary).toEqual(['vegetarian', 'halal']);
  });

  it('accepts an empty array for "no restrictions" dietary selection', () => {
    const state = streamReducer(initialStreamState, {
      type: 'SLOT_UPDATE',
      payload: { slotKey: 'dietary', value: [] },
    });
    expect(state.slotState.dietary).toEqual([]);
  });

  it('overwrites a prior string[] value with a new one', () => {
    let state = streamReducer(initialStreamState, {
      type: 'SLOT_UPDATE',
      payload: { slotKey: 'dietary', value: ['vegetarian'] },
    });
    state = streamReducer(state, {
      type: 'SLOT_UPDATE',
      payload: { slotKey: 'dietary', value: ['halal', 'gluten_free'] },
    });
    expect(state.slotState.dietary).toEqual(['halal', 'gluten_free']);
  });
});

describe('streamReducer — initialStreamState', () => {
  it('has idle ssePhase', () => {
    expect(initialStreamState.ssePhase).toBe('idle');
  });

  it('has empty cardUpdates', () => {
    expect(initialStreamState.cardUpdates).toEqual({});
  });

  it('has empty slotState', () => {
    expect(initialStreamState.slotState).toEqual({});
  });
});
