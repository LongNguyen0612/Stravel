interface Props {
  severity: "block" | "warning" | "pass";
  label: string;
}

const SEVERITY_CLASSES: Record<Props["severity"], string> = {
  block: "bg-status-flagged text-white",
  warning: "bg-status-pending text-white",
  pass: "bg-status-confirmed text-white",
};

export function ComplianceBadge({ severity, label }: Props) {
  return (
    <span
      data-testid="compliance-badge"
      className={`compliance-badge inline-block px-2 py-0.5 rounded text-xs ${SEVERITY_CLASSES[severity]}`}
    >
      {label}
    </span>
  );
}
