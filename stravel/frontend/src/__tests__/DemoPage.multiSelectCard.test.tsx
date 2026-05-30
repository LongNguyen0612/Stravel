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

async function navigateToDietaryCard() {
  await navigateToBudgetCard();
  // Advance timer so "Use this" chip appears on budget card
  await act(async () => { vi.advanceTimersByTime(1100); });
  const useThisBtn = screen.getByRole('button', { name: /Use this/i });
  await act(async () => { fireEvent.click(useThisBtn); });
}

describe('DemoPage — dietary multi-select card (AC7)', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.spyOn(global, 'fetch');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC7a: after budget selection, dietary card appears with bot message', async () => {
    render(<DemoPage />);
    await navigateToDietaryCard();

    // Dietary card visible
    expect(screen.getByRole('group', { name: /Any dietary requirements\?/i })).toBeInTheDocument();
    // Bot message
    expect(screen.getByText(/Any dietary requirements I should know about\?/i)).toBeInTheDocument();
    // No fetch
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('AC7b: Done with no selection emits empty array and shows no-restrictions messages', async () => {
    render(<DemoPage />);
    await navigateToDietaryCard();

    // Click Done without selecting anything
    const doneBtn = screen.getByRole('button', { name: /^Done$/i });
    await act(async () => { fireEvent.click(doneBtn); });

    // Dietary card hidden
    expect(screen.queryByRole('group', { name: /dietary/i })).not.toBeInTheDocument();
    // User bubble
    expect(screen.getByText(/No dietary restrictions/i)).toBeInTheDocument();
    // Bot reply
    expect(screen.getByText(/Noted — no restrictions\./i)).toBeInTheDocument();
  });

  it('AC7c: selecting chips then Done emits correct values and confirmation messages', async () => {
    render(<DemoPage />);
    await navigateToDietaryCard();

    // Select Vegetarian
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: /Vegetarian/i }));
    });
    // Select Halal
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: /Halal/i }));
    });
    // Click Done
    const doneBtn = screen.getByRole('button', { name: /^Done$/i });
    await act(async () => { fireEvent.click(doneBtn); });

    // Dietary card hidden
    expect(screen.queryByRole('group', { name: /dietary/i })).not.toBeInTheDocument();
    // User bubble contains both chip labels
    expect(screen.getAllByText(/Vegetarian.*Halal|Halal.*Vegetarian/i).length).toBeGreaterThan(0);
    // Bot confirmation
    expect(screen.getAllByText(/Noted — /i).length).toBeGreaterThan(0);
  });
});
