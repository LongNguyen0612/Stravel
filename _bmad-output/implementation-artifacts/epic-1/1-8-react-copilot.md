# Story 1.8: React Copilot Sidebar & Profile Form

Status: done

## Story

As a travel agent,
I want a split-screen web interface with a client data panel on the left and AI copilot sidebar on the right,
so that I can enter client information while seeing AI suggestions in real time.

## Acceptance Criteria

1. The React frontend is set up with TypeScript and Vite, project scaffolded under `frontend/src/` matching the architecture specification
2. A split-screen layout renders with `SessionPanel` on the left and `CopilotSidebar` on the right when a travel agent opens an advisory session
3. The `CopilotSidebar` connects to the SSE endpoint (`GET /api/v1/stream/{session_id}`) and displays streaming messages using `useReducer` (NOT `useState`)
4. `useStreamContext` hook manages the SSE connection lifecycle and distinguishes message types (explicit query vs proactive insight)
5. `StreamMessage`, `TypingIndicator`, and `MessageBubble` components exist in `components/shared/` with `data-testid` attributes for E2E testing
6. `ProfileForm` in `components/b2b/` allows entering and editing traveler profile data, calling `PATCH /api/v1/traveler_profiles/{profile_id}`
7. `SessionList` in `components/b2b/` shows all sessions for the agent with create/resume/archive actions
8. The sidebar shows which workflow stage is active (profiling / calculating / proposing / validating) with visual differentiation
9. The frontend uses auto-generated TypeScript types from the FastAPI OpenAPI schema
10. All interactive components have `data-testid` attributes for Playwright E2E testing (Story 6.3 dependency)

## Tasks

- [x] Task 1: Scaffold React + TypeScript + Vite project (AC: #1)
  - [x] Initialize Vite project with React + TypeScript template under `frontend/`
  - [x] Install dependencies: `react-router-dom`, CSS modules support
  - [x] Configure `vite.config.ts` with API proxy to `http://localhost:8000` for `/api/v1/`
  - [x] Configure `tsconfig.json` with strict mode, path aliases (`@/` -> `src/`)
  - [x] Create `src/main.tsx` and `src/App.tsx` with React Router setup
  - [x] Create directory structure: `components/shared/`, `components/b2b/`, `components/b2c/`, `hooks/`, `reducers/`, `services/`, `types/`, `styles/`
  - [x] Verify `npm run dev` starts the dev server successfully

- [x] Task 2: Auto-generate TypeScript types from OpenAPI (AC: #9)
  - [x] Install `openapi-typescript` as a dev dependency
  - [x] Add `npm run generate-types` script that fetches `http://localhost:8000/openapi.json` and generates `types/api.ts`
  - [x] Generate initial types from the running FastAPI backend
  - [x] Create `types/stream.ts` with SSE event type definitions (see Dev Notes)
  - [x] Create `types/domain.ts` with frontend-specific domain types (TravelerProfile, StreamMessage, ComplianceFlag, WorkflowStage)

- [x] Task 3: Implement SSE client service (AC: #3, #4)
  - [x] Create `services/sseClient.ts` — EventSource wrapper with reconnection logic
  - [x] Implement `connect(sessionId: string)` returning an EventSource instance
  - [x] Implement event listener registration for all SSE event types: `agent.profiling.question`, `agent.compliance.flag`, `stage.change`, `agent.error`, `proposal.ready`
  - [x] Implement auto-reconnection with exponential backoff on connection drop
  - [x] Implement `disconnect()` to clean up EventSource
  - [x] Add connection state tracking: `connecting`, `connected`, `disconnected`, `error`

- [x] Task 4: Implement API client service (AC: #6, #7, #9)
  - [x] Create `services/apiClient.ts` with base configuration (base URL from env, JSON headers)
  - [x] Implement session endpoints: `createSession()`, `getSession(id)`, `listSessions()`, `updateSessionStatus(id, status)`
  - [x] Implement profile endpoints: `getProfile(id)`, `updateProfile(id, data)`
  - [x] Implement auth-aware request wrapper (JWT token from storage)
  - [x] All methods must use auto-generated types from `types/api.ts`

- [x] Task 5: Implement streamReducer (AC: #3)
  - [x] Create `reducers/streamReducer.ts` with `useReducer` pattern
  - [x] Define `StreamState` type: `status`, `messages`, `complianceFlags`, `error`, `activeStage`
  - [x] Define action types: `MESSAGE_RECEIVED`, `STAGE_CHANGED`, `COMPLIANCE_FLAG`, `ERROR`, `CONNECTION_STATUS_CHANGED`, `CLEAR_MESSAGES`
  - [x] Implement reducer function handling all action types with immutable state updates
  - [x] Export initial state constant
  - [x] See Dev Notes for full reducer pattern

- [x] Task 6: Implement useStreamContext hook (AC: #3, #4)
  - [x] Create `hooks/useStreamContext.ts` — React Context + Provider wrapping `sseClient` and `streamReducer`
  - [x] Implement `StreamProvider` component that manages SSE connection lifecycle
  - [x] Dispatch reducer actions for each incoming SSE event type
  - [x] Distinguish between dual-context message types: explicit query responses vs proactive insights
  - [x] Expose: `state` (StreamState), `connect(sessionId)`, `disconnect()`, `sendMessage(content)` via context
  - [x] Handle cleanup on unmount (disconnect SSE, clear state)

- [x] Task 7: Implement shared components (AC: #5, #10)
  - [x] Create `components/shared/StreamMessage.tsx` — renders a single streaming message with role indicator (agent/system), supports incremental text reveal
    - [x] Props: `message: StreamMessage`, `isStreaming: boolean`
    - [x] `data-testid="stream-message"` on container, `data-testid="stream-message-content"` on text
  - [x] Create `components/shared/TypingIndicator.tsx` — animated dots indicating agent is processing
    - [x] `data-testid="typing-indicator"`
  - [x] Create `components/shared/MessageBubble.tsx` — styled wrapper for messages, differentiates agent vs user messages
    - [x] Props: `role: 'agent' | 'user' | 'system'`, `children: ReactNode`
    - [x] `data-testid="message-bubble"` with `data-role` attribute

- [x] Task 8: Implement CopilotLayout (AC: #2)
  - [x] Create `components/b2b/CopilotLayout.tsx` — split-screen container using CSS Grid or Flexbox
  - [x] Left panel: `SessionPanel` (60% width)
  - [x] Right panel: `CopilotSidebar` (40% width)
  - [x] Responsive: stack vertically on screens < 1024px
  - [x] `data-testid="copilot-layout"`
  - [x] Wrap children with `StreamProvider` from `useStreamContext`

- [x] Task 9: Implement CopilotSidebar (AC: #3, #8, #10)
  - [x] Create `components/b2b/CopilotSidebar.tsx` — right panel displaying streaming AI output
  - [x] Show active workflow stage indicator at top: profiling (blue), calculating (amber), proposing (green), validating (purple)
  - [x] Render message list from `useStreamContext` state using `StreamMessage` and `MessageBubble`
  - [x] Show `TypingIndicator` when agent is processing
  - [x] Auto-scroll to latest message
  - [x] `data-testid="copilot-sidebar"`, `data-testid="stage-indicator"`, `data-testid="message-list"`

- [x] Task 10: Implement SessionPanel (AC: #2, #6)
  - [x] Create `components/b2b/SessionPanel.tsx` — left panel containing session context and profile form
  - [x] Display current session metadata (ID, status, created date)
  - [x] Embed `ProfileForm` component
  - [x] `data-testid="session-panel"`

- [x] Task 11: Implement ProfileForm (AC: #6, #10)
  - [x] Create `components/b2b/ProfileForm.tsx` — form for traveler profile entry and editing
  - [x] Fields: traveler count, travel dates (start/end or flexibility), budget range (min/max, currency), destination preferences (multi-select or free text), special needs (dietary, mobility, age constraints)
  - [x] Controlled form state with validation
  - [x] Submit calls `PATCH /api/v1/traveler_profiles/{profile_id}` via `apiClient`
  - [x] Display success/error feedback
  - [x] Pre-populate fields when editing existing profile
  - [x] `data-testid="profile-form"`, `data-testid="profile-submit"`, `data-testid="profile-field-{name}"` for each field

- [x] Task 12: Implement SessionList (AC: #7, #10)
  - [x] Create `components/b2b/SessionList.tsx` — list of advisory sessions with actions
  - [x] Fetch sessions from `GET /api/v1/advisory_sessions` via `apiClient`
  - [x] Display: session ID (truncated), status badge, creation date, client name (if available)
  - [x] Actions per session: Resume (navigate to session), Archive (update status)
  - [x] Create new session button at top
  - [x] `data-testid="session-list"`, `data-testid="session-item"`, `data-testid="create-session-btn"`

- [x] Task 13: Wire up routing and page views (AC: #1, #2)
  - [x] Configure React Router routes:
    - [x] `/` — redirect to `/sessions`
    - [x] `/sessions` — `SessionList` view
    - [x] `/sessions/:sessionId` — `CopilotLayout` view (split-screen with sidebar)
  - [x] Add navigation between views
  - [x] Connect `CopilotLayout` to SSE stream on mount using session ID from URL params

- [x] Task 14: Add styles (AC: #2, #8)
  - [x] Create CSS modules for all components following `styles.camelCase` convention
  - [x] Implement consistent design tokens: colors for workflow stages, spacing scale, typography
  - [x] Ensure split-screen layout works at common resolutions (1280x720 and above)
  - [x] Style workflow stage indicator with color coding

- [x] Task 15: Verify end-to-end integration (AC: #1 through #10)
  - [x] Verify `npm run dev` starts frontend with API proxy
  - [x] Verify `npm run generate-types` produces valid TypeScript types
  - [x] Verify `SessionList` loads and displays sessions from backend
  - [x] Verify `CopilotSidebar` connects to SSE and renders streaming messages
  - [x] Verify `ProfileForm` submits and updates profile data
  - [x] Verify all `data-testid` attributes are present on interactive elements
  - [x] Verify responsive layout stacking on narrow viewport

## Dev Notes

### Component Hierarchy

```
App
  Router
    /sessions -> SessionListPage
      SessionList
        SessionItem (x N)
    /sessions/:id -> CopilotPage
      StreamProvider (useStreamContext)
        CopilotLayout
          SessionPanel (left, 60%)
            SessionHeader
            ProfileForm
          CopilotSidebar (right, 40%)
            StageIndicator
            MessageList
              MessageBubble
                StreamMessage
            TypingIndicator
```

### useReducer Pattern for Streaming State (reducers/streamReducer.ts)

```typescript
// --- State ---
export type WorkflowStage = 'profiling' | 'calculating' | 'proposing' | 'validating' | 'complete';

export interface StreamMessage {
  id: string;
  type: 'question' | 'insight' | 'result' | 'error';
  content: string;
  context?: string;           // e.g., "family_detected", "budget_warning"
  source: 'explicit' | 'proactive';  // dual-context distinction
  timestamp: number;
}

export interface ComplianceFlag {
  check: string;
  severity: 'pass' | 'warning' | 'block';
  message: string;
  alternative?: string;
}

export interface StreamState {
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  activeStage: WorkflowStage;
  messages: StreamMessage[];
  complianceFlags: ComplianceFlag[];
  isAgentProcessing: boolean;
  error: string | null;
}

export const initialStreamState: StreamState = {
  connectionStatus: 'idle',
  activeStage: 'profiling',
  messages: [],
  complianceFlags: [],
  isAgentProcessing: false,
  error: null,
};

// --- Actions ---
export type StreamAction =
  | { type: 'CONNECTION_STATUS_CHANGED'; payload: StreamState['connectionStatus'] }
  | { type: 'MESSAGE_RECEIVED'; payload: StreamMessage }
  | { type: 'STAGE_CHANGED'; payload: WorkflowStage }
  | { type: 'COMPLIANCE_FLAG'; payload: ComplianceFlag }
  | { type: 'AGENT_PROCESSING'; payload: boolean }
  | { type: 'ERROR'; payload: string }
  | { type: 'CLEAR_MESSAGES' };

// --- Reducer ---
export function streamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case 'CONNECTION_STATUS_CHANGED':
      return { ...state, connectionStatus: action.payload };
    case 'MESSAGE_RECEIVED':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        isAgentProcessing: false,
      };
    case 'STAGE_CHANGED':
      return { ...state, activeStage: action.payload };
    case 'COMPLIANCE_FLAG':
      return {
        ...state,
        complianceFlags: [...state.complianceFlags, action.payload],
      };
    case 'AGENT_PROCESSING':
      return { ...state, isAgentProcessing: action.payload };
    case 'ERROR':
      return { ...state, error: action.payload, isAgentProcessing: false };
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [], complianceFlags: [], error: null };
    default:
      return state;
  }
}
```

### SSE Connection Hook Pattern (hooks/useStreamContext.ts)

```typescript
import { createContext, useContext, useReducer, useCallback, useRef, useEffect, ReactNode } from 'react';
import { streamReducer, initialStreamState, StreamState, StreamAction } from '../reducers/streamReducer';
import { SSEClient } from '../services/sseClient';

interface StreamContextValue {
  state: StreamState;
  connect: (sessionId: string) => void;
  disconnect: () => void;
}

const StreamContext = createContext<StreamContextValue | null>(null);

export function StreamProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(streamReducer, initialStreamState);
  const sseRef = useRef<SSEClient | null>(null);

  const connect = useCallback((sessionId: string) => {
    // Disconnect existing connection
    sseRef.current?.disconnect();

    dispatch({ type: 'CONNECTION_STATUS_CHANGED', payload: 'connecting' });

    const client = new SSEClient(sessionId);

    client.on('agent.profiling.question', (data) => {
      dispatch({
        type: 'MESSAGE_RECEIVED',
        payload: {
          id: crypto.randomUUID(),
          type: 'question',
          content: data.content,
          context: data.context,
          source: 'explicit',
          timestamp: Date.now(),
        },
      });
    });

    client.on('stage.change', (data) => {
      dispatch({ type: 'STAGE_CHANGED', payload: data.stage });
    });

    client.on('agent.error', (data) => {
      dispatch({ type: 'ERROR', payload: data.message });
    });

    client.on('agent.compliance.flag', (data) => {
      dispatch({
        type: 'COMPLIANCE_FLAG',
        payload: {
          check: data.check,
          severity: data.severity,
          message: data.message,
          alternative: data.alternative,
        },
      });
    });

    client.onStatusChange((status) => {
      dispatch({ type: 'CONNECTION_STATUS_CHANGED', payload: status });
    });

    client.connect();
    sseRef.current = client;
  }, []);

  const disconnect = useCallback(() => {
    sseRef.current?.disconnect();
    sseRef.current = null;
    dispatch({ type: 'CONNECTION_STATUS_CHANGED', payload: 'disconnected' });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sseRef.current?.disconnect();
    };
  }, []);

  return (
    <StreamContext.Provider value={{ state, connect, disconnect }}>
      {children}
    </StreamContext.Provider>
  );
}

export function useStreamContext(): StreamContextValue {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error('useStreamContext must be used within a StreamProvider');
  }
  return context;
}
```

### SSE Client Service Pattern (services/sseClient.ts)

```typescript
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export class SSEClient {
  private eventSource: EventSource | null = null;
  private sessionId: string;
  private listeners: Map<string, (data: any) => void> = new Map();
  private statusCallback: ((status: ConnectionStatus) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  on(eventType: string, callback: (data: any) => void): void {
    this.listeners.set(eventType, callback);
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusCallback = callback;
  }

  connect(): void {
    const url = `/api/v1/stream/${this.sessionId}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      this.statusCallback?.('connected');
    };

    this.eventSource.onerror = () => {
      this.statusCallback?.('error');
      this.attemptReconnect();
    };

    // Register all event listeners
    for (const [eventType, callback] of this.listeners) {
      this.eventSource.addEventListener(eventType, (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        callback(data);
      });
    }
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.statusCallback?.('disconnected');
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    setTimeout(() => this.connect(), delay);
  }
}
```

### SSE Event Types (types/stream.ts)

Map to the backend SSE event format defined in Story 1.7:

```typescript
// SSE event names (dot-separated, lowercase per architecture)
export type SSEEventType =
  | 'agent.profiling.question'
  | 'agent.profiling.insight'
  | 'agent.calculation.result'
  | 'agent.compliance.flag'
  | 'agent.error'
  | 'stage.change'
  | 'proposal.ready';

// SSE data payloads per event type
export interface SSEQuestionData {
  type: 'question';
  content: string;
  context?: string;
}

export interface SSEInsightData {
  type: 'insight';
  content: string;
  context?: string;
}

export interface SSEStageChangeData {
  stage: 'profiling' | 'calculating' | 'proposing' | 'validating';
}

export interface SSEComplianceFlagData {
  type: 'flag';
  severity: 'block' | 'warning' | 'pass';
  check: string;
  message: string;
  alternative?: string;
}

export interface SSEErrorData {
  agent: string;
  message: string;
}

export interface SSEProposalReadyData {
  type: 'proposal';
  session_id: string;
}
```

### data-testid Contract

All interactive elements must have `data-testid` for Playwright (Story 6.3 depends on this):

| Component | data-testid | Purpose |
|---|---|---|
| CopilotLayout | `copilot-layout` | Layout container |
| CopilotSidebar | `copilot-sidebar` | Sidebar panel |
| SessionPanel | `session-panel` | Left panel |
| StageIndicator | `stage-indicator` | Active workflow stage |
| MessageList | `message-list` | Scrollable message area |
| StreamMessage | `stream-message` | Individual message |
| StreamMessage content | `stream-message-content` | Message text |
| TypingIndicator | `typing-indicator` | Processing animation |
| MessageBubble | `message-bubble` | Message wrapper (with `data-role`) |
| ProfileForm | `profile-form` | Profile entry form |
| ProfileForm submit | `profile-submit` | Submit button |
| ProfileForm fields | `profile-field-{name}` | Each form field |
| SessionList | `session-list` | Session list container |
| SessionItem | `session-item` | Individual session row |
| Create Session btn | `create-session-btn` | New session button |

### Workflow Stage Colors

| Stage | Color | CSS Variable |
|---|---|---|
| profiling | Blue (#3B82F6) | `--stage-profiling` |
| calculating | Amber (#F59E0B) | `--stage-calculating` |
| proposing | Green (#10B981) | `--stage-proposing` |
| validating | Purple (#8B5CF6) | `--stage-validating` |
| complete | Gray (#6B7280) | `--stage-complete` |

### File Structure — MUST Match Architecture

```
frontend/
  Dockerfile
  package.json
  tsconfig.json
  vite.config.ts
  src/
    main.tsx
    App.tsx
    components/
      shared/
        StreamMessage.tsx
        TypingIndicator.tsx
        MessageBubble.tsx
        StreamMessage.module.css
        TypingIndicator.module.css
        MessageBubble.module.css
      b2b/
        CopilotLayout.tsx
        CopilotSidebar.tsx
        SessionPanel.tsx
        ProfileForm.tsx
        SessionList.tsx
        CopilotLayout.module.css
        CopilotSidebar.module.css
        SessionPanel.module.css
        ProfileForm.module.css
        SessionList.module.css
      b2c/                          # EMPTY — Story 5.1
    hooks/
      useStreamContext.ts
      useAdvisorySession.ts         # Stub — future use
    reducers/
      streamReducer.ts
    services/
      apiClient.ts
      sseClient.ts
    types/
      api.ts                        # Auto-generated from OpenAPI
      stream.ts                     # SSE event types
      domain.ts                     # Frontend domain types
    styles/
      global.css                    # CSS custom properties, design tokens
      variables.css                 # Stage colors, spacing scale
```

### Dependencies (package.json)

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "openapi-typescript": "^7.4.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
```

### API Proxy Configuration (vite.config.ts)

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
```

### Anti-Patterns -- DO NOT

- **DO NOT** use `useState` for streaming state -- use `useReducer` only (architecture mandate)
- **DO NOT** install Redux or Zustand -- React Context + `useReducer` is sufficient for 2 surfaces
- **DO NOT** import between `b2b/` and `b2c/` -- shared code goes in `shared/`
- **DO NOT** hardcode API URLs -- use Vite proxy and environment variables
- **DO NOT** skip `data-testid` on interactive elements -- Playwright E2E tests depend on them
- **DO NOT** implement B2C demo components -- that is Story 5.1
- **DO NOT** implement auth/login UI -- this story assumes auth token is available (Story 1.6 provides it)
- **DO NOT** use `any` type -- all API responses must use auto-generated or hand-written TypeScript types
- **DO NOT** create a generic `utils.ts` -- name files by purpose

### Prerequisites

- Story 1.2 (Database Models & Advisory Session API) -- provides the REST endpoints this frontend calls
- Story 1.6 (Auth, Tenant & Multi-tenancy) -- provides JWT auth that apiClient sends
- Story 1.7 (SSE Streaming Endpoint) -- provides the SSE endpoint that CopilotSidebar connects to

### Testing Approach

- Unit tests are NOT required in this story (no Vitest/Jest setup specified in architecture)
- All interactive components must have `data-testid` attributes -- these are the test contract for Story 6.3 (Playwright E2E)
- Manual verification checklist in Task 15 covers integration with backend

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Project Structure (Target State)]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md -- API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md -- SSE Event Format]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 1, Story 1.8]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 6.3 (Playwright E2E traceability)]

## Dev Agent Record

### Agent Model Used

(To be filled by implementing agent)

### Debug Log References

(To be filled during implementation)

### Completion Notes List

(To be filled on completion)

### Change Log

- 2026-05-24: Story spec created -- ready for dev

### File List

(To be filled on completion with all created/modified files)
