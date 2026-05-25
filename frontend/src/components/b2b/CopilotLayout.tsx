import type { ReactNode } from "react";

interface Props {
  sessionPanel: ReactNode;
  sidebar: ReactNode;
}

export function CopilotLayout({ sessionPanel, sidebar }: Props) {
  return (
    <div data-testid="copilot-layout" style={{ display: "flex", height: "100vh" }}>
      <div data-testid="session-panel" style={{ flex: 1, overflow: "auto", borderRight: "1px solid #e5e7eb" }}>
        {sessionPanel}
      </div>
      <div data-testid="copilot-sidebar" style={{ width: "400px", overflow: "auto", background: "#f9fafb" }}>
        {sidebar}
      </div>
    </div>
  );
}
