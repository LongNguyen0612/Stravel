import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export const MIN_BUDGET = 200;
export const MAX_BUDGET = 10000;
export const BUDGET_STEP = 100;

const BUDGET_TIERS = [
    { maxExclusive: 1500,    label: 'Budget',    description: 'Covers shared accommodation + local transport' },
    { maxExclusive: 4000,    label: 'Mid-range', description: 'Covers flights + 3★ hotel' },
    { maxExclusive: 7000,    label: 'Premium',   description: 'Covers 4★ hotel + guided tours' },
    { maxExclusive: Infinity, label: 'Luxury',   description: 'Business class + 5★ resort' },
];

export function getBudgetTier(amount) {
    return BUDGET_TIERS.find(t => amount < t.maxExclusive) ?? BUDGET_TIERS[BUDGET_TIERS.length - 1];
}

export function BudgetSliderCard({ slotKey, defaultValue, onChange, onSelect, onSurprise, className }) {
    const [value, setValue] = useState(defaultValue !== undefined ? defaultValue : 2500);
    const [useThisVisible, setUseThisVisible] = useState(false);
    const inactivityRef = useRef(null);

    useEffect(() => {
        inactivityRef.current = setTimeout(() => {
            setUseThisVisible(true);
        }, 1000);
        return () => {
            if (inactivityRef.current !== null) clearTimeout(inactivityRef.current);
        };
    }, []);

    function handleSliderChange(e) {
        const newValue = parseInt(e.target.value, 10);
        setValue(newValue);
        setUseThisVisible(false);
        if (onChange) onChange({ slotKey, value: String(newValue) });
        if (inactivityRef.current !== null) clearTimeout(inactivityRef.current);
        inactivityRef.current = setTimeout(() => {
            setUseThisVisible(true);
        }, 1000);
    }

    const tier = getBudgetTier(value);

    return _jsxs("div", {
        className: cn('flex flex-col gap-3', className),
        children: [
            _jsxs("p", {
                className: "text-center text-sm text-text-muted",
                children: [
                    _jsx("span", {
                        className: "text-lg font-semibold text-teal-700",
                        children: `~$${value.toLocaleString()}`
                    }),
                    ' · ', tier.label, ' · ', tier.description
                ]
            }),
            _jsx("div", {
                "data-testid": "slider-wrapper",
                className: "flex items-center min-h-[44px]",
                children: _jsx("input", {
                    type: "range",
                    min: MIN_BUDGET,
                    max: MAX_BUDGET,
                    step: BUDGET_STEP,
                    value: value,
                    onChange: handleSliderChange,
                    "aria-label": "Budget amount",
                    "aria-valuemin": MIN_BUDGET,
                    "aria-valuemax": MAX_BUDGET,
                    "aria-valuenow": value,
                    "aria-valuetext": `approximately $${value.toLocaleString()} — ${tier.label} — ${tier.description}`,
                    className: cn(
                        'w-full cursor-pointer appearance-none',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                        '[&::-webkit-slider-track]:h-[6px] [&::-webkit-slider-track]:rounded-full [&::-webkit-slider-track]:bg-teal-200',
                        '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[44px] [&::-webkit-slider-thumb]:h-[44px]',
                        '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-600 [&::-webkit-slider-thumb]:cursor-pointer',
                        '[&::-moz-range-track]:h-[6px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-teal-200',
                        '[&::-moz-range-thumb]:w-[44px] [&::-moz-range-thumb]:h-[44px]',
                        '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-teal-600 [&::-moz-range-thumb]:border-0'
                    )
                })
            }),
            useThisVisible && _jsx("button", {
                type: "button",
                onClick: () => onSelect({ slotKey, value: String(value) }),
                className: cn(
                    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full self-center',
                    'bg-teal-600 text-white text-sm font-medium cursor-pointer',
                    'min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    'transition-colors motion-reduce:transition-none'
                ),
                children: `Use this — ${tier.label} budget`
            }),
            onSurprise && _jsx("button", {
                type: "button",
                onClick: () => onSurprise({ slotKey }),
                className: "text-sm text-text-muted underline self-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded",
                children: "Surprise me"
            })
        ]
    });
}
