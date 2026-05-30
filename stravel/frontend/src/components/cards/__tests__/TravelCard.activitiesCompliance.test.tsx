import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TravelCard } from '../TravelCard';

const formingProps = {
  cardId: 'activities-test',
  cardType: 'activities' as const,
  completenessScore: 0.5,
  isFinal: false,
  deckState: 'browsing' as const,
};

const settledProps = {
  ...formingProps,
  completenessScore: 0.9,
  isFinal: true,
};

describe('TravelCard — activities card compliance badge (AC1, AC2, AC3)', () => {
  it('AC1: renders 🔴 badge when complianceSeverity is block', () => {
    render(<TravelCard {...formingProps} delta={{ complianceSeverity: 'block' }} />);
    const badge = screen.getByRole('status');
    expect(badge.textContent).toContain('🔴');
  });

  it('AC1: renders 🟡 badge when complianceSeverity is warning', () => {
    render(<TravelCard {...formingProps} delta={{ complianceSeverity: 'warning' }} />);
    const badge = screen.getByRole('status');
    expect(badge.textContent).toContain('🟡');
  });

  it('AC1: renders 🟢 badge when complianceSeverity is clear', () => {
    render(<TravelCard {...formingProps} delta={{ complianceSeverity: 'clear' }} />);
    const badge = screen.getByRole('status');
    expect(badge.textContent).toContain('🟢');
  });

  it('AC1: does NOT render badge when complianceSeverity is absent', () => {
    render(<TravelCard {...formingProps} delta={{ category: 'Cultural' }} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('AC2: badge has correct aria-label for block severity', () => {
    render(<TravelCard {...formingProps} delta={{ complianceSeverity: 'block' }} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Compliance: block');
  });

  it('AC2: badge has correct aria-label for warning severity', () => {
    render(<TravelCard {...formingProps} delta={{ complianceSeverity: 'warning' }} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Compliance: warning');
  });

  it('AC2: badge has correct aria-label for clear severity', () => {
    render(<TravelCard {...formingProps} delta={{ complianceSeverity: 'clear' }} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Compliance: clear');
  });

  it('AC3: badge tap calls onComplianceBadgeTap with cardId', () => {
    const mockTap = vi.fn();
    render(
      <TravelCard
        {...formingProps}
        delta={{ complianceSeverity: 'block' }}
        onComplianceBadgeTap={mockTap}
      />
    );
    fireEvent.click(screen.getByRole('status'));
    expect(mockTap).toHaveBeenCalledWith('activities-test');
  });

  it('AC3: badge renders without onComplianceBadgeTap (no crash)', () => {
    render(<TravelCard {...formingProps} delta={{ complianceSeverity: 'warning' }} />);
    fireEvent.click(screen.getByRole('status'));
    // no crash — onComplianceBadgeTap is optional
  });

  it('AC3: pulse prop adds compliance-highlight class to settled card', () => {
    const { container } = render(
      <TravelCard {...settledProps} delta={{ complianceSeverity: 'clear' }} pulse />
    );
    const root = container.firstElementChild;
    expect(root?.className).toContain('compliance-highlight');
  });

  it('AC3: pulse prop does NOT add compliance-highlight in non-settled state', () => {
    const { container } = render(
      <TravelCard {...formingProps} delta={{ complianceSeverity: 'clear' }} pulse />
    );
    const root = container.firstElementChild;
    expect(root?.className).not.toContain('compliance-highlight');
  });

  it('AC3: data-card-type attribute is set to activities', () => {
    const { container } = render(<TravelCard {...settledProps} delta={{}} />);
    expect(container.firstElementChild).toHaveAttribute('data-card-type', 'activities');
  });
});
