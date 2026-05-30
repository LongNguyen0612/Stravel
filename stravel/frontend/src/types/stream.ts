import type { CardUpdateEvent, SlotKey } from './domain';

export type WorkflowStage =
  | "idle"
  | "profiling"
  | "calculating"
  | "proposing"
  | "validating"
  | "complete";

export type SSEPhase = 'idle' | 'streaming' | 'complete' | 'error';

export interface StreamMessage {
  id: string;
  type: "question" | "result" | "proposal" | "error";
  content: string;
  context: string;
  timestamp: number;
}

export interface ComplianceFlag {
  severity: "block" | "warning" | "pass";
  check: string;
  message: string;
  alternative: string;
}

export interface StreamState {
  status: WorkflowStage;
  messages: StreamMessage[];
  complianceFlags: ComplianceFlag[];
  cardUpdates: Record<string, CardUpdateEvent>;
  ssePhase: SSEPhase;
  error: string | null;
  isConnected: boolean;
  slotState: Partial<Record<SlotKey, string | string[]>>;
  assumedSlots: string[];
  openSlotKey: SlotKey | null;
}

export interface SessionEventRecord {
  id: string;
  session_id: string;
  sse_id: number;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

export type StreamAction =
  | { type: "AGENT_MESSAGE"; payload: StreamMessage }
  | { type: "COMPLIANCE_FLAG"; payload: ComplianceFlag }
  | { type: "STAGE_CHANGE"; payload: WorkflowStage }
  | { type: "CARD_UPDATE"; payload: CardUpdateEvent }
  | { type: "SSE_PHASE_CHANGE"; payload: SSEPhase }
  | { type: "ERROR"; payload: string }
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "RESET" }
  | { type: 'SLOT_UPDATE'; payload: { slotKey: SlotKey; value: string | string[] } }
  | { type: "HYDRATE_HISTORY"; payload: SessionEventRecord[] }
  | { type: "SET_ASSUMED_SLOTS"; payload: string[] }
  | { type: "OPEN_SLOT_CARD"; payload: SlotKey }
  | { type: "REMOVE_ASSUMED_SLOT"; payload: string }
  | { type: 'MOOD_TRANSITION'; payload: { kind: 'edit' | 'correction'; affectedSlots: SlotKey[] } };
