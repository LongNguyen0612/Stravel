import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const STAGES = ["profiling", "calculating", "proposing", "validating", "complete"];
export function DemoLayout({ children, stage }) {
    const currentIndex = STAGES.indexOf(stage);
    return (_jsxs("div", { "data-testid": "demo-layout", style: { maxWidth: "800px", margin: "0 auto", padding: "24px" }, children: [_jsx("h1", { "data-testid": "demo-title", children: "STravel \u2014 Plan Your Vietnam Trip" }), _jsx("div", { "data-testid": "stage-progress", style: { display: "flex", gap: "4px", margin: "16px 0" }, children: STAGES.map((s, i) => (_jsx("div", { style: {
                        flex: 1,
                        height: "4px",
                        background: i <= currentIndex ? "#3b82f6" : "#e5e7eb",
                        borderRadius: "2px",
                    } }, s))) }), _jsxs("p", { style: { fontSize: "12px", color: "#6b7280", marginBottom: "16px" }, children: ["Stage: ", stage.charAt(0).toUpperCase() + stage.slice(1)] }), children] }));
}
