import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createRef } from 'react';
import { useFooterHeight } from '../useFooterHeight';
const observeMock = vi.fn();
const disconnectMock = vi.fn();
let resizeCallback = () => { };
class MockResizeObserver {
    constructor(cb) {
        resizeCallback = cb;
    }
    observe = observeMock;
    unobserve = vi.fn();
    disconnect = disconnectMock;
}
beforeEach(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    observeMock.mockClear();
    disconnectMock.mockClear();
});
afterEach(() => {
    vi.unstubAllGlobals();
});
describe('useFooterHeight', () => {
    it('returns 0 initially when refs are null', () => {
        const ref1 = createRef();
        const ref2 = createRef();
        const { result } = renderHook(() => useFooterHeight([ref1, ref2]));
        expect(result.current).toBe(0);
    });
    it('calls observe for each non-null ref element', () => {
        const ref1 = createRef();
        const ref2 = createRef();
        const el1 = document.createElement('div');
        const el2 = document.createElement('div');
        Object.defineProperty(ref1, 'current', { value: el1, writable: false });
        Object.defineProperty(ref2, 'current', { value: el2, writable: false });
        renderHook(() => useFooterHeight([ref1, ref2]));
        expect(observeMock).toHaveBeenCalledWith(el1);
        expect(observeMock).toHaveBeenCalledWith(el2);
    });
    it('calls disconnect on unmount', () => {
        const ref = createRef();
        const { unmount } = renderHook(() => useFooterHeight([ref]));
        unmount();
        expect(disconnectMock).toHaveBeenCalled();
    });
    it('returns sum of element heights when ResizeObserver fires', () => {
        const ref1 = createRef();
        const el1 = document.createElement('div');
        vi.spyOn(el1, 'getBoundingClientRect').mockReturnValue({ height: 72, width: 0, top: 0, left: 0, right: 0, bottom: 72 });
        Object.defineProperty(ref1, 'current', { value: el1, writable: false });
        const { result } = renderHook(() => useFooterHeight([ref1]));
        act(() => {
            resizeCallback([], new MockResizeObserver(() => { }));
        });
        expect(result.current).toBe(72);
    });
    it('sums heights from multiple refs', () => {
        const ref1 = createRef();
        const ref2 = createRef();
        const el1 = document.createElement('div');
        const el2 = document.createElement('div');
        vi.spyOn(el1, 'getBoundingClientRect').mockReturnValue({ height: 72, width: 0, top: 0, left: 0, right: 0, bottom: 72 });
        vi.spyOn(el2, 'getBoundingClientRect').mockReturnValue({ height: 120, width: 0, top: 0, left: 0, right: 0, bottom: 120 });
        Object.defineProperty(ref1, 'current', { value: el1, writable: false });
        Object.defineProperty(ref2, 'current', { value: el2, writable: false });
        const { result } = renderHook(() => useFooterHeight([ref1, ref2]));
        act(() => {
            resizeCallback([], new MockResizeObserver(() => { }));
        });
        expect(result.current).toBe(192);
    });
});
