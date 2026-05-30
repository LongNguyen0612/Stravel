import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { B2BLayout } from '../components/b2b/B2BLayout';
import type { AdvisorySession } from '../types/domain';

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

vi.mock('../services/apiClient', () => ({
  api: { sessions: { updateStatus: vi.fn() } },
}));

function mockSession(id: string, status = 'pending'): AdvisorySession {
  return {
    id,
    tenant_id: 'default',
    status: status as AdvisorySession['status'],
    created_at: '2026-05-29T00:00:00Z',
    updated_at: '2026-05-29T00:00:00Z',
    traveler_profile: null,
  };
}

describe('B2BLayout', () => {
  it('renders without crash with empty sessions', () => {
    render(<B2BLayout sessions={[]} onSelectSession={vi.fn()} onToggleMode={vi.fn()} />);
    expect(screen.getByTestId('b2b-layout')).toBeInTheDocument();
  });

  it('has theme-b2b class on root element', () => {
    render(<B2BLayout sessions={[]} onSelectSession={vi.fn()} onToggleMode={vi.fn()} />);
    expect(screen.getByTestId('b2b-layout')).toHaveClass('theme-b2b');
  });

  it('shows session IDs in the DOM when sessions are provided', () => {
    const sessions = [mockSession('aaaabbbb-cccc-0000-0000-000000000001')];
    render(<B2BLayout sessions={sessions} onSelectSession={vi.fn()} onToggleMode={vi.fn()} />);
    // truncated to 8 chars + ellipsis: "aaaabbbb…"
    const els = screen.getAllByText(/aaaabbbb/i);
    expect(els.length).toBeGreaterThan(0);
  });

  it('calls onToggleMode when Chat Mode button is clicked', () => {
    const onToggleMode = vi.fn();
    render(<B2BLayout sessions={[]} onSelectSession={vi.fn()} onToggleMode={onToggleMode} />);
    fireEvent.click(screen.getByTestId('chat-mode-toggle'));
    expect(onToggleMode).toHaveBeenCalledTimes(1);
  });

  it('clicking session avatar in icon-rail opens the overlay', () => {
    const sessions = [mockSession('test-session-001')];
    render(<B2BLayout sessions={sessions} onSelectSession={vi.fn()} onToggleMode={vi.fn()} />);
    fireEvent.click(screen.getByTestId('session-avatar-test-session-001'));
    expect(screen.getByTestId('session-overlay')).toBeInTheDocument();
  });

  it('close overlay button hides the overlay', () => {
    const sessions = [mockSession('test-session-002')];
    render(<B2BLayout sessions={sessions} onSelectSession={vi.fn()} onToggleMode={vi.fn()} />);
    fireEvent.click(screen.getByTestId('session-avatar-test-session-002'));
    expect(screen.getByTestId('session-overlay')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('close-overlay'));
    expect(screen.queryByTestId('session-overlay')).not.toBeInTheDocument();
  });

  it('renders children in right panel slots', () => {
    render(
      <B2BLayout sessions={[]} onSelectSession={vi.fn()} onToggleMode={vi.fn()}>
        <div data-testid="custom-right-content">Right Panel</div>
      </B2BLayout>
    );
    // children appear in right panels (multiple panels rendered in jsdom)
    const els = screen.getAllByTestId('custom-right-content');
    expect(els.length).toBeGreaterThan(0);
  });

  it('shows "Select a session to begin" placeholder when no children', () => {
    render(<B2BLayout sessions={[]} onSelectSession={vi.fn()} onToggleMode={vi.fn()} />);
    const placeholders = screen.getAllByText(/Select a session to begin/i);
    expect(placeholders.length).toBeGreaterThan(0);
  });

  it('shows Agent Mode badge in header', () => {
    render(<B2BLayout sessions={[]} onSelectSession={vi.fn()} onToggleMode={vi.fn()} />);
    expect(screen.getByText('Agent Mode')).toBeInTheDocument();
  });

  it('renders StagingGate draft banner when activeSession with pending status is provided', () => {
    const activeSession: AdvisorySession = {
      id: 'staging-test-001',
      tenant_id: 'default',
      status: 'pending',
      flag_reason: null,
      created_at: '2026-05-29T00:00:00Z',
      updated_at: '2026-05-29T00:00:00Z',
      traveler_profile: null,
    };
    render(
      <B2BLayout
        sessions={[]}
        onSelectSession={vi.fn()}
        onToggleMode={vi.fn()}
        activeSession={activeSession}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('staging-banner-draft').length).toBeGreaterThan(0);
  });

  it('does not render StagingGate banner when no activeSession is provided', () => {
    render(<B2BLayout sessions={[]} onSelectSession={vi.fn()} onToggleMode={vi.fn()} />);
    expect(screen.queryByTestId('staging-banner-draft')).not.toBeInTheDocument();
  });
});
