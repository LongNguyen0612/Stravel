import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DemoPage } from '../App';

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

vi.mock('../hooks/useFooterHeight', () => ({
  useFooterHeight: () => 0,
}));

// Mock the entire cards barrel so we can capture CardDeck props
vi.mock('../components/cards', () => ({
  TravelCard: () => <div data-testid="travel-card" />,
  CardDeck: ({ cards, sessionId }: { cards: Array<{ card_id: string; completeness_score: number; is_final: boolean; type: string }>; sessionId?: string }) => (
    <div data-testid="card-deck" data-card-count={cards.length} data-session-id={sessionId ?? ''}>
      {cards.map(c => (
        <div
          key={c.card_id}
          data-testid={`card-${c.card_id}`}
          data-score={c.completeness_score}
          data-final={String(c.is_final)}
          data-type={c.type}
        />
      ))}
    </div>
  ),
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
let mockSsePhase: 'idle' | 'streaming' | 'complete' | 'error' = 'idle';
let mockSseStatus: string = 'idle';
let mockCardUpdates: Record<string, unknown> = {};

vi.mock('../hooks/useStreamContext', () => ({
  useStreamContext: () => ({
    connect: mockConnect,
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

describe('DemoPage — proposal streaming (AC1): nascent placeholders on stream start', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    mockConnect.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockSsePhase = 'idle';
    mockSseStatus = 'idle';
    mockCardUpdates = {};
  });

  it('AC1: when streamState.status is "proposing", CardDeck renders with 5 cards', async () => {
    mockSseStatus = 'proposing';
    render(<DemoPage />);
    await act(async () => {});

    expect(screen.getByTestId('card-deck')).toBeInTheDocument();
    expect(screen.getByTestId('card-deck').getAttribute('data-card-count')).toBe('5');
  });

  it('AC1: when ssePhase is "streaming", CardDeck also renders', async () => {
    mockSsePhase = 'streaming';
    render(<DemoPage />);
    await act(async () => {});

    expect(screen.getByTestId('card-deck')).toBeInTheDocument();
  });

  it('AC1: placeholder cards have completeness_score = 0 when no real cards', async () => {
    mockSseStatus = 'proposing';
    render(<DemoPage />);
    await act(async () => {});

    // Filter to only the individual card elements (those that have data-score attribute)
    const expectedTypes = ['flight', 'hotel', 'activities', 'budget', 'compliance'];
    expectedTypes.forEach(type => {
      const card = screen.getByTestId(`card-${type}`);
      expect(card.getAttribute('data-score')).toBe('0');
      expect(card.getAttribute('data-final')).toBe('false');
    });
  });

  it('AC1: placeholder card types are flight, hotel, activities, budget, compliance', async () => {
    mockSseStatus = 'proposing';
    render(<DemoPage />);
    await act(async () => {});

    // data-card-count on the CardDeck container tells us exactly how many cards were passed
    expect(screen.getByTestId('card-deck').getAttribute('data-card-count')).toBe('5');
    // Each expected type has its own rendered element
    const expectedTypes = ['flight', 'hotel', 'activities', 'budget', 'compliance'];
    expectedTypes.forEach(type => {
      expect(screen.getByTestId(`card-${type}`)).toBeInTheDocument();
    });
  });

  it('AC1: when ssePhase is "complete", CardDeck still renders (completed session)', async () => {
    mockSsePhase = 'complete';
    render(<DemoPage />);
    await act(async () => {});

    expect(screen.getByTestId('card-deck')).toBeInTheDocument();
  });

  it('AC1: when not proposing (idle), CardDeck is NOT rendered', async () => {
    render(<DemoPage />);
    await act(async () => {});

    expect(screen.queryByTestId('card-deck')).not.toBeInTheDocument();
  });
});

describe('DemoPage — proposal streaming (AC2/AC3): real card data replaces placeholders', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockSsePhase = 'idle';
    mockSseStatus = 'idle';
    mockCardUpdates = {};
  });

  it('AC2: real flight card with score 0.3 replaces the flight placeholder', async () => {
    mockSseStatus = 'proposing';
    mockCardUpdates = {
      'flight-001': {
        card_id: 'flight-001',
        type: 'flight',
        completeness_score: 0.3,
        delta: { origin: 'SGN' },
        is_final: false,
      },
    };
    render(<DemoPage />);
    await act(async () => {});

    // Real flight card (by its real card_id) should be in the deck
    const flightCard = screen.getByTestId('card-flight-001');
    expect(flightCard.getAttribute('data-score')).toBe('0.3');
    expect(flightCard.getAttribute('data-type')).toBe('flight');

    // The placeholder 'flight' card_id should NOT appear (replaced by real)
    expect(screen.queryByTestId('card-flight')).not.toBeInTheDocument();
  });

  it('AC3: real hotel card with is_final=true and score ≥ 0.75 appears settled', async () => {
    mockSseStatus = 'proposing';
    mockCardUpdates = {
      'hotel-001': {
        card_id: 'hotel-001',
        type: 'hotel',
        completeness_score: 0.8,
        delta: { name: 'Sofitel Saigon' },
        is_final: true,
      },
    };
    render(<DemoPage />);
    await act(async () => {});

    const hotelCard = screen.getByTestId('card-hotel-001');
    expect(hotelCard.getAttribute('data-score')).toBe('0.8');
    expect(hotelCard.getAttribute('data-final')).toBe('true');
  });

  it('AC2/AC3: partial updates preserve other placeholder cards', async () => {
    mockSsePhase = 'streaming';
    mockCardUpdates = {
      'flight-001': {
        card_id: 'flight-001',
        type: 'flight',
        completeness_score: 0.5,
        delta: {},
        is_final: false,
      },
    };
    render(<DemoPage />);
    await act(async () => {});

    // 5 total cards: 1 real flight + 4 placeholders
    expect(screen.getByTestId('card-deck').getAttribute('data-card-count')).toBe('5');
    // The real flight card is present
    expect(screen.getByTestId('card-flight-001')).toBeInTheDocument();
    // Other placeholders still present
    expect(screen.getByTestId('card-hotel')).toBeInTheDocument();
    expect(screen.getByTestId('card-activities')).toBeInTheDocument();
    expect(screen.getByTestId('card-budget')).toBeInTheDocument();
    expect(screen.getByTestId('card-compliance')).toBeInTheDocument();
  });
});

describe('DemoPage — proposal streaming (AC6): proposal-ready aria-live announcement', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockSsePhase = 'idle';
    mockSseStatus = 'idle';
    mockCardUpdates = {};
  });

  it('AC6: when ssePhase transitions to "complete", aria-sentinel announces proposal ready', async () => {
    mockSsePhase = 'streaming';
    mockSseStatus = 'proposing';
    const { rerender } = render(<DemoPage />);
    await act(async () => {});

    // Transition to complete
    mockSsePhase = 'complete';
    mockSseStatus = 'complete';
    await act(async () => { rerender(<DemoPage />); });

    const sentinel = screen.getByTestId('aria-sentinel');
    expect(sentinel.textContent).toMatch(/your trip proposal is ready/i);
  });

  it('AC6: when ssePhase transitions to "complete", stage-narrator message appears', async () => {
    mockSsePhase = 'streaming';
    mockSseStatus = 'proposing';
    const { rerender } = render(<DemoPage />);
    await act(async () => {});

    mockSsePhase = 'complete';
    mockSseStatus = 'complete';
    await act(async () => { rerender(<DemoPage />); });

    expect(screen.getByText(/your proposal is ready/i)).toBeInTheDocument();
  });

  it('AC6: starting from complete (e.g. hydrated session) does NOT fire sentinel on first render', async () => {
    mockSsePhase = 'complete';
    mockSseStatus = 'complete';
    render(<DemoPage />);
    await act(async () => {});

    // No transition occurred — sentinel should be empty (no streaming → complete transition)
    const sentinel = screen.getByTestId('aria-sentinel');
    expect(sentinel.textContent).not.toMatch(/your trip proposal is ready/i);
  });
});

describe('DemoPage — proposal streaming: demo card removal', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockSsePhase = 'idle';
    mockSseStatus = 'idle';
  });

  it('demo "Advance score" button is removed', async () => {
    render(<DemoPage />);
    await act(async () => {});

    expect(screen.queryByText(/Advance score/i)).not.toBeInTheDocument();
  });
});
