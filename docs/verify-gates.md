# Verify Gates — Все запчасти

## Корень проекта
- `pnpm web:lint` — линтинг Next.js (из apps/web)
- `pnpm web:typecheck` — проверка типов TypeScript
- `pnpm web:test` — тесты Vitest (TODO: настроить)
- `pnpm web:build` — сборка Next.js

## API (apps/api)
cd apps/api
make lint        # ruff check
make format      # ruff format
make test        # pytest (TODO)
make migrate     # alembic upgrade head
make migrate-check # проверка миграций (alembic check)
make dev         # запуск dev сервера

## Docker (инфра)
- `docker-compose build` — сборка образов
- `docker-compose up -d` — запуск
- `docker-compose down` — остановка

## Release gates (перед публикацией)
1. `pnpm web:lint && pnpm web:typecheck && pnpm web:build`
2. `cd apps/api && make lint && make migrate-check`
3. `docker-compose build`
4. `bash docs/backup.sh` (TODO) — бэкап БД
5. Smoke:
   - `bash scripts/smoke.sh`
   - `bash scripts/smoke.sh --with-write`

## Runbook
- `docs/release-rollback-runbook.md` — пошаговый release/rollback процесс

## Запрещено
- Запускать команды, не описанные здесь или в package.json/Makefile
- Придумывать свои таргеты

## Umbrella gate: verify-all

Единый прогон всех verify-гейтов проекта (web + api + db).

- scripts/verify-all.sh

Примечания:
- Скрипт поднимает dev Postgres через docker compose при необходимости и ждёт порт 5433 перед `api:migrate-check`.
- Использовать как “одна команда, чтобы проверить всё” перед коммитом/релизом.
