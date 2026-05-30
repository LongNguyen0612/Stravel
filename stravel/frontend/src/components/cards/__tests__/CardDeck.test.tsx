import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CardDeck } from '../CardDeck';
import type { CardUpdateEvent } from '@/types/domain';

const makeCard = (
  id: string,
  score: number,
  isFinal: boolean,
  type: CardUpdateEvent['type'] = 'flight'
): CardUpdateEvent => ({ card_id: id, type, completeness_score: score, delta: {}, is_final: isFinal });

const settledCards: CardUpdateEvent[] = [
  makeCard('c1', 0.9, true, 'flight'),
  makeCard('c2', 0.85, true, 'hotel'),
  makeCard('booking-1', 0.9, true, 'booking'),
];

const browsingCards: CardUpdateEvent[] = [
  makeCard('c1', 0.5, false, 'flight'),
  makeCard('c2', 0.3, false, 'hotel'),
  makeCard('booking-1', 0.3, false, 'booking'),
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('CardDeck — browsing/committing state machine', () => {
  it('renders cards without crashing', () => {
    render(<CardDeck cards={browsingCards} />);
    expect(screen.getByTestId('card-deck')).toBeInTheDocument();
  });

  it('no booking CTA visible in browsing state (before 500ms)', () => {
    render(<CardDeck cards={settledCards} />);
    expect(screen.queryByTestId('booking-cta')).not.toBeInTheDocument();
  });

  it('shows authorship panel after 500ms when all cards settled', async () => {
    render(<CardDeck cards={settledCards} />);
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(screen.getByTestId('authorship-panel')).toBeInTheDocument();
    expect(screen.getByText(/What would you like to name this trip/)).toBeInTheDocument();
  });

  it('does NOT show authorship panel before 500ms', async () => {
    render(<CardDeck cards={settledCards} />);
    await act(async () => { vi.advanceTimersByTime(499); });
    expect(screen.queryByTestId('authorship-panel')).not.toBeInTheDocument();
  });

  it('booking CTA visible once committing (deckState changes)', async () => {
    render(<CardDeck cards={settledCards} />);
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(screen.getByTestId('booking-cta')).toBeInTheDocument();
  });

  it('clicking CTA before authorship resolves does NOT fire onBook', async () => {
    const onBook = vi.fn();
    render(<CardDeck cards={settledCards} onBook={onBook} />);
    await act(async () => { vi.advanceTimersByTime(500); });
    // CTA is visible but onBook not yet wired (authorship pending)
    fireEvent.click(screen.getByTestId('booking-cta'));
    expect(onBook).not.toHaveBeenCalled();
  });

  it('authorship Save hides panel and wires onBook', async () => {
    const onBook = vi.fn();
    render(<CardDeck cards={settledCards} onBook={onBook} />);
    await act(async () => { vi.advanceTimersByTime(500); });
    fireEvent.change(screen.getByTestId('trip-name-input'), { target: { value: 'Vietnam 2026' } });
    fireEvent.click(screen.getByTestId('authorship-save'));
    expect(screen.queryByTestId('authorship-panel')).not.toBeInTheDocument();
    // onBook now active
    fireEvent.click(screen.getByTestId('booking-cta'));
    expect(onBook).toHaveBeenCalledTimes(1);
  });

  it('authorship Skip hides panel and wires onBook', async () => {
    const onBook = vi.fn();
    render(<CardDeck cards={settledCards} onBook={onBook} />);
    await act(async () => { vi.advanceTimersByTime(500); });
    fireEvent.click(screen.getByTestId('authorship-skip'));
    expect(screen.queryByTestId('authorship-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('booking-cta'));
    expect(onBook).toHaveBeenCalledTimes(1);
  });

  it('authorship panel does NOT re-appear while still in committing after dismiss', async () => {
    render(<CardDeck cards={settledCards} />);
    await act(async () => { vi.advanceTimersByTime(500); });
    fireEvent.click(screen.getByTestId('authorship-skip'));
    expect(screen.queryByTestId('authorship-panel')).not.toBeInTheDocument();
    // Advance more time — still no re-appear
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByTestId('authorship-panel')).not.toBeInTheDocument();
  });

  it('Escape key on authorship input dismisses panel', async () => {
    render(<CardDeck cards={settledCards} />);
    await act(async () => { vi.advanceTimersByTime(500); });
    fireEvent.keyDown(screen.getByTestId('trip-name-input'), { key: 'Escape' });
    expect(screen.queryByTestId('authorship-panel')).not.toBeInTheDocument();
  });

  it('returns to browsing when a card drops below 0.75', async () => {
    const { rerender } = render(<CardDeck cards={settledCards} />);
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(screen.getByTestId('authorship-panel')).toBeInTheDocument();
    // Simulate a card dropping below 0.75 (user editing — re-streaming)
    const editedCards: CardUpdateEvent[] = [
      makeCard('c1', 0.4, false, 'flight'),
      makeCard('c2', 0.85, true, 'hotel'),
      makeCard('booking-1', 0.9, true, 'booking'),
    ];
    rerender(<CardDeck cards={editedCards} />);
    expect(screen.queryByTestId('authorship-panel')).not.toBeInTheDocument();
    // Booking CTA should be gone (browsing state → booking shows placeholder)
    expect(screen.queryByTestId('booking-cta')).not.toBeInTheDocument();
  });

  it('authorship re-queues after edit returns deck to committing', async () => {
    const { rerender } = render(<CardDeck cards={settledCards} />);
    // Enter committing
    await act(async () => { vi.advanceTimersByTime(500); });
    // Dismiss authorship
    fireEvent.click(screen.getByTestId('authorship-skip'));
    // Drop a card (edit)
    const editedCards: CardUpdateEvent[] = [
      makeCard('c1', 0.4, false, 'flight'),
      makeCard('c2', 0.85, true, 'hotel'),
      makeCard('booking-1', 0.9, true, 'booking'),
    ];
    rerender(<CardDeck cards={editedCards} />);
    // Re-settle all cards
    rerender(<CardDeck cards={settledCards} />);
    // Timer fires again for next committing
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(screen.getByTestId('authorship-panel')).toBeInTheDocument();
  });

  it('returns to browsing when a card isFinal flips to false (score stays ≥ 0.75)', async () => {
    const { rerender } = render(<CardDeck cards={settledCards} />);
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(screen.getByTestId('authorship-panel')).toBeInTheDocument();
    // isFinal flips to false while score stays above 0.75
    const isFinalFalseCards: CardUpdateEvent[] = [
      makeCard('c1', 0.9, false, 'flight'),  // score ok but not final
      makeCard('c2', 0.85, true, 'hotel'),
      makeCard('booking-1', 0.9, true, 'booking'),
    ];
    rerender(<CardDeck cards={isFinalFalseCards} />);
    expect(screen.queryByTestId('authorship-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-cta')).not.toBeInTheDocument();
  });

  it('Enter key on trip name input saves and hides panel', async () => {
    const onBook = vi.fn();
    render(<CardDeck cards={settledCards} onBook={onBook} />);
    await act(async () => { vi.advanceTimersByTime(500); });
    fireEvent.change(screen.getByTestId('trip-name-input'), { target: { value: 'Paris 2026' } });
    fireEvent.keyDown(screen.getByTestId('trip-name-input'), { key: 'Enter' });
    expect(screen.queryByTestId('authorship-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('booking-cta'));
    expect(onBook).toHaveBeenCalledTimes(1);
  });

  it('Escape on Save button dismisses authorship panel', async () => {
    render(<CardDeck cards={settledCards} />);
    await act(async () => { vi.advanceTimersByTime(500); });
    fireEvent.keyDown(screen.getByTestId('authorship-save'), { key: 'Escape' });
    expect(screen.queryByTestId('authorship-panel')).not.toBeInTheDocument();
  });

  it('shimmer gating: only first 3 of 5 nascent cards have animate-shimmer', () => {
    const fiveNascent: CardUpdateEvent[] = [
      makeCard('n1', 0.1, false, 'booking'),
      makeCard('n2', 0.1, false, 'booking'),
      makeCard('n3', 0.1, false, 'booking'),
      makeCard('n4', 0.1, false, 'booking'),
      makeCard('n5', 0.1, false, 'booking'),
    ];
    const { container } = render(<CardDeck cards={fiveNascent} />);
    // booking card SHIMMER_COUNT = 1, so each shimmer-enabled card adds 1 animate-shimmer
    const animated = container.querySelectorAll('.animate-shimmer');
    expect(animated).toHaveLength(3);
  });

  it('hasComplianceBlock prevents onBook from firing', async () => {
    const onBook = vi.fn();
    render(<CardDeck cards={settledCards} onBook={onBook} hasComplianceBlock />);
    await act(async () => { vi.advanceTimersByTime(500); });
    // Skip authorship
    fireEvent.click(screen.getByTestId('authorship-skip'));
    // CTA is rendered but onBook should not be wired
    fireEvent.click(screen.getByTestId('booking-cta'));
    expect(onBook).not.toHaveBeenCalled();
  });
});
