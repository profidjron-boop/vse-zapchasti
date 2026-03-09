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
make test-cov    # pytest + coverage gate (>=65% total)
make migrate     # alembic upgrade head
make migrate-check # текущее состояние миграций (alembic current)

## Docker (инфра)
- `docker-compose build` — сборка образов
- `docker-compose up -d` — запуск
- `docker-compose down` — остановка

## Release gates (перед публикацией)
0. `bash scripts/release-check.sh` — единый прогон release readiness:
   - preflight verify (`scripts/verify-all.sh`)
   - dependency audit API (`uv run --with pip-audit pip-audit --strict` в `apps/api`)
   - dependency audit Web (`pnpm --dir apps/web audit --prod --audit-level high`)
   - backup (`docs/backup.sh`)
   - restore-check (`docs/restore-check.sh`)
   - smoke (`scripts/smoke.sh` + `--with-write`)
   - при наличии `SMOKE_ADMIN_EMAIL` и `SMOKE_ADMIN_PASSWORD` `release-check` автоматически включает `SMOKE_ADMIN_BOOTSTRAP=1`, если этот флаг явно не задан.
   - чтобы сделать admin-smoke обязательным gate, использовать:
     `RELEASE_REQUIRE_ADMIN_SMOKE=1 bash scripts/release-check.sh`
     (требует `ADMIN_TOKEN` или `SMOKE_ADMIN_EMAIL` + `SMOKE_ADMIN_PASSWORD`).
1. `pnpm web:lint && pnpm web:typecheck && pnpm --dir apps/web run build`
2. `pnpm --dir apps/web audit --prod --audit-level high`
3. `cd apps/api && make lint && make test && make test-cov && make migrate-check`
4. `cd apps/api && UV_CACHE_DIR=./.uv-cache ./.venv/bin/uv run --with pip-audit pip-audit --strict`
5. `docker-compose build`
6. `bash docs/backup.sh` — бэкап БД
7. `bash docs/restore-check.sh --input <path-to-backup.dump>` — проверка восстановления из backup
8. Smoke:
   - `bash scripts/smoke.sh`
   - `bash scripts/smoke.sh --with-write`
   - `scripts/smoke.sh` сам поднимает `postgres` (`docker compose up -d postgres`), запускает API на `:8000` и Web на `:3000` (build + start), ждёт готовность `/health` и `/`, затем останавливает фоновые процессы API/Web по `trap EXIT`.
   - Для admin smoke-check можно передать:
     - готовый токен: `ADMIN_TOKEN=... bash scripts/smoke.sh --with-write`
     - или логин/пароль: `SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... bash scripts/smoke.sh --with-write`
     - при заданных `SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD` скрипт сам запрашивает `/api/admin/auth/token`.
     - чтобы не использовать рабочий admin, можно создать/обновить выделенного smoke-admin прямо в smoke:
       `SMOKE_ADMIN_BOOTSTRAP=1 SMOKE_ADMIN_EMAIL=smoke-admin@vsezapchasti.ru SMOKE_ADMIN_PASSWORD=... bash scripts/smoke.sh --with-write`

## Runbook
- `docs/release-rollback-runbook.md` — пошаговый release/rollback процесс

## Запрещено
- Запускать команды, не описанные здесь или в package.json/Makefile
- Придумывать свои таргеты

## Umbrella gate: verify-all

Единый прогон всех verify-гейтов проекта (web + api + db).

- scripts/verify-all.sh
- Включает `web:no-remote-assets`:
  - fail, если в runtime web-коде найдены внешние источники ассетов/скриптов/стилей
    (например `next/font/google`, `https://` в `script src`, `stylesheet href`, CSS `@import/url(...)`).

## Functional runtime audit

Дополнительная проверка работоспособности основных пользовательских и admin-флоу:

- `bash scripts/runtime-audit.sh`
  - проверяет доступность ключевых web/api роутов;
  - проверяет shape публичных категорий (не только технические `Бренд:` / `Импорт`);
  - проверяет публичные POST флоу (`/api/public/service-requests`, `/api/public/leads`).

Для проверки admin API добавить env:

- `SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... bash scripts/runtime-audit.sh`
  - дополнительно проверяет `/api/admin/auth/me`, `/api/admin/leads`, `/api/admin/service-requests`.

Локальный one-command запуск runtime-аудита с автоподъёмом стека:

- `bash scripts/runtime-audit-local.sh`
- с admin проверками:
  - `SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... bash scripts/runtime-audit-local.sh`

## Dependency audit notes

- `apps/web/pnpm-lock.yaml` является source of truth для Web audit.
- root `pnpm-lock.yaml` не требуется: использовать `pnpm --dir apps/web audit ...`.

## CI gates

- `.github/workflows/verify-all.yml` — CI job с прогоном `scripts/verify-all.sh` на `pull_request`, `push main`, `workflow_dispatch`.
- `.github/workflows/release-check.yml` — CI job с one-command release readiness (`scripts/release-check.sh`) и upload backup artifacts.
  - `pull_request`: `scripts/release-check.sh --skip-write-smoke`
  - `push main` / `workflow_dispatch`: `scripts/release-check.sh`

Если GitHub недоступен:
- `bash scripts/ci-local.sh --mode pr` — локальный эквивалент PR-пайплайна.
- `bash scripts/ci-local.sh --mode main` — локальный эквивалент полного main/release пайплайна.

Примечания:
- Скрипт поднимает dev Postgres через docker compose при необходимости и ждёт порт 5433 перед `api:migrate-check`.
- Использовать как “одна команда, чтобы проверить всё” перед коммитом/релизом.
