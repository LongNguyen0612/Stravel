import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileVerificationCard } from '../ProfileVerificationCard';
import type { ProfileVerificationItem } from '../ProfileVerificationCard';

const ITEMS: ProfileVerificationItem[] = [
  { icon: '📍', label: 'Destination', value: 'Hội An' },
  { icon: '📅', label: 'Dates', value: '15 Jun – 22 Jun · 7 nights' },
  { icon: '💰', label: 'Budget', value: '~$2,500' },
  { icon: '🍽️', label: 'Dietary', value: 'Vegetarian' },
  { icon: '🛂', label: 'Passport expiry', value: '12/03/2028' },
];

describe('ProfileVerificationCard — AC2: renders summary list', () => {
  it('renders all items with icon, label, value', () => {
    render(<ProfileVerificationCard items={ITEMS} onConfirm={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByText('Hội An')).toBeInTheDocument();
    expect(screen.getByText('15 Jun – 22 Jun · 7 nights')).toBeInTheDocument();
    expect(screen.getByText('~$2,500')).toBeInTheDocument();
    expect(screen.getByText('Vegetarian')).toBeInTheDocument();
    expect(screen.getByText('12/03/2028')).toBeInTheDocument();
  });

  it('has role="list" on summary container', () => {
    render(<ProfileVerificationCard items={ITEMS} onConfirm={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('each item has role="listitem"', () => {
    render(<ProfileVerificationCard items={ITEMS} onConfirm={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(ITEMS.length);
  });

  it('renders with data-testid="profile-verification-card"', () => {
    render(<ProfileVerificationCard items={ITEMS} onConfirm={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByTestId('profile-verification-card')).toBeInTheDocument();
  });

  it('renders single item without crashing', () => {
    render(<ProfileVerificationCard items={[ITEMS[0]]} onConfirm={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('ProfileVerificationCard — AC3: "Looks good" CTA', () => {
  it('calls onConfirm when "Looks good — build my trip!" is clicked', () => {
    const onConfirm = vi.fn();
    render(<ProfileVerificationCard items={ITEMS} onConfirm={onConfirm} onEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Looks good/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe('ProfileVerificationCard — AC4: "Edit something" CTA', () => {
  it('calls onEdit when "Edit something" is clicked', () => {
    const onEdit = vi.fn();
    render(<ProfileVerificationCard items={ITEMS} onConfirm={vi.fn()} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /Edit something/i }));
    expect(onEdit).toHaveBeenCalledOnce();
  });
});

describe('ProfileVerificationCard — AC7: accessible buttons', () => {
  it('"Looks good" button has accessible label', () => {
    render(<ProfileVerificationCard items={ITEMS} onConfirm={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Looks good — build my trip!/i })).toBeInTheDocument();
  });

  it('"Edit something" button has accessible label', () => {
    render(<ProfileVerificationCard items={ITEMS} onConfirm={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Edit something/i })).toBeInTheDocument();
  });
});
