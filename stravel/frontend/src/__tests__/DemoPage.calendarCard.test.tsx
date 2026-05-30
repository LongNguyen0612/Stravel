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

describe('DemoPage — calendar card (AC7)', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC7a: destination card tap + Enter → calendar card visible, narration updated', async () => {
    render(<DemoPage />);
    await sendMessage('Need a holiday');
    await selectMoodChip(/Adventure/i);
    await selectDestinationCard(/Hội An/i);

    // Calendar card should now be visible (look for a grid role which is the calendar)
    expect(screen.getAllByRole('grid').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/when are you planning to travel\?/i)).toBeInTheDocument();
  });

  it('AC7b: Surprise me on destination → calendar card visible', async () => {
    render(<DemoPage />);
    await sendMessage('Need a holiday');
    await selectMoodChip(/Adventure/i);

    // Click Surprise me on destination
    const surpriseBtn = screen.getByRole('button', { name: /Surprise me/i });
    await act(async () => { fireEvent.click(surpriseBtn); });
    await act(async () => {});

    expect(screen.getAllByRole('grid').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/when are you planning to travel\?/i)).toBeInTheDocument();
  });

  it('AC7c: calendar confirm → card hidden, formatted user bubble, bot reply', async () => {
    render(<DemoPage />);
    await sendMessage('Need a holiday');
    await selectMoodChip(/Adventure/i);
    await selectDestinationCard(/Hội An/i);

    // Calendar is now visible — pick dates using aria-labels
    // The component renders current month + next, so we need dates that are always valid.
    // We'll find ANY two consecutive clickable grid cells (dates in the calendar).
    const allDateButtons = screen.getAllByRole('gridcell').filter(
      el => el.tagName === 'BUTTON' && el.getAttribute('aria-label')
    );
    // Click first available date (start), then a date 7 positions later (end)
    const startBtn = allDateButtons[5];
    const endBtn = allDateButtons[12]; // 7 days later

    await act(async () => { fireEvent.click(startBtn); });
    await act(async () => { fireEvent.click(endBtn); });

    const confirmBtn = screen.getByRole('button', { name: /Confirm \d+ nights/i });
    await act(async () => { fireEvent.click(confirmBtn); });

    // Calendar card hidden — no more grid roles from the calendar
    expect(screen.queryAllByRole('grid').length).toBe(0);

    // Bot reply present
    expect(screen.getByText(/nights — noted!/i)).toBeInTheDocument();
    // User bubble with nights format (contains "·" separator)
    const userBubbles = screen.getAllByText(/·.+night/i);
    expect(userBubbles.length).toBeGreaterThanOrEqual(1);
    // fetch NOT called (card flow, no API)
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
