import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiSelectCard } from '../MultiSelectCard';

const OPTIONS = [
  { label: 'Vegetarian', value: 'vegetarian' },
  { label: 'Vegan', value: 'vegan' },
  { label: 'Halal', value: 'halal' },
  { label: 'Gluten free', value: 'gluten_free' },
];

describe('MultiSelectCard — ARIA roles (AC1)', () => {
  it('container has role="group" and aria-label matching prompt', () => {
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Select dietary requirements');
  });

  it('each option chip has role="checkbox"', () => {
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // options + "No restrictions" chip (Done button has no checkbox role)
    expect(checkboxes.length).toBe(OPTIONS.length + 1);
  });

  it('"No restrictions" chip is always rendered', () => {
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText(/No restrictions/i)).toBeInTheDocument();
  });

  it('"No restrictions" has aria-checked="true" when nothing is selected', () => {
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    const noRestrictions = screen.getByRole('checkbox', { name: /No restrictions/i });
    expect(noRestrictions).toHaveAttribute('aria-checked', 'true');
  });

  it('regular chips have aria-checked="false" initially', () => {
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    const vegChip = screen.getByRole('checkbox', { name: /Vegetarian/i });
    expect(vegChip).toHaveAttribute('aria-checked', 'false');
  });
});

describe('MultiSelectCard — toggle and deselect (AC2)', () => {
  it('clicking a chip selects it (aria-checked becomes true)', () => {
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    const vegChip = screen.getByRole('checkbox', { name: /Vegetarian/i });
    fireEvent.click(vegChip);
    expect(vegChip).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking a selected chip deselects it', () => {
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    const vegChip = screen.getByRole('checkbox', { name: /Vegetarian/i });
    fireEvent.click(vegChip);
    fireEvent.click(vegChip);
    expect(vegChip).toHaveAttribute('aria-checked', 'false');
  });

  it('multiple chips can be selected simultaneously', () => {
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Vegetarian/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Halal/i }));
    expect(screen.getByRole('checkbox', { name: /Vegetarian/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: /Halal/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: /Vegan/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('selected chip shows check icon', () => {
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    const vegChip = screen.getByRole('checkbox', { name: /Vegetarian/i });
    fireEvent.click(vegChip);
    // Check icon is aria-hidden span with ✓
    const checkIcon = vegChip.querySelector('[aria-hidden="true"]');
    expect(checkIcon).toBeInTheDocument();
  });
});

describe('MultiSelectCard — No restrictions mutual exclusion (AC3)', () => {
  it('tapping "No restrictions" deselects all other chips', () => {
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Vegetarian/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Vegan/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /No restrictions/i }));
    expect(screen.getByRole('checkbox', { name: /Vegetarian/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('checkbox', { name: /Vegan/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('checkbox', { name: /No restrictions/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('tapping any chip when "No restrictions" is active deselects "No restrictions"', () => {
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    // Start: nothing selected = "No restrictions" implicitly active
    fireEvent.click(screen.getByRole('checkbox', { name: /Vegetarian/i }));
    expect(screen.getByRole('checkbox', { name: /No restrictions/i })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('MultiSelectCard — Done chip (AC4)', () => {
  it('"Done" button is rendered', () => {
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument();
  });

  it('"Done" calls onSelect with selected string array', () => {
    const onSelect = vi.fn();
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Vegetarian/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Halal/i }));
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));
    expect(onSelect).toHaveBeenCalledWith({ slotKey: 'dietary', value: ['vegetarian', 'halal'] });
  });

  it('"Done" with no selection emits empty array', () => {
    const onSelect = vi.fn();
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));
    expect(onSelect).toHaveBeenCalledWith({ slotKey: 'dietary', value: [] });
  });
});

describe('MultiSelectCard — Surprise me (AC5)', () => {
  it('"Surprise me" button renders when onSurprise is provided', () => {
    render(
      <MultiSelectCard
        slotKey="activities"
        prompt="What activities interest you?"
        options={OPTIONS}
        onSelect={vi.fn()}
        onSurprise={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Surprise me/i })).toBeInTheDocument();
  });

  it('"Surprise me" button is hidden when onSurprise is not provided', () => {
    render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /Surprise me/i })).not.toBeInTheDocument();
  });

  it('"Surprise me" calls onSurprise with slotKey', () => {
    const onSurprise = vi.fn();
    render(
      <MultiSelectCard
        slotKey="activities"
        prompt="What activities interest you?"
        options={OPTIONS}
        onSelect={vi.fn()}
        onSurprise={onSurprise}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Surprise me/i }));
    expect(onSurprise).toHaveBeenCalledWith({ slotKey: 'activities' });
  });
});
