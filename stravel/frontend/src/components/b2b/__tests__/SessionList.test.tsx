import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionList } from '../SessionList';
import type { AdvisorySession } from '../../../types/domain';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        key: i,
        index: i,
        start: i * estimateSize(),
        size: estimateSize(),
      })),
    getTotalSize: () => count * estimateSize(),
  }),
}));

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

describe('SessionList', () => {
  it('renders container with role="listbox" and aria-label', () => {
    render(<SessionList sessions={[]} onSelect={vi.fn()} />);
    const list = screen.getByRole('listbox');
    expect(list).toBeInTheDocument();
    expect(list).toHaveAttribute('aria-label', 'Client sessions');
  });

  it('renders with data-testid="session-list"', () => {
    render(<SessionList sessions={[]} onSelect={vi.fn()} />);
    expect(screen.getByTestId('session-list')).toBeInTheDocument();
  });

  it('renders all sessions when no filter active', () => {
    const sessions = [
      makeSession({ id: 'id1-0000-0000-0000-000000000001' }),
      makeSession({ id: 'id2-0000-0000-0000-000000000001' }),
      makeSession({ id: 'id3-0000-0000-0000-000000000001' }),
    ];
    render(<SessionList sessions={sessions} onSelect={vi.fn()} />);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('shows empty state when sessions is empty', () => {
    render(<SessionList sessions={[]} onSelect={vi.fn()} />);
    expect(screen.getByTestId('session-list-empty')).toBeInTheDocument();
  });

  it('shows empty state when search yields no results', () => {
    render(<SessionList sessions={[makeSession()]} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByTestId('session-search'), { target: { value: 'zzznomatch' } });
    expect(screen.getByTestId('session-list-empty')).toBeInTheDocument();
  });

  it('filters sessions by session ID substring (case-insensitive)', () => {
    const sessions = [
      makeSession({ id: 'abc12345-0000-0000-0000-000000000001' }),
      makeSession({ id: 'xyz99999-0000-0000-0000-000000000002' }),
    ];
    render(<SessionList sessions={sessions} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByTestId('session-search'), { target: { value: 'ABC' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByTestId('session-row-abc12345-0000-0000-0000-000000000001')).toBeInTheDocument();
  });

  it('filters by destination substring (case-insensitive)', () => {
    const withDest = makeSession({
      id: 'dest1111-0000-0000-0000-000000000001',
      traveler_profile: {
        id: 'p1', advisory_session_id: 'dest1111-0000-0000-0000-000000000001',
        destination_preferences: ['Hanoi'],
        traveler_count: null, traveler_ages: null, nationalities: null,
        travel_start_date: null, travel_end_date: null, date_flexibility: null,
        budget_total: null, budget_currency: null, accommodation_style: null,
        dietary_requirements: null, accessibility_needs: null,
        activity_preferences: null, special_interests: null,
        passport_expiry_date: null, is_confirmed: false,
      },
    });
    const noDest = makeSession({ id: 'nodest22-0000-0000-0000-000000000002' });
    render(<SessionList sessions={[withDest, noDest]} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByTestId('session-search'), { target: { value: 'hanoi' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByTestId('session-row-dest1111-0000-0000-0000-000000000001')).toBeInTheDocument();
  });

  it('status filter shows only matching sessions', () => {
    const sessions = [
      makeSession({ id: 'pend1111-0000-0000-0000-000000000001', status: 'pending' }),
      makeSession({ id: 'conf2222-0000-0000-0000-000000000002', status: 'confirmed' }),
      makeSession({ id: 'pend3333-0000-0000-0000-000000000003', status: 'pending' }),
    ];
    render(<SessionList sessions={sessions} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByTestId('filter-chip-confirmed'));
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByTestId('session-row-conf2222-0000-0000-0000-000000000002')).toBeInTheDocument();
  });

  it('multiple status filters show all matching sessions', () => {
    const sessions = [
      makeSession({ id: 'pend1111-0000-0000-0000-000000000001', status: 'pending' }),
      makeSession({ id: 'conf2222-0000-0000-0000-000000000002', status: 'confirmed' }),
      makeSession({ id: 'flag3333-0000-0000-0000-000000000003', status: 'flagged' }),
    ];
    render(<SessionList sessions={sessions} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByTestId('filter-chip-pending'));
    fireEvent.click(screen.getByTestId('filter-chip-confirmed'));
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('deselecting a filter chip restores unfiltered results', () => {
    const sessions = [
      makeSession({ id: 'pend1111-0000-0000-0000-000000000001', status: 'pending' }),
      makeSession({ id: 'conf2222-0000-0000-0000-000000000002', status: 'confirmed' }),
    ];
    render(<SessionList sessions={sessions} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByTestId('filter-chip-pending'));
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('filter-chip-pending'));
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('filter chips have aria-pressed reflecting active state', () => {
    render(<SessionList sessions={[makeSession()]} onSelect={vi.fn()} />);
    const chip = screen.getByTestId('filter-chip-pending');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onSelect when a session row is clicked', () => {
    const onSelect = vi.fn();
    const session = makeSession();
    render(<SessionList sessions={[session]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('option'));
    expect(onSelect).toHaveBeenCalledWith(session);
  });

  it('passes activeSessionId to mark active row', () => {
    const session = makeSession();
    render(<SessionList sessions={[session]} activeSessionId={session.id} onSelect={vi.fn()} />);
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
  });

  it('search input has accessible label', () => {
    render(<SessionList sessions={[]} onSelect={vi.fn()} />);
    expect(screen.getByLabelText('Search sessions')).toBeInTheDocument();
  });
});
