import pytest

from app.services.event_bus import cleanup_session, publish_event, subscribe


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
