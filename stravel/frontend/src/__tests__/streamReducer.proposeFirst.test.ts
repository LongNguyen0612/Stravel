import { describe, it, expect } from 'vitest';
import { streamReducer, initialStreamState } from '../reducers/streamReducer';

describe('streamReducer SET_ASSUMED_SLOTS', () => {
  it('sets assumedSlots from empty to provided list', () => {
    const next = streamReducer(initialStreamState, {
      type: 'SET_ASSUMED_SLOTS',
      payload: ['travel_dates', 'traveler_count', 'budget'],
    });
    expect(next.assumedSlots).toEqual(['travel_dates', 'traveler_count', 'budget']);
  });

  it('initialStreamState has empty assumedSlots', () => {
    expect(initialStreamState.assumedSlots).toEqual([]);
  });

  it('replaces previous assumedSlots on subsequent calls', () => {
    const first = streamReducer(initialStreamState, {
      type: 'SET_ASSUMED_SLOTS',
      payload: ['budget', 'activities'],
    });
    const second = streamReducer(first, {
      type: 'SET_ASSUMED_SLOTS',
      payload: ['traveler_count'],
    });
    expect(second.assumedSlots).toEqual(['traveler_count']);
  });

  it('sets assumedSlots to empty array', () => {
    const withSlots = streamReducer(initialStreamState, {
      type: 'SET_ASSUMED_SLOTS',
      payload: ['budget'],
    });
    const cleared = streamReducer(withSlots, {
      type: 'SET_ASSUMED_SLOTS',
      payload: [],
    });
    expect(cleared.assumedSlots).toEqual([]);
  });

  it('does not affect other state fields', () => {
    const withMessage = streamReducer(initialStreamState, {
      type: 'AGENT_MESSAGE',
      payload: { id: 'msg-1', type: 'question', content: 'Hello', context: '', timestamp: 0 },
    });
    const next = streamReducer(withMessage, {
      type: 'SET_ASSUMED_SLOTS',
      payload: ['travel_dates'],
    });
    expect(next.messages).toHaveLength(1);
    expect(next.assumedSlots).toEqual(['travel_dates']);
  });

  it('RESET clears assumedSlots', () => {
    const withSlots = streamReducer(initialStreamState, {
      type: 'SET_ASSUMED_SLOTS',
      payload: ['budget', 'traveler_count'],
    });
    const reset = streamReducer(withSlots, { type: 'RESET' });
    expect(reset.assumedSlots).toEqual([]);
  });
});
