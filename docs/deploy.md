# Deploy — Все запчасти (RF, NO CDN)

## Цели
- Инфра и данные в РФ.
- Все ассеты self-hosted.
- Деплой воспроизводимый: pinned versions + lockfiles.

## Target infra (by default)
- Linux VPS (РФ)
- Docker + Docker Compose
- Nginx reverse proxy + TLS (Let’s Encrypt)
- Postgres 15+

## Environments
- `dev` (локально)
- `prod` (VPS РФ)

## Secrets
- Только через `.env` (права 600) или Vault (если появится по scope).
- Не коммитить секреты.

## Web env (обязательно)
- `apps/web/.env`:
  - `API_BASE_URL` — base URL API для server-side fetch в Next.js.
  - `NEXT_PUBLIC_API_BASE_URL` — base URL API для browser fetch.
- `dev` пример:
  - `API_BASE_URL=http://localhost:8000`
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
- `prod` правило:
  - использовать публичный URL API (например, `https://api.vsezapchasti.ru`)
  - не использовать `localhost` в production-окружении

## High-level steps (без команд; конкретика появится после появления compose/infra)
1) Подготовить сервер: SSH keys only, firewall, no root login.
2) Развернуть Docker/Compose.
3) Настроить Nginx + TLS.
4) Поднять Postgres (volume + backup policy).
5) Deploy приложений (web+api) через compose.
6) Smoke tests (home, поиск, заявка/запись).
7) Мониторинг/логи по scope.

## Backups (обязательно перед релизом)
- Регулярные бэкапы Postgres + проверка восстановления.
- Документировать restore steps.

### Миграции БД

Применить миграции до актуального состояния (head):
- `cd apps/api && make migrate`

Проверить текущее состояние миграций:
- `cd apps/api && make migrate-check`
