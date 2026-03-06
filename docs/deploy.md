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

## API env (обязательно)
- `apps/api/.env`:
  - `JWT_SECRET_KEY` — обязательный ключ подписи JWT (только env, без хардкода).
  - `JWT_PREVIOUS_SECRET_KEY` — опционально для миграции при ротации ключа.
  - `UPLOAD_DIR` — директория self-hosted загрузок (absolute path или путь относительно корня репо).
- `dev` пример:
  - `JWT_SECRET_KEY=change-me-long-random-secret`
  - `UPLOAD_DIR=apps/web/public/uploads`
- `prod` правило:
  - задавать уникальный длинный `JWT_SECRET_KEY` в окружении;
  - при ротации сначала задать новый `JWT_SECRET_KEY` и старый в `JWT_PREVIOUS_SECRET_KEY`,
    затем после пере-логина пользователей убрать `JWT_PREVIOUS_SECRET_KEY`.

## Notifications env (email/sms/messenger)
- Каналы включаются только через env и только по факту выбранной реализации.
- Базовые переменные:
  - `NOTIFY_EMAIL_TO` — список email получателей через запятую.
  - `NOTIFY_EMAIL_FROM` — отправитель.
  - `NOTIFY_SMTP_HOST`, `NOTIFY_SMTP_PORT`, `NOTIFY_SMTP_USER`, `NOTIFY_SMTP_PASSWORD`.
  - `NOTIFY_SMTP_STARTTLS` — `true/false` (по умолчанию `true`).
  - `NOTIFY_SMS_WEBHOOK_URL` — webhook для SMS-провайдера (РФ).
  - `NOTIFY_MESSENGER_WEBHOOK_URL` — webhook для мессенджера (self-hosted/РФ).
- Поведение:
  - уведомления по публичным событиям (`lead.created`, `order.created`, `service_request.created`, `vin_request.created`);
  - отправка best-effort: ошибка канала не ломает создание заявки.

## Admin auth strategy (текущее состояние)
- Browser auth: cookie-first.
  - `admin_session` (HttpOnly cookie) хранит JWT.
  - `admin_csrf_token` используется для CSRF-защиты write-запросов.
- API поддерживает legacy Bearer JWT как переходную совместимость для скриптов/сторонних клиентов.
- Web больше не хранит чувствительный JWT в `localStorage`; используется только переходный marker `admin_token=cookie-session` для существующих guard-ов.
- Logout: `POST /api/admin/auth/logout` очищает auth cookies на сервере.
- Параметры cookie в env:
  - `ADMIN_COOKIE_SECURE` (`true/false`, по умолчанию `false` для dev),
  - `ADMIN_COOKIE_SAMESITE` (`lax|strict|none`, по умолчанию `lax`).

## Web env (обязательно)
- `apps/web/.env`:
  - `API_BASE_URL` — base URL API для server-side fetch в Next.js.
  - `NEXT_PUBLIC_API_BASE_URL` — base URL API для browser fetch.
  - `NEXT_PUBLIC_SITE_URL` — канонический публичный URL сайта (metadataBase, robots, sitemap).
- `dev` пример:
  - `API_BASE_URL=http://localhost:8000`
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
  - `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000`
- `prod` правило:
  - использовать публичный URL API (например, `https://api.vsezapchasti.ru`)
  - использовать публичный URL web (например, `https://vsezapchasti.ru`)
  - не использовать `localhost` в production-окружении

## High-level steps (без команд; конкретика появится после появления compose/infra)
1) Подготовить сервер: SSH keys only, firewall, no root login.
2) Развернуть Docker/Compose.
3) Настроить Nginx + TLS.
4) Поднять Postgres (volume + backup policy).
5) Deploy приложений (web+api) через compose.
6) Smoke tests (home, поиск, заявка/запись).
7) Мониторинг/логи по scope.

## CI release readiness
- Workflow: `.github/workflows/release-check.yml`
- Триггеры: `pull_request` в `main`, `push` в `main`, `workflow_dispatch`.
- Проверка: one-command `scripts/release-check.sh`:
  - `scripts/verify-all.sh`
  - backup (`docs/backup.sh`)
  - restore-check (`docs/restore-check.sh`)
  - smoke (`scripts/smoke.sh` + `--with-write`)
- Артефакты backup сохраняются в CI как `release-check-backups`.

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

## Режимы обновления импорта (manual/hourly/daily/event)
- Для операционного запуска использовать `scripts/import-products.sh`.
- Скрипт работает через существующий API импортов (`/api/admin/products/import`) и пишет `trigger_mode` в `import_runs` (`manual/hourly/daily/event`).
- Источник режима:
  - `IMPORT_MODE=auto` (по умолчанию) читает `import_products_update_mode` из контента;
  - можно явно задать `IMPORT_MODE=hourly|daily|event|manual`.
- Защита от случайного запуска:
  - при `manual` скрипт завершает работу без импорта;
  - при `event` нужен флаг `--event`, иначе запуск пропускается.
- Минимальные env для запуска:
  - `IMPORT_FILE_PATH` — путь до CSV/XLSX;
  - `ADMIN_TOKEN` **или** `IMPORT_ADMIN_EMAIL` + `IMPORT_ADMIN_PASSWORD`;
  - опционально: `IMPORT_DEFAULT_CATEGORY_ID`, `IMPORT_SKIP_INVALID=1`, `API_BASE_URL`.
- Примеры:
  - Плановый запуск (cron/systemd timer): `IMPORT_MODE=hourly ... bash scripts/import-products.sh`
  - Внешний триггер: `IMPORT_MODE=event ... bash scripts/import-products.sh --event`

## Backups (обязательно перед релизом)
- Регулярные бэкапы Postgres + проверка восстановления.
- Документировать restore steps.

### Миграции БД

Применить миграции до актуального состояния (head):
- `cd apps/api && make migrate`

Проверить текущее состояние миграций:
- `cd apps/api && make migrate-check`
