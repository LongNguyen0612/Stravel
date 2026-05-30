import { jsx as _jsx } from "react/jsx-runtime";
const SEVERITY_CLASSES = {
    block: "bg-status-flagged text-white",
    warning: "bg-status-pending text-white",
    pass: "bg-status-confirmed text-white",
};
export function ComplianceBadge({ severity, label }) {
    return (_jsx("span", { "data-testid": "compliance-badge", className: `compliance-badge inline-block px-2 py-0.5 rounded text-xs ${SEVERITY_CLASSES[severity]}`, children: label }));
}
