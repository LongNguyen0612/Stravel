import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TravelCard } from '../TravelCard';

const baseProps = {
  cardId: 'test-1',
  cardType: 'flight' as const,
  completenessScore: 0.1,
  isFinal: false,
  delta: {},
  deckState: 'browsing' as const,
};

describe('TravelCard — nascent state', () => {
  it('renders article role', () => {
    render(<TravelCard {...baseProps} />);
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('has correct aria-label with card type and percentage', () => {
    render(<TravelCard {...baseProps} completenessScore={0.1} />);
    expect(screen.getByRole('article')).toHaveAttribute(
      'aria-label',
      'flight card, 10% complete'
    );
  });

  it('renders sr-only live region', () => {
    const { container } = render(<TravelCard {...baseProps} />);
    const srOnly = container.querySelector('.sr-only[aria-live="polite"]');
    expect(srOnly).toBeInTheDocument();
    expect(srOnly?.textContent).toBe('10% complete');
  });

  it('does not render "Taking longer than expected" before timeout', () => {
    render(<TravelCard {...baseProps} />);
    expect(screen.queryByText('Taking longer than expected')).not.toBeInTheDocument();
  });

  it('applies will-change-transform class when shimmerEnabled=true', () => {
    const { container } = render(<TravelCard {...baseProps} shimmerEnabled={true} />);
    expect(container.querySelector('.will-change-transform')).toBeInTheDocument();
  });

  it('does not apply will-change-transform when shimmerEnabled=false', () => {
    const { container } = render(<TravelCard {...baseProps} shimmerEnabled={false} />);
    expect(container.querySelector('.will-change-transform')).not.toBeInTheDocument();
  });
});

describe('TravelCard — forming state', () => {
  const formingProps = { ...baseProps, completenessScore: 0.5 };

  it('shows percentage in footer', () => {
    const { container } = render(<TravelCard {...formingProps} />);
    const footer = container.querySelector('.mt-2.text-xs.text-text-muted');
    expect(footer?.textContent).toBe('50% complete');
  });

  it('aria-label reflects forming score', () => {
    render(<TravelCard {...formingProps} />);
    expect(screen.getByRole('article')).toHaveAttribute(
      'aria-label',
      'flight card, 50% complete'
    );
  });
});

describe('TravelCard — settled state', () => {
  const settledProps = { ...baseProps, completenessScore: 0.9, isFinal: true };

  it('shows edit button when onEdit provided', () => {
    const onEdit = vi.fn();
    render(<TravelCard {...settledProps} onEdit={onEdit} />);
    expect(screen.getByRole('button', { name: /edit flight card/i })).toBeInTheDocument();
  });

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn();
    render(<TravelCard {...settledProps} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /edit flight card/i }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('does not show Book button in browsing deckState', () => {
    render(<TravelCard {...settledProps} onBook={vi.fn()} deckState="browsing" />);
    expect(screen.queryByRole('button', { name: /book/i })).not.toBeInTheDocument();
  });

  it('shows Book button in committing deckState', () => {
    render(
      <TravelCard {...settledProps} onBook={vi.fn()} deckState="committing" />
    );
    expect(screen.getByRole('button', { name: /book/i })).toBeInTheDocument();
  });
});

describe('TravelCard — error state (stall timeout)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows error message after 90s stall', () => {
    render(<TravelCard {...baseProps} completenessScore={0.1} isFinal={false} />);
    act(() => { vi.advanceTimersByTime(90_001); });
    expect(screen.getByText('Taking longer than expected')).toBeInTheDocument();
  });

  it('shows Try again button in error state', () => {
    render(<TravelCard {...baseProps} completenessScore={0.1} isFinal={false} />);
    act(() => { vi.advanceTimersByTime(90_001); });
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('calls onRetry when Try again is clicked', () => {
    const onRetry = vi.fn();
    render(
      <TravelCard {...baseProps} completenessScore={0.1} isFinal={false} onRetry={onRetry} />
    );
    act(() => { vi.advanceTimersByTime(90_001); });
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not stall when not nascent (forming)', () => {
    render(<TravelCard {...baseProps} completenessScore={0.5} isFinal={false} />);
    act(() => { vi.advanceTimersByTime(90_001); });
    expect(screen.queryByText('Taking longer than expected')).not.toBeInTheDocument();
  });
});

describe('TravelCard — card types', () => {
  it('renders hotel card type', () => {
    render(<TravelCard {...baseProps} cardType="hotel" completenessScore={0.5} />);
    expect(screen.getByRole('article')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('hotel card')
    );
    expect(screen.getByText('hotel')).toBeInTheDocument();
  });

  it('renders activities card type', () => {
    render(<TravelCard {...baseProps} cardType="activities" completenessScore={0.5} />);
    expect(screen.getByRole('article')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('activities card')
    );
  });

  it('renders visa card type', () => {
    render(<TravelCard {...baseProps} cardType="visa" completenessScore={0.5} />);
    expect(screen.getByRole('article')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('visa card')
    );
  });

  it('renders flight structural fields in forming state', () => {
    render(
      <TravelCard
        {...baseProps}
        cardType="flight"
        completenessScore={0.5}
        delta={{ origin: 'HAN', destination: 'SGN' } as Record<string, unknown>}
      />
    );
    expect(screen.getByText('HAN')).toBeInTheDocument();
    expect(screen.getByText('SGN')).toBeInTheDocument();
  });
});

describe('TravelCard — touch-pan-y', () => {
  it('has touch-pan-y class on outer container', () => {
    const { container } = render(<TravelCard {...baseProps} />);
    expect(container.firstChild).toHaveClass('touch-pan-y');
  });
});
