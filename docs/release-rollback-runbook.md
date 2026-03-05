# Release / Rollback Runbook — Все запчасти

## Scope
- Web: Next.js (`apps/web`)
- API: FastAPI (`apps/api`)
- DB: Postgres + Alembic migrations

## Preconditions
1. Рабочая ветка синхронизирована, изменения закоммичены.
2. Есть актуальный backup БД и проверка восстановления.
   - `bash docs/backup.sh`
   - `bash docs/restore-check.sh --input <path-to-backup.dump>`
3. Доступны прод-`env`:
   - `apps/web/.env` (`API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`)
   - `apps/api/.env` (`DATABASE_URL` и пр.)

## Release Procedure
1. Verify gates (локально/CI):
   - `pnpm web:lint`
   - `pnpm web:typecheck`
   - `pnpm --dir apps/web run build`
   - `cd apps/api && make lint`
   - `cd apps/api && make test`
   - `cd apps/api && make migrate-check`
2. Build + deploy:
   - `docker-compose build`
   - `docker-compose up -d`
3. Применить миграции:
   - `cd apps/api && make migrate`
4. Запустить smoke:
   - `bash scripts/smoke.sh`
   - `bash scripts/smoke.sh --with-write` (проверка форм с записью)
5. Если smoke зеленый, релиз считается успешным.

## Rollback Procedure
1. Немедленно зафиксировать инцидент:
   - время, версия, симптом, scope.
2. Откат приложения на предыдущий релиз:
   - переключить сервисы web/api на предыдущий image/tag;
   - выполнить `docker-compose up -d`.
3. Проверить доступность:
   - `bash scripts/smoke.sh`
4. Если проблема в миграции/схеме:
   - остановить запись в БД;
   - восстановить БД из backup;
   - поднять web/api на версии, совместимой с восстановленной схемой;
   - повторить `bash scripts/smoke.sh`.
5. После стабилизации оформить postmortem и план корректирующих действий.

## Release Checklist
- Verify gates: green.
- Backup БД сделан перед релизом.
- Restore-check из backup пройден.
- Миграции применены без ошибок.
- Smoke (`GET`) green.
- Smoke (`--with-write`) green.
- Rollback-шаги проверены и задокументированы.
