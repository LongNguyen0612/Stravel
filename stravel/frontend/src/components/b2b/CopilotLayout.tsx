import type { ReactNode } from "react";

interface Props {
  sessionPanel: ReactNode;
  sidebar: ReactNode;
}

export function CopilotLayout({ sessionPanel, sidebar }: Props) {
  return (
    <div data-testid="copilot-layout" style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <div data-testid="session-panel" style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", borderRight: "1px solid #e5e7eb" }}>
        {sessionPanel}
      </div>
      <div data-testid="copilot-sidebar" style={{ width: "420px", flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column", background: "#f9fafb" }}>
        {sidebar}
      </div>
    </div>
  );
}
