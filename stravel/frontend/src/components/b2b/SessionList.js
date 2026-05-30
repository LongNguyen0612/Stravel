import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export function SessionList({ sessions, onSelect, onArchive }) {
    return (_jsx("div", { "data-testid": "session-list", children: sessions.map((session, i) => {
            const profile = session.traveler_profile;
            const summary = profile?.destination_preferences?.length
                ? profile.destination_preferences.slice(0, 3).join(", ")
                : "No destinations yet";
            return (_jsxs("div", { "data-testid": `session-item-${session.id}`, style: {
                    padding: "16px 20px",
                    borderBottom: i < sessions.length - 1 ? "1px solid var(--color-border)" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }, children: [_jsxs("div", { onClick: () => onSelect(session), style: { flex: 1, cursor: "pointer" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }, children: [_jsxs("span", { style: { fontWeight: 600, fontSize: "14px" }, children: ["Session ", session.id.slice(0, 8), "..."] }), _jsx("span", { style: {
                                            fontSize: "11px",
                                            fontWeight: 600,
                                            padding: "2px 8px",
                                            borderRadius: "10px",
                                            background: `var(--status-${session.status}, var(--color-surface-2))`,
                                            color: "white",
                                        }, children: session.status.replace("_", " ").toUpperCase() })] }), _jsxs("div", { style: { fontSize: "13px", color: "var(--color-text-muted)" }, children: [summary, profile?.budget_total
                                        ? ` · ${profile.budget_currency ?? "USD"} ${profile.budget_total.toLocaleString()}`
                                        : ""] }), _jsx("div", { style: { fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px" }, children: new Date(session.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) })] }), session.status !== "archived" && (_jsx("button", { "data-testid": `archive-btn-${session.id}`, onClick: (e) => { e.stopPropagation(); onArchive(session.id); }, style: { marginLeft: "16px", fontSize: "12px", color: "var(--color-text-muted)", background: "none", border: "1px solid var(--color-border)", padding: "4px 10px" }, children: "Archive" }))] }, session.id));
        }) }));
}
