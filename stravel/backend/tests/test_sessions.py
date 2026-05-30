import pytest

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_create_session(async_client):
    response = await async_client.post("/api/v1/advisory_sessions", json={})
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
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
        json={"status": "confirmed"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_update_session_invalid_transition(async_client):
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id = create_resp.json()["id"]

    # Confirm it first
    await async_client.patch(f"/api/v1/advisory_sessions/{session_id}", json={"status": "confirmed"})

    # Try to go back to pending — invalid
    response = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}",
        json={"status": "pending"},
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


@pytest.mark.asyncio
async def test_get_events_returns_empty_list_for_new_session(async_client):
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id = create_resp.json()["id"]

    response = await async_client.get(f"/api/v1/advisory_sessions/{session_id}/events")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_events_returns_404_for_unknown_session(async_client):
    fake_id = "00000000-0000-0000-0000-000000000001"
    response = await async_client.get(f"/api/v1/advisory_sessions/{fake_id}/events")
    assert response.status_code == 404
