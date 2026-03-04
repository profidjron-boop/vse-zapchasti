.PHONY: lint test migrate-check

lint:
	uv run ruff check .

test:
	uv run pytest -q

migrate-check:
	DATABASE_URL="postgresql+psycopg://vsez:vsez_dev_password_change_me@localhost:5433/vsez" uv run alembic current
