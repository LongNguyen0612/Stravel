# STravel — AI Travel Advisory Platform

AI-powered travel advisory platform for Vietnam with multi-agent orchestration, RAG, and structured advisory workflows.

## Quick Start

```bash
# Copy environment file
cp .env.example .env

# Start Phase 1 services (FastAPI + PostgreSQL + Ollama)
make up

# Run tests
make test

# Run linting
make lint
```

## Project Structure

See `_bmad-output/planning-artifacts/architecture.md` for the full architecture document.

## Tech Stack

- **Backend:** Python 3.12+ / FastAPI
- **Agent Framework:** LangChain + LangGraph
- **Database:** PostgreSQL + SQLModel
- **LLM:** Ollama (dev) / vLLM + Qwen 3.x (prod)
- **Infrastructure:** Docker Compose → Kubernetes
