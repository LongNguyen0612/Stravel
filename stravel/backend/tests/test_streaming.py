import asyncio
import json
from unittest.mock import AsyncMock

import pytest

from app.services.event_bus import (
    cleanup_session,
    publish_card_event,
    publish_event,
    register_hooks,
    subscribe,
)
import app.services.event_bus as event_bus_module


@pytest.mark.asyncio
async def test_publish_and_subscribe():
    session_id = "test-stream-1"
    queue = await subscribe(session_id)

    await publish_event(session_id, "agent.profiling.question", {"type": "question", "content": "Who is traveling?"})

    event = await queue.get()
    assert event["event"] == "agent.profiling.question"
    assert "Who is traveling?" in event["data"]

    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_multiple_events_in_order():
    session_id = "test-stream-2"
    queue = await subscribe(session_id)

    await publish_event(session_id, "stage.change", {"stage": "profiling"})
    await publish_event(session_id, "agent.profiling.question", {"type": "question", "content": "Budget?"})

    event1 = await queue.get()
    event2 = await queue.get()
    assert event1["event"] == "stage.change"
    assert event2["event"] == "agent.profiling.question"

    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_cleanup_removes_queue():
    session_id = "test-stream-3"
    await subscribe(session_id)
    cleanup_session(session_id)
    queue = await subscribe(session_id)
    assert queue.empty()
    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_publish_card_event_emits_card_update():
    session_id = "test-card-1"
    queue = await subscribe(session_id)

    await publish_card_event(
        session_id=session_id,
        card_id="flight-1",
        card_type="flight",
        completeness_score=0.9,
        delta={"origin": "HAN", "destination": "SGN"},
        is_final=True,
    )

    event = await queue.get()
    assert event["event"] == "card.update"
    data = json.loads(event["data"])
    assert data["card_id"] == "flight-1"
    assert data["type"] == "flight"
    assert data["completeness_score"] == 0.9
    assert data["is_final"] is True
    assert data["delta"]["origin"] == "HAN"

    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_publish_card_event_is_final_false():
    session_id = "test-card-2"
    queue = await subscribe(session_id)

    await publish_card_event(
        session_id=session_id,
        card_id="hotel-1",
        card_type="hotel",
        completeness_score=0.5,
        delta={"neighborhood": "Hoan Kiem"},
        is_final=False,
    )

    event = await queue.get()
    data = json.loads(event["data"])
    assert data["is_final"] is False
    assert data["completeness_score"] == 0.5

    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_publish_card_event_includes_all_required_fields():
    session_id = "test-card-3"
    queue = await subscribe(session_id)

    await publish_card_event(
        session_id=session_id,
        card_id="visa-1",
        card_type="visa",
        completeness_score=0.75,
        delta={},
        is_final=True,
    )

    event = await queue.get()
    data = json.loads(event["data"])
    for field in ("card_id", "type", "completeness_score", "delta", "is_final"):
        assert field in data, f"Missing required field: {field}"

    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_persist_hook_called_on_publish():
    """ARCH-3: persist_hook must be invoked for each published event."""
    session_id = "test-persist-hook-1"
    persist_mock = AsyncMock()
    clear_mock = AsyncMock()

    # Save originals to restore after test
    orig_persist = event_bus_module._persist_hook
    orig_clear = event_bus_module._clear_hook
    try:
        register_hooks(persist=persist_mock, clear=clear_mock)
        queue = await subscribe(session_id)
        await publish_event(session_id, "stage.change", {"stage": "profiling"})
        await queue.get()
        # allow fire-and-forget task to run
        await asyncio.sleep(0)
        persist_mock.assert_awaited_once()
        call_args = persist_mock.call_args
        assert call_args[0][0] == session_id
        assert call_args[0][2] == "stage.change"
    finally:
        event_bus_module._persist_hook = orig_persist
        event_bus_module._clear_hook = orig_clear
        cleanup_session(session_id)


@pytest.mark.asyncio
async def test_clear_hook_called_on_clear_session_buffer():
    """ARCH-3: clear_hook must be invoked when clearing a session buffer."""
    session_id = "test-clear-hook-1"
    persist_mock = AsyncMock()
    clear_mock = AsyncMock()

    orig_persist = event_bus_module._persist_hook
    orig_clear = event_bus_module._clear_hook
    try:
        register_hooks(persist=persist_mock, clear=clear_mock)
        from app.services.event_bus import clear_session_buffer
        await clear_session_buffer(session_id)
        await asyncio.sleep(0)
        clear_mock.assert_awaited_once_with(session_id)
    finally:
        event_bus_module._persist_hook = orig_persist
        event_bus_module._clear_hook = orig_clear


@pytest.mark.asyncio
async def test_no_persist_hook_when_not_registered():
    """publish_event must not raise when no persist_hook is registered."""
    session_id = "test-no-hook-1"

    orig_persist = event_bus_module._persist_hook
    orig_clear = event_bus_module._clear_hook
    try:
        event_bus_module._persist_hook = None
        event_bus_module._clear_hook = None
        queue = await subscribe(session_id)
        await publish_event(session_id, "stage.change", {"stage": "profiling"})
        event = await queue.get()
        assert event["event"] == "stage.change"
    finally:
        event_bus_module._persist_hook = orig_persist
        event_bus_module._clear_hook = orig_clear
        cleanup_session(session_id)
