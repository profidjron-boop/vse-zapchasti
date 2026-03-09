# Supplier Data Package — Products, Compatibility, Images

Date: 2026-03-07
Status: Ready for supplier handoff
Scope: lawful catalog enrichment without scraping or third-party rights violations

## 1. Purpose

This document defines the exact data package that a supplier or catalog partner can provide for:
- product import,
- product compatibility,
- product images.

The package is aligned with the current project import pipeline:
- catalog rows are imported through `scripts/import-products.sh`,
- local images are imported through `scripts/import-product-images.sh`.

## 2. Legal and operational boundary

Allowed sources:
- supplier-owned export,
- manufacturer/partner export with explicit permission,
- TecDoc/TecAlliance or equivalent licensed source,
- customer-owned local archive.

Not allowed by default:
- scraping internet shops,
- copying media from public product pages without permission,
- using remote runtime image URLs as storefront assets.

Runtime policy:
- all assets are stored locally in project storage,
- no CDN runtime,
- no hotlinking from third-party websites.

## 3. Package structure

Recommended supplier package:

1. `products.csv`
   - product catalog rows
   - one row = one product
   - format example: `docs/integrations/templates/products-import-template.csv`

2. `compatibility.csv` (optional but recommended for QA/review)
   - one row = one product-to-vehicle mapping
   - format example: `docs/integrations/templates/product-compatibility-template.csv`
   - if this file exists, it should also be reflected in `products.csv -> Применимость`
     until a dedicated compatibility importer is introduced.

3. `images/` or `images.zip`
   - local product images
   - filenames must match product `SKU` exactly, or `OEM` as fallback:
     - `N203PR.jpg`
     - `N203PR.png`
     - `12345-AB.webp`

## 4. Required products.csv fields

Minimum required columns:
- `Артикул`
- `Наименование`

Recommended columns:
- `Бренд`
- `OEM`
- `Категория`
- `Цена`
- `Цена по запросу`
- `Остаток`
- `Активен`
- `Описание`
- `Применимость`

Current mapping rules:
- `Артикул` -> `sku`
- `Наименование` -> `name`
- `Бренд` -> `brand`
- `OEM` -> `oem`
- `Категория` -> `category_name`
- `Цена` -> `price`
- `Цена по запросу` -> `price_on_request`
- `Остаток` -> `stock_quantity`
- `Активен` -> `is_active`
- `Описание` -> `description`
- `Применимость` -> `compatibility_raw`

## 5. Products CSV value rules

- `Артикул`
  - REQUIRED
  - globally unique per product
  - stable identifier for import and image binding

- `OEM`
  - optional
  - may repeat across brands

- `Цена`
  - decimal number
  - empty if `Цена по запросу=1`

- `Цена по запросу`
  - accepted values: `1`, `true`, `yes`, `да`
  - if enabled, storefront shows "Цена по запросу"

- `Остаток`
  - non-negative integer

- `Активен`
  - `1` / `0`

- `Применимость`
  - plain text list that can be parsed into compatibility rows
  - recommended separator between multiple vehicles: `|`
  - recommended vehicle format:
    - `Марка;Модель;Год от;Год до;Двигатель`
  - example:
    - `GAZ;Gazelle Next;2013;2026;2.8D | GAZ;Sobol NN;2022;2026;2.5`

## 6. compatibility.csv format

This file is recommended for data review and later bulk-import automation.

Columns:
- `Артикул`
- `Марка`
- `Модель`
- `Поколение`
- `Год от`
- `Год до`
- `Двигатель`

Rules:
- one row = one compatibility relation
- `Артикул` must match an existing product `SKU`
- use one row per exact vehicle mapping

Current project limitation:
- the production importer currently reads compatibility from `products.csv -> Применимость`
- `compatibility.csv` is therefore a supplier-side control file until a dedicated compatibility import step is added

## 7. Images package rules

Supported formats:
- `.jpg`
- `.jpeg`
- `.png`
- `.webp`

Recommended rules:
- one main image per SKU at minimum
- image filename stem must match `SKU`
- if SKU image is missing, OEM filename can be used as fallback
- image background should be neutral
- avoid watermarks and third-party shop overlays

Current import behavior:
- first matching file is attached as product image
- additional files can be attached with `ALLOW_SECONDARY_IMAGES=1`

## 8. Import examples

Catalog import:

```bash
IMPORT_FILE_PATH=./imports/products.csv \
IMPORT_ADMIN_EMAIL=admin@vsezapchasti.ru \
IMPORT_ADMIN_PASSWORD='***' \
bash scripts/import-products.sh --mode hourly
```

Image import:

```bash
IMAGES_ARCHIVE=./imports/images.zip \
IMPORT_ADMIN_EMAIL=admin@vsezapchasti.ru \
IMPORT_ADMIN_PASSWORD='***' \
bash scripts/import-product-images.sh
```

## 9. Acceptance checklist for supplier package

- `products.csv` opens without broken encoding
- required columns exist
- `Артикул` is filled for every row
- `Цена` and `Цена по запросу` do not conflict
- `Применимость` is not empty for products that support vehicle filtering
- image filenames match `SKU` or `OEM`
- images are delivered as local files or zip archive
- supplier confirms rights to transfer and use images/data
