from app.services.demo_session import add_message, create_demo_session, get_demo_session, update_demo_session


def test_create_demo_session():
    sid = create_demo_session()
    assert sid is not None
    session = get_demo_session(sid)
    assert session is not None
    assert session["stage"] == "profiling"


def test_get_nonexistent_session():
    assert get_demo_session("nonexistent") is None


def test_add_message():
    sid = create_demo_session()
    add_message(sid, "user", "Hello!")
    session = get_demo_session(sid)
    assert len(session["messages"]) == 1
    assert session["messages"][0]["role"] == "user"
    assert session["messages"][0]["content"] == "Hello!"


def test_update_session():
    sid = create_demo_session()
    update_demo_session(sid, {"stage": "calculating"})
    session = get_demo_session(sid)
    assert session["stage"] == "calculating"


def test_demo_endpoint_creates_session(client):
    response = client.post("/api/v1/demo/sessions")
    assert response.status_code == 201
    data = response.json()
    assert "session_id" in data
    assert data["status"] == "profiling"


def test_demo_chat(client):
    # Create session
    create_resp = client.post("/api/v1/demo/sessions")
    session_id = create_resp.json()["session_id"]

    # Send chat message
    chat_resp = client.post(
        f"/api/v1/demo/sessions/{session_id}/chat",
        json={"message": "I want to visit Hanoi"},
    )
    assert chat_resp.status_code == 200
    data = chat_resp.json()
    assert data["session_id"] == session_id
    assert len(data["reply"]) > 0


def test_demo_get_session(client):
    create_resp = client.post("/api/v1/demo/sessions")
    session_id = create_resp.json()["session_id"]

    get_resp = client.get(f"/api/v1/demo/sessions/{session_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["session_id"] == session_id


def test_demo_not_found(client):
    resp = client.get("/api/v1/demo/sessions/nonexistent")
    assert resp.status_code == 404


def test_demo_no_auth_required(client):
    """Demo endpoints must work without JWT token."""
    resp = client.post("/api/v1/demo/sessions")
    assert resp.status_code == 201  # Not 401
