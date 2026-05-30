import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const COST_TIER_BADGE = {
    budget: '💸 Budget',
    'mid-range': '💰 Mid-range',
    premium: '💎 Premium',
};

export function DestinationCardsCard({ slotKey, prompt = 'Where would you like to go?', options, onSelect, onSurprise, className, }) {
    const promptId = useId();
    const [selectedValue, setSelectedValue] = useState(null);
    const timerRef = useRef(null);
    useEffect(() => {
        return () => {
            if (timerRef.current != null)
                clearTimeout(timerRef.current);
        };
    }, []);
    function scheduleAdvance(value, label) {
        if (timerRef.current != null)
            clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            onSelect({ slotKey, value, label });
        }, 300);
    }
    function immediateAdvance(value, label) {
        if (timerRef.current != null)
            clearTimeout(timerRef.current);
        onSelect({ slotKey, value, label });
    }
    function handleCardActivate(value, label) {
        setSelectedValue(value);
        scheduleAdvance(value, label);
    }
    function handleCardKeyDown(e, value, label) {
        if ((e.key === 'Enter' || e.key === ' ') && selectedValue === value) {
            e.preventDefault();
            immediateAdvance(value, label);
        }
    }
    return (_jsxs("div", { role: "radiogroup", "aria-labelledby": promptId, className: cn('flex flex-col gap-3', className), children: [_jsx("p", { id: promptId, className: "text-sm font-medium text-text-base", children: prompt }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: options.map((opt) => {
                    const isSelected = selectedValue === opt.value;
                    return (_jsxs("button", { type: "button", role: "radio", "aria-checked": isSelected, onClick: () => handleCardActivate(opt.value, opt.label), onKeyDown: (e) => handleCardKeyDown(e, opt.value, opt.label), className: cn('flex flex-col items-start gap-1 p-3 rounded-xl border text-left cursor-pointer', 'transition-all motion-reduce:transition-none select-none', 'min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2', isSelected ? 'border-transparent bg-teal-600 text-white' : 'border-border bg-surface hover:bg-surface-2'), children: [_jsx("span", { className: "font-semibold text-sm", children: opt.label }), _jsx("span", { className: cn('text-xs', isSelected ? 'text-white/80' : 'text-text-muted'), children: opt.description }), _jsx("span", { className: "text-xs mt-1", children: COST_TIER_BADGE[opt.costTier] })] }, opt.value));
                }) }), onSurprise && (_jsx("button", { type: "button", onClick: () => onSurprise({ slotKey }), className: cn('inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full', 'border border-border bg-surface text-sm font-medium cursor-pointer', 'hover:bg-surface-2 min-h-[44px] min-w-[44px] focus:outline-none', 'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2', 'motion-reduce:transition-none'), children: "🎲 Surprise me" }))] }));
}
