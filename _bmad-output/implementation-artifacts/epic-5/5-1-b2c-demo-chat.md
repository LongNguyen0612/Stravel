# Story 5.1: B2C Demo Chat Interface

Status: draft

## Story

As a consumer,
I want to plan a Vietnam trip through a conversational chat interface without creating an account,
so that I can experience the advisory workflow quickly and easily.

## Acceptance Criteria

1. The B2C demo page is accessible at `/demo` with no login or account creation required
2. The chat interface guides fact-finding through natural conversation (not a form) -- the consumer types messages and the Profiling Agent responds with follow-up questions
3. After profile completion, calculations, proposal generation, and compliance checks run automatically through the full 4-stage workflow without manual intervention
4. The consumer sees the Proposal inline in the chat with a formatted view and an export option (PDF download)
5. `api/v1/demo.py` handles all B2C requests without JWT authentication -- uses a synthetic `tenant_id` of `"demo"` and ephemeral session state
6. Session state persists for the browser session (via session ID stored in the client) but is not saved long-term -- demo sessions are cleaned up after inactivity (configurable TTL)
7. IP-based rate limiting prevents abuse -- configurable maximum sessions per IP per hour (default: 5), returning HTTP 429 when exceeded
8. `components/b2c/DemoLayout.tsx`, `ChatInterface.tsx`, `ProposalInline.tsx`, and `ExportButton.tsx` are implemented with `data-testid` attributes for Playwright E2E testing
9. Shared components (`StreamMessage`, `TypingIndicator`, `MessageBubble`) from `components/shared/` are reused -- no duplication
10. The chat interface shows which workflow stage is active with a progress indicator (profiling -> calculating -> proposing -> validating -> complete)

## Tasks

- [ ] Task 1: Create demo API schemas (AC: #5)
  - [ ] Create `backend/app/schemas/demo.py`
  - [ ] Define `DemoSessionCreateResponse` with `session_id: str` and `greeting: str`
  - [ ] Define `DemoChatRequest` with `session_id: str` and `message: str`
  - [ ] Define `DemoChatResponse` with `session_id: str`, `messages: list[AgentMessage]`, `stage: str`, `profile_complete: bool`
  - [ ] Define `DemoProposalResponse` with `session_id: str`, `proposal: dict`, `compliance_report: dict`, `export_available: bool`
  - [ ] Define `DemoExportResponse` with `download_url: str` and `filename: str`

- [ ] Task 2: Implement IP-based rate limiter (AC: #7)
  - [ ] Create `backend/app/core/rate_limiter.py`
  - [ ] Implement `DemoRateLimiter` class with in-memory tracking (dict of IP -> list of timestamps)
  - [ ] Add `max_sessions_per_ip_per_hour` setting to `core/config.py` (default: 5)
  - [ ] Implement `check_rate_limit(ip: str) -> None` that raises `AppError(code="RATE_LIMITED", status_code=429)` when exceeded
  - [ ] Implement cleanup of expired entries (entries older than 1 hour)
  - [ ] Create FastAPI dependency `require_rate_limit` that extracts client IP from `Request` and calls `check_rate_limit`
  - [ ] Handle `X-Forwarded-For` header for proxied environments
  - [ ] Add unit tests in `backend/app/core/tests/test_rate_limiter.py`

- [ ] Task 3: Implement demo session manager (AC: #5, #6)
  - [ ] Create `backend/app/services/demo_session.py`
  - [ ] Implement `DemoSessionManager` class with in-memory session storage (dict of session_id -> DemoSessionState)
  - [ ] Define `DemoSessionState` dataclass with: `session_id`, `created_at`, `last_active`, `ip_address`, `advisory_state: AdvisoryState`, `chat_history: list[dict]`, `profile_data: dict`
  - [ ] Implement `create_session(ip: str) -> DemoSessionState`
  - [ ] Implement `get_session(session_id: str) -> DemoSessionState | None`
  - [ ] Implement `update_session(session_id: str, state: DemoSessionState) -> None`
  - [ ] Implement `cleanup_expired(ttl_hours: int = 2) -> int` returning count of cleaned sessions
  - [ ] Add `demo_session_ttl_hours` setting to `core/config.py` (default: 2)
  - [ ] Module-level singleton `_demo_manager` with `get_demo_session_manager()` getter
  - [ ] Add unit tests in `backend/app/services/tests/test_demo_session.py`

- [ ] Task 4: Implement demo API endpoints (AC: #1, #2, #3, #4, #5, #7)
  - [ ] Create `backend/app/api/v1/demo.py`
  - [ ] Implement `POST /api/v1/demo/sessions` -- creates a new demo session, returns greeting message, applies rate limiting
  - [ ] Implement `POST /api/v1/demo/chat` -- accepts user message, runs it through the Profiling Agent, returns agent response(s)
  - [ ] Implement `GET /api/v1/demo/sessions/{session_id}` -- returns current session state (stage, profile completeness, proposal availability)
  - [ ] Implement `GET /api/v1/demo/sessions/{session_id}/proposal` -- returns the generated proposal inline
  - [ ] Implement `POST /api/v1/demo/sessions/{session_id}/export` -- triggers PDF export and returns download URL
  - [ ] All endpoints use `tenant_id = "demo"` -- no JWT dependency
  - [ ] Register demo router in `api/v1/router.py` with prefix `/demo`
  - [ ] Add structlog logging with `session_id` and `tenant_id="demo"` context

- [ ] Task 5: Wire demo chat to the LangGraph orchestrator (AC: #2, #3)
  - [ ] In `api/v1/demo.py`, the `POST /demo/chat` endpoint invokes the LangGraph orchestrator
  - [ ] After each user message during profiling stage, run the profiling node to generate the next question
  - [ ] Detect profile completion -- when the Profiling Agent signals minimum required fields are met
  - [ ] On profile completion, automatically transition through calculation -> proposal -> compliance nodes
  - [ ] Publish SSE events during the automatic workflow run so the frontend can show progress
  - [ ] Use a demo-specific SSE stream endpoint: `GET /api/v1/demo/stream/{session_id}` (no auth)
  - [ ] Handle errors by appending to `AdvisoryState.errors` and returning error messages in the chat response

- [ ] Task 6: Implement DemoLayout component (AC: #8, #10)
  - [ ] Create `frontend/src/components/b2c/DemoLayout.tsx`
  - [ ] Full-width centered layout (max-width 800px) -- single-column chat interface, not split-screen
  - [ ] Header with STravel branding and "Demo - Plan Your Vietnam Trip" title
  - [ ] Workflow stage progress bar at top showing current stage with step indicators
  - [ ] Render `ChatInterface` as the main content area
  - [ ] `data-testid="demo-layout"`, `data-testid="demo-stage-progress"`

- [ ] Task 7: Implement ChatInterface component (AC: #2, #8, #9)
  - [ ] Create `frontend/src/components/b2c/ChatInterface.tsx`
  - [ ] Scrollable message area displaying conversation history
  - [ ] Each message rendered using `MessageBubble` from `components/shared/` with `sender="agent"` or `sender="user"`
  - [ ] Agent messages rendered using `StreamMessage` from `components/shared/`
  - [ ] `TypingIndicator` from `components/shared/` shown while agent is processing
  - [ ] Text input at the bottom with send button
  - [ ] Input disabled when agent is processing or workflow is past profiling stage
  - [ ] On send: POST message to `/api/v1/demo/chat`, display user message immediately, show typing indicator, display agent response when received
  - [ ] Connect to demo SSE stream for real-time stage updates during automated workflow
  - [ ] `data-testid="chat-interface"`, `data-testid="chat-messages"`, `data-testid="chat-input"`, `data-testid="chat-send-btn"`

- [ ] Task 8: Implement ProposalInline component (AC: #4, #8)
  - [ ] Create `frontend/src/components/b2c/ProposalInline.tsx`
  - [ ] Renders the proposal within the chat flow as a rich card
  - [ ] Sections: itinerary summary (day-by-day), accommodation options (comparison table), budget breakdown (category list), booking action items
  - [ ] Compliance warnings displayed inline with severity badges (reuse `ComplianceBadge` from `components/shared/` if available)
  - [ ] Collapsible sections for detailed content
  - [ ] `data-testid="proposal-inline"`, `data-testid="proposal-itinerary"`, `data-testid="proposal-accommodations"`, `data-testid="proposal-budget"`, `data-testid="proposal-actions"`

- [ ] Task 9: Implement ExportButton component (AC: #4, #8)
  - [ ] Create `frontend/src/components/b2c/ExportButton.tsx`
  - [ ] Renders below `ProposalInline` when proposal is available
  - [ ] On click: calls `POST /api/v1/demo/sessions/{session_id}/export`
  - [ ] Shows loading state during export generation
  - [ ] Triggers browser download when export URL is returned
  - [ ] `data-testid="export-button"`

- [ ] Task 10: Add demo API client methods (AC: #2, #4)
  - [ ] Add `demo` namespace to `frontend/src/services/apiClient.ts`
  - [ ] Implement `demo.createSession()` -> calls `POST /api/v1/demo/sessions`
  - [ ] Implement `demo.sendMessage(sessionId, message)` -> calls `POST /api/v1/demo/chat`
  - [ ] Implement `demo.getSession(sessionId)` -> calls `GET /api/v1/demo/sessions/{sessionId}`
  - [ ] Implement `demo.getProposal(sessionId)` -> calls `GET /api/v1/demo/sessions/{sessionId}/proposal`
  - [ ] Implement `demo.exportProposal(sessionId)` -> calls `POST /api/v1/demo/sessions/{sessionId}/export`

- [ ] Task 11: Add demo route to React Router (AC: #1)
  - [ ] Add `/demo` route in `App.tsx` (or routing configuration) rendering `DemoLayout`
  - [ ] Ensure `/demo` does NOT require authentication
  - [ ] On mount, auto-create a demo session via `demo.createSession()`
  - [ ] Store `session_id` in component state (not localStorage -- ephemeral)

- [ ] Task 12: Add styles for B2C components (AC: #8)
  - [ ] Create CSS modules: `DemoLayout.module.css`, `ChatInterface.module.css`, `ProposalInline.module.css`, `ExportButton.module.css`
  - [ ] Chat interface styling: centered column, chat bubble styling for user vs agent
  - [ ] Proposal card styling: clean card layout with section headers and collapsible areas
  - [ ] Stage progress bar styling using the existing workflow stage color tokens
  - [ ] Mobile-responsive: works on screens 375px and wider

- [ ] Task 13: Integration verification (AC: #1 through #10)
  - [ ] Verify `/demo` page loads without login
  - [ ] Verify greeting message appears on session creation
  - [ ] Verify user can type a message and receive an agent response
  - [ ] Verify shared components (`MessageBubble`, `StreamMessage`, `TypingIndicator`) render correctly
  - [ ] Verify stage progress updates during automated workflow
  - [ ] Verify proposal renders inline after workflow completes
  - [ ] Verify export button triggers download
  - [ ] Verify rate limiting returns 429 after exceeding threshold
  - [ ] Verify all `data-testid` attributes are present on interactive elements
  - [ ] Verify demo session does not appear in B2B session list (tenant isolation)

## Dev Notes

### Component Hierarchy

```
App
  Router
    /demo -> DemoPage
      DemoLayout
        DemoStageProgress
        ChatInterface
          MessageBubble (from shared/)
            StreamMessage (from shared/) -- for agent messages
          TypingIndicator (from shared/)
          ProposalInline -- appears in message flow after proposal stage
            ComplianceBadge (from shared/)
          ExportButton -- appears below proposal
          ChatInput
    /sessions -> SessionListPage (existing B2B)
    /sessions/:id -> CopilotPage (existing B2B)
```

### Demo API Endpoints (No Auth)

All demo endpoints bypass JWT authentication. They use `tenant_id = "demo"` as a synthetic tenant for data isolation.

```python
# api/v1/demo.py
import uuid
from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, Request

from app.core.rate_limiter import require_rate_limit
from app.schemas.demo import (
    DemoChatRequest,
    DemoChatResponse,
    DemoSessionCreateResponse,
    DemoProposalResponse,
    DemoExportResponse,
)
from app.services.demo_session import get_demo_session_manager

router = APIRouter(prefix="/demo", tags=["demo"])
logger = structlog.get_logger()

DEMO_TENANT_ID = "demo"


@router.post("/sessions", response_model=DemoSessionCreateResponse)
async def create_demo_session(
    request: Request,
    _: None = Depends(require_rate_limit),
):
    """Create a new demo advisory session. No auth required. Rate limited by IP."""
    client_ip = request.client.host if request.client else "unknown"
    manager = get_demo_session_manager()
    session_state = manager.create_session(ip=client_ip)

    structlog.contextvars.bind_contextvars(
        session_id=session_state.session_id, tenant_id=DEMO_TENANT_ID
    )
    logger.info("demo.session.created", ip=client_ip)

    return DemoSessionCreateResponse(
        session_id=session_state.session_id,
        greeting=(
            "Welcome to STravel! I'm your AI travel advisor. "
            "Let's plan your perfect Vietnam trip together. "
            "Tell me: who's traveling, when are you thinking of going, "
            "what's your budget, and what kind of experience are you looking for?"
        ),
    )


@router.post("/chat", response_model=DemoChatResponse)
async def demo_chat(
    body: DemoChatRequest,
):
    """Process a chat message in the demo session. Runs profiling agent conversationally."""
    manager = get_demo_session_manager()
    session_state = manager.get_session(body.session_id)

    if not session_state:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("DemoSession", body.session_id)

    structlog.contextvars.bind_contextvars(
        session_id=body.session_id, tenant_id=DEMO_TENANT_ID
    )

    # Add user message to chat history
    session_state.chat_history.append({
        "role": "user",
        "content": body.message,
        "timestamp": datetime.utcnow().isoformat(),
    })

    # Run profiling agent with the accumulated context
    from app.agents.orchestrator import build_graph
    from app.services.llm import get_llm_service

    llm = get_llm_service()

    if session_state.advisory_state.stage == "profiling":
        # Feed the user message into the profiling agent
        # The agent analyzes context and generates follow-up questions
        chat_context = "\n".join(
            f"{msg['role']}: {msg['content']}"
            for msg in session_state.chat_history
        )

        agent_response = await llm.generate(
            f"You are a travel advisor profiling a client for a Vietnam trip. "
            f"Based on this conversation so far:\n{chat_context}\n\n"
            f"Ask the next relevant follow-up question. If you have enough information "
            f"(who, when, budget, destinations, special needs), respond with "
            f"'PROFILE_COMPLETE:' followed by a summary."
        )

        profile_complete = agent_response.startswith("PROFILE_COMPLETE:")

        session_state.chat_history.append({
            "role": "agent",
            "content": agent_response,
            "timestamp": datetime.utcnow().isoformat(),
        })

        if profile_complete:
            # Trigger automated workflow: calculation -> proposal -> compliance
            session_state.advisory_state.stage = "calculating"
            # Workflow runs asynchronously via SSE stream
            # (see Task 5 for full orchestrator wiring)

        manager.update_session(body.session_id, session_state)

        logger.info(
            "demo.chat.processed",
            profile_complete=profile_complete,
            message_count=len(session_state.chat_history),
        )

        return DemoChatResponse(
            session_id=body.session_id,
            messages=[{
                "type": "question" if not profile_complete else "result",
                "content": agent_response,
                "context": "profile_complete" if profile_complete else "profiling",
            }],
            stage=session_state.advisory_state.stage,
            profile_complete=profile_complete,
        )

    # If past profiling, return current state info
    return DemoChatResponse(
        session_id=body.session_id,
        messages=[{
            "type": "result",
            "content": "Your trip is being planned! Watch the progress above.",
            "context": session_state.advisory_state.stage,
        }],
        stage=session_state.advisory_state.stage,
        profile_complete=True,
    )


@router.get("/sessions/{session_id}", response_model=dict)
async def get_demo_session(session_id: str):
    """Get current demo session state."""
    manager = get_demo_session_manager()
    session_state = manager.get_session(session_id)
    if not session_state:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("DemoSession", session_id)

    return {
        "session_id": session_id,
        "stage": session_state.advisory_state.stage,
        "profile_complete": session_state.advisory_state.traveler_profile is not None,
        "proposal_available": session_state.advisory_state.proposal is not None,
        "created_at": session_state.created_at.isoformat(),
    }


@router.get("/sessions/{session_id}/proposal", response_model=DemoProposalResponse)
async def get_demo_proposal(session_id: str):
    """Get the generated proposal for a demo session."""
    manager = get_demo_session_manager()
    session_state = manager.get_session(session_id)
    if not session_state:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("DemoSession", session_id)

    if not session_state.advisory_state.proposal:
        from app.core.exceptions import ValidationError
        raise ValidationError("Proposal not yet generated for this session")

    return DemoProposalResponse(
        session_id=session_id,
        proposal=session_state.advisory_state.proposal,
        compliance_report=session_state.advisory_state.compliance_report or {},
        export_available=True,
    )


@router.post("/sessions/{session_id}/export", response_model=DemoExportResponse)
async def export_demo_proposal(session_id: str):
    """Export the demo proposal as PDF."""
    manager = get_demo_session_manager()
    session_state = manager.get_session(session_id)
    if not session_state:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("DemoSession", session_id)

    if not session_state.advisory_state.proposal:
        from app.core.exceptions import ValidationError
        raise ValidationError("No proposal available for export")

    # Delegate to existing proposal export logic
    from app.agents.proposal.export import export_proposal_pdf
    filename = f"stravel-demo-{session_id[:8]}.pdf"
    download_url = await export_proposal_pdf(
        proposal=session_state.advisory_state.proposal,
        filename=filename,
    )

    logger.info("demo.proposal.exported", session_id=session_id, filename=filename)

    return DemoExportResponse(
        download_url=download_url,
        filename=filename,
    )
```

### Demo Session Manager Pattern

```python
# services/demo_session.py
import uuid
from dataclasses import dataclass, field
from datetime import datetime

import structlog

from app.agents.state import AdvisoryState

logger = structlog.get_logger()


@dataclass
class DemoSessionState:
    session_id: str
    created_at: datetime
    last_active: datetime
    ip_address: str
    advisory_state: AdvisoryState
    chat_history: list[dict] = field(default_factory=list)
    profile_data: dict = field(default_factory=dict)


class DemoSessionManager:
    """In-memory demo session storage. Sessions are ephemeral and cleaned up after TTL."""

    def __init__(self) -> None:
        self._sessions: dict[str, DemoSessionState] = {}

    def create_session(self, ip: str) -> DemoSessionState:
        session_id = str(uuid.uuid4())
        now = datetime.utcnow()
        state = DemoSessionState(
            session_id=session_id,
            created_at=now,
            last_active=now,
            ip_address=ip,
            advisory_state=AdvisoryState(
                session_id=session_id,
                tenant_id="demo",
            ),
        )
        self._sessions[session_id] = state
        logger.info("demo.session.stored", session_id=session_id)
        return state

    def get_session(self, session_id: str) -> DemoSessionState | None:
        state = self._sessions.get(session_id)
        if state:
            state.last_active = datetime.utcnow()
        return state

    def update_session(self, session_id: str, state: DemoSessionState) -> None:
        state.last_active = datetime.utcnow()
        self._sessions[session_id] = state

    def cleanup_expired(self, ttl_hours: int = 2) -> int:
        """Remove sessions older than TTL. Returns count of removed sessions."""
        now = datetime.utcnow()
        expired = [
            sid for sid, state in self._sessions.items()
            if (now - state.last_active).total_seconds() > ttl_hours * 3600
        ]
        for sid in expired:
            del self._sessions[sid]
        if expired:
            logger.info("demo.sessions.cleaned", count=len(expired))
        return len(expired)


_demo_manager = DemoSessionManager()


def get_demo_session_manager() -> DemoSessionManager:
    return _demo_manager
```

### Rate Limiter Pattern

```python
# core/rate_limiter.py
from collections import defaultdict
from datetime import datetime

import structlog
from fastapi import Request

from app.core.config import settings
from app.core.exceptions import AppError

logger = structlog.get_logger()


class DemoRateLimiter:
    """IP-based rate limiter for demo session creation.

    Phase 1: in-memory. Phase 2: swap to Redis with same interface.
    """

    def __init__(self) -> None:
        self._requests: dict[str, list[datetime]] = defaultdict(list)

    def check_rate_limit(self, ip: str) -> None:
        """Raise AppError if IP exceeds max sessions per hour."""
        now = datetime.utcnow()
        cutoff = now.timestamp() - 3600  # 1 hour window

        # Clean expired entries for this IP
        self._requests[ip] = [
            ts for ts in self._requests[ip]
            if ts.timestamp() > cutoff
        ]

        if len(self._requests[ip]) >= settings.demo_max_sessions_per_ip_per_hour:
            logger.warning("demo.rate_limit.exceeded", ip=ip, count=len(self._requests[ip]))
            raise AppError(
                code="RATE_LIMITED",
                message=f"Too many demo sessions. Maximum {settings.demo_max_sessions_per_ip_per_hour} per hour.",
                status_code=429,
            )

        self._requests[ip].append(now)

    def cleanup(self) -> None:
        """Remove all expired entries across all IPs."""
        cutoff = datetime.utcnow().timestamp() - 3600
        empty_ips = []
        for ip, timestamps in self._requests.items():
            self._requests[ip] = [ts for ts in timestamps if ts.timestamp() > cutoff]
            if not self._requests[ip]:
                empty_ips.append(ip)
        for ip in empty_ips:
            del self._requests[ip]


_rate_limiter = DemoRateLimiter()


async def require_rate_limit(request: Request) -> None:
    """FastAPI dependency for rate limiting demo endpoints."""
    # Support proxied environments
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    elif request.client:
        client_ip = request.client.host
    else:
        client_ip = "unknown"

    _rate_limiter.check_rate_limit(client_ip)
```

### Config Additions

Add these settings to `core/config.py`:

```python
# Add to Settings class
demo_max_sessions_per_ip_per_hour: int = 5
demo_session_ttl_hours: int = 2
```

### Demo Schemas

```python
# schemas/demo.py
from pydantic import BaseModel

from app.schemas.streaming import AgentMessage


class DemoSessionCreateResponse(BaseModel):
    session_id: str
    greeting: str


class DemoChatRequest(BaseModel):
    session_id: str
    message: str


class DemoChatResponse(BaseModel):
    session_id: str
    messages: list[dict]  # list of AgentMessage-like dicts
    stage: str
    profile_complete: bool


class DemoProposalResponse(BaseModel):
    session_id: str
    proposal: dict
    compliance_report: dict
    export_available: bool


class DemoExportResponse(BaseModel):
    download_url: str
    filename: str
```

### Demo SSE Stream (No Auth)

The demo needs its own SSE stream endpoint that does not require JWT authentication:

```python
# In api/v1/demo.py — add this endpoint

@router.get("/stream/{session_id}")
async def stream_demo_events(
    session_id: str,
    request: Request,
):
    """SSE endpoint for demo session. No auth required."""
    manager = get_demo_session_manager()
    session_state = manager.get_session(session_id)
    if not session_state:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("DemoSession", session_id)

    async def event_generator():
        queue = await subscribe(session_id)
        logger.info("demo.sse.connected", session_id=session_id)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"event: {event['event']}\ndata: {event['data']}\n\n"
                except TimeoutError:
                    yield f"event: heartbeat\ndata: {{\"status\": \"alive\"}}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            logger.info("demo.sse.disconnected", session_id=session_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
```

### Frontend: ChatInterface Component Pattern

```typescript
// components/b2c/ChatInterface.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageBubble } from "../shared/MessageBubble";
import { StreamMessage } from "../shared/StreamMessage";
import { TypingIndicator } from "../shared/TypingIndicator";
import { ProposalInline } from "./ProposalInline";
import { ExportButton } from "./ExportButton";
import { api } from "../../services/apiClient";
import type { StreamMessage as StreamMessageType, WorkflowStage } from "../../types/stream";
import styles from "./ChatInterface.module.css";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  context?: string;
  timestamp: number;
}

interface Props {
  sessionId: string | null;
  stage: WorkflowStage;
  proposal: Record<string, unknown> | null;
  complianceReport: Record<string, unknown> | null;
}

export function ChatInterface({ sessionId, stage, proposal, complianceReport }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!inputValue.trim() || !sessionId || isProcessing) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsProcessing(true);

    try {
      const response = await api.demo.sendMessage(sessionId, userMessage.content);

      for (const msg of response.messages) {
        const agentMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "agent",
          content: msg.content,
          context: msg.context,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, agentMessage]);
      }
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "agent",
        content: "Sorry, something went wrong. Please try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const inputDisabled = isProcessing || stage !== "profiling" && stage !== "idle";

  return (
    <div data-testid="chat-interface" className={styles.chatInterface}>
      <div data-testid="chat-messages" className={styles.messages}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} sender={msg.role === "user" ? "user" : "agent"}>
            {msg.role === "agent" ? (
              <StreamMessage
                message={{
                  id: msg.id,
                  type: "question",
                  content: msg.content,
                  context: msg.context || "",
                  timestamp: msg.timestamp,
                }}
              />
            ) : (
              <span>{msg.content}</span>
            )}
          </MessageBubble>
        ))}

        {isProcessing && <TypingIndicator />}

        {proposal && (
          <>
            <ProposalInline proposal={proposal} complianceReport={complianceReport} />
            <ExportButton sessionId={sessionId!} />
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <textarea
          data-testid="chat-input"
          className={styles.input}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            inputDisabled
              ? "Your trip is being planned..."
              : "Tell me about your dream Vietnam trip..."
          }
          disabled={inputDisabled}
          rows={1}
        />
        <button
          data-testid="chat-send-btn"
          className={styles.sendButton}
          onClick={handleSend}
          disabled={inputDisabled || !inputValue.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

### Frontend: DemoLayout Component Pattern

```typescript
// components/b2c/DemoLayout.tsx
import { useCallback, useEffect, useState } from "react";
import { ChatInterface } from "./ChatInterface";
import { api } from "../../services/apiClient";
import type { WorkflowStage } from "../../types/stream";
import styles from "./DemoLayout.module.css";

const STAGE_LABELS: Record<WorkflowStage, string> = {
  idle: "Getting Started",
  profiling: "Understanding Your Trip",
  calculating: "Calculating Options",
  proposing: "Creating Proposal",
  validating: "Checking Compliance",
  complete: "Trip Plan Ready",
};

const STAGE_ORDER: WorkflowStage[] = [
  "profiling",
  "calculating",
  "proposing",
  "validating",
  "complete",
];

export function DemoLayout() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stage, setStage] = useState<WorkflowStage>("idle");
  const [greeting, setGreeting] = useState<string>("");
  const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
  const [complianceReport, setComplianceReport] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initSession = useCallback(async () => {
    try {
      const response = await api.demo.createSession();
      setSessionId(response.session_id);
      setGreeting(response.greeting);
      setStage("profiling");
    } catch (err) {
      if (err instanceof Error && err.message.includes("429")) {
        setError("Too many sessions. Please try again later.");
      } else {
        setError("Failed to start session. Please refresh the page.");
      }
    }
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const currentStageIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div data-testid="demo-layout" className={styles.demoLayout}>
      <header className={styles.header}>
        <h1 className={styles.title}>STravel</h1>
        <p className={styles.subtitle}>Plan Your Vietnam Trip</p>
      </header>

      <nav data-testid="demo-stage-progress" className={styles.stageProgress}>
        {STAGE_ORDER.map((s, i) => (
          <div
            key={s}
            className={`${styles.stageStep} ${
              i <= currentStageIndex ? styles.stageActive : ""
            } ${i === currentStageIndex ? styles.stageCurrent : ""}`}
          >
            <span className={styles.stageNumber}>{i + 1}</span>
            <span className={styles.stageLabel}>{STAGE_LABELS[s]}</span>
          </div>
        ))}
      </nav>

      {error ? (
        <div data-testid="demo-error" className={styles.error}>
          {error}
        </div>
      ) : (
        <ChatInterface
          sessionId={sessionId}
          stage={stage}
          proposal={proposal}
          complianceReport={complianceReport}
        />
      )}
    </div>
  );
}
```

### Frontend: ProposalInline Component Pattern

```typescript
// components/b2c/ProposalInline.tsx
import { useState } from "react";
import styles from "./ProposalInline.module.css";

interface Props {
  proposal: Record<string, unknown>;
  complianceReport: Record<string, unknown> | null;
}

export function ProposalInline({ proposal, complianceReport }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["itinerary"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const itinerary = (proposal.itinerary || []) as Array<Record<string, unknown>>;
  const accommodations = (proposal.accommodations || []) as Array<Record<string, unknown>>;
  const budget = (proposal.budget || {}) as Record<string, unknown>;
  const actions = (proposal.booking_actions || []) as Array<Record<string, unknown>>;
  const warnings = ((complianceReport?.warnings || []) as Array<Record<string, unknown>>);

  return (
    <div data-testid="proposal-inline" className={styles.proposal}>
      <h3 className={styles.proposalTitle}>Your Vietnam Trip Proposal</h3>

      {warnings.length > 0 && (
        <div className={styles.warnings}>
          {warnings.map((w, i) => (
            <div key={i} className={styles.warning}>
              {w.message as string}
            </div>
          ))}
        </div>
      )}

      <section data-testid="proposal-itinerary">
        <button
          className={styles.sectionHeader}
          onClick={() => toggleSection("itinerary")}
        >
          Itinerary ({itinerary.length} days)
        </button>
        {expandedSections.has("itinerary") && (
          <div className={styles.sectionContent}>
            {itinerary.map((day, i) => (
              <div key={i} className={styles.dayCard}>
                <strong>Day {i + 1}: {day.title as string}</strong>
                <p>{day.description as string}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section data-testid="proposal-accommodations">
        <button
          className={styles.sectionHeader}
          onClick={() => toggleSection("accommodations")}
        >
          Accommodations ({accommodations.length} options)
        </button>
        {expandedSections.has("accommodations") && (
          <div className={styles.sectionContent}>
            {accommodations.map((acc, i) => (
              <div key={i} className={styles.accCard}>
                <strong>{acc.name as string}</strong>
                <span>{acc.price_per_night as string}/night</span>
                <span>Rating: {acc.rating as string}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section data-testid="proposal-budget">
        <button
          className={styles.sectionHeader}
          onClick={() => toggleSection("budget")}
        >
          Budget Breakdown
        </button>
        {expandedSections.has("budget") && (
          <div className={styles.sectionContent}>
            {Object.entries(budget).map(([category, amount]) => (
              <div key={category} className={styles.budgetRow}>
                <span>{category}</span>
                <span>${String(amount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section data-testid="proposal-actions">
        <button
          className={styles.sectionHeader}
          onClick={() => toggleSection("actions")}
        >
          Booking Actions ({actions.length})
        </button>
        {expandedSections.has("actions") && (
          <div className={styles.sectionContent}>
            {actions.map((action, i) => (
              <div key={i} className={styles.actionItem}>
                <span className={styles.priority}>{action.priority as string}</span>
                <span>{action.description as string}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

### Frontend: ExportButton Component Pattern

```typescript
// components/b2c/ExportButton.tsx
import { useState } from "react";
import { api } from "../../services/apiClient";
import styles from "./ExportButton.module.css";

interface Props {
  sessionId: string;
}

export function ExportButton({ sessionId }: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await api.demo.exportProposal(sessionId);
      // Trigger browser download
      const link = document.createElement("a");
      link.href = response.download_url;
      link.download = response.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={styles.exportContainer}>
      <button
        data-testid="export-button"
        className={styles.exportButton}
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? "Generating PDF..." : "Export as PDF"}
      </button>
      {error && <span className={styles.exportError}>{error}</span>}
    </div>
  );
}
```

### API Client Additions

```typescript
// Add to services/apiClient.ts — demo namespace
export const api = {
  sessions: { /* ... existing ... */ },

  demo: {
    createSession: () =>
      request<{ session_id: string; greeting: string }>("/demo/sessions", {
        method: "POST",
      }),
    sendMessage: (sessionId: string, message: string) =>
      request<{
        session_id: string;
        messages: Array<{ type: string; content: string; context: string }>;
        stage: string;
        profile_complete: boolean;
      }>("/demo/chat", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, message }),
      }),
    getSession: (sessionId: string) =>
      request<{
        session_id: string;
        stage: string;
        profile_complete: boolean;
        proposal_available: boolean;
      }>(`/demo/sessions/${sessionId}`),
    getProposal: (sessionId: string) =>
      request<{
        session_id: string;
        proposal: Record<string, unknown>;
        compliance_report: Record<string, unknown>;
        export_available: boolean;
      }>(`/demo/sessions/${sessionId}/proposal`),
    exportProposal: (sessionId: string) =>
      request<{ download_url: string; filename: string }>(
        `/demo/sessions/${sessionId}/export`,
        { method: "POST" }
      ),
  },
};
```

### Router Registration

```python
# api/v1/router.py — add demo router (NO auth dependency)
from app.api.v1 import auth, demo, health, sessions, streaming

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(sessions.router)
api_router.include_router(streaming.router)
api_router.include_router(demo.router)
```

### data-testid Contract

All interactive elements must have `data-testid` for Playwright (Story 6.3 Suite 1 depends on this):

| Component | data-testid | Purpose |
|---|---|---|
| DemoLayout | `demo-layout` | Layout container |
| Stage progress | `demo-stage-progress` | Workflow progress bar |
| ChatInterface | `chat-interface` | Chat container |
| Message area | `chat-messages` | Scrollable message list |
| Chat input | `chat-input` | Text input field |
| Send button | `chat-send-btn` | Submit message button |
| ProposalInline | `proposal-inline` | Proposal card container |
| Itinerary section | `proposal-itinerary` | Day-by-day plan |
| Accommodations section | `proposal-accommodations` | Hotel options |
| Budget section | `proposal-budget` | Cost breakdown |
| Actions section | `proposal-actions` | Booking actions |
| Export button | `export-button` | PDF export trigger |
| Error display | `demo-error` | Rate limit / error message |

### Tenant Isolation

Demo sessions use `tenant_id = "demo"`. This ensures:
- Demo sessions never appear in B2B session list queries (which filter by JWT tenant_id)
- Demo data does not leak into any agency's tenant scope
- The existing `AdvisorySession` model and `TravelerProfile` model are NOT used for demo storage (in-memory only)
- If demo sessions need DB persistence in a future story, they use `tenant_id = "demo"` for filtering

### Workflow Stage Colors (Reuse from Story 1.8)

| Stage | Color | CSS Variable |
|---|---|---|
| profiling | Blue (#3B82F6) | `--stage-profiling` |
| calculating | Amber (#F59E0B) | `--stage-calculating` |
| proposing | Green (#10B981) | `--stage-proposing` |
| validating | Purple (#8B5CF6) | `--stage-validating` |
| complete | Gray (#6B7280) | `--stage-complete` |

### File Structure

```
backend/app/
├── api/v1/
│   ├── demo.py                    # NEW — B2C demo endpoints (no auth)
│   └── router.py                  # MODIFIED — register demo router
├── schemas/
│   └── demo.py                    # NEW — demo request/response schemas
├── services/
│   └── demo_session.py            # NEW — in-memory demo session manager
├── core/
│   ├── rate_limiter.py            # NEW — IP-based rate limiting
│   ├── config.py                  # MODIFIED — add demo settings
│   └── tests/
│       └── test_rate_limiter.py   # NEW — rate limiter tests
└── services/
    └── tests/
        └── test_demo_session.py   # NEW — demo session manager tests

frontend/src/
├── components/
│   └── b2c/
│       ├── DemoLayout.tsx         # NEW — demo page layout
│       ├── DemoLayout.module.css  # NEW
│       ├── ChatInterface.tsx      # NEW — conversational chat UI
│       ├── ChatInterface.module.css # NEW
│       ├── ProposalInline.tsx     # NEW — inline proposal view
│       ├── ProposalInline.module.css # NEW
│       ├── ExportButton.tsx       # NEW — PDF export trigger
│       └── ExportButton.module.css # NEW
├── services/
│   └── apiClient.ts              # MODIFIED — add demo namespace
└── App.tsx                        # MODIFIED — add /demo route
```

### Anti-Patterns -- DO NOT

- **DO NOT** require JWT auth for any `/demo/*` endpoint -- demo mode is explicitly no-auth (AR-8, FR-28)
- **DO NOT** store demo sessions in PostgreSQL -- keep them in-memory only; they are ephemeral (NFR-8)
- **DO NOT** import B2B components into B2C -- shared code goes in `components/shared/` only
- **DO NOT** duplicate `StreamMessage`, `MessageBubble`, or `TypingIndicator` -- reuse from `components/shared/`
- **DO NOT** use `useState` for streaming state -- use `useReducer` if consuming SSE events (architecture mandate)
- **DO NOT** use `any` type in TypeScript -- define proper types for all API responses
- **DO NOT** hardcode rate limit values -- use `core/config.py` settings
- **DO NOT** use stdlib `logging` -- use `structlog` with `session_id` and `tenant_id="demo"` context
- **DO NOT** skip `data-testid` on interactive elements -- Playwright E2E tests (Story 6.3 Suite 1) depend on them
- **DO NOT** create a form-based profiling experience -- the demo is conversational chat only (FR-27)

### Prerequisites

- Story 1.3 (LangGraph Orchestrator) -- provides the `build_graph()` function and `AdvisoryState`
- Story 1.4 (Profiling Agent) -- provides the conversational profiling logic
- Story 1.7 (SSE Streaming) -- provides `event_bus` and SSE endpoint pattern
- Story 1.8 (React Frontend) -- provides `components/shared/` components, `useStreamContext`, `streamReducer`, `apiClient`

### Dependencies on This Story

- Story 6.3 (Playwright E2E -- Suite 1: B2C Demo Flow) depends on `data-testid` attributes from this story

### Testing Approach

- **Backend unit tests:** `test_rate_limiter.py` (rate limit enforcement, IP extraction, cleanup), `test_demo_session.py` (create, get, update, TTL cleanup)
- **Backend integration tests:** Full demo chat flow -- create session, send messages, verify agent responses (mark with `@pytest.mark.integration`)
- **Frontend:** No unit tests required -- rely on `data-testid` contract for Playwright E2E (Story 6.3)
- **Manual verification:** Checklist in Task 13

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- Authentication & Security: B2C auth = None]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Requirements to Structure Mapping: Demo Mode (FR-27 to FR-28)]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Project Structure: api/v1/demo.py, components/b2c/]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Architectural Boundaries: b2b -> b2c no imports]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 5, Story 5.1]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 6.3 Suite 1 (B2C Demo E2E)]
- [Source: _bmad-output/planning-artifacts/epics.md -- FR-27: Conversational Trip Planning, FR-28: No Authentication Required]
- [Source: _bmad-output/project-context.md -- Auth, Tenant, SSE, Frontend patterns]
- [Source: backend/app/core/tenant.py -- PUBLIC_PATHS includes /api/v1/demo]
- [Source: backend/app/services/event_bus.py -- In-memory event bus pattern]
- [Source: backend/app/api/v1/streaming.py -- SSE endpoint pattern]
- [Source: frontend/src/components/shared/ -- StreamMessage, MessageBubble, TypingIndicator implementations]

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
