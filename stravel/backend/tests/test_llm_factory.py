from app.services.llm import OllamaLLMService, VLLMService, create_llm_service


def test_factory_returns_ollama_by_default():
    service = create_llm_service()
    assert isinstance(service, OllamaLLMService)


def test_factory_returns_vllm_when_configured(monkeypatch):
    monkeypatch.setattr("app.services.llm.settings.llm_backend", "vllm")
    service = create_llm_service()
    assert isinstance(service, VLLMService)


def test_ollama_implements_protocol():
    service = OllamaLLMService()
    assert hasattr(service, "generate")
    assert hasattr(service, "stream")


def test_vllm_implements_protocol():
    service = VLLMService()
    assert hasattr(service, "generate")
    assert hasattr(service, "stream")


def test_ollama_and_vllm_share_interface():
    """Both services should have the same method signatures."""
    ollama = OllamaLLMService()
    vllm = VLLMService()

    # Both should have generate and stream methods
    import inspect

    ollama_gen = inspect.signature(ollama.generate)
    vllm_gen = inspect.signature(vllm.generate)
    assert list(ollama_gen.parameters.keys()) == list(vllm_gen.parameters.keys())
