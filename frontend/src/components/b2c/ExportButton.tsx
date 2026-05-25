import { useState } from "react";

interface Props {
  sessionId: string;
  disabled?: boolean;
}

export function ExportButton({ sessionId, disabled }: Props) {
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      data-testid="export-button"
      onClick={handleExport}
      disabled={disabled || loading}
      style={{ padding: "10px 20px", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
    >
      {loading ? "Exporting..." : "Download PDF"}
    </button>
  );
}
