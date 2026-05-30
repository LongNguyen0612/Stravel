import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardDeckZoneProps {
  chatInputHeight: number;
  children?: ReactNode;
  className?: string;
}

export const CardDeckZone = forwardRef<HTMLDivElement, CardDeckZoneProps>(
  function CardDeckZone({ chatInputHeight, children, className }, ref) {
    return (
      <div
        ref={ref}
        className={cn('fixed left-0 right-0 w-full', className)}
        style={{ bottom: `${chatInputHeight}px` }}
      >
        {children}
      </div>
    );
  }
);
