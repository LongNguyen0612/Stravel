import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { TravelCard } from '../TravelCard';

expect.extend(toHaveNoViolations);

describe('TravelCard — WCAG 2.1 AA', () => {
  it('skeleton (nascent) state has no violations', async () => {
    const { container } = render(
      <TravelCard
        cardId="axe-test-flight"
        cardType="flight"
        completenessScore={0.1}
        isFinal={false}
        delta={{}}
        deckState="browsing"
        shimmerEnabled={true}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('settled final card has no violations', async () => {
    const { container } = render(
      <TravelCard
        cardId="axe-test-hotel"
        cardType="hotel"
        completenessScore={0.9}
        isFinal={true}
        delta={{
          name: 'Sofitel Legend Metropole',
          neighborhood: 'Hanoi Old Quarter',
          nightlyRate: 250,
        }}
        deckState="browsing"
        shimmerEnabled={false}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
