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

vi.mock('../utils/messageClassifier', () => ({
  classifyMessage: vi.fn(() => 'ambiguous'),
  classifyBuildTripIntent: vi.fn(() => false),
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

async function navigateToVerificationCard() {
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

  // Budget inactivity timer (1s)
  await act(async () => { vi.advanceTimersByTime(1100); });
  const useThisBtn = screen.getByRole('button', { name: /Use this/i });
  await act(async () => { fireEvent.click(useThisBtn); });

  // Dietary — tap Done with no selection
  const doneBtn = screen.getByRole('button', { name: /^Done$/i });
  await act(async () => { fireEvent.click(doneBtn); });

  // Skip passport
  const skipBtn = screen.getByRole('button', { name: /Skip/i });
  await act(async () => { fireEvent.click(skipBtn); });
}

describe('DemoPage — verification card (AC1)', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC1: after passport Skip, verification card appears with bot message', async () => {
    render(<DemoPage />);
    await navigateToVerificationCard();

    expect(screen.getByTestId('profile-verification-card')).toBeInTheDocument();
    expect(screen.getByText(/does everything look right\?/i)).toBeInTheDocument();
  });
});

describe('DemoPage — verification card (AC2)', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC2: verification card shows destination and budget from slotState', async () => {
    render(<DemoPage />);
    await navigateToVerificationCard();

    const card = screen.getByTestId('profile-verification-card');
    expect(card).toHaveTextContent('Hội An');
    expect(card).toHaveTextContent('Budget');
  });
});

describe('DemoPage — verification card (AC3)', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC3: "Looks good" hides card, shows user bubble, shows auto-trigger confirm', async () => {
    render(<DemoPage />);
    await navigateToVerificationCard();

    const looksGoodBtn = screen.getByRole('button', { name: /Looks good/i });
    await act(async () => { fireEvent.click(looksGoodBtn); });

    // Card hidden
    expect(screen.queryByTestId('profile-verification-card')).not.toBeInTheDocument();
    // User bubble
    expect(screen.getByText(/Looks good!/i)).toBeInTheDocument();
    // Auto-trigger confirmation message (not the old "Starting your proposal")
    expect(screen.getByText(/Ready to build your trip proposal/i)).toBeInTheDocument();
  });
});

describe('DemoPage — verification card (AC4/AC5): edit flow', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC4: "Edit something" shows edit menu with slot chips', async () => {
    render(<DemoPage />);
    await navigateToVerificationCard();

    const editBtn = screen.getByRole('button', { name: /Edit something/i });
    await act(async () => { fireEvent.click(editBtn); });

    // Verification card hidden
    expect(screen.queryByTestId('profile-verification-card')).not.toBeInTheDocument();
    // Edit menu chip list shown — "Budget" chip
    expect(screen.getByRole('radio', { name: /Budget/i })).toBeInTheDocument();
    // Bot message
    expect(screen.getByText(/which part would you like to change/i)).toBeInTheDocument();
  });

  it('AC5: tapping Budget chip shows budget card; after confirm, verification card reappears', async () => {
    render(<DemoPage />);
    await navigateToVerificationCard();

    const editBtn = screen.getByRole('button', { name: /Edit something/i });
    await act(async () => { fireEvent.click(editBtn); });

    // Tap Budget chip in the edit menu — SlotFillingCard has 300ms auto-advance
    const budgetChip = screen.getByRole('radio', { name: /Budget/i });
    await act(async () => { fireEvent.click(budgetChip); });
    await act(async () => { vi.advanceTimersByTime(400); }); // flush 300ms auto-advance

    // Budget card should appear
    expect(screen.getByRole('slider')).toBeInTheDocument();

    // Advance timer so "Use this" button appears
    await act(async () => { vi.advanceTimersByTime(1100); });
    const useThisBtn = screen.getByRole('button', { name: /Use this/i });
    await act(async () => { fireEvent.click(useThisBtn); });

    // Verification card reappears
    expect(screen.getByTestId('profile-verification-card')).toBeInTheDocument();
  });
});

describe('DemoPage — verification card (AC2): full slot coverage', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC2: verification card shows all five collected slots', async () => {
    render(<DemoPage />);
    await navigateToVerificationCard();

    const card = screen.getByTestId('profile-verification-card');
    expect(card).toHaveTextContent('Hội An');
    expect(card).toHaveTextContent('Dates');
    expect(card).toHaveTextContent('Budget');
    expect(card).toHaveTextContent('Dietary');
    // Passport was skipped
    expect(card).toHaveTextContent('Passport expiry');
    expect(card).toHaveTextContent('Skipped');
  });
});

describe('DemoPage — verification card (AC3): auto-trigger confirm shown', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC3: "Looks good" shows auto-trigger confirm and hides verification card', async () => {
    render(<DemoPage />);
    await navigateToVerificationCard();

    const looksGoodBtn = screen.getByRole('button', { name: /Looks good/i });
    await act(async () => { fireEvent.click(looksGoodBtn); });

    // Auto-trigger confirm shown
    expect(screen.getByText(/Ready to build your trip proposal/i)).toBeInTheDocument();
    // Card is gone
    expect(screen.queryByTestId('profile-verification-card')).not.toBeInTheDocument();
  });
});

describe('DemoPage — verification card (AC5): additional edit paths', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC5: tapping Destination chip shows destination card; after select, verification reappears', async () => {
    render(<DemoPage />);
    await navigateToVerificationCard();

    const editBtn = screen.getByRole('button', { name: /Edit something/i });
    await act(async () => { fireEvent.click(editBtn); });

    const destinationChip = screen.getByRole('radio', { name: /Destination/i });
    await act(async () => { fireEvent.click(destinationChip); });
    await act(async () => { vi.advanceTimersByTime(400); });

    // Destination card should appear — look for a known destination option
    const destCard = screen.getByRole('radio', { name: /Đà Nẵng/i });
    expect(destCard).toBeInTheDocument();

    await act(async () => { fireEvent.click(destCard); });
    await act(async () => { fireEvent.keyDown(destCard, { key: 'Enter' }); });

    // Verification card reappears
    expect(screen.getByTestId('profile-verification-card')).toBeInTheDocument();
  });

  it('AC5: tapping Dietary chip shows dietary card; after Done, verification reappears', async () => {
    render(<DemoPage />);
    await navigateToVerificationCard();

    const editBtn = screen.getByRole('button', { name: /Edit something/i });
    await act(async () => { fireEvent.click(editBtn); });

    const dietaryChip = screen.getByRole('radio', { name: /Dietary/i });
    await act(async () => { fireEvent.click(dietaryChip); });
    await act(async () => { vi.advanceTimersByTime(400); });

    // Dietary card should appear
    const doneBtn = screen.getByRole('button', { name: /^Done$/i });
    expect(doneBtn).toBeInTheDocument();
    await act(async () => { fireEvent.click(doneBtn); });

    // Verification card reappears
    expect(screen.getByTestId('profile-verification-card')).toBeInTheDocument();
  });
});

describe('DemoPage — verification card (AC6): zero-typing path', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC6: full zero-typing path reaches verification and "Looks good" is tappable', async () => {
    render(<DemoPage />);

    // Navigate using only card taps (no fireEvent.change on text inputs)
    await sendMessage('Need a holiday');  // initial message to trigger mood card
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

    const skipBtn = screen.getByRole('button', { name: /Skip/i });
    await act(async () => { fireEvent.click(skipBtn); });

    // Verification card reached via taps only
    expect(screen.getByTestId('profile-verification-card')).toBeInTheDocument();

    // "Looks good" is tappable (no keyboard needed)
    const looksGoodBtn = screen.getByRole('button', { name: /Looks good/i });
    expect(looksGoodBtn).toBeInTheDocument();
    await act(async () => { fireEvent.click(looksGoodBtn); });
    expect(screen.queryByTestId('profile-verification-card')).not.toBeInTheDocument();
    expect(screen.getByText(/Ready to build your trip proposal/i)).toBeInTheDocument();
  });
});
