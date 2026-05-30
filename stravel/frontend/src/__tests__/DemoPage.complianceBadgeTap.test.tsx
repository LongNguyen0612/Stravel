import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { DemoPage } from '../App';
import type { CardUpdateEvent } from '../types/domain';

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

vi.mock('../hooks/useFooterHeight', () => ({
  useFooterHeight: () => 0,
}));

vi.mock('../utils/messageClassifier', () => ({
  classifyMessage: vi.fn(() => 'ambiguous'),
  classifyBuildTripIntent: vi.fn(() => false),
}));

vi.mock('../services/apiClient', () => ({
  api: {
    sessions: {
      run: vi.fn().mockResolvedValue({ status: 'queued' }),
      create: vi.fn().mockResolvedValue({ id: 'test-session-id' }),
    },
    auth: { login: vi.fn() },
    profile: { update: vi.fn() },
    userPreferences: {
      saveTripName: vi.fn().mockResolvedValue(undefined),
      getTripName: vi.fn().mockReturnValue(null),
    },
  },
}));

const mockConnect = vi.fn();
const mockMoodTransition = vi.fn();
let mockSsePhase: 'idle' | 'streaming' | 'complete' | 'error' = 'complete';
let mockSseStatus: string = 'proposing';
let mockCardUpdates: Record<string, CardUpdateEvent> = {};
let capturedOnComplianceBadgeTap: ((cardId: string) => void) | undefined;
let capturedHighlightCompliance: boolean | undefined;

vi.mock('../components/cards', () => ({
  TravelCard: () => <div data-testid="travel-card" />,
  CardDeck: ({
    cards,
    onComplianceBadgeTap,
    highlightComplianceCard,
  }: {
    cards: CardUpdateEvent[];
    onComplianceBadgeTap?: (cardId: string) => void;
    highlightComplianceCard?: boolean;
  }) => {
    capturedOnComplianceBadgeTap = onComplianceBadgeTap;
    capturedHighlightCompliance = highlightComplianceCard;
    return (
      <div data-testid="card-deck" data-card-count={cards.length} data-highlight={String(highlightComplianceCard ?? false)}>
        {/* compliance card sentinel so handleComplianceBadgeTap querySelector finds it */}
        <div data-card-type="compliance" />
        <button
          type="button"
          data-testid="mock-compliance-badge"
          onClick={() => onComplianceBadgeTap?.('compliance-1')}
        />
      </div>
    );
  },
}));

vi.mock('../hooks/useStreamContext', () => ({
  useStreamContext: () => ({
    connect: mockConnect,
    moodTransition: mockMoodTransition,
    state: {
      ssePhase: mockSsePhase,
      status: mockSseStatus,
      isConnected: false,
      messages: [],
      complianceFlags: [],
      cardUpdates: mockCardUpdates,
      error: null,
      slotState: {},
      assumedSlots: [],
      openSlotKey: null,
    },
    disconnect: vi.fn(),
    hydrateFromHistory: vi.fn(),
    proposeFirst: vi.fn(),
    openSlotCard: vi.fn(),
    removeAssumedSlot: vi.fn(),
  }),
}));

describe('DemoPage — compliance badge tap (AC3)', () => {
  beforeEach(() => {
    // scrollIntoView is not implemented in jsdom
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.removeItem('stravel_agent_mode');
    localStorage.setItem('token', 'test-token');
    mockConnect.mockClear();
    mockMoodTransition.mockClear();
    mockSsePhase = 'complete';
    mockSseStatus = 'proposing';
    mockCardUpdates = {};
    capturedOnComplianceBadgeTap = undefined;
    capturedHighlightCompliance = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockSsePhase = 'complete';
    mockSseStatus = 'proposing';
    mockCardUpdates = {};
  });

  it('AC3: CardDeck receives onComplianceBadgeTap prop', async () => {
    render(<DemoPage />);
    await act(async () => {});
    expect(typeof capturedOnComplianceBadgeTap).toBe('function');
  });

  it('AC3: highlightComplianceCard is false initially', async () => {
    render(<DemoPage />);
    await act(async () => {});
    expect(capturedHighlightCompliance).toBe(false);
  });

  it('AC3: tapping compliance badge sets highlightComplianceCard to true', async () => {
    render(<DemoPage />);
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-compliance-badge'));
    });

    const deck = screen.getByTestId('card-deck');
    expect(deck.getAttribute('data-highlight')).toBe('true');
  });

  it('AC3: highlightComplianceCard resets to false after 200ms', async () => {
    vi.useFakeTimers();
    render(<DemoPage />);
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-compliance-badge'));
    });

    expect(screen.getByTestId('card-deck').getAttribute('data-highlight')).toBe('true');

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId('card-deck').getAttribute('data-highlight')).toBe('false');
    vi.useRealTimers();
  });
});
