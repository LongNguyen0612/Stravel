import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { DemoPage } from '../App';
import { api } from '../services/apiClient';
import { classifyBuildTripIntent } from '../utils/messageClassifier';

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

vi.mock('../services/apiClient', () => ({
  api: {
    sessions: {
      run: vi.fn().mockResolvedValue({ status: 'queued' }),
      create: vi.fn().mockResolvedValue({ id: 'new-session-id' }),
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

vi.mock('../hooks/useStreamContext', () => ({
  useStreamContext: () => ({
    connect: mockConnect,
    state: {
      ssePhase: mockSsePhase,
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

async function navigateToAutoTriggerConfirm() {
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

  const skipBtn = screen.getByRole('button', { name: /Skip/i });
  await act(async () => { fireEvent.click(skipBtn); });

  // Click "Looks good" to trigger auto-confirm flow
  const looksGoodBtn = screen.getByRole('button', { name: /Looks good/i });
  await act(async () => { fireEvent.click(looksGoodBtn); });
}

describe('DemoPage — auto-trigger (AC1): confirmation chips appear', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    mockSsePhase = 'idle';
    mockConnect.mockClear();
    vi.mocked(api.sessions.run).mockClear();
    vi.mocked(api.sessions.create).mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC1: after verification confirm, auto-trigger message is shown', async () => {
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    expect(screen.getByText(/Ready to build your trip proposal/i)).toBeInTheDocument();
  });

  it('AC1: "Let\'s go" and "Not yet" chips are visible', async () => {
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    expect(screen.getByTestId('lets-go-chip')).toBeInTheDocument();
    expect(screen.getByTestId('not-yet-chip')).toBeInTheDocument();
  });

  it('AC1: advisory workflow NOT triggered immediately (no api.sessions.run call)', async () => {
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    expect(api.sessions.run).not.toHaveBeenCalled();
  });

  it('AC1: profile-verification-card is hidden after confirm', async () => {
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    expect(screen.queryByTestId('profile-verification-card')).not.toBeInTheDocument();
  });
});

describe('DemoPage — auto-trigger (AC2): "Let\'s go" triggers workflow', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    mockSsePhase = 'idle';
    mockConnect.mockClear();
    vi.mocked(api.sessions.run).mockClear();
    vi.mocked(api.sessions.create).mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC2: "Let\'s go" calls api.sessions.run', async () => {
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    const letsGoBtn = screen.getByTestId('lets-go-chip');
    await act(async () => { fireEvent.click(letsGoBtn); });

    expect(api.sessions.run).toHaveBeenCalledTimes(1);
  });

  it('AC2: "Let\'s go" calls connect with sessionId', async () => {
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    const letsGoBtn = screen.getByTestId('lets-go-chip');
    await act(async () => { fireEvent.click(letsGoBtn); });

    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('AC2: chips disappear after "Let\'s go" is tapped', async () => {
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    const letsGoBtn = screen.getByTestId('lets-go-chip');
    await act(async () => { fireEvent.click(letsGoBtn); });

    expect(screen.queryByTestId('lets-go-chip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('not-yet-chip')).not.toBeInTheDocument();
  });
});

describe('DemoPage — auto-trigger (AC3): "Not yet" dismisses', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    mockSsePhase = 'idle';
    mockConnect.mockClear();
    vi.mocked(api.sessions.run).mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC3: "Not yet" shows decline message', async () => {
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    const notYetBtn = screen.getByTestId('not-yet-chip');
    await act(async () => { fireEvent.click(notYetBtn); });

    expect(screen.getByText(/just say 'build my trip'/i)).toBeInTheDocument();
  });

  it('AC3: "Not yet" makes no API call', async () => {
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    const notYetBtn = screen.getByTestId('not-yet-chip');
    await act(async () => { fireEvent.click(notYetBtn); });

    expect(api.sessions.run).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('AC3: chips disappear after "Not yet"', async () => {
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    const notYetBtn = screen.getByTestId('not-yet-chip');
    await act(async () => { fireEvent.click(notYetBtn); });

    expect(screen.queryByTestId('lets-go-chip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('not-yet-chip')).not.toBeInTheDocument();
  });
});

describe('DemoPage — auto-trigger (AC4): "build my trip" text triggers after decline', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    mockSsePhase = 'idle';
    mockConnect.mockClear();
    vi.mocked(api.sessions.run).mockClear();
    vi.mocked(api.sessions.create).mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC4: "build my trip" after declining chips calls api.sessions.run', async () => {
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    const notYetBtn = screen.getByTestId('not-yet-chip');
    await act(async () => { fireEvent.click(notYetBtn); });

    vi.mocked(classifyBuildTripIntent).mockReturnValueOnce(true);
    await sendMessage('build my trip');

    expect(api.sessions.run).toHaveBeenCalledTimes(1);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('AC4: "build my trip" after declining chips does NOT append extra user bubble', async () => {
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    const notYetBtn = screen.getByTestId('not-yet-chip');
    await act(async () => { fireEvent.click(notYetBtn); });

    vi.mocked(classifyBuildTripIntent).mockReturnValueOnce(true);
    await sendMessage('build my trip');

    // skipUserBubble=true means no extra "Let's go!" bubble is injected alongside the user's message
    expect(screen.queryByText(/let's go!/i)).not.toBeInTheDocument();
  });
});

describe('DemoPage — auto-trigger (AC5): duplicate generation guard', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    mockConnect.mockClear();
    vi.mocked(api.sessions.run).mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC5: when ssePhase is streaming, "Let\'s go" shows already-running message', async () => {
    mockSsePhase = 'streaming';
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    const letsGoBtn = screen.getByTestId('lets-go-chip');
    await act(async () => { fireEvent.click(letsGoBtn); });

    expect(screen.getByText(/already being generated/i)).toBeInTheDocument();
  });

  it('AC5: when ssePhase is streaming, no duplicate api.sessions.run call', async () => {
    mockSsePhase = 'streaming';
    render(<DemoPage />);
    await navigateToAutoTriggerConfirm();

    const letsGoBtn = screen.getByTestId('lets-go-chip');
    await act(async () => { fireEvent.click(letsGoBtn); });

    expect(api.sessions.run).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
  });
});
