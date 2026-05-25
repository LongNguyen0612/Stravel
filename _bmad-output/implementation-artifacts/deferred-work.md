# Deferred Work

## Deferred from: code review of story-1.1 (2026-05-24)

- Unvalidated request_id from header — log injection risk [backend/app/core/middleware.py]
- Production Dockerfile installs dev dependencies — multi-stage build needed [backend/Dockerfile]
- Database engine created at import time — crashes on missing env vars [backend/app/core/database.py]
- AdvisoryState uses bare dict fields — should be typed Pydantic models when Story 1.2 defines them [backend/app/agents/state.py]
- VectorStoreProtocol.search returns list[dict] — should return typed Entity when Epic 2 defines it [backend/app/agents/protocols.py]
- Health endpoint checks no dependencies — add readiness probe when DB models exist [backend/app/api/v1/health.py]
- Test suite has no env isolation before import — add test Settings override [backend/tests/conftest.py]
