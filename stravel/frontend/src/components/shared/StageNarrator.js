import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
const STAGE_TEXT = {
    idle: "",
    profiling: "🗺️ Learning your travel preferences…",
    calculating: "💰 Calculating budget…",
    proposing: "✈️ Building your travel proposal…",
    validating: "✅ Checking compliance and safety…",
    complete: "",
};
export function StageNarrator({ stage }) {
    const [displayText, setDisplayText] = useState("");
    const timerRef = useRef(null);
    useEffect(() => {
        if (timerRef.current)
            clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setDisplayText(STAGE_TEXT[stage] ?? "");
        }, 400);
        return () => {
            if (timerRef.current)
                clearTimeout(timerRef.current);
        };
    }, [stage]);
    return (_jsx("div", { "aria-live": "polite", "aria-atomic": "true", "data-testid": "stage-narrator", children: displayText && (_jsx(MessageBubble, { role: "stage-narrator", children: displayText })) }));
}
