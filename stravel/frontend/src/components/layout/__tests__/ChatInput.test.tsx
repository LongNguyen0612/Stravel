import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  it('renders an input and a send button', () => {
    render(<ChatInput onSubmit={vi.fn()} />);
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    expect(screen.getByTestId('chat-send')).toBeInTheDocument();
  });

  it('calls onSubmit with the trimmed input value', () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />);
    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: '  Hello Vietnam  ' } });
    fireEvent.click(screen.getByTestId('chat-send'));
    expect(onSubmit).toHaveBeenCalledWith('Hello Vietnam');
  });

  it('clears the input after submit', () => {
    render(<ChatInput onSubmit={vi.fn()} />);
    const input = screen.getByTestId('chat-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(screen.getByTestId('chat-send'));
    expect(input.value).toBe('');
  });

  it('does not call onSubmit for empty or whitespace-only input', () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('chat-send'));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('chat-send'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables input and button when disabled=true', () => {
    render(<ChatInput onSubmit={vi.fn()} disabled />);
    expect(screen.getByTestId('chat-input')).toBeDisabled();
    expect(screen.getByTestId('chat-send')).toBeDisabled();
  });

  it('submits on Enter key', () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />);
    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Hà Nội' } });
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith('Hà Nội');
  });

  it('uses custom placeholder', () => {
    render(<ChatInput onSubmit={vi.fn()} placeholder="Where to?" />);
    expect(screen.getByPlaceholderText('Where to?')).toBeInTheDocument();
  });

  it('has fixed positioning classes on outer container', () => {
    render(<ChatInput onSubmit={vi.fn()} />);
    const container = screen.getByTestId('chat-input-container');
    expect(container).toHaveClass('fixed', 'bottom-0', 'left-0', 'right-0');
  });

  it('forwards ref to the outer container div', () => {
    const ref = createRef<HTMLDivElement>();
    render(<ChatInput ref={ref} onSubmit={vi.fn()} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
