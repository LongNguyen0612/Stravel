import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { StreamState, WorkflowStage } from "../../types/stream";
import { ComplianceBadge } from "../shared/ComplianceBadge";
import { JourneyProgressBar } from "../shared/JourneyProgressBar";
import { StageNarrator } from "../shared/StageNarrator";
import { TypingIndicator } from "../shared/TypingIndicator";

interface Props {
  state: StreamState;
}

const STAGE_CONFIG: Record<WorkflowStage, { label: string; color: string; bg: string }> = {
  idle:        { label: "Waiting",             color: "#6b7280", bg: "#f3f4f6" },
  profiling:   { label: "Profiling Client",    color: "#2563eb", bg: "#eff6ff" },
  calculating: { label: "Calculating",         color: "#d97706", bg: "#fffbeb" },
  proposing:   { label: "Generating Proposal", color: "#059669", bg: "#f0fdf4" },
  validating:  { label: "Validating",          color: "#7c3aed", bg: "#faf5ff" },
  complete:    { label: "Complete",            color: "#374151", bg: "#f9fafb" },
};

const MSG_ICONS: Record<string, string> = {
  question: "💬",
  result:   "✅",
  proposal: "📄",
  error:    "❌",
};

const markdownStyles = `
  .md-content { font-size: 13px; line-height: 1.7; color: #1f2937; }
  .md-content h1, .md-content h2, .md-content h3 { font-weight: 700; margin: 12px 0 6px; color: #111827; }
  .md-content h1 { font-size: 15px; }
  .md-content h2 { font-size: 14px; }
  .md-content h3 { font-size: 13px; }
  .md-content p { margin: 0 0 8px; }
  .md-content ul, .md-content ol { margin: 0 0 8px; padding-left: 18px; }
  .md-content li { margin-bottom: 3px; }
  .md-content strong { font-weight: 700; color: #111827; }
  .md-content em { font-style: italic; }
  .md-content code { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; font-size: 12px; font-family: monospace; }
  .md-content hr { border: none; border-top: 1px solid #e5e7eb; margin: 10px 0; }
`;

function ProposalCard({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW = 400;
  const isLong = content.length > PREVIEW;
  return (
    <div>
      <style>{markdownStyles}</style>
      <div
        style={{
          overflow: "hidden",
          maxHeight: expanded ? "none" : "280px",
          maskImage: !expanded && isLong ? "linear-gradient(to bottom, black 60%, transparent 100%)" : undefined,
          WebkitMaskImage: !expanded && isLong ? "linear-gradient(to bottom, black 60%, transparent 100%)" : undefined,
        }}
      >
        <div className="md-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((x) => !x)}
          style={{
            marginTop: "8px",
            background: "none",
            border: "none",
            color: "#2563eb",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
            padding: 0,
          }}
        >
          {expanded ? "Show less ▲" : "Show full proposal ▼"}
        </button>
      )}
    </div>
  );
}

export function CopilotSidebar({ state }: Props) {
  const stage = STAGE_CONFIG[state.status] ?? STAGE_CONFIG.idle;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isActive = state.isConnected && state.status !== "idle" && state.status !== "complete";

  const handleStageScroll = useCallback((targetStage: WorkflowStage) => {
    const el = scrollContainerRef.current?.querySelector(`[data-stage="${targetStage}"]`);
    el?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages.length, state.complianceFlags.length]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Stage indicator — fixed at top */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e5e7eb",
          background: stage.bg,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: stage.color,
              flexShrink: 0,
              ...(isActive ? { animation: "pulse 1.5s infinite" } : {}),
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: stage.color }}>{stage.label}</div>
            <div style={{ fontSize: "11px", color: "#9ca3af" }}>
              {state.isConnected ? "Live" : "Disconnected"} · {state.messages.length} message{state.messages.length !== 1 ? "s" : ""}
            </div>
          </div>
          {state.status === "complete" && (
            <span style={{ fontSize: "18px" }}>✅</span>
          )}
        </div>
        {isActive && <TypingIndicator />}
      </div>

      {/* Journey progress bar — below stage indicator */}
      <JourneyProgressBar
        stage={state.status}
        hasStarted={state.messages.length > 0 || state.status !== "idle"}
        onStageClick={handleStageScroll}
      />

      {/* Scrollable content area */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>

        {state.messages.length === 0 && !state.error && (
          <p style={{ color: "#9ca3af", fontSize: "13px", textAlign: "center", marginTop: "32px" }}>
            {state.status === "idle" ? "Start AI Analysis to see results here." : "Waiting for AI…"}
          </p>
        )}

        {state.messages.map((msg) => (
          <div
            key={msg.id}
            data-stage={msg.type === "question" ? "profiling" : msg.type === "result" ? "calculating" : "proposing"}
            style={{
              padding: "12px 14px",
              background: msg.type === "proposal" ? "#f0fdf4" : "#fff",
              border: `1px solid ${msg.type === "proposal" ? "#bbf7d0" : "#e5e7eb"}`,
              borderRadius: "10px",
              fontSize: "13px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <span style={{ fontSize: "14px" }}>{MSG_ICONS[msg.type] ?? "💬"}</span>
              <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {msg.type === "proposal" ? "AI Proposal" : msg.type}
              </span>
              {msg.context && (
                <span style={{ fontSize: "10px", color: "#9ca3af", marginLeft: "auto" }}>{msg.context.replace(/_/g, " ")}</span>
              )}
            </div>
            {msg.type === "proposal" ? (
              <ProposalCard content={msg.content} />
            ) : (
              <div className="md-content">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {/* Compliance flags */}
        {state.complianceFlags.length > 0 && (
          <div data-stage="validating">
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              Compliance Checks
            </div>
            {state.complianceFlags.map((flag, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  marginBottom: "6px",
                  background: flag.severity === "block" ? "#fef2f2" : flag.severity === "pass" ? "#f0fdf4" : "#fffbeb",
                  border: `1px solid ${flag.severity === "block" ? "#fecaca" : flag.severity === "pass" ? "#bbf7d0" : "#fde68a"}`,
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <ComplianceBadge severity={flag.severity} label={flag.check} />
                </div>
                <p style={{ fontSize: "12px", color: "#374151", margin: "4px 0 0 0", lineHeight: 1.5 }}>{flag.message}</p>
                {flag.alternative && (
                  <p style={{ fontSize: "11px", color: "#6b7280", margin: "4px 0 0 0" }}>→ {flag.alternative}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {state.error && (
          <div style={{ padding: "12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#dc2626", fontSize: "13px" }}>
            ❌ {state.error}
          </div>
        )}

        <StageNarrator stage={state.status} />
        <div ref={messagesEndRef} />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
