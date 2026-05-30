import pytest

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_b2b_status_pending_to_confirmed(async_client):
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    assert create_resp.status_code == 201
    session_id = create_resp.json()["id"]
    assert create_resp.json()["status"] == "pending"

    response = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}/status",
        json={"status": "confirmed"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_b2b_status_confirmed_to_modified(async_client):
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id = create_resp.json()["id"]

    r = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}/status",
        json={"status": "confirmed"},
    )
    assert r.status_code == 200

    response = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}/status",
        json={"status": "modified"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "modified"


@pytest.mark.asyncio
async def test_b2b_status_modified_to_confirmed(async_client):
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id = create_resp.json()["id"]

    r1 = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}/status",
        json={"status": "confirmed"},
    )
    assert r1.status_code == 200

    r2 = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}/status",
        json={"status": "modified"},
    )
    assert r2.status_code == 200

    response = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}/status",
        json={"status": "confirmed"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_b2b_status_any_to_flagged(async_client):
    # From pending
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id = create_resp.json()["id"]

    response = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}/status",
        json={"status": "flagged", "flag_reason": "Suspicious activity"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "flagged"

    # From confirmed
    create_resp2 = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id2 = create_resp2.json()["id"]

    r = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id2}/status",
        json={"status": "confirmed"},
    )
    assert r.status_code == 200

    response2 = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id2}/status",
        json={"status": "flagged", "flag_reason": "Agent review needed"},
    )
    assert response2.status_code == 200
    assert response2.json()["status"] == "flagged"


@pytest.mark.asyncio
async def test_b2b_status_invalid_transition_422(async_client):
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id = create_resp.json()["id"]

    r = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}/status",
        json={"status": "confirmed"},
    )
    assert r.status_code == 200

    # confirmed → pending is invalid
    response = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}/status",
        json={"status": "pending"},
    )
    assert response.status_code == 422
    assert "Invalid status transition" in response.json()["detail"]["message"]


@pytest.mark.asyncio
async def test_b2b_status_flagged_requires_flag_reason(async_client):
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id = create_resp.json()["id"]

    response = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}/status",
        json={"status": "flagged"},
    )
    assert response.status_code == 422
    assert "flag_reason required" in response.json()["detail"]["message"]


@pytest.mark.asyncio
async def test_b2b_status_flagged_empty_flag_reason(async_client):
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id = create_resp.json()["id"]

    response = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}/status",
        json={"status": "flagged", "flag_reason": ""},
    )
    assert response.status_code == 422
    assert "flag_reason required" in response.json()["detail"]["message"]


@pytest.mark.asyncio
async def test_b2b_status_flagged_with_flag_reason(async_client):
    create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
    session_id = create_resp.json()["id"]

    response = await async_client.patch(
        f"/api/v1/advisory_sessions/{session_id}/status",
        json={"status": "flagged", "flag_reason": "Visa issue detected"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "flagged"


@pytest.mark.asyncio
async def test_b2b_status_not_found(async_client):
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = await async_client.patch(
        f"/api/v1/advisory_sessions/{fake_id}/status",
        json={"status": "confirmed"},
    )
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "ENTITY_NOT_FOUND"
