import pytest

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_create_session(async_client):
    response = await async_client.post("/api/v1/advisory_sessions", json={})
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "in_progress"
    assert data["tenant_id"] == "default"
    assert data["traveler_profile"] is not None
    assert "id" in data


@pytest.mark.asyncio
async def test_get_session(async_client):
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id = create_resp.json()["id"]

    response = await async_client.get(f"/api/v1/advisory_sessions/{session_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == session_id
    assert data["traveler_profile"] is not None


@pytest.mark.asyncio
async def test_get_session_not_found(async_client):
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = await async_client.get(f"/api/v1/advisory_sessions/{fake_id}")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"]["code"] == "ENTITY_NOT_FOUND"


@pytest.mark.asyncio
async def test_update_session_status(async_client):
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id = create_resp.json()["id"]

    response = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}",
        json={"status": "completed"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_update_session_invalid_transition(async_client):
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id = create_resp.json()["id"]

    # Complete it first
    await async_client.patch(f"/api/v1/advisory_sessions/{session_id}", json={"status": "completed"})

    # Try to go back to in_progress — invalid
    response = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}",
        json={"status": "in_progress"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_sessions(async_client):
    # Create two sessions
    await async_client.post("/api/v1/advisory_sessions", json={})
    await async_client.post("/api/v1/advisory_sessions", json={})

    response = await async_client.get("/api/v1/advisory_sessions")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2
    assert len(data["items"]) >= 2
    assert "limit" in data
    assert "offset" in data
