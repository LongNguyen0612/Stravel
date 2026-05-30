import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  role: "bot" | "user" | "stage-narrator";
}

export function MessageBubble({ children, role }: Props) {
  return (
    <div
      data-testid="message-bubble"
      className={`message-bubble message-bubble--${role}`}
    >
      {children}
    </div>
  );
}
