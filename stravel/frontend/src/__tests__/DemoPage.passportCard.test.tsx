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

async function navigateToPassportCard() {
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

  // Budget card inactivity timer
  await act(async () => { vi.advanceTimersByTime(1100); });
  const useThisBtn = screen.getByRole('button', { name: /Use this/i });
  await act(async () => { fireEvent.click(useThisBtn); });

  // Dietary card — tap Done with no selection
  const doneBtn = screen.getByRole('button', { name: /^Done$/i });
  await act(async () => { fireEvent.click(doneBtn); });
}

describe('DemoPage — passport upload card (AC7)', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.spyOn(global, 'fetch');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC7a: after dietary card Done, passport card appears and bot message shows', async () => {
    render(<DemoPage />);
    await navigateToPassportCard();

    // Passport upload zone visible
    expect(screen.getByRole('button', { name: /Upload passport photo/i })).toBeInTheDocument();
    // Bot message
    expect(screen.getByText(/snap or upload a photo of your passport/i)).toBeInTheDocument();
    // No OCR fetch called yet
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('AC7b: OCR success + Yes → slot updated, card hidden, confirmation messages', async () => {
    (global.fetch as ReturnType<typeof vi.spyOn>).mockResolvedValue({
      ok: true,
      json: async () => ({ expiry_date: '2027-06-30', confidence: 0.9, fallback_required: false }),
    } as unknown as Response);

    render(<DemoPage />);
    await navigateToPassportCard();

    // Trigger file upload on the second hidden input
    const inputs = document.querySelectorAll('input[type="file"]');
    await act(async () => {
      fireEvent.change(inputs[1], {
        target: { files: [new File(['data'], 'p.jpg', { type: 'image/jpeg' })] },
      });
    });
    await act(async () => {}); // flush fetch

    // Confirm state shown
    expect(screen.getByRole('button', { name: /^Yes$/i })).toBeInTheDocument();

    // Tap Yes
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Yes$/i })); });

    // Passport card hidden
    expect(screen.queryByRole('button', { name: /Upload passport photo/i })).not.toBeInTheDocument();
    // User bubble with date
    expect(screen.getByText(/Passport expiry: 30\/06\/2027/i)).toBeInTheDocument();
    // Bot confirmation
    expect(screen.getByText(/I'll check your passport is valid/i)).toBeInTheDocument();
  });

  it('AC7c: Skip → passport_expiry set to skipped, bot compliance note shown', async () => {
    render(<DemoPage />);
    await navigateToPassportCard();

    const skipBtn = screen.getByRole('button', { name: /Skip/i });
    await act(async () => { fireEvent.click(skipBtn); });

    // Passport card hidden
    expect(screen.queryByRole('button', { name: /Upload passport photo/i })).not.toBeInTheDocument();
    // Bot compliance note
    expect(screen.getByText(/compliance checks may be incomplete/i)).toBeInTheDocument();
  });
});
