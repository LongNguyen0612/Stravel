import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CardDeck } from '../CardDeck';
import type { CardUpdateEvent } from '@/types/domain';

expect.extend(toHaveNoViolations);

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

describe('CardDeck — WCAG 2.1 AA', () => {
  it('browsing state has no accessibility violations', async () => {
    const { container } = render(
      <CardDeck
        cards={[makeCard('c1', 0.5, false, 'flight'), makeCard('b1', 0.5, false, 'booking')]}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('committing state with authorship panel has no violations', async () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<CardDeck cards={settledCards} />);
      await act(async () => { vi.advanceTimersByTime(500); });
      vi.useRealTimers();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    } finally {
      vi.useRealTimers();
    }
  });

  it('committing state after authorship dismissed has no violations', async () => {
    vi.useFakeTimers();
    try {
      const { container, getByTestId } = render(<CardDeck cards={settledCards} />);
      await act(async () => { vi.advanceTimersByTime(500); });
      vi.useRealTimers();
      fireEvent.click(getByTestId('authorship-skip'));
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    } finally {
      vi.useRealTimers();
    }
  });
});
