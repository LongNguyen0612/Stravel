import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TravelCard } from '../TravelCard';
import type { SlotKey } from '@/types/domain';

const formingProps = {
  cardId: 'test-badge',
  completenessScore: 0.5,
  isFinal: false,
  delta: { departDate: '2026-07-01', returnDate: '2026-07-08', category: 'sightseeing' },
  deckState: 'browsing' as const,
};

describe('TravelCard — assumed badges', () => {
  it('renders travel_dates assumed badge on flight card depart field', () => {
    render(
      <TravelCard
        {...formingProps}
        cardType="flight"
        assumedSlots={['travel_dates']}
      />
    );
    const badges = screen.getAllByText('(assumed)');
    expect(badges.length).toBeGreaterThanOrEqual(1);
    expect(badges[0]).toHaveAttribute('aria-label', 'travel_dates was assumed — tap to change');
  });

  it('renders activities assumed badge on activities card', () => {
    render(
      <TravelCard
        {...formingProps}
        cardType="activities"
        assumedSlots={['activities']}
      />
    );
    const badge = screen.getByText('(assumed)');
    expect(badge).toHaveAttribute('aria-label', 'activities was assumed — tap to change');
  });

  it('calls onAssumedBadgeTap with correct SlotKey when badge tapped', () => {
    const onTap = vi.fn();
    render(
      <TravelCard
        {...formingProps}
        cardType="activities"
        assumedSlots={['activities']}
        onAssumedBadgeTap={onTap}
      />
    );
    fireEvent.click(screen.getByText('(assumed)'));
    expect(onTap).toHaveBeenCalledWith('activities');
  });

  it('calls onAssumedBadgeTap with travel_dates when flight badge tapped', () => {
    const onTap = vi.fn();
    render(
      <TravelCard
        {...formingProps}
        cardType="flight"
        assumedSlots={['travel_dates']}
        onAssumedBadgeTap={onTap}
      />
    );
    fireEvent.click(screen.getAllByText('(assumed)')[0]);
    expect(onTap).toHaveBeenCalledWith('travel_dates' as SlotKey);
  });

  it('does not render assumed badges when assumedSlots is empty', () => {
    render(
      <TravelCard
        {...formingProps}
        cardType="flight"
        assumedSlots={[]}
      />
    );
    expect(screen.queryByText('(assumed)')).not.toBeInTheDocument();
  });

  it('does not render assumed badges when assumedSlots is undefined', () => {
    render(
      <TravelCard
        {...formingProps}
        cardType="flight"
      />
    );
    expect(screen.queryByText('(assumed)')).not.toBeInTheDocument();
  });

  it('does not render assumed badge for travel_dates on hotel card', () => {
    render(
      <TravelCard
        {...formingProps}
        cardType="hotel"
        assumedSlots={['travel_dates']}
      />
    );
    expect(screen.queryByText('(assumed)')).not.toBeInTheDocument();
  });
});
