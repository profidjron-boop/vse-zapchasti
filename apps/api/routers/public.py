from collections import defaultdict, deque
from datetime import UTC, datetime
import logging
import os
from pathlib import Path
import secrets
from threading import Lock
import time
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import selectinload
from typing import Any, List, Optional
import uuid

from database import get_db
from notifications import notify_event
from models import (
    AuditLog,
    Category,
    ImportRun,
    Product,
    Lead,
    Order,
    OrderItem,
    ServiceCatalogItem,
    ProductCompatibility,
    ServiceRequest,
    SiteContent,
    VinRequest,
)
from schemas import (
    CategoryResponse,
    ProductResponse,
    LeadCreate,
    LeadResponse,
    OrderCreate,
    OrderRequisitesUploadResponse,
    OrderPublicResponse,
    OrderResponse,
    PaymentWebhookPayload,
    ServiceCatalogItemResponse,
    ServiceRequestCreate,
    ServiceRequestResponse,
    VinRequestCreate,
    VinRequestResponse,
    normalize_phone,
)

router = APIRouter(prefix="/api/public", tags=["public"])
logger = logging.getLogger("api.public")
REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_UPLOAD_DIR = REPO_ROOT / "apps" / "web" / "public" / "uploads"
raw_upload_dir = os.getenv("UPLOAD_DIR")
UPLOAD_DIR = Path(raw_upload_dir).expanduser() if raw_upload_dir else DEFAULT_UPLOAD_DIR
if not UPLOAD_DIR.is_absolute():
    UPLOAD_DIR = (REPO_ROOT / UPLOAD_DIR).resolve()
ORDER_REQUISITES_UPLOAD_DIR = UPLOAD_DIR / "order-requisites"
ORDER_REQUISITES_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ORDER_REQUISITES_ALLOWED_EXTENSIONS = {
    ".pdf": {"application/pdf"},
    ".png": {"image/png"},
    ".jpg": {"image/jpeg", "image/jpg"},
    ".jpeg": {"image/jpeg", "image/jpg"},
}


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _env_positive_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


ORDER_REQUISITES_MAX_BYTES = _env_positive_int(
    "PUBLIC_ORDER_REQUISITES_MAX_BYTES", 10 * 1024 * 1024
)


FORM_RATE_LIMIT_WINDOW_SECONDS = _env_positive_int(
    "PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS", 60
)
DEFAULT_FORM_RATE_LIMIT_PER_MINUTE = _env_positive_int(
    "PUBLIC_FORMS_RATE_LIMIT_PER_MINUTE", 20
)
FORM_RATE_LIMITS_PER_SCOPE = {
    "leads": _env_positive_int(
        "PUBLIC_LEADS_RATE_LIMIT_PER_MINUTE", DEFAULT_FORM_RATE_LIMIT_PER_MINUTE
    ),
    "orders": _env_positive_int(
        "PUBLIC_ORDERS_RATE_LIMIT_PER_MINUTE", DEFAULT_FORM_RATE_LIMIT_PER_MINUTE
    ),
    "order_requisites_upload": _env_positive_int(
        "PUBLIC_ORDER_REQUISITES_UPLOAD_RATE_LIMIT_PER_MINUTE",
        max(5, DEFAULT_FORM_RATE_LIMIT_PER_MINUTE // 2),
    ),
    "service_requests": _env_positive_int(
        "PUBLIC_SERVICE_REQUESTS_RATE_LIMIT_PER_MINUTE",
        DEFAULT_FORM_RATE_LIMIT_PER_MINUTE,
    ),
    "vin_requests": _env_positive_int(
        "PUBLIC_VIN_REQUESTS_RATE_LIMIT_PER_MINUTE",
        DEFAULT_FORM_RATE_LIMIT_PER_MINUTE,
    ),
}
_rate_limit_buckets: dict[str, deque[float]] = defaultdict(deque)
_rate_limit_lock = Lock()
_redis_rate_limit_client: Redis | None = None
REDIS_RATE_LIMIT_URL = (
    os.getenv("RATE_LIMIT_REDIS_URL") or os.getenv("REDIS_URL") or ""
).strip()
PUBLIC_PRODUCTS_READ_MODE = (
    os.getenv("PUBLIC_PRODUCTS_READ_MODE", "snapshot").strip().lower()
)
PUBLIC_PRODUCTS_SNAPSHOT_CACHE_TTL_SECONDS = _env_positive_int(
    "PUBLIC_PRODUCTS_SNAPSHOT_CACHE_TTL_SECONDS", 300
)
PUBLIC_CONTENT_CACHE_TTL_SECONDS = _env_positive_int(
    "PUBLIC_CONTENT_CACHE_TTL_SECONDS", 15
)
PUBLIC_CATEGORIES_CACHE_TTL_SECONDS = _env_positive_int(
    "PUBLIC_CATEGORIES_CACHE_TTL_SECONDS", 15
)
_snapshot_cache_lock = Lock()
_snapshot_cache_checked_at = 0.0
_snapshot_cache_has_snapshot = False
_snapshot_cache_products: Optional[list[dict[str, Any]]] = None
_snapshot_cache_default_active_products: Optional[list[dict[str, Any]]] = None
_public_content_cache_lock = Lock()
_public_content_cache_checked_at = 0.0
_public_content_cache_items: Optional[list[dict[str, Optional[str]]]] = None
_categories_cache_lock = Lock()
_categories_cache: dict[tuple[Optional[int], bool], tuple[float, list[dict[str, Any]]]] = (
    {}
)
FEATURE_NOTIFICATIONS_ENABLED_KEY = "feature_notifications_enabled"
FEATURE_NOTIFICATIONS_EMAIL_ENABLED_KEY = "feature_notifications_email_enabled"
FEATURE_NOTIFICATIONS_SMS_ENABLED_KEY = "feature_notifications_sms_enabled"
FEATURE_NOTIFICATIONS_MESSENGER_ENABLED_KEY = "feature_notifications_messenger_enabled"
FEATURE_SERVICE_PREPAYMENT_ENABLED_KEY = "feature_service_prepayment_enabled"
FEATURE_SERVICE_PAYMENT_FLOW_ENABLED_KEY = "feature_service_payment_flow_enabled"
FEATURE_SERVICE_PAYMENT_BLOCK_UNPAID_ENABLED_KEY = (
    "feature_service_payment_block_unpaid_enabled"
)
INTEGRATION_PAYMENTS_PROVIDER_NAME_KEY = "integration_payments_provider_name"
INTEGRATION_PAYMENTS_DEFAULT_CURRENCY_KEY = "integration_payments_default_currency"


async def _get_redis_rate_limit_client() -> Redis | None:
    global _redis_rate_limit_client
    if not REDIS_RATE_LIMIT_URL:
        return None
    if _redis_rate_limit_client is None:
        _redis_rate_limit_client = Redis.from_url(
            REDIS_RATE_LIMIT_URL, decode_responses=True
        )
    return _redis_rate_limit_client


def _extract_client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _normalize_client_filename(filename: Optional[str]) -> str:
    raw_name = Path(filename or "requisites").name.strip()
    return raw_name[:255] or "requisites"


def _validate_order_requisites_signature(extension: str, content: bytes) -> None:
    if extension == ".pdf" and not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Некорректный PDF-файл")
    if extension == ".png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status_code=400, detail="Некорректный PNG-файл")
    if extension in {".jpg", ".jpeg"} and not content.startswith(b"\xff\xd8\xff"):
        raise HTTPException(status_code=400, detail="Некорректный JPG-файл")


def _resolve_invoice_requisites_path(file_url: str) -> Path:
    relative_path = file_url.removeprefix("/uploads/").strip("/")
    if not relative_path.startswith("order-requisites/"):
        raise HTTPException(
            status_code=400, detail="Недопустимый путь к файлу реквизитов"
        )
    return UPLOAD_DIR / relative_path


async def _enforce_form_rate_limit(request: Request, scope: str) -> None:
    ip_address = _extract_client_ip(request)
    limit_per_minute = FORM_RATE_LIMITS_PER_SCOPE.get(
        scope, DEFAULT_FORM_RATE_LIMIT_PER_MINUTE
    )

    redis_client = await _get_redis_rate_limit_client()
    if redis_client is not None:
        key = f"rl:{scope}:{ip_address}"
        try:
            current = await redis_client.incr(key)
            if current == 1:
                await redis_client.expire(key, FORM_RATE_LIMIT_WINDOW_SECONDS)
            if current > limit_per_minute:
                raise HTTPException(
                    status_code=429,
                    detail="Слишком много запросов. Попробуйте позже.",
                )
            return
        except HTTPException:
            raise
        except Exception as exc:
            # Fallback for local/dev when Redis is temporarily unavailable.
            logger.warning(
                "rate-limit redis unavailable; using in-memory fallback",
                extra={
                    "scope": scope,
                    "ip_address": ip_address,
                    "error_type": exc.__class__.__name__,
                },
            )

    ip_address = request.client.host if request.client else "unknown"
    bucket_key = f"{scope}:{ip_address}"
    now = time.time()
    limit_per_minute = FORM_RATE_LIMITS_PER_SCOPE.get(
        scope, DEFAULT_FORM_RATE_LIMIT_PER_MINUTE
    )

    with _rate_limit_lock:
        bucket = _rate_limit_buckets[bucket_key]
        while bucket and now - bucket[0] > FORM_RATE_LIMIT_WINDOW_SECONDS:
            bucket.popleft()

        if len(bucket) >= limit_per_minute:
            raise HTTPException(
                status_code=429,
                detail="Слишком много запросов. Попробуйте позже.",
            )

        bucket.append(now)


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_content_flag(value: Optional[str], *, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


async def _get_site_content_values(
    db: AsyncSession, keys: list[str]
) -> dict[str, Optional[str]]:
    if not keys:
        return {}

    result = await db.execute(
        select(SiteContent.key, SiteContent.value).where(SiteContent.key.in_(keys))
    )
    values = {key: value for key, value in result.all()}
    return {key: values.get(key) for key in keys}


async def _get_notification_flags(db: AsyncSession) -> dict[str, bool]:
    settings = await _get_site_content_values(
        db,
        [
            FEATURE_NOTIFICATIONS_ENABLED_KEY,
            FEATURE_NOTIFICATIONS_EMAIL_ENABLED_KEY,
            FEATURE_NOTIFICATIONS_SMS_ENABLED_KEY,
            FEATURE_NOTIFICATIONS_MESSENGER_ENABLED_KEY,
        ],
    )
    global_enabled = _parse_content_flag(
        settings.get(FEATURE_NOTIFICATIONS_ENABLED_KEY), default=True
    )
    if not global_enabled:
        return {"enabled": False, "email": False, "sms": False, "messenger": False}

    return {
        "enabled": True,
        "email": _parse_content_flag(
            settings.get(FEATURE_NOTIFICATIONS_EMAIL_ENABLED_KEY), default=True
        ),
        "sms": _parse_content_flag(
            settings.get(FEATURE_NOTIFICATIONS_SMS_ENABLED_KEY), default=True
        ),
        "messenger": _parse_content_flag(
            settings.get(FEATURE_NOTIFICATIONS_MESSENGER_ENABLED_KEY), default=True
        ),
    }


def _notify_with_flags(
    event: str, payload: dict[str, Any], notification_flags: dict[str, bool]
) -> None:
    if not notification_flags.get("enabled", True):
        return
    try:
        notify_event(
            event,
            payload,
            enable_email=notification_flags.get("email", True),
            enable_sms=notification_flags.get("sms", True),
            enable_messenger=notification_flags.get("messenger", True),
        )
    except TypeError:
        notify_event(event, payload)


async def _is_service_prepayment_enabled(db: AsyncSession) -> bool:
    settings = await _get_site_content_values(db, [FEATURE_SERVICE_PREPAYMENT_ENABLED_KEY])
    return _parse_content_flag(
        settings.get(FEATURE_SERVICE_PREPAYMENT_ENABLED_KEY),
        default=False,
    )


def _normalize_payment_currency(value: Optional[str], *, default: str = "RUB") -> str:
    normalized = (value or "").strip().upper()
    if not normalized:
        return default
    return normalized[:10]


def _extract_payments_webhook_token(request: Request) -> str:
    token_header = (request.headers.get("x-payments-token") or "").strip()
    if token_header:
        return token_header

    auth_header = (request.headers.get("authorization") or "").strip()
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return ""


async def _get_service_payment_settings(db: AsyncSession) -> dict[str, Any]:
    settings = await _get_site_content_values(
        db,
        [
            FEATURE_SERVICE_PREPAYMENT_ENABLED_KEY,
            FEATURE_SERVICE_PAYMENT_FLOW_ENABLED_KEY,
            FEATURE_SERVICE_PAYMENT_BLOCK_UNPAID_ENABLED_KEY,
            INTEGRATION_PAYMENTS_PROVIDER_NAME_KEY,
            INTEGRATION_PAYMENTS_DEFAULT_CURRENCY_KEY,
        ],
    )
    return {
        "prepayment_enabled": _parse_content_flag(
            settings.get(FEATURE_SERVICE_PREPAYMENT_ENABLED_KEY),
            default=False,
        ),
        "payment_flow_enabled": _parse_content_flag(
            settings.get(FEATURE_SERVICE_PAYMENT_FLOW_ENABLED_KEY),
            default=False,
        ),
        "payment_block_unpaid_enabled": _parse_content_flag(
            settings.get(FEATURE_SERVICE_PAYMENT_BLOCK_UNPAID_ENABLED_KEY),
            default=False,
        ),
        "provider_name": (settings.get(INTEGRATION_PAYMENTS_PROVIDER_NAME_KEY) or "").strip(),
        "default_currency": _normalize_payment_currency(
            settings.get(INTEGRATION_PAYMENTS_DEFAULT_CURRENCY_KEY),
            default="RUB",
        ),
    }


async def _resolve_service_catalog_item_for_request(
    db: AsyncSession,
    *,
    service_type: str,
    vehicle_type: str,
) -> Optional[ServiceCatalogItem]:
    normalized_service_type = service_type.strip().lower()
    if not normalized_service_type:
        return None

    result = await db.execute(
        select(ServiceCatalogItem)
        .where(
            ServiceCatalogItem.is_active.is_(True),
            func.lower(ServiceCatalogItem.name) == normalized_service_type,
            or_(
                ServiceCatalogItem.vehicle_type == vehicle_type,
                ServiceCatalogItem.vehicle_type == "both",
            ),
        )
        .order_by(ServiceCatalogItem.sort_order.asc(), ServiceCatalogItem.id.asc())
    )
    items = result.scalars().all()
    if not items:
        return None
    for item in items:
        if (item.vehicle_type or "").strip().lower() == vehicle_type:
            return item
    return items[0]


def _is_payment_transition_allowed(current_status: str, next_status: str) -> bool:
    allowed_transitions = {
        "not_required": {"not_required", "pending", "paid", "failed"},
        "pending": {"pending", "paid", "failed", "refunded"},
        "paid": {"paid", "refunded"},
        "failed": {"failed", "pending", "paid"},
        "refunded": {"refunded", "pending", "paid"},
    }
    return next_status in allowed_transitions.get(current_status, set())


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_snapshot_images(raw_images: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_images, list):
        return []

    images: list[dict[str, Any]] = []
    for raw_image in raw_images:
        if not isinstance(raw_image, dict):
            continue

        url = raw_image.get("url")
        if not isinstance(url, str) or not url:
            continue

        images.append(
            {
                "id": _to_int(raw_image.get("id"), 0),
                "url": url,
                "sort_order": _to_int(raw_image.get("sort_order"), 0),
                "is_main": bool(raw_image.get("is_main", False)),
            }
        )

    images.sort(key=lambda item: (item["sort_order"], item["id"]))
    return images


def _normalize_snapshot_compatibilities(
    raw_compatibilities: Any,
) -> list[dict[str, Any]]:
    if not isinstance(raw_compatibilities, list):
        return []

    compatibilities: list[dict[str, Any]] = []
    for raw_compatibility in raw_compatibilities:
        if not isinstance(raw_compatibility, dict):
            continue

        make = raw_compatibility.get("make")
        model = raw_compatibility.get("model")
        if not isinstance(make, str) or not make.strip():
            continue
        if not isinstance(model, str) or not model.strip():
            continue

        engine_raw = raw_compatibility.get("engine")
        engine = engine_raw.strip() if isinstance(engine_raw, str) else None
        if engine == "":
            engine = None

        compatibilities.append(
            {
                "id": _to_int(raw_compatibility.get("id"), 0),
                "make": make.strip(),
                "model": model.strip(),
                "year_from": _to_int(raw_compatibility.get("year_from"), 0) or None,
                "year_to": _to_int(raw_compatibility.get("year_to"), 0) or None,
                "engine": engine,
            }
        )

    return compatibilities


def _normalize_snapshot_product(raw_product: Any) -> Optional[dict[str, Any]]:
    if not isinstance(raw_product, dict):
        return None

    sku = raw_product.get("sku")
    name = raw_product.get("name")
    category_id = raw_product.get("category_id")
    product_id = raw_product.get("id")

    if not isinstance(sku, str) or not sku.strip():
        return None
    if not isinstance(name, str) or not name.strip():
        return None

    created_at_raw = raw_product.get("created_at")
    updated_at_raw = raw_product.get("updated_at")
    created_at = (
        created_at_raw
        if isinstance(created_at_raw, str) and created_at_raw.strip()
        else None
    )
    updated_at = (
        updated_at_raw
        if isinstance(updated_at_raw, str) and updated_at_raw.strip()
        else None
    )
    fallback_timestamp = datetime.now(UTC).replace(tzinfo=None).isoformat()
    if created_at is None and updated_at is None:
        created_at = fallback_timestamp
        updated_at = fallback_timestamp
    elif created_at is None:
        created_at = updated_at
    elif updated_at is None:
        updated_at = created_at

    normalized = {
        "id": _to_int(product_id, 0),
        "category_id": _to_int(category_id, 0),
        "sku": sku.strip(),
        "oem": (
            raw_product.get("oem") if isinstance(raw_product.get("oem"), str) else None
        ),
        "brand": (
            raw_product.get("brand")
            if isinstance(raw_product.get("brand"), str)
            else None
        ),
        "name": name.strip(),
        "description": (
            raw_product.get("description")
            if isinstance(raw_product.get("description"), str)
            else None
        ),
        "price": _to_float(raw_product.get("price")),
        "stock_quantity": _to_int(raw_product.get("stock_quantity"), 0),
        "is_active": bool(raw_product.get("is_active", True)),
        "attributes": (
            raw_product.get("attributes")
            if isinstance(raw_product.get("attributes"), dict)
            else {}
        ),
        "images": _normalize_snapshot_images(raw_product.get("images")),
        "compatibilities": _normalize_snapshot_compatibilities(
            raw_product.get("compatibilities")
        ),
        "created_at": created_at,
        "updated_at": updated_at,
    }

    if normalized["id"] <= 0 or normalized["category_id"] <= 0:
        return None

    return normalized


async def _load_latest_products_snapshot(
    db: AsyncSession,
) -> Optional[list[dict[str, Any]]]:
    global _snapshot_cache_checked_at
    global _snapshot_cache_has_snapshot
    global _snapshot_cache_products
    global _snapshot_cache_default_active_products

    if PUBLIC_PRODUCTS_READ_MODE != "snapshot":
        return None

    now = time.time()
    with _snapshot_cache_lock:
        if (
            now - _snapshot_cache_checked_at
            <= PUBLIC_PRODUCTS_SNAPSHOT_CACHE_TTL_SECONDS
        ):
            if _snapshot_cache_has_snapshot:
                return _snapshot_cache_products or []
            return None

    run_result = await db.execute(
        select(ImportRun)
        .where(ImportRun.entity_type == "products", ImportRun.status == "finished")
        .order_by(ImportRun.id.desc())
        .limit(1)
    )
    run = run_result.scalar_one_or_none()
    if not run or not isinstance(run.snapshot_data, list):
        with _snapshot_cache_lock:
            _snapshot_cache_checked_at = now
            _snapshot_cache_has_snapshot = False
            _snapshot_cache_products = None
            _snapshot_cache_default_active_products = None
        return None

    products: list[dict[str, Any]] = []
    for raw_product in run.snapshot_data:
        normalized = _normalize_snapshot_product(raw_product)
        if normalized is not None:
            products.append(normalized)

    default_active_products = [
        product for product in products if product.get("is_active", False)
    ]
    default_active_products.sort(key=lambda product: _to_int(product.get("id"), 0))

    with _snapshot_cache_lock:
        _snapshot_cache_checked_at = now
        _snapshot_cache_has_snapshot = True
        _snapshot_cache_products = products
        _snapshot_cache_default_active_products = default_active_products

    return products


def _normalize_optional_filter(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip().lower()
    return normalized or None


def _product_matches_vehicle(
    product: dict[str, Any],
    *,
    vehicle_make: Optional[str],
    vehicle_model: Optional[str],
    vehicle_year: Optional[int],
    vehicle_engine: Optional[str],
) -> bool:
    compatibilities = product.get("compatibilities")
    if not isinstance(compatibilities, list) or len(compatibilities) == 0:
        return False

    for compatibility in compatibilities:
        if not isinstance(compatibility, dict):
            continue

        make = str(compatibility.get("make") or "").strip().lower()
        model = str(compatibility.get("model") or "").strip().lower()
        engine = str(compatibility.get("engine") or "").strip().lower()
        year_from = _to_int(compatibility.get("year_from"), 0)
        year_to = _to_int(compatibility.get("year_to"), 0)

        if vehicle_make and make != vehicle_make:
            continue
        if vehicle_model and model != vehicle_model:
            continue
        if vehicle_engine and vehicle_engine not in engine:
            continue
        if vehicle_year is not None:
            if year_from > 0 and vehicle_year < year_from:
                continue
            if year_to > 0 and vehicle_year > year_to:
                continue
        return True

    return False


def _apply_snapshot_search(
    products: list[dict[str, Any]], search: str
) -> list[dict[str, Any]]:
    search_text = " ".join(search.strip().lower().split())
    if not search_text:
        return sorted(products, key=lambda product: _to_int(product.get("id"), 0))

    tokens = [token for token in search_text.split(" ") if token]
    scored: list[tuple[tuple[int, int, int], dict[str, Any]]] = []
    for product in products:
        search_blob = " ".join(
            (
                str(product.get("name") or "").lower(),
                str(product.get("sku") or "").lower(),
                str(product.get("oem") or "").lower(),
                str(product.get("brand") or "").lower(),
            )
        )
        token_hits = sum(1 for token in tokens if token in search_blob)
        if token_hits == 0 and search_text not in search_blob:
            continue
        exact_sku = int(str(product.get("sku") or "").lower() == search_text)
        scored.append(((exact_sku, token_hits, _to_int(product.get("id"), 0)), product))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [item[1] for item in scored]


def _apply_snapshot_filters(
    products: list[dict[str, Any]],
    *,
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    brand: Optional[str] = None,
    in_stock_only: bool = False,
    vehicle_make: Optional[str] = None,
    vehicle_model: Optional[str] = None,
    vehicle_year: Optional[int] = None,
    vehicle_engine: Optional[str] = None,
) -> list[dict[str, Any]]:
    filtered = [product for product in products if product.get("is_active", False)]

    if category_id:
        filtered = [
            product for product in filtered if product.get("category_id") == category_id
        ]

    if brand:
        brand_normalized = brand.strip().lower()
        filtered = [
            product
            for product in filtered
            if isinstance(product.get("brand"), str)
            and product.get("brand", "").strip().lower() == brand_normalized
        ]

    if in_stock_only:
        filtered = [
            product
            for product in filtered
            if _to_int(product.get("stock_quantity"), 0) > 0
        ]

    if vehicle_make or vehicle_model or vehicle_year is not None or vehicle_engine:
        vehicle_make_normalized = _normalize_optional_filter(vehicle_make)
        vehicle_model_normalized = _normalize_optional_filter(vehicle_model)
        vehicle_engine_normalized = _normalize_optional_filter(vehicle_engine)
        filtered = [
            product
            for product in filtered
            if _product_matches_vehicle(
                product,
                vehicle_make=vehicle_make_normalized,
                vehicle_model=vehicle_model_normalized,
                vehicle_year=vehicle_year,
                vehicle_engine=vehicle_engine_normalized,
            )
        ]

    if search:
        filtered = _apply_snapshot_search(filtered, search)
    else:
        filtered.sort(key=lambda product: _to_int(product.get("id"), 0))

    return filtered


# ---------- Categories ----------
@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(
    parent_id: Optional[int] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """Get all categories, optionally filtered by parent"""
    cache_key = (parent_id, active_only)
    now = time.time()
    with _categories_cache_lock:
        cached = _categories_cache.get(cache_key)
    if cached is not None:
        checked_at, payload = cached
        if now - checked_at <= PUBLIC_CATEGORIES_CACHE_TTL_SECONDS:
            return payload

    query = select(Category)
    if parent_id is not None:
        query = query.where(Category.parent_id == parent_id)
    if active_only:
        query = query.where(Category.is_active)
    query = query.order_by(Category.sort_order)

    result = await db.execute(query)
    categories = result.scalars().all()
    payload = [
        {
            "id": category.id,
            "name": category.name,
            "slug": category.slug,
            "parent_id": category.parent_id,
            "sort_order": category.sort_order,
            "is_active": category.is_active,
            "created_at": category.created_at,
            "updated_at": category.updated_at,
        }
        for category in categories
    ]
    with _categories_cache_lock:
        _categories_cache[cache_key] = (now, payload)
    return payload


@router.get("/categories/{slug}", response_model=CategoryResponse)
async def get_category_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    """Get category by slug"""
    query = select(Category).where(Category.slug == slug)
    result = await db.execute(query)
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


# ---------- Products ----------
@router.get("/products", response_model=List[ProductResponse])
async def get_products(
    category_id: Optional[int] = None,
    search: Optional[str] = Query(None, min_length=2),
    brand: Optional[str] = None,
    vehicle_make: Optional[str] = Query(None, min_length=1, max_length=100),
    vehicle_model: Optional[str] = Query(None, min_length=1, max_length=100),
    vehicle_year: Optional[int] = Query(None, ge=1950, le=2100),
    vehicle_engine: Optional[str] = Query(None, min_length=1, max_length=100),
    in_stock_only: bool = False,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get products with filters and search"""
    snapshot_products = await _load_latest_products_snapshot(db)
    if snapshot_products is not None:
        if (
            category_id is None
            and not search
            and not brand
            and not in_stock_only
            and not vehicle_make
            and not vehicle_model
            and vehicle_year is None
            and not vehicle_engine
        ):
            with _snapshot_cache_lock:
                default_active_products = _snapshot_cache_default_active_products
            if default_active_products is not None:
                return default_active_products[offset : offset + limit]

        filtered = _apply_snapshot_filters(
            snapshot_products,
            category_id=category_id,
            search=search,
            brand=brand,
            in_stock_only=in_stock_only,
            vehicle_make=vehicle_make,
            vehicle_model=vehicle_model,
            vehicle_year=vehicle_year,
            vehicle_engine=vehicle_engine,
        )
        return filtered[offset : offset + limit]

    query = (
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.compatibilities))
        .where(Product.is_active)
    )

    if category_id:
        query = query.where(Product.category_id == category_id)

    if brand:
        query = query.where(Product.brand == brand)

    if in_stock_only:
        query = query.where(Product.stock_quantity > 0)

    if vehicle_make or vehicle_model or vehicle_year is not None or vehicle_engine:
        compatibility_query = select(ProductCompatibility.id).where(
            ProductCompatibility.product_id == Product.id
        )

        if vehicle_make:
            compatibility_query = compatibility_query.where(
                func.lower(ProductCompatibility.make) == vehicle_make.strip().lower()
            )
        if vehicle_model:
            compatibility_query = compatibility_query.where(
                func.lower(ProductCompatibility.model) == vehicle_model.strip().lower()
            )
        if vehicle_engine:
            compatibility_query = compatibility_query.where(
                func.lower(ProductCompatibility.engine).ilike(
                    f"%{vehicle_engine.strip().lower()}%"
                )
            )
        if vehicle_year is not None:
            compatibility_query = compatibility_query.where(
                and_(
                    or_(
                        ProductCompatibility.year_from.is_(None),
                        ProductCompatibility.year_from <= vehicle_year,
                    ),
                    or_(
                        ProductCompatibility.year_to.is_(None),
                        ProductCompatibility.year_to >= vehicle_year,
                    ),
                )
            )

        query = query.where(compatibility_query.exists())

    if search:
        search_text = " ".join(search.strip().split())
        search_pattern = f"%{search}%"
        search_vector = func.to_tsvector(
            "russian",
            func.concat_ws(
                " ",
                Product.name,
                func.coalesce(Product.sku, ""),
                func.coalesce(Product.oem, ""),
                func.coalesce(Product.brand, ""),
            ),
        )
        ts_query = func.plainto_tsquery("russian", search_text)

        query = query.where(
            search_vector.op("@@")(ts_query)
            | Product.name.ilike(search_pattern)
            | Product.sku.ilike(search_pattern)
            | Product.oem.ilike(search_pattern)
        )
        query = query.order_by(
            func.ts_rank(search_vector, ts_query).desc(),
            Product.id.desc(),
        )
    else:
        query = query.order_by(Product.id)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    """Get product by ID"""
    snapshot_products = await _load_latest_products_snapshot(db)
    if snapshot_products is not None:
        for product in snapshot_products:
            if product.get("id") == product_id and product.get("is_active", False):
                return product
        raise HTTPException(status_code=404, detail="Product not found")

    query = (
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.compatibilities))
        .where(Product.id == product_id, Product.is_active)
    )
    result = await db.execute(query)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/products/by-sku/{sku}", response_model=ProductResponse)
async def get_product_by_sku(sku: str, db: AsyncSession = Depends(get_db)):
    """Get product by SKU"""
    snapshot_products = await _load_latest_products_snapshot(db)
    if snapshot_products is not None:
        sku_normalized = sku.strip()
        for product in snapshot_products:
            if product.get("sku") == sku_normalized and product.get("is_active", False):
                return product
        raise HTTPException(status_code=404, detail="Product not found")

    query = (
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.compatibilities))
        .where(Product.sku == sku, Product.is_active)
    )
    result = await db.execute(query)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


# ---------- Leads ----------
@router.post("/leads", response_model=LeadResponse, status_code=201)
async def create_lead(
    lead: LeadCreate, request: Request, db: AsyncSession = Depends(get_db)
):
    """Create a new lead (parts request, VIN request, callback, etc.)"""
    await _enforce_form_rate_limit(request, "leads")

    if not lead.consent_given:
        raise HTTPException(status_code=400, detail="Consent is required")

    lead_data = lead.model_dump()
    lead_data["consent_version"] = lead.consent_version or "v1.0"
    lead_data["consent_text"] = (
        lead.consent_text
        or "Согласие на обработку персональных данных в соответствии с политикой конфиденциальности"
    )
    lead_data["consent_at"] = _utcnow()

    db_lead = Lead(
        **lead_data,
        uuid=str(uuid.uuid4()),
        status="new",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(db_lead)
    await db.commit()
    await db.refresh(db_lead)

    notification_flags = await _get_notification_flags(db)
    _notify_with_flags(
        "lead.created",
        {
            "id": db_lead.id,
            "uuid": db_lead.uuid,
            "type": db_lead.type,
            "status": db_lead.status,
            "phone": db_lead.phone,
            "created_at": (
                db_lead.created_at.isoformat() if db_lead.created_at else None
            ),
        },
        notification_flags,
    )
    return db_lead


# ---------- Orders ----------
@router.post(
    "/orders/requisites-upload",
    response_model=OrderRequisitesUploadResponse,
    status_code=201,
)
async def upload_order_requisites_file(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    await _enforce_form_rate_limit(request, "order_requisites_upload")

    original_filename = _normalize_client_filename(getattr(file, "filename", None))
    extension = Path(original_filename).suffix.lower()
    if extension not in ORDER_REQUISITES_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Допустимы только PDF, PNG или JPG")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Файл пуст")
    if len(content) > ORDER_REQUISITES_MAX_BYTES:
        raise HTTPException(
            status_code=400, detail="Размер файла не должен превышать 10 МБ"
        )

    content_type = (getattr(file, "content_type", "") or "").strip().lower()
    allowed_content_types = ORDER_REQUISITES_ALLOWED_EXTENSIONS[extension]
    if content_type and content_type not in allowed_content_types:
        raise HTTPException(status_code=400, detail="Недопустимый тип файла")

    _validate_order_requisites_signature(extension, content)

    stored_filename = f"{uuid.uuid4().hex}{extension}"
    stored_path = ORDER_REQUISITES_UPLOAD_DIR / stored_filename
    stored_path.write_bytes(content)
    file_url = f"/uploads/order-requisites/{stored_filename}"

    audit = AuditLog(
        action="upload_public_order_requisites",
        entity_type="order_requisites_file",
        new_values={
            "filename": original_filename,
            "stored_filename": stored_filename,
            "url": file_url,
            "size_bytes": len(content),
        },
        ip_address=_extract_client_ip(request),
    )
    db.add(audit)
    await db.commit()

    return OrderRequisitesUploadResponse(
        url=file_url,
        filename=original_filename,
        size_bytes=len(content),
        content_type=content_type or next(iter(allowed_content_types)),
    )


def _validate_order_payload(order_data: OrderCreate) -> None:
    if not order_data.consent_given:
        raise HTTPException(status_code=400, detail="Consent is required")

    if order_data.source == "checkout" and len(order_data.items) == 0:
        raise HTTPException(
            status_code=400, detail="Checkout order must contain at least one item"
        )

    if order_data.payment_method == "invoice" and not order_data.legal_entity_inn:
        raise HTTPException(
            status_code=400, detail="Legal entity INN is required for invoice payment"
        )

    if bool(order_data.invoice_requisites_file_url) != bool(
        order_data.invoice_requisites_file_name
    ):
        raise HTTPException(
            status_code=400, detail="Invoice requisites file metadata is incomplete"
        )


def _prepare_order_payload(
    order_data: OrderCreate,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    order_payload = order_data.model_dump()
    items_payload = order_payload.pop("items", [])
    order_payload["consent_version"] = order_data.consent_version or "v1.0"
    order_payload["consent_text"] = (
        order_data.consent_text
        or "Согласие на обработку персональных данных в соответствии с политикой конфиденциальности"
    )
    order_payload["consent_at"] = _utcnow()

    if order_data.payment_method != "invoice":
        order_payload["invoice_requisites_file_url"] = None
        order_payload["invoice_requisites_file_name"] = None
    elif order_data.invoice_requisites_file_url:
        file_path = _resolve_invoice_requisites_path(
            order_data.invoice_requisites_file_url
        )
        if not file_path.is_file():
            raise HTTPException(
                status_code=400, detail="Файл реквизитов не найден или недоступен"
            )

    return order_payload, items_payload


async def _resolve_order_item_product_id(
    raw_item: dict[str, Any], db: AsyncSession
) -> Optional[int]:
    product_id_raw = raw_item.get("product_id")
    if product_id_raw is None:
        return None

    try:
        candidate_id = int(product_id_raw)
    except (TypeError, ValueError):
        return None

    exists_result = await db.execute(
        select(Product.id).where(Product.id == candidate_id)
    )
    return candidate_id if exists_result.scalar_one_or_none() is not None else None


def _build_order_item(
    order_id: int, raw_item: dict[str, Any], product_id: Optional[int]
) -> OrderItem:
    quantity = max(int(raw_item.get("quantity") or 1), 1)
    unit_price = _to_float(raw_item.get("unit_price"))
    line_total = _to_float(raw_item.get("line_total"))
    if line_total is None and unit_price is not None:
        line_total = round(unit_price * quantity, 2)

    return OrderItem(
        order_id=order_id,
        product_id=product_id,
        product_sku=raw_item.get("product_sku"),
        product_name=raw_item.get("product_name"),
        quantity=quantity,
        unit_price=unit_price,
        line_total=line_total,
    )


@router.post("/orders", response_model=OrderResponse, status_code=201)
async def create_order(
    order_data: OrderCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create a new order (guest checkout or one-click order)."""
    await _enforce_form_rate_limit(request, "orders")
    _validate_order_payload(order_data)
    order_payload, items_payload = _prepare_order_payload(order_data)

    db_order = Order(
        **order_payload,
        uuid=str(uuid.uuid4()),
        status="new",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(db_order)
    await db.flush()

    for raw_item in items_payload:
        product_id = await _resolve_order_item_product_id(raw_item, db)
        db.add(_build_order_item(db_order.id, raw_item, product_id))

    audit = AuditLog(
        action="create_public_order",
        entity_type="order",
        entity_id=db_order.id,
        new_values={
            "source": db_order.source,
            "status": db_order.status,
            "customer_phone": db_order.customer_phone,
            "delivery_method": db_order.delivery_method,
            "payment_method": db_order.payment_method,
            "invoice_requisites_file_url": db_order.invoice_requisites_file_url,
            "invoice_requisites_file_name": db_order.invoice_requisites_file_name,
            "items_count": len(items_payload),
            "consent_given": db_order.consent_given,
            "consent_version": db_order.consent_version,
            "consent_text": db_order.consent_text,
            "consent_at": (
                db_order.consent_at.isoformat() if db_order.consent_at else None
            ),
        },
        ip_address=db_order.ip_address,
    )
    db.add(audit)
    await db.commit()

    order_result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == db_order.id)
    )
    created_order = order_result.scalar_one()

    notification_flags = await _get_notification_flags(db)
    _notify_with_flags(
        "order.created",
        {
            "id": created_order.id,
            "uuid": created_order.uuid,
            "source": created_order.source,
            "status": created_order.status,
            "customer_phone": created_order.customer_phone,
            "items_count": len(created_order.items),
            "created_at": (
                created_order.created_at.isoformat()
                if created_order.created_at
                else None
            ),
        },
        notification_flags,
    )
    return created_order


@router.get("/orders/history", response_model=List[OrderPublicResponse])
async def get_order_history(
    phone: str = Query(..., min_length=10, max_length=25),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get order history and statuses by phone number."""
    try:
        normalized_phone = normalize_phone(phone)
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail="Phone must be a valid RU number"
        ) from exc

    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.customer_phone == normalized_phone)
        .order_by(Order.id.desc())
        .limit(limit)
    )
    return result.scalars().all()


# ---------- Service Requests ----------
@router.get("/service-catalog", response_model=List[ServiceCatalogItemResponse])
async def get_service_catalog(
    vehicle_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Get active service catalog items."""
    normalized_vehicle_type: Optional[str] = None
    if vehicle_type is not None:
        normalized_vehicle_type = vehicle_type.strip().lower()
        if normalized_vehicle_type not in {"passenger", "truck"}:
            raise HTTPException(
                status_code=400, detail="vehicle_type must be 'passenger' or 'truck'"
            )

    query = select(ServiceCatalogItem).where(ServiceCatalogItem.is_active.is_(True))
    if normalized_vehicle_type is not None:
        query = query.where(
            or_(
                ServiceCatalogItem.vehicle_type == normalized_vehicle_type,
                ServiceCatalogItem.vehicle_type == "both",
            )
        )
    query = query.order_by(
        ServiceCatalogItem.sort_order.asc(), ServiceCatalogItem.id.asc()
    )

    result = await db.execute(query)
    items = result.scalars().all()
    prepayment_enabled = await _is_service_prepayment_enabled(db)
    if prepayment_enabled:
        return items

    required_fields = {
        "id",
        "name",
        "vehicle_type",
        "duration_minutes",
        "price",
        "sort_order",
        "is_active",
        "created_at",
        "updated_at",
    }
    if not all(all(hasattr(item, field) for field in required_fields) for item in items):
        return items

    return [
        {
            "id": item.id,
            "name": item.name,
            "vehicle_type": item.vehicle_type,
            "duration_minutes": item.duration_minutes,
            "price": item.price,
            "prepayment_required": False,
            "prepayment_amount": None,
            "sort_order": item.sort_order,
            "is_active": item.is_active,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
        }
        for item in items
    ]


@router.post(
    "/service-requests", response_model=ServiceRequestResponse, status_code=201
)
async def create_service_request(
    request_data: ServiceRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create a new service request (repair appointment)"""
    await _enforce_form_rate_limit(request, "service_requests")

    if not request_data.consent_given:
        raise HTTPException(status_code=400, detail="Consent is required")

    service_request_data = request_data.model_dump()
    if service_request_data.get("requested_product_sku") or service_request_data.get(
        "requested_product_name"
    ):
        service_request_data["install_with_part"] = True
    service_request_data["consent_version"] = request_data.consent_version or "v1.0"
    service_request_data["consent_text"] = (
        request_data.consent_text
        or "Согласие на обработку персональных данных в соответствии с политикой конфиденциальности"
    )
    service_request_data["consent_at"] = _utcnow()

    payment_settings = await _get_service_payment_settings(db)
    payment_required = False
    payment_amount: Optional[float] = None
    if payment_settings["prepayment_enabled"] and payment_settings["payment_flow_enabled"]:
        matched_item = await _resolve_service_catalog_item_for_request(
            db,
            service_type=request_data.service_type,
            vehicle_type=request_data.vehicle_type,
        )
        if (
            matched_item is not None
            and bool(getattr(matched_item, "prepayment_required", False))
            and isinstance(getattr(matched_item, "prepayment_amount", None), (float, int))
            and float(matched_item.prepayment_amount) > 0
        ):
            payment_required = True
            payment_amount = float(matched_item.prepayment_amount)

    service_request_data["payment_required"] = payment_required
    service_request_data["payment_status"] = "pending" if payment_required else "not_required"
    service_request_data["payment_amount"] = payment_amount
    service_request_data["payment_currency"] = payment_settings["default_currency"]
    service_request_data["payment_provider"] = payment_settings["provider_name"] or None
    service_request_data["payment_error"] = None
    service_request_data["payment_updated_at"] = _utcnow() if payment_required else None
    if not payment_required:
        service_request_data["payment_reference"] = None

    db_request = ServiceRequest(
        **service_request_data,
        uuid=str(uuid.uuid4()),
        status="new",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(db_request)
    await db.commit()
    await db.refresh(db_request)

    audit = AuditLog(
        action="create_public_service_request",
        entity_type="service_request",
        entity_id=db_request.id,
        new_values={
            "consent_given": db_request.consent_given,
            "consent_version": db_request.consent_version,
            "consent_text": db_request.consent_text,
            "consent_at": (
                db_request.consent_at.isoformat() if db_request.consent_at else None
            ),
            "phone": db_request.phone,
            "status": db_request.status,
            "install_with_part": db_request.install_with_part,
            "requested_product_sku": db_request.requested_product_sku,
            "requested_product_name": db_request.requested_product_name,
            "payment_required": db_request.payment_required,
            "payment_status": db_request.payment_status,
            "payment_amount": db_request.payment_amount,
            "payment_currency": db_request.payment_currency,
            "payment_provider": db_request.payment_provider,
            "payment_reference": db_request.payment_reference,
        },
        ip_address=db_request.ip_address,
    )
    db.add(audit)
    await db.commit()

    notification_flags = await _get_notification_flags(db)
    _notify_with_flags(
        "service_request.created",
        {
            "id": db_request.id,
            "uuid": db_request.uuid,
            "status": db_request.status,
            "vehicle_type": db_request.vehicle_type,
            "service_type": db_request.service_type,
            "phone": db_request.phone,
            "install_with_part": db_request.install_with_part,
            "requested_product_sku": db_request.requested_product_sku,
            "requested_product_name": db_request.requested_product_name,
            "estimated_bundle_total": db_request.estimated_bundle_total,
            "payment_required": db_request.payment_required,
            "payment_status": db_request.payment_status,
            "payment_amount": db_request.payment_amount,
            "payment_currency": db_request.payment_currency,
            "payment_provider": db_request.payment_provider,
            "payment_reference": db_request.payment_reference,
            "created_at": (
                db_request.created_at.isoformat() if db_request.created_at else None
            ),
        },
        notification_flags,
    )

    return db_request


def _resolve_payment_webhook_status(payload: PaymentWebhookPayload) -> str:
    if payload.status:
        return payload.status.strip().lower()
    event = (payload.event or "").strip().lower()
    if event.endswith("succeeded") or event.endswith("paid"):
        return "paid"
    if event.endswith("failed"):
        return "failed"
    if event.endswith("refunded"):
        return "refunded"
    return "pending"


@router.post("/payments/webhook", response_model=dict)
async def apply_payment_webhook(
    payload: PaymentWebhookPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    payment_settings = await _get_service_payment_settings(db)
    if not payment_settings["payment_flow_enabled"]:
        raise HTTPException(status_code=409, detail="Payment flow is disabled.")

    webhook_token = (os.getenv("PAYMENTS_WEBHOOK_TOKEN") or "").strip()
    if webhook_token:
        provided_token = _extract_payments_webhook_token(request)
        if not provided_token or not secrets.compare_digest(provided_token, webhook_token):
            raise HTTPException(status_code=403, detail="Invalid payments webhook token")

    resolved_status = _resolve_payment_webhook_status(payload)

    if payload.entity_type == "service_request":
        result = await db.execute(
            select(ServiceRequest).where(ServiceRequest.id == payload.entity_id)
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            raise HTTPException(status_code=404, detail="Service request not found")
    elif payload.entity_type == "order":
        result = await db.execute(select(Order).where(Order.id == payload.entity_id))
        entity = result.scalar_one_or_none()
        if entity is None:
            raise HTTPException(status_code=404, detail="Order not found")
    else:
        raise HTTPException(status_code=400, detail="Unsupported entity_type")

    current_status = (getattr(entity, "payment_status", "") or "not_required").strip().lower()
    if not _is_payment_transition_allowed(current_status, resolved_status):
        raise HTTPException(
            status_code=409,
            detail=f"Invalid payment status transition: {current_status} -> {resolved_status}",
        )

    now = _utcnow()
    old_values = {
        "payment_status": current_status,
        "payment_reference": getattr(entity, "payment_reference", None),
        "payment_amount": getattr(entity, "payment_amount", None),
        "payment_currency": getattr(entity, "payment_currency", None),
        "payment_provider": getattr(entity, "payment_provider", None),
    }

    entity.payment_required = resolved_status != "not_required" or bool(
        getattr(entity, "payment_required", False)
    )
    entity.payment_status = resolved_status
    if payload.amount is not None:
        entity.payment_amount = float(payload.amount)
    entity.payment_currency = _normalize_payment_currency(
        payload.currency,
        default=(getattr(entity, "payment_currency", None) or "RUB"),
    )
    if payload.provider:
        entity.payment_provider = payload.provider
    elif not getattr(entity, "payment_provider", None):
        entity.payment_provider = payment_settings["provider_name"] or None
    if payload.payment_reference:
        entity.payment_reference = payload.payment_reference
    if resolved_status == "failed":
        entity.payment_error = payload.error or "Payment failed"
    else:
        entity.payment_error = None
    entity.payment_updated_at = now
    entity.updated_at = now

    await db.commit()
    await db.refresh(entity)

    audit = AuditLog(
        action="apply_payment_webhook",
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        old_values=old_values,
        new_values={
            "payment_status": entity.payment_status,
            "payment_reference": entity.payment_reference,
            "payment_amount": entity.payment_amount,
            "payment_currency": entity.payment_currency,
            "payment_provider": entity.payment_provider,
            "payment_error": entity.payment_error,
            "event": payload.event,
        },
        ip_address=_extract_client_ip(request),
    )
    db.add(audit)
    await db.commit()

    notification_flags = await _get_notification_flags(db)
    _notify_with_flags(
        "payment.status_changed",
        {
            "entity_type": payload.entity_type,
            "entity_id": payload.entity_id,
            "payment_status": entity.payment_status,
            "payment_reference": entity.payment_reference,
            "payment_amount": entity.payment_amount,
            "payment_currency": entity.payment_currency,
            "payment_provider": entity.payment_provider,
            "event": payload.event,
            "updated_at": (
                entity.payment_updated_at.isoformat()
                if entity.payment_updated_at
                else None
            ),
        },
        notification_flags,
    )

    return {
        "status": "ok",
        "entity_type": payload.entity_type,
        "entity_id": payload.entity_id,
        "payment_status": entity.payment_status,
        "payment_reference": entity.payment_reference,
        "payment_updated_at": (
            entity.payment_updated_at.isoformat() if entity.payment_updated_at else None
        ),
    }


# ---------- VIN Requests ----------
@router.post("/vin-requests", response_model=VinRequestResponse, status_code=201)
async def create_vin_request(
    request_data: VinRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create a new VIN request"""
    await _enforce_form_rate_limit(request, "vin_requests")

    if not request_data.consent_given:
        raise HTTPException(status_code=400, detail="Consent is required")

    vin_request_data = request_data.model_dump()
    vin_request_data["consent_version"] = request_data.consent_version or "v1.0"
    vin_request_data["consent_text"] = (
        request_data.consent_text
        or "Согласие на обработку персональных данных в соответствии с политикой конфиденциальности"
    )
    vin_request_data["consent_at"] = _utcnow()

    db_request = VinRequest(
        **vin_request_data,
        uuid=str(uuid.uuid4()),
        status="new",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(db_request)
    await db.commit()
    await db.refresh(db_request)

    audit = AuditLog(
        action="create_public_vin_request",
        entity_type="vin_request",
        entity_id=db_request.id,
        new_values={
            "vin": db_request.vin,
            "phone": db_request.phone,
            "status": db_request.status,
            "consent_given": db_request.consent_given,
            "consent_version": db_request.consent_version,
            "consent_text": db_request.consent_text,
            "consent_at": (
                db_request.consent_at.isoformat() if db_request.consent_at else None
            ),
        },
        ip_address=db_request.ip_address,
    )
    db.add(audit)
    await db.commit()

    notification_flags = await _get_notification_flags(db)
    _notify_with_flags(
        "vin_request.created",
        {
            "id": db_request.id,
            "uuid": db_request.uuid,
            "status": db_request.status,
            "vin": db_request.vin,
            "phone": db_request.phone,
            "created_at": (
                db_request.created_at.isoformat() if db_request.created_at else None
            ),
        },
        notification_flags,
    )

    return db_request


# ---------- Public Content ----------
@router.get("/content", response_model=List[dict])
async def get_public_content(db: AsyncSession = Depends(get_db)):
    """Get all public content (for frontend)"""
    global _public_content_cache_checked_at
    global _public_content_cache_items

    now = time.time()
    with _public_content_cache_lock:
        if (
            _public_content_cache_items is not None
            and now - _public_content_cache_checked_at <= PUBLIC_CONTENT_CACHE_TTL_SECONDS
        ):
            return _public_content_cache_items

    query = select(SiteContent).order_by(SiteContent.key)
    result = await db.execute(query)
    content = result.scalars().all()
    payload = [{"key": c.key, "value": c.value} for c in content]
    with _public_content_cache_lock:
        _public_content_cache_checked_at = now
        _public_content_cache_items = payload
    return payload
