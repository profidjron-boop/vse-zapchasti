.PHONY: lint test test-cov migrate migrate-check

UV := ./.venv/bin/uv
DATABASE_URL ?= postgresql+psycopg://vsez:vsez_dev_password_change_me@localhost:5433/vsez
export UV_CACHE_DIR := ./.uv-cache

lint:
	$(UV) run ruff check .

test:
	DATABASE_URL="$(DATABASE_URL)" $(UV) run pytest -q

test-cov:
	DATABASE_URL="$(DATABASE_URL)" $(UV) run --with pytest-cov pytest -q \
		--cov=routers.admin \
		--cov=routers.public \
		--cov=main \
		--cov-report=term-missing \
		--cov-fail-under=65

migrate:
	DATABASE_URL="$(DATABASE_URL)" $(UV) run alembic upgrade head

migrate-check:
	DATABASE_URL="$(DATABASE_URL)" $(UV) run alembic current
