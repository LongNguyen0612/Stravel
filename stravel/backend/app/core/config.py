from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "postgresql://stravel:stravel_dev@localhost:5432/stravel"
    ollama_base_url: str = "http://localhost:11434"
    llm_model: str = "qwen2.5:7b"
    secret_key: str = "change-me-in-production"
    api_v1_prefix: str = "/api/v1"
    otel_service_name: str = "stravel-backend"
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:3000"]

    # Phase 2: Vector DB + Cache
    qdrant_url: str = "http://localhost:6333"
    redis_url: str = "redis://localhost:6379"
    embedding_model: str = "all-MiniLM-L6-v2"

    # LLM backend: "ollama" or "vllm"
    llm_backend: str = "ollama"
    vllm_base_url: str = "http://localhost:8001"

    # Passport OCR: "ollama" | "google_vision" | "textract"
    passport_ocr_provider: str = "ollama"
    vision_model: str = "llava:7b"

    model_config = {"env_file": ".env", "case_sensitive": False, "extra": "ignore"}

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.environment not in ("development", "testing") and self.secret_key == "change-me-in-production":
            raise ValueError("SECRET_KEY must be changed from default in non-development environments")
        return self


settings = Settings()
