# Project Context — vse-zapchasti

## Project
Название: Все запчасти  
Repo: /home/greka/vse-zapchasti  
Режим: Strict (RU Stack Lock)  
Stack: Next.js (App Router) + FastAPI + PostgreSQL  
Runtime: NO CDN (self-hosted assets)  
Регион/юрисдикция: РФ (152-ФЗ), г. Красноярск

## Public Web (apps/web)
Ключевые страницы:
- `/` — главная (hero, CTA, блоки “Запчасти/Сервис/Под заказ/Контакты”)
- `/parts` — каталог + поиск (в т.ч. FTS/фильтры совместимости)
- `/parts/p/[sku]` — карточка товара + форма “Уточнить/Заказать” + быстрый заказ
- `/parts/vin` — VIN-заявка
- `/service` — форма сервис-заявки + каталог услуг (включая отображение требований предоплаты, если они заданы)
- `/cart` — корзина гостя + checkout (самовывоз/курьер, при получении/по счёту)
- `/favorites` — избранное/отложенное
- `/account/orders` — история/статусы заказов по телефону
- `/contacts`, `/about`, `/privacy`, `/offer`

## Admin Web (apps/web)
Основные разделы:
- `/admin` (дашборд), `/admin/reports`
- `/admin/content` (редактор сайта с пресетами страниц)
- `/admin/imports`, `/admin/imports/[id]`
- `/admin/users`
- `/admin/products`, `/admin/products/new`, `/admin/products/[id]`
- `/admin/categories`, `/admin/categories/new`
- `/admin/leads`, `/admin/leads/[id]`
- `/admin/orders`, `/admin/orders/[id]`
- `/admin/vin-requests`, `/admin/vin-requests/[id]`
- `/admin/service-catalog`, `/admin/service-requests`, `/admin/service-requests/[id]`

RBAC (фактически реализовано):
- `admin`: полный доступ
- `manager`: каталог + leads/VIN
- `service_manager`: только service requests

## API (apps/api)
Ключевые публичные эндпоинты:
- `GET /health`, `GET /api/health`, `GET /api/ready`
- `GET /api/public/categories`
- `GET /api/public/products`, `GET /api/public/products/by-sku/{sku}`
- `POST /api/public/leads`
- `POST /api/public/vin-requests`
- `POST /api/public/service-requests`
- `POST /api/public/orders`, `GET /api/public/orders/history`
- `GET /api/public/service-catalog`
- `GET /api/public/content`

Ключевые admin эндпоинты:
- auth/users/roles, catalog CRUD, service catalog CRUD
- leads/VIN/service requests/orders (list/detail/status)
- imports runs + details, content CRUD, upload

Service catalog:
- поддерживаются поля `prepayment_required` и `prepayment_amount`
- create/update валидируют консистентность предоплаты (`required=true` => сумма обязательна и > 0)

## Ops / Verify
- Verify gates: `docs/verify-gates.md`
- Umbrella gate: `bash scripts/verify-all.sh`
- Smoke: `bash scripts/smoke.sh` и `bash scripts/smoke.sh --with-write`
- Release readiness: `bash scripts/release-check.sh`

## Environment quick refs
- Postgres (docker compose): host port `5433`
- API dev env example: `apps/api/.env.example`
- Web env example: `apps/web/.env.example`

## Chat bootstrap
1. Перейти в репозиторий: `cd ~/vse-zapchasti`  
2. Выполнить: `docs/handoff.sh`  
3. Показать вывод ассистенту.
