import structlog

logger = structlog.get_logger()

_model = None
_MODEL_NAME = "all-MiniLM-L6-v2"
VECTOR_SIZE = 384


class EmbeddingService:
    """Wraps sentence-transformers for vector embedding generation."""

    def __init__(self, model_name: str = _MODEL_NAME) -> None:
        self.model_name = model_name

    def _get_model(self):
        global _model
        if _model is None:
            from sentence_transformers import SentenceTransformer

            _model = SentenceTransformer(self.model_name)
            logger.info("embeddings.model_loaded", model=self.model_name)
        return _model

    def embed(self, text: str) -> list[float]:
        model = self._get_model()
        return model.encode(text).tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        model = self._get_model()
        return model.encode(texts).tolist()
