import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import type { WorkflowStage } from "../../types/stream";

const STAGE_TEXT: Record<WorkflowStage, string> = {
  idle:        "",
  profiling:   "🗺️ Learning your travel preferences…",
  calculating: "💰 Calculating budget…",
  proposing:   "✈️ Building your travel proposal…",
  validating:  "✅ Checking compliance and safety…",
  complete:    "",
};

interface Props {
  stage: WorkflowStage;
}

export function StageNarrator({ stage }: Props) {
  const [displayText, setDisplayText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDisplayText(STAGE_TEXT[stage] ?? "");
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stage]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      data-testid="stage-narrator"
    >
      {displayText && (
        <MessageBubble role="stage-narrator">{displayText}</MessageBubble>
      )}
    </div>
  );
}
