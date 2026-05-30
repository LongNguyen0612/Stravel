"""Unit tests for SSE wire format: id: line, Last-Event-ID header, replay_count logging."""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


async def make_queue(*events):
    q = asyncio.Queue()
    for e in events:
        await q.put(e)
    return q


def _make_db_mock():
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = object()  # session exists
    mock_db.execute = AsyncMock(return_value=mock_result)
    return mock_db


# ── AC4: id: line in SSE wire format ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_sse_output_includes_id_line():
    """event_generator yields id: N\\n before event: line for data events."""
    from app.api.v1.streaming import stream_events

    sample_event = {"sse_id": 1, "event": "stage.change", "data": '{"stage": "profiling"}'}
    queue = await make_queue(sample_event)

    mock_request = MagicMock()
    mock_request.headers.get = MagicMock(return_value=None)
    mock_request.is_disconnected = AsyncMock(side_effect=[False, True])

    subscribe_mock = AsyncMock(return_value=queue)
    with patch("app.api.v1.streaming.subscribe", subscribe_mock), \
         patch("app.api.v1.streaming.unsubscribe"):
        response = await stream_events(
            session_id="test-session",
            request=mock_request,
            tenant_id="test-tenant",
            db=_make_db_mock(),
        )
        chunks = []
        async for chunk in response.body_iterator:
            chunks.append(chunk)

    output = "".join(chunks)
    assert output.startswith("id: 1\n"), f"Expected id: 1 prefix, got: {output!r}"
    assert "event: stage.change\n" in output
    assert "data: " in output


# ── AC5: Last-Event-ID header parsing + subscribe call ────────────────────────

@pytest.mark.asyncio
async def test_subscribe_called_with_last_event_id_from_header():
    """event_generator passes last_event_id=5 to subscribe() when request has Last-Event-ID: 5."""
    from app.api.v1.streaming import stream_events

    queue = await make_queue()
    mock_request = MagicMock()
    mock_request.headers.get = MagicMock(return_value="5")
    mock_request.is_disconnected = AsyncMock(return_value=True)

    subscribe_mock = AsyncMock(return_value=queue)
    with patch("app.api.v1.streaming.subscribe", subscribe_mock), \
         patch("app.api.v1.streaming.unsubscribe"):
        response = await stream_events(
            session_id="test-session",
            request=mock_request,
            tenant_id="test-tenant",
            db=_make_db_mock(),
        )
        async for _ in response.body_iterator:
            pass

    subscribe_mock.assert_called_once_with("test-session", last_event_id=5)


@pytest.mark.asyncio
async def test_subscribe_called_with_none_when_no_last_event_id_header():
    """event_generator passes last_event_id=None to subscribe() when no Last-Event-ID header."""
    from app.api.v1.streaming import stream_events

    queue = await make_queue()
    mock_request = MagicMock()
    mock_request.headers.get = MagicMock(return_value=None)
    mock_request.is_disconnected = AsyncMock(return_value=True)

    subscribe_mock = AsyncMock(return_value=queue)
    with patch("app.api.v1.streaming.subscribe", subscribe_mock), \
         patch("app.api.v1.streaming.unsubscribe"):
        response = await stream_events(
            session_id="test-session",
            request=mock_request,
            tenant_id="test-tenant",
            db=_make_db_mock(),
        )
        async for _ in response.body_iterator:
            pass

    subscribe_mock.assert_called_once_with("test-session", last_event_id=None)
