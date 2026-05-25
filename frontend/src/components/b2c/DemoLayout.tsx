import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  stage: string;
}

const STAGES = ["profiling", "calculating", "proposing", "validating", "complete"];

export function DemoLayout({ children, stage }: Props) {
  const currentIndex = STAGES.indexOf(stage);

  return (
    <div data-testid="demo-layout" style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
      <h1 data-testid="demo-title">STravel — Plan Your Vietnam Trip</h1>

      <div data-testid="stage-progress" style={{ display: "flex", gap: "4px", margin: "16px 0" }}>
        {STAGES.map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: "4px",
              background: i <= currentIndex ? "#3b82f6" : "#e5e7eb",
              borderRadius: "2px",
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "16px" }}>
        Stage: {stage.charAt(0).toUpperCase() + stage.slice(1)}
      </p>

      {children}
    </div>
  );
}
