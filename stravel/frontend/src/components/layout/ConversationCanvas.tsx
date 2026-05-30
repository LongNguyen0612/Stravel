import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ConversationCanvasProps {
  children: ReactNode;
  paddingBottom: number;
  ariaLive?: 'off' | 'polite' | 'assertive';
  className?: string;
}

export function ConversationCanvas({
  children,
  paddingBottom,
  ariaLive = 'polite',
  className,
}: ConversationCanvasProps) {
  return (
    <div
      role="log"
      aria-label="Travel advisory conversation"
      aria-live={ariaLive}
      aria-relevant="additions"
      className={cn('flex-1 overflow-y-auto overscroll-contain touch-pan-y', className)}
      style={{ paddingBottom: `${paddingBottom}px` }}
    >
      {children}
    </div>
  );
}
