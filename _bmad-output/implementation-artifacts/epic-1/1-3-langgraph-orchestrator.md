# Story 1.3: LangGraph Orchestrator Skeleton

Status: done

## Story

As a developer,
I want a LangGraph StateGraph with stub nodes for all 4 workflow stages,
so that the agent pipeline infrastructure is proven before implementing agent logic.

## Acceptance Criteria

1. `agents/state.py` defines `AdvisoryState` as Pydantic BaseModel with `session_id`, `tenant_id`, `stage`, `traveler_profile`, `errors`
2. `agents/protocols.py` defines `LLMServiceProtocol` and `VectorStoreProtocol`
3. `agents/orchestrator.py` defines a LangGraph `StateGraph`
4. The graph has nodes: profiling (active), calculation (stub), proposal (stub), compliance (stub)
5. The graph transitions correctly from profiling -> calculation -> proposal -> compliance
6. `services/llm.py` implements `LLMServiceProtocol` using Ollama with OpenAI-compatible API
7. LangGraph checkpointer stores agent state in PostgreSQL
8. A test can invoke the graph and verify it reaches each stub node in sequence
9. Unit tests pass with PostgreSQL only -- no Qdrant or Redis required

## Tasks / Subtasks

- [x] Task 1: Add LangGraph PostgreSQL checkpointer dependency (AC: #7)
  - [x] Add `langgraph-checkpoint-postgres` to `pyproject.toml` dependencies
  - [x] Add `asyncpg` to `pyproject.toml` dependencies (required by async PostgreSQL checkpointer)
  - [x] Verify `pip install -e ".[dev]"` succeeds with new dependencies
- [x] Task 2: Implement LLM service with Ollama (AC: #6)
  - [x] Create `app/services/llm.py` implementing `LLMServiceProtocol`
  - [x] Use `httpx.AsyncClient` to call Ollama's OpenAI-compatible API at `{OLLAMA_BASE_URL}/v1/chat/completions`
  - [x] Implement `generate()` method — POST to completions endpoint, return content string
  - [x] Implement `stream()` method — POST with `stream=True`, yield content chunks as `AsyncIterator[str]`
  - [x] Read `OLLAMA_BASE_URL` and `LLM_MODEL` from `core/config.py` settings
  - [x] Log all LLM calls with structlog including model name, prompt length, response length, duration_ms
  - [x] Handle connection errors gracefully — raise structured error, do not crash
- [x] Task 3: Create orchestrator graph with stub nodes (AC: #3, #4, #5)
  - [x] Create `app/agents/orchestrator.py`
  - [x] Define `StateGraph` with `AdvisoryState` as the state schema
  - [x] Implement `profiling_node` — active node that invokes LLM service (via Protocol) to generate an initial question
  - [x] Implement `calculation_node` — stub that sets `stage="calculating"` and passes through
  - [x] Implement `proposal_node` — stub that sets `stage="proposing"` and passes through
  - [x] Implement `compliance_node` — stub that sets `stage="validating"` and passes through
  - [x] Define edges: START -> profiling -> calculation -> proposal -> compliance -> END
  - [x] Create `build_graph()` factory function that accepts `LLMServiceProtocol` and returns compiled graph
  - [x] Compile graph with PostgreSQL checkpointer via `langgraph-checkpoint-postgres`
- [x] Task 4: Wire checkpointer to PostgreSQL (AC: #7)
  - [x] Create `app/agents/checkpointer.py` — factory for PostgreSQL checkpointer
  - [x] Use async `PostgresSaver` from `langgraph-checkpoint-postgres`
  - [x] Read connection string from `settings.database_url`
  - [x] Ensure checkpointer tables are created on first use (auto-setup)
  - [x] Checkpointer must use the same PostgreSQL instance as the app database (no additional services)
- [x] Task 5: Write unit tests for orchestrator (AC: #8, #9)
  - [x] Create `app/agents/tests/__init__.py`
  - [x] Create `app/agents/tests/test_orchestrator.py`
  - [x] Test: graph traverses all 4 nodes in correct order (profiling -> calculation -> proposal -> compliance)
  - [x] Test: each stub node correctly updates the `stage` field in state
  - [x] Test: errors in a node are appended to `AdvisoryState.errors`, not raised
  - [x] Test: graph state is persisted and can be resumed via checkpointer (requires PostgreSQL)
  - [x] Mark PostgreSQL-dependent tests with `@pytest.mark.integration` if needed, but prefer using test PostgreSQL
  - [x] Mock the LLM service for profiling node tests — do NOT require a running Ollama instance
- [x] Task 6: Write unit tests for LLM service (AC: #6, #9)
  - [x] Create `app/services/tests/__init__.py`
  - [x] Create `app/services/tests/test_llm.py`
  - [x] Test: `generate()` sends correct request format to Ollama endpoint
  - [x] Test: `stream()` yields chunks correctly
  - [x] Test: connection errors are handled gracefully
  - [x] Use `httpx` mock / `respx` to mock HTTP calls — do NOT require running Ollama
- [x] Task 7: Verify end-to-end graph execution (AC: #5, #8)
  - [x] Create a test that invokes the full graph with a mock LLM and real PostgreSQL checkpointer
  - [x] Verify the graph reaches the END node
  - [x] Verify final state has `stage="validating"` and no errors
  - [x] Verify checkpointer has persisted all intermediate states
  - [x] Verify `make test` passes clean

## Dev Notes

### Critical Architecture Constraints

- **Pydantic BaseModel for state** -- LangGraph state MUST use Pydantic BaseModel, NOT TypedDict. This is an architecture decision (AR-5).
- **Protocol-based DI** -- The orchestrator MUST accept `LLMServiceProtocol` via dependency injection. Never import `OllamaLLMService` directly inside the orchestrator.
- **No Qdrant, no Redis** -- This is Phase 1. Unit tests must pass with PostgreSQL only.
- **No agent logic** -- The profiling node should make a single LLM call to prove the pipeline works. It does NOT implement the full profiling agent (that is Story 1.4).
- **Errors in state, not exceptions** -- Agent nodes append errors to `AdvisoryState.errors`. They do NOT raise exceptions that break the graph.
- **structlog everywhere** -- All logging via structlog with `session_id`, `tenant_id`, `agent_name` keys.

### Existing Code (from Story 1.1)

`AdvisoryState` already exists at `app/agents/state.py`:
```python
from typing import Literal
from pydantic import BaseModel

class AdvisoryState(BaseModel):
    session_id: str
    tenant_id: str
    stage: Literal["profiling", "calculating", "proposing", "validating"] = "profiling"
    traveler_profile: dict | None = None
    calculations: dict | None = None
    proposal: dict | None = None
    compliance_report: dict | None = None
    errors: list[dict] = []
```

`LLMServiceProtocol` already exists at `app/agents/protocols.py`:
```python
from typing import AsyncIterator, Protocol

class LLMServiceProtocol(Protocol):
    async def generate(self, prompt: str, **kwargs) -> str: ...
    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]: ...
```

`Settings` already exists at `app/core/config.py` with `ollama_base_url` and `llm_model` fields.

### LangGraph StateGraph Pattern

```python
# app/agents/orchestrator.py
from langgraph.graph import StateGraph, START, END
from app.agents.state import AdvisoryState
from app.agents.protocols import LLMServiceProtocol
import structlog

logger = structlog.get_logger()

def build_graph(llm_service: LLMServiceProtocol, checkpointer=None):
    """Build the advisory workflow graph.

    Args:
        llm_service: LLM service implementing LLMServiceProtocol.
        checkpointer: LangGraph checkpointer (PostgresSaver for prod, MemorySaver for tests).
    """
    graph = StateGraph(AdvisoryState)

    async def profiling_node(state: AdvisoryState) -> dict:
        logger.info("agent.started", agent="profiling", session_id=state.session_id)
        try:
            # Active node — makes a real LLM call to prove the pipeline
            response = await llm_service.generate(
                "You are a travel advisor. Ask the client about their travel plans. "
                "Ask about: destination, dates, budget, and group size."
            )
            return {
                "stage": "profiling",
                "traveler_profile": {"initial_question": response},
            }
        except Exception as e:
            logger.error("agent.failed", agent="profiling", error=str(e))
            return {"errors": state.errors + [{"agent": "profiling", "message": str(e)}]}

    async def calculation_node(state: AdvisoryState) -> dict:
        logger.info("agent.stub", agent="calculation", session_id=state.session_id)
        return {"stage": "calculating"}

    async def proposal_node(state: AdvisoryState) -> dict:
        logger.info("agent.stub", agent="proposal", session_id=state.session_id)
        return {"stage": "proposing"}

    async def compliance_node(state: AdvisoryState) -> dict:
        logger.info("agent.stub", agent="compliance", session_id=state.session_id)
        return {"stage": "validating"}

    graph.add_node("profiling", profiling_node)
    graph.add_node("calculation", calculation_node)
    graph.add_node("proposal", proposal_node)
    graph.add_node("compliance", compliance_node)

    graph.add_edge(START, "profiling")
    graph.add_edge("profiling", "calculation")
    graph.add_edge("calculation", "proposal")
    graph.add_edge("proposal", "compliance")
    graph.add_edge("compliance", END)

    return graph.compile(checkpointer=checkpointer)
```

### Ollama LLM Service Pattern

```python
# app/services/llm.py
import time
from typing import AsyncIterator

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class OllamaLLMService:
    """LLM service using Ollama's OpenAI-compatible API.

    Satisfies LLMServiceProtocol. Swap to vLLM in Phase 3 by
    changing OLLAMA_BASE_URL to the vLLM endpoint — same API contract.
    """

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
    ):
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.model = model or settings.llm_model
        self.client = httpx.AsyncClient(timeout=120.0)

    async def generate(self, prompt: str, **kwargs) -> str:
        start = time.monotonic()
        response = await self.client.post(
            f"{self.base_url}/v1/chat/completions",
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                **kwargs,
            },
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.info(
            "llm.generate",
            model=self.model,
            prompt_len=len(prompt),
            response_len=len(content),
            duration_ms=duration_ms,
        )
        return content

    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        async with self.client.stream(
            "POST",
            f"{self.base_url}/v1/chat/completions",
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": True,
                **kwargs,
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: ") and line != "data: [DONE]":
                    import json
                    chunk = json.loads(line[6:])
                    delta = chunk["choices"][0].get("delta", {})
                    if "content" in delta:
                        yield delta["content"]
```

### PostgreSQL Checkpointer Pattern

```python
# app/agents/checkpointer.py
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.core.config import settings


async def create_checkpointer() -> AsyncPostgresSaver:
    """Create a PostgreSQL-backed LangGraph checkpointer.

    Uses the same PostgreSQL instance as the application database.
    The checkpointer creates its own tables on first use.
    """
    checkpointer = AsyncPostgresSaver.from_conn_string(settings.database_url)
    await checkpointer.setup()  # Creates checkpoint tables if not exist
    return checkpointer
```

Note: The `database_url` in settings uses `postgresql://` scheme. The `asyncpg`-based checkpointer may require `postgresql+asyncpg://` — verify and adjust in `config.py` if needed, or pass a modified connection string to `from_conn_string()`.

### Test Pattern — Mock LLM, Real PostgreSQL

```python
# app/agents/tests/test_orchestrator.py
import pytest
from unittest.mock import AsyncMock

from app.agents.orchestrator import build_graph
from app.agents.state import AdvisoryState


class MockLLMService:
    async def generate(self, prompt: str, **kwargs) -> str:
        return "What destination are you interested in visiting?"

    async def stream(self, prompt: str, **kwargs):
        yield "What "
        yield "destination?"


@pytest.fixture
def mock_llm():
    return MockLLMService()


async def test_graph_traverses_all_nodes(mock_llm):
    """Graph should traverse profiling -> calculation -> proposal -> compliance."""
    graph = build_graph(llm_service=mock_llm, checkpointer=None)

    initial_state = AdvisoryState(
        session_id="test-session-1",
        tenant_id="test-tenant-1",
    )

    config = {"configurable": {"thread_id": "test-thread-1"}}
    result = await graph.ainvoke(initial_state.model_dump(), config=config)

    assert result["stage"] == "validating"
    assert result["errors"] == []


async def test_profiling_node_calls_llm(mock_llm):
    """Profiling node should invoke LLM and store response."""
    graph = build_graph(llm_service=mock_llm, checkpointer=None)

    initial_state = AdvisoryState(
        session_id="test-session-2",
        tenant_id="test-tenant-1",
    )

    config = {"configurable": {"thread_id": "test-thread-2"}}
    result = await graph.ainvoke(initial_state.model_dump(), config=config)

    assert result["traveler_profile"] is not None
```

### Dependencies to Add

```toml
# Add to pyproject.toml [project].dependencies
"langgraph-checkpoint-postgres>=2.0.0",
"asyncpg>=0.30.0",
```

### Anti-Patterns -- DO NOT

- **DO NOT** implement the full profiling conversation loop -- that is Story 1.4
- **DO NOT** add conditional edges or routing logic yet -- this story proves linear traversal
- **DO NOT** import `OllamaLLMService` directly inside `orchestrator.py` -- use Protocol
- **DO NOT** require a running Ollama instance for unit tests -- always mock the LLM
- **DO NOT** add Qdrant or Redis dependencies -- Phase 1 is PostgreSQL only
- **DO NOT** create API endpoints for the graph -- that comes in Story 1.7 (SSE streaming)
- **DO NOT** use TypedDict for LangGraph state -- use Pydantic BaseModel (AdvisoryState)
- **DO NOT** use `MemorySaver` in production -- use `AsyncPostgresSaver`

### File Structure After This Story

```
backend/app/
├── agents/
│   ├── __init__.py
│   ├── protocols.py          # Already exists (Story 1.1)
│   ├── state.py              # Already exists (Story 1.1)
│   ├── orchestrator.py       # NEW — LangGraph StateGraph
│   ├── checkpointer.py       # NEW — PostgreSQL checkpointer factory
│   └── tests/
│       ├── __init__.py       # NEW
│       └── test_orchestrator.py  # NEW
├── services/
│   ├── __init__.py
│   ├── llm.py                # NEW — OllamaLLMService
│   └── tests/
│       ├── __init__.py       # NEW
│       └── test_llm.py       # NEW
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- LangGraph State Convention, Protocol Interface Convention]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Data Architecture: LangGraph PostgreSQL checkpointer]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Confirmed Tech Stack: Ollama for dev, vLLM for prod]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Boundary Rules: agents/ -> services/llm.py via LLMServiceProtocol]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 1, Story 1.3]
- [Source: _bmad-output/implementation-artifacts/1-1-project-setup.md -- Existing code artifacts]
- [LangGraph docs: https://langchain-ai.github.io/langgraph/]
- [langgraph-checkpoint-postgres: https://github.com/langchain-ai/langgraph/tree/main/libs/checkpoint-postgres]
- [Ollama OpenAI compatibility: https://github.com/ollama/ollama/blob/main/docs/openai.md]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
