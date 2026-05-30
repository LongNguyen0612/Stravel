import { jsx as _jsx } from "react/jsx-runtime";
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StageNarrator } from '../StageNarrator';
describe('StageNarrator', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });
    it('renders outer container with aria-live="polite" on mount', () => {
        render(_jsx(StageNarrator, { stage: "idle" }));
        const el = screen.getByTestId('stage-narrator');
        expect(el).toHaveAttribute('aria-live', 'polite');
    });
    it('has aria-atomic="true"', () => {
        render(_jsx(StageNarrator, { stage: "idle" }));
        expect(screen.getByTestId('stage-narrator')).toHaveAttribute('aria-atomic', 'true');
    });
    it('renders with empty content immediately on mount (idle)', () => {
        render(_jsx(StageNarrator, { stage: "idle" }));
        expect(screen.getByTestId('stage-narrator')).toBeEmptyDOMElement();
    });
    it('does not show text before 400ms elapses', () => {
        render(_jsx(StageNarrator, { stage: "calculating" }));
        act(() => { vi.advanceTimersByTime(399); });
        expect(screen.getByTestId('stage-narrator')).toBeEmptyDOMElement();
    });
    it('shows calculating text after 400ms', async () => {
        render(_jsx(StageNarrator, { stage: "calculating" }));
        await act(async () => { vi.advanceTimersByTime(400); });
        expect(screen.getByTestId('stage-narrator')).toHaveTextContent('💰 Calculating budget…');
    });
    it('shows profiling text after 400ms', async () => {
        render(_jsx(StageNarrator, { stage: "profiling" }));
        await act(async () => { vi.advanceTimersByTime(400); });
        expect(screen.getByTestId('stage-narrator')).toHaveTextContent('🗺️ Learning your travel preferences…');
    });
    it('shows proposing text after 400ms', async () => {
        render(_jsx(StageNarrator, { stage: "proposing" }));
        await act(async () => { vi.advanceTimersByTime(400); });
        expect(screen.getByTestId('stage-narrator')).toHaveTextContent('✈️ Building your travel proposal…');
    });
    it('shows validating text after 400ms', async () => {
        render(_jsx(StageNarrator, { stage: "validating" }));
        await act(async () => { vi.advanceTimersByTime(400); });
        expect(screen.getByTestId('stage-narrator')).toHaveTextContent('✅ Checking compliance and safety…');
    });
    it('clears text when stage returns to idle', async () => {
        const { rerender } = render(_jsx(StageNarrator, { stage: "calculating" }));
        await act(async () => { vi.advanceTimersByTime(400); });
        rerender(_jsx(StageNarrator, { stage: "idle" }));
        await act(async () => { vi.advanceTimersByTime(400); });
        expect(screen.getByTestId('stage-narrator')).toBeEmptyDOMElement();
    });
    it('clears text when stage is complete', async () => {
        const { rerender } = render(_jsx(StageNarrator, { stage: "proposing" }));
        await act(async () => { vi.advanceTimersByTime(400); });
        rerender(_jsx(StageNarrator, { stage: "complete" }));
        await act(async () => { vi.advanceTimersByTime(400); });
        expect(screen.getByTestId('stage-narrator')).toBeEmptyDOMElement();
    });
    it('resets timer on stage change (does not show old stage text at 400ms)', async () => {
        const { rerender } = render(_jsx(StageNarrator, { stage: "profiling" }));
        act(() => { vi.advanceTimersByTime(300); });
        rerender(_jsx(StageNarrator, { stage: "calculating" }));
        act(() => { vi.advanceTimersByTime(100); });
        // Only 100ms has elapsed since stage change — should still be empty
        expect(screen.getByTestId('stage-narrator')).toBeEmptyDOMElement();
    });
    it('stage-narrator outer div is always in DOM regardless of content', () => {
        const { rerender } = render(_jsx(StageNarrator, { stage: "idle" }));
        expect(screen.getByTestId('stage-narrator')).toBeInTheDocument();
        rerender(_jsx(StageNarrator, { stage: "calculating" }));
        expect(screen.getByTestId('stage-narrator')).toBeInTheDocument();
    });
});
