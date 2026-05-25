import type { StreamMessage as StreamMessageType } from "../../types/stream";

interface Props {
  message: StreamMessageType;
}

export function StreamMessage({ message }: Props) {
  return (
    <div data-testid="stream-message" className="stream-message">
      <div data-testid="message-content" className="message-content">
        {message.content}
      </div>
      {message.context && (
        <span data-testid="message-context" className="message-context">
          {message.context}
        </span>
      )}
    </div>
  );
}
