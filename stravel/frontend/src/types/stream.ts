export type WorkflowStage =
  | "idle"
  | "profiling"
  | "calculating"
  | "proposing"
  | "validating"
  | "complete";

export interface StreamMessage {
  id: string;
  type: "question" | "result" | "proposal" | "error";
  content: string;
  context: string;
  timestamp: number;
}

export interface ComplianceFlag {
  severity: "block" | "warning";
  check: string;
  message: string;
  alternative: string;
}

export interface StreamState {
  status: WorkflowStage;
  messages: StreamMessage[];
  complianceFlags: ComplianceFlag[];
  error: string | null;
  isConnected: boolean;
}

export type StreamAction =
  | { type: "AGENT_MESSAGE"; payload: StreamMessage }
  | { type: "COMPLIANCE_FLAG"; payload: ComplianceFlag }
  | { type: "STAGE_CHANGE"; payload: WorkflowStage }
  | { type: "ERROR"; payload: string }
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "RESET" };
