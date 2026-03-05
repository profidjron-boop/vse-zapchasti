.PHONY: lint test migrate migrate-check

UV := ./.venv/bin/uv
DATABASE_URL ?= postgresql+psycopg://vsez:vsez_dev_password_change_me@localhost:5433/vsez
export UV_CACHE_DIR := ./.uv-cache

lint:
	$(UV) run ruff check .

test:
	$(UV) run pytest -q

migrate:
	DATABASE_URL="$(DATABASE_URL)" $(UV) run alembic upgrade head

migrate-check:
	DATABASE_URL="$(DATABASE_URL)" $(UV) run alembic current
