# TZ Implementation Matrix — 2026-03-09

Источник требований: `docs/requirements.md` (v1.1)  
Дата фиксации факта: 2026-03-09 (Asia/Krasnoyarsk)

Статусы:
- `Implemented` — реализовано в коде и присутствует в текущем runtime.
- `Implemented (Ops-Dependent)` — код готов, финальное включение зависит от прод-настроек/провайдеров.
- `Partial/Scope-Limited` — реализовано частично в рамках утверждённого v1.1 scope.
- `Optional (Not Implemented)` — опциональный блок ТЗ, отдельный flow не обнаружен.

| ТЗ пункт | Статус | Подтверждение (repo evidence) | Остаток / примечание |
|---|---|---|---|
| 1) Единый сайт: каталог + заказ + сервис-заявка | Implemented | `apps/web/src/app/parts/page.tsx`, `apps/web/src/app/cart/page.tsx`, `apps/web/src/app/service/page.tsx`; `apps/api/routers/public.py` | — |
| 2) Главная с обязательными блоками | Implemented | `apps/web/src/app/page.tsx` | Контент управляется через `/admin/content` |
| 2) Каталог: 2 направления, категории → список → карточка | Implemented | `apps/web/src/app/parts/page.tsx`, `apps/web/src/app/parts/p/[sku]/page.tsx`; `GET /api/public/categories`, `GET /api/public/products` | — |
| 2) Поиск/подбор по артикулу/OEM/названию | Implemented | `apps/web/src/app/parts/page.tsx`; фильтры/поиск в `apps/api/routers/public.py` | — |
| 2) Подбор по авто (марка/модель/год/двигатель) | Implemented | `apps/web/src/app/parts/page.tsx`; vehicle filters в `apps/api/routers/public.py` | — |
| 2) VIN-подбор только как заявка менеджеру | Implemented | `apps/web/src/app/parts/vin/page.tsx`; `POST /api/public/vin-requests` в `apps/api/routers/public.py` | — |
| 2) Корзина guest + checkout + one-click + избранное | Implemented | `apps/web/src/app/cart/page.tsx`, `apps/web/src/app/favorites/page.tsx`; `POST /api/public/orders` | — |
| 2) ЛК: история и статусы заказов | Implemented | `apps/web/src/app/account/orders/page.tsx`; `GET /api/public/orders/history` | История по телефону (без auth-аккаунта) |
| 2) Доставка: самовывоз/курьер | Implemented | `ORDER_DELIVERY_METHODS` в `apps/api/schemas.py`; checkout UI `apps/web/src/app/cart/page.tsx` | — |
| 2) Оплата: при получении/по счёту | Implemented | `ORDER_PAYMENT_METHODS` в `apps/api/schemas.py`; checkout UI `apps/web/src/app/cart/page.tsx` | — |
| 2) Сервис: один центр, справочник услуг, запись-заявка | Implemented | `apps/web/src/app/service/page.tsx`; `GET /api/public/service-catalog`, `POST /api/public/service-requests` | Модель записи — только заявка, подтверждает менеджер |
| 2) Админка: товары/категории/цены | Implemented | `apps/web/src/app/admin/products*`, `apps/web/src/app/admin/categories*`; admin routers в `apps/api/routers/admin.py` | — |
| 2) Админка: записи/статусы | Implemented | `apps/web/src/app/admin/leads*`, `vin-requests*`, `service-requests*`, `orders*`; status endpoints в `apps/api/routers/admin.py` | Календарь слотов не включён (и не обязателен) |
| 2) Админка: отчёты (минимально) | Implemented | `apps/web/src/app/admin/reports/page.tsx` | — |
| 2) Админка: О компании / Контакты | Implemented | `apps/web/src/app/admin/content/page.tsx` + публичные `about/contacts` | — |
| 3) Карточка товара: SKU/OEM/бренд/совместимость/аналоги/фото/характеристики/акции | Implemented | models/schemas + admin product forms (`apps/api/models.py`, `apps/api/schemas.py`, `apps/web/src/app/admin/products/*`, `apps/web/src/app/parts/p/[sku]/page.tsx`) | — |
| 4) Источники данных: ручной/CSV-XLSX/1С-ERP | Partial/Scope-Limited | Ручной + CSV/XLSX реализованы (`admin` CRUD, `POST /api/admin/products/import`); import UI/script | 1С/ERP: выбран import-first, online sync вне текущего этапа |
| 4) Режимы обновления: ручной/расписание/событие | Implemented | `apps/web/src/app/admin/imports/page.tsx`, ключ `import_products_update_mode`, `scripts/import-products.sh` | Фактический scheduler/webhook зависит от внедрения |
| 5) Статусы заказа `new → in_progress → ready → closed/canceled` | Implemented | `ORDER_STATUSES` + status update в `apps/api/routers/admin.py`; admin order UI | Переходы валидируются на API |
| 6) Сервис-форма: contacts + авто-поля (включая engine, VIN, mileage) | Implemented | `apps/web/src/app/service/page.tsx`, `ServiceRequestBase` в `apps/api/schemas.py` | `name` опционально (по ТЗ) |
| 7) Предоплата записи (возможность) | Implemented (Ops-Dependent) | `prepayment_required/prepayment_amount` в service catalog (models/schemas/admin UI/public display) | Платёжный контур 54-ФЗ не включён по умолчанию |
| 8) Связка “Запчасть + установка” | Implemented (Optional Scope) | карточка товара: CTA `Запчасть + установка` (`apps/web/src/app/parts/p/[sku]/page.tsx`) -> сервис-форма с prefill (`apps/web/src/app/service/page.tsx`) -> поля заявки в API/DB (`apps/api/schemas.py`, `apps/api/models.py`) | Опциональный flow включён, менеджер подтверждает итоговую оценку |
| 9) Уведомления: Email/SMS/мессенджер | Implemented (Ops-Dependent) | `apps/api/notifications.py`, `NOTIFY_*` env, webhook allowlist | Нужны прод-провайдеры/секреты |
| 10) Разделы админки из ТЗ | Implemented | меню/роли в `apps/web/src/app/admin/layout.tsx` | — |
| 11) Baseline security + 152-ФЗ | Implemented | RBAC (`admin/layout.tsx`, admin auth/roles), rate-limit (`public.py` + Redis fallback), consent logging (models/routers), self-hosted asset checks (`web:no-remote-assets`) | — |
| 12) Ops/наблюдаемость (`health/ready`, logs+trace_id, backup/restore) | Implemented | `apps/api/main.py`, `docs/backup.sh`, `docs/restore-check.sh`, `scripts/release-check.sh` | — |
| 13) DoD/Release-Rollback | Implemented | `scripts/verify-all.sh`, `scripts/runtime-audit-local.sh`, `scripts/release-check.sh`, `docs/release-rollback-runbook.md` | — |
| 14) Assumptions (VIN и сервис как заявка, no online payment by default) | Implemented | публичные API flow и UI соответствуют модели заявок; payment set ограничен | — |
| 15) v1.1 решения (import-first, update modes, promo format, prepayment off by default) | Implemented / Scope-Limited | `docs/requirements.md`, `admin/imports`, import script, service catalog prepayment flags | online sync/платёжный подпроект остаются отдельными этапами |

## Открытый остаток (не блокирует pre-prod, но блокирует “fully hardened prod”)
1. Заполнить production metadata в handoff/state: домены, доступы, владельцы, SLA/эскалации.
2. Утвердить и включить фактических провайдеров уведомлений (SMS/мессенджер/email) на prod.
3. При решении включить предоплату — выполнить отдельный платёжный техдизайн и правовой контур (54-ФЗ/возвраты).
