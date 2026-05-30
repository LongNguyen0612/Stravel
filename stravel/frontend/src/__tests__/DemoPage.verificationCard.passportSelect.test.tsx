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

vi.mock('../components/cards/PassportUploadCard', () => ({
  PassportUploadCard: ({ onSelect, onSkip }: {
    onSelect: (u: { slotKey: string; value: string }) => void;
    onSkip: (e: { slotKey: string }) => void;
  }) => (
    <div data-testid="passport-upload-card">
      <button
        type="button"
        data-testid="passport-confirm-btn"
        onClick={() => onSelect({ slotKey: 'passport_expiry', value: '2028-06-15' })}
      >
        Confirm passport
      </button>
      <button type="button" onClick={() => onSkip({ slotKey: 'passport_expiry' })}>
        Skip
      </button>
    </div>
  ),
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
  await act(async () => { fireEvent.click(allDateButtons[5]); });
  await act(async () => { fireEvent.click(allDateButtons[12]); });

  const confirmBtn = screen.getByRole('button', { name: /Confirm \d+ nights/i });
  await act(async () => { fireEvent.click(confirmBtn); });

  await act(async () => { vi.advanceTimersByTime(1100); });
  const useThisBtn = screen.getByRole('button', { name: /Use this/i });
  await act(async () => { fireEvent.click(useThisBtn); });

  const doneBtn = screen.getByRole('button', { name: /^Done$/i });
  await act(async () => { fireEvent.click(doneBtn); });
}

describe('DemoPage — verification card (AC1): passport SELECT path', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC1: after passport SELECT (onSelect), verification card appears with bot message', async () => {
    render(<DemoPage />);
    await navigateToPassportCard();

    const confirmBtn = screen.getByTestId('passport-confirm-btn');
    await act(async () => { fireEvent.click(confirmBtn); });

    expect(screen.getByTestId('profile-verification-card')).toBeInTheDocument();
    expect(screen.getByText(/does everything look right\?/i)).toBeInTheDocument();
  });

  it('AC1: passport SELECT path shows passport expiry in verification card summary', async () => {
    render(<DemoPage />);
    await navigateToPassportCard();

    const confirmBtn = screen.getByTestId('passport-confirm-btn');
    await act(async () => { fireEvent.click(confirmBtn); });

    const card = screen.getByTestId('profile-verification-card');
    expect(card).toHaveTextContent('Passport expiry');
    expect(card).toHaveTextContent('15/06/2028');
  });
});
