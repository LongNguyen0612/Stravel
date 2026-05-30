import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SessionStatusBadge } from '../SessionStatusBadge';

expect.extend(toHaveNoViolations);

describe('SessionStatusBadge — WCAG 2.1 AA', () => {
  it('pending has no violations', async () => {
    const { container } = render(<SessionStatusBadge status="pending" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('confirmed has no violations', async () => {
    const { container } = render(<SessionStatusBadge status="confirmed" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('modified has no violations', async () => {
    const { container } = render(<SessionStatusBadge status="modified" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('flagged with flag_reason has no violations', async () => {
    const { container } = render(
      <SessionStatusBadge status="flagged" flag_reason="Passport validity check failed" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
