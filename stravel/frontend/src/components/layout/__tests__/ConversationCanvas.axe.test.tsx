import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ConversationCanvas } from '../ConversationCanvas';

expect.extend(toHaveNoViolations);

describe('ConversationCanvas — WCAG 2.1 AA', () => {
  it('has no violations with default ariaLive', async () => {
    const { container } = render(
      <ConversationCanvas paddingBottom={0}>
        <p>Hello</p>
      </ConversationCanvas>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no violations with ariaLive="off"', async () => {
    const { container } = render(
      <ConversationCanvas paddingBottom={0} ariaLive="off">
        <p>Streaming…</p>
      </ConversationCanvas>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no violations with ariaLive="assertive"', async () => {
    const { container } = render(
      <ConversationCanvas paddingBottom={0} ariaLive="assertive">
        <p>Error</p>
      </ConversationCanvas>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has aria-relevant="additions" attribute', () => {
    const { getByRole } = render(
      <ConversationCanvas paddingBottom={0}><span /></ConversationCanvas>
    );
    expect(getByRole('log')).toHaveAttribute('aria-relevant', 'additions');
  });
});
