import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { B2CLayout } from '../B2CLayout';
describe('B2CLayout', () => {
    it('renders children', () => {
        render(_jsx(B2CLayout, { children: _jsx("div", { "data-testid": "child", children: "content" }) }));
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });
    it('applies theme-b2c class for CSS token scoping', () => {
        const { container } = render(_jsx(B2CLayout, { children: _jsx("span", {}) }));
        expect(container.firstChild).toHaveClass('theme-b2c');
    });
    it('applies h-dvh for full dynamic viewport height', () => {
        const { container } = render(_jsx(B2CLayout, { children: _jsx("span", {}) }));
        expect(container.firstChild).toHaveClass('h-dvh');
    });
    it('applies flex-col layout', () => {
        const { container } = render(_jsx(B2CLayout, { children: _jsx("span", {}) }));
        expect(container.firstChild).toHaveClass('flex', 'flex-col');
    });
    it('applies overflow-hidden to clip layout to viewport', () => {
        const { container } = render(_jsx(B2CLayout, { children: _jsx("span", {}) }));
        expect(container.firstChild).toHaveClass('overflow-hidden');
    });
    it('accepts and applies additional className', () => {
        const { container } = render(_jsx(B2CLayout, { className: "custom-class", children: _jsx("span", {}) }));
        expect(container.firstChild).toHaveClass('custom-class');
    });
});
