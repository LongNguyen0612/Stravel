import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function CopilotLayout({ sessionPanel, sidebar }) {
    return (_jsxs("div", { "data-testid": "copilot-layout", style: { display: "flex", height: "100%", overflow: "hidden" }, children: [_jsx("div", { "data-testid": "session-panel", style: { flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", borderRight: "1px solid #e5e7eb" }, children: sessionPanel }), _jsx("div", { "data-testid": "copilot-sidebar", style: { width: "420px", flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column", background: "#f9fafb" }, children: sidebar })] }));
}
