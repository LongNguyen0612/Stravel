import { useCallback, useEffect, useReducer, useRef } from "react";
import { initialStreamState, streamReducer } from "../reducers/streamReducer";
import type { StreamState } from "../types/stream";
import type { CardUpdateEvent, SlotKey } from "../types/domain";
import { api } from "../services/apiClient";
import { randomUUID } from "../utils/uuid";

interface UseStreamContextReturn {
  state: StreamState;
  connect: (sessionId: string) => void;
  disconnect: () => void;
  hydrateFromHistory: (sessionId: string) => Promise<number>;
  proposeFirst: (sessionId: string, message: string) => Promise<void>;
  openSlotCard: (slotKey: SlotKey) => void;
  removeAssumedSlot: (slotKey: string) => void;
  moodTransition: (affectedSlots: SlotKey[], kind?: 'edit' | 'correction') => void;
}

const WATCHDOG_MS = 30_000;

function parseEventData(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    console.warn("[SSE] malformed event payload, skipping", raw);
    return null;
  }
}

export function useStreamContext(): UseStreamContextReturn {
  const [state, dispatch] = useReducer(streamReducer, initialStreamState);
  const eventSourceRef = useRef<EventSource | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback((sessionId: string) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    if (watchdogRef.current) clearTimeout(watchdogRef.current);

    const token = localStorage.getItem("token") ?? "";
    const es = new EventSource(`/api/v1/stream/${sessionId}?token=${encodeURIComponent(token)}`);
    eventSourceRef.current = es;

    const resetWatchdog = () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      watchdogRef.current = setTimeout(() => {
        dispatch({ type: "SSE_PHASE_CHANGE", payload: "error" });
        dispatch({ type: "DISCONNECTED" });
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
      }, WATCHDOG_MS);
    };

    const addMessage = (data: Record<string, unknown>) => {
      dispatch({
        type: "AGENT_MESSAGE",
        payload: { id: randomUUID(), timestamp: Date.now(), ...data } as import("../types/stream").StreamMessage,
      });
    };

    es.onopen = () => {
      console.log("[SSE] connected");
      dispatch({ type: "CONNECTED" });
      resetWatchdog();
    };

    es.onerror = (e) => {
      console.warn("[SSE] error/disconnect", e);
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      dispatch({ type: "SSE_PHASE_CHANGE", payload: "error" });
      dispatch({ type: "DISCONNECTED" });
    };

    es.addEventListener("keepalive", () => {
      resetWatchdog();
    });

    es.addEventListener("stage.change", (e) => {
      resetWatchdog();
      console.log("[SSE] stage.change", e.data);
      const data = parseEventData(e.data);
      if (!data) return;
      dispatch({ type: "STAGE_CHANGE", payload: data.stage as import("../types/stream").WorkflowStage });
      if (data.stage === "complete") {
        dispatch({ type: "SSE_PHASE_CHANGE", payload: "complete" });
      }
    });

    es.addEventListener("card.update", (e) => {
      resetWatchdog();
      const data = parseEventData(e.data);
      if (!data) return;
      dispatch({ type: "CARD_UPDATE", payload: data as unknown as CardUpdateEvent });
    });

    es.addEventListener("agent.profiling.question", (e) => {
      resetWatchdog();
      console.log("[SSE] agent.profiling.question", e.data);
      const data = parseEventData(e.data);
      if (data) addMessage(data);
    });

    es.addEventListener("agent.calculation.result", (e) => {
      resetWatchdog();
      console.log("[SSE] agent.calculation.result", e.data);
      const data = parseEventData(e.data);
      if (data) addMessage(data);
    });

    es.addEventListener("agent.error", (e) => {
      resetWatchdog();
      const data = parseEventData(e.data);
      if (!data) return;
      dispatch({ type: "ERROR", payload: data.message as string });
    });

    es.addEventListener("agent.compliance.flag", (e) => {
      resetWatchdog();
      console.log("[SSE] compliance.flag", e.data);
      const data = parseEventData(e.data);
      if (!data) return;
      dispatch({ type: "COMPLIANCE_FLAG", payload: data as unknown as import("../types/stream").ComplianceFlag });
    });

    es.addEventListener("proposal.ready", (e) => {
      resetWatchdog();
      console.log("[SSE] proposal.ready");
      const data = parseEventData(e.data);
      dispatch({
        type: "AGENT_MESSAGE",
        payload: {
          id: randomUUID(),
          type: "proposal",
          content: (data?.summary as string) ?? "Proposal is ready for review.",
          context: "proposal_complete",
          timestamp: Date.now(),
        },
      });
    });
  }, []);

  const disconnect = useCallback(() => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      dispatch({ type: "DISCONNECTED" });
    }
  }, []);

  const proposeFirst = useCallback(async (sessionId: string, message: string): Promise<void> => {
    try {
      const res = await api.sessions.proposeFirst(sessionId, message);
      dispatch({ type: "SET_ASSUMED_SLOTS", payload: res.assumed_slots });
      dispatch({
        type: "AGENT_MESSAGE",
        payload: {
          id: randomUUID(),
          type: "question",
          content: res.bot_message,
          context: "propose_first",
          timestamp: Date.now(),
        },
      });
      connect(sessionId);
    } catch (err) {
      console.warn("[propose-first] failed", err);
      dispatch({
        type: "AGENT_MESSAGE",
        payload: {
          id: randomUUID(),
          type: "error",
          content: "Something went wrong starting your trip planning. Please try again.",
          context: "propose_first_error",
          timestamp: Date.now(),
        },
      });
    }
  }, [connect]);

  const openSlotCard = useCallback((slotKey: SlotKey) => {
    dispatch({ type: "OPEN_SLOT_CARD", payload: slotKey });
  }, []);

  const removeAssumedSlot = useCallback((slotKey: string) => {
    dispatch({ type: "REMOVE_ASSUMED_SLOT", payload: slotKey });
  }, []);

  const moodTransition = useCallback(
    (affectedSlots: SlotKey[], kind: 'edit' | 'correction' = 'edit') => {
      dispatch({ type: 'MOOD_TRANSITION', payload: { kind, affectedSlots } });
    },
    []
  );

  const hydrateFromHistory = useCallback(async (sessionId: string): Promise<number> => {
    try {
      const events = await api.sessions.events(sessionId);
      if (events.length > 0) {
        dispatch({ type: "HYDRATE_HISTORY", payload: events });
        return events[events.length - 1].sse_id;
      }
    } catch (err) {
      console.warn("[SSE] hydrateFromHistory failed", err);
    }
    return 0;
  }, []);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, []);

  return { state, connect, disconnect, hydrateFromHistory, proposeFirst, openSlotCard, removeAssumedSlot, moodTransition };
}
