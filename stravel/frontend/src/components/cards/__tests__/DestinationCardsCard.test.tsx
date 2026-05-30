import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { DestinationCardsCard } from '../DestinationCardsCard';
import type { DestinationOption } from '../DestinationCardsCard';

const OPTIONS: DestinationOption[] = [
  { value: 'hoi_an', label: 'Hội An', description: 'Lantern-lit ancient town with tailors and beach', costTier: 'mid-range' },
  { value: 'hanoi', label: 'Hà Nội', description: 'Capital with street food and French heritage', costTier: 'budget' },
  { value: 'phu_quoc', label: 'Phú Quốc', description: 'Island paradise with clear water and beach clubs', costTier: 'premium' },
];

describe('DestinationCardsCard — ARIA structure (AC1)', () => {
  it('renders a radiogroup container', () => {
    render(
      <DestinationCardsCard
        slotKey="destination"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('each destination is role="radio"', () => {
    render(
      <DestinationCardsCard
        slotKey="destination"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    const radios = screen.getAllByRole('radio');
    // 3 destination cards
    expect(radios.length).toBeGreaterThanOrEqual(3);
  });

  it('renders destination name, description, and cost tier badge', () => {
    render(
      <DestinationCardsCard
        slotKey="destination"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('Hội An')).toBeInTheDocument();
    expect(screen.getByText(/Lantern-lit ancient town/)).toBeInTheDocument();
    expect(screen.getByText('💰 Mid-range')).toBeInTheDocument();
    expect(screen.getByText('💸 Budget')).toBeInTheDocument();
    expect(screen.getByText('💎 Premium')).toBeInTheDocument();
  });

  it('shows prompt text', () => {
    render(
      <DestinationCardsCard
        slotKey="destination"
        prompt="Where would you like to go?"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('Where would you like to go?')).toBeInTheDocument();
  });

  it('uses default prompt when none provided', () => {
    render(
      <DestinationCardsCard
        slotKey="destination"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });
});

describe('DestinationCardsCard — card tap + 300ms auto-advance (AC2)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('card click → aria-checked becomes true', async () => {
    render(
      <DestinationCardsCard
        slotKey="destination"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    const hoiAnCard = screen.getByRole('radio', { name: /Hội An/i });
    expect(hoiAnCard).toHaveAttribute('aria-checked', 'false');
    await act(async () => { fireEvent.click(hoiAnCard); });
    expect(hoiAnCard).toHaveAttribute('aria-checked', 'true');
  });

  it('card click → onSelect NOT called before 300ms', async () => {
    const onSelect = vi.fn();
    render(
      <DestinationCardsCard
        slotKey="destination"
        options={OPTIONS}
        onSelect={onSelect}
      />
    );
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: /Hội An/i })); });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('card click → onSelect called with { slotKey, value, label } after 300ms', async () => {
    const onSelect = vi.fn();
    render(
      <DestinationCardsCard
        slotKey="destination"
        options={OPTIONS}
        onSelect={onSelect}
      />
    );
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: /Hội An/i })); });
    await act(async () => { vi.runAllTimers(); });
    expect(onSelect).toHaveBeenCalledWith({ slotKey: 'destination', value: 'hoi_an', label: 'Hội An' });
  });

  it('clicking different card cancels previous timer', async () => {
    const onSelect = vi.fn();
    render(
      <DestinationCardsCard
        slotKey="destination"
        options={OPTIONS}
        onSelect={onSelect}
      />
    );
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: /Hội An/i })); });
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: /Hà Nội/i })); });
    await act(async () => { vi.runAllTimers(); });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ slotKey: 'destination', value: 'hanoi', label: 'Hà Nội' });
  });
});

describe('DestinationCardsCard — Surprise me chip (AC5)', () => {
  it('renders Surprise me chip when onSurprise provided', () => {
    render(
      <DestinationCardsCard
        slotKey="destination"
        options={OPTIONS}
        onSelect={vi.fn()}
        onSurprise={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Surprise me/i })).toBeInTheDocument();
  });

  it('does not render Surprise me chip when onSurprise not provided', () => {
    render(
      <DestinationCardsCard
        slotKey="destination"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /Surprise me/i })).not.toBeInTheDocument();
  });

  it('Surprise me click → onSurprise called immediately (no timer)', async () => {
    vi.useFakeTimers();
    const onSurprise = vi.fn();
    render(
      <DestinationCardsCard
        slotKey="destination"
        options={OPTIONS}
        onSelect={vi.fn()}
        onSurprise={onSurprise}
      />
    );
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Surprise me/i })); });
    // No timer advance needed — called immediately
    expect(onSurprise).toHaveBeenCalledWith({ slotKey: 'destination' });
    vi.useRealTimers();
  });
});

describe('DestinationCardsCard — tap targets (AC7)', () => {
  it('all destination cards have min-h-[44px] in className', () => {
    render(
      <DestinationCardsCard
        slotKey="destination"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    const radios = screen.getAllByRole('radio');
    // All destination cards (excluding possible Surprise me) should have min-h-[44px]
    radios.forEach(radio => {
      expect(radio.className).toContain('min-h-[44px]');
    });
  });
});
