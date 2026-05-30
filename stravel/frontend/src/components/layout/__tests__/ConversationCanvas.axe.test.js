import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ConversationCanvas } from '../ConversationCanvas';
expect.extend(toHaveNoViolations);
describe('ConversationCanvas — WCAG 2.1 AA', () => {
    it('has no violations with default ariaLive', async () => {
        const { container } = render(_jsx(ConversationCanvas, { paddingBottom: 0, children: _jsx("p", { children: "Hello" }) }));
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
    it('has no violations with ariaLive="off"', async () => {
        const { container } = render(_jsx(ConversationCanvas, { paddingBottom: 0, ariaLive: "off", children: _jsx("p", { children: "Streaming\u2026" }) }));
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
    it('has no violations with ariaLive="assertive"', async () => {
        const { container } = render(_jsx(ConversationCanvas, { paddingBottom: 0, ariaLive: "assertive", children: _jsx("p", { children: "Error" }) }));
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
    it('has aria-relevant="additions" attribute', () => {
        const { container } = render(_jsx(ConversationCanvas, { paddingBottom: 0, children: _jsx("span", {}) }));
        expect(container.firstChild).toHaveAttribute('aria-relevant', 'additions');
    });
});
