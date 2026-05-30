import type { WorkflowStage } from "../../types/stream";

const STAGES: { key: WorkflowStage; label: string }[] = [
  { key: "profiling",   label: "Profile" },
  { key: "calculating", label: "Budget" },
  { key: "proposing",   label: "Proposal" },
  { key: "validating",  label: "Review" },
];

const STAGE_ORDER: Record<WorkflowStage, number> = {
  idle: -1, profiling: 0, calculating: 1, proposing: 2, validating: 3, complete: 4,
};

interface Props {
  stage: WorkflowStage;
  hasStarted: boolean;
  onStageClick: (stage: WorkflowStage) => void;
}

export function JourneyProgressBar({ stage, hasStarted, onStageClick }: Props) {
  if (!hasStarted) return null;

  const currentOrder = STAGE_ORDER[stage] ?? -1;

  return (
    <div
      data-testid="journey-progress-bar"
      style={{ display: "flex", gap: "4px", padding: "8px 16px", alignItems: "center" }}
    >
      {STAGES.map(({ key, label }) => {
        const order = STAGE_ORDER[key];
        const isCurrent = key === stage;
        const isDone = order < currentOrder;
        return (
          <button
            key={key}
            data-testid={`stage-step-${key}`}
            onClick={() => isDone && onStageClick(key)}
            disabled={!isDone}
            style={{
              flex: 1,
              fontSize: "11px",
              fontWeight: isCurrent ? 700 : 400,
              color: isCurrent ? "#0d9488" : isDone ? "#94a3b8" : "#cbd5e1",
              background: "none",
              border: "none",
              borderBottom: isCurrent ? "2px solid #0d9488" : "2px solid transparent",
              padding: "4px 2px",
              cursor: isDone ? "pointer" : "default",
              textAlign: "center",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
