import { useEffect, useRef, useState } from "react";
import type { AdvisorySession } from "../../types/domain";
import type { StreamMessage, SSEPhase } from "../../types/stream";
import { randomUUID } from "../../utils/uuid";
import { classifyMessage, classifyBuildTripIntent } from "../../utils/messageClassifier";

interface ChatEntry {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: number;
}

interface Props {
  session: AdvisorySession;
  onChat: (message: string) => Promise<void>;
  sseMessages: StreamMessage[];
  ssePhase: SSEPhase;
}

export function SessionPanel({ session, onChat, sseMessages, ssePhase }: Props) {
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [userMessages, setUserMessages] = useState<ChatEntry[]>([]);
  const fallbackShownRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const allMessages: ChatEntry[] = [
    ...userMessages,
    ...sseMessages.map((m) => ({
      id: m.id,
      role: "bot" as const,
      content: m.content,
      timestamp: m.timestamp,
    })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  async function handleSendChat() {
    const msg = chatInput.trim();
    if (!msg || sending) return;
    const now = Date.now();
    setChatInput("");

    if (classifyMessage(msg) === "specific" || classifyBuildTripIntent(msg)) {
      fallbackShownRef.current = false;
      setUserMessages((prev) => [
        ...prev,
        { id: randomUUID(), role: "user", content: msg, timestamp: now },
      ]);
      setSending(true);
      try {
        await onChat(msg);
      } finally {
        setSending(false);
      }
    } else if (!fallbackShownRef.current) {
      fallbackShownRef.current = true;
      setUserMessages((prev) => [
        ...prev,
        { id: randomUUID(), role: "user", content: msg, timestamp: now },
        {
          id: randomUUID(),
          role: "bot",
          content: "Hi! To start planning, tell me about the trip — destination, dates, budget, and number of travellers.\n\nFor example: \"2 adults, Vietnam, 10 days, $3,000 budget\"",
          timestamp: now + 1,
        },
      ]);
    }
    // else: fallback already shown — silently ignore
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  }

  const isStreaming = ssePhase === "streaming";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", flexShrink: 0 }}>
        <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>Advisory Session</h2>
        <div style={{ display: "flex", gap: "8px", fontSize: "12px", color: "var(--color-text-muted)", marginTop: "3px" }}>
          <span>ID: {session.id.slice(0, 8)}…</span>
          <span style={{
            background: `var(--status-${session.status}, #6b7280)`,
            color: "white",
            padding: "1px 8px",
            borderRadius: "12px",
            fontWeight: 600,
            textTransform: "uppercase",
          }}>
            {session.status}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {allMessages.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: "48px", color: "#9ca3af" }}>
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>💬</div>
            <p style={{ fontSize: "14px", margin: 0 }}>Describe the client's trip to get started.</p>
            <p style={{ fontSize: "12px", color: "#d1d5db", marginTop: "6px" }}>
              e.g. "2 adults, Vietnam, 10 days, $3000 budget"
            </p>
          </div>
        ) : (
          allMessages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: msg.role === "user" ? "var(--color-primary, #2563eb)" : "#fff",
                  color: msg.role === "user" ? "#fff" : "#1f2937",
                  fontSize: "13px",
                  lineHeight: 1.6,
                  border: msg.role === "bot" ? "1px solid #e5e7eb" : "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}

        {(sending || isStreaming) && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "10px 16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px 16px 16px 4px", fontSize: "18px" }}>
              <span style={{ animation: "pulse 1s infinite" }}>●</span>
              <span style={{ animation: "pulse 1s 0.2s infinite", marginLeft: "3px" }}>●</span>
              <span style={{ animation: "pulse 1s 0.4s infinite", marginLeft: "3px" }}>●</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the client's trip… (Enter to send)"
            rows={2}
            disabled={sending || isStreaming}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "10px",
              fontSize: "13px",
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
              lineHeight: 1.5,
              background: sending || isStreaming ? "#f9fafb" : "#fff",
            }}
          />
          <button
            onClick={handleSendChat}
            disabled={!chatInput.trim() || sending || isStreaming}
            style={{
              padding: "10px 16px",
              background: !chatInput.trim() || sending || isStreaming ? "#9ca3af" : "var(--color-primary, #2563eb)",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: !chatInput.trim() || sending || isStreaming ? "not-allowed" : "pointer",
              flexShrink: 0,
              height: "56px",
            }}
          >
            ➤
          </button>
        </div>
        <p style={{ fontSize: "11px", color: "#9ca3af", margin: "6px 0 0 2px" }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; } 50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
