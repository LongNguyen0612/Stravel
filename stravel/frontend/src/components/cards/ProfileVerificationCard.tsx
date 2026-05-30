import { cn } from '@/lib/utils';

export interface ProfileVerificationItem {
  icon: string;
  label: string;
  value: string;
}

export interface ProfileVerificationCardProps {
  items: ProfileVerificationItem[];
  onConfirm: () => void;
  onEdit: () => void;
  className?: string;
}

export function ProfileVerificationCard({
  items,
  onConfirm,
  onEdit,
  className,
}: ProfileVerificationCardProps) {
  return (
    <div
      data-testid="profile-verification-card"
      className={cn(
        'rounded-2xl border border-border bg-surface p-4 shadow-sm',
        className
      )}
    >
      <ul role="list" className="mb-4 space-y-2">
        {items.map((item) => (
          <li key={item.label} role="listitem" className="flex items-center gap-2 text-sm">
            <span aria-hidden="true">{item.icon}</span>
            <span className="font-medium text-text-base">{item.label}:</span>
            <span className="text-text-muted">{item.value}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-[44px] flex-1 rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          Looks good — build my trip!
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-[44px] flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-base hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Edit something
        </button>
      </div>
    </div>
  );
}
