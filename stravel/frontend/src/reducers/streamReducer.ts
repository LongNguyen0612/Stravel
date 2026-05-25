import type { StreamAction, StreamState } from "../types/stream";

export const initialStreamState: StreamState = {
  status: "idle",
  messages: [],
  complianceFlags: [],
  error: null,
  isConnected: false,
};

export function streamReducer(
  state: StreamState,
  action: StreamAction
): StreamState {
  switch (action.type) {
    case "AGENT_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "COMPLIANCE_FLAG":
      return {
        ...state,
        complianceFlags: [...state.complianceFlags, action.payload],
      };
    case "STAGE_CHANGE":
      return { ...state, status: action.payload };
    case "ERROR":
      return { ...state, error: action.payload };
    case "CONNECTED":
      return { ...state, isConnected: true, error: null };
    case "DISCONNECTED":
      return { ...state, isConnected: false };
    case "RESET":
      return initialStreamState;
    default:
      return state;
  }
}
