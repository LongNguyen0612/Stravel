import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MultiSelectCard } from '../MultiSelectCard';

expect.extend(toHaveNoViolations);

const OPTIONS = [
  { label: 'Vegetarian', value: 'vegetarian' },
  { label: 'Vegan', value: 'vegan' },
  { label: 'Halal', value: 'halal' },
];

describe('MultiSelectCard — WCAG 2.1 AA (AC6)', () => {
  it('default state (nothing selected) has no violations', async () => {
    const { container } = render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('with chips selected has no violations', async () => {
    const { container } = render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    fireEvent.click(container.querySelector('[role="checkbox"]')!);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('"No restrictions" explicitly selected has no violations', async () => {
    const { container } = render(
      <MultiSelectCard
        slotKey="dietary"
        prompt="Select dietary requirements"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    // Select a chip then click No restrictions to trigger that state
    const checkboxes = container.querySelectorAll('[role="checkbox"]');
    fireEvent.click(checkboxes[1]); // select Vegetarian
    fireEvent.click(checkboxes[0]); // click No restrictions (first chip)
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
