import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';
describe('MessageBubble — role prop', () => {
    it('applies message-bubble--bot class for role="bot"', () => {
        render(_jsx(MessageBubble, { role: "bot", children: "Hello" }));
        expect(screen.getByTestId('message-bubble')).toHaveClass('message-bubble--bot');
    });
    it('applies message-bubble--user class for role="user"', () => {
        render(_jsx(MessageBubble, { role: "user", children: "Hello" }));
        expect(screen.getByTestId('message-bubble')).toHaveClass('message-bubble--user');
    });
    it('applies message-bubble--stage-narrator class for role="stage-narrator"', () => {
        render(_jsx(MessageBubble, { role: "stage-narrator", children: "Stage text" }));
        expect(screen.getByTestId('message-bubble')).toHaveClass('message-bubble--stage-narrator');
    });
    it('does NOT apply bot or user class to stage-narrator', () => {
        render(_jsx(MessageBubble, { role: "stage-narrator", children: "Stage text" }));
        const el = screen.getByTestId('message-bubble');
        expect(el).not.toHaveClass('message-bubble--bot');
        expect(el).not.toHaveClass('message-bubble--user');
    });
    it('always applies base message-bubble class', () => {
        render(_jsx(MessageBubble, { role: "bot", children: "Hi" }));
        expect(screen.getByTestId('message-bubble')).toHaveClass('message-bubble');
    });
    it('renders children content', () => {
        render(_jsx(MessageBubble, { role: "user", children: "My message" }));
        expect(screen.getByTestId('message-bubble')).toHaveTextContent('My message');
    });
});
