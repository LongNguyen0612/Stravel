import type { CardState } from './cardUtils';

interface Props {
  score: number;
  state: CardState;
  className?: string;
}

export function CompletenessIndicator({ score, state, className }: Props) {
  const pct = Math.round(score * 100);
  const fillClass = state === 'settled' ? 'bg-status-confirmed' : 'bg-status-pending';

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct}% complete`}
      className={`h-1 w-full overflow-hidden rounded-full bg-surface-2 ${className ?? ''}`}
    >
      <div
        className={`h-full ${fillClass} transition-[width] duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
