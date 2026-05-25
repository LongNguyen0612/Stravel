import uuid
from collections.abc import AsyncIterator

import pytest

from app.agents.proposal.agent import proposal_node
from app.agents.state import AdvisoryState
from app.schemas.profile import TravelerProfileResponse

TEST_UUID1 = str(uuid.uuid4())
TEST_UUID2 = str(uuid.uuid4())


class MockLLM:
    async def generate(self, prompt: str, **kwargs) -> str:
        return "Day 1: Morning - Visit War Museum. Afternoon - Lunch at Pho 24. Evening - Check in at Rex Hotel."

    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        yield "Day 1"


class MockVectorStore:
    async def search(self, query, filters, limit=10):
        return [
            {"name": "Rex Hotel", "entity_type": "hotel", "region": "hcmc", "pricing": 120},
            {"name": "War Museum", "entity_type": "attraction", "region": "hcmc", "pricing": 3},
            {"name": "Pho 24", "entity_type": "restaurant", "region": "hcmc", "pricing": 5},
        ]


@pytest.fixture
def state_with_profile():
    return AdvisoryState(
        session_id="test-1",
        tenant_id="default",
        stage="proposing",
        calculations={"budget": {"total_budget": 3000}},
        traveler_profile=TravelerProfileResponse(
            id=TEST_UUID1,
            advisory_session_id=TEST_UUID2,
            destination_preferences=["hcmc"],
            traveler_count=2,
            budget_total=3000.0,
            created_at="2026-01-01T00:00:00",
            updated_at="2026-01-01T00:00:00",
        ),
    )


@pytest.mark.asyncio
async def test_proposal_generates_itinerary(state_with_profile):
    result = await proposal_node(state_with_profile, MockLLM(), MockVectorStore())
    assert result["stage"] == "proposing"
    assert "proposal" in result
    assert result["proposal"]["entity_count"] > 0


@pytest.mark.asyncio
async def test_proposal_without_calculations():
    state = AdvisoryState(session_id="test-1", tenant_id="default", stage="proposing")
    result = await proposal_node(state, MockLLM())
    assert len(result.get("errors", [])) > 0


@pytest.mark.asyncio
async def test_proposal_with_limited_data(state_with_profile):
    class EmptyStore:
        async def search(self, query, filters, limit=10):
            return []

    result = await proposal_node(state_with_profile, MockLLM(), EmptyStore())
    assert result["proposal"]["data_limited"]


@pytest.mark.asyncio
async def test_proposal_entities_used(state_with_profile):
    result = await proposal_node(state_with_profile, MockLLM(), MockVectorStore())
    assert len(result["proposal"]["entities_used"]) > 0


@pytest.mark.asyncio
async def test_proposal_handles_llm_error(state_with_profile):
    class FailingLLM:
        async def generate(self, prompt, **kwargs):
            raise ConnectionError("LLM down")

        async def stream(self, prompt, **kwargs):
            raise ConnectionError("LLM down")
            yield  # noqa: F841

    result = await proposal_node(state_with_profile, FailingLLM(), MockVectorStore())
    assert len(result["errors"]) > 0
