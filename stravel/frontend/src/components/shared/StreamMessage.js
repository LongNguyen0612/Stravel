import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function StreamMessage({ message }) {
    return (_jsxs("div", { "data-testid": "stream-message", className: "stream-message", children: [_jsx("div", { "data-testid": "message-content", className: "message-content", children: message.content }), message.context && (_jsx("span", { "data-testid": "message-context", className: "message-context", children: message.context }))] }));
}
