import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  sender: "agent" | "user";
}

export function MessageBubble({ children, sender }: Props) {
  return (
    <div
      data-testid="message-bubble"
      className={`message-bubble message-bubble--${sender}`}
    >
      {children}
    </div>
  );
}
