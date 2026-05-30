import { describe, it, expect } from 'vitest';
import { streamReducer, initialStreamState } from '../reducers/streamReducer';
import type { SessionEventRecord } from '../types/stream';

function makeEvent(sse_id: number, event_type: string, event_data: Record<string, unknown>): SessionEventRecord {
  return {
    id: `id-${sse_id}`,
    session_id: 'sess-1',
    sse_id,
    event_type,
    event_data,
    created_at: '2026-05-26T12:00:00Z',
  };
}

describe('streamReducer HYDRATE_HISTORY', () => {
  it('replays stage.change events into status', () => {
    const events = [
      makeEvent(1, 'stage.change', { stage: 'profiling' }),
      makeEvent(2, 'stage.change', { stage: 'complete' }),
    ];
    const next = streamReducer(initialStreamState, { type: 'HYDRATE_HISTORY', payload: events });
    expect(next.status).toBe('complete');
  });

  it('replays agent.profiling.question events into messages using sse_id as stable id', () => {
    const events = [
      makeEvent(1, 'agent.profiling.question', { type: 'question', content: 'Hello', context: '' }),
      makeEvent(2, 'agent.profiling.question', { type: 'question', content: 'World', context: '' }),
    ];
    const next = streamReducer(initialStreamState, { type: 'HYDRATE_HISTORY', payload: events });
    expect(next.messages).toHaveLength(2);
    expect(next.messages[0].id).toBe('1');
    expect(next.messages[0].content).toBe('Hello');
    expect(next.messages[1].id).toBe('2');
  });

  it('replays agent.calculation.result events into messages', () => {
    const events = [
      makeEvent(1, 'agent.calculation.result', { type: 'result', content: 'Calc result', context: 'calc' }),
    ];
    const next = streamReducer(initialStreamState, { type: 'HYDRATE_HISTORY', payload: events });
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0].content).toBe('Calc result');
  });

  it('deduplicates agent.profiling.question by sse_id', () => {
    const events = [
      makeEvent(1, 'agent.profiling.question', { type: 'question', content: 'Hello', context: '' }),
      makeEvent(1, 'agent.profiling.question', { type: 'question', content: 'Hello', context: '' }),
    ];
    const next = streamReducer(initialStreamState, { type: 'HYDRATE_HISTORY', payload: events });
    expect(next.messages).toHaveLength(1);
  });

  it('replays compliance.flag events', () => {
    const events = [
      makeEvent(1, 'compliance.flag', { severity: 'warning', check: 'visa', message: 'Visa required', alternative: '' }),
    ];
    const next = streamReducer(initialStreamState, { type: 'HYDRATE_HISTORY', payload: events });
    expect(next.complianceFlags).toHaveLength(1);
    expect(next.complianceFlags[0].check).toBe('visa');
  });

  it('replays card.update events into cardUpdates', () => {
    const events = [
      makeEvent(1, 'card.update', { card_id: 'hotel-1', type: 'hotel', completeness_score: 0.8, delta: {}, is_final: false }),
      makeEvent(2, 'card.update', { card_id: 'hotel-1', type: 'hotel', completeness_score: 1.0, delta: {}, is_final: true }),
    ];
    const next = streamReducer(initialStreamState, { type: 'HYDRATE_HISTORY', payload: events });
    expect(next.cardUpdates['hotel-1'].completeness_score).toBe(1.0);
    expect(next.cardUpdates['hotel-1'].is_final).toBe(true);
  });

  it('sets ssePhase to complete after hydration', () => {
    const next = streamReducer(initialStreamState, { type: 'HYDRATE_HISTORY', payload: [] });
    expect(next.ssePhase).toBe('complete');
  });

  it('ignores unknown event types without throwing', () => {
    const events = [makeEvent(1, 'unknown.event', { foo: 'bar' })];
    const next = streamReducer(initialStreamState, { type: 'HYDRATE_HISTORY', payload: events });
    expect(next.messages).toHaveLength(0);
    expect(next.ssePhase).toBe('complete');
  });

  it('hydration resets state to initial before replaying (tab-return isolation)', () => {
    const withMessages = streamReducer(
      initialStreamState,
      { type: 'AGENT_MESSAGE', payload: { id: 'old', type: 'result', content: 'old', context: '', timestamp: 0 } }
    );
    expect(withMessages.messages).toHaveLength(1);

    const events = [makeEvent(1, 'agent.profiling.question', { type: 'question', content: 'new', context: '' })];
    const next = streamReducer(withMessages, { type: 'HYDRATE_HISTORY', payload: events });
    // old message should NOT appear — hydration starts from clean slate
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0].content).toBe('new');
  });

  it('replays proposal.ready as a proposal message', () => {
    const events = [
      makeEvent(5, 'proposal.ready', { summary: 'Here is your travel plan.' }),
    ];
    const next = streamReducer(initialStreamState, { type: 'HYDRATE_HISTORY', payload: events });
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0].type).toBe('proposal');
    expect(next.messages[0].content).toBe('Here is your travel plan.');
    expect(next.messages[0].context).toBe('proposal_complete');
  });
});
