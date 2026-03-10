# Документация проекта «Все запчасти»

Дата актуализации: 2026-03-10

Этот каталог содержит только рабочую и релизную документацию.
Промты, AI-логи сессий и временные отчёты исключены из release-репозитория.

---

## 1) Основные документы (читать в первую очередь)

- `docs/requirements.md` — согласованные требования v1.1.
- `docs/project-state.md` — текущее состояние проекта и риски.
- `docs/project-handoff-2026-03-09.md` — handoff-пакет для передачи/приёмки.
- `docs/deploy.md` — production deploy и обязательные env-настройки.
- `docs/verify-gates.md` — verify/runtime/release checks.
- `docs/release-rollback-runbook.md` — релиз и откат.
- `docs/pre-release-checklist-2026-03-10.md` — финальный чек перед выкладкой.

---

## 2) Функциональная и продуктовая документация

- `docs/tz-implementation-matrix-2026-03-09.md` — матрица соответствия ТЗ.
- `docs/tz-gap-report-2026-03-09.md` — gap-check по ТЗ.
- `docs/customer-go-live-pack-2026-03-10.md` — пакет для заказчика (что реализовано, как пользоваться, что нужно для go-live).
- `docs/production-metadata-template-2026-03-09.md` — шаблон production metadata.
- `docs/production-metadata-draft-2026-03-09.md` — рабочий драфт metadata.
- `docs/customer-production-metadata-form-2026-03-09.md` — анкета для заполнения заказчиком.

---

## 3) Интеграции

- `docs/integrations/1c-erp-tech-design.md` — техдизайн 1С/ERP.
- `docs/integrations/notifications-providers-runbook.md` — подключение каналов уведомлений.
- `docs/integrations/payments-flow-runbook.md` — подключение payment-flow/предоплаты.
- `docs/integrations/supplier-data-package.md` — пакет данных поставщика.

---

## 4) Архитектура / ADR

- `docs/decisions/ADR-0001-import-sources-and-scheduling.md`
- `docs/decisions/ADR-0002-rate-limit-scope-and-redis-trigger.md`
- `docs/decisions/ADR-0003-admin-auth-token-storage.md`

---

## 5) Вспомогательные материалы

- `docs/stack.md`
- `docs/project-header.md`
- `docs/design-system.md`
- `docs/ui-direction.md`
- `docs/ux-copy.md`
- `docs/assets-sources.md`
- `docs/audit-closure-2026-03-09.md`

---

## 6) Что удалено из релизного дерева

Удалены и не должны попадать в Git:
- `docs/master-prompts/*`
- session/chat логи и временные PDF/TXT отчёты
- временные HTML-артефакты генерации документов

Контроль реализован через `.gitignore`.
