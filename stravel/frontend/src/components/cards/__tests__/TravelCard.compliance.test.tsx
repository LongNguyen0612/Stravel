import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TravelCard } from '../TravelCard';

const formingProps = {
  cardId: 'compliance-test',
  cardType: 'compliance' as const,
  completenessScore: 0.5,
  isFinal: false,
  deckState: 'browsing' as const,
};

const settledProps = {
  ...formingProps,
  completenessScore: 0.9,
  isFinal: true,
};

describe('TravelCard — ComplianceFields', () => {
  it('renders 3 shimmer rows in nascent state', () => {
    const { container } = render(
      <TravelCard {...formingProps} completenessScore={0.1} isFinal={false} delta={{}} />
    );
    const shimmers = container.querySelectorAll('.animate-shimmer');
    expect(shimmers).toHaveLength(3);
  });

  it('renders 🛡️ icon for compliance card', () => {
    render(<TravelCard {...formingProps} delta={{}} />);
    expect(screen.getByText('🛡️')).toBeInTheDocument();
  });

  it('renders visa requirement and passport check in forming state', () => {
    render(
      <TravelCard
        {...formingProps}
        delta={{ visaRequirement: 'Visa on arrival', passportCheck: '6 months validity required' }}
      />
    );
    expect(screen.getByText('Visa')).toBeInTheDocument();
    expect(screen.getByText('Visa on arrival')).toBeInTheDocument();
    expect(screen.getByText('Passport')).toBeInTheDocument();
    expect(screen.getByText('6 months validity required')).toBeInTheDocument();
  });

  it('shows — for missing visa/passport in forming state', () => {
    render(<TravelCard {...formingProps} delta={{}} />);
    expect(screen.getByText('Visa')).toBeInTheDocument();
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('does not show toggle when healthAdvisories is empty in settled state', () => {
    render(
      <TravelCard {...settledProps} delta={{ visaRequirement: 'None', healthAdvisories: [] }} />
    );
    expect(screen.queryByText(/show.*advisories/i)).not.toBeInTheDocument();
  });

  it('AC4: shows "No current advisories" when healthAdvisories is empty array in settled state', () => {
    render(<TravelCard {...settledProps} delta={{ healthAdvisories: [] }} />);
    expect(screen.getByText('No current advisories')).toBeInTheDocument();
  });

  it('AC4: shows "No current advisories" when healthAdvisories is absent in settled state', () => {
    render(<TravelCard {...settledProps} delta={{ visaRequirement: 'None' }} />);
    expect(screen.getByText('No current advisories')).toBeInTheDocument();
  });

  it('AC4: does NOT show "No current advisories" in forming state', () => {
    render(<TravelCard {...formingProps} delta={{}} />);
    expect(screen.queryByText('No current advisories')).not.toBeInTheDocument();
  });

  it('AC4: does NOT show "No current advisories" when advisories present', () => {
    render(<TravelCard {...settledProps} delta={{ healthAdvisories: ['Advisory 1'] }} />);
    expect(screen.queryByText('No current advisories')).not.toBeInTheDocument();
  });

  it('AC4: renders "Check visa requirements →" link when visaLink is provided', () => {
    render(
      <TravelCard {...settledProps} delta={{ visaLink: 'https://example.com/visa' }} />
    );
    const link = screen.getByTestId('visa-requirements-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/visa');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('AC4: does NOT render visa link when visaLink is absent', () => {
    render(<TravelCard {...settledProps} delta={{ visaRequirement: 'None' }} />);
    expect(screen.queryByTestId('visa-requirements-link')).not.toBeInTheDocument();
  });

  it('shows toggle when healthAdvisories has items in settled state', () => {
    render(
      <TravelCard
        {...settledProps}
        delta={{ healthAdvisories: ['Dengue fever risk', 'Malaria prophylaxis recommended'] }}
      />
    );
    expect(screen.getByRole('button', { name: 'Show 2 advisories' })).toBeInTheDocument();
  });

  it('expands advisories list on toggle click', () => {
    render(
      <TravelCard
        {...settledProps}
        delta={{ healthAdvisories: ['Dengue fever risk', 'Malaria prophylaxis recommended'] }}
      />
    );
    const toggle = screen.getByRole('button', { name: 'Show 2 advisories' });
    fireEvent.click(toggle);
    expect(screen.getByText('Dengue fever risk')).toBeInTheDocument();
    expect(screen.getByText('Malaria prophylaxis recommended')).toBeInTheDocument();
  });

  it('changes aria-label to "Hide advisories" when expanded', () => {
    render(
      <TravelCard
        {...settledProps}
        delta={{ healthAdvisories: ['Advisory 1'] }}
      />
    );
    const toggle = screen.getByRole('button', { name: 'Show 1 advisories' });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide advisories' })).toBeInTheDocument();
  });

  it('collapses advisories list on second toggle click', () => {
    render(
      <TravelCard
        {...settledProps}
        delta={{ healthAdvisories: ['Advisory 1'] }}
      />
    );
    const toggle = screen.getByRole('button', { name: 'Show 1 advisories' });
    fireEvent.click(toggle);
    expect(screen.getByText('Advisory 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide advisories' }));
    expect(screen.queryByText('Advisory 1')).not.toBeInTheDocument();
  });

  it('does not show toggle in forming state even with advisories', () => {
    render(
      <TravelCard
        {...formingProps}
        delta={{ healthAdvisories: ['Advisory 1'] }}
      />
    );
    expect(screen.queryByRole('button', { name: /advisories/i })).not.toBeInTheDocument();
  });
});
