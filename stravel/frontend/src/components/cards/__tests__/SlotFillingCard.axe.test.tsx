import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SlotFillingCard } from '../SlotFillingCard';

expect.extend(toHaveNoViolations);

const OPTIONS = [
  { label: 'Adventure', value: 'adventure' },
  { label: 'Relaxation', value: 'relaxation' },
  { label: 'Surprise me', value: 'surprise_me' },
];

describe('SlotFillingCard — WCAG 2.1 AA (AC7)', () => {
  it('default state has no violations', async () => {
    const { container } = render(
      <SlotFillingCard
        slotKey="mood"
        prompt="How are you feeling about this trip?"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('with chip selected has no violations', async () => {
    const { container } = render(
      <SlotFillingCard
        slotKey="mood"
        prompt="How are you feeling about this trip?"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    fireEvent.click(container.querySelector('[role="radio"]')!);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('free-text mode has no violations', async () => {
    const { container } = render(
      <SlotFillingCard
        slotKey="mood"
        prompt="How are you feeling about this trip?"
        options={OPTIONS}
        onSelect={vi.fn()}
      />
    );
    fireEvent.keyDown(container.querySelector('[role="radiogroup"]')!, { key: 'Escape' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
