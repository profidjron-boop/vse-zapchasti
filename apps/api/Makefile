.PHONY: lint test migrate-check

UV := ./.venv/bin/uv
UV_CACHE_DIR := ./.uv-cache

lint:
	UV_CACHE_DIR=$(UV_CACHE_DIR) $(UV) run ruff check .

test:
	UV_CACHE_DIR=$(UV_CACHE_DIR) $(UV) run pytest -q

migrate-check:
	UV_CACHE_DIR=$(UV_CACHE_DIR) DATABASE_URL="postgresql+psycopg://vsez:vsez_dev_password_change_me@localhost:5433/vsez" $(UV) run alembic current
