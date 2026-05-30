import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { InlineCalendarCard } from '../InlineCalendarCard';

// Pin to a deterministic date so month headers are predictable
const JUNE_2026 = new Date(2026, 5, 1); // June 2026

describe('InlineCalendarCard — layout (AC1)', () => {
  it('renders two month headers', () => {
    render(
      <InlineCalendarCard slotKey="travel_dates" initialMonth={JUNE_2026} onSelect={vi.fn()} />
    );
    expect(screen.getByText('June 2026')).toBeInTheDocument();
    expect(screen.getByText('July 2026')).toBeInTheDocument();
  });

  it('renders day-of-week headers in each month', () => {
    render(
      <InlineCalendarCard slotKey="travel_dates" initialMonth={JUNE_2026} onSelect={vi.fn()} />
    );
    // Two months → two sets of headers; use getAllByText
    expect(screen.getAllByText('Su').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Mo').length).toBeGreaterThanOrEqual(1);
  });
});

describe('InlineCalendarCard — start date selection (AC2)', () => {
  it('clicking a date highlights start date and shows Nights: — counter', async () => {
    render(
      <InlineCalendarCard slotKey="travel_dates" initialMonth={JUNE_2026} onSelect={vi.fn()} />
    );
    const june15 = screen.getByRole('gridcell', { name: /Monday, June 15, 2026/i });
    await act(async () => { fireEvent.click(june15); });

    expect(june15).toHaveClass('bg-teal-600');
    expect(screen.getByText(/Nights: —/i)).toBeInTheDocument();
  });

  it('Confirm chip is NOT shown after start date only', async () => {
    render(
      <InlineCalendarCard slotKey="travel_dates" initialMonth={JUNE_2026} onSelect={vi.fn()} />
    );
    const june15 = screen.getByRole('gridcell', { name: /Monday, June 15, 2026/i });
    await act(async () => { fireEvent.click(june15); });

    expect(screen.queryByRole('button', { name: /Confirm/i })).not.toBeInTheDocument();
  });
});

describe('InlineCalendarCard — end date selection (AC3)', () => {
  it('valid end date → Nights: N counter + Confirm chip', async () => {
    render(
      <InlineCalendarCard slotKey="travel_dates" initialMonth={JUNE_2026} onSelect={vi.fn()} />
    );
    // Select start: June 15
    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: /Monday, June 15, 2026/i }));
    });
    // Select end: June 22
    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: /Monday, June 22, 2026/i }));
    });

    expect(screen.getByText(/Nights: 7/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm 7 nights/i })).toBeInTheDocument();
  });

  it('Confirm chip click → onSelect called with correct payload', async () => {
    const onSelect = vi.fn();
    render(
      <InlineCalendarCard slotKey="travel_dates" initialMonth={JUNE_2026} onSelect={onSelect} />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: /Monday, June 15, 2026/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: /Monday, June 22, 2026/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm 7 nights/i }));
    });

    expect(onSelect).toHaveBeenCalledWith({
      slotKey: 'travel_dates',
      value: '2026-06-15,2026-06-22',
      nightCount: 7,
    });
  });

  it('range dates have aria-selected=true; non-range dates have aria-selected=false', async () => {
    render(
      <InlineCalendarCard slotKey="travel_dates" initialMonth={JUNE_2026} onSelect={vi.fn()} />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: /Monday, June 15, 2026/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: /Monday, June 22, 2026/i }));
    });

    const june15 = screen.getByRole('gridcell', { name: /Monday, June 15, 2026/i });
    const june18 = screen.getByRole('gridcell', { name: /Thursday, June 18, 2026/i });
    const june22 = screen.getByRole('gridcell', { name: /Monday, June 22, 2026/i });
    const june10 = screen.getByRole('gridcell', { name: /Wednesday, June 10, 2026/i });

    expect(june15).toHaveAttribute('aria-selected', 'true');
    expect(june18).toHaveAttribute('aria-selected', 'true');
    expect(june22).toHaveAttribute('aria-selected', 'true');
    expect(june10).toHaveAttribute('aria-selected', 'false');
  });
});

describe('InlineCalendarCard — invalid end date reset (AC4)', () => {
  it('selecting end date ≤ start date resets calendar entirely', async () => {
    render(
      <InlineCalendarCard slotKey="travel_dates" initialMonth={JUNE_2026} onSelect={vi.fn()} />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: /Monday, June 15, 2026/i }));
    });
    // Click a date earlier than June 15
    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: /Wednesday, June 10, 2026/i }));
    });

    // Start date should be cleared (no teal-600 on june 15)
    const june15 = screen.getByRole('gridcell', { name: /Monday, June 15, 2026/i });
    expect(june15).not.toHaveClass('bg-teal-600');
    // Nights counter gone
    expect(screen.queryByText(/Nights/i)).not.toBeInTheDocument();
    // No Confirm chip
    expect(screen.queryByRole('button', { name: /Confirm/i })).not.toBeInTheDocument();
  });

  it('selecting same day as start date also resets', async () => {
    render(
      <InlineCalendarCard slotKey="travel_dates" initialMonth={JUNE_2026} onSelect={vi.fn()} />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: /Monday, June 15, 2026/i }));
    });
    // Click same date
    await act(async () => {
      fireEvent.click(screen.getByRole('gridcell', { name: /Monday, June 15, 2026/i }));
    });

    expect(screen.queryByText(/Nights/i)).not.toBeInTheDocument();
  });
});

describe('InlineCalendarCard — ARIA (AC6)', () => {
  it('every date button has correct aria-label format', () => {
    render(
      <InlineCalendarCard slotKey="travel_dates" initialMonth={JUNE_2026} onSelect={vi.fn()} />
    );
    // Check a specific date button exists with full label
    expect(screen.getByRole('gridcell', { name: 'Monday, June 1, 2026' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'Tuesday, June 30, 2026' })).toBeInTheDocument();
  });
});

describe('InlineCalendarCard — tap targets (AC8)', () => {
  it('date buttons have min-h-[44px] class', () => {
    render(
      <InlineCalendarCard slotKey="travel_dates" initialMonth={JUNE_2026} onSelect={vi.fn()} />
    );
    const june1 = screen.getByRole('gridcell', { name: 'Monday, June 1, 2026' });
    expect(june1.className).toContain('min-h-[44px]');
  });
});
