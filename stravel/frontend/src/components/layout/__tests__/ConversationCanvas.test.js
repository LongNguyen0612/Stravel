import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ConversationCanvas } from '../ConversationCanvas';
describe('ConversationCanvas', () => {
    it('renders children', () => {
        const { getByTestId } = render(_jsx(ConversationCanvas, { paddingBottom: 0, children: _jsx("div", { "data-testid": "child", children: "hello" }) }));
        expect(getByTestId('child')).toBeInTheDocument();
    });
    it('has role="log"', () => {
        const { container } = render(_jsx(ConversationCanvas, { paddingBottom: 0, children: _jsx("span", {}) }));
        expect(container.firstChild).toHaveAttribute('role', 'log');
    });
    it('has aria-label="Travel advisory conversation"', () => {
        const { container } = render(_jsx(ConversationCanvas, { paddingBottom: 0, children: _jsx("span", {}) }));
        expect(container.firstChild).toHaveAttribute('aria-label', 'Travel advisory conversation');
    });
    it('has aria-live="polite" by default', () => {
        const { container } = render(_jsx(ConversationCanvas, { paddingBottom: 0, children: _jsx("span", {}) }));
        expect(container.firstChild).toHaveAttribute('aria-live', 'polite');
    });
    it('accepts ariaLive="off" override', () => {
        const { container } = render(_jsx(ConversationCanvas, { paddingBottom: 0, ariaLive: "off", children: _jsx("span", {}) }));
        expect(container.firstChild).toHaveAttribute('aria-live', 'off');
    });
    it('accepts ariaLive="assertive" override', () => {
        const { container } = render(_jsx(ConversationCanvas, { paddingBottom: 0, ariaLive: "assertive", children: _jsx("span", {}) }));
        expect(container.firstChild).toHaveAttribute('aria-live', 'assertive');
    });
    it('applies paddingBottom as inline style', () => {
        const { container } = render(_jsx(ConversationCanvas, { paddingBottom: 120, children: _jsx("span", {}) }));
        const el = container.firstChild;
        expect(el.style.paddingBottom).toBe('120px');
    });
    it('applies overflow-y-auto and flex-1 layout classes', () => {
        const { container } = render(_jsx(ConversationCanvas, { paddingBottom: 0, children: _jsx("span", {}) }));
        expect(container.firstChild).toHaveClass('overflow-y-auto', 'flex-1');
    });
    it('applies overscroll-contain to prevent browser bounce', () => {
        const { container } = render(_jsx(ConversationCanvas, { paddingBottom: 0, children: _jsx("span", {}) }));
        expect(container.firstChild).toHaveClass('overscroll-contain');
    });
});
