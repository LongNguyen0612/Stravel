import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { CompletenessIndicator } from './CompletenessIndicator';
import { cardDisplayState } from './cardUtils';
const STALL_TIMEOUT_MS = 90_000;
const CARD_ICONS = {
    flight: '✈️',
    hotel: '🏨',
    activities: '🎯',
    visa: '🛂',
};
const cardVariants = cva('relative rounded-xl border p-4 touch-pan-y', {
    variants: {
        state: {
            nascent: 'border-border bg-surface-2 pointer-events-none scale-[0.98]',
            forming: 'border-amber-200 bg-surface scale-[0.98] transition-card-settle',
            settled: 'border-slate-200 bg-surface scale-100 shadow-md transition-card-settle',
            error: 'border-status-pending bg-amber-50',
        },
    },
});
function ShimmerField({ shimmerEnabled }) {
    return (_jsx("div", { className: cn('h-4 rounded bg-gradient-to-r from-surface via-surface-2 to-surface bg-[length:200%_100%]', shimmerEnabled ? 'animate-shimmer' : '', shimmerEnabled ? 'will-change-transform' : '') }));
}
function FlightFields({ data, isSettled, }) {
    return (_jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "From" }), _jsx("p", { className: "font-medium", children: data.origin ?? '—' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "To" }), _jsx("p", { className: "font-medium", children: data.destination ?? '—' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Depart" }), _jsx("p", { children: data.departDate ?? '—' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Return" }), _jsx("p", { children: data.returnDate ?? '—' })] }), isSettled && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Airline" }), _jsx("p", { children: data.airline ?? '—' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Price" }), _jsx("p", { children: data.price != null ? `$${data.price}` : '—' })] }), _jsxs("div", { className: "col-span-2", children: [_jsx("span", { className: "text-text-muted text-xs", children: "Times" }), _jsx("p", { children: data.flightTimes ?? '—' })] })] }))] }));
}
function HotelFields({ data, isSettled, }) {
    return (_jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Neighborhood" }), _jsx("p", { className: "font-medium", children: data.neighborhood ?? '—' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Stars" }), _jsx("p", { children: data.starRange ?? '—' })] }), isSettled && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Name" }), _jsx("p", { children: data.name ?? '—' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Nightly Rate" }), _jsx("p", { children: data.nightlyRate != null ? `$${data.nightlyRate}` : '—' })] })] }))] }));
}
function ActivityFields({ data, isSettled, }) {
    return (_jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Category" }), _jsx("p", { className: "font-medium", children: data.category ?? '—' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Zone" }), _jsx("p", { children: data.cityZone ?? '—' })] }), isSettled && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Venue" }), _jsx("p", { children: data.venue ?? '—' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Hours" }), _jsx("p", { children: data.hours ?? '—' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Cost" }), _jsx("p", { children: data.cost != null ? `$${data.cost}` : '—' })] })] }))] }));
}
function VisaFields({ data, isSettled, }) {
    return (_jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Destination" }), _jsx("p", { className: "font-medium", children: data.destinationCountry ?? '—' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Nationality" }), _jsx("p", { children: data.nationality ?? '—' })] }), isSettled && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Processing Time" }), _jsx("p", { children: data.processingTime ?? '—' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted text-xs", children: "Fee" }), _jsx("p", { children: data.fee != null ? `$${data.fee}` : '—' })] })] }))] }));
}
export function TravelCard({ cardId: _cardId, cardType, completenessScore, isFinal, delta, deckState, shimmerEnabled = true, onEdit, onBook, onRetry, className, }) {
    const [isStalled, setIsStalled] = useState(false);
    const lastScoreRef = useRef(completenessScore);
    useEffect(() => {
        if (completenessScore !== lastScoreRef.current) {
            lastScoreRef.current = completenessScore;
            setIsStalled(false);
        }
    }, [completenessScore]);
    useEffect(() => {
        const state = cardDisplayState(completenessScore, isFinal);
        if (state !== 'nascent')
            return;
        const timer = setTimeout(() => setIsStalled(true), STALL_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [completenessScore, isFinal]);
    const displayState = isStalled
        ? 'error'
        : cardDisplayState(completenessScore, isFinal);
    const pct = Math.round(completenessScore * 100);
    const isSettled = displayState === 'settled';
    const isNascent = displayState === 'nascent';
    const isCommittingSettled = isSettled && deckState === 'committing';
    return (_jsxs("div", { role: "article", "aria-label": `${cardType} card, ${pct}% complete`, className: cn(cardVariants({ state: displayState }), className), children: [_jsxs("span", { className: "sr-only", "aria-live": "polite", children: [pct, "% complete"] }), _jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { "aria-hidden": "true", children: CARD_ICONS[cardType] }), _jsx("span", { className: "font-semibold capitalize text-text-base", children: cardType })] }), _jsx(CompletenessIndicator, { score: completenessScore, state: displayState, className: "w-20" })] }), isNascent ? (_jsxs("div", { className: "space-y-2", children: [_jsx(ShimmerField, { shimmerEnabled: shimmerEnabled }), _jsx(ShimmerField, { shimmerEnabled: shimmerEnabled }), _jsx(ShimmerField, { shimmerEnabled: shimmerEnabled })] })) : displayState === 'error' ? (_jsxs("div", { className: "py-2 text-sm text-text-muted", children: [_jsx("p", { children: "Taking longer than expected" }), _jsx("button", { className: "mt-2 px-3 py-1 rounded border border-status-pending text-status-pending text-xs hover:bg-amber-50", onClick: onRetry, children: "Try again" })] })) : (_jsxs(_Fragment, { children: [cardType === 'flight' && (_jsx(FlightFields, { data: delta, isSettled: isSettled })), cardType === 'hotel' && (_jsx(HotelFields, { data: delta, isSettled: isSettled })), cardType === 'activities' && (_jsx(ActivityFields, { data: delta, isSettled: isSettled })), cardType === 'visa' && (_jsx(VisaFields, { data: delta, isSettled: isSettled }))] })), isSettled && (_jsxs("div", { className: "flex items-center justify-end gap-2 mt-3", children: [onEdit && (_jsx("button", { className: "text-xs text-text-muted hover:text-text-base", onClick: onEdit, "aria-label": `Edit ${cardType} card`, children: "\u270F\uFE0F Edit" })), isCommittingSettled && onBook && (_jsx("button", { className: "px-3 py-1 text-xs rounded bg-primary text-white", onClick: onBook, children: "Book" }))] })), (displayState === 'forming' || isSettled) && (_jsxs("div", { className: "mt-2 text-xs text-text-muted", children: [pct, "% complete"] }))] }));
}
