import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';

describe('MessageBubble — role prop', () => {
  it('applies message-bubble--bot class for role="bot"', () => {
    render(<MessageBubble role="bot">Hello</MessageBubble>);
    expect(screen.getByTestId('message-bubble')).toHaveClass('message-bubble--bot');
  });

  it('applies message-bubble--user class for role="user"', () => {
    render(<MessageBubble role="user">Hello</MessageBubble>);
    expect(screen.getByTestId('message-bubble')).toHaveClass('message-bubble--user');
  });

  it('applies message-bubble--stage-narrator class for role="stage-narrator"', () => {
    render(<MessageBubble role="stage-narrator">Stage text</MessageBubble>);
    expect(screen.getByTestId('message-bubble')).toHaveClass('message-bubble--stage-narrator');
  });

  it('does NOT apply bot or user class to stage-narrator', () => {
    render(<MessageBubble role="stage-narrator">Stage text</MessageBubble>);
    const el = screen.getByTestId('message-bubble');
    expect(el).not.toHaveClass('message-bubble--bot');
    expect(el).not.toHaveClass('message-bubble--user');
  });

  it('always applies base message-bubble class', () => {
    render(<MessageBubble role="bot">Hi</MessageBubble>);
    expect(screen.getByTestId('message-bubble')).toHaveClass('message-bubble');
  });

  it('renders children content', () => {
    render(<MessageBubble role="user">My message</MessageBubble>);
    expect(screen.getByTestId('message-bubble')).toHaveTextContent('My message');
  });
});
