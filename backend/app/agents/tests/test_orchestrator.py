from collections.abc import AsyncIterator

import pytest

from app.agents.orchestrator import build_graph
from app.agents.state import AdvisoryState


class MockLLMService:
    """Mock LLM service for testing without Ollama."""

    async def generate(self, prompt: str, **kwargs) -> str:
        return "Welcome! Tell me about your trip plans."

    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        for word in "Hello traveler".split():
            yield word


@pytest.fixture
def mock_llm():
    return MockLLMService()


@pytest.fixture
def graph(mock_llm):
    return build_graph(mock_llm)


def test_graph_has_all_nodes(graph):
    compiled = graph.compile()
    node_names = set(compiled.get_graph().nodes.keys()) - {"__start__", "__end__"}
    assert node_names == {"profiling", "calculation", "proposal", "compliance"}


@pytest.mark.asyncio
async def test_graph_traverses_all_stages(mock_llm):
    graph = build_graph(mock_llm)
    compiled = graph.compile()

    initial_state = AdvisoryState(session_id="test-123", tenant_id="default")
    result = await compiled.ainvoke(initial_state)

    assert result["stage"] == "validating"


@pytest.mark.asyncio
async def test_stub_nodes_update_stage(mock_llm):
    from app.agents.orchestrator import calculation_node, compliance_node, proposal_node

    state = AdvisoryState(session_id="test-123", tenant_id="default")

    calc_result = await calculation_node(state)
    assert calc_result["stage"] == "calculating"

    prop_result = await proposal_node(state)
    assert prop_result["stage"] == "proposing"

    comp_result = await compliance_node(state)
    assert comp_result["stage"] == "validating"


@pytest.mark.asyncio
async def test_profiling_node_handles_llm_error():
    class FailingLLM:
        async def generate(self, prompt: str, **kwargs) -> str:
            raise ConnectionError("Ollama not running")

        async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
            raise ConnectionError("Ollama not running")
            yield  # noqa: F841 — unreachable but needed for AsyncIterator type

    from app.agents.orchestrator import profiling_node

    state = AdvisoryState(session_id="test-123", tenant_id="default")
    result = await profiling_node(state, FailingLLM())

    assert len(result["errors"]) == 1
    assert result["errors"][0]["agent"] == "profiling"
