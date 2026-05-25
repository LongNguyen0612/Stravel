import { useState } from "react";
import { MessageBubble } from "../shared/MessageBubble";
import { TypingIndicator } from "../shared/TypingIndicator";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export function ChatInterface({ messages, onSendMessage, isLoading }: Props) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  return (
    <div data-testid="chat-interface">
      <div
        data-testid="chat-messages"
        style={{ minHeight: "400px", maxHeight: "60vh", overflow: "auto", padding: "16px" }}
      >
        {messages.map((msg, i) => (
          <MessageBubble key={i} sender={msg.role === "user" ? "user" : "agent"}>
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
