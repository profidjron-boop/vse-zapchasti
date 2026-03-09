# АКТ ПЕРЕДАЧИ ПРОЕКТА / PROJECT HANDOFF

Название проекта: Все запчасти  
Версия документа: v1.1
Дата передачи: 2026-03-09  
Сдаёт: Сергей (CTO)  
Принимает: не указано (требуется заполнение)  
Основание: repo state + release evidence (2026-03-09)  
Стек: RU Stack Lock v1.1
Статус: Draft

## 1) Что сдаётся
Краткое описание:
- Реализован и проверен production-oriented контур web+api для магазина запчастей и записи на сервис.
- Закрыты audit findings `F-01..F-08` (см. `docs/audit-closure-2026-03-09.md`).
- Подтверждён полный release path: verify + audits + backup + restore-check + smoke read/write/admin.

Что не реализовано / отклонения от полного handoff:
- Не предоставлены фактические production домены, серверные адреса, регистратор DNS и список ответственных лиц.
- Нет подтверждённой даты последнего production deploy.
- Нет подписанных SLA/гарантийных условий в репозитории.
- Для закрытия этих пунктов использовать шаблон: `docs/production-metadata-template-2026-03-09.md`.

Профиль сложности: M  
Release commit / tag: `d086646` (`feat: finalize v1.1 hardening, QA gates, and handoff docs`)
Дата последнего production deploy: не предоставлено

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
| production web/api host | не предоставлено | web+api runtime | не предоставлено | не предоставлено |
| production postgres host | не предоставлено | DB | не предоставлено | не предоставлено |

### 3.2 Домены и DNS
| Домен | Регистратор | Где DNS | TTL важных записей |
|---|---|---|---|
| не предоставлено | не предоставлено | не предоставлено | не предоставлено |

### 3.3 Доступы к системам
| Система | URL / адрес | Логин / способ входа | Кому передан | Примечание |
|---|---|---|---|---|
| Админка приложения | `<site>/admin/login` | email + password (cookie session) | не предоставлено | роли `admin/manager/service_manager` |
| API admin auth | `<api>/api/admin/auth/token` | OAuth2 password | не предоставлено | для скриптов/интеграций |
| База данных prod | не предоставлено | не предоставлено | не предоставлено | метод и доступы не переданы |
| CI/CD | `.github/workflows/*` | GitHub access | не предоставлено | release-check workflow есть |
| Backup storage | `backups/postgres/*` (локальный путь) | файловый доступ | не предоставлено | prod path не передан |
| Домены / DNS | не предоставлено | не предоставлено | не предоставлено | требуется заполнение |
| Почта / уведомления | env-based SMTP/webhooks | env secrets | не предоставлено | см. `docs/deploy.md` |

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
  - `backups/postgres/release_20260309_172501.dump`

### 5.3 Мониторинг и алерты
- Health endpoints: `/health`, `/api/health`, `/api/ready`.
- Primary health signal: green smoke + health endpoints.
- Rollback trigger: smoke fail / health fail после деплоя.
- Каналы алертов: не предоставлены.

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
- Текущий head (по последнему release-check): `f6e2c1a9b7d3`

### 6.3 Backup проверка
- Проверка восстановления:
  - `bash docs/restore-check.sh --input backups/postgres/release_20260309_172501.dump`

## 7) Известные ограничения и технический долг
| Область | Описание | Приоритет | Рекомендуемые действия |
|---|---|---|---|
| Handoff metadata | Отсутствуют production адреса/домены/владельцы доступов | High | заполнить разделы 3.1–3.3 перед подписанием акта |
| Release traceability | Нет зафиксированного production tag/deploy date | Medium | ввести tagging policy + deploy журнал |
| Operations ownership | Не назначены SLA/контакт эскалации в артефактах передачи | Medium | закрепить owners + escalation matrix в итоговом акте |

## 8) Гарантии и поддержка после сдачи
### 8.1 Гарантийный период
- Не предоставлен в репозитории.

### 8.2 Поддержка
- Условия поддержки и SLA не предоставлены.
- Контактная точка эскалации должна быть назначена отдельно.

### 8.3 Что не покрывается
- Новый функционал вне утверждённого scope.
- Изменения требований после приёмки.
- Инциденты на стороне внешних провайдеров (хостинг, DNS, почта), если не оговорено договором.

## 9) Release evidence
- Release commit / tag: `d086646`, production tag не предоставлен.
- Дата deploy: не предоставлена.
- Backup artifact: `backups/postgres/release_20260309_172501.dump`.
- Smoke result: `✅ all checks passed` (read + write + mandatory admin checks, 2026-03-09 17:25–17:26).
- Migration result: `alembic current -> f6e2c1a9b7d3 (head)`.
- Restore check: `ok: restored tables=15`, `alembic_version=f6e2c1a9b7d3`.

## 10) Подписи
Сдал: Сергей (CTO) _________________ Дата: _________  
Принял: __________________________ Дата: _________
