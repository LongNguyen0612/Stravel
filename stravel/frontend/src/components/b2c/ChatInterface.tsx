import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "../shared/MessageBubble";
import { TypingIndicator } from "../shared/TypingIndicator";
import { classifyFirstMessage } from "../../constants/destinations";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  sessionId?: string;
  onProposeFirst?: (sessionId: string, message: string) => Promise<void>;
}

export function ChatInterface({ messages, onSendMessage, isLoading, sessionId, onProposeFirst }: Props) {
  const [input, setInput] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const hasMessagedRef = useRef(false);

  useEffect(() => {
    hasMessagedRef.current = false;
    setPendingUserMessage(null);
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");

    const isFirst = !hasMessagedRef.current;

    if (isFirst && sessionId && onProposeFirst && classifyFirstMessage(text)) {
      setPendingUserMessage(text);
      try {
        await onProposeFirst(sessionId, text);
        hasMessagedRef.current = true;
      } catch {
        hasMessagedRef.current = false;
        setPendingUserMessage(null);
      }
    } else {
      hasMessagedRef.current = true;
      onSendMessage(text);
    }
  };

  const displayMessages: Message[] = pendingUserMessage
    ? [{ role: "user", content: pendingUserMessage }, ...messages]
    : messages;

  return (
    <div data-testid="chat-interface">
      <div
        data-testid="chat-messages"
        style={{ minHeight: "400px", maxHeight: "60vh", overflow: "auto", padding: "16px" }}
      >
        {displayMessages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role === "user" ? "user" : "bot"}>
            {msg.content}
          </MessageBubble>
        ))}
        {isLoading && <TypingIndicator />}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px", padding: "16px" }}>
        <input
          data-testid="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell me about your trip plans..."
          style={{ flex: 1, padding: "12px", border: "1px solid #d1d5db", borderRadius: "8px" }}
          disabled={isLoading}
        />
        <button data-testid="chat-send" type="submit" disabled={isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
