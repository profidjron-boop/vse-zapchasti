# ADR-0003: Admin auth token storage strategy (current and migration trigger)

- Status: Accepted
- Date: 2026-03-05
- Deciders: Sergey (greka), project team

## Context

Админская аутентификация реализована через Bearer JWT (`/api/admin/auth/token`).
На web-клиенте токен хранится в `localStorage` (`admin_token`) и дублируется в cookie
для middleware-проверок роутов админки.

Текущая модель рабочая, но имеет повышенный риск при XSS: JavaScript может прочитать токен.
В проекте действует RU Stack Lock и strict production-ready требования.

## Decision

1. На текущем этапе фиксируем модель как допустимую для текущего scope:
   - Bearer JWT без refresh endpoint;
   - хранение токена в `localStorage` + техническая cookie-копия для middleware.
2. Сервер не хранит blacklist/revoke, logout выполняется клиентом (удаление токена).
3. Для прод-среды обязательны:
   - сильный `JWT_SECRET_KEY` только из env;
   - ротация через `JWT_PREVIOUS_SECRET_KEY` (временный grace period).

## Migration trigger (when to move to HttpOnly cookies)

Переход на cookie-first схему (HttpOnly + Secure + SameSite + server-side logout/revoke)
становится обязательным при любом условии:

- обнаружен XSS-инцидент или высокий риск XSS в админском контуре;
- появляется требование комплаенса/аудита с запретом хранения auth-токена в `localStorage`;
- вводятся refresh-токены/длительные сессии;
- расширяется число админских пользователей и роль модели требует централизованного revoke.

## Consequences

- Плюс сейчас: простая эксплуатация, минимальная сложность.
- Минус сейчас: токен-доступность для JS при XSS.
- Риск принят осознанно и ограничен:
  - админский контур,
  - строгий CSP/headers,
  - регулярный verify/security review.

## Links

- `docs/deploy.md` (раздел Admin auth strategy)
- `apps/api/routers/admin.py`
