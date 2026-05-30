import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
/**
 * B2CLayout — mobile-first full-viewport shell for the Chat-First UI.
 *
 * DOM constraints (UX-DR5, UX spec §Fixed Layout):
 * - h-dvh (not h-screen): uses 100dvh = visible viewport on mobile, avoids iOS address bar gap
 * - overflow-hidden on root: clips layout to viewport; the inner scroll container owns scrolling
 * - flex-col: stacks AppHeader / ConversationCanvas / fixed footer slots vertically
 * - theme-b2c: scopes CSS token variables to B2C palette (teal-600, amber)
 *
 * Story 7.2 adds ConversationCanvas (flex-1, overflow-y-auto) + ChatInput (position:fixed).
 * This shell is intentionally minimal — it is the outer container only.
 */
export function B2CLayout({ children, className }) {
    return (_jsx("div", { className: cn('theme-b2c', 'h-dvh flex flex-col overflow-hidden', 'bg-surface font-sans', className), children: children }));
}
