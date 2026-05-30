"""Verify workflow emits card.update event during proposing stage."""
import json
from unittest.mock import AsyncMock, patch

import pytest

from app.services.event_bus import cleanup_session, subscribe


@pytest.mark.asyncio
async def test_workflow_emits_card_update_at_proposing():
    """Integration-level unit test: run workflow with mocked LLM and DB, verify card.update emitted."""
    session_id = "workflow-card-test-1"
    queue = await subscribe(session_id)

    mock_llm = AsyncMock()
    mock_llm.generate = AsyncMock(return_value="Profile confirmed.")
    mock_llm.generate_via_stream = AsyncMock(return_value="Proposal details here.")

    profile = {
        "destination_preferences": ["Hanoi", "Ho Chi Minh City"],
        "traveler_count": 2,
        "budget_total": 2000,
        "budget_currency": "USD",
        "travel_start_date": "2026-07-01",
        "travel_end_date": "2026-07-14",
        "accommodation_style": "mid-range",
        "activity_preferences": ["sightseeing"],
    }

    with (
        patch("app.services.workflow._get_llm", return_value=mock_llm),
        patch("app.services.workflow.async_session_factory"),
        patch("app.core.database.async_session_factory"),
    ):
        from app.services.workflow import run_advisory_workflow

        # Run only far enough to get the card event — we'll collect all events and check
        # Use a short timeout since we can't wait for the full workflow
        import asyncio

        try:
            await asyncio.wait_for(run_advisory_workflow(session_id, profile), timeout=5.0)
        except (asyncio.TimeoutError, Exception):
            pass  # Workflow may fail on DB ops; we just need the card event

    # Drain queue and find card.update event
    card_update_found = False
    while not queue.empty():
        event = queue.get_nowait()
        if event["event"] == "card.update":
            data = json.loads(event["data"])
            assert data["card_id"] == "flight-1"
            assert data["type"] == "flight"
            assert data["is_final"] is True
            assert data["completeness_score"] == 0.9
            card_update_found = True
            break

    assert card_update_found, "Expected card.update event was not emitted by workflow"
    cleanup_session(session_id)
