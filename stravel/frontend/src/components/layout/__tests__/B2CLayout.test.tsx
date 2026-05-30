import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { B2CLayout } from '../B2CLayout';

describe('B2CLayout', () => {
  it('renders children', () => {
    render(<B2CLayout><div data-testid="child">content</div></B2CLayout>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies theme-b2c class for CSS token scoping', () => {
    const { container } = render(<B2CLayout><span /></B2CLayout>);
    expect(container.firstChild).toHaveClass('theme-b2c');
  });

  it('applies h-dvh for full dynamic viewport height', () => {
    const { container } = render(<B2CLayout><span /></B2CLayout>);
    expect(container.firstChild).toHaveClass('h-dvh');
  });

  it('applies flex-col layout', () => {
    const { container } = render(<B2CLayout><span /></B2CLayout>);
    expect(container.firstChild).toHaveClass('flex', 'flex-col');
  });

  it('applies overflow-hidden to clip layout to viewport', () => {
    const { container } = render(<B2CLayout><span /></B2CLayout>);
    expect(container.firstChild).toHaveClass('overflow-hidden');
  });

  it('accepts and applies additional className', () => {
    const { container } = render(<B2CLayout className="custom-class"><span /></B2CLayout>);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
