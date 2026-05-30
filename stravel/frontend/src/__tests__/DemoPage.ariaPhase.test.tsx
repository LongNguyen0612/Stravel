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
  classifyMessage: () => 'specific',
  classifyBuildTripIntent: () => false,
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

describe('DemoPage — ariaPhase state machine', () => {
  beforeEach(() => {
    localStorage.removeItem('stravel_agent_mode');
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ConversationCanvas has aria-live="polite" on initial render (idle state)', () => {
    render(<DemoPage />);
    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
  });

  it('both sentinel divs are always in the DOM when agentMode=true', () => {
    localStorage.setItem('stravel_agent_mode', 'true');
    render(<DemoPage />);
    expect(screen.getByTestId('aria-sentinel')).toBeInTheDocument();
    expect(screen.getByTestId('aria-sentinel-error')).toBeInTheDocument();
  });

  it('polite sentinel gets "Message received." and canvas stays polite on success', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 's1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reply: 'Great choice!' }), { status: 200 }));

    render(<DemoPage />);
    await sendMessage('Hello');

    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('aria-sentinel')).toHaveTextContent('Message received.');
    expect(screen.getByTestId('aria-sentinel-error')).toHaveTextContent('');
  });

  it('assertive sentinel gets "Something went wrong." and canvas becomes assertive on HTTP error', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 's1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('error', { status: 500 }));

    render(<DemoPage />);
    await sendMessage('Hello');

    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByTestId('aria-sentinel-error')).toHaveTextContent('Something went wrong.');
    expect(screen.getByTestId('aria-sentinel')).toHaveTextContent('');
  });

  it('assertive sentinel gets "Something went wrong." and canvas becomes assertive on fetch rejection', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 's1' }), { status: 200 }))
      .mockRejectedValueOnce(new Error('Network error'));

    render(<DemoPage />);
    await sendMessage('Hello');

    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByTestId('aria-sentinel-error')).toHaveTextContent('Something went wrong.');
  });

  it('sentinelText resets and polite sentinel re-fires on consecutive successes', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ session_id: 's1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reply: 'First reply' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reply: 'Second reply' }), { status: 200 }));

    render(<DemoPage />);
    await sendMessage('First message');
    expect(screen.getByTestId('aria-sentinel')).toHaveTextContent('Message received.');

    await sendMessage('Second message');
    expect(screen.getByTestId('aria-sentinel')).toHaveTextContent('Message received.');
    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
  });
});
