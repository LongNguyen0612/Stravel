import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const DOW_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

function daysInMonth(year, month) {
    const days = [];
    const d = new Date(year, month, 1);
    while (d.getMonth() === month) {
        days.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }
    return days;
}

function formatAriaDate(d) {
    const dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
    const month = MONTH_NAMES[d.getMonth()];
    return `${dow}, ${month} ${d.getDate()}, ${d.getFullYear()}`;
}

function buildWeeks(days, firstDow) {
    const cells = [...Array(firstDow).fill(null), ...days];
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}

export function InlineCalendarCard({ slotKey, initialMonth, onSelect, className }) {
    const base = initialMonth ?? new Date();
    const month0 = new Date(base.getFullYear(), base.getMonth(), 1);
    const month1 = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    const [phase, setPhase] = useState('start');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const containerRef = useRef(null);
    const nightCount = startDate && endDate
        ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    function handleDateClick(date) {
        if (phase === 'start') {
            setStartDate(date);
            setEndDate(null);
            setPhase('end');
        } else {
            if (startDate && date > startDate) {
                setEndDate(date);
                setPhase('confirmed');
            } else {
                setStartDate(null);
                setEndDate(null);
                setPhase('start');
            }
        }
    }

    function handleDateKeyDown(e, date) {
        const deltas = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
        if (e.key in deltas) {
            e.preventDefault();
            const target = addDays(date, deltas[e.key]);
            const btn = containerRef.current?.querySelector(`[data-date="${isoDate(target)}"]`);
            btn?.focus();
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleDateClick(date);
        }
    }

    function isSelected(date) {
        if (!startDate) return false;
        const iso = isoDate(date);
        const s = isoDate(startDate);
        const e = endDate ? isoDate(endDate) : null;
        return iso === s || (e !== null && iso >= s && iso <= e);
    }

    function dateClass(date) {
        if (!startDate) return 'hover:bg-surface-2 text-text-base';
        const iso = isoDate(date);
        const s = isoDate(startDate);
        const e = endDate ? isoDate(endDate) : null;
        if (iso === s || iso === e) return 'bg-teal-600 text-white';
        if (e !== null && iso > s && iso < e) return 'bg-teal-100 text-teal-900';
        return 'hover:bg-surface-2 text-text-base';
    }

    function isFocusTarget(date, month) {
        if (startDate && isoDate(startDate) === isoDate(date)) return true;
        if (!startDate && isoDate(month) === isoDate(month0)) {
            const days = daysInMonth(month.getFullYear(), month.getMonth());
            return isoDate(days[0]) === isoDate(date);
        }
        return false;
    }

    function renderMonth(month) {
        const year = month.getFullYear();
        const m = month.getMonth();
        const days = daysInMonth(year, m);
        const firstDow = days[0].getDay();
        const monthLabel = `${MONTH_NAMES[m]} ${year}`;
        const weeks = buildWeeks(days, firstDow);
        return _jsxs("div", {
            children: [
                _jsx("p", { className: "text-sm font-semibold text-center mb-2", children: monthLabel }),
                _jsxs("div", {
                    role: "grid",
                    "aria-label": monthLabel,
                    children: [
                        _jsx("div", {
                            role: "row",
                            className: "grid grid-cols-7 text-xs text-text-muted text-center mb-1",
                            children: DOW_HEADERS.map(d => _jsx("span", { role: "columnheader", "aria-label": d, children: d }, d))
                        }),
                        weeks.map((week, wi) => _jsx("div", {
                            role: "row",
                            className: "grid grid-cols-7",
                            children: week.map((day, di) => day === null
                                ? _jsx("span", { role: "gridcell" }, di)
                                : _jsx("button", {
                                    type: "button",
                                    role: "gridcell",
                                    "data-date": isoDate(day),
                                    "aria-label": formatAriaDate(day),
                                    "aria-selected": isSelected(day),
                                    tabIndex: isFocusTarget(day, month) ? 0 : -1,
                                    onClick: () => handleDateClick(day),
                                    onKeyDown: (e) => handleDateKeyDown(e, day),
                                    className: cn(
                                        'rounded-full text-xs text-center transition-colors',
                                        'min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                                        'motion-reduce:transition-none',
                                        dateClass(day)
                                    ),
                                    children: day.getDate()
                                }, isoDate(day))
                            )
                        }, wi))
                    ]
                })
            ]
        }, monthLabel);
    }

    return _jsxs("div", {
        ref: containerRef,
        className: cn('flex flex-col gap-4', className),
        children: [
            _jsx("div", {
                className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
                children: [renderMonth(month0), renderMonth(month1)]
            }),
            startDate && _jsx("p", {
                className: "text-sm text-center text-text-muted",
                children: `Nights: ${nightCount !== null ? nightCount : '—'}`
            }),
            phase === 'confirmed' && nightCount !== null && startDate && endDate && _jsx("button", {
                type: "button",
                className: cn(
                    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full self-center',
                    'bg-teal-600 text-white text-sm font-medium cursor-pointer',
                    'min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    'transition-colors motion-reduce:transition-none'
                ),
                onClick: () => onSelect({ slotKey, value: `${isoDate(startDate)},${isoDate(endDate)}`, nightCount }),
                children: `Confirm ${nightCount} nights`
            })
        ]
    });
}
