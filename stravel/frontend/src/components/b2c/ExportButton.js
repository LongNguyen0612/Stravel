import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from "react";
export function ExportButton({ sessionId, disabled }) {
    const [loading, setLoading] = useState(false);
    const handleExport = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/v1/demo/sessions/${sessionId}/export`);
            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `stravel-proposal-${sessionId.slice(0, 8)}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
            }
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("button", { "data-testid": "export-button", onClick: handleExport, disabled: disabled || loading, style: { padding: "10px 20px", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }, children: loading ? "Exporting..." : "Download PDF" }));
}
