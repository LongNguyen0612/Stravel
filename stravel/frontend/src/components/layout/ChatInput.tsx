import { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const ChatInput = forwardRef<HTMLDivElement, ChatInputProps>(
  function ChatInput(
    { onSubmit, disabled = false, placeholder = 'Tell me about your trip plans...', className },
    ref
  ) {
    const [value, setValue] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) return;
      onSubmit(trimmed);
      setValue('');
    };

    return (
      <div
        ref={ref}
        data-testid="chat-input-container"
        className={cn(
          'fixed bottom-0 left-0 right-0 w-full',
          'pb-safe bg-surface border-t border-border',
          className
        )}
      >
        <form onSubmit={handleSubmit} className="flex gap-2 p-3">
          <input
            data-testid="chat-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg border border-border bg-surface',
              'text-text-base placeholder:text-text-muted',
              'focus:outline-none focus:ring-2 focus:ring-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          <button
            data-testid="chat-send"
            type="submit"
            disabled={disabled || !value.trim()}
            className={cn(
              'px-4 py-2 rounded-lg bg-primary text-white font-medium',
              'hover:bg-primary-hover transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Send
          </button>
        </form>
      </div>
    );
  }
);
