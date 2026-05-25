.PHONY: up down test lint migrate seed

up:
	docker compose up -d

up-full:
	docker compose -f docker-compose.full.yml up -d

down:
	docker compose down

test:
	cd backend && pytest -m "not integration" -v

test-all:
	cd backend && pytest -v

lint:
	cd backend && ruff check . && ruff format --check .

lint-fix:
	cd backend && ruff check --fix . && ruff format .

migrate:
	cd backend && alembic upgrade head

seed:
	cd backend && python -m data.scripts.seed_vector_store
