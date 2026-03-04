# Verify Gates — Все запчасти

**Правило:** ассистент запускает только команды, которые:
1) существуют в репозитории (package.json scripts / pyproject / Makefile / docs/handoff.sh), или  
2) прямо задокументированы в этом файле.

Если таргета нет — сначала добавляем его (отдельным CHANGE), затем используем.

## Standard targets (фиксируем как цель репо)
После инициализации приложений должны существовать и быть задокументированы:

### Web (Next.js)
- `web:lint`
- `web:typecheck`
- `web:test`
- `web:e2e` (только если e2e реально добавлены)

### API (FastAPI)
- `api:lint`
- `api:test`
- `api:migrate-check`

### Release / Infra (позже, при подготовке релиза)
- `docker:build`

## Bootstrap verify (пока нет приложений)
На этапе bootstrap допустимы только проверки наличия обязательных документов и скриптов:
- `docs/handoff.sh` существует и исполняемый
- `docs/stack.md` существует
- `docs/verify-gates.md` существует
- `docs/design-system.md` существует
- `docs/ui-direction.md` существует
- `docs/ux-copy.md` существует
- `docs/deploy.md` существует

