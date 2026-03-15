# API app

Backend for the "Все запчасти" project.

## Stack

- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- Redis
- JWT auth
- Prometheus metrics

## Main areas

- Public API
- Admin API
- Catalog and product data
- Orders
- Leads
- VIN requests
- Service requests
- Imports and integrations
- Notifications

## Important files

- `main.py` — application entrypoint
- `routers/public.py` — public routes
- `routers/admin.py` — admin routes
- `models.py` — database models
- `schemas.py` — API schemas
- `alembic/` — migrations

## Environment

Use example files as the source of truth:

- `.env.example`
- `.env.prod.example`

Do not commit working `.env` files.

## Commands

```bash
uv sync --frozen --no-dev
uv run pytest
uv run uvicorn main:app --reload

