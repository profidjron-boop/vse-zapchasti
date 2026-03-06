# ADR-0003: Admin auth token storage strategy (cookie-first with legacy fallback)

- Status: Accepted
- Date: 2026-03-06
- Deciders: Sergey (greka), project team

## Context

Нужно снизить риск компрометации admin-сессии при XSS и перейти к browser auth-модели,
где токен недоступен JavaScript.

## Decision

1. Browser auth в админке переведён на cookie-first:
   - `admin_session` (HttpOnly) хранит JWT;
   - `admin_csrf_token` используется для защиты state-changing запросов.
2. Для write-методов admin API (`POST/PUT/PATCH/DELETE`) обязательна проверка CSRF
   при cookie-auth.
3. `localStorage` в web оставлен только как переходный несекретный маркер сессии
   (`admin_token=cookie-session`) для совместимости текущих guard-ов.
4. Legacy Bearer-авторизация оставлена как временный fallback для инструментов/скриптов
   и staged migration.
5. Logout выполняется сервером через `POST /api/admin/auth/logout` с очисткой auth cookies.

## Migration trigger (next stage)

Следующий этап после текущей миграции:
- убрать legacy Bearer fallback из web/admin кода;
- убрать `admin_token` marker из localStorage guard-ов;
- оставить только cookie-auth + CSRF как единственный путь.

## Consequences

- Плюс: JWT больше не хранится в `localStorage`, снижен XSS-риск для admin auth.
- Плюс: серверный logout очищает сессию и CSRF cookie.
- Минус: до полного удаления fallback остаётся mixed-mode совместимость.

## Links

- `docs/deploy.md` (раздел Admin auth strategy)
- `apps/api/routers/admin.py`
- `apps/web/src/lib/fetch-json.ts`
