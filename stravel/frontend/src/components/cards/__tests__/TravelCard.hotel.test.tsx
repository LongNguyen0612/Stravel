import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TravelCard } from '../TravelCard';

const formingProps = {
  cardId: 'hotel-test',
  cardType: 'hotel' as const,
  completenessScore: 0.5,
  isFinal: false,
  deckState: 'browsing' as const,
};

const settledProps = {
  ...formingProps,
  completenessScore: 0.9,
  isFinal: true,
};

describe('TravelCard — HotelFields highlights and compliance badge', () => {
  it('renders highlights as list in settled state', () => {
    render(
      <TravelCard
        {...settledProps}
        delta={{ highlights: ['Rooftop pool', 'Free breakfast', 'City view'] }}
      />
    );
    expect(screen.getByText('Rooftop pool')).toBeInTheDocument();
    expect(screen.getByText('Free breakfast')).toBeInTheDocument();
    expect(screen.getByText('City view')).toBeInTheDocument();
  });

  it('limits highlights to max 3 items', () => {
    render(
      <TravelCard
        {...settledProps}
        delta={{ highlights: ['H1', 'H2', 'H3', 'H4', 'H5'] }}
      />
    );
    expect(screen.getByText('H1')).toBeInTheDocument();
    expect(screen.getByText('H2')).toBeInTheDocument();
    expect(screen.getByText('H3')).toBeInTheDocument();
    expect(screen.queryByText('H4')).not.toBeInTheDocument();
    expect(screen.queryByText('H5')).not.toBeInTheDocument();
  });

  it('does not render highlights in forming state', () => {
    render(
      <TravelCard {...formingProps} delta={{ highlights: ['Great pool'] }} />
    );
    expect(screen.queryByText('Great pool')).not.toBeInTheDocument();
  });

  it('renders 🔴 badge for block severity', () => {
    render(
      <TravelCard {...formingProps} delta={{ complianceSeverity: 'block' }} />
    );
    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', 'Compliance: block');
    expect(badge.textContent).toContain('🔴');
  });

  it('renders 🟡 badge for warning severity', () => {
    render(
      <TravelCard {...formingProps} delta={{ complianceSeverity: 'warning' }} />
    );
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-label', 'Compliance: warning');
    expect(badge.textContent).toContain('🟡');
  });

  it('renders 🟢 badge for clear severity', () => {
    render(
      <TravelCard {...formingProps} delta={{ complianceSeverity: 'clear' }} />
    );
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-label', 'Compliance: clear');
    expect(badge.textContent).toContain('🟢');
  });

  it('does not render compliance badge when complianceSeverity is not set', () => {
    render(<TravelCard {...formingProps} delta={{ neighborhood: 'District 1' }} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('fires onComplianceBadgeTap with cardId when badge tapped', () => {
    const onTap = vi.fn();
    render(
      <TravelCard
        {...formingProps}
        delta={{ complianceSeverity: 'warning' }}
        onComplianceBadgeTap={onTap}
      />
    );
    fireEvent.click(screen.getByRole('status'));
    expect(onTap).toHaveBeenCalledWith('hotel-test');
  });
});
