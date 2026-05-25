interface Props {
  severity: "block" | "warning" | "pass";
  label: string;
}

const COLORS = {
  block: "#dc2626",
  warning: "#f59e0b",
  pass: "#22c55e",
};

export function ComplianceBadge({ severity, label }: Props) {
  return (
    <span
      data-testid="compliance-badge"
      className="compliance-badge"
      style={{ backgroundColor: COLORS[severity], color: "#fff", padding: "2px 8px", borderRadius: "4px", fontSize: "12px" }}
    >
      {label}
    </span>
  );
}
