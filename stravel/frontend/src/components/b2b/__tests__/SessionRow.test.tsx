import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionRow } from '../SessionRow';
import type { AdvisorySession } from '../../../types/domain';

function makeSession(overrides: Partial<AdvisorySession> = {}): AdvisorySession {
  return {
    id: 'abc12345-0000-0000-0000-000000000001',
    tenant_id: 'test-tenant',
    status: 'pending',
    flag_reason: null,
    created_at: '2026-05-29T10:00:00Z',
    updated_at: '2026-05-29T10:00:00Z',
    traveler_profile: null,
    ...overrides,
  };
}

describe('SessionRow', () => {
  it('renders with role="option" and correct testid', () => {
    render(<SessionRow session={makeSession()} isActive={false} onSelect={vi.fn()} />);
    expect(screen.getByRole('option')).toBeInTheDocument();
    expect(screen.getByTestId('session-row-abc12345-0000-0000-0000-000000000001')).toBeInTheDocument();
  });

  it('shows avatar initials from session.id.slice(0,2).toUpperCase()', () => {
    render(<SessionRow session={makeSession()} isActive={false} onSelect={vi.fn()} />);
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('shows truncated session name', () => {
    render(<SessionRow session={makeSession()} isActive={false} onSelect={vi.fn()} />);
    expect(screen.getByText(/Session abc12345/)).toBeInTheDocument();
  });

  it('shows destination from traveler_profile.destination_preferences[0]', () => {
    render(
      <SessionRow
        session={makeSession({
          traveler_profile: {
            id: 'p1',
            advisory_session_id: 'abc12345-0000-0000-0000-000000000001',
            destination_preferences: ['Hanoi', 'Da Nang'],
            traveler_count: null, traveler_ages: null, nationalities: null,
            travel_start_date: null, travel_end_date: null, date_flexibility: null,
            budget_total: null, budget_currency: null, accommodation_style: null,
            dietary_requirements: null, accessibility_needs: null,
            activity_preferences: null, special_interests: null,
            passport_expiry_date: null, is_confirmed: false,
          },
        })}
        isActive={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Hanoi')).toBeInTheDocument();
  });

  it('shows "No destination" when profile is null', () => {
    render(<SessionRow session={makeSession({ traveler_profile: null })} isActive={false} onSelect={vi.fn()} />);
    expect(screen.getByText('No destination')).toBeInTheDocument();
  });

  it('shows "No destination" when destination_preferences is empty', () => {
    render(
      <SessionRow
        session={makeSession({
          traveler_profile: {
            id: 'p1',
            advisory_session_id: 'abc12345-0000-0000-0000-000000000001',
            destination_preferences: [],
            traveler_count: null, traveler_ages: null, nationalities: null,
            travel_start_date: null, travel_end_date: null, date_flexibility: null,
            budget_total: null, budget_currency: null, accommodation_style: null,
            dietary_requirements: null, accessibility_needs: null,
            activity_preferences: null, special_interests: null,
            passport_expiry_date: null, is_confirmed: false,
          },
        })}
        isActive={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('No destination')).toBeInTheDocument();
  });

  it('renders SessionStatusBadge', () => {
    render(<SessionRow session={makeSession()} isActive={false} onSelect={vi.fn()} />);
    expect(screen.getByTestId('session-status-badge')).toBeInTheDocument();
  });

  it('shows relative time text', () => {
    render(<SessionRow session={makeSession()} isActive={false} onSelect={vi.fn()} />);
    expect(screen.getByText(/ago|Just now/)).toBeInTheDocument();
  });

  it('has aria-selected="true" when isActive=true', () => {
    render(<SessionRow session={makeSession()} isActive={true} onSelect={vi.fn()} />);
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
  });

  it('has aria-selected="false" when isActive=false', () => {
    render(<SessionRow session={makeSession()} isActive={false} onSelect={vi.fn()} />);
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'false');
  });

  it('active row has left accent border using CSS var', () => {
    render(<SessionRow session={makeSession()} isActive={true} onSelect={vi.fn()} />);
    const row = screen.getByRole('option');
    expect(row.style.borderLeft).toContain('var(--color-primary)');
  });

  it('inactive row has transparent left border', () => {
    render(<SessionRow session={makeSession()} isActive={false} onSelect={vi.fn()} />);
    const row = screen.getByRole('option');
    expect(row.style.borderLeft).toContain('transparent');
  });

  it('has tabIndex=0', () => {
    render(<SessionRow session={makeSession()} isActive={false} onSelect={vi.fn()} />);
    expect(screen.getByRole('option')).toHaveAttribute('tabindex', '0');
  });

  it('calls onSelect on click', () => {
    const onSelect = vi.fn();
    const session = makeSession();
    render(<SessionRow session={session} isActive={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('option'));
    expect(onSelect).toHaveBeenCalledWith(session);
  });

  it('calls onSelect on Enter keydown', () => {
    const onSelect = vi.fn();
    const session = makeSession();
    render(<SessionRow session={session} isActive={false} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole('option'), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(session);
  });

  it('calls onSelect on Space keydown', () => {
    const onSelect = vi.fn();
    const session = makeSession();
    render(<SessionRow session={session} isActive={false} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole('option'), { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith(session);
  });

  it('does not call onSelect on other key', () => {
    const onSelect = vi.fn();
    render(<SessionRow session={makeSession()} isActive={false} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole('option'), { key: 'Tab' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('avatar background uses CSS var for status color', () => {
    render(<SessionRow session={makeSession({ status: 'flagged' })} isActive={false} onSelect={vi.fn()} />);
    const avatar = screen.getByText('AB').closest('[aria-hidden="true"]') as HTMLElement;
    expect(avatar?.style?.background).toContain('var(--status-flagged)');
  });

  it('row height is 64px', () => {
    render(<SessionRow session={makeSession()} isActive={false} onSelect={vi.fn()} />);
    const row = screen.getByRole('option');
    expect(row.style.height).toBe('64px');
  });
});
