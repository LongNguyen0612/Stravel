import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { StagingGate } from '../StagingGate';
import type { AdvisorySession } from '../../../types/domain';

vi.mock('../../../services/apiClient', () => ({
  api: {
    sessions: {
      updateStatus: vi.fn(),
    },
  },
}));

import { api } from '../../../services/apiClient';
const mockUpdateStatus = vi.mocked(api.sessions.updateStatus);

function mockSession(
  status: AdvisorySession['status'] = 'pending',
  flag_reason?: string,
): AdvisorySession {
  return {
    id: 'test-session-abc',
    tenant_id: 'default',
    status,
    flag_reason: flag_reason ?? null,
    created_at: '2026-05-29T00:00:00Z',
    updated_at: '2026-05-29T01:00:00Z',
    traveler_profile: null,
  };
}

describe('StagingGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Banner state tests ────────────────────────────────────────────
  it('renders draft banner for pending session', () => {
    render(<StagingGate session={mockSession('pending')} onStatusChange={vi.fn()} />);
    expect(screen.getByTestId('staging-banner-draft')).toBeInTheDocument();
    expect(screen.getByText(/Working draft/i)).toBeInTheDocument();
  });

  it('renders draft banner for modified session', () => {
    render(<StagingGate session={mockSession('modified')} onStatusChange={vi.fn()} />);
    expect(screen.getByTestId('staging-banner-draft')).toBeInTheDocument();
  });

  it('shows no visible banner for confirmed session', () => {
    render(<StagingGate session={mockSession('confirmed')} onStatusChange={vi.fn()} />);
    expect(screen.queryByTestId('staging-banner-draft')).not.toBeInTheDocument();
    expect(screen.queryByTestId('staging-banner-flagged')).not.toBeInTheDocument();
    expect(screen.queryByTestId('staging-banner-confirmed')).not.toBeInTheDocument();
  });

  it('renders red alert banner for flagged session', () => {
    render(
      <StagingGate session={mockSession('flagged', 'Missing visa')} onStatusChange={vi.fn()} />,
    );
    expect(screen.getByTestId('staging-banner-flagged')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Missing visa/i)).toBeInTheDocument();
  });

  it('draft banner has role="banner"', () => {
    render(<StagingGate session={mockSession('pending')} onStatusChange={vi.fn()} />);
    const banner = screen.getByTestId('staging-banner-draft');
    expect(banner).toHaveAttribute('role', 'banner');
    expect(banner).not.toHaveAttribute('aria-live'); // sr-only sentinel handles announcements
  });

  it('flagged banner has no "Mark as client-ready" button', () => {
    render(<StagingGate session={mockSession('flagged', 'reason')} onStatusChange={vi.fn()} />);
    expect(screen.queryByTestId('mark-client-ready-btn')).not.toBeInTheDocument();
  });

  // ── Modal open ───────────────────────────────────────────────────
  it('clicking "Mark as client-ready" opens confirmation modal', () => {
    render(<StagingGate session={mockSession('pending')} onStatusChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mark-client-ready-btn'));
    expect(screen.getByTestId('staging-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-cancel-btn')).toBeInTheDocument();
    expect(screen.getByTestId('modal-confirm-btn')).toBeInTheDocument();
  });

  it('modal has role="dialog" and aria-modal="true"', () => {
    render(<StagingGate session={mockSession('pending')} onStatusChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mark-client-ready-btn'));
    const modal = screen.getByTestId('staging-modal');
    expect(modal).toHaveAttribute('role', 'dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
  });

  // ── Cancel ───────────────────────────────────────────────────────
  it('clicking Cancel closes modal without API call', () => {
    render(<StagingGate session={mockSession('pending')} onStatusChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mark-client-ready-btn'));
    fireEvent.click(screen.getByTestId('modal-cancel-btn'));
    expect(screen.queryByTestId('staging-modal')).not.toBeInTheDocument();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it('pressing Escape closes modal without API call', () => {
    render(<StagingGate session={mockSession('pending')} onStatusChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mark-client-ready-btn'));
    fireEvent.keyDown(screen.getByTestId('staging-modal'), { key: 'Escape' });
    expect(screen.queryByTestId('staging-modal')).not.toBeInTheDocument();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it('Cancel returns focus to trigger button', async () => {
    render(<StagingGate session={mockSession('pending')} onStatusChange={vi.fn()} />);
    const triggerBtn = screen.getByTestId('mark-client-ready-btn');
    fireEvent.click(triggerBtn);
    fireEvent.click(screen.getByTestId('modal-cancel-btn'));
    expect(document.activeElement).toBe(triggerBtn);
  });

  // ── Confirm ──────────────────────────────────────────────────────
  it('clicking Confirm calls api.sessions.updateStatus with (id, "confirmed")', async () => {
    const confirmed = mockSession('confirmed');
    mockUpdateStatus.mockResolvedValueOnce(confirmed);

    render(<StagingGate session={mockSession('pending')} onStatusChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mark-client-ready-btn'));
    fireEvent.click(screen.getByTestId('modal-confirm-btn'));

    await waitFor(() => {
      expect(mockUpdateStatus).toHaveBeenCalledWith('test-session-abc', 'confirmed', undefined);
    });
  });

  it('on API success: modal closes and confirmed banner appears', async () => {
    const confirmed = mockSession('confirmed');
    mockUpdateStatus.mockResolvedValueOnce(confirmed);
    const onStatusChange = vi.fn();

    render(<StagingGate session={mockSession('pending')} onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByTestId('mark-client-ready-btn'));
    fireEvent.click(screen.getByTestId('modal-confirm-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('staging-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('staging-banner-confirmed')).toBeInTheDocument();
    });
    expect(onStatusChange).toHaveBeenCalledWith(confirmed);
  });

  it('confirmed banner auto-dismisses after 3 seconds', async () => {
    vi.useFakeTimers();
    const confirmed = mockSession('confirmed');
    mockUpdateStatus.mockResolvedValueOnce(confirmed);

    render(<StagingGate session={mockSession('pending')} onStatusChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mark-client-ready-btn'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('modal-confirm-btn'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('staging-banner-confirmed')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByTestId('staging-banner-confirmed')).not.toBeInTheDocument();
  });

  // ── Focus trap (P6) ──────────────────────────────────────────────
  it('Tab from Confirm cycles focus back to Cancel (focus trap)', () => {
    render(<StagingGate session={mockSession('pending')} onStatusChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mark-client-ready-btn'));

    const confirmBtn = screen.getByTestId('modal-confirm-btn');
    const cancelBtn = screen.getByTestId('modal-cancel-btn');
    const modal = screen.getByTestId('staging-modal');

    confirmBtn.focus();
    fireEvent.keyDown(modal, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('Shift+Tab from Cancel cycles focus to Confirm (focus trap)', () => {
    render(<StagingGate session={mockSession('pending')} onStatusChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mark-client-ready-btn'));

    const cancelBtn = screen.getByTestId('modal-cancel-btn');
    const confirmBtn = screen.getByTestId('modal-confirm-btn');
    const modal = screen.getByTestId('staging-modal');

    cancelBtn.focus();
    fireEvent.keyDown(modal, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmBtn);
  });

  // ── Error state (P3) ──────────────────────────────────────────────
  it('shows error message when API call fails', async () => {
    mockUpdateStatus.mockRejectedValueOnce(new Error('Network error'));

    render(<StagingGate session={mockSession('pending')} onStatusChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mark-client-ready-btn'));
    fireEvent.click(screen.getByTestId('modal-confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-error')).toBeInTheDocument();
      expect(screen.getByTestId('modal-error')).toHaveAttribute('role', 'alert');
    });
    expect(screen.getByTestId('staging-modal')).toBeInTheDocument(); // modal stays open
  });

  // ── Announcement sentinel ─────────────────────────────────────────
  it('sr-only aria-live sentinel announces session confirmed on success', async () => {
    const confirmed = mockSession('confirmed');
    mockUpdateStatus.mockResolvedValueOnce(confirmed);

    render(<StagingGate session={mockSession('pending')} onStatusChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mark-client-ready-btn'));
    fireEvent.click(screen.getByTestId('modal-confirm-btn'));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /Session confirmed and shared with client/i,
      );
    });
  });

  // ── AC7 confirmed→modified transition (P7) ───────────────────────
  it('announces "Session returned to draft" when status transitions from confirmed to modified', () => {
    const { rerender } = render(
      <StagingGate session={mockSession('confirmed')} onStatusChange={vi.fn()} />,
    );

    rerender(<StagingGate session={mockSession('modified')} onStatusChange={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent(/Session returned to draft/i);
  });
});
