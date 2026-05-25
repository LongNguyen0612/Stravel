import time
import uuid

import structlog

logger = structlog.get_logger()

# In-memory ephemeral session store (no DB, no auth)
_sessions: dict[str, dict] = {}
SESSION_TTL_SECONDS = 3600  # 1 hour


def create_demo_session() -> str:
    """Create an ephemeral demo session. Returns session_id."""
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "id": session_id,
        "stage": "profiling",
        "messages": [],
        "profile": {},
        "proposal": None,
        "compliance": None,
        "created_at": time.time(),
    }
    _cleanup_expired()
    logger.info("demo.session_created", session_id=session_id)
    return session_id


def get_demo_session(session_id: str) -> dict | None:
    """Get demo session. Returns None if expired or not found."""
    session = _sessions.get(session_id)
    if session and time.time() - session["created_at"] < SESSION_TTL_SECONDS:
        return session
    return None


def update_demo_session(session_id: str, updates: dict) -> dict | None:
    """Update demo session fields."""
    session = get_demo_session(session_id)
    if session:
        session.update(updates)
        return session
    return None


def add_message(session_id: str, role: str, content: str) -> None:
    """Add a message to the demo session chat history."""
    session = get_demo_session(session_id)
    if session:
        session["messages"].append({"role": role, "content": content, "timestamp": time.time()})


def _cleanup_expired() -> None:
    """Remove expired sessions."""
    now = time.time()
    expired = [sid for sid, s in _sessions.items() if now - s["created_at"] > SESSION_TTL_SECONDS]
    for sid in expired:
        del _sessions[sid]
    if expired:
        logger.info("demo.sessions_cleaned", count=len(expired))
