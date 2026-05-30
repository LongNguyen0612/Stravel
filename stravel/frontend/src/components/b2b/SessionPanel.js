import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { ProfileForm } from "./ProfileForm";
export function SessionPanel({ session, onProfileSave, onRun }) {
    const [running, setRunning] = useState(false);
    async function handleRun() {
        setRunning(true);
        try {
            await onRun();
        }
        finally {
            setRunning(false);
        }
    }
    return (_jsxs("div", { style: { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }, children: [_jsxs("div", { style: { padding: "16px 20px", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", flexShrink: 0 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }, children: [_jsxs("div", { children: [_jsx("h2", { style: { fontSize: "16px", fontWeight: 700, margin: 0 }, children: "Advisory Session" }), _jsxs("div", { style: { display: "flex", gap: "10px", fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px" }, children: [_jsxs("span", { children: ["ID: ", session.id.slice(0, 8), "…"] }), _jsx("span", { style: {
                                                    background: `var(--status-${session.status}, var(--color-surface-2))`,
                                                    color: "white",
                                                    padding: "1px 8px",
                                                    borderRadius: "12px",
                                                    fontWeight: 600,
                                                }, children: session.status.replace("_", " ").toUpperCase() }), _jsx("span", { children: new Date(session.created_at).toLocaleDateString() })] })] }), _jsx("button", { onClick: handleRun, disabled: running, style: {
                                    padding: "9px 20px",
                                    background: running ? "var(--color-text-muted)" : "var(--color-primary)",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    cursor: running ? "not-allowed" : "pointer",
                                    whiteSpace: "nowrap",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    flexShrink: 0,
                                }, children: running ? "⏳ Running…" : "▶ Start AI Analysis" })] }), !running && (_jsx("p", { style: { fontSize: "12px", color: "var(--color-text-muted)", margin: 0 }, children: "Fill in the traveler profile below, then click Start AI Analysis to run the advisory workflow." }))] }), _jsxs("div", { style: { flex: 1, overflowY: "auto", padding: "20px" }, children: [_jsx("h3", { style: { fontSize: "14px", fontWeight: 600, marginBottom: "16px", marginTop: 0 }, children: "Traveler Profile" }), session.traveler_profile ? (_jsx(ProfileForm, { profile: session.traveler_profile, onSave: onProfileSave })) : (_jsx("p", { style: { color: "var(--color-text-muted)", fontSize: "14px" }, children: "Loading profile…" }))] })] }));
}
