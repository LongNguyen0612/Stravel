import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TravelCard } from '../TravelCard';

const formingProps = {
  cardId: 'activity-test',
  cardType: 'activities' as const,
  completenessScore: 0.5,
  isFinal: false,
  deckState: 'browsing' as const,
};

const settledProps = {
  ...formingProps,
  completenessScore: 0.9,
  isFinal: true,
};

describe('TravelCard — ActivityFields dayNumber and description', () => {
  it('renders dayNumber when set in forming state', () => {
    render(
      <TravelCard {...formingProps} delta={{ category: 'Sightseeing', dayNumber: 3 }} />
    );
    expect(screen.getByText('Day 3')).toBeInTheDocument();
  });

  it('does not render dayNumber row when dayNumber is not set', () => {
    render(
      <TravelCard {...formingProps} delta={{ category: 'Sightseeing' }} />
    );
    expect(screen.queryByText(/Day \d/)).not.toBeInTheDocument();
  });

  it('renders description in settled state', () => {
    render(
      <TravelCard
        {...settledProps}
        delta={{ category: 'Food tour', description: 'A walking tour through the old market district' }}
      />
    );
    expect(screen.getByText('A walking tour through the old market district')).toBeInTheDocument();
  });

  it('does not render description in forming state', () => {
    render(
      <TravelCard
        {...formingProps}
        delta={{ category: 'Food tour', description: 'Should not appear' }}
      />
    );
    expect(screen.queryByText('Should not appear')).not.toBeInTheDocument();
  });

  it('does not render description row when description is not set in settled state', () => {
    render(
      <TravelCard {...settledProps} delta={{ category: 'Museum visit' }} />
    );
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
  });
});
