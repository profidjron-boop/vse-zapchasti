# АКТ ПЕРЕДАЧИ ПРОЕКТА / PROJECT HANDOFF

Название проекта: Все запчасти
Версия документа: v1.1
Дата передачи: 2026-03-10
Сдаёт: Сергей (CTO)
Принимает: Сергей (greka, owner)
Основание: repo state + release evidence (2026-03-10)
Стек: RU Stack Lock v1.6
Статус: Ready for Sign-Off

## 1) Что сдаётся
Краткое описание:
- Реализован и проверен production-oriented local pre-prod контур web+api для магазина запчастей и записи на сервис.
- Закрыты audit findings `F-01..F-08` (см. `docs/audit-closure-2026-03-09.md`).
- Подтверждён полный release path: verify + audits + backup + restore-check + smoke read/write/admin.

Что не реализовано / отклонения от полного handoff:
- 1С/ERP online adapter-service (полноценный online sync) вынесен в отдельный этап внедрения.
- Уведомления Email/SMS/мессенджер включаются после утверждения прод-провайдеров и секретов.
- Предоплата записи остаётся выключенной до отдельного платёжного техдизайна (54-ФЗ/возвраты/провайдер).
- SLA/гарантийные условия фиксируются в отдельном договорном документе.

Профиль сложности: M
Release commit / tag: `38e739f` (release-ready working tree, rc-local-20260310)
Дата последнего local pre-prod deploy/check: 2026-03-10 15:48 (Asia/Krasnoyarsk, release-check)

## 2) Для клиента: как это работает
### 2.1 Что получил клиент
- Публичный сайт с каталогом запчастей, поиском, корзиной, заявками и записью на сервис.
- Админ-панель для управления каталогом, заявками, заказами, VIN-запросами и контентом.
- Защищённый процесс обновления: перед релизом обязательная проверка, резервная копия и тест восстановления.

### 2.2 Как войти в систему
- Публичная часть: без входа.
- Админ-панель: страница `/admin/login`.
- Роли: `admin`, `manager`, `service_manager`.
- Если пароль утерян: требуется действующий `admin`, который задаст новый пароль пользователю в админке (раздел users) или через техническую команду.

### 2.3 Как управлять данными
- В админке доступны операции с товарами, категориями, заказами, заявками, VIN-запросами и контентом.
- Самостоятельно можно выполнять ежедневные операции по контенту/каталогу/обработке заявок.
- Техническая помощь требуется для релизов, миграций, восстановления из backup и изменения инфраструктуры.

### 2.4 Что делать если что-то сломалось
- Первый шаг: проверить доступность сайта и отправку тестовой заявки.
- Второй шаг: обратиться техническому ответственному и передать время инцидента и текст ошибки.
- Escalation (критично): сайт недоступен, заказы не создаются, админка не входит, не проходят health/smoke проверки.

## 3) Инфраструктура и доступы
### 3.1 Серверы и хостинг
| Название | Адрес / IP | Роль | Провайдер | Доступ |
|---|---|---|---|---|
| local pre-prod web/api host | `127.0.0.1:3000` / `127.0.0.1:8000` (local pre-prod) | web+api runtime | local docker compose | shell user `greka` + docker group |
| local pre-prod postgres host | `127.0.0.1:5433` (service `postgres`) | DB | local docker compose | shell user `greka` + docker group |

### 3.2 Домены и DNS
| Домен | Регистратор | Где DNS | TTL важных записей |
|---|---|---|---|
| `localhost` / `127.0.0.1` | local hosts mapping | local resolver | 60 |

### 3.3 Доступы к системам
| Система | URL / адрес | Логин / способ входа | Кому передан | Примечание |
|---|---|---|---|---|
| Админка приложения | `http://127.0.0.1:3000/admin/login` | email + password | Сергей (greka) | роли `admin/manager/service_manager` |
| API admin auth | `http://127.0.0.1:8000/api/admin/auth/token` | OAuth2 password | Сергей (greka) | для скриптов/интеграций |
| База данных local pre-prod | `postgresql+psycopg://...@127.0.0.1:5433/vsez` | `DATABASE_URL` env | Сергей (greka) | креды хранятся только в env |
| CI/CD | `.github/workflows/*` | GitHub access + local fallback `scripts/ci-local.sh` | Сергей (CTO) | release-check workflow активен |
| Backup storage | `backups/postgres/*` | файловый доступ | Сергей (greka) | sha256 артефакты создаются |
| Домены / DNS | `localhost` / `127.0.0.1` | local hosts mapping | Сергей (greka) | для текущего pre-prod контура |
| Почта / уведомления | env-based SMTP/webhooks | env secrets | Сергей (CTO) | см. `docs/deploy.md` |

### 3.4 Secrets и env
- Хранение: через env (`apps/api/.env`, `apps/web/.env`) или secret store.
- Текущие обязательные env и правила описаны в `docs/deploy.md`.
- Требуется ротация и подтверждение владельцев для прод-ключей (JWT/SMTP/webhook secrets).

## 4) Архитектура системы
### 4.1 Компоненты
| Компонент | Технология | Версия | Назначение | Где запущен |
|---|---|---|---|---|
| Web | Next.js App Router + TypeScript | 16.1.6 (по build output) | публичный сайт + admin UI | Node runtime |
| API | FastAPI + Pydantic v2 | Python 3.12+ | бизнес-логика + admin/public API | Python runtime |
| DB | PostgreSQL | 15+ (policy) | хранение данных | Postgres service |

### 4.2 Схема взаимодействия
- Web обращается к API по `API_BASE_URL`.
- API работает с Postgres и использует Alembic для миграций.
- Публичные заявки/заказы идут через API, админка управляет данными через защищённые admin endpoints.

### 4.3 Зависимости
- Обязательные runtime зависимости внутри проекта: web, api, postgres, redis (для глобального rate-limit).
- Внешние интеграции: уведомления SMTP/webhook (включаются только через env).

## 5) Операционные процедуры
### 5.1 Деплой
1. Проверка готовности релиза:
   - `bash scripts/release-check.sh`
2. Deploy (по runbook):
   - `docker-compose build`
   - `docker-compose up -d`
3. Миграции:
   - `cd apps/api && make migrate`
4. Smoke:
   - `bash scripts/smoke.sh`
   - `bash scripts/smoke.sh --with-write`

Verify gate: `scripts/release-check.sh`
Rollback: `docs/release-rollback-runbook.md`

### 5.2 Бэкап и восстановление
- Backup перед релизом:
  - `bash docs/backup.sh`
- Restore-check:
  - `bash docs/restore-check.sh --input <path-to-backup.dump>`
- Последний подтверждённый backup artifact:
  - `backups/postgres/release_20260310_154701.dump`

### 5.3 Мониторинг и алерты
- Health endpoints: `/health`, `/api/health`, `/api/ready`.
- Primary health signal: green smoke + health endpoints.
- Rollback trigger: smoke fail / health fail после деплоя.
- Каналы алертов: terminal logs + release-check/runtime-audit outputs.

### 5.4 Логи
- API пишет structured JSON access logs с `trace_id`.
- Поиск инцидентов и правила трассировки описаны в `docs/deploy.md`.

### 5.5 Обновления зависимостей
- Регулярный release gate:
  - `pip-audit` в `apps/api`
  - `pnpm audit` в `apps/web`
- При критических CVE: фикс до релиза или explicit accepted risk в docs.

## 6) База данных
### 6.1 Подключение
- Метод подключения задаётся через `DATABASE_URL` в env.
- Credentials в документ не включаются.

### 6.2 Миграции
- Применение: `cd apps/api && make migrate`
- Проверка состояния: `cd apps/api && make migrate-check`
- Текущий head (по последнему release-check): `9c7e5a4b2d11`

### 6.3 Backup проверка
- Проверка восстановления:
  - `bash docs/restore-check.sh --input backups/postgres/release_20260310_154701.dump`

## 7) Известные ограничения и технический долг
| Область | Описание | Приоритет | Рекомендуемые действия |
|---|---|---|---|
| 1С/ERP online sync | Реализован import-first + source trigger, online adapter вынесен отдельно | Medium | делать отдельным этапом внедрения |
| Notifications providers | Каналы готовы кодом, но провайдеры/секреты не включены в runtime | Medium | подключить SMTP/SMS/мессенджер в прод-контуре |
| Service prepayment | Поля/флаги есть, правовой/платёжный контур не подключён | Medium | отдельный подпроект 54-ФЗ/возвраты/провайдер |

## 8) Гарантии и поддержка после сдачи
### 8.1 Гарантийный период
- 30 календарных дней на исправление дефектов P1/P2 после подписания акта.

### 8.2 Поддержка
- L1/L2/L3 эскалация: Сергей (owner/CTO), канал связи фиксируется в рабочем чате проекта.
- SLA по инцидентам оформляется отдельным операционным приложением.

### 8.3 Что не покрывается
- Новый функционал вне утверждённого scope.
- Изменения требований после приёмки.
- Инциденты на стороне внешних провайдеров (хостинг, DNS, почта), если не оговорено договором.

## 9) Release evidence
- Release commit / tag: `38e739f` (`rc-local-20260310`).
- Дата local pre-prod deploy/check: 2026-03-10 15:48 (Asia/Krasnoyarsk, release-check).
- Backup artifact: `backups/postgres/release_20260310_154701.dump`.
- Smoke result: `✅ all checks passed` (read + mandatory admin checks, 2026-03-10 15:47–15:48, `RELEASE_REQUIRE_ADMIN_SMOKE=1`) и `✅ write smoke green` (2026-03-10 15:43–15:44, `scripts/ci-local.sh --mode main`).
- Migration result: `alembic current -> 9c7e5a4b2d11 (head)`.
- Restore check: `ok: restored tables=15`, `alembic_version=9c7e5a4b2d11`.
- Handoff metadata gate: `RELEASE_REQUIRE_HANDOFF_METADATA=1 bash scripts/release-check.sh --skip-write-smoke` -> `GREEN` (2026-03-10).

## 10) Подписи
Сдал: Сергей (CTO) _________________ Дата: 2026-03-10
Принял: Сергей (greka) _____________ Дата: 2026-03-10
