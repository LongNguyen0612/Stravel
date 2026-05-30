import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { render } from '@testing-library/react';
import { CardDeckZone } from '../CardDeckZone';

describe('CardDeckZone', () => {
  it('renders without children (empty placeholder)', () => {
    const { container } = render(<CardDeckZone chatInputHeight={0} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    const { getByTestId } = render(
      <CardDeckZone chatInputHeight={0}>
        <div data-testid="card">card</div>
      </CardDeckZone>
    );
    expect(getByTestId('card')).toBeInTheDocument();
  });

  it('applies fixed positioning classes', () => {
    const { container } = render(<CardDeckZone chatInputHeight={0} />);
    expect(container.firstChild).toHaveClass('fixed', 'left-0', 'right-0', 'w-full');
  });

  it('sets bottom offset from chatInputHeight as inline style', () => {
    const { container } = render(<CardDeckZone chatInputHeight={72} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.bottom).toBe('72px');
  });

  it('forwards ref to the outer div', () => {
    const ref = createRef<HTMLDivElement>();
    render(<CardDeckZone ref={ref} chatInputHeight={0} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
