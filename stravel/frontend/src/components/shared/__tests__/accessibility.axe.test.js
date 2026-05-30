import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MessageBubble } from '../MessageBubble';
import { StageNarrator } from '../StageNarrator';
import { JourneyProgressBar } from '../JourneyProgressBar';
expect.extend(toHaveNoViolations);
vi.mock('react-markdown', () => ({
    default: ({ children }) => _jsx("span", { children: children }),
}));
describe('MessageBubble — WCAG 2.1 AA', () => {
    it('bot role has no violations', async () => {
        const { container } = render(_jsx(MessageBubble, { role: "bot", children: "Hello traveler!" }));
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
    it('user role has no violations', async () => {
        const { container } = render(_jsx(MessageBubble, { role: "user", children: "I want to visit Hanoi" }));
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
    it('stage-narrator role has no violations', async () => {
        const { container } = render(_jsx(MessageBubble, { role: "stage-narrator", children: "\uD83D\uDDFA\uFE0F Learning your preferences\u2026" }));
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
describe('StageNarrator — WCAG 2.1 AA', () => {
    it('idle state has no violations', async () => {
        const { container } = render(_jsx(StageNarrator, { stage: "idle" }));
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
    it('profiling state has no violations', async () => {
        const { container } = render(_jsx(StageNarrator, { stage: "profiling" }));
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
describe('JourneyProgressBar — WCAG 2.1 AA', () => {
    it('has no violations when started with profiling stage', async () => {
        const { container } = render(_jsx(JourneyProgressBar, { stage: "profiling", hasStarted: true, onStageClick: () => { } }));
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
    it('has no violations when calculating stage with done steps', async () => {
        const { container } = render(_jsx(JourneyProgressBar, { stage: "calculating", hasStarted: true, onStageClick: () => { } }));
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
describe('aria sentinel div — WCAG 2.1 AA', () => {
    it('visually-hidden role=status has no violations', async () => {
        const { container } = render(_jsx("div", { children: _jsx("div", { role: "status", "aria-live": "polite", "aria-atomic": "true", "data-testid": "aria-sentinel", style: { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }, children: "Message received." }) }));
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
