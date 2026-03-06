# ADR-0002: Public Forms Rate-Limit Backend (Redis default, in-memory fallback)

**Status:** Accepted
**Date:** 2026-03-06
**Project:** Все запчасти
**Context:** Публичные POST-формы (`/api/public/leads`, `/api/public/orders`, `/api/public/service-requests`, `/api/public/vin-requests`) должны иметь предсказуемый глобальный лимит в multi-worker/multi-instance окружении.

## Decision
1) Основной backend для rate-limit: **Redis** (`RATE_LIMIT_REDIS_URL` или `REDIS_URL`).
2) Лимит применяется по ключу `scope + IP` в окне `PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS`.
3) Если Redis временно недоступен или не настроен, включается **in-memory fallback** (single-process), чтобы не ломать API в dev/аварийном режиме.
4) Сообщение отказа остаётся единым: `429 Слишком много запросов. Попробуйте позже.`

## Operational notes
- Для production Redis-конфигурация обязательна.
- Для local/dev допускается запуск без Redis с fallback.
- При включённом Redis лимит становится глобальным между инстансами API.

## Consequences
- Снимается риск непредсказуемого rate-limit в multi-instance окружении.
- Поведение в production становится консистентным и масштабируемым.
- Сохраняется безопасная деградация в dev при отсутствии Redis.

## Non-goals
- Распределённый лимит для всех возможных endpoint’ов вне публичных write-form flow.
- Сложные адаптивные/поведенческие анти-бот сценарии на этом этапе.
