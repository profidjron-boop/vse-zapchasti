# Requirements (SRS/PRD-lite) — Все запчасти

**Version:** v1.0  
**Date:** 2026-03-04  
**Status:** Draft → Implementation  
**Refs:** `docs/project-header.md`, `docs/stack.md`, `docs/ui-direction.md`, `docs/design-system.md`, `docs/ux-copy.md`  
**ADR:** `docs/decisions/ADR-0001-import-sources-and-scheduling.md`

## 1) Summary
Сайт “Все запчасти” (Красноярск): продажа/заказ автозапчастей + запись на ремонт (легковые и грузовые).
Runtime policy: NO CDN. Данные/инфра в РФ. Без MVP/демо/заглушек.

## 2) Scope
### Included
- Public: Home, Catalog, Product, Search, Parts Leads, Service/Repair Leads, Content pages (Contacts/Policies).
- Admin: Catalog mgmt, Leads mgmt, Service requests mgmt, Imports mgmt, RBAC.
- Import pipeline “1C-ready” (ручной файл сейчас; сеть/1С позже без переделки витрины).

### Excluded (default)
- Payments/online checkout, delivery calculators, full ERP sync, personal account.

## 3) Roles
- Guest
- Manager (parts)
- Service Manager
- Admin

## 4) Key journeys
- Search (SKU/OEM/name) → product/list → lead to manager
- “Запчасти под заказ” → callback lead
- VIN request lead
- Service request (car/truck) → lead → processing in admin
- Admin updates catalog/imports → public catalog updated

## 5) Modules
### Public catalog
- Categories → listing → product
- Search + filters + FTS
- Self-hosted images/fonts

### Leads (parts)
- Types: product inquiry / callback / VIN / подбор
- Status workflow + manager notes

### Service requests
- Vehicle type: car/truck
- Work directions (configurable)
- Status workflow + service manager notes
- Calendar: not in v1 (manual confirmation); may be added later

### Admin
- CRUD categories/products/assets
- Imports: runs, errors report, scheduling settings (future)
- RBAC
- Audit logs for critical actions

## 6) Non-functional
- Security baseline: RBAC, rate limit on public forms, secure headers/CSP, secrets env, audit.
- Observability: structured logs + trace_id, health endpoints, backup/restore documented.
- Legal: 152-FZ for leads (phone required; consent + logging).

## 7) “Always accurate” data strategy
- Single import pipeline and normalized catalog.
- Multiple sources (file_upload now; 1C network later) per ADR-0001.
- Public reads from normalized catalog; last successful snapshot preserved if import fails.

