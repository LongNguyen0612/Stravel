from collections.abc import AsyncIterator

import pytest

from app.agents.profiling.agent import detect_triggers, profiling_node
from app.agents.profiling.schemas import CONTEXT_TRIGGERS
from app.agents.state import AdvisoryState


class MockLLM:
    async def generate(self, prompt: str, **kwargs) -> str:
        return "Tell me about your trip plans!"

    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        yield "Hello"


@pytest.fixture
def mock_llm():
    return MockLLM()


@pytest.fixture
def base_state():
    return AdvisoryState(session_id="test-1", tenant_id="default")


def test_context_triggers_count():
    """Must have at least 8 context triggers."""
    assert len(CONTEXT_TRIGGERS) >= 8


def test_detect_family_trigger():
    triggers = detect_triggers("We are a family with two kids", set())
    categories = {t.category for t in triggers}
    assert "family_with_kids" in categories


def test_detect_dietary_trigger():
    triggers = detect_triggers("I have dietary restrictions, I'm vegan", set())
    categories = {t.category for t in triggers}
    assert "dietary_needs" in categories


def test_detect_mobility_trigger():
    triggers = detect_triggers("I use a wheelchair and need accessible rooms", set())
    categories = {t.category for t in triggers}
    assert "mobility_issues" in categories


def test_detect_adventure_trigger():
    triggers = detect_triggers("We love adventure and trekking", set())
    categories = {t.category for t in triggers}
    assert "adventure_interest" in categories


def test_detect_flexible_dates_trigger():
    triggers = detect_triggers("Our dates are flexible, we can travel anytime", set())
    categories = {t.category for t in triggers}
    assert "flexible_dates" in categories


def test_detect_budget_trigger():
    triggers = detect_triggers("We're on a tight budget, happy with hostels", set())
    categories = {t.category for t in triggers}
    assert "budget_traveler" in categories


def test_detect_luxury_trigger():
    triggers = detect_triggers("We want a luxury experience with 5-star hotels", set())
    categories = {t.category for t in triggers}
    assert "luxury_traveler" in categories


def test_detect_anniversary_trigger():
    triggers = detect_triggers("This trip is for our wedding anniversary", set())
    categories = {t.category for t in triggers}
    assert "couple_anniversary" in categories


def test_no_duplicate_triggers():
    """Already-triggered categories should not be detected again."""
    triggers = detect_triggers("We are a family with kids", {"family_with_kids"})
    categories = {t.category for t in triggers}
    assert "family_with_kids" not in categories


def test_multiple_triggers_in_one_message():
    triggers = detect_triggers("We are a family with kids and I have dietary restrictions", set())
    categories = {t.category for t in triggers}
    assert "family_with_kids" in categories
    assert "dietary_needs" in categories


@pytest.mark.asyncio
async def test_profiling_node_generates_question(mock_llm, base_state):
    result = await profiling_node(base_state, mock_llm)
    assert result["stage"] == "profiling"
    assert "errors" not in result or len(result.get("errors", [])) == 0


@pytest.mark.asyncio
async def test_profiling_node_handles_llm_error(base_state):
    class FailingLLM:
        async def generate(self, prompt: str, **kwargs) -> str:
            raise ConnectionError("LLM unavailable")

        async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
            raise ConnectionError("LLM unavailable")
            yield  # noqa: F841

    result = await profiling_node(base_state, FailingLLM())
    assert len(result["errors"]) == 1
    assert result["errors"][0]["agent"] == "profiling"
