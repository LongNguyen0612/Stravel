import { useEffect, useReducer, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { CopilotLayout } from "./components/b2b/CopilotLayout";
import { CopilotSidebar } from "./components/b2b/CopilotSidebar";
import { B2CLayout, CardDeckZone, ChatInput, ConversationCanvas } from "./components/layout";
import { CardDeck } from "./components/cards";
import { SlotFillingCard } from "./components/cards/SlotFillingCard";
import type { ChipOption } from "./components/cards/SlotFillingCard";
import { DestinationCardsCard } from "./components/cards/DestinationCardsCard";
import type { DestinationOption } from "./components/cards/DestinationCardsCard";
import { InlineCalendarCard } from "./components/cards/InlineCalendarCard";
import { BudgetSliderCard, getBudgetTier } from "./components/cards/BudgetSliderCard";
import { MultiSelectCard } from "./components/cards/MultiSelectCard";
import { PassportUploadCard } from "./components/cards/PassportUploadCard";
import { ProfileVerificationCard } from "./components/cards/ProfileVerificationCard";
import type { ProfileVerificationItem } from "./components/cards/ProfileVerificationCard";
import { classifyMessage, classifyBuildTripIntent } from "./utils/messageClassifier";
import { streamReducer, initialStreamState } from "./reducers/streamReducer";
import type { SlotKey, CardType, CardUpdateEvent } from "./types/domain";
import { SessionList } from "./components/b2b/SessionList";
import { SessionPanel } from "./components/b2b/SessionPanel";
import { B2BLayout } from "./components/b2b/B2BLayout";
import { MessageBubble } from "./components/shared/MessageBubble";
import { TypingIndicator } from "./components/shared/TypingIndicator";
import { useFooterHeight } from "./hooks/useFooterHeight";
import { useStreamContext } from "./hooks/useStreamContext";
import { api } from "./services/apiClient";
import type { AdvisorySession, TravelerProfile } from "./types/domain";

// ─── Auth ─────────────────────────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("admin@stravel.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api.auth.login(email, password);
      localStorage.setItem("token", data.access_token);
      onLogin(data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f5f7fa" }}>
      <div style={{ background: "#fff", padding: "2.5rem", borderRadius: "12px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: "380px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "28px", marginBottom: "4px" }}>✈️</div>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1f2937" }}>STravel Advisory</h2>
          <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "4px" }}>Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }}
            />
          </div>
          {error && <p style={{ color: "#dc2626", marginBottom: "14px", fontSize: "13px" }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "11px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Session List ──────────────────────────────────────────────────────────────

function SessionListPage({ onLogout }: { onLogout: () => void }) {
  const [sessions, setSessions] = useState<AdvisorySession[]>([]);
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
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(id: string) {
    await api.sessions.archive(id);
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: "archived" } : s));
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fa" }}>
      {/* Navbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "56px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px" }}>✈️</span>
          <span style={{ fontWeight: 700, fontSize: "16px" }}>STravel Advisory</span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{ padding: "8px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}
          >
            {creating ? "Creating..." : "+ New Session"}
          </button>
          <button onClick={onLogout} style={{ padding: "8px 14px", background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "14px", cursor: "pointer" }}>
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "24px" }}>Advisory Sessions</h1>
        {loading ? (
          <p style={{ color: "#6b7280" }}>Loading...</p>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗂️</div>
            <p style={{ color: "#6b7280", marginBottom: "16px" }}>No sessions yet. Create your first one.</p>
            <button
              onClick={handleCreate}
              style={{ padding: "10px 24px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}
            >
              Create Session
            </button>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <SessionList
              sessions={sessions}
              onSelect={(s) => navigate(`/sessions/${s.id}`)}
              onArchive={handleArchive}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Copilot Page ──────────────────────────────────────────────────────────────

function CopilotPage({ onLogout }: { onLogout: () => void }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<AdvisorySession | null>(null);
  const [loading, setLoading] = useState(true);
  const { state, connect, proposeFirst } = useStreamContext();

  useEffect(() => {
    if (!id) return;
    api.sessions.get(id).then((s) => {
      setSession(s);
      setLoading(false);
      connect(s.id);
    }).catch(() => navigate("/sessions"));
  }, [id, connect, navigate]);

  async function handleChat(message: string) {
    if (!session) return;
    await proposeFirst(session.id, message);
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Navbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "56px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate("/sessions")}
            style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "14px", padding: "4px" }}
          >
            ← Sessions
          </button>
          <span style={{ color: "#e5e7eb" }}>|</span>
          <span style={{ fontSize: "20px" }}>✈️</span>
          <span style={{ fontWeight: 700, fontSize: "16px" }}>STravel Advisory</span>
        </div>
        <button onClick={onLogout} style={{ padding: "6px 14px", background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "14px", cursor: "pointer" }}>
          Logout
        </button>
      </div>

      {/* Reconnect banner */}
      {state.ssePhase === "error" && session && (
        <div style={{ background: "#fef2f2", borderBottom: "1px solid #fca5a5", padding: "8px 24px", display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", color: "#dc2626" }}>
          <span>Connection lost.</span>
          <button
            onClick={() => connect(session.id)}
            style={{ padding: "4px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "4px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Split layout */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "#6b7280" }}>
          Loading session...
        </div>
      ) : session ? (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <CopilotLayout
            sessionPanel={
              <SessionPanel
                session={session}
                onChat={handleChat}
                sseMessages={state.messages}
                ssePhase={state.ssePhase}
              />
            }
            sidebar={<CopilotSidebar state={state} />}
          />
        </div>
      ) : null}
    </div>
  );
}

// ─── Demo Page ─────────────────────────────────────────────────────────────────

const MOOD_BUDGET_MIDPOINTS: Record<string, number> = {
  adventure: 2000, relaxation: 3500, culture: 1800, foodie: 2000, romance: 3500,
};

const DIETARY_OPTIONS: { label: string; value: string }[] = [
  { label: 'Vegetarian', value: 'vegetarian' },
  { label: 'Vegan', value: 'vegan' },
  { label: 'Halal', value: 'halal' },
  { label: 'Kosher', value: 'kosher' },
  { label: 'Gluten free', value: 'gluten_free' },
  { label: 'Nut allergy', value: 'nut_allergy' },
];

const MOOD_OPTIONS: ChipOption[] = [
  { label: 'Adventure', value: 'adventure' },
  { label: 'Relaxation', value: 'relaxation' },
  { label: 'Culture', value: 'culture' },
  { label: 'Foodie', value: 'foodie' },
  { label: 'Romance', value: 'romance' },
  { label: 'Surprise me', value: 'surprise_me' },
];

const MOOD_LABELS: Record<string, string> = {
  adventure: 'Adventure',
  relaxation: 'Relaxation',
  culture: 'Culture',
  foodie: 'Foodie',
  romance: 'Romance',
};

const MOOD_VALUES = MOOD_OPTIONS
  .filter(opt => opt.value !== 'surprise_me')
  .map(opt => opt.value);

const DESTINATION_OPTIONS: DestinationOption[] = [
  { value: 'hoi_an', label: 'Hội An', description: 'Lantern-lit ancient town with tailors and beach bikes', costTier: 'mid-range' },
  { value: 'hanoi', label: 'Hà Nội', description: 'Chaotic capital with street food and French heritage', costTier: 'budget' },
  { value: 'phu_quoc', label: 'Phú Quốc', description: 'Island paradise with clear water and beach clubs', costTier: 'premium' },
  { value: 'hue', label: 'Huế', description: 'Imperial citadel, royal tombs, and river boat dining', costTier: 'budget' },
  { value: 'da_nang', label: 'Đà Nẵng', description: 'Dragon bridges, marble mountains, and surf beaches', costTier: 'mid-range' },
];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// P3: guard against null/malformed input before splitting
function formatDateForDisplay(iso: string): string {
  if (!iso || !DATE_REGEX.test(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

const EDIT_SLOT_OPTIONS = [
  { label: 'Destination', value: 'destination' },
  { label: 'Dates', value: 'travel_dates' },
  { label: 'Budget', value: 'budget' },
  { label: 'Dietary', value: 'dietary' },
  { label: 'Passport expiry', value: 'passport_expiry' },
] as const;

interface DemoMessage { role: "user" | "assistant" | "stage-narrator"; content: string; }

const PROPOSAL_CARD_TYPES: CardType[] = ['flight', 'hotel', 'activities', 'budget', 'compliance'];

const CARD_TYPE_TO_SLOT: Partial<Record<CardType, SlotKey>> = {
  flight: 'travel_dates',
  hotel: 'destination',
  activities: 'dietary',
  budget: 'budget',
  compliance: 'passport_expiry',
};

export function DemoPage() {
  const [messages, setMessages] = useState<DemoMessage[]>([
    { role: "assistant", content: "Hi! Where are you dreaming of going in Vietnam?" },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [sentinelText, setSentinelText] = useState("");
  const [errorSentinelText, setErrorSentinelText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
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
  const [editingSlot, setEditingSlot] = useState<SlotKey | null>(null);
  const [cardEditMode, setCardEditMode] = useState(false);
  const [compliancePulseActive, setCompliancePulseActive] = useState(false);
  const compliancePulseTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [firstMessageSent, setFirstMessageSent] = useState(false);
  const [autoTriggerConfirmVisible, setAutoTriggerConfirmVisible] = useState(false);

  const editTriggerRef = useRef<Element | null>(null);
  const wasCardEditRestreamRef = useRef(false);
  const { connect, state: sseState, moodTransition } = useStreamContext();

  const isProfileComplete = Boolean(
    streamState.slotState.destination &&
    streamState.slotState.travel_dates &&
    streamState.slotState.budget
  );

  const chatInputRef = useRef<HTMLDivElement>(null);
  const isConfirmingRef = useRef(false);
  const prevSsePhaseRef = useRef(sseState.ssePhase);
  const cardDeckRef = useRef<HTMLDivElement>(null);
  const chatInputHeight = useFooterHeight([chatInputRef]);
  const footerHeight = useFooterHeight([chatInputRef, cardDeckRef]);

  const isProposing = streamState.status === 'proposing'
    || sseState.status === 'proposing'
    || sseState.ssePhase === 'streaming'
    || sseState.ssePhase === 'complete';

  const realCardsByType = Object.fromEntries(
    Object.values(sseState.cardUpdates).map((c) => [c.type, c])
  );
  const displayCards: CardUpdateEvent[] = PROPOSAL_CARD_TYPES.map(type =>
    (realCardsByType[type] as CardUpdateEvent | undefined) ?? {
      card_id: type,
      type: type as CardType,
      completeness_score: 0,
      delta: {},
      is_final: false,
    }
  );

  const ariaPhase: 'off' | 'polite' | 'assertive' = isLoading ? 'off' : hasError ? 'assertive' : 'polite';

  useEffect(() => {
    if (prevSsePhaseRef.current !== 'complete' && sseState.ssePhase === 'complete') {
      setSentinelText('Your trip proposal is ready');
      if (wasCardEditRestreamRef.current) {
        wasCardEditRestreamRef.current = false;
        setMessages(prev => [...prev, { role: 'stage-narrator', content: '✅ Your proposal has been updated.' }]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'stage-narrator', content: '🎉 Your proposal is ready! Scroll up to review your trip.' },
        ]);
      }
    }
    prevSsePhaseRef.current = sseState.ssePhase;
  }, [sseState.ssePhase]);

  useEffect(() => {
    if (!cardEditMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancelCardEdit(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cardEditMode]);

  const handleToggleMode = () => {
    const next = !agentMode;
    localStorage.setItem("stravel_agent_mode", String(next));
    setAgentMode(next);
  };

  const handleSend = async (message: string) => {
    // Build-trip intent detection (AC4/AC5 of story 9-7)
    if (classifyBuildTripIntent(message)) {
      if (sseState.ssePhase === 'streaming') {
        setMessages(prev => [...prev, { role: 'user', content: message }, { role: 'assistant', content: "Your proposal is already being generated." }]);
        return;
      }
      if (isProfileComplete) {
        setMessages(prev => [...prev, { role: 'user', content: message }]);
        await handleAutoTriggerConfirm(true);
        return;
      }
    }

    // AC3: user types while mood card showing → destination bypass
    if (moodCardVisible) {
      setMessages(prev => [...prev, { role: 'user', content: message }]);
      setMoodCardVisible(false);
      dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey: 'destination' as SlotKey, value: message } });
      setMessages(prev => [...prev, { role: 'assistant', content: `Got it — I'll look at trips around ${message}.` }]);
      setSentinelText("Message received.");
      return;
    }

    // AC1 / AC6: classify first message
    const isFirst = !firstMessageSent;
    if (isFirst) setFirstMessageSent(true);

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
        // eslint-disable-next-line no-restricted-globals -- demo endpoint not in apiClient.ts
        const resp = await fetch("/api/v1/demo/sessions", { method: "POST" });
        if (!resp.ok) throw new Error(`Session create failed: ${resp.status}`);
        const data = await resp.json();
        sid = data.session_id;
        setSessionId(sid);
      }
      // eslint-disable-next-line no-restricted-globals -- demo endpoint not in apiClient.ts
      const chatResp = await fetch(`/api/v1/demo/sessions/${sid}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!chatResp.ok) throw new Error(`Chat request failed: ${chatResp.status}`);
      const chatData = await chatResp.json();
      setMessages((prev) => [...prev, { role: "assistant", content: chatData.reply ?? "" }]);
      setSentinelText("Message received.");
    } catch {
      setHasError(true);
      setErrorSentinelText("Something went wrong.");
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const base = last?.role === "stage-narrator" ? prev.slice(0, -1) : prev;
        return [...base, { role: "assistant", content: "Something went wrong. Please try again." }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoodSelect = ({ slotKey, value }: { slotKey: SlotKey; value: string }) => {
    dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
    setMoodCardVisible(false);
    setDestinationCardVisible(true);
    setMessages(prev => [
      ...prev,
      { role: 'user', content: MOOD_LABELS[value] ?? value },
      { role: 'assistant', content: "Great — let me suggest some places that match that vibe." },
    ]);
  };

  const handleMoodSurprise = ({ slotKey }: { slotKey: SlotKey }) => {
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

  const handleDestinationSelect = ({ slotKey, value, label }: { slotKey: SlotKey; value: string; label: string }) => {
    dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
    setDestinationCardVisible(false);
    if (editingSlot === 'destination') {
      setEditingSlot(null);
      setMessages(prev => [...prev, { role: 'user', content: label }]);
      if (cardEditMode) {
        setCardEditMode(false);
        moodTransition(['destination'], 'correction');
        if (sessionId) {
          wasCardEditRestreamRef.current = true;
          connect(sessionId);
          void api.sessions.run(sessionId);
          setMessages(prev => [...prev, { role: 'assistant', content: "Updating your proposal with the new destination..." }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong — no active session. Please refresh and try again." }]);
        }
      } else {
        setVerificationCardVisible(true);
      }
      return;
    }
    setCalendarCardVisible(true);
    setMessages(prev => [
      ...prev,
      { role: 'user', content: label },
      { role: 'assistant', content: `Great choice! ${label} it is — when are you planning to travel?` },
    ]);
  };

  const handleDestinationSurprise = ({ slotKey }: { slotKey: SlotKey }) => {
    const randomOpt = DESTINATION_OPTIONS[Math.floor(Math.random() * DESTINATION_OPTIONS.length)];
    dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value: randomOpt.value } });
    setDestinationCardVisible(false);
    if (editingSlot === 'destination') {
      setEditingSlot(null);
      setMessages(prev => [...prev, { role: 'user', content: 'Surprise me' }]);
      if (cardEditMode) {
        setCardEditMode(false);
        moodTransition(['destination'], 'correction');
        if (sessionId) {
          wasCardEditRestreamRef.current = true;
          connect(sessionId);
          void api.sessions.run(sessionId);
          setMessages(prev => [...prev, { role: 'assistant', content: "Updating your proposal with the new destination..." }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong — no active session. Please refresh and try again." }]);
        }
      } else {
        setVerificationCardVisible(true);
      }
      return;
    }
    setCalendarCardVisible(true);
    setMessages(prev => [
      ...prev,
      { role: 'user', content: 'Surprise me' },
      { role: 'assistant', content: `Great choice! ${randomOpt.label} it is — when are you planning to travel?` },
    ]);
  };

  const handleCalendarConfirm = ({ slotKey, value, nightCount }: { slotKey: SlotKey; value: string; nightCount: number }) => {
    dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
    setCalendarCardVisible(false);
    const [startStr, endStr] = value.split(',');
    const fmtDate = (s: string) =>
      new Date(s + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const userBubble = `${fmtDate(startStr)} – ${fmtDate(endStr)} · ${nightCount} night${nightCount === 1 ? '' : 's'}`;
    if (editingSlot === 'travel_dates') {
      setEditingSlot(null);
      setMessages(prev => [...prev, { role: 'user', content: userBubble }]);
      if (cardEditMode) {
        setCardEditMode(false);
        moodTransition(['travel_dates'], 'edit');
        if (sessionId) {
          wasCardEditRestreamRef.current = true;
          connect(sessionId);
          void api.sessions.run(sessionId);
          setMessages(prev => [...prev, { role: 'assistant', content: "Updating your proposal with the new travel dates..." }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong — no active session. Please refresh and try again." }]);
        }
      } else {
        setVerificationCardVisible(true);
      }
      return;
    }
    setBudgetCardVisible(true);
    setMessages(prev => [
      ...prev,
      { role: 'user', content: userBubble },
      { role: 'assistant', content: `${nightCount} nights — noted! What's your total budget for this trip?` },
    ]);
  };

  const handleBudgetChange = ({ slotKey, value }: { slotKey: SlotKey; value: string }) => {
    dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
  };

  const handleBudgetSelect = ({ slotKey, value }: { slotKey: SlotKey; value: string }) => {
    dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
    setBudgetCardVisible(false);
    const amount = parseInt(value, 10);
    const tier = getBudgetTier(amount);
    const userBubble = `USD ${amount.toLocaleString()} · ${tier.label}`;
    if (editingSlot === 'budget') {
      setEditingSlot(null);
      setMessages(prev => [...prev, { role: 'user', content: userBubble }]);
      if (cardEditMode) {
        setCardEditMode(false);
        moodTransition(['budget'], 'edit');
        if (sessionId) {
          wasCardEditRestreamRef.current = true;
          connect(sessionId);
          void api.sessions.run(sessionId);
          setMessages(prev => [...prev, { role: 'assistant', content: "Updating your proposal with the new budget..." }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong — no active session. Please refresh and try again." }]);
        }
      } else {
        setVerificationCardVisible(true);
      }
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

  const handleBudgetSurprise = ({ slotKey }: { slotKey: SlotKey }) => {
    const moodVal = streamState.slotState.mood;
    const mood = (typeof moodVal === 'string' ? moodVal : '').toLowerCase();
    const amount = MOOD_BUDGET_MIDPOINTS[mood] ?? 2500;
    dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value: String(amount) } });
    setBudgetCardVisible(false);
    const tier = getBudgetTier(amount);
    if (editingSlot === 'budget') {
      setEditingSlot(null);
      setMessages(prev => [
        ...prev,
        { role: 'user', content: 'Surprise me' },
      ]);
      if (cardEditMode) {
        setCardEditMode(false);
        moodTransition(['budget'], 'edit');
        if (sessionId) {
          wasCardEditRestreamRef.current = true;
          connect(sessionId);
          void api.sessions.run(sessionId);
          setMessages(prev => [...prev, { role: 'assistant', content: "Updating your proposal with the new budget..." }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong — no active session. Please refresh and try again." }]);
        }
      } else {
        setVerificationCardVisible(true);
      }
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

  const handleDietarySelect = ({ slotKey, value }: { slotKey: SlotKey; value: string[] }) => {
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
      if (cardEditMode) {
        setCardEditMode(false);
        moodTransition(['dietary'], 'edit');
        if (sessionId) {
          wasCardEditRestreamRef.current = true;
          connect(sessionId);
          void api.sessions.run(sessionId);
          setMessages(prev => [...prev, { role: 'assistant', content: "Updating your activity recommendations..." }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong — no active session. Please refresh and try again." }]);
        }
      } else {
        setVerificationCardVisible(true);
      }
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

  const handlePassportSelect = ({ slotKey, value }: { slotKey: SlotKey; value: string }) => {
    dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value } });
    setPassportCardVisible(false);
    if (editingSlot === 'passport_expiry') {
      setEditingSlot(null);
      setMessages(prev => [
        ...prev,
        { role: 'user', content: `Passport expiry: ${formatDateForDisplay(value)}` },
      ]);
      if (cardEditMode) {
        setCardEditMode(false);
        moodTransition(['passport_expiry'], 'edit');
        if (sessionId) {
          wasCardEditRestreamRef.current = true;
          connect(sessionId);
          void api.sessions.run(sessionId);
          setMessages(prev => [...prev, { role: 'assistant', content: "Updating your compliance check with the new passport details..." }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong — no active session. Please refresh and try again." }]);
        }
      } else {
        setVerificationCardVisible(true);
      }
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

  const handlePassportSkip = ({ slotKey }: { slotKey: SlotKey }) => {
    dispatchStream({ type: 'SLOT_UPDATE', payload: { slotKey, value: 'skipped' } });
    setPassportCardVisible(false);
    if (editingSlot === 'passport_expiry') {
      setEditingSlot(null);
      setMessages(prev => [...prev, { role: 'user', content: 'Skip passport' }]);
      if (cardEditMode) {
        setCardEditMode(false);
        moodTransition(['passport_expiry'], 'edit');
        if (sessionId) {
          wasCardEditRestreamRef.current = true;
          connect(sessionId);
          void api.sessions.run(sessionId);
          setMessages(prev => [...prev, { role: 'assistant', content: "Skipping passport check — compliance card will be updated..." }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong — no active session. Please refresh and try again." }]);
        }
      } else {
        setVerificationCardVisible(true);
      }
      return;
    }
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: "No problem — just note that compliance checks may be incomplete without your passport details." },
      { role: 'assistant', content: "Here's what I've got — does everything look right?" },
    ]);
    setVerificationCardVisible(true);
  };

  const computeVerificationItems = (): ProfileVerificationItem[] => {
    const items: ProfileVerificationItem[] = [];
    const ss = streamState.slotState;

    if (ss.destination) {
      const dest = DESTINATION_OPTIONS.find(o => o.value === ss.destination);
      items.push({ icon: '📍', label: 'Destination', value: dest?.label ?? String(ss.destination) });
    }
    if (ss.travel_dates && typeof ss.travel_dates === 'string') {
      const [start, end] = ss.travel_dates.split(',');
      if (start && end) {
        const fmtDate = (s: string) =>
          new Date(s + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const nights = Math.round(
          (new Date(end + 'T00:00').getTime() - new Date(start + 'T00:00').getTime()) / 86400000
        );
        items.push({
          icon: '📅',
          label: 'Dates',
          value: `${fmtDate(start)} – ${fmtDate(end)} · ${nights} night${nights === 1 ? '' : 's'}`,
        });
      }
    }
    if (ss.budget) {
      const amount = parseInt(String(ss.budget), 10);
      if (!isNaN(amount)) {
        items.push({ icon: '💰', label: 'Budget', value: `~$${amount.toLocaleString()}` });
      }
    }
    if (ss.dietary !== undefined) {
      const vals = Array.isArray(ss.dietary) ? (ss.dietary as string[]) : [];
      const labels = vals.map(v => DIETARY_OPTIONS.find(o => o.value === v)?.label ?? v);
      items.push({ icon: '🍽️', label: 'Dietary', value: labels.length ? labels.join(', ') : 'No restrictions' });
    }
    if (ss.passport_expiry) {
      const val = String(ss.passport_expiry);
      items.push({
        icon: '🛂',
        label: 'Passport expiry',
        value: val === 'skipped' ? 'Skipped' : formatDateForDisplay(val),
      });
    }
    return items;
  };

  const handleVerificationConfirm = () => {
    setVerificationCardVisible(false);
    setMessages(prev => [...prev, { role: 'user', content: 'Looks good!' }]);
    setAutoTriggerConfirmVisible(true);
  };

  const handleAutoTriggerConfirm = async (skipUserBubble = false) => {
    if (isConfirmingRef.current) return;
    isConfirmingRef.current = true;
    if (sseState.ssePhase === 'streaming') {
      setMessages(prev => [...prev, { role: 'assistant', content: "Your proposal is already being generated." }]);
      setAutoTriggerConfirmVisible(false);
      isConfirmingRef.current = false;
      return;
    }
    setAutoTriggerConfirmVisible(false);
    if (!skipUserBubble) {
      setMessages(prev => [...prev, { role: 'user', content: "Let's go!" }]);
    }
    try {
      let sid = sessionId;
      if (!sid) {
        const session = await api.sessions.create();
        sid = session.id;
        setSessionId(sid);
      }
      connect(sid);
      await api.sessions.run(sid);
      dispatchStream({ type: 'STAGE_CHANGE', payload: 'proposing' });
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong starting your proposal. Please try again." }]);
      setAutoTriggerConfirmVisible(true);
    } finally {
      isConfirmingRef.current = false;
    }
  };

  const handleAutoTriggerDecline = () => {
    setAutoTriggerConfirmVisible(false);
    setMessages(prev => [...prev, { role: 'assistant', content: "No problem — just say 'build my trip' whenever you're ready." }]);
  };

  const handleVerificationEdit = () => {
    setEditingSlot(null);
    setVerificationCardVisible(false);
    setEditSlotMenuVisible(true);
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: "Sure — which part would you like to change?" },
    ]);
  };

  const handleEditFieldSelect = ({ value }: { slotKey: SlotKey; value: string }) => {
    const slotToEdit = value as SlotKey;
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

  const handleCardEdit = (cardId: string) => {
    editTriggerRef.current = document.activeElement;
    setDestinationCardVisible(false);
    setCalendarCardVisible(false);
    setBudgetCardVisible(false);
    setDietaryCardVisible(false);
    setPassportCardVisible(false);
    const card = displayCards.find(c => c.card_id === cardId);
    const cardType = card?.type ?? (cardId as CardType);
    const slotKey = CARD_TYPE_TO_SLOT[cardType];
    if (!slotKey) return;
    setEditingSlot(slotKey);
    setCardEditMode(true);
    switch (slotKey) {
      case 'destination': setDestinationCardVisible(true); break;
      case 'travel_dates': setCalendarCardVisible(true); break;
      case 'budget': setBudgetCardVisible(true); break;
      case 'dietary': setDietaryCardVisible(true); break;
      case 'passport_expiry': setPassportCardVisible(true); break;
      default: setCardEditMode(false); setEditingSlot(null); break;
    }
  };

  const handleCancelCardEdit = () => {
    setCardEditMode(false);
    setEditingSlot(null);
    setDestinationCardVisible(false);
    setCalendarCardVisible(false);
    setBudgetCardVisible(false);
    setDietaryCardVisible(false);
    setPassportCardVisible(false);
    (editTriggerRef.current as HTMLElement | null)?.focus();
    editTriggerRef.current = null;
  };

  const handleComplianceBadgeTap = () => {
    const el = cardDeckRef.current?.querySelector<HTMLElement>('[data-card-type="compliance"]');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    clearTimeout(compliancePulseTimerRef.current);
    setCompliancePulseActive(true);
    compliancePulseTimerRef.current = setTimeout(() => setCompliancePulseActive(false), 200);
  };

  const sentinelStyle: React.CSSProperties = {
    position: "absolute", width: "1px", height: "1px",
    overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap",
  };

  return (
    <>
      {/* Always-mounted sentinels — must never unmount so screen readers keep the live region registered */}
      <div role="status" aria-live="polite" aria-atomic="true" data-testid="aria-sentinel" style={sentinelStyle}>
        {sentinelText}
      </div>
      <div role="status" aria-live="assertive" aria-atomic="true" data-testid="aria-sentinel-error" style={sentinelStyle}>
        {errorSentinelText}
      </div>
      {agentMode ? (
        <B2BLayout sessions={[]} onSelectSession={() => {}} onToggleMode={handleToggleMode} />
      ) : (
        <B2CLayout>
          <div style={{ padding: "8px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleToggleMode}
              style={{ padding: "4px 10px", fontSize: "12px", color: "#6b7280", background: "none", border: "1px solid #e5e7eb", borderRadius: "4px", cursor: "pointer" }}
              data-testid="agent-mode-toggle"
            >
              Agent Mode
            </button>
          </div>
          <ConversationCanvas paddingBottom={footerHeight} ariaLive={ariaPhase}>
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                role={msg.role === "user" ? "user" : msg.role === "stage-narrator" ? "stage-narrator" : "bot"}
              >
                {msg.content}
              </MessageBubble>
            ))}
            {moodCardVisible && (
              <SlotFillingCard
                slotKey="mood"
                prompt="How are you feeling about this trip?"
                options={MOOD_OPTIONS}
                onSelect={handleMoodSelect}
                onSurprise={handleMoodSurprise}
                className="mx-4 mb-2"
              />
            )}
            {destinationCardVisible && (
              <DestinationCardsCard
                slotKey="destination"
                options={DESTINATION_OPTIONS}
                onSelect={handleDestinationSelect}
                onSurprise={handleDestinationSurprise}
                className="mx-4 mb-2"
              />
            )}
            {calendarCardVisible && (
              <InlineCalendarCard
                slotKey="travel_dates"
                onSelect={handleCalendarConfirm}
                className="mx-4 mb-2"
              />
            )}
            {budgetCardVisible && (
              <BudgetSliderCard
                slotKey="budget"
                onChange={handleBudgetChange}
                onSelect={handleBudgetSelect}
                onSurprise={handleBudgetSurprise}
                className="mx-4 mb-2"
              />
            )}
            {dietaryCardVisible && (
              <MultiSelectCard
                slotKey="dietary"
                prompt="Any dietary requirements?"
                options={DIETARY_OPTIONS}
                onSelect={handleDietarySelect}
                className="mx-4 mb-2"
              />
            )}
            {passportCardVisible && (
              <PassportUploadCard
                slotKey="passport_expiry"
                onSelect={handlePassportSelect}
                onSkip={handlePassportSkip}
                className="mx-4 mb-2"
              />
            )}
            {cardEditMode && (
              <div className="mx-4 mb-2 flex gap-2" data-testid="cancel-card-edit-container">
                <button
                  type="button"
                  data-testid="cancel-card-edit-chip"
                  onClick={handleCancelCardEdit}
                  className="inline-flex items-center px-4 py-2 rounded-full border border-border bg-surface text-text-base text-sm font-medium hover:bg-surface-2 min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            )}
            {verificationCardVisible && (
              <ProfileVerificationCard
                items={computeVerificationItems()}
                onConfirm={handleVerificationConfirm}
                onEdit={handleVerificationEdit}
                className="mx-4 mb-2"
              />
            )}
            {autoTriggerConfirmVisible && (
              <div className="mx-4 mb-2" data-testid="auto-trigger-confirm">
                <MessageBubble role="bot">
                  Ready to build your trip proposal. This takes about 60 seconds — shall I start?
                </MessageBubble>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    type="button"
                    data-testid="lets-go-chip"
                    onClick={() => void handleAutoTriggerConfirm()}
                    style={{ padding: '8px 16px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
                  >
                    Let&apos;s go
                  </button>
                  <button
                    type="button"
                    data-testid="not-yet-chip"
                    onClick={handleAutoTriggerDecline}
                    style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '20px', cursor: 'pointer', fontSize: '14px' }}
                  >
                    Not yet
                  </button>
                </div>
              </div>
            )}
            {editSlotMenuVisible && (
              <SlotFillingCard
                slotKey="mood"
                prompt="Which would you like to change?"
                options={EDIT_SLOT_OPTIONS.filter(opt => {
                  const val = streamState.slotState[opt.value as SlotKey];
                  if (val === undefined) return false;
                  if (opt.value === 'passport_expiry' && val === 'skipped') return false;
                  return true;
                })}
                onSelect={handleEditFieldSelect}
                className="mx-4 mb-2"
              />
            )}
            {isLoading && <TypingIndicator />}
          </ConversationCanvas>
          <CardDeckZone ref={cardDeckRef} chatInputHeight={chatInputHeight}>
            {isProposing && (
              <CardDeck
                cards={displayCards}
                sessionId={sessionId ?? undefined}
                assumedSlots={sseState.assumedSlots}
                hasComplianceBlock={sseState.complianceFlags.some(f => f.severity === 'block')}
                onComplianceBadgeTap={handleComplianceBadgeTap}
                highlightComplianceCard={compliancePulseActive}
                onCardEdit={handleCardEdit}
                onRetry={() => {
                  if (sessionId) {
                    connect(sessionId);
                  } else {
                    setErrorSentinelText("Something went wrong. Please refresh the page.");
                  }
                }}
              />
            )}
          </CardDeckZone>
          <ChatInput
            ref={chatInputRef}
            onSubmit={handleSend}
            disabled={isLoading}
            placeholder="Tell me about your trip plans..."
          />
        </B2CLayout>
      )}
    </>
  );
}

// ─── Auth Guard ────────────────────────────────────────────────────────────────

function AuthGuard({ children }: { children: (onLogout: () => void) => React.ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  if (!token) {
    return <LoginPage onLogin={(t) => setToken(t)} />;
  }
  return <>{children(() => { localStorage.removeItem("token"); setToken(null); })}</>;
}

// ─── App ───────────────────────────────────────────────────────────────────────

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/sessions" replace />} />
        <Route
          path="/sessions"
          element={
            <AuthGuard>
              {(onLogout) => <SessionListPage onLogout={onLogout} />}
            </AuthGuard>
          }
        />
        <Route
          path="/sessions/:id"
          element={
            <AuthGuard>
              {(onLogout) => <CopilotPage onLogout={onLogout} />}
            </AuthGuard>
          }
        />
        <Route path="/demo" element={<DemoPage />} />
      </Routes>
    </BrowserRouter>
  );
}
