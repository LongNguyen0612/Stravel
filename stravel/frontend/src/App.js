import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useReducer, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { CopilotLayout } from "./components/b2b/CopilotLayout";
import { CopilotSidebar } from "./components/b2b/CopilotSidebar";
import { B2CLayout, CardDeckZone, ChatInput, ConversationCanvas } from "./components/layout";
import { TravelCard } from "./components/cards";
import { SlotFillingCard } from "./components/cards/SlotFillingCard";
import { DestinationCardsCard } from "./components/cards/DestinationCardsCard";
import { InlineCalendarCard } from "./components/cards/InlineCalendarCard";
import { BudgetSliderCard, getBudgetTier } from "./components/cards/BudgetSliderCard";
import { MultiSelectCard } from "./components/cards/MultiSelectCard";
import { PassportUploadCard } from "./components/cards/PassportUploadCard";
import { ProfileVerificationCard } from "./components/cards/ProfileVerificationCard";
import { classifyMessage } from "./utils/messageClassifier";
import { streamReducer, initialStreamState } from "./reducers/streamReducer";
import { SessionList } from "./components/b2b/SessionList";
import { SessionPanel } from "./components/b2b/SessionPanel";
import { MessageBubble } from "./components/shared/MessageBubble";
import { TypingIndicator } from "./components/shared/TypingIndicator";
import { useFooterHeight } from "./hooks/useFooterHeight";
import { useStreamContext } from "./hooks/useStreamContext";
import { api } from "./services/apiClient";
// ─── Auth ─────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
    const [email, setEmail] = useState("admin@stravel.com");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const data = await api.auth.login(email, password);
            localStorage.setItem("token", data.access_token);
            onLogin(data.access_token);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f5f7fa" }, children: _jsxs("div", { style: { background: "#fff", padding: "2.5rem", borderRadius: "12px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: "380px" }, children: [_jsxs("div", { style: { textAlign: "center", marginBottom: "2rem" }, children: [_jsx("div", { style: { fontSize: "28px", marginBottom: "4px" }, children: "\u2708\uFE0F" }), _jsx("h2", { style: { fontSize: "22px", fontWeight: 700, color: "#1f2937" }, children: "STravel Advisory" }), _jsx("p", { style: { color: "#6b7280", fontSize: "14px", marginTop: "4px" }, children: "Sign in to your account" })] }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { style: { marginBottom: "14px" }, children: [_jsx("label", { style: { display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }, children: "Email" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, style: { width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" } })] }), _jsxs("div", { style: { marginBottom: "20px" }, children: [_jsx("label", { style: { display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }, children: "Password" }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true, style: { width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" } })] }), error && _jsx("p", { style: { color: "#dc2626", marginBottom: "14px", fontSize: "13px" }, children: error }), _jsx("button", { type: "submit", disabled: loading, style: { width: "100%", padding: "11px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }, children: loading ? "Signing in..." : "Sign in" })] })] }) }));
}
// ─── Session List ──────────────────────────────────────────────────────────────
function SessionListPage({ onLogout }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const navigate = useNavigate();
    useEffect(() => {
        api.sessions.list().then((r) => { setSessions(r.items); setLoading(false); });
    }, []);
    async function handleCreate() {
        setCreating(true);
        try {
            const session = await api.sessions.create();
            navigate(`/sessions/${session.id}`);
        }
        finally {
            setCreating(false);
        }
    }
    async function handleArchive(id) {
        await api.sessions.archive(id);
        setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: "archived" } : s));
    }
    return (_jsxs("div", { style: { minHeight: "100vh", background: "#f5f7fa" }, children: [_jsxs("div", { style: { background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "56px" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [_jsx("span", { style: { fontSize: "20px" }, children: "\u2708\uFE0F" }), _jsx("span", { style: { fontWeight: 700, fontSize: "16px" }, children: "STravel Advisory" })] }), _jsxs("div", { style: { display: "flex", gap: "12px", alignItems: "center" }, children: [_jsx("button", { onClick: handleCreate, disabled: creating, style: { padding: "8px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "14px", cursor: "pointer" }, children: creating ? "Creating..." : "+ New Session" }), _jsx("button", { onClick: onLogout, style: { padding: "8px 14px", background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "14px", cursor: "pointer" }, children: "Logout" })] })] }), _jsxs("div", { style: { maxWidth: "800px", margin: "0 auto", padding: "32px 24px" }, children: [_jsx("h1", { style: { fontSize: "22px", fontWeight: 700, marginBottom: "24px" }, children: "Advisory Sessions" }), loading ? (_jsx("p", { style: { color: "#6b7280" }, children: "Loading..." })) : sessions.length === 0 ? (_jsxs("div", { style: { textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb" }, children: [_jsx("div", { style: { fontSize: "40px", marginBottom: "12px" }, children: "\uD83D\uDDC2\uFE0F" }), _jsx("p", { style: { color: "#6b7280", marginBottom: "16px" }, children: "No sessions yet. Create your first one." }), _jsx("button", { onClick: handleCreate, style: { padding: "10px 24px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }, children: "Create Session" })] })) : (_jsx("div", { style: { background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" }, children: _jsx(SessionList, { sessions: sessions, onSelect: (s) => navigate(`/sessions/${s.id}`), onArchive: handleArchive }) }))] })] }));
}
// ─── Copilot Page ──────────────────────────────────────────────────────────────
function CopilotPage({ onLogout }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const { state, connect } = useStreamContext();
    useEffect(() => {
        if (!id)
            return;
        api.sessions.get(id).then((s) => {
            setSession(s);
            setLoading(false);
            connect(s.id);
        }).catch(() => navigate("/sessions"));
    }, [id, connect, navigate]);
    async function handleProfileSave(data) {
        if (!session)
            return;
        const updated = await api.profile.update(session.id, data);
        setSession((s) => s ? { ...s, traveler_profile: updated } : s);
    }
    async function handleRun() {
        if (!session)
            return;
        await api.sessions.run(session.id);
    }
    return (_jsxs("div", { style: { height: "100vh", display: "flex", flexDirection: "column" }, children: [_jsxs("div", { style: { background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "56px", flexShrink: 0 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [_jsx("button", { onClick: () => navigate("/sessions"), style: { background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "14px", padding: "4px" }, children: "\u2190 Sessions" }), _jsx("span", { style: { color: "#e5e7eb" }, children: "|" }), _jsx("span", { style: { fontSize: "20px" }, children: "\u2708\uFE0F" }), _jsx("span", { style: { fontWeight: 700, fontSize: "16px" }, children: "STravel Advisory" })] }), _jsx("button", { onClick: onLogout, style: { padding: "6px 14px", background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "14px", cursor: "pointer" }, children: "Logout" })] }), state.ssePhase === "error" && session && (_jsxs("div", { style: { background: "#fef2f2", borderBottom: "1px solid #fca5a5", padding: "8px 24px", display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", color: "#dc2626" }, children: [_jsx("span", { children: "Connection lost." }), _jsx("button", { onClick: () => connect(session.id), style: { padding: "4px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "4px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }, children: "Reconnect" })] })), loading ? (_jsx("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "#6b7280" }, children: "Loading session..." })) : session ? (_jsx("div", { style: { flex: 1, overflow: "hidden" }, children: _jsx(CopilotLayout, { sessionPanel: _jsx(SessionPanel, { session: session, onProfileSave: handleProfileSave, onRun: handleRun }), sidebar: _jsx(CopilotSidebar, { state: state }) }) })) : null] }));
}
// ─── Demo Page constants ───────────────────────────────────────────────────────
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// P3: guard against null/malformed input before splitting
function formatDateForDisplay(iso) {
    if (!iso || !DATE_REGEX.test(iso)) return iso;
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
}
const MOOD_BUDGET_MIDPOINTS = {
    adventure: 2000, relaxation: 3500, culture: 1800, foodie: 2000, romance: 3500,
};
const EDIT_SLOT_OPTIONS = [
    { label: 'Destination', value: 'destination' },
    { label: 'Dates', value: 'travel_dates' },
    { label: 'Budget', value: 'budget' },
    { label: 'Dietary', value: 'dietary' },
    { label: 'Passport expiry', value: 'passport_expiry' },
];
const DIETARY_OPTIONS = [
    { label: 'Vegetarian', value: 'vegetarian' },
    { label: 'Vegan', value: 'vegan' },
    { label: 'Halal', value: 'halal' },
    { label: 'Kosher', value: 'kosher' },
    { label: 'Gluten free', value: 'gluten_free' },
    { label: 'Nut allergy', value: 'nut_allergy' },
];
const MOOD_ACTIVITY_DEFAULTS = {
    adventure: ['hiking', 'kayaking', 'rock_climbing'],
    relaxation: ['spa', 'beach', 'yoga'],
    culture: ['museums', 'cooking_class', 'heritage_tour'],
    foodie: ['cooking_class', 'street_food_tour', 'wine_tasting'],
    romance: ['sunset_cruise', 'spa', 'fine_dining'],
    default: ['sightseeing', 'local_food', 'day_trip'],
};
const MOOD_OPTIONS = [
    { label: 'Adventure', value: 'adventure' },
    { label: 'Relaxation', value: 'relaxation' },
    { label: 'Culture', value: 'culture' },
    { label: 'Foodie', value: 'foodie' },
    { label: 'Romance', value: 'romance' },
    { label: 'Surprise me', value: 'surprise_me' },
];
const MOOD_LABELS = {
    adventure: 'Adventure',
    relaxation: 'Relaxation',
    culture: 'Culture',
    foodie: 'Foodie',
    romance: 'Romance',
};
const MOOD_VALUES = MOOD_OPTIONS
    .filter(opt => opt.value !== 'surprise_me')
    .map(opt => opt.value);
const DESTINATION_OPTIONS = [
    { value: 'hoi_an', label: 'Hội An', description: 'Lantern-lit ancient town with tailors and beach bikes', costTier: 'mid-range' },
    { value: 'hanoi', label: 'Hà Nội', description: 'Chaotic capital with street food and French heritage', costTier: 'budget' },
    { value: 'phu_quoc', label: 'Phú Quốc', description: 'Island paradise with clear water and beach clubs', costTier: 'premium' },
    { value: 'hue', label: 'Huế', description: 'Imperial citadel, royal tombs, and river boat dining', costTier: 'budget' },
    { value: 'da_nang', label: 'Đà Nẵng', description: 'Dragon bridges, marble mountains, and surf beaches', costTier: 'mid-range' },
];
export function DemoPage() {
    const [messages, setMessages] = useState([
        { role: "assistant", content: "Hi! Where are you dreaming of going in Vietnam?" },
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [sentinelText, setSentinelText] = useState("");
    const [errorSentinelText, setErrorSentinelText] = useState("");
    const [sessionId, setSessionId] = useState(null);
    const [demoScore, setDemoScore] = useState(0.1);
    const [agentMode, setAgentMode] = useState(() => localStorage.getItem("stravel_agent_mode") === "true");
    const [streamState, dispatchStream] = useReducer(streamReducer, initialStreamState);
    const [moodCardVisible, setMoodCardVisible] = useState(false);
    const [destinationCardVisible, setDestinationCardVisible] = useState(false);
    const [calendarCardVisible, setCalendarCardVisible] = useState(false);
    const [budgetCardVisible, setBudgetCardVisible] = useState(false);
    const [dietaryCardVisible, setDietaryCardVisible] = useState(false);
    const [passportCardVisible, setPassportCardVisible] = useState(false);
    const [verificationCardVisible, setVerificationCardVisible] = useState(false);
    const [editSlotMenuVisible, setEditSlotMenuVisible] = useState(false);
    const [editingSlot, setEditingSlot] = useState(null);
    const [firstMessageSent, setFirstMessageSent] = useState(false);
    const chatInputRef = useRef(null);
    const cardDeckRef = useRef(null);
    const chatInputHeight = useFooterHeight([chatInputRef]);
    const footerHeight = useFooterHeight([chatInputRef, cardDeckRef]);
    const ariaPhase = isLoading ? 'off' : hasError ? 'assertive' : 'polite';
    const handleToggleMode = () => {
        const next = !agentMode;
        localStorage.setItem("stravel_agent_mode", String(next));
        setAgentMode(next);
    };
    const handleSend = async (message) => {
        // AC3: user types while mood card showing → destination bypass
        if (moodCardVisible) {
            setMessages(prev => [...prev, { role: 'user', content: message }]);
            setMoodCardVisible(false);
            dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey: 'destination', value: message } });
            setMessages(prev => [...prev, { role: 'assistant', content: `Got it — I'll look at trips around ${message}.` }]);
            setSentinelText("Message received.");
            return;
        }
        // AC1 / AC6: classify first message
        const isFirst = !firstMessageSent;
        if (isFirst)
            setFirstMessageSent(true);
        if (isFirst && classifyMessage(message) === 'ambiguous') {
            setMessages(prev => [...prev, { role: 'user', content: message }]);
            setMessages(prev => [...prev, { role: 'assistant', content: 'How are you feeling about this trip?' }]);
            setMoodCardVisible(true);
            return;
        }
        // Normal API path
        setIsLoading(true);
        setHasError(false);
        setSentinelText("");
        setErrorSentinelText("");
        setMessages((prev) => [...prev, { role: "user", content: message }]);
        setMessages((prev) => [...prev, { role: "stage-narrator", content: "🤖 Thinking about your trip…" }]);
        try {
            let sid = sessionId;
            if (!sid) {
                const resp = await fetch("/api/v1/demo/sessions", { method: "POST" });
                if (!resp.ok)
                    throw new Error(`Session create failed: ${resp.status}`);
                const data = await resp.json();
                sid = data.session_id;
                setSessionId(sid);
            }
            const chatResp = await fetch(`/api/v1/demo/sessions/${sid}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
            });
            if (!chatResp.ok)
                throw new Error(`Chat request failed: ${chatResp.status}`);
            const chatData = await chatResp.json();
            setMessages((prev) => [...prev, { role: "assistant", content: chatData.reply ?? "" }]);
            setSentinelText("Message received.");
        }
        catch {
            setHasError(true);
            setErrorSentinelText("Something went wrong.");
            setMessages((prev) => {
                const last = prev[prev.length - 1];
                const base = last?.role === "stage-narrator" ? prev.slice(0, -1) : prev;
                return [...base, { role: "assistant", content: "Something went wrong. Please try again." }];
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleMoodSelect = ({ slotKey, value }) => {
        dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
        setMoodCardVisible(false);
        setDestinationCardVisible(true);
        setMessages(prev => [
            ...prev,
            { role: 'user', content: MOOD_LABELS[value] ?? value },
            { role: 'assistant', content: "Great — let me suggest some places that match that vibe." },
        ]);
    };
    const handleMoodSurprise = ({ slotKey }) => {
        const randomMood = MOOD_VALUES[Math.floor(Math.random() * MOOD_VALUES.length)];
        const moodLabel = MOOD_LABELS[randomMood] ?? randomMood;
        dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value: randomMood } });
        setMoodCardVisible(false);
        setDestinationCardVisible(true);
        setMessages(prev => [
            ...prev,
            { role: 'user', content: 'Surprise me' },
            { role: 'assistant', content: `I picked ${moodLabel} for you — let me suggest destinations with that in mind.` },
        ]);
    };
    const handleDestinationSelect = ({ slotKey, value, label }) => {
        dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
        setDestinationCardVisible(false);
        if (editingSlot === 'destination') {
            setEditingSlot(null);
            setMessages(prev => [...prev, { role: 'user', content: label }]);
            setVerificationCardVisible(true);
            return;
        }
        setCalendarCardVisible(true);
        setMessages(prev => [
            ...prev,
            { role: 'user', content: label },
            { role: 'assistant', content: `Great choice! ${label} it is — when are you planning to travel?` },
        ]);
    };
    const handleDestinationSurprise = ({ slotKey }) => {
        const randomOpt = DESTINATION_OPTIONS[Math.floor(Math.random() * DESTINATION_OPTIONS.length)];
        dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value: randomOpt.value } });
        setDestinationCardVisible(false);
        if (editingSlot === 'destination') {
            setEditingSlot(null);
            setMessages(prev => [...prev, { role: 'user', content: 'Surprise me' }]);
            setVerificationCardVisible(true);
            return;
        }
        setCalendarCardVisible(true);
        setMessages(prev => [
            ...prev,
            { role: 'user', content: 'Surprise me' },
            { role: 'assistant', content: `Great choice! ${randomOpt.label} it is — when are you planning to travel?` },
        ]);
    };
    const handleCalendarConfirm = ({ slotKey, value, nightCount }) => {
        dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
        setCalendarCardVisible(false);
        const [startStr, endStr] = value.split(',');
        const fmtDate = (s) =>
            new Date(s + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const userBubble = `${fmtDate(startStr)} – ${fmtDate(endStr)} · ${nightCount} night${nightCount === 1 ? '' : 's'}`;
        if (editingSlot === 'travel_dates') {
            setEditingSlot(null);
            setMessages(prev => [...prev, { role: 'user', content: userBubble }]);
            setVerificationCardVisible(true);
            return;
        }
        setBudgetCardVisible(true);
        setMessages(prev => [
            ...prev,
            { role: 'user', content: userBubble },
            { role: 'assistant', content: `${nightCount} nights — noted! What's your total budget for this trip?` },
        ]);
    };
    const handleBudgetChange = ({ slotKey, value }) => {
        dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
    };
    const handleBudgetSelect = ({ slotKey, value }) => {
        dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
        setBudgetCardVisible(false);
        const amount = parseInt(value, 10);
        const tier = getBudgetTier(amount);
        const userBubble = `USD ${amount.toLocaleString()} · ${tier.label}`;
        if (editingSlot === 'budget') {
            setEditingSlot(null);
            setMessages(prev => [...prev, { role: 'user', content: userBubble }]);
            setVerificationCardVisible(true);
            return;
        }
        setDietaryCardVisible(true);
        setMessages(prev => [
            ...prev,
            { role: 'user', content: userBubble },
            { role: 'assistant', content: `${tier.label} budget — I'm starting on your plan now.` },
            { role: 'assistant', content: `Almost done! Any dietary requirements I should know about?` },
        ]);
    };
    const handleBudgetSurprise = ({ slotKey }) => {
        const moodVal = streamState.slotState.mood;
        const mood = (typeof moodVal === 'string' ? moodVal : '').toLowerCase();
        const amount = MOOD_BUDGET_MIDPOINTS[mood] ?? 2500;
        dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value: String(amount) } });
        setBudgetCardVisible(false);
        const tier = getBudgetTier(amount);
        if (editingSlot === 'budget') {
            setEditingSlot(null);
            setMessages(prev => [...prev, { role: 'user', content: 'Surprise me' }]);
            setVerificationCardVisible(true);
            return;
        }
        setDietaryCardVisible(true);
        setMessages(prev => [
            ...prev,
            { role: 'user', content: 'Surprise me' },
            { role: 'assistant', content: `Based on your vibe I'm setting your budget to USD ${amount.toLocaleString()} — ${tier.label}. That should cover everything nicely.` },
            { role: 'assistant', content: `Almost done! Any dietary requirements I should know about?` },
        ]);
    };
    const handleDietarySelect = ({ slotKey, value }) => {
        dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
        setDietaryCardVisible(false);
        const labels = value.map(v => DIETARY_OPTIONS.find(o => o.value === v)?.label ?? v);
        const userMsg = labels.length === 0 ? 'No dietary restrictions' : labels.join(', ');
        const botMsg = labels.length === 0 ? 'Noted — no restrictions.' :
            labels.length === 1 ? `Got it — ${labels[0]}.` :
            `Noted — ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}.`;
        if (editingSlot === 'dietary') {
            setEditingSlot(null);
            setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
            setVerificationCardVisible(true);
            return;
        }
        setPassportCardVisible(true);
        setMessages(prev => [
            ...prev,
            { role: 'user', content: userMsg },
            { role: 'assistant', content: botMsg },
            { role: 'assistant', content: "Almost there! Could you snap or upload a photo of your passport? I'll read the expiry date automatically." },
        ]);
    };
    const handlePassportSelect = ({ slotKey, value }) => {
        dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
        setPassportCardVisible(false);
        if (editingSlot === 'passport_expiry') {
            setEditingSlot(null);
            setMessages(prev => [...prev, { role: 'user', content: `Passport expiry: ${formatDateForDisplay(value)}` }]);
            setVerificationCardVisible(true);
            return;
        }
        setMessages(prev => [
            ...prev,
            { role: 'user', content: `Passport expiry: ${formatDateForDisplay(value)}` },
            { role: 'assistant', content: "Got it — I'll check your passport is valid for the trip." },
            { role: 'assistant', content: "Here's what I've got — does everything look right?" },
        ]);
        setVerificationCardVisible(true);
    };
    const handlePassportSkip = ({ slotKey }) => {
        dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value: 'skipped' } });
        setPassportCardVisible(false);
        if (editingSlot === 'passport_expiry') {
            setEditingSlot(null);
            setMessages(prev => [...prev, { role: 'user', content: 'Skip passport' }]);
            setVerificationCardVisible(true);
            return;
        }
        setMessages(prev => [
            ...prev,
            { role: 'assistant', content: "No problem — just note that compliance checks may be incomplete without your passport details." },
            { role: 'assistant', content: "Here's what I've got — does everything look right?" },
        ]);
        setVerificationCardVisible(true);
    };
    const computeVerificationItems = () => {
        const items = [];
        const ss = streamState.slotState;
        if (ss.destination) {
            const dest = DESTINATION_OPTIONS.find(o => o.value === ss.destination);
            items.push({ icon: '📍', label: 'Destination', value: dest?.label ?? String(ss.destination) });
        }
        if (ss.travel_dates && typeof ss.travel_dates === 'string') {
            const [start, end] = ss.travel_dates.split(',');
            if (start && end) {
                const fmtDate = (s) => new Date(s + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                const nights = Math.round((new Date(end + 'T00:00').getTime() - new Date(start + 'T00:00').getTime()) / 86400000);
                items.push({ icon: '📅', label: 'Dates', value: `${fmtDate(start)} – ${fmtDate(end)} · ${nights} night${nights === 1 ? '' : 's'}` });
            }
        }
        if (ss.budget) {
            const amount = parseInt(String(ss.budget), 10);
            if (!isNaN(amount)) items.push({ icon: '💰', label: 'Budget', value: `~$${amount.toLocaleString()}` });
        }
        if (ss.dietary !== undefined) {
            const vals = Array.isArray(ss.dietary) ? ss.dietary : [];
            const labels = vals.map(v => DIETARY_OPTIONS.find(o => o.value === v)?.label ?? v);
            items.push({ icon: '🍽️', label: 'Dietary', value: labels.length ? labels.join(', ') : 'No restrictions' });
        }
        if (ss.passport_expiry) {
            const val = String(ss.passport_expiry);
            items.push({ icon: '🛂', label: 'Passport expiry', value: val === 'skipped' ? 'Skipped' : formatDateForDisplay(val) });
        }
        return items;
    };
    const handleVerificationConfirm = () => {
        setVerificationCardVisible(false);
        setMessages(prev => [
            ...prev,
            { role: 'user', content: 'Looks good — build my trip!' },
            { role: 'assistant', content: "Starting your proposal… I'll analyse your requirements and put together a trip." },
        ]);
        dispatchStream({ type: 'STAGE_CHANGE', payload: 'profiling' });
    };
    const handleVerificationEdit = () => {
        setEditingSlot(null);
        setVerificationCardVisible(false);
        setEditSlotMenuVisible(true);
        setMessages(prev => [...prev, { role: 'assistant', content: "Sure — which part would you like to change?" }]);
    };
    const handleEditFieldSelect = ({ value }) => {
        const slotToEdit = value;
        setEditingSlot(slotToEdit);
        setEditSlotMenuVisible(false);
        switch (slotToEdit) {
            case 'destination': setDestinationCardVisible(true); break;
            case 'travel_dates': setCalendarCardVisible(true); break;
            case 'budget': setBudgetCardVisible(true); break;
            case 'dietary': setDietaryCardVisible(true); break;
            case 'passport_expiry': setPassportCardVisible(true); break;
            default: setEditingSlot(null); break;
        }
    };
    const sentinelStyle = { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" };
    return (_jsxs(_Fragment, { children: [_jsx("div", { role: "status", "aria-live": "polite", "aria-atomic": "true", "data-testid": "aria-sentinel", style: sentinelStyle, children: sentinelText }), _jsx("div", { role: "status", "aria-live": "assertive", "aria-atomic": "true", "data-testid": "aria-sentinel-error", style: sentinelStyle, children: errorSentinelText }), agentMode ? (_jsxs("div", { style: { padding: "40px", textAlign: "center", fontFamily: "sans-serif" }, children: [_jsxs("p", { style: { marginBottom: "16px" }, children: ["B2B Agent Mode \u2014 ", _jsx("a", { href: "/sessions", children: "Open Advisory Sessions" })] }), _jsx("button", { onClick: handleToggleMode, style: { padding: "8px 16px", cursor: "pointer" }, children: "Switch to Chat Mode" })] })) : (_jsxs(B2CLayout, { children: [_jsx("div", { style: { padding: "8px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end" }, children: _jsx("button", { onClick: handleToggleMode, style: { padding: "4px 10px", fontSize: "12px", color: "#6b7280", background: "none", border: "1px solid #e5e7eb", borderRadius: "4px", cursor: "pointer" }, "data-testid": "agent-mode-toggle", children: "Agent Mode" }) }), _jsxs(ConversationCanvas, { paddingBottom: footerHeight, ariaLive: ariaPhase, children: [messages.map((msg, i) => (_jsx(MessageBubble, { role: msg.role === "user" ? "user" : msg.role === "stage-narrator" ? "stage-narrator" : "bot", children: msg.content }, i))), moodCardVisible && _jsx(SlotFillingCard, { slotKey: "mood", prompt: "How are you feeling about this trip?", options: MOOD_OPTIONS, onSelect: handleMoodSelect, onSurprise: handleMoodSurprise, className: "mx-4 mb-2" }), destinationCardVisible && _jsx(DestinationCardsCard, { slotKey: "destination", options: DESTINATION_OPTIONS, onSelect: handleDestinationSelect, onSurprise: handleDestinationSurprise, className: "mx-4 mb-2" }), calendarCardVisible && _jsx(InlineCalendarCard, { slotKey: "travel_dates", onSelect: handleCalendarConfirm, className: "mx-4 mb-2" }), budgetCardVisible && _jsx(BudgetSliderCard, { slotKey: "budget", onChange: handleBudgetChange, onSelect: handleBudgetSelect, onSurprise: handleBudgetSurprise, className: "mx-4 mb-2" }), dietaryCardVisible && _jsx(MultiSelectCard, { slotKey: "dietary", prompt: "Any dietary requirements?", options: DIETARY_OPTIONS, onSelect: handleDietarySelect, className: "mx-4 mb-2" }), passportCardVisible && _jsx(PassportUploadCard, { slotKey: "passport_expiry", onSelect: handlePassportSelect, onSkip: handlePassportSkip, className: "mx-4 mb-2" }), verificationCardVisible && _jsx(ProfileVerificationCard, { items: computeVerificationItems(), onConfirm: handleVerificationConfirm, onEdit: handleVerificationEdit, className: "mx-4 mb-2" }), editSlotMenuVisible && _jsx(SlotFillingCard, { slotKey: "mood", prompt: "Which would you like to change?", options: EDIT_SLOT_OPTIONS.filter(opt => { const val = streamState.slotState[opt.value]; if (val === undefined) return false; if (opt.value === 'passport_expiry' && val === 'skipped') return false; return true; }), onSelect: handleEditFieldSelect, className: "mx-4 mb-2" }), isLoading && _jsx(TypingIndicator, {})] }), _jsx(CardDeckZone, { ref: cardDeckRef, chatInputHeight: chatInputHeight, children: _jsxs("div", { style: { padding: "8px 16px" }, children: [_jsx(TravelCard, { cardId: "demo", cardType: "flight", completenessScore: demoScore, isFinal: demoScore >= 0.75, delta: {}, deckState: "browsing", shimmerEnabled: true }), _jsxs("button", { onClick: () => setDemoScore((s) => Math.min(1, parseFloat((s + 0.25).toFixed(2)))), style: { marginTop: "8px", padding: "4px 12px", fontSize: "12px", cursor: "pointer" }, children: ["Advance score (", Math.round(demoScore * 100), "%)"] })] }) }), _jsx(ChatInput, { ref: chatInputRef, onSubmit: handleSend, disabled: isLoading, placeholder: "Tell me about your trip plans..." })] }))] }));
}
// ─── Auth Guard ────────────────────────────────────────────────────────────────
function AuthGuard({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem("token"));
    if (!token) {
        return _jsx(LoginPage, { onLogin: (t) => setToken(t) });
    }
    return _jsx(_Fragment, { children: children(() => { localStorage.removeItem("token"); setToken(null); }) });
}
// ─── App ───────────────────────────────────────────────────────────────────────
export function App() {
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/sessions", replace: true }) }), _jsx(Route, { path: "/sessions", element: _jsx(AuthGuard, { children: (onLogout) => _jsx(SessionListPage, { onLogout: onLogout }) }) }), _jsx(Route, { path: "/sessions/:id", element: _jsx(AuthGuard, { children: (onLogout) => _jsx(CopilotPage, { onLogout: onLogout }) }) }), _jsx(Route, { path: "/demo", element: _jsx(DemoPage, {}) })] }) }));
}
