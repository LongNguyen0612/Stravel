import type { AdvisorySession } from '../../types/domain';
import { SessionStatusBadge } from '../shared/SessionStatusBadge';

interface SessionRowProps {
  session: AdvisorySession;
  isActive: boolean;
  onSelect: (session: AdvisorySession) => void;
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'Just now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SessionRow({ session, isActive, onSelect }: SessionRowProps) {
  const initials = session.id.slice(0, 2).toUpperCase();
  const name = `Session ${session.id.slice(0, 8)}…`;
  const destination =
    session.traveler_profile?.destination_preferences?.[0] ?? 'No destination';

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(session);
    }
  }

  return (
    <div
      role="option"
      aria-selected={isActive}
      tabIndex={0}
      data-testid={`session-row-${session.id}`}
      onClick={() => onSelect(session)}
      onKeyDown={handleKeyDown}
      className="flex items-center gap-3 px-4 w-full cursor-pointer hover:bg-surface-2 border-b border-border"
      style={{
        height: '64px',
        minHeight: '64px',
        maxHeight: '64px',
        borderLeft: isActive
          ? '4px solid var(--color-primary)'
          : '4px solid transparent',
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ background: `var(--status-${session.status})` }}
        aria-hidden="true"
      >
        {initials}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-base truncate">{name}</div>
        <div className="text-xs text-text-muted truncate">{destination}</div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <SessionStatusBadge status={session.status} flag_reason={session.flag_reason} />
        <span className="text-xs text-text-muted">
          {formatRelativeTime(session.updated_at)}
        </span>
      </div>
    </div>
  );
}
