import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStreamContext } from '../useStreamContext';
// ── Mock EventSource ──────────────────────────────────────────────────────────
class MockEventSource {
    static instances = [];
    url;
    onopen = null;
    onerror = null;
    closeCount = 0;
    listeners = new Map();
    constructor(url) {
        this.url = url;
        MockEventSource.instances.push(this);
    }
    addEventListener(type, handler) {
        if (!this.listeners.has(type))
            this.listeners.set(type, []);
        this.listeners.get(type).push(handler);
    }
    close() {
        this.closeCount++;
    }
    hasListener(type) {
        return (this.listeners.get(type)?.length ?? 0) > 0;
    }
    emit(type, data) {
        const event = new MessageEvent(type, { data: JSON.stringify(data) });
        this.listeners.get(type)?.forEach(h => h(event));
    }
    triggerOpen() {
        this.onopen?.(new Event('open'));
    }
    triggerError() {
        this.onerror?.(new Event('error'));
    }
}
// ── Setup / Teardown ──────────────────────────────────────────────────────────
beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
    vi.stubGlobal('localStorage', {
        getItem: vi.fn().mockReturnValue('test-token'),
    });
    vi.stubGlobal('crypto', {
        randomUUID: vi.fn().mockReturnValue('test-uuid'),
    });
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});
// ── Helpers ───────────────────────────────────────────────────────────────────
function getLatestES() {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
}
// ── Tests ─────────────────────────────────────────────────────────────────────
describe('useStreamContext — connect', () => {
    it('opens EventSource with session id and token in URL', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-42'));
        expect(getLatestES().url).toContain('/api/v1/stream/sess-42');
        expect(getLatestES().url).toContain('token=test-token');
    });
    it('closes previous connection on reconnect', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        const first = getLatestES();
        act(() => {
            first.triggerOpen();
            result.current.connect('sess-2');
        });
        expect(first.closeCount).toBeGreaterThanOrEqual(1);
    });
});
describe('useStreamContext — watchdog', () => {
    it('fires SSE_PHASE_CHANGE "error" after 30 s without any message', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        act(() => getLatestES().triggerOpen());
        expect(result.current.state.ssePhase).toBe('streaming');
        act(() => vi.advanceTimersByTime(30_001));
        expect(result.current.state.ssePhase).toBe('error');
    });
    it('closes EventSource when watchdog fires', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        const es = getLatestES();
        act(() => es.triggerOpen());
        act(() => vi.advanceTimersByTime(30_001));
        expect(es.closeCount).toBeGreaterThanOrEqual(1);
    });
    it('resets watchdog on card.update — does not fire at 30 s if message arrived', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        const es = getLatestES();
        act(() => es.triggerOpen());
        // Advance to 25 s then deliver a card.update — watchdog should reset
        act(() => vi.advanceTimersByTime(25_000));
        act(() => es.emit('card.update', {
            card_id: 'flight-1', type: 'flight', completeness_score: 0.5, delta: {}, is_final: false,
        }));
        // Another 15 s (40 s total from open, 15 s from last message) — not yet 30 s from reset
        act(() => vi.advanceTimersByTime(15_000));
        expect(result.current.state.ssePhase).toBe('streaming');
    });
    it('resets watchdog on stage.change', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        const es = getLatestES();
        act(() => es.triggerOpen());
        act(() => vi.advanceTimersByTime(25_000));
        act(() => es.emit('stage.change', { stage: 'profiling' }));
        act(() => vi.advanceTimersByTime(15_000));
        expect(result.current.state.ssePhase).toBe('streaming');
    });
});
describe('useStreamContext — card.update', () => {
    it('dispatches CARD_UPDATE keyed by card_id', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        act(() => getLatestES().triggerOpen());
        act(() => getLatestES().emit('card.update', {
            card_id: 'hotel-1', type: 'hotel', completeness_score: 0.7, delta: { name: 'Park Hyatt' }, is_final: false,
        }));
        expect(result.current.state.cardUpdates['hotel-1']).toMatchObject({
            card_id: 'hotel-1',
            type: 'hotel',
            completeness_score: 0.7,
            is_final: false,
        });
    });
    it('overwrites existing card entry for same card_id', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        const es = getLatestES();
        act(() => es.triggerOpen());
        act(() => es.emit('card.update', {
            card_id: 'flight-1', type: 'flight', completeness_score: 0.4, delta: {}, is_final: false,
        }));
        act(() => es.emit('card.update', {
            card_id: 'flight-1', type: 'flight', completeness_score: 0.9, delta: {}, is_final: true,
        }));
        expect(result.current.state.cardUpdates['flight-1'].completeness_score).toBe(0.9);
        expect(result.current.state.cardUpdates['flight-1'].is_final).toBe(true);
    });
});
describe('useStreamContext — stage.change', () => {
    it('dispatches STAGE_CHANGE with received stage', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        act(() => getLatestES().triggerOpen());
        act(() => getLatestES().emit('stage.change', { stage: 'calculating' }));
        expect(result.current.state.status).toBe('calculating');
    });
    it('dispatches SSE_PHASE_CHANGE "complete" when stage is "complete"', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        act(() => getLatestES().triggerOpen());
        act(() => getLatestES().emit('stage.change', { stage: 'complete' }));
        expect(result.current.state.ssePhase).toBe('complete');
    });
    it('does NOT change ssePhase to "complete" for non-complete stages', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        act(() => getLatestES().triggerOpen());
        act(() => getLatestES().emit('stage.change', { stage: 'proposing' }));
        expect(result.current.state.ssePhase).toBe('streaming');
    });
});
describe('useStreamContext — no heartbeat listener', () => {
    it('does not register a "heartbeat" event listener', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        expect(getLatestES().hasListener('heartbeat')).toBe(false);
    });
    it('registers a "keepalive" event listener', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        expect(getLatestES().hasListener('keepalive')).toBe(true);
    });
    it('resets watchdog on keepalive event', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        const es = getLatestES();
        act(() => es.triggerOpen());
        act(() => vi.advanceTimersByTime(25_000));
        act(() => es.emit('keepalive', {}));
        act(() => vi.advanceTimersByTime(15_000));
        expect(result.current.state.ssePhase).toBe('streaming');
    });
});
describe('useStreamContext — onerror', () => {
    it('sets ssePhase to "error" and isConnected to false', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        act(() => getLatestES().triggerOpen());
        act(() => getLatestES().triggerError());
        expect(result.current.state.ssePhase).toBe('error');
        expect(result.current.state.isConnected).toBe(false);
    });
    it('calls close() on the EventSource on error', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        const es = getLatestES();
        act(() => es.triggerOpen());
        act(() => es.triggerError());
        expect(es.closeCount).toBeGreaterThanOrEqual(1);
    });
});
describe('useStreamContext — watchdog DISCONNECTED', () => {
    it('sets isConnected to false when watchdog fires', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        act(() => getLatestES().triggerOpen());
        expect(result.current.state.isConnected).toBe(true);
        act(() => vi.advanceTimersByTime(30_001));
        expect(result.current.state.isConnected).toBe(false);
    });
});
describe('useStreamContext — disconnect', () => {
    it('closes EventSource and sets isConnected false', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        const es = getLatestES();
        act(() => es.triggerOpen());
        act(() => result.current.disconnect());
        expect(es.closeCount).toBeGreaterThanOrEqual(1);
        expect(result.current.state.isConnected).toBe(false);
    });
    it('cancels the watchdog on disconnect', () => {
        const { result } = renderHook(() => useStreamContext());
        act(() => result.current.connect('sess-1'));
        act(() => getLatestES().triggerOpen());
        act(() => result.current.disconnect());
        // Advance past 30 s — watchdog must NOT change ssePhase now
        act(() => vi.advanceTimersByTime(30_001));
        expect(result.current.state.ssePhase).not.toBe('error');
    });
});
