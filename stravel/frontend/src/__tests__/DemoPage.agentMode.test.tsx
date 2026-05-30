import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DemoPage } from '../App';

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

vi.mock('../hooks/useFooterHeight', () => ({
  useFooterHeight: () => 0,
}));

vi.mock('../components/cards/TravelCard', () => ({
  TravelCard: () => <div data-testid="travel-card" />,
}));

vi.mock('../hooks/useStreamContext', () => ({
  useStreamContext: () => ({
    connect: vi.fn(),
    state: {
      ssePhase: 'idle',
      isConnected: false,
      messages: [],
      complianceFlags: [],
      cardUpdates: {},
      error: null,
      status: 'idle',
      slotState: {},
      assumedSlots: [],
      openSlotKey: null,
    },
    disconnect: vi.fn(),
    hydrateFromHistory: vi.fn(),
    proposeFirst: vi.fn(),
    openSlotCard: vi.fn(),
    removeAssumedSlot: vi.fn(),
    moodTransition: vi.fn(),
  }),
}));

vi.mock('../utils/messageClassifier', () => ({
  classifyMessage: vi.fn(() => 'ambiguous'),
  classifyBuildTripIntent: vi.fn(() => false),
}));

describe('DemoPage — agent mode toggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders B2BLayout shell when stravel_agent_mode is "true"', () => {
    localStorage.setItem('stravel_agent_mode', 'true');
    render(<DemoPage />);
    expect(screen.getByTestId('b2b-layout')).toBeInTheDocument();
    expect(screen.getByTestId('b2b-layout')).toHaveClass('theme-b2b');
  });

  it('does not render B2BLayout when stravel_agent_mode is absent', () => {
    render(<DemoPage />);
    expect(screen.queryByTestId('b2b-layout')).not.toBeInTheDocument();
  });

  it('clicking Chat Mode sets localStorage to "false" and hides B2BLayout', async () => {
    localStorage.setItem('stravel_agent_mode', 'true');
    render(<DemoPage />);

    expect(screen.getByTestId('b2b-layout')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-mode-toggle'));
    });

    expect(localStorage.getItem('stravel_agent_mode')).toBe('false');
    expect(screen.queryByTestId('b2b-layout')).not.toBeInTheDocument();
  });

  it('clicking Agent Mode toggle in B2C view sets localStorage to "true" and shows B2BLayout', async () => {
    render(<DemoPage />);
    expect(screen.queryByTestId('b2b-layout')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('agent-mode-toggle'));
    });

    expect(localStorage.getItem('stravel_agent_mode')).toBe('true');
    expect(screen.getByTestId('b2b-layout')).toBeInTheDocument();
  });
});
