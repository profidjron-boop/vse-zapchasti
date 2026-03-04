# Project Header — Все запчасти (PINNED)

- Name: Все запчасти
- Repo: new
- Product type: mixed (ecommerce + запись на ремонт)
- Roles/users:
  - Guest (публичный пользователь)
  - Manager/Operator (обработка заявок/заказов)
  - Admin (управление каталогом/контентом/настройками)
- PDn: leads (forms) — заявки на подбор/запись (телефон/имя/комментарий)
- Integrations: none (по умолчанию; любые внешние сервисы только через ADR)
- Hosting: РФ (data+infra in RF)
- UI profile: premium-dark-saas
- Visual mode: enabled (public pages)

Constraints:
- Runtime policy: NO CDN (self-hosted assets)
- No MVP/DEMO/stubs; только полноценные флоу + корректные states

