import type { AdvisorySession } from "../../types/domain";

interface Props {
  sessions: AdvisorySession[];
  onSelect: (session: AdvisorySession) => void;
  onArchive: (sessionId: string) => void;
}

export function SessionList({ sessions, onSelect, onArchive }: Props) {
  return (
    <div data-testid="session-list">
      {sessions.map((session) => (
        <div
          key={session.id}
          data-testid={`session-item-${session.id}`}
          style={{
            padding: "12px",
            borderBottom: "1px solid #e5e7eb",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div onClick={() => onSelect(session)}>
            <strong>{session.id.slice(0, 8)}...</strong>
            <span style={{ marginLeft: "8px", color: "#6b7280" }}>{session.status}</span>
          </div>
          {session.status !== "archived" && (
            <button data-testid={`archive-btn-${session.id}`} onClick={() => onArchive(session.id)}>
              Archive
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
