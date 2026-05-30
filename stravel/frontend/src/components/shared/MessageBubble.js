import { jsx as _jsx } from "react/jsx-runtime";
export function MessageBubble({ children, role }) {
    return (_jsx("div", { "data-testid": "message-bubble", className: `message-bubble message-bubble--${role}`, children: children }));
}
