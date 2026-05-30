import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.event_persistence import delete_session_events, get_session_events, persist_event


@pytest.mark.asyncio
async def test_persist_event_writes_to_db():
    session_id = str(uuid.uuid4())
    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)

    with patch("app.services.event_persistence.async_session_factory", return_value=mock_db):
        await persist_event(session_id, sse_id=1, event_type="stage.change", event_data={"stage": "profiling"})

    mock_db.add.assert_called_once()
    added = mock_db.add.call_args[0][0]
    assert added.session_id == uuid.UUID(session_id)
    assert added.sse_id == 1
    assert added.event_type == "stage.change"
    assert added.event_data == {"stage": "profiling"}
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_persist_event_swallows_db_errors():
    session_id = str(uuid.uuid4())
    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    mock_db.add.side_effect = RuntimeError("db down")

    with patch("app.services.event_persistence.async_session_factory", return_value=mock_db):
        # must not raise
        await persist_event(session_id, sse_id=1, event_type="stage.change", event_data={})


@pytest.mark.asyncio
async def test_delete_session_events_executes_delete():
    session_id = str(uuid.uuid4())
    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)

    with patch("app.services.event_persistence.async_session_factory", return_value=mock_db):
        await delete_session_events(session_id)

    mock_db.execute.assert_awaited_once()
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_session_events_returns_ordered_list():
    session_id = str(uuid.uuid4())

    from app.models.session_event import SessionEvent

    ev1 = SessionEvent(session_id=uuid.UUID(session_id), sse_id=1, event_type="stage.change", event_data={"stage": "profiling"})
    ev2 = SessionEvent(session_id=uuid.UUID(session_id), sse_id=2, event_type="agent.profiling.question", event_data={"content": "hi"})

    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [ev1, ev2]
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars

    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch("app.services.event_persistence.async_session_factory", return_value=mock_db):
        events = await get_session_events(session_id)

    assert len(events) == 2
    assert events[0].sse_id == 1
    assert events[1].sse_id == 2


@pytest.mark.asyncio
async def test_get_session_events_returns_empty_on_error():
    session_id = str(uuid.uuid4())
    mock_db = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    mock_db.execute.side_effect = RuntimeError("db error")

    with patch("app.services.event_persistence.async_session_factory", return_value=mock_db):
        events = await get_session_events(session_id)

    assert events == []
