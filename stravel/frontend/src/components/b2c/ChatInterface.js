import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { MessageBubble } from "../shared/MessageBubble";
import { TypingIndicator } from "../shared/TypingIndicator";
export function ChatInterface({ messages, onSendMessage, isLoading }) {
    const [input, setInput] = useState("");
    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input.trim());
            setInput("");
        }
    };
    return (_jsxs("div", { "data-testid": "chat-interface", children: [_jsxs("div", { "data-testid": "chat-messages", style: { minHeight: "400px", maxHeight: "60vh", overflow: "auto", padding: "16px" }, children: [messages.map((msg, i) => (_jsx(MessageBubble, { role: msg.role === "user" ? "user" : "bot", children: msg.content }, i))), isLoading && _jsx(TypingIndicator, {})] }), _jsxs("form", { onSubmit: handleSubmit, style: { display: "flex", gap: "8px", padding: "16px" }, children: [_jsx("input", { "data-testid": "chat-input", type: "text", value: input, onChange: (e) => setInput(e.target.value), placeholder: "Tell me about your trip plans...", style: { flex: 1, padding: "12px", border: "1px solid #d1d5db", borderRadius: "8px" }, disabled: isLoading }), _jsx("button", { "data-testid": "chat-send", type: "submit", disabled: isLoading || !input.trim(), children: "Send" })] })] }));
}
