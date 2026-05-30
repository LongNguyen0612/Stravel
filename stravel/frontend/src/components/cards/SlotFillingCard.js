import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const chipVariants = cva('inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium cursor-pointer transition-all motion-reduce:transition-none select-none min-h-[44px] min-w-[44px] focus:outline-none', {
    variants: {
        state: {
            default: 'border-border bg-surface text-text-base hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            selected: 'border-transparent bg-teal-600 text-white',
            'focused-selected': 'border-2 bg-teal-700 text-white ring-2 ring-amber-400 ring-offset-2',
        },
    },
    defaultVariants: { state: 'default' },
});
export function SlotFillingCard({ slotKey, prompt, options, onSelect, onSurprise, className, }) {
    const promptId = useId();
    const [selectedValue, setSelectedValue] = useState(null);
    const [focusedValue, setFocusedValue] = useState(null);
    const [freeTextMode, setFreeTextMode] = useState(false);
    const [freeTextValue, setFreeTextValue] = useState('');
    const timerRef = useRef(null);
    const inputRef = useRef(null);
    useEffect(() => {
        return () => {
            if (timerRef.current != null)
                clearTimeout(timerRef.current);
        };
    }, []);
    function scheduleAdvance(value) {
        if (timerRef.current != null)
            clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            onSelect({ slotKey, value });
        }, 300);
    }
    function immediateAdvance(value) {
        if (timerRef.current != null)
            clearTimeout(timerRef.current);
        onSelect({ slotKey, value });
    }
    function handleChipActivate(value) {
        if (value === 'surprise_me') {
            onSurprise?.({ slotKey });
            return;
        }
        setSelectedValue(value);
        scheduleAdvance(value);
    }
    function handleChipKeyDown(e, value) {
        if (e.key === 'Enter' || e.key === ' ') {
            if (selectedValue === value && value !== 'surprise_me') {
                e.preventDefault();
                immediateAdvance(value);
            }
        }
    }
    function handleContainerKeyDown(e) {
        if (e.key === 'Escape' && !freeTextMode) {
            e.preventDefault();
            if (timerRef.current != null)
                clearTimeout(timerRef.current);
            setFreeTextMode(true);
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }
    function handleTextKeyDown(e) {
        if (e.key === 'Enter' && freeTextValue.trim()) {
            e.preventDefault();
            onSelect({ slotKey, value: freeTextValue.trim() });
        }
    }
    return (_jsxs("div", { role: "radiogroup", "aria-labelledby": promptId, onKeyDown: handleContainerKeyDown, className: cn('flex flex-col gap-3', className), children: [_jsx("p", { id: promptId, className: "text-sm font-medium text-text-base", children: prompt }), !freeTextMode && (_jsx("div", { className: "flex flex-wrap gap-2", children: options.map((opt) => {
                    const isSelected = selectedValue === opt.value;
                    const isFocused = focusedValue === opt.value;
                    const chipState = isSelected && isFocused ? 'focused-selected' :
                        isSelected ? 'selected' : 'default';
                    return (_jsxs("button", { type: "button", role: "radio", "aria-checked": isSelected, onClick: () => handleChipActivate(opt.value), onKeyDown: (e) => handleChipKeyDown(e, opt.value), onFocus: () => setFocusedValue(opt.value), onBlur: () => setFocusedValue(null), className: cn(chipVariants({ state: chipState })), children: [isSelected && _jsx("span", { "aria-hidden": "true", children: "✓" }), opt.label] }, opt.value));
                }) })), freeTextMode && (_jsx("input", { ref: inputRef, type: "text", value: freeTextValue, onChange: (e) => setFreeTextValue(e.target.value), onKeyDown: handleTextKeyDown, "aria-label": prompt, placeholder: "Type your answer…", className: "w-full border border-border rounded-lg px-3 py-2 text-sm text-text-base bg-surface focus:outline-none focus:ring-2 focus:ring-primary" }))] }));
}
