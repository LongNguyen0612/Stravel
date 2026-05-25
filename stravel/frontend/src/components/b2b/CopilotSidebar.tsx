import type { StreamState } from "../../types/stream";
import { ComplianceBadge } from "../shared/ComplianceBadge";
import { StreamMessage } from "../shared/StreamMessage";
import { TypingIndicator } from "../shared/TypingIndicator";

interface Props {
  state: StreamState;
}

const STAGE_LABELS: Record<string, string> = {
  idle: "Waiting",
  profiling: "Profiling",
  calculating: "Calculating",
  proposing: "Generating Proposal",
  validating: "Validating Compliance",
  complete: "Complete",
};

export function CopilotSidebar({ state }: Props) {
  return (
    <div data-testid="copilot-sidebar-content" style={{ padding: "16px" }}>
      <div data-testid="stage-indicator" style={{ marginBottom: "16px", fontWeight: "bold" }}>
        Stage: {STAGE_LABELS[state.status] || state.status}
      </div>

      {state.isConnected && state.status !== "idle" && state.status !== "complete" && <TypingIndicator />}

      <div data-testid="message-list">
        {state.messages.map((msg) => (
          <StreamMessage key={msg.id} message={msg} />
        ))}
      </div>

      {state.complianceFlags.length > 0 && (
        <div data-testid="compliance-flags" style={{ marginTop: "16px" }}>
          <h3>Compliance</h3>
          {state.complianceFlags.map((flag, i) => (
            <div key={i} style={{ marginBottom: "8px" }}>
              <ComplianceBadge severity={flag.severity} label={flag.check} />
              <p>{flag.message}</p>
            </div>
          ))}
        </div>
      )}

      {state.error && (
        <div data-testid="error-display" style={{ color: "red", marginTop: "16px" }}>
          Error: {state.error}
        </div>
      )}
    </div>
  );
}
