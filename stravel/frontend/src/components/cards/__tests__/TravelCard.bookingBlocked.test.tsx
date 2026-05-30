import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TravelCard } from '../TravelCard';

const bookingCommittingProps = {
  cardId: 'booking-test',
  cardType: 'booking' as const,
  completenessScore: 0.9,
  isFinal: true,
  deckState: 'committing' as const,
};

describe('TravelCard — BookingCard CTA compliance gate (AC5)', () => {
  it('AC5: CTA has aria-disabled when onBook is undefined', () => {
    render(<TravelCard {...bookingCommittingProps} delta={{}} />);
    const cta = screen.getByTestId('booking-cta');
    expect(cta).toHaveAttribute('aria-disabled', 'true');
  });

  it('AC5: CTA has tooltip title when onBook is undefined', () => {
    render(<TravelCard {...bookingCommittingProps} delta={{}} />);
    const cta = screen.getByTestId('booking-cta');
    expect(cta).toHaveAttribute('title', 'Resolve compliance issues before booking');
  });

  it('AC5: CTA does NOT have aria-disabled when onBook is provided', () => {
    const mockBook = vi.fn();
    render(<TravelCard {...bookingCommittingProps} delta={{}} onBook={mockBook} />);
    const cta = screen.getByTestId('booking-cta');
    expect(cta).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('AC5: CTA does NOT have tooltip when onBook is provided', () => {
    const mockBook = vi.fn();
    render(<TravelCard {...bookingCommittingProps} delta={{}} onBook={mockBook} />);
    const cta = screen.getByTestId('booking-cta');
    expect(cta).not.toHaveAttribute('title');
  });

  it('AC5: CTA is visually dimmed when onBook is undefined', () => {
    render(<TravelCard {...bookingCommittingProps} delta={{}} />);
    const cta = screen.getByTestId('booking-cta');
    expect(cta.className).toContain('opacity-50');
  });

  it('AC5: clicking disabled CTA does not call handler (no onBook set)', () => {
    render(<TravelCard {...bookingCommittingProps} delta={{}} />);
    const cta = screen.getByTestId('booking-cta');
    // No error should be thrown even when clicking a button with no handler
    fireEvent.click(cta);
  });

  it('AC5: data-card-type attribute is set to booking', () => {
    const { container } = render(<TravelCard {...bookingCommittingProps} delta={{}} />);
    expect(container.firstElementChild).toHaveAttribute('data-card-type', 'booking');
  });
});
