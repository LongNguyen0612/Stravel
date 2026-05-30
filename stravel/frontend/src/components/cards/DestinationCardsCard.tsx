import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SlotKey } from '../../types/domain';

export interface DestinationOption {
  value: string;
  label: string;
  description: string;
  costTier: 'budget' | 'mid-range' | 'premium';
}

export interface DestinationCardsCardProps {
  slotKey: SlotKey;
  prompt?: string;
  options: DestinationOption[];
  onSelect: (update: { slotKey: SlotKey; value: string; label: string }) => void;
  onSurprise?: (event: { slotKey: SlotKey }) => void;
  className?: string;
}

const COST_TIER_BADGE: Record<DestinationOption['costTier'], string> = {
  budget: '💸 Budget',
  'mid-range': '💰 Mid-range',
  premium: '💎 Premium',
};

export function DestinationCardsCard({
  slotKey,
  prompt = 'Where would you like to go?',
  options,
  onSelect,
  onSurprise,
  className,
}: DestinationCardsCardProps) {
  const promptId = useId();
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current);
    };
  }, []);

  function scheduleAdvance(value: string, label: string) {
    if (timerRef.current != null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSelect({ slotKey, value, label });
    }, 300);
  }

  function immediateAdvance(value: string, label: string) {
    if (timerRef.current != null) clearTimeout(timerRef.current);
    onSelect({ slotKey, value, label });
  }

  function handleCardActivate(value: string, label: string) {
    setSelectedValue(value);
    scheduleAdvance(value, label);
  }

  function handleCardKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, value: string, label: string) {
    if ((e.key === 'Enter' || e.key === ' ') && selectedValue === value) {
      e.preventDefault();
      immediateAdvance(value, label);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={promptId}
      className={cn('flex flex-col gap-3', className)}
    >
      <p id={promptId} className="text-sm font-medium text-text-base">
        {prompt}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const isSelected = selectedValue === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleCardActivate(opt.value, opt.label)}
              onKeyDown={(e) => handleCardKeyDown(e, opt.value, opt.label)}
              className={cn(
                'flex flex-col items-start gap-1 p-3 rounded-xl border text-left cursor-pointer',
                'transition-all motion-reduce:transition-none select-none',
                'min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                isSelected
                  ? 'border-transparent bg-teal-600 text-white'
                  : 'border-border bg-surface hover:bg-surface-2'
              )}
            >
              <span className="font-semibold text-sm">{opt.label}</span>
              <span className={cn('text-xs', isSelected ? 'text-white/80' : 'text-text-muted')}>
                {opt.description}
              </span>
              <span className="text-xs mt-1">{COST_TIER_BADGE[opt.costTier]}</span>
            </button>
          );
        })}
      </div>

      {onSurprise && (
        <button
          type="button"
          onClick={() => onSurprise({ slotKey })}
          className={cn(
            'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full',
            'border border-border bg-surface text-sm font-medium cursor-pointer',
            'hover:bg-surface-2 min-h-[44px] min-w-[44px] focus:outline-none',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            'motion-reduce:transition-none'
          )}
        >
          🎲 Surprise me
        </button>
      )}
    </div>
  );
}
