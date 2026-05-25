# Story 2.7: vLLM Serving Setup

Status: draft

## Story

As a developer,
I want to swap from Ollama to vLLM for production-quality inference with Qwen 3.x,
so that I can fine-tune the model and optimize inference costs in Phase 3.

## Acceptance Criteria

1. `docker-compose.full.yml` includes a vLLM service with `vllm/vllm-openai:latest` image
2. When vLLM is started with `--model Qwen/Qwen3-...`, the service exposes an OpenAI-compatible API on its configured port
3. `services/llm.py` switches from Ollama to vLLM via environment variable (same `LLMServiceProtocol` interface)
4. No agent code changes are required for the swap (transparent via Protocol)
5. Token usage is logged per request for cost tracking
6. `infra/vllm/serve.sh` documents the serving command with recommended parameters
7. Unit tests verify `LLMServiceProtocol` works with both Ollama and vLLM backends

## Tasks / Subtasks

- [ ] Task 1: Add vLLM service to `docker-compose.full.yml` (AC: #1, #2)
  - [ ] Add `vllm` service block using `vllm/vllm-openai:latest` image
  - [ ] Configure port mapping for vLLM API (host 8001 -> container 8000)
  - [ ] Mount a shared volume for model cache (`vllm_models:/root/.cache/huggingface`)
  - [ ] Set default `--model` to `Qwen/Qwen3-8B` via environment/command
  - [ ] Add GPU resource reservation (`deploy.resources.reservations.devices`) for NVIDIA runtime
  - [ ] Add healthcheck using `curl` against the vLLM `/health` endpoint
  - [ ] Add `vllm_models` to the volumes section
  - [ ] Ensure vLLM does NOT replace Ollama in docker-compose.full.yml -- both coexist, env var selects which is active

- [ ] Task 2: Create `infra/vllm/serve.sh` serving script (AC: #6)
  - [ ] Create `infra/vllm/` directory
  - [ ] Write `serve.sh` with documented serving command and recommended parameters
  - [ ] Include `--model Qwen/Qwen3-8B` as the default model
  - [ ] Include `--tensor-parallel-size` for multi-GPU guidance (default 1)
  - [ ] Include `--max-model-len` with recommended value (e.g., 8192)
  - [ ] Include `--gpu-memory-utilization` with recommended value (e.g., 0.90)
  - [ ] Include `--dtype auto` for automatic precision selection
  - [ ] Include `--api-key` placeholder for optional API key protection
  - [ ] Include `--port 8000` (vLLM container port)
  - [ ] Document quantization options (`--quantization awq` / `gptq`) in comments
  - [ ] Document Qwen 3.x model variant options (1.7B, 4B, 8B, 14B, 32B) with VRAM requirements
  - [ ] Make the script executable (`chmod +x`)

- [ ] Task 3: Add env-based LLM backend switching to `core/config.py` (AC: #3)
  - [ ] Add `llm_backend` setting: `Literal["ollama", "vllm"]` with default `"ollama"`
  - [ ] Add `vllm_base_url` setting with default `"http://localhost:8001"`
  - [ ] Add `vllm_api_key` optional setting (default `None`) for vLLM API key auth
  - [ ] Update `.env.example` with new env vars: `LLM_BACKEND`, `VLLM_BASE_URL`, `VLLM_API_KEY`

- [ ] Task 4: Implement `VLLMService` in `services/llm.py` (AC: #3, #5)
  - [ ] Create `VLLMService` class implementing `LLMServiceProtocol`
  - [ ] Use `httpx.AsyncClient` with base_url from `settings.vllm_base_url`
  - [ ] Implement `generate()` -- POST to `/v1/chat/completions`, same request format as Ollama
  - [ ] Implement `stream()` -- POST with `stream=True`, same SSE chunk parsing as Ollama
  - [ ] Add optional `Authorization: Bearer {api_key}` header when `vllm_api_key` is set
  - [ ] Extract token usage from response JSON (`usage.prompt_tokens`, `usage.completion_tokens`, `usage.total_tokens`)
  - [ ] Log token usage per request via structlog: `prompt_tokens`, `completion_tokens`, `total_tokens`, `model`, `duration_ms`
  - [ ] Implement `close()` method to cleanly shut down httpx client

- [ ] Task 5: Add token usage logging to `OllamaLLMService` (AC: #5)
  - [ ] Extract `usage` field from Ollama response (if present -- Ollama returns it in OpenAI-compat mode)
  - [ ] Log `prompt_tokens`, `completion_tokens`, `total_tokens` alongside existing `prompt_len`, `response_len`, `duration_ms`
  - [ ] If `usage` field is not present in response, log `prompt_tokens=None` (graceful degradation -- Ollama does not always return usage)

- [ ] Task 6: Create LLM service factory function (AC: #3, #4)
  - [ ] Add `create_llm_service()` factory function in `services/llm.py`
  - [ ] Read `settings.llm_backend` to decide which implementation to instantiate
  - [ ] If `llm_backend == "ollama"`, return `OllamaLLMService()`
  - [ ] If `llm_backend == "vllm"`, return `VLLMService()`
  - [ ] If unknown backend, raise `ValueError` with descriptive message
  - [ ] Log which backend was selected at startup: `logger.info("llm.backend.selected", backend=settings.llm_backend)`
  - [ ] Update `core/dependencies.py` to use `create_llm_service()` instead of directly instantiating `OllamaLLMService`

- [ ] Task 7: Update `docker-compose.full.yml` backend environment (AC: #3)
  - [ ] Add `LLM_BACKEND` env var to backend service (default `ollama`)
  - [ ] Add `VLLM_BASE_URL` env var to backend service (pointing to `http://vllm:8000`)
  - [ ] Add `VLLM_API_KEY` env var to backend service (optional, from host env)
  - [ ] Keep `OLLAMA_BASE_URL` -- both backends are available, env var selects active one

- [ ] Task 8: Write unit tests for `VLLMService` (AC: #7)
  - [ ] Create `app/services/tests/test_vllm_service.py`
  - [ ] Test: `generate()` sends correct OpenAI-compatible request format
  - [ ] Test: `generate()` returns content string from response
  - [ ] Test: `generate()` logs token usage (prompt_tokens, completion_tokens, total_tokens)
  - [ ] Test: `stream()` yields content chunks from SSE response
  - [ ] Test: API key header is included when `vllm_api_key` is set
  - [ ] Test: API key header is omitted when `vllm_api_key` is None
  - [ ] Test: connection errors are handled gracefully (httpx.HTTPError)
  - [ ] Use `respx` or `httpx` mock to mock HTTP calls -- do NOT require a running vLLM instance

- [ ] Task 9: Write unit tests for LLM service factory (AC: #3, #4, #7)
  - [ ] Create `app/services/tests/test_llm_factory.py`
  - [ ] Test: `create_llm_service()` returns `OllamaLLMService` when `llm_backend == "ollama"`
  - [ ] Test: `create_llm_service()` returns `VLLMService` when `llm_backend == "vllm"`
  - [ ] Test: `create_llm_service()` raises `ValueError` for unknown backend
  - [ ] Test: both returned services satisfy `LLMServiceProtocol` (runtime Protocol check using `isinstance` or duck-type verification)

- [ ] Task 10: Write integration-style Protocol conformance tests (AC: #4, #7)
  - [ ] Create `app/services/tests/test_llm_protocol.py`
  - [ ] Define a test function that accepts any `LLMServiceProtocol` implementor and runs it through standard operations
  - [ ] Test: `OllamaLLMService` has `generate()` and `stream()` methods matching Protocol signature
  - [ ] Test: `VLLMService` has `generate()` and `stream()` methods matching Protocol signature
  - [ ] Test: orchestrator `build_graph()` accepts both service types without error (type-level swap verification)
  - [ ] Test: mock agent node works identically with either backend (same input/output contract)

- [ ] Task 11: Verify no agent code changes required (AC: #4)
  - [ ] Verify `agents/orchestrator.py` imports only `LLMServiceProtocol`, not any concrete implementation
  - [ ] Verify `agents/profiling/agent.py` has zero imports from `services/llm.py`
  - [ ] Run full `pytest -m "not integration"` suite with `LLM_BACKEND=vllm` and mock vLLM -- all existing tests pass unchanged
  - [ ] Verify `make test` passes clean

## Dev Notes

### Critical Architecture Constraints

- **Protocol-based swap** -- The entire point of this story is that `LLMServiceProtocol` makes the Ollama-to-vLLM swap invisible to agent code. The orchestrator and all agents receive the LLM service via dependency injection. Zero changes to any file under `agents/`.
- **Both backends coexist** -- `docker-compose.full.yml` includes both Ollama and vLLM services. The `LLM_BACKEND` env var selects which one is active. This is NOT a replacement -- it is an addition.
- **OpenAI-compatible API contract** -- Both Ollama and vLLM expose the same `/v1/chat/completions` endpoint format. The `VLLMService` request/response parsing should be nearly identical to `OllamaLLMService`.
- **Token usage logging is mandatory** -- This is the foundation for cost tracking in Phase 3. Every LLM call must log token counts.
- **No GPU required for unit tests** -- All tests mock HTTP calls. No running vLLM or Ollama instance required.
- **structlog everywhere** -- All logging via structlog with context keys.

### Existing Code (from Story 1.3)

`LLMServiceProtocol` at `app/agents/protocols.py`:
```python
from typing import AsyncIterator, Protocol

class LLMServiceProtocol(Protocol):
    async def generate(self, prompt: str, **kwargs) -> str: ...
    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]: ...
```

`OllamaLLMService` at `app/services/llm.py`:
```python
class OllamaLLMService:
    """LLM service using Ollama's OpenAI-compatible API. Implements LLMServiceProtocol."""

    def __init__(self, base_url: str | None = None, model: str | None = None) -> None:
        self.base_url = base_url or settings.ollama_base_url
        self.model = model or settings.llm_model
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=60.0)

    async def generate(self, prompt: str, **kwargs) -> str:
        # ... POST to /v1/chat/completions, returns content string
        # Logs: model, prompt_len, response_len, duration_ms

    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        # ... POST with stream=True, yields content chunks

    async def close(self) -> None:
        await self.client.aclose()
```

`Settings` at `app/core/config.py`:
```python
class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "postgresql://stravel:stravel_dev@localhost:5432/stravel"
    ollama_base_url: str = "http://localhost:11434"
    llm_model: str = "qwen2.5:7b"
    secret_key: str = "change-me-in-production"
    # ... other settings
```

### VLLMService Implementation Pattern

```python
# app/services/llm.py — VLLMService addition

class VLLMService:
    """LLM service using vLLM's OpenAI-compatible API. Implements LLMServiceProtocol.

    vLLM exposes the same /v1/chat/completions endpoint as Ollama.
    Key difference: vLLM always returns token usage in the response.
    """

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        api_key: str | None = None,
    ) -> None:
        self.base_url = base_url or settings.vllm_base_url
        self.model = model or settings.llm_model
        headers = {}
        if api_key or settings.vllm_api_key:
            headers["Authorization"] = f"Bearer {api_key or settings.vllm_api_key}"
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=120.0, headers=headers)

    async def generate(self, prompt: str, **kwargs) -> str:
        start = time.monotonic()
        try:
            response = await self.client.post(
                "/v1/chat/completions",
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    **kwargs,
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            duration_ms = int((time.monotonic() - start) * 1000)

            # Token usage logging -- vLLM always returns usage
            usage = data.get("usage", {})
            logger.info(
                "llm.generate",
                backend="vllm",
                model=self.model,
                prompt_len=len(prompt),
                response_len=len(content),
                prompt_tokens=usage.get("prompt_tokens"),
                completion_tokens=usage.get("completion_tokens"),
                total_tokens=usage.get("total_tokens"),
                duration_ms=duration_ms,
            )
            return content
        except httpx.HTTPError as e:
            logger.error("llm.generate.failed", backend="vllm", model=self.model, error=str(e))
            raise

    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        # Same SSE parsing as OllamaLLMService -- identical wire format
        try:
            async with self.client.stream(
                "POST",
                "/v1/chat/completions",
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
                        delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if delta:
                            yield delta
                        # Log token usage from the final chunk if present
                        usage = chunk.get("usage")
                        if usage:
                            logger.info(
                                "llm.stream.usage",
                                backend="vllm",
                                model=self.model,
                                prompt_tokens=usage.get("prompt_tokens"),
                                completion_tokens=usage.get("completion_tokens"),
                                total_tokens=usage.get("total_tokens"),
                            )
        except httpx.HTTPError as e:
            logger.error("llm.stream.failed", backend="vllm", model=self.model, error=str(e))
            raise

    async def close(self) -> None:
        await self.client.aclose()
```

### Factory Function Pattern

```python
# app/services/llm.py — factory function

def create_llm_service() -> OllamaLLMService | VLLMService:
    """Create LLM service based on LLM_BACKEND environment variable.

    Returns:
        LLM service implementing LLMServiceProtocol.

    Raises:
        ValueError: If LLM_BACKEND is not 'ollama' or 'vllm'.
    """
    backend = settings.llm_backend
    if backend == "ollama":
        logger.info("llm.backend.selected", backend="ollama", base_url=settings.ollama_base_url)
        return OllamaLLMService()
    elif backend == "vllm":
        logger.info("llm.backend.selected", backend="vllm", base_url=settings.vllm_base_url)
        return VLLMService()
    else:
        raise ValueError(f"Unknown LLM backend: {backend}. Must be 'ollama' or 'vllm'.")
```

### Config Additions Pattern

```python
# app/core/config.py — additions
from typing import Literal

class Settings(BaseSettings):
    # ... existing settings ...

    # LLM Backend Selection
    llm_backend: Literal["ollama", "vllm"] = "ollama"
    vllm_base_url: str = "http://localhost:8001"
    vllm_api_key: str | None = None
```

### docker-compose.full.yml vLLM Service Pattern

```yaml
# Add to docker-compose.full.yml services:
  vllm:
    image: vllm/vllm-openai:latest
    ports:
      - "8001:8000"
    volumes:
      - vllm_models:/root/.cache/huggingface
    environment:
      HUGGING_FACE_HUB_TOKEN: ${HUGGING_FACE_HUB_TOKEN:-}
    command: >
      --model Qwen/Qwen3-8B
      --dtype auto
      --max-model-len 8192
      --gpu-memory-utilization 0.90
      --port 8000
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 120s

# Add to volumes:
  vllm_models:
```

### infra/vllm/serve.sh Pattern

```bash
#!/usr/bin/env bash
# vLLM Serving Script for STravel
#
# Usage:
#   ./infra/vllm/serve.sh                    # Default: Qwen3-8B
#   MODEL=Qwen/Qwen3-4B ./infra/vllm/serve.sh  # Override model
#
# Qwen 3.x Model Variants & VRAM Requirements:
#   Qwen/Qwen3-1.7B   ~  4 GB VRAM  (dev/testing)
#   Qwen/Qwen3-4B     ~  8 GB VRAM  (small prod)
#   Qwen/Qwen3-8B     ~ 16 GB VRAM  (recommended prod)
#   Qwen/Qwen3-14B    ~ 28 GB VRAM  (high quality)
#   Qwen/Qwen3-32B    ~ 64 GB VRAM  (multi-GPU)
#
# Quantization (reduce VRAM by ~50%):
#   Add --quantization awq  for AWQ quantized models
#   Add --quantization gptq for GPTQ quantized models
#   Use model variants like Qwen/Qwen3-8B-AWQ
#
# Multi-GPU:
#   Set TENSOR_PARALLEL_SIZE to the number of GPUs

set -euo pipefail

MODEL="${MODEL:-Qwen/Qwen3-8B}"
PORT="${PORT:-8000}"
GPU_MEMORY_UTILIZATION="${GPU_MEMORY_UTILIZATION:-0.90}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-8192}"
TENSOR_PARALLEL_SIZE="${TENSOR_PARALLEL_SIZE:-1}"
API_KEY="${VLLM_API_KEY:-}"

ARGS=(
    --model "$MODEL"
    --port "$PORT"
    --dtype auto
    --max-model-len "$MAX_MODEL_LEN"
    --gpu-memory-utilization "$GPU_MEMORY_UTILIZATION"
    --tensor-parallel-size "$TENSOR_PARALLEL_SIZE"
    --trust-remote-code
)

if [ -n "$API_KEY" ]; then
    ARGS+=(--api-key "$API_KEY")
fi

echo "Starting vLLM server..."
echo "  Model:         $MODEL"
echo "  Port:          $PORT"
echo "  Max Model Len: $MAX_MODEL_LEN"
echo "  GPU Util:      $GPU_MEMORY_UTILIZATION"
echo "  Tensor Parallel: $TENSOR_PARALLEL_SIZE"

exec python -m vllm.entrypoints.openai.api_server "${ARGS[@]}"
```

### Token Usage Logging Format

All LLM calls (both backends) must log token usage in a consistent structlog format:

```python
logger.info(
    "llm.generate",
    backend="ollama",       # or "vllm"
    model="qwen3-8b",
    prompt_len=1234,        # character length of prompt
    response_len=567,       # character length of response
    prompt_tokens=312,      # from API response usage field
    completion_tokens=142,  # from API response usage field
    total_tokens=454,       # from API response usage field
    duration_ms=2340,
)
```

This enables downstream cost tracking via log aggregation:
- Filter by `backend` to compare Ollama vs vLLM costs
- Sum `total_tokens` per `session_id` for per-session token budgeting (NFR-7)
- Track `duration_ms` per backend for latency comparison

### .env.example Additions

```env
# LLM Backend Selection (ollama or vllm)
LLM_BACKEND=ollama

# vLLM (Phase 3 -- production inference)
VLLM_BASE_URL=http://localhost:8001
VLLM_API_KEY=
HUGGING_FACE_HUB_TOKEN=
```

### Test Pattern -- Mock HTTP for VLLMService

```python
# app/services/tests/test_vllm_service.py
import pytest
import respx
import httpx
from app.services.llm import VLLMService

@pytest.fixture
def vllm_service():
    return VLLMService(base_url="http://mock-vllm:8000", model="Qwen/Qwen3-8B")

@respx.mock
async def test_generate_returns_content(vllm_service):
    respx.post("http://mock-vllm:8000/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "Hello, how can I help?"}}],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 7,
                    "total_tokens": 17,
                },
            },
        )
    )
    result = await vllm_service.generate("Hello")
    assert result == "Hello, how can I help?"

@respx.mock
async def test_generate_logs_token_usage(vllm_service, caplog):
    respx.post("http://mock-vllm:8000/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "Response"}}],
                "usage": {
                    "prompt_tokens": 15,
                    "completion_tokens": 5,
                    "total_tokens": 20,
                },
            },
        )
    )
    await vllm_service.generate("Test prompt")
    # Verify structlog captured token usage -- exact assertion depends on structlog test setup

@respx.mock
async def test_api_key_header_included():
    service = VLLMService(base_url="http://mock-vllm:8000", model="test", api_key="sk-test-key")
    route = respx.post("http://mock-vllm:8000/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "OK"}}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            },
        )
    )
    await service.generate("test")
    assert route.calls[0].request.headers["Authorization"] == "Bearer sk-test-key"
```

### Anti-Patterns -- DO NOT

- **DO NOT** remove Ollama from `docker-compose.full.yml` -- both backends must coexist
- **DO NOT** import `OllamaLLMService` or `VLLMService` directly in any agent code -- always via Protocol
- **DO NOT** hardcode the vLLM model name -- use `settings.llm_model` (shared between backends)
- **DO NOT** require a GPU or running vLLM instance for unit tests -- mock all HTTP calls
- **DO NOT** add vLLM to `docker-compose.yml` (Phase 1 minimal) -- only to `docker-compose.full.yml`
- **DO NOT** change the `LLMServiceProtocol` interface -- the existing `generate()` and `stream()` signatures are sufficient
- **DO NOT** modify any files under `agents/` -- the entire point is zero agent code changes
- **DO NOT** add token usage fields to `LLMServiceProtocol` -- token usage is a logging concern, not an interface concern
- **DO NOT** block startup if vLLM is unreachable -- the service should fail gracefully on first call, not on initialization

### File Structure After This Story

```
stravel/
├── docker-compose.full.yml          # MODIFIED -- vLLM service + backend env vars added
├── .env.example                     # MODIFIED -- LLM_BACKEND, VLLM_BASE_URL, VLLM_API_KEY, HUGGING_FACE_HUB_TOKEN
├── backend/app/
│   ├── core/
│   │   └── config.py                # MODIFIED -- llm_backend, vllm_base_url, vllm_api_key settings
│   ├── services/
│   │   ├── llm.py                   # MODIFIED -- VLLMService class + create_llm_service() factory + token usage logging on OllamaLLMService
│   │   └── tests/
│   │       ├── test_llm.py          # EXISTS -- existing Ollama tests (unchanged)
│   │       ├── test_vllm_service.py # NEW -- VLLMService unit tests
│   │       ├── test_llm_factory.py  # NEW -- factory function tests
│   │       └── test_llm_protocol.py # NEW -- Protocol conformance tests
├── infra/
│   └── vllm/
│       └── serve.sh                 # NEW -- vLLM serving script with documented parameters
```

### Dependencies

No new Python dependencies required. Both `OllamaLLMService` and `VLLMService` use `httpx` (already installed) to call OpenAI-compatible APIs. The `respx` package should already be available in dev dependencies for HTTP mocking.

If `respx` is not yet in dev dependencies:
```toml
# Add to pyproject.toml [project.optional-dependencies].dev
"respx>=0.21.0",
```

### Prerequisite Stories

- **Story 1.1** (Project Setup) -- `docker-compose.yml`, `docker-compose.full.yml`, `.env.example`, project structure
- **Story 1.3** (LangGraph Orchestrator) -- `LLMServiceProtocol`, `OllamaLLMService`, `services/llm.py`, `core/config.py`
- **Story 2.1** (Qdrant Setup) -- `docker-compose.full.yml` already has Qdrant and Redis services

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- Confirmed Tech Stack: Ollama for dev, vLLM for prod]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Boundary Rules: agents/ -> services/llm.py via LLMServiceProtocol]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Progressive Infrastructure Plan: Phase 3 adds vLLM]
- [Source: _bmad-output/planning-artifacts/architecture.md -- AR-10: Ollama for dev, vLLM for prod -- same OpenAI-compatible API contract]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 2, Story 2.7]
- [Source: _bmad-output/project-context.md -- NFR-7: Cost management -- model tiering, caching, token budgeting per session]
- [vLLM docs: https://docs.vllm.ai/en/latest/]
- [vLLM OpenAI-compatible server: https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html]
- [Qwen3 models: https://huggingface.co/collections/Qwen/qwen3-67dd247413f0e2e4f653967f]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
