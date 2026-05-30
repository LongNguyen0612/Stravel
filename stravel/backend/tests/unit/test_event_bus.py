import json

import pytest

from app.services.event_bus import cleanup_session, clear_session_buffer, publish_card_event, publish_event, subscribe, unsubscribe


@pytest.mark.asyncio
async def test_publish_and_subscribe():
    session_id = "unit-stream-1"
    queue = await subscribe(session_id)
    await publish_event(session_id, "agent.profiling.question", {"type": "question", "content": "Who is traveling?"})
    event = await queue.get()
    assert event["event"] == "agent.profiling.question"
    assert "Who is traveling?" in event["data"]
    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_publish_card_event_emits_card_update():
    session_id = "unit-card-1"
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
    session_id = "unit-card-2"
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
    session_id = "unit-card-3"
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


# ── AC4: Monotonic sequential SSE IDs ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_events_have_sequential_sse_ids():
    session_id = "unit-seq-1"
    queue = await subscribe(session_id)
    await publish_event(session_id, "stage.change", {"stage": "profiling"})
    await publish_event(session_id, "stage.change", {"stage": "calculating"})
    await publish_event(session_id, "stage.change", {"stage": "proposing"})

    ids = [queue.get_nowait()["sse_id"] for _ in range(3)]
    assert ids == [1, 2, 3]
    cleanup_session(session_id)


# ── AC5: Last-Event-ID filtered replay ────────────────────────────────────────

@pytest.mark.asyncio
async def test_last_event_id_filters_replay():
    session_id = "unit-replay-1"
    for i in range(5):
        await publish_event(session_id, "stage.change", {"stage": f"s{i}"})

    queue = await subscribe(session_id, last_event_id=3)
    replayed = []
    while not queue.empty():
        replayed.append(queue.get_nowait()["sse_id"])
    assert replayed == [4, 5]
    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_last_event_id_none_replays_all():
    session_id = "unit-replay-2"
    for i in range(3):
        await publish_event(session_id, "stage.change", {"stage": f"s{i}"})

    queue = await subscribe(session_id, last_event_id=None)
    replayed = [queue.get_nowait()["sse_id"] for _ in range(3)]
    assert replayed == [1, 2, 3]
    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_clear_session_buffer_resets_counter():
    session_id = "unit-reset-1"
    await publish_event(session_id, "stage.change", {"stage": "a"})
    await publish_event(session_id, "stage.change", {"stage": "b"})
    await clear_session_buffer(session_id)

    await publish_event(session_id, "stage.change", {"stage": "c"})
    queue = await subscribe(session_id)
    event = queue.get_nowait()
    assert event["sse_id"] == 1
    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_independent_counters_per_session():
    sid_a = "unit-counter-a"
    sid_b = "unit-counter-b"

    await publish_event(sid_a, "stage.change", {"stage": "a1"})
    await publish_event(sid_b, "stage.change", {"stage": "b1"})
    await publish_event(sid_a, "stage.change", {"stage": "a2"})

    q_a = await subscribe(sid_a)
    q_b = await subscribe(sid_b)

    a_ids = [q_a.get_nowait()["sse_id"] for _ in range(2)]
    b_ids = [q_b.get_nowait()["sse_id"] for _ in range(1)]

    assert a_ids == [1, 2]
    assert b_ids == [1]

    cleanup_session(sid_a)
    cleanup_session(sid_b)


# ── P5: unsubscribe and cleanup_session behaviour ─────────────────────────────

@pytest.mark.asyncio
async def test_unsubscribe_stops_event_delivery():
    """After unsubscribe, published events are not delivered to the removed queue."""
    session_id = "unit-unsub-1"
    queue = await subscribe(session_id)
    unsubscribe(session_id, queue)
    await publish_event(session_id, "stage.change", {"stage": "after-unsub"})
    assert queue.empty(), "Unsubscribed queue must not receive new events"
    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_unsubscribe_is_idempotent():
    """Calling unsubscribe twice for the same queue does not raise."""
    session_id = "unit-unsub-2"
    queue = await subscribe(session_id)
    unsubscribe(session_id, queue)
    unsubscribe(session_id, queue)  # second call must not raise
    cleanup_session(session_id)
