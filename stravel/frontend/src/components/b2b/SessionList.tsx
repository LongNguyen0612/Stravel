import { useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { AdvisorySession, SessionStatus } from '../../types/domain';
import { SessionRow } from './SessionRow';

interface SessionListProps {
  sessions: AdvisorySession[];
  activeSessionId?: string;
  onSelect: (session: AdvisorySession) => void;
}

const ALL_STATUSES: SessionStatus[] = ['pending', 'confirmed', 'modified', 'flagged'];
const STATUS_LABELS: Record<SessionStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  modified: 'Modified',
  flagged: 'Flagged',
};

export function SessionList({ sessions, activeSessionId, onSelect }: SessionListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState<SessionStatus[]>([]);
  const parentRef = useRef<HTMLDivElement>(null);

  const filteredSessions = sessions.filter((session) => {
    const destination = session.traveler_profile?.destination_preferences?.[0] ?? '';
    const matchesSearch =
      !searchQuery ||
      session.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      destination.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilters.length === 0 || statusFilters.includes(session.status);
    return matchesSearch && matchesStatus;
  });

  const virtualizer = useVirtualizer({
    count: filteredSessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 3,
  });

  function toggleStatusFilter(status: SessionStatus) {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-2 border-b border-border shrink-0">
        <input
          type="text"
          data-testid="session-search"
          aria-label="Search sessions"
          placeholder="Search sessions…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs px-3 py-1.5 rounded border border-border bg-surface text-text-base placeholder:text-text-muted focus:outline-none focus:ring-1"
          style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
        />
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1 p-2 border-b border-border shrink-0 flex-wrap">
        {ALL_STATUSES.map((status) => {
          const isActive = statusFilters.includes(status);
          return (
            <button
              key={status}
              data-testid={`filter-chip-${status}`}
              aria-pressed={isActive}
              onClick={() => toggleStatusFilter(status)}
              className="text-xs px-2 py-0.5 rounded-full border transition-colors"
              style={{
                borderColor: `var(--status-${status})`,
                background: isActive ? `var(--status-${status})` : 'transparent',
                color: isActive ? 'white' : `var(--status-${status})`,
              }}
            >
              {STATUS_LABELS[status]}
            </button>
          );
        })}
      </div>

      {/* Virtualized list */}
      <div
        ref={parentRef}
        role="listbox"
        aria-label="Client sessions"
        data-testid="session-list"
        style={{ flex: 1, overflowY: 'auto' }}
      >
        {filteredSessions.length === 0 ? (
          <div
            data-testid="session-list-empty"
            className="p-4 text-text-muted text-sm text-center"
          >
            No sessions found
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vRow) => {
              const session = filteredSessions[vRow.index];
              if (!session) return null;
              return (
                <div
                  key={vRow.key}
                  style={{
                    position: 'absolute',
                    top: vRow.start,
                    left: 0,
                    width: '100%',
                    height: vRow.size,
                  }}
                >
                  <SessionRow
                    session={session}
                    isActive={session.id === activeSessionId}
                    onSelect={onSelect}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
