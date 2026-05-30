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

async function selectDestinationCard(name: RegExp) {
  const card = screen.getByRole('radio', { name });
  await act(async () => { fireEvent.click(card); });
  await act(async () => { fireEvent.keyDown(card, { key: 'Enter' }); });
}

async function navigateToBudgetCard() {
  await sendMessage('Need a holiday');
  await selectMoodChip(/Adventure/i);
  await selectDestinationCard(/Hội An/i);

  const allDateButtons = screen.getAllByRole('gridcell').filter(
    el => el.tagName === 'BUTTON' && el.getAttribute('aria-label')
  );
  const startBtn = allDateButtons[5];
  const endBtn = allDateButtons[12];

  await act(async () => { fireEvent.click(startBtn); });
  await act(async () => { fireEvent.click(endBtn); });

  const confirmBtn = screen.getByRole('button', { name: /Confirm \d+ nights/i });
  await act(async () => { fireEvent.click(confirmBtn); });
}

describe('DemoPage — budget card (AC6)', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.spyOn(global, 'fetch');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC6a: calendar confirm → budget slider visible, bot asks budget question', async () => {
    render(<DemoPage />);
    await navigateToBudgetCard();

    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByText(/What's your total budget for this trip\?/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('AC6b: "Use this" after 1s → card hidden, user bubble, bot reply', async () => {
    render(<DemoPage />);
    await navigateToBudgetCard();

    // Advance 1100ms — inactivity chip appears
    await act(async () => { vi.advanceTimersByTime(1100); });
    const useThisBtn = screen.getByRole('button', { name: /Use this/i });
    await act(async () => { fireEvent.click(useThisBtn); });

    // Budget card hidden
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    // User bubble
    expect(screen.getByText(/USD .+ · /i)).toBeInTheDocument();
    // Bot reply
    expect(screen.getByText(/budget — I'm starting on your plan now\./i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('AC6c: Surprise me on budget → card advances, fetch NOT called', async () => {
    render(<DemoPage />);
    await navigateToBudgetCard();

    const surpriseBtn = screen.getByRole('button', { name: /Surprise me/i });
    await act(async () => { fireEvent.click(surpriseBtn); });

    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.getByText(/I'm setting your budget/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
