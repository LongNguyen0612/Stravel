import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Stub ResizeObserver (used by useFooterHeight in DemoPage)
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() });
  vi.stubGlobal('fetch', vi.fn());
});

// Lazy import after stubs are set up
async function renderDemoPage() {
  const { DemoPage } = await import('../../../App');
  return render(<DemoPage />);
}

describe('DemoPage — bot greeting', () => {
  it('shows bot greeting on initial render', async () => {
    await renderDemoPage();
    expect(
      screen.getByText("Hi! Where are you dreaming of going in Vietnam?")
    ).toBeInTheDocument();
  });

  it('greeting uses role="bot" MessageBubble', async () => {
    await renderDemoPage();
    const bubbles = screen.getAllByTestId('message-bubble');
    expect(bubbles[0]).toHaveClass('message-bubble--bot');
  });
});
