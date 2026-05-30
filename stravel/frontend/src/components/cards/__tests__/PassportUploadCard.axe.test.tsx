import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PassportUploadCard } from '../PassportUploadCard';

expect.extend(toHaveNoViolations);

const SLOT_KEY = 'passport_expiry' as const;

afterEach(() => { vi.restoreAllMocks(); });

describe('PassportUploadCard — WCAG 2.1 AA (AC6)', () => {
  it('idle state has no violations', async () => {
    const { container } = render(
      <PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('confirm state has no violations', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ expiry_date: '2027-06-30', confidence: 0.9, fallback_required: false }),
    } as Response);
    const { container } = render(
      <PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={vi.fn()} />
    );
    const inputs = document.querySelectorAll('input[type="file"]');
    await act(async () => {
      fireEvent.change(inputs[1], {
        target: { files: [new File(['data'], 'p.jpg', { type: 'image/jpeg' })] },
      });
    });
    await act(async () => {});
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('manual state has no violations', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ expiry_date: null, confidence: 0.4, fallback_required: true }),
    } as Response);
    const { container } = render(
      <PassportUploadCard slotKey={SLOT_KEY} onSelect={vi.fn()} onSkip={vi.fn()} />
    );
    const inputs = document.querySelectorAll('input[type="file"]');
    await act(async () => {
      fireEvent.change(inputs[1], {
        target: { files: [new File(['data'], 'p.jpg', { type: 'image/jpeg' })] },
      });
    });
    await act(async () => {});
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
