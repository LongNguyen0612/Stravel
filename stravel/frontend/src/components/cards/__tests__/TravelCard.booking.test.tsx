import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TravelCard } from '../TravelCard';

const baseProps = {
  cardId: 'booking-test',
  cardType: 'booking' as const,
  completenessScore: 0.5,
  isFinal: false,
  delta: {},
};

describe('TravelCard — BookingFields', () => {
  it('renders 📋 icon for booking card', () => {
    render(<TravelCard {...baseProps} deckState="browsing" />);
    expect(screen.getByText('📋')).toBeInTheDocument();
  });

  it('renders 1 shimmer row in nascent state', () => {
    const { container } = render(
      <TravelCard {...baseProps} completenessScore={0.1} isFinal={false} deckState="browsing" />
    );
    const shimmers = container.querySelectorAll('.animate-shimmer');
    expect(shimmers).toHaveLength(1);
  });

  it('does not render booking CTA when deckState is browsing in forming state', () => {
    render(<TravelCard {...baseProps} deckState="browsing" />);
    expect(screen.queryByTestId('booking-cta')).not.toBeInTheDocument();
  });

  it('does not render booking CTA when deckState is browsing in settled state', () => {
    render(
      <TravelCard {...baseProps} completenessScore={0.9} isFinal={true} deckState="browsing" />
    );
    expect(screen.queryByTestId('booking-cta')).not.toBeInTheDocument();
  });

  it('renders booking CTA when deckState is committing', () => {
    render(<TravelCard {...baseProps} deckState="committing" />);
    expect(screen.getByTestId('booking-cta')).toBeInTheDocument();
    expect(screen.getByText('Book this trip')).toBeInTheDocument();
  });

  it('CTA has correct aria-label', () => {
    render(<TravelCard {...baseProps} deckState="committing" />);
    expect(screen.getByRole('button', { name: 'Book this trip' })).toBeInTheDocument();
  });

  it('fires onBook when CTA is clicked', () => {
    const onBook = vi.fn();
    render(<TravelCard {...baseProps} deckState="committing" onBook={onBook} />);
    fireEvent.click(screen.getByTestId('booking-cta'));
    expect(onBook).toHaveBeenCalledTimes(1);
  });
});
