import { useCallback, useEffect, useReducer, useRef } from "react";
import { initialStreamState, streamReducer } from "../reducers/streamReducer";
import type { StreamState } from "../types/stream";

interface UseStreamContextReturn {
  state: StreamState;
  connect: (sessionId: string) => void;
  disconnect: () => void;
}

export function useStreamContext(): UseStreamContextReturn {
  const [state, dispatch] = useReducer(streamReducer, initialStreamState);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback((sessionId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/v1/stream/${sessionId}`);
    eventSourceRef.current = es;

    es.onopen = () => dispatch({ type: "CONNECTED" });
    es.onerror = () => dispatch({ type: "DISCONNECTED" });

    es.addEventListener("agent.profiling.question", (e) => {
      const data = JSON.parse(e.data);
      dispatch({
        type: "AGENT_MESSAGE",
        payload: { id: crypto.randomUUID(), timestamp: Date.now(), ...data },
      });
    });

    es.addEventListener("stage.change", (e) => {
      const data = JSON.parse(e.data);
      dispatch({ type: "STAGE_CHANGE", payload: data.stage });
    });

    es.addEventListener("agent.error", (e) => {
      const data = JSON.parse(e.data);
      dispatch({ type: "ERROR", payload: data.message });
    });

    es.addEventListener("agent.compliance.flag", (e) => {
      const data = JSON.parse(e.data);
      dispatch({ type: "COMPLIANCE_FLAG", payload: data });
    });

    es.addEventListener("proposal.ready", (e) => {
      const data = JSON.parse(e.data);
      dispatch({
        type: "AGENT_MESSAGE",
        payload: {
          id: crypto.randomUUID(),
          type: "proposal",
          content: "Proposal ready",
          context: "",
          timestamp: Date.now(),
        },
      });
    });
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      dispatch({ type: "DISCONNECTED" });
    }
  }, []);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return { state, connect, disconnect };
}
