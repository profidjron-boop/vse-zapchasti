# Verify Gates — Все запчасти

**Правило:** ассистент запускает только команды, которые:
1) существуют в репозитории (package.json scripts / pyproject / Makefile / docs/handoff.sh), или
2) прямо задокументированы в этом файле.

Если таргета нет — сначала добавляем его (отдельным CHANGE), затем используем.

## Web (Next.js) — root scripts
Команды запускаются из корня репо:

- `pnpm web:lint`
- `pnpm web:typecheck`
- `pnpm web:test` (появится вместе с тестовым фреймворком)

## API (FastAPI) — Makefile targets
Команды запускаются из `apps/api`:

- `make lint` (ruff)
- `make test` (pytest)
- `make migrate-check` (появится после подключения Alembic)

## Release / Infra (позже, при подготовке релиза)
- `docker:build` (будет задокументировано после появления compose)

## Bootstrap docs
- `docs/handoff.sh` существует и исполняемый
- `docs/*.md` (source of truth) присутствуют

