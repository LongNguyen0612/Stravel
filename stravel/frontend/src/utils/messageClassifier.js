const VIETNAM_DESTINATIONS = [
    'hanoi', 'ho chi minh', 'hcmc', 'saigon', 'da nang', 'danang',
    'hoi an', 'hoian', 'hue', 'phu quoc', 'nha trang', 'nhatrang',
    'dalat', 'da lat', 'sapa', 'mui ne', 'halong', 'ha long',
    'ninh binh', 'can tho', 'vung tau',
];
const DESTINATION_VERBS = [
    'going to', 'travel to', 'visit', 'fly to', 'flying to', 'trip to',
    'heading to', 'want to go to', 'planning to go',
];
const BUDGET_SIGNALS = ['$', 'usd', 'dollar', 'budget', 'spend', 'afford', 'vnd'];
const DATE_SIGNALS = [
    'january', 'february', 'march', 'april', 'june', 'july', 'august',
    'september', 'october', 'november', 'december',
    'jan ', 'feb ', 'mar ', 'apr ', 'jun ', 'jul ', 'aug ', 'sep ', 'oct ', 'nov ', 'dec ',
    'next week', 'next month', 'this weekend', 'weekend',
];
export function classifyMessage(text) {
    const lower = text.toLowerCase();
    if (VIETNAM_DESTINATIONS.some(d => lower.includes(d)))
        return 'specific';
    if (DESTINATION_VERBS.some(v => lower.includes(v)))
        return 'specific';
    if (BUDGET_SIGNALS.some(b => lower.includes(b)))
        return 'specific';
    if (DATE_SIGNALS.some(d => lower.includes(d)))
        return 'specific';
    return 'ambiguous';
}
