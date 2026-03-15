.PHONY: lint test test-cov migrate migrate-check

UV := $(shell if [ -x ./.venv/bin/uv ]; then printf '%s' ./.venv/bin/uv; elif command -v uv >/dev/null 2>&1; then command -v uv; else printf '%s' uv; fi)
DATABASE_URL ?= $(shell if [ -f ../../.env.prod ]; then   POSTGRES_USER="$$(sed -n 's/^POSTGRES_USER=//p' ../../.env.prod | head -n1)";   POSTGRES_PASSWORD="$$(sed -n 's/^POSTGRES_PASSWORD=//p' ../../.env.prod | head -n1)";   POSTGRES_DB="$$(sed -n 's/^POSTGRES_DB=//p' ../../.env.prod | head -n1)";   if [ -n "$$POSTGRES_USER" ] && [ -n "$$POSTGRES_PASSWORD" ] && [ -n "$$POSTGRES_DB" ]; then     printf 'postgresql+psycopg://%s:%s@localhost:5433/%s' "$$POSTGRES_USER" "$$POSTGRES_PASSWORD" "$$POSTGRES_DB";   else     printf '%s' 'postgresql+psycopg://vsez:vsez_dev_password_change_me@localhost:5433/vsez';   fi; else   printf '%s' 'postgresql+psycopg://vsez:vsez_dev_password_change_me@localhost:5433/vsez'; fi)
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
