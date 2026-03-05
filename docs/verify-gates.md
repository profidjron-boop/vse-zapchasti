# Verify Gates — Все запчасти

## Корень проекта
- `pnpm web:lint` — линтинг Next.js (из apps/web)
- `pnpm web:typecheck` — проверка типов TypeScript
- `pnpm web:test` — тесты Vitest (если используются)
- `pnpm --dir apps/web run build` — сборка Next.js

## API (apps/api)
cd apps/api
make lint        # ruff check
make test        # pytest
make migrate     # alembic upgrade head
make migrate-check # текущее состояние миграций (alembic current)

## Docker (инфра)
- `docker-compose build` — сборка образов
- `docker-compose up -d` — запуск
- `docker-compose down` — остановка

## Release gates (перед публикацией)
0. `bash scripts/release-check.sh` — единый прогон release readiness:
   - backup (`docs/backup.sh`)
   - restore-check (`docs/restore-check.sh`)
   - smoke (`scripts/smoke.sh` + `--with-write`)
1. `pnpm web:lint && pnpm web:typecheck && pnpm --dir apps/web run build`
2. `cd apps/api && make lint && make test && make migrate-check`
3. `docker-compose build`
4. `bash docs/backup.sh` — бэкап БД
5. `bash docs/restore-check.sh --input <path-to-backup.dump>` — проверка восстановления из backup
6. Smoke:
   - `bash scripts/smoke.sh`
   - `bash scripts/smoke.sh --with-write`
   - `scripts/smoke.sh` сам поднимает `postgres` (`docker compose up -d postgres`), запускает API на `:8000` и Web на `:3000` (build + start), ждёт готовность `/health` и `/`, затем останавливает фоновые процессы API/Web по `trap EXIT`.

## Runbook
- `docs/release-rollback-runbook.md` — пошаговый release/rollback процесс

## Запрещено
- Запускать команды, не описанные здесь или в package.json/Makefile
- Придумывать свои таргеты

## Umbrella gate: verify-all

Единый прогон всех verify-гейтов проекта (web + api + db).

- scripts/verify-all.sh

## CI gates

- `.github/workflows/release-check.yml` — CI job с one-command release readiness (`scripts/release-check.sh`) и upload backup artifacts.

Примечания:
- Скрипт поднимает dev Postgres через docker compose при необходимости и ждёт порт 5433 перед `api:migrate-check`.
- Использовать как “одна команда, чтобы проверить всё” перед коммитом/релизом.
