import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlotFillingCard } from '../SlotFillingCard';
import type { ChipOption } from '../SlotFillingCard';

const MOOD_OPTIONS: ChipOption[] = [
  { label: 'Adventure', value: 'adventure' },
  { label: 'Relaxation', value: 'relaxation' },
  { label: 'Culture', value: 'culture' },
  { label: 'Surprise me', value: 'surprise_me' },
];

const baseProps = {
  slotKey: 'mood' as const,
  prompt: 'How are you feeling about this trip?',
  options: MOOD_OPTIONS,
  onSelect: vi.fn(),
};

beforeEach(() => {
  vi.useFakeTimers();
  baseProps.onSelect.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── AC1: ARIA radiogroup semantics ──────────────────────────────────────────

describe('SlotFillingCard — ARIA semantics (AC1)', () => {
  it('has role="radiogroup" on the container', () => {
    render(<SlotFillingCard {...baseProps} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('each chip has role="radio"', () => {
    render(<SlotFillingCard {...baseProps} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4); // Adventure, Relaxation, Culture, Surprise me
  });

  it('chips have aria-checked=false before selection', () => {
    render(<SlotFillingCard {...baseProps} />);
    screen.getAllByRole('radio').forEach((chip) => {
      expect(chip).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('selected chip has aria-checked=true', () => {
    render(<SlotFillingCard {...baseProps} />);
    fireEvent.click(screen.getByRole('radio', { name: /Adventure/i }));
    expect(screen.getByRole('radio', { name: /Adventure/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Relaxation/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('prompt text is rendered and radiogroup has accessible label', () => {
    render(<SlotFillingCard {...baseProps} />);
    expect(screen.getByText(baseProps.prompt)).toBeInTheDocument();
    const group = screen.getByRole('radiogroup');
    const labelId = group.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    const labelEl = document.getElementById(labelId!);
    expect(labelEl?.textContent).toBe(baseProps.prompt);
  });
});

// ── AC2: Chip selection + 300ms auto-advance ────────────────────────────────

describe('SlotFillingCard — selection and auto-advance (AC2)', () => {
  it('does not call onSelect before 300ms', () => {
    render(<SlotFillingCard {...baseProps} />);
    fireEvent.click(screen.getByRole('radio', { name: /Adventure/i }));
    vi.advanceTimersByTime(299);
    expect(baseProps.onSelect).not.toHaveBeenCalled();
  });

  it('calls onSelect with slotKey+value after 300ms', () => {
    render(<SlotFillingCard {...baseProps} />);
    fireEvent.click(screen.getByRole('radio', { name: /Adventure/i }));
    vi.advanceTimersByTime(300);
    expect(baseProps.onSelect).toHaveBeenCalledOnce();
    expect(baseProps.onSelect).toHaveBeenCalledWith({ slotKey: 'mood', value: 'adventure' });
  });

  it('Enter on already-selected chip triggers immediate advance (no 300ms)', () => {
    render(<SlotFillingCard {...baseProps} />);
    const chip = screen.getByRole('radio', { name: /Adventure/i });
    fireEvent.click(chip);              // select
    fireEvent.keyDown(chip, { key: 'Enter' }); // press Enter while selected
    expect(baseProps.onSelect).toHaveBeenCalledOnce();
    expect(baseProps.onSelect).toHaveBeenCalledWith({ slotKey: 'mood', value: 'adventure' });
  });

  it('Space on already-selected chip triggers immediate advance', () => {
    render(<SlotFillingCard {...baseProps} />);
    const chip = screen.getByRole('radio', { name: /Adventure/i });
    fireEvent.click(chip);
    fireEvent.keyDown(chip, { key: ' ' });
    expect(baseProps.onSelect).toHaveBeenCalledOnce();
  });

  it('selecting a different chip resets the timer', () => {
    render(<SlotFillingCard {...baseProps} />);
    fireEvent.click(screen.getByRole('radio', { name: /Adventure/i }));
    vi.advanceTimersByTime(150);
    fireEvent.click(screen.getByRole('radio', { name: /Relaxation/i }));
    vi.advanceTimersByTime(150); // only 150ms since last selection
    expect(baseProps.onSelect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150); // now 300ms from Relaxation click
    expect(baseProps.onSelect).toHaveBeenCalledWith({ slotKey: 'mood', value: 'relaxation' });
  });

  it('check icon visible on selected chip', () => {
    const { container } = render(<SlotFillingCard {...baseProps} />);
    fireEvent.click(screen.getByRole('radio', { name: /Adventure/i }));
    // check icon span has aria-hidden="true"
    const checkIcons = container.querySelectorAll('[aria-hidden="true"]');
    expect(checkIcons.length).toBeGreaterThan(0);
  });
});

// ── AC3: Focused+selected visual class ─────────────────────────────────────

describe('SlotFillingCard — focused+selected state (AC3)', () => {
  it('focused+selected chip has ring-amber-400 class', () => {
    render(<SlotFillingCard {...baseProps} />);
    const chip = screen.getByRole('radio', { name: /Adventure/i });
    fireEvent.click(chip);
    fireEvent.focus(chip);
    expect(chip.className).toContain('ring-amber-400');
  });

  it('selected-only (not focused) chip does NOT have ring-amber-400', () => {
    render(<SlotFillingCard {...baseProps} />);
    const chip = screen.getByRole('radio', { name: /Adventure/i });
    const other = screen.getByRole('radio', { name: /Relaxation/i });
    fireEvent.click(chip);
    fireEvent.focus(other); // focus moves away
    expect(chip.className).not.toContain('ring-amber-400');
  });
});

// ── AC4: Escape → free-text mode ────────────────────────────────────────────

describe('SlotFillingCard — Escape free-text fallback (AC4)', () => {
  it('Escape hides chips and shows text input', () => {
    render(<SlotFillingCard {...baseProps} />);
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'Escape' });
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('component stays in DOM after Escape (no remount)', () => {
    const { container } = render(<SlotFillingCard {...baseProps} />);
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'Escape' });
    // radiogroup container still exists
    expect(container.querySelector('[role="radiogroup"]')).toBeInTheDocument();
  });

  it('text input Enter submits immediately (no 300ms)', () => {
    render(<SlotFillingCard {...baseProps} />);
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'Escape' });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Beach vacation' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(baseProps.onSelect).toHaveBeenCalledOnce();
    expect(baseProps.onSelect).toHaveBeenCalledWith({ slotKey: 'mood', value: 'Beach vacation' });
  });

  it('text input Enter with empty value does not call onSelect', () => {
    render(<SlotFillingCard {...baseProps} />);
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'Escape' });
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(baseProps.onSelect).not.toHaveBeenCalled();
  });
});

// ── WCAG 2.4.7: Focus visible on unselected chips ──────────────────────────

describe('SlotFillingCard — focus ring on unselected chips (WCAG 2.4.7)', () => {
  it('unselected focused chip has focus-visible ring class', () => {
    render(<SlotFillingCard {...baseProps} />);
    const chip = screen.getByRole('radio', { name: /Adventure/i });
    expect(chip.className).toContain('focus-visible:ring-primary');
  });

  it('unselected chip retains focus-visible ring class after another chip is selected', () => {
    render(<SlotFillingCard {...baseProps} />);
    fireEvent.click(screen.getByRole('radio', { name: /Relaxation/i }));
    const unselectedChip = screen.getByRole('radio', { name: /Adventure/i });
    expect(unselectedChip.className).toContain('focus-visible:ring-primary');
  });
});

// ── AC6: Surprise me chip ───────────────────────────────────────────────────

describe('SlotFillingCard — Surprise me chip (AC6)', () => {
  it('clicking surprise_me calls onSurprise immediately (no timer)', () => {
    const onSurprise = vi.fn();
    render(<SlotFillingCard {...baseProps} onSurprise={onSurprise} />);
    fireEvent.click(screen.getByRole('radio', { name: /Surprise me/i }));
    expect(onSurprise).toHaveBeenCalledOnce();
    expect(onSurprise).toHaveBeenCalledWith({ slotKey: 'mood' });
    expect(baseProps.onSelect).not.toHaveBeenCalled();
  });

  it('surprise_me does not start the 300ms timer', () => {
    const onSurprise = vi.fn();
    render(<SlotFillingCard {...baseProps} onSurprise={onSurprise} />);
    fireEvent.click(screen.getByRole('radio', { name: /Surprise me/i }));
    vi.advanceTimersByTime(300);
    expect(baseProps.onSelect).not.toHaveBeenCalled();
  });
});
