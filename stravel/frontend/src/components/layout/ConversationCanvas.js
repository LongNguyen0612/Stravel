import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
export function ConversationCanvas({ children, paddingBottom, ariaLive = 'polite', className, }) {
    return (_jsx("div", { role: "log", "aria-label": "Travel advisory conversation", "aria-live": ariaLive, "aria-relevant": "additions", className: cn('flex-1 overflow-y-auto overscroll-contain touch-pan-y', className), style: { paddingBottom: `${paddingBottom}px` }, children: children }));
}
