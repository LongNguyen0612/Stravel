import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ProfileVerificationCard } from '../ProfileVerificationCard';
import type { ProfileVerificationItem } from '../ProfileVerificationCard';

expect.extend(toHaveNoViolations);

const FULL_ITEMS: ProfileVerificationItem[] = [
  { icon: '📍', label: 'Destination', value: 'Hội An' },
  { icon: '📅', label: 'Dates', value: '15 Jun – 22 Jun · 7 nights' },
  { icon: '💰', label: 'Budget', value: '~$2,500' },
  { icon: '🍽️', label: 'Dietary', value: 'Vegetarian' },
  { icon: '🛂', label: 'Passport expiry', value: '12/03/2028' },
];

describe('ProfileVerificationCard — WCAG 2.1 AA (AC7)', () => {
  it('populated items state has no violations', async () => {
    const { container } = render(
      <ProfileVerificationCard items={FULL_ITEMS} onConfirm={vi.fn()} onEdit={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('single item state has no violations', async () => {
    const { container } = render(
      <ProfileVerificationCard items={[FULL_ITEMS[0]]} onConfirm={vi.fn()} onEdit={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
