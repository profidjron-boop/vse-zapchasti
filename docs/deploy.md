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

## Trace ID и поиск ошибок (ops)
- API назначает `trace_id` на каждый запрос:
  - если пришёл `X-Request-Id`, используется он;
  - иначе генерируется UUID.
- `trace_id` возвращается в ответе как заголовок `X-Request-Id`.
- Ошибки API отдаются без трассировок, в формате `detail` с хвостом `Код: <trace_id>`.
- Access-логи API пишутся в structured JSON и включают минимум:
  - `method`, `path`, `status`, `duration_ms`, `trace_id`, `user_id` (если есть).
- Поиск инцидента:
  1) взять `trace_id` из сообщения пользователя (`Код: ...`) или из `X-Request-Id`;
  2) найти запись в логах API по `trace_id`;
  3) сверить `path/status/duration_ms/user_id` и связанный временной интервал.

## Стратегия каталога при импортах
- Публичные эндпоинты каталога (`/api/public/products*`) поддерживают режимы чтения:
  - `PUBLIC_PRODUCTS_READ_MODE=snapshot` (по умолчанию) — читать из `last successful snapshot` (`import_runs.snapshot_data`).
  - `PUBLIC_PRODUCTS_READ_MODE=table` — читать из основной таблицы `products`.
- Для строгой гарантии стабильной публички использовать `snapshot`:
  - во время неуспешного импорта (`status=failed`) публичка продолжает читать последний `status=finished` snapshot;
  - новый набор становится публичным только после успешного завершения импорта и фиксации snapshot.
- Если успешных snapshot ещё нет, API автоматически использует fallback на `products`.

## Backups (обязательно перед релизом)
- Регулярные бэкапы Postgres + проверка восстановления.
- Документировать restore steps.

### Миграции БД

Применить миграции до актуального состояния (head):
- `cd apps/api && make migrate`

Проверить текущее состояние миграций:
- `cd apps/api && make migrate-check`
