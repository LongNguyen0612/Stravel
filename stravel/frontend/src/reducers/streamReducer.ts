import type { SessionEventRecord, StreamAction, StreamState, WorkflowStage } from "../types/stream";
import type { CardType, CardUpdateEvent, SlotKey } from "../types/domain";

const SLOT_TO_CARD_TYPES: Partial<Record<SlotKey, CardType[]>> = {
  destination: ['flight', 'hotel', 'activities', 'compliance'],
  travel_dates: ['flight', 'activities'],
  budget: ['hotel', 'budget', 'activities'],
  dietary: ['activities'],
  passport_expiry: ['compliance'],
  mood: ['flight', 'hotel', 'activities', 'budget', 'compliance'],
  activities: ['activities'],
  traveler_count: ['flight', 'hotel', 'activities', 'budget'],
};

export const initialStreamState: StreamState = {
  status: "idle",
  messages: [],
  complianceFlags: [],
  cardUpdates: {},
  ssePhase: "idle",
  error: null,
  isConnected: false,
  slotState: {},
  assumedSlots: [],
  openSlotKey: null,
};

export function streamReducer(
  state: StreamState,
  action: StreamAction
): StreamState {
  switch (action.type) {
    case "AGENT_MESSAGE":
      if (state.messages.some((m) => m.id === action.payload.id)) return state;
      return { ...state, messages: [...state.messages, action.payload] };
    case "COMPLIANCE_FLAG":
      if (state.complianceFlags.some((f) => f.check === action.payload.check && f.severity === action.payload.severity)) return state;
      return {
        ...state,
        complianceFlags: [...state.complianceFlags, action.payload],
      };
    case "STAGE_CHANGE":
      return { ...state, status: action.payload };
    case "CARD_UPDATE":
      return { ...state, cardUpdates: { ...state.cardUpdates, [action.payload.card_id]: action.payload } };
    case "SSE_PHASE_CHANGE":
      return { ...state, ssePhase: action.payload };
    case "ERROR":
      return { ...state, error: action.payload };
    case "CONNECTED":
      return { ...state, isConnected: true, error: null, ssePhase: "streaming" };
    case "DISCONNECTED":
      return { ...state, isConnected: false };
    case "RESET":
      return initialStreamState;
    case 'SLOT_UPDATE':
      return { ...state, slotState: { ...state.slotState, [action.payload.slotKey]: action.payload.value } };
    case "HYDRATE_HISTORY":
      return action.payload.reduce((acc, ev) => _applyHistoryEvent(acc, ev), { ...initialStreamState, ssePhase: "complete" as const });
    case "SET_ASSUMED_SLOTS":
      return { ...state, assumedSlots: action.payload };
    case "OPEN_SLOT_CARD":
      return { ...state, openSlotKey: action.payload };
    case "REMOVE_ASSUMED_SLOT":
      return { ...state, assumedSlots: state.assumedSlots.filter(s => s !== action.payload), openSlotKey: null };
    case 'MOOD_TRANSITION': {
      const { affectedSlots } = action.payload;
      const cardTypesToClear = new Set<CardType>(
        affectedSlots.flatMap(s => SLOT_TO_CARD_TYPES[s] ?? [])
      );
      const nextCardUpdates = { ...state.cardUpdates };
      for (const card of Object.values(nextCardUpdates)) {
        if (cardTypesToClear.has(card.type)) {
          delete nextCardUpdates[card.card_id];
        }
      }
      return { ...state, cardUpdates: nextCardUpdates };
    }
    default:
      return state;
  }
}

function _applyHistoryEvent(state: StreamState, ev: SessionEventRecord): StreamState {
  const d = ev.event_data as Record<string, unknown>;
  switch (ev.event_type) {
    case "stage.change":
      return { ...state, status: (d.stage as WorkflowStage) ?? state.status };
    case "agent.profiling.question":
    case "agent.calculation.result": {
      const msg = {
        id: String(ev.sse_id),
        type: (d.type as "question" | "result" | "proposal" | "error") ?? "result",
        content: String(d.content ?? ""),
        context: String(d.context ?? ""),
        timestamp: new Date(ev.created_at).getTime(),
      };
      if (state.messages.some((m) => m.id === msg.id)) return state;
      return { ...state, messages: [...state.messages, msg] };
    }
    case "proposal.ready": {
      const msg = {
        id: String(ev.sse_id),
        type: "proposal" as const,
        content: String(d.summary ?? "Proposal is ready for review."),
        context: "proposal_complete",
        timestamp: new Date(ev.created_at).getTime(),
      };
      if (state.messages.some((m) => m.id === msg.id)) return state;
      return { ...state, messages: [...state.messages, msg] };
    }
    case "compliance.flag": {
      const flag = { severity: d.severity as "block" | "warning" | "pass", check: String(d.check ?? ""), message: String(d.message ?? ""), alternative: String(d.alternative ?? "") };
      if (state.complianceFlags.some((f) => f.check === flag.check && f.severity === flag.severity)) return state;
      return { ...state, complianceFlags: [...state.complianceFlags, flag] };
    }
    case "card.update": {
      const card = d as unknown as CardUpdateEvent;
      return { ...state, cardUpdates: { ...state.cardUpdates, [card.card_id]: card } };
    }
    default:
      return state;
  }
}
