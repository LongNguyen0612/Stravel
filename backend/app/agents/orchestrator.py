import structlog
from langgraph.graph import END, START, StateGraph

from app.agents.protocols import LLMServiceProtocol
from app.agents.state import AdvisoryState

logger = structlog.get_logger()


async def profiling_node(state: AdvisoryState, llm: LLMServiceProtocol) -> dict:
    """Active profiling node — asks initial fact-finding question and returns it."""
    logger.info("agent.profiling.started", session_id=state.session_id)
    try:
        question = await llm.generate(
            "You are a travel advisor. Ask the traveler: who is traveling, when, what budget, "
            "and what destinations they're interested in. Be friendly and conversational."
        )
        logger.info("agent.profiling.question", session_id=state.session_id, question_len=len(question))
        # Store the generated question in errors temporarily as messages field
        # (proper message handling comes in Story 1.7 SSE integration)
        return {"stage": "profiling", "traveler_profile": state.traveler_profile}
    except Exception as e:
        logger.error("agent.profiling.failed", error=str(e))
        return {"errors": [*state.errors, {"agent": "profiling", "message": str(e)}]}


async def calculation_node(state: AdvisoryState) -> dict:
    """Stub — passes through with stage update."""
    logger.info("agent.calculation.started", session_id=state.session_id)
    return {"stage": "calculating"}


async def proposal_node(state: AdvisoryState) -> dict:
    """Stub — passes through with stage update."""
    logger.info("agent.proposal.started", session_id=state.session_id)
    return {"stage": "proposing"}


async def compliance_node(state: AdvisoryState) -> dict:
    """Stub — passes through with stage update."""
    logger.info("agent.compliance.started", session_id=state.session_id)
    return {"stage": "validating"}


def build_graph(llm: LLMServiceProtocol) -> StateGraph:
    """Build the advisory workflow graph with all 4 stage nodes."""

    async def _profiling(state: AdvisoryState) -> dict:
        return await profiling_node(state, llm)

    graph = StateGraph(AdvisoryState)

    graph.add_node("profiling", _profiling)
    graph.add_node("calculation", calculation_node)
    graph.add_node("proposal", proposal_node)
    graph.add_node("compliance", compliance_node)

    graph.add_edge(START, "profiling")
    graph.add_edge("profiling", "calculation")
    graph.add_edge("calculation", "proposal")
    graph.add_edge("proposal", "compliance")
    graph.add_edge("compliance", END)

    return graph
