# Tech Design: 1C / ERP Catalog Integration

Date: 2026-03-06  
Status: Approved for v1.1 foundation (import-first)
Scope: catalog/products/prices/stocks for public parts catalog

## 1. Goals
- Support three source modes without changing public API:
  - manual file import (CSV/XLSX),
  - scheduled sync,
  - event-driven sync.
- Keep public catalog stable: read only normalized product tables (or last successful snapshot).
- Guarantee failed sync does not break public storefront.

## 2. Source Modes
- `manual`: admin uploads file in `/admin/imports`.
- `scheduled`: background run by cron/task scheduler (frequency configurable).
- `event`: external trigger/webhook creates import run.

Common pipeline for all modes:
1. Create `import_runs` record with `status=started`.
2. Parse source file/feed into staging payload.
3. Validate rows (`strict` default, `skip_invalid` only if explicitly enabled).
4. Upsert normalized entities in transaction.
5. Save run summary/errors/snapshot metadata.
6. Mark run `finished` or `failed`.

## 3. Exchange Formats
- v1.1 implemented: CSV/XLSX.
- v1.x extension: CommerceML (1C XML) parser adapter.
- All adapters produce the same canonical row schema:
  - `sku` (required),
  - `name` (required),
  - `brand`,
  - `oem`,
  - `category_id | category_slug | category_name`,
  - `price`,
  - `price_on_request` (optional bool marker),
  - `stock_quantity`,
  - `is_active`,
  - `description`.

## 4. Field Mapping Rules
- Product identity key: `sku` (global unique).
- Category resolution priority:
  1. `category_id`,
  2. `category_slug`,
  3. `category_name`,
  4. `default_category_id` from import query params.
- Numeric fields:
  - `price` >= 0,
  - `stock_quantity` >= 0 (normalize to int).
- Price mode:
  - if `price_on_request=true` (or `price` contains marker like `по запросу` / `on_request`) -> store `price=NULL`,
  - otherwise parse `price` as decimal.
- Empty optional fields stored as `NULL`.

## 5. Conflict Resolution
- Last-write-wins within a single run.
- Between runs:
  - newest successful run is source of truth.
- Product merge policy:
  - `sku` match -> update existing product,
  - no match -> create product.
- If row fails validation:
  - `strict`: fail whole run (rollback),
  - `skip_invalid`: continue with row-level error log.

## 6. Data Consistency
- Public read strategy:
  - default `snapshot` mode uses last successful import snapshot.
  - fallback `live` mode reads normalized tables directly.
- If current import fails:
  - storefront keeps reading previous successful snapshot.

## 7. Security / Compliance
- No external CDN/runtime dependencies.
- Integration credentials stored in env only.
- Audit required for:
  - import start/finish/fail,
  - mode and source details,
  - actor (`created_by`) for manual runs.
- For PDn-free catalog import, 152-FZ impact is minimal (no client PDn in import payload).

## 8. Observability
- Structured logs include `trace_id`, `run_id`, `source`, `status`, `duration_ms`.
- Admin UI uses `import_runs` as single audit surface.

## 9. v1.1 Decision
- Production path in v1.1: **import-first**.
- Direct online sync with 1C API/event stream can be enabled in v1.2+ by adding adapter, reusing current pipeline.

## 10. Online sync implementation baseline (current)
- Operational online sync is available via `scripts/import-products.sh`:
  - source modes: `manual/hourly/daily/event`,
  - direct source pull: `IMPORT_SOURCE_URL` (+ optional auth header/basic auth),
  - import target: existing admin pipeline `/api/admin/products/import`.
- This gives immediate 1C/ERP pull integration without changing public catalog contracts.
- Next stage (optional): dedicated adapter service with richer protocol mapping/retries.
