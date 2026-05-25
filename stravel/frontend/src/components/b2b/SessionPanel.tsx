import type { AdvisorySession } from "../../types/domain";

interface Props {
  session: AdvisorySession | null;
  onCreateSession: () => void;
}

export function SessionPanel({ session, onCreateSession }: Props) {
  if (!session) {
    return (
      <div data-testid="session-panel-empty" style={{ padding: "24px", textAlign: "center" }}>
        <h2>STravel Advisory</h2>
        <p>Start a new advisory session to begin.</p>
        <button data-testid="create-session-btn" onClick={onCreateSession}>
          New Advisory Session
        </button>
      </div>
    );
  }

  return (
    <div data-testid="session-panel-active" style={{ padding: "24px" }}>
      <h2>Advisory Session</h2>
      <p>Session ID: {session.id}</p>
      <p>Status: {session.status}</p>
    </div>
  );
}
