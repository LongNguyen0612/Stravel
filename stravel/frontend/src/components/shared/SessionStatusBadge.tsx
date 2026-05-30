import type { SessionStatus } from '../../types/domain';

interface SessionStatusBadgeProps {
  status: SessionStatus;
  flag_reason?: string | null;
}

const LABELS: Record<SessionStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  modified: 'Modified',
  flagged: 'Flagged',
};

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-3.5a.75.75 0 0 1 .75.75v3.19l1.78 1.78a.75.75 0 1 1-1.06 1.06l-2-2A.75.75 0 0 1 7.25 10V5.25A.75.75 0 0 1 8 4.5Z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm11.03-2.22a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 0 1 1.06-1.06l.97.97 2.97-2.97a.75.75 0 0 1 1.06 0Z" />
  </svg>
);

const PencilIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.249.249 0 0 0 .108-.064L11.19 6.25Z" />
  </svg>
);

const FlagIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M3.5 2.75a.75.75 0 0 0-1.5 0v10.5a.75.75 0 0 0 1.5 0V9.25h8.75a.75.75 0 0 0 .6-1.2L10.5 5.5l1.85-2.55a.75.75 0 0 0-.6-1.2H3.5V2.75Z" />
  </svg>
);

const ICONS: Record<SessionStatus, () => JSX.Element> = {
  pending: ClockIcon,
  confirmed: CheckCircleIcon,
  modified: PencilIcon,
  flagged: FlagIcon,
};

export function SessionStatusBadge({ status, flag_reason }: SessionStatusBadgeProps) {
  const label = LABELS[status];
  const Icon = ICONS[status];
  if (!Icon || !label) return null;
  const showTooltip = status === 'flagged' && !!flag_reason;
  const tooltipText = flag_reason && flag_reason.length > 80
    ? flag_reason.slice(0, 80) + '…'
    : (flag_reason ?? '');

  return (
    <span
      role="status"
      aria-label={`Status: ${label}`}
      title={showTooltip ? (flag_reason || undefined) : undefined}
      tabIndex={showTooltip ? 0 : undefined}
      data-testid="session-status-badge"
      className="relative inline-flex items-center gap-1 text-xs font-medium group select-none"
      style={{ color: `var(--status-${status})` }}
    >
      <Icon />
      <span>{label}</span>
      {showTooltip && (
        <span
          className="absolute bottom-full left-0 mb-1 hidden group-hover:block group-focus-within:block bg-surface border border-border rounded px-2 py-1 text-xs text-text-base z-10 max-w-[240px] whitespace-normal pointer-events-none"
          aria-hidden="true"
          data-testid="flag-reason-tooltip"
        >
          {tooltipText}
        </span>
      )}
    </span>
  );
}
