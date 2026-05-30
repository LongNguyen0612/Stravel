import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompletenessIndicator } from '../CompletenessIndicator';

describe('CompletenessIndicator', () => {
  it('renders a progressbar role', () => {
    render(<CompletenessIndicator score={0.5} state="forming" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets aria-valuenow to rounded percentage', () => {
    render(<CompletenessIndicator score={0.5} state="forming" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('sets aria-valuemin to 0', () => {
    render(<CompletenessIndicator score={0.5} state="forming" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemin', '0');
  });

  it('sets aria-valuemax to 100', () => {
    render(<CompletenessIndicator score={0.5} state="forming" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '100');
  });

  it('uses amber fill class when state is nascent', () => {
    const { container } = render(<CompletenessIndicator score={0.1} state="nascent" />);
    const fill = container.querySelector('.bg-status-pending');
    expect(fill).toBeInTheDocument();
  });

  it('uses amber fill class when state is forming', () => {
    const { container } = render(<CompletenessIndicator score={0.5} state="forming" />);
    const fill = container.querySelector('.bg-status-pending');
    expect(fill).toBeInTheDocument();
  });

  it('uses teal fill class when state is settled', () => {
    const { container } = render(<CompletenessIndicator score={1.0} state="settled" />);
    const fill = container.querySelector('.bg-status-confirmed');
    expect(fill).toBeInTheDocument();
  });

  it('uses amber fill class when state is error', () => {
    const { container } = render(<CompletenessIndicator score={0.1} state="error" />);
    const fill = container.querySelector('.bg-status-pending');
    expect(fill).toBeInTheDocument();
  });

  it('rounds score correctly for aria-valuenow', () => {
    render(<CompletenessIndicator score={0.749} state="forming" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  });

  it('applies optional className to the outer element', () => {
    const { container } = render(
      <CompletenessIndicator score={0.5} state="forming" className="my-test-class" />
    );
    expect(container.firstChild).toHaveClass('my-test-class');
  });
});
