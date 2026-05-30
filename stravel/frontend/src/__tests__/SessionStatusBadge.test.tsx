import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionStatusBadge } from '../components/shared/SessionStatusBadge';

describe('SessionStatusBadge — labels and icons', () => {
  it('renders "Pending" label for pending status', () => {
    render(<SessionStatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders "Confirmed" label for confirmed status', () => {
    render(<SessionStatusBadge status="confirmed" />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('renders "Modified" label for modified status', () => {
    render(<SessionStatusBadge status="modified" />);
    expect(screen.getByText('Modified')).toBeInTheDocument();
  });

  it('renders "Flagged" label for flagged status', () => {
    render(<SessionStatusBadge status="flagged" />);
    expect(screen.getByText('Flagged')).toBeInTheDocument();
  });

  it('renders an icon (svg) alongside the label', () => {
    const { container } = render(<SessionStatusBadge status="pending" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('icon has aria-hidden="true"', () => {
    const { container } = render(<SessionStatusBadge status="confirmed" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('SessionStatusBadge — ARIA', () => {
  it('has role="status"', () => {
    render(<SessionStatusBadge status="pending" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('aria-label is "Status: Pending" for pending', () => {
    render(<SessionStatusBadge status="pending" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Status: Pending');
  });

  it('aria-label is "Status: Confirmed" for confirmed', () => {
    render(<SessionStatusBadge status="confirmed" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Status: Confirmed');
  });

  it('aria-label is "Status: Modified" for modified', () => {
    render(<SessionStatusBadge status="modified" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Status: Modified');
  });

  it('aria-label is "Status: Flagged" for flagged', () => {
    render(<SessionStatusBadge status="flagged" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Status: Flagged');
  });
});

describe('SessionStatusBadge — color tokens', () => {
  it('uses CSS var for status color, not hardcoded hex', () => {
    const { container } = render(<SessionStatusBadge status="pending" />);
    const badge = container.querySelector('[data-testid="session-status-badge"]');
    expect(badge).toBeInTheDocument();
    const style = (badge as HTMLElement).style.color;
    expect(style).toContain('var(--status-pending)');
  });

  it('uses correct CSS var for flagged status', () => {
    const { container } = render(<SessionStatusBadge status="flagged" />);
    const badge = container.querySelector('[data-testid="session-status-badge"]');
    const style = (badge as HTMLElement).style.color;
    expect(style).toContain('var(--status-flagged)');
  });
});

describe('SessionStatusBadge — flagged tooltip', () => {
  it('shows title attribute with full flag_reason when flagged', () => {
    render(<SessionStatusBadge status="flagged" flag_reason="Visa documentation missing" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('title', 'Visa documentation missing');
  });

  it('renders tooltip element with flag_reason text', () => {
    render(<SessionStatusBadge status="flagged" flag_reason="Visa documentation missing" />);
    expect(screen.getByTestId('flag-reason-tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('flag-reason-tooltip')).toHaveTextContent('Visa documentation missing');
  });

  it('truncates tooltip text to 80 chars with ellipsis when reason is longer', () => {
    const longReason = 'A'.repeat(90);
    render(<SessionStatusBadge status="flagged" flag_reason={longReason} />);
    const tooltip = screen.getByTestId('flag-reason-tooltip');
    expect(tooltip.textContent).toBe('A'.repeat(80) + '…');
  });

  it('title attribute contains the full flag_reason even when longer than 80 chars', () => {
    const longReason = 'A'.repeat(90);
    render(<SessionStatusBadge status="flagged" flag_reason={longReason} />);
    expect(screen.getByRole('status')).toHaveAttribute('title', longReason);
  });

  it('does not render tooltip when flag_reason is not provided', () => {
    render(<SessionStatusBadge status="flagged" />);
    expect(screen.queryByTestId('flag-reason-tooltip')).not.toBeInTheDocument();
  });

  it('does not render tooltip for non-flagged statuses even with flag_reason', () => {
    render(<SessionStatusBadge status="confirmed" flag_reason="Some reason" />);
    expect(screen.queryByTestId('flag-reason-tooltip')).not.toBeInTheDocument();
  });
});
