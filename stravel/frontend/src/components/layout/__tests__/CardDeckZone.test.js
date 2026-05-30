import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { render } from '@testing-library/react';
import { CardDeckZone } from '../CardDeckZone';
describe('CardDeckZone', () => {
    it('renders without children (empty placeholder)', () => {
        const { container } = render(_jsx(CardDeckZone, { chatInputHeight: 0 }));
        expect(container.firstChild).toBeInTheDocument();
    });
    it('renders children when provided', () => {
        const { getByTestId } = render(_jsx(CardDeckZone, { chatInputHeight: 0, children: _jsx("div", { "data-testid": "card", children: "card" }) }));
        expect(getByTestId('card')).toBeInTheDocument();
    });
    it('applies fixed positioning classes', () => {
        const { container } = render(_jsx(CardDeckZone, { chatInputHeight: 0 }));
        expect(container.firstChild).toHaveClass('fixed', 'left-0', 'right-0', 'w-full');
    });
    it('sets bottom offset from chatInputHeight as inline style', () => {
        const { container } = render(_jsx(CardDeckZone, { chatInputHeight: 72 }));
        const el = container.firstChild;
        expect(el.style.bottom).toBe('72px');
    });
    it('forwards ref to the outer div', () => {
        const ref = createRef();
        render(_jsx(CardDeckZone, { ref: ref, chatInputHeight: 0 }));
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
});
