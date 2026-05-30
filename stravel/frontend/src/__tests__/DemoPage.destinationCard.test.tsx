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


// Classify all messages as ambiguous so mood card always shows first
vi.mock('../utils/messageClassifier', () => ({
  classifyMessage: vi.fn(() => 'ambiguous'),
  classifyBuildTripIntent: vi.fn(() => false),
}));

async function sendMessage(message: string) {
  const inputEl = screen.getByTestId('chat-input') as HTMLInputElement;
  fireEvent.change(inputEl, { target: { value: message } });
  const form = inputEl.closest('form')!;
  await act(async () => { fireEvent.submit(form); });
  await act(async () => {});
}

async function selectMoodChip(name: RegExp) {
  const chip = screen.getByRole('radio', { name });
  await act(async () => { fireEvent.click(chip); });
  await act(async () => { fireEvent.keyDown(chip, { key: 'Enter' }); });
}

describe('DemoPage — destination card (AC2, AC3, AC4, AC5, AC6)', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC3: after mood chip select → destination card visible', async () => {
    render(<DemoPage />);
    await sendMessage('I need a holiday');

    // mood card is visible
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();

    // select mood chip (Adventure) via click then Enter immediate-advance
    await selectMoodChip(/Adventure/i);

    // mood card options gone, destination card now visible
    expect(screen.queryByRole('radio', { name: /Adventure/i })).not.toBeInTheDocument();
    // destination card renders with "Where would you like to go?" or similar
    expect(screen.getByRole('radiogroup')).toBeInTheDocument(); // destination radiogroup
    // At least one destination option visible
    expect(screen.getByRole('radio', { name: /Hội An/i })).toBeInTheDocument();
  });

  it('AC4: after mood Surprise me → destination card visible', async () => {
    render(<DemoPage />);
    await sendMessage('Looking for ideas');

    const surpriseMoodChip = screen.getByRole('radio', { name: /Surprise me/i });
    await act(async () => { fireEvent.click(surpriseMoodChip); });

    // mood card dismissed, destination card shown
    expect(screen.queryByRole('radio', { name: /Adventure/i })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Hội An/i })).toBeInTheDocument();
  });

  it('AC2: destination card tap + Enter (immediate advance) → card hidden, narration present', async () => {
    render(<DemoPage />);
    await sendMessage('I want to travel');

    await selectMoodChip(/Adventure/i);

    // destination card is visible — click Hội An
    const hoiAnCard = screen.getByRole('radio', { name: /Hội An/i });
    await act(async () => { fireEvent.click(hoiAnCard); });
    await act(async () => { fireEvent.keyDown(hoiAnCard, { key: 'Enter' }); });

    // destination card hidden
    expect(screen.queryByRole('radio', { name: /Hội An/i })).not.toBeInTheDocument();
    // bot narration present
    expect(screen.getByText(/Great choice!/i)).toBeInTheDocument();
  });

  it('AC5: Surprise me on destination → card hidden, "I picked..." announcement present', async () => {
    render(<DemoPage />);
    await sendMessage('Not sure where to go');

    await selectMoodChip(/Relaxation/i);

    // destination card visible — click Surprise me
    const surpriseDestChip = screen.getByRole('button', { name: /Surprise me/i });
    await act(async () => { fireEvent.click(surpriseDestChip); });

    // destination card hidden
    expect(screen.queryByRole('radio', { name: /Hội An/i })).not.toBeInTheDocument();
    // announcement present
    expect(screen.getByText(/Great choice!/i)).toBeInTheDocument();
  });

  it('AC6: specific first message → no destination card shown', async () => {
    const { classifyMessage } = await import('../utils/messageClassifier');
    vi.mocked(classifyMessage).mockReturnValueOnce('specific');

    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 's1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reply: 'Great!' }), { status: 200 }));

    render(<DemoPage />);
    await sendMessage('I want to go to Hanoi');

    // No mood card and no destination card
    expect(screen.queryByRole('radio', { name: /Adventure/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Hội An/i })).not.toBeInTheDocument();
  });
});
