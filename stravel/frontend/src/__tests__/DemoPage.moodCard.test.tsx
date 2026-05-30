import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
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
  }),
}));


vi.mock('../utils/messageClassifier', () => ({
  classifyMessage: vi.fn((text: string) =>
    text.toLowerCase().includes('hanoi') ? 'specific' : 'ambiguous'
  ),
  classifyBuildTripIntent: vi.fn(() => false),
}));

async function sendMessage(message: string) {
  const inputEl = screen.getByTestId('chat-input') as HTMLInputElement;
  fireEvent.change(inputEl, { target: { value: message } });
  const form = inputEl.closest('form')!;
  await act(async () => { fireEvent.submit(form); });
  await act(async () => {});
}

describe('DemoPage — mood card (AC1, AC3, AC4, AC6)', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC1: ambiguous first message → mood card visible, fetch NOT called', async () => {
    render(<DemoPage />);
    await sendMessage('I want to plan a trip');

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('AC6: specific first message (Hanoi) → mood card NOT shown, fetch IS called', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 's1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reply: 'Great choice!' }), { status: 200 }));

    render(<DemoPage />);
    await sendMessage('I want to go to Hanoi');

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalled();
  });

  it('AC2: mood chip click then Enter (immediate advance) → mood card hidden, bot narration present', async () => {
    render(<DemoPage />);
    await sendMessage('I need a holiday');

    // mood card visible
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();

    // click to select (state update flushes), then Enter on selected chip = immediate advance
    const adventureChip = screen.getByRole('radio', { name: /Adventure/i });
    await act(async () => { fireEvent.click(adventureChip); });
    await act(async () => { fireEvent.keyDown(adventureChip, { key: 'Enter' }); });

    // mood chips gone (destination card may now show as a new radiogroup, check mood-specific chips)
    expect(screen.queryByRole('radio', { name: /Adventure/i })).not.toBeInTheDocument();
    expect(screen.getByText(/let me suggest some places that match that vibe/i)).toBeInTheDocument();
  });

  it('AC4: Surprise me chip → mood card hidden, user bubble + "I picked" announcement present', async () => {
    render(<DemoPage />);
    await sendMessage('Looking for travel ideas');

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();

    const surpriseChip = screen.getByRole('radio', { name: /Surprise me/i });
    await act(async () => {
      fireEvent.click(surpriseChip);
    });

    // mood chips gone (destination card may now show, check mood-specific chips)
    expect(screen.queryByRole('radio', { name: /Adventure/i })).not.toBeInTheDocument();
    expect(screen.getByText(/^Surprise me$/i)).toBeInTheDocument();
    expect(screen.getByText(/I picked .+ for you/i)).toBeInTheDocument();
  });

  it('AC3: user types while mood card showing → card dismissed, destination bypass message present', async () => {
    render(<DemoPage />);
    await sendMessage('Something vague');

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();

    // send another message via chat input while mood card is visible
    await sendMessage('Hoi An beach');

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByText(/I'll look at trips around Hoi An beach/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
