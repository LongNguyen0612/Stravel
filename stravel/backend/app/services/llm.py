import json as json_lib
import time
from collections.abc import AsyncIterator

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class OllamaLLMService:
    """LLM service using Ollama's native /api/chat endpoint."""

    def __init__(self, base_url: str | None = None, model: str | None = None) -> None:
        self.base_url = base_url or settings.ollama_base_url
        self.model = model or settings.llm_model
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=300.0)

    async def generate(self, prompt: str, **kwargs) -> str:
        start = time.monotonic()
        try:
            response = await self.client.post(
                "/api/chat",
                json={"model": self.model, "messages": [{"role": "user", "content": prompt}], "stream": False},
            )
            response.raise_for_status()
            data = response.json()
            result = data["message"]["content"]
            duration_ms = int((time.monotonic() - start) * 1000)
            logger.info(
                "llm.generate",
                backend="ollama",
                model=self.model,
                prompt_len=len(prompt),
                response_len=len(result),
                duration_ms=duration_ms,
            )
            return result
        except httpx.HTTPError as e:
            logger.error("llm.generate.failed", backend="ollama", model=self.model, error=str(e))
            raise

    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        # Ollama /api/chat with stream:true returns raw NDJSON lines, not SSE
        try:
            async with self.client.stream(
                "POST",
                "/api/chat",
                json={"model": self.model, "messages": [{"role": "user", "content": prompt}], "stream": True},
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk = json_lib.loads(line)
                    except json_lib.JSONDecodeError:
                        continue
                    delta = chunk.get("message", {}).get("content", "")
                    if delta:
                        yield delta
                    if chunk.get("done"):
                        break
        except httpx.HTTPError as e:
            logger.error("llm.stream.failed", backend="ollama", model=self.model, error=str(e))
            raise

    async def generate_via_stream(self, prompt: str, **kwargs) -> str:
        """Collect a streamed response — avoids the httpx read-timeout on long outputs."""
        chunks: list[str] = []
        async for chunk in self.stream(prompt, **kwargs):
            chunks.append(chunk)
        return "".join(chunks)

    async def close(self) -> None:
        await self.client.aclose()


class VLLMService:
    """LLM service using vLLM's OpenAI-compatible API. Implements LLMServiceProtocol."""

    def __init__(self, base_url: str | None = None, model: str | None = None) -> None:
        self.base_url = base_url or settings.vllm_base_url
        self.model = model or settings.llm_model
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=300.0)

    async def generate(self, prompt: str, **kwargs) -> str:
        start = time.monotonic()
        try:
            response = await self.client.post(
                "/v1/chat/completions",
                json={"model": self.model, "messages": [{"role": "user", "content": prompt}], **kwargs},
            )
            response.raise_for_status()
            data = response.json()
            result = data["choices"][0]["message"]["content"]
            duration_ms = int((time.monotonic() - start) * 1000)
            usage = data.get("usage", {})
            logger.info(
                "llm.generate",
                backend="vllm",
                model=self.model,
                prompt_len=len(prompt),
                response_len=len(result),
                duration_ms=duration_ms,
                prompt_tokens=usage.get("prompt_tokens"),
                completion_tokens=usage.get("completion_tokens"),
                total_tokens=usage.get("total_tokens"),
            )
            return result
        except httpx.HTTPError as e:
            logger.error("llm.generate.failed", backend="vllm", model=self.model, error=str(e))
            raise

    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        try:
            async with self.client.stream(
                "POST",
                "/v1/chat/completions",
                json={"model": self.model, "messages": [{"role": "user", "content": prompt}], "stream": True, **kwargs},
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: ") and line != "data: [DONE]":
                        chunk = json_lib.loads(line[6:])
                        delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if delta:
                            yield delta
        except httpx.HTTPError as e:
            logger.error("llm.stream.failed", backend="vllm", model=self.model, error=str(e))
            raise

    async def generate_via_stream(self, prompt: str, **kwargs) -> str:
        """Collect a streamed response — avoids the httpx read-timeout on long outputs."""
        chunks: list[str] = []
        async for chunk in self.stream(prompt, **kwargs):
            chunks.append(chunk)
        return "".join(chunks)

    async def close(self) -> None:
        await self.client.aclose()


def create_llm_service() -> OllamaLLMService | VLLMService:
    """Factory function — selects LLM backend based on settings.llm_backend env var."""
    if settings.llm_backend == "vllm":
        logger.info("llm.backend_selected", backend="vllm", url=settings.vllm_base_url)
        return VLLMService()
    logger.info("llm.backend_selected", backend="ollama", url=settings.ollama_base_url)
    return OllamaLLMService()
