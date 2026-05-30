import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const chipVariants = cva(
    'inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium cursor-pointer transition-all motion-reduce:transition-none select-none min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    {
        variants: {
            state: {
                default: 'border-border bg-surface text-text-base hover:bg-surface-2',
                selected: 'border-transparent bg-teal-600 text-white hover:bg-teal-700',
            },
        },
        defaultVariants: { state: 'default' },
    }
);

export function MultiSelectCard({ slotKey, prompt, options, onSelect, onSurprise, className }) {
    const [selectedValues, setSelectedValues] = useState([]);

    function handleChipToggle(value) {
        if (value === 'no_restrictions') {
            setSelectedValues([]);
            return;
        }
        setSelectedValues(prev =>
            prev.includes(value)
                ? prev.filter(v => v !== value)
                : [...prev.filter(v => v !== 'no_restrictions'), value]
        );
    }

    function handleDone() {
        onSelect({ slotKey, value: selectedValues });
    }

    const noRestrictionsSelected = selectedValues.length === 0;

    return _jsxs("div", {
        role: "group",
        "aria-label": prompt,
        className: cn('flex flex-col gap-3', className),
        children: [
            _jsx("p", {
                className: "text-sm font-medium text-text-base",
                children: prompt
            }),
            _jsxs("div", {
                className: "flex flex-wrap gap-2",
                children: [
                    _jsxs("button", {
                        type: "button",
                        role: "checkbox",
                        "aria-checked": noRestrictionsSelected,
                        onClick: () => handleChipToggle('no_restrictions'),
                        className: cn(chipVariants({ state: noRestrictionsSelected ? 'selected' : 'default' })),
                        children: [
                            noRestrictionsSelected && _jsx("span", { "aria-hidden": "true", children: "✓" }),
                            "No restrictions"
                        ]
                    }),
                    ...options.map(opt => {
                        const isSelected = selectedValues.includes(opt.value);
                        return _jsxs("button", {
                            type: "button",
                            role: "checkbox",
                            "aria-checked": isSelected,
                            onClick: () => handleChipToggle(opt.value),
                            className: cn(chipVariants({ state: isSelected ? 'selected' : 'default' })),
                            children: [
                                isSelected && _jsx("span", { "aria-hidden": "true", children: "✓" }),
                                opt.label
                            ]
                        }, opt.value);
                    })
                ]
            }),
            _jsxs("div", {
                className: "flex items-center gap-2 flex-wrap",
                children: [
                    _jsx("button", {
                        type: "button",
                        onClick: handleDone,
                        className: cn(
                            'inline-flex items-center justify-center px-4 py-2 rounded-full',
                            'bg-teal-600 text-white text-sm font-medium cursor-pointer',
                            'min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                            'transition-colors motion-reduce:transition-none'
                        ),
                        children: "Done"
                    }),
                    onSurprise && _jsx("button", {
                        type: "button",
                        onClick: () => onSurprise({ slotKey }),
                        className: "text-sm text-text-muted underline self-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded",
                        children: "Surprise me"
                    })
                ]
            })
        ]
    });
}
