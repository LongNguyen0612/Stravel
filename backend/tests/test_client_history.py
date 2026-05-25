from app.services.demo_session import create_demo_session, get_demo_session


def test_demo_session_lifecycle():
    """Client history depends on session management working correctly."""
    sid = create_demo_session()
    session = get_demo_session(sid)
    assert session is not None
    assert session["stage"] == "profiling"


def test_demo_session_expired():
    """Expired sessions should return None."""
    assert get_demo_session("nonexistent-id") is None
