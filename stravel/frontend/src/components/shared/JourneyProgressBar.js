import { jsx as _jsx } from "react/jsx-runtime";
const STAGES = [
    { key: "profiling", label: "Profile" },
    { key: "calculating", label: "Budget" },
    { key: "proposing", label: "Proposal" },
    { key: "validating", label: "Review" },
];
const STAGE_ORDER = {
    idle: -1, profiling: 0, calculating: 1, proposing: 2, validating: 3, complete: 4,
};
export function JourneyProgressBar({ stage, hasStarted, onStageClick }) {
    if (!hasStarted)
        return null;
    const currentOrder = STAGE_ORDER[stage] ?? -1;
    return (_jsx("div", { "data-testid": "journey-progress-bar", style: { display: "flex", gap: "4px", padding: "8px 16px", alignItems: "center" }, children: STAGES.map(({ key, label }) => {
            const order = STAGE_ORDER[key];
            const isCurrent = key === stage;
            const isDone = order < currentOrder;
            return (_jsx("button", { "data-testid": `stage-step-${key}`, onClick: () => isDone && onStageClick(key), disabled: !isDone, style: {
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
                }, children: label }, key));
        }) }));
}
