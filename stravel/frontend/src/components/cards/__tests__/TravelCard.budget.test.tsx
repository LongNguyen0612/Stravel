import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TravelCard } from '../TravelCard';

const formingProps = {
  cardId: 'budget-test',
  cardType: 'budget' as const,
  completenessScore: 0.5,
  isFinal: false,
  deckState: 'browsing' as const,
};

const settledProps = {
  ...formingProps,
  completenessScore: 0.9,
  isFinal: true,
};

describe('TravelCard — BudgetFields', () => {
  it('renders 4 shimmer rows in nascent state', () => {
    const { container } = render(
      <TravelCard {...formingProps} completenessScore={0.1} isFinal={false} delta={{}} />
    );
    const shimmers = container.querySelectorAll('.animate-shimmer');
    expect(shimmers).toHaveLength(4);
  });

  it('renders total row in forming state', () => {
    render(
      <TravelCard {...formingProps} delta={{ total: 5000, currency: 'USD' }} />
    );
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('USD 5,000')).toBeInTheDocument();
  });

  it('shows — for missing total', () => {
    render(<TravelCard {...formingProps} delta={{}} />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    // The em dash for missing total
    const totalRow = screen.getByText('Total').closest('div')?.parentElement;
    expect(totalRow?.textContent).toContain('—');
  });

  it('renders breakdown grid in settled state', () => {
    render(
      <TravelCard
        {...settledProps}
        delta={{ total: 5000, currency: 'USD', flights: 1500, accommodation: 2000, activities: 800, misc: 700 }}
      />
    );
    expect(screen.getByText('Flights')).toBeInTheDocument();
    expect(screen.getByText('Accommodation')).toBeInTheDocument();
    expect(screen.getByText('Activities')).toBeInTheDocument();
    expect(screen.getByText('Misc')).toBeInTheDocument();
    expect(screen.getByText('$1500')).toBeInTheDocument();
    expect(screen.getByText('$2000')).toBeInTheDocument();
  });

  it('shows — for missing breakdown fields in settled state', () => {
    render(
      <TravelCard {...settledProps} delta={{ total: 5000 }} />
    );
    expect(screen.getByText('Flights')).toBeInTheDocument();
    const dashElements = screen.getAllByText('—');
    expect(dashElements.length).toBeGreaterThanOrEqual(4);
  });

  it('does not render breakdown in forming state', () => {
    render(
      <TravelCard {...formingProps} delta={{ total: 5000, flights: 1500 }} />
    );
    expect(screen.queryByText('Flights')).not.toBeInTheDocument();
  });

  it('renders 💰 icon for budget card', () => {
    render(<TravelCard {...formingProps} delta={{}} />);
    expect(screen.getByText('💰')).toBeInTheDocument();
  });
});
