import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { BudgetSliderCard, getBudgetTier, MIN_BUDGET, MAX_BUDGET } from '../BudgetSliderCard';

describe('BudgetSliderCard — slider range (AC1)', () => {
  it('renders slider with correct min, max, step attributes', () => {
    render(<BudgetSliderCard slotKey="budget" onSelect={vi.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '200');
    expect(slider).toHaveAttribute('max', '10000');
    expect(slider).toHaveAttribute('step', '100');
  });

  it('shows default value label on initial render', () => {
    render(<BudgetSliderCard slotKey="budget" onSelect={vi.fn()} />);
    // Default value 2500 → Mid-range
    expect(screen.getByText(/Mid-range/i)).toBeInTheDocument();
    expect(screen.getByText(/2,500/)).toBeInTheDocument();
  });

  it('label updates immediately when slider changes', async () => {
    render(<BudgetSliderCard slotKey="budget" onSelect={vi.fn()} />);
    const slider = screen.getByRole('slider');
    await act(async () => {
      fireEvent.change(slider, { target: { value: '7500' } });
    });
    expect(screen.getByText(/Luxury/i)).toBeInTheDocument();
    expect(screen.getByText(/7,500/)).toBeInTheDocument();
  });
});

describe('BudgetSliderCard — tier boundaries (AC1)', () => {
  it.each([
    [200,  'Budget'],
    [1000, 'Budget'],
    [1499, 'Budget'],
    [1500, 'Mid-range'],
    [2500, 'Mid-range'],
    [3999, 'Mid-range'],
    [4000, 'Premium'],
    [6999, 'Premium'],
    [7000, 'Luxury'],
    [10000, 'Luxury'],
  ])('$%i → %s', (amount, label) => {
    expect(getBudgetTier(amount).label).toBe(label);
  });
});

describe('BudgetSliderCard — touch targets (AC2)', () => {
  it('slider wrapper has min-h-[44px] class', () => {
    render(<BudgetSliderCard slotKey="budget" onSelect={vi.fn()} />);
    const wrapper = screen.getByTestId('slider-wrapper');
    expect(wrapper.className).toContain('min-h-[44px]');
  });
});

describe('BudgetSliderCard — inactivity chip (AC3)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('"Use this" chip is NOT visible on initial render', () => {
    render(<BudgetSliderCard slotKey="budget" onSelect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Use this/i })).not.toBeInTheDocument();
  });

  it('"Use this" chip appears after 1000ms inactivity', async () => {
    render(<BudgetSliderCard slotKey="budget" onSelect={vi.fn()} />);
    await act(async () => { vi.advanceTimersByTime(1100); });
    expect(screen.getByRole('button', { name: /Use this/i })).toBeInTheDocument();
  });

  it('slider movement hides "Use this" chip and resets timer', async () => {
    render(<BudgetSliderCard slotKey="budget" onSelect={vi.fn()} />);
    // Wait for chip to appear
    await act(async () => { vi.advanceTimersByTime(1100); });
    expect(screen.getByRole('button', { name: /Use this/i })).toBeInTheDocument();

    // Move slider — chip should disappear
    const slider = screen.getByRole('slider');
    await act(async () => {
      fireEvent.change(slider, { target: { value: '3000' } });
    });
    expect(screen.queryByRole('button', { name: /Use this/i })).not.toBeInTheDocument();

    // After another 1s — chip reappears
    await act(async () => { vi.advanceTimersByTime(1100); });
    expect(screen.getByRole('button', { name: /Use this/i })).toBeInTheDocument();
  });

  it('"Use this" tap calls onSelect with correct payload', async () => {
    const onSelect = vi.fn();
    render(<BudgetSliderCard slotKey="budget" defaultValue={3000} onSelect={onSelect} />);
    await act(async () => { vi.advanceTimersByTime(1100); });
    const btn = screen.getByRole('button', { name: /Use this/i });
    await act(async () => { fireEvent.click(btn); });
    expect(onSelect).toHaveBeenCalledWith({ slotKey: 'budget', value: '3000' });
  });
});

describe('BudgetSliderCard — onChange real-time (AC3)', () => {
  it('onChange prop called on slider movement', async () => {
    const onChange = vi.fn();
    render(<BudgetSliderCard slotKey="budget" onChange={onChange} onSelect={vi.fn()} />);
    const slider = screen.getByRole('slider');
    await act(async () => {
      fireEvent.change(slider, { target: { value: '4500' } });
    });
    expect(onChange).toHaveBeenCalledWith({ slotKey: 'budget', value: '4500' });
  });
});

describe('BudgetSliderCard — Surprise me (AC4)', () => {
  it('"Surprise me" button present when onSurprise provided', () => {
    render(<BudgetSliderCard slotKey="budget" onSelect={vi.fn()} onSurprise={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Surprise me/i })).toBeInTheDocument();
  });

  it('"Surprise me" button NOT present when onSurprise not provided', () => {
    render(<BudgetSliderCard slotKey="budget" onSelect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Surprise me/i })).not.toBeInTheDocument();
  });

  it('"Surprise me" tap calls onSurprise', async () => {
    const onSurprise = vi.fn();
    render(<BudgetSliderCard slotKey="budget" onSelect={vi.fn()} onSurprise={onSurprise} />);
    const btn = screen.getByRole('button', { name: /Surprise me/i });
    await act(async () => { fireEvent.click(btn); });
    expect(onSurprise).toHaveBeenCalledWith({ slotKey: 'budget' });
  });
});

describe('BudgetSliderCard — ARIA (AC5)', () => {
  it('aria-valuemin, aria-valuemax set correctly', () => {
    render(<BudgetSliderCard slotKey="budget" onSelect={vi.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', String(MIN_BUDGET));
    expect(slider).toHaveAttribute('aria-valuemax', String(MAX_BUDGET));
  });

  it('aria-valuenow reflects current value', async () => {
    render(<BudgetSliderCard slotKey="budget" defaultValue={3500} onSelect={vi.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '3500');
    await act(async () => {
      fireEvent.change(slider, { target: { value: '5000' } });
    });
    expect(slider).toHaveAttribute('aria-valuenow', '5000');
  });

  it('aria-valuetext includes tier and description', () => {
    render(<BudgetSliderCard slotKey="budget" defaultValue={2500} onSelect={vi.fn()} />);
    const slider = screen.getByRole('slider');
    const text = slider.getAttribute('aria-valuetext') ?? '';
    expect(text).toMatch(/2,500/);
    expect(text).toMatch(/Mid-range/i);
  });
});

describe('getBudgetTier utility', () => {
  it('returns correct tier object with label and description', () => {
    const t = getBudgetTier(2500);
    expect(t.label).toBe('Mid-range');
    expect(t.description).toContain('hotel');
  });
});
