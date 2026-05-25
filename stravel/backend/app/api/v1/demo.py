import structlog
from fastapi import APIRouter, Request
from fastapi.responses import Response

from app.agents.profiling.prompts import ROUND_1_PROMPT, SYSTEM_PROMPT
from app.agents.proposal.export import format_proposal_html, generate_pdf_bytes
from app.core.exceptions import NotFoundError
from app.core.rate_limiter import check_rate_limit
from app.schemas.demo import DemoChatRequest, DemoChatResponse, DemoSessionResponse
from app.services.demo_session import add_message, create_demo_session, get_demo_session, update_demo_session
from app.services.llm import create_llm_service

router = APIRouter(prefix="/demo", tags=["demo"])
logger = structlog.get_logger()

_llm = None


def _get_llm():
    global _llm
    if _llm is None:
        _llm = create_llm_service()
    return _llm


@router.post("/sessions", response_model=DemoSessionResponse, status_code=201)
async def create_session(request: Request) -> dict:
    """Create a new demo session. No auth required. Rate limited by IP."""
    check_rate_limit(request)
    session_id = create_demo_session()
    return {"session_id": session_id, "status": "profiling"}


@router.post("/sessions/{session_id}/chat", response_model=DemoChatResponse)
async def chat(session_id: str, body: DemoChatRequest, request: Request) -> dict:
    """Send a message in the demo chat. Returns real AI reply via Ollama/vLLM."""
    check_rate_limit(request)
    session = get_demo_session(session_id)
    if not session:
        raise NotFoundError("DemoSession", session_id)

    add_message(session_id, "user", body.message)

    stage = session.get("stage", "profiling")

    # Build conversation history for the LLM
    history = session.get("messages", [])
    history_text = "\n".join(f"{m['role']}: {m['content']}" for m in history[-10:])

    try:
        llm = _get_llm()

        if len(history) <= 2:
            # First message — use profiling system prompt
            prompt = (
                f"{SYSTEM_PROMPT.format(answered_topics='none yet')}\n\n"
                f"{ROUND_1_PROMPT}\n\n"
                f"The traveler said: {body.message}\n\n"
                f"Respond as a friendly travel advisor. Ask follow-up questions about their trip."
            )
        else:
            # Continuing conversation
            prompt = (
                f"{SYSTEM_PROMPT.format(answered_topics='see conversation')}\n\n"
                f"Conversation so far:\n{history_text}\n\n"
                f"Continue the conversation naturally. Ask about details they haven't mentioned yet "
                f"(destinations, dates, budget, accommodation style, dietary needs, activities)."
            )

        reply = await llm.generate(prompt)
    except Exception as e:
        logger.error("demo.llm_failed", error=str(e))
        reply = (
            "I'm having trouble connecting to the AI right now. "
            "Please try again in a moment, or tell me more about your trip plans!"
        )

    add_message(session_id, "assistant", reply)

    return {
        "session_id": session_id,
        "reply": reply,
        "stage": stage,
        "is_complete": stage == "complete",
        "is_demo": True,
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: str) -> dict:
    """Get demo session status and messages."""
    session = get_demo_session(session_id)
    if not session:
        raise NotFoundError("DemoSession", session_id)
    return {
        "session_id": session["id"],
        "stage": session["stage"],
        "messages": session["messages"],
        "proposal": session.get("proposal"),
    }


@router.get("/sessions/{session_id}/export")
async def export_session(session_id: str, request: Request) -> Response:
    """Export demo session proposal as PDF (or HTML fallback). Rate limited."""
    check_rate_limit(request)
    session = get_demo_session(session_id)
    if not session:
        raise NotFoundError("DemoSession", session_id)

    proposal = session.get("proposal") or {"itinerary": "No proposal generated yet."}
    html = format_proposal_html(proposal)
    pdf_bytes = generate_pdf_bytes(html)

    is_pdf = pdf_bytes[:4] == b"%PDF"
    content_type = "application/pdf" if is_pdf else "text/html"
    extension = "pdf" if is_pdf else "html"
    return Response(
        content=pdf_bytes,
        media_type=content_type,
        headers={"Content-Disposition": f"attachment; filename=stravel-demo-{session_id[:8]}.{extension}"},
    )
