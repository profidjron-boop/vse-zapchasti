from collections import defaultdict, deque
from datetime import UTC, datetime
import os
from threading import Lock
import time
from fastapi import APIRouter, Depends, HTTPException, Query, Request
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
    CategoryResponse, ProductResponse, LeadCreate, LeadResponse,
    OrderCreate,
    OrderPublicResponse,
    OrderResponse,
    ServiceCatalogItemResponse,
    ServiceRequestCreate,
    ServiceRequestResponse,
    VinRequestCreate,
    VinRequestResponse,
    normalize_phone,
)

router = APIRouter(prefix="/api/public", tags=["public"])


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


FORM_RATE_LIMIT_WINDOW_SECONDS = _env_positive_int("PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS", 60)
DEFAULT_FORM_RATE_LIMIT_PER_MINUTE = _env_positive_int("PUBLIC_FORMS_RATE_LIMIT_PER_MINUTE", 20)
FORM_RATE_LIMITS_PER_SCOPE = {
    "leads": _env_positive_int("PUBLIC_LEADS_RATE_LIMIT_PER_MINUTE", DEFAULT_FORM_RATE_LIMIT_PER_MINUTE),
    "orders": _env_positive_int("PUBLIC_ORDERS_RATE_LIMIT_PER_MINUTE", DEFAULT_FORM_RATE_LIMIT_PER_MINUTE),
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
REDIS_RATE_LIMIT_URL = (os.getenv("RATE_LIMIT_REDIS_URL") or os.getenv("REDIS_URL") or "").strip()
PUBLIC_PRODUCTS_READ_MODE = os.getenv("PUBLIC_PRODUCTS_READ_MODE", "snapshot").strip().lower()


async def _get_redis_rate_limit_client() -> Redis | None:
    global _redis_rate_limit_client
    if not REDIS_RATE_LIMIT_URL:
        return None
    if _redis_rate_limit_client is None:
        _redis_rate_limit_client = Redis.from_url(REDIS_RATE_LIMIT_URL, decode_responses=True)
    return _redis_rate_limit_client


def _extract_client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def _enforce_form_rate_limit(request: Request, scope: str) -> None:
    ip_address = _extract_client_ip(request)
    limit_per_minute = FORM_RATE_LIMITS_PER_SCOPE.get(scope, DEFAULT_FORM_RATE_LIMIT_PER_MINUTE)

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
        except Exception:
            # Fallback for local/dev when Redis is temporarily unavailable.
            pass

    ip_address = request.client.host if request.client else "unknown"
    bucket_key = f"{scope}:{ip_address}"
    now = time.time()
    limit_per_minute = FORM_RATE_LIMITS_PER_SCOPE.get(scope, DEFAULT_FORM_RATE_LIMIT_PER_MINUTE)

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


def _normalize_snapshot_compatibilities(raw_compatibilities: Any) -> list[dict[str, Any]]:
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

    normalized = {
        "id": _to_int(product_id, 0),
        "category_id": _to_int(category_id, 0),
        "sku": sku.strip(),
        "oem": raw_product.get("oem") if isinstance(raw_product.get("oem"), str) else None,
        "brand": raw_product.get("brand") if isinstance(raw_product.get("brand"), str) else None,
        "name": name.strip(),
        "description": raw_product.get("description") if isinstance(raw_product.get("description"), str) else None,
        "price": _to_float(raw_product.get("price")),
        "stock_quantity": _to_int(raw_product.get("stock_quantity"), 0),
        "is_active": bool(raw_product.get("is_active", True)),
        "attributes": raw_product.get("attributes") if isinstance(raw_product.get("attributes"), dict) else {},
        "images": _normalize_snapshot_images(raw_product.get("images")),
        "compatibilities": _normalize_snapshot_compatibilities(raw_product.get("compatibilities")),
    }

    if normalized["id"] <= 0 or normalized["category_id"] <= 0:
        return None

    return normalized


async def _load_latest_products_snapshot(db: AsyncSession) -> Optional[list[dict[str, Any]]]:
    if PUBLIC_PRODUCTS_READ_MODE != "snapshot":
        return None

    run_result = await db.execute(
        select(ImportRun)
        .where(ImportRun.entity_type == "products", ImportRun.status == "finished")
        .order_by(ImportRun.id.desc())
        .limit(1)
    )
    run = run_result.scalar_one_or_none()
    if not run or not isinstance(run.snapshot_data, list):
        return None

    products: list[dict[str, Any]] = []
    for raw_product in run.snapshot_data:
        normalized = _normalize_snapshot_product(raw_product)
        if normalized is not None:
            products.append(normalized)

    return products


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
        filtered = [product for product in filtered if product.get("category_id") == category_id]

    if brand:
        brand_normalized = brand.strip().lower()
        filtered = [
            product
            for product in filtered
            if isinstance(product.get("brand"), str) and product.get("brand", "").strip().lower() == brand_normalized
        ]

    if in_stock_only:
        filtered = [product for product in filtered if _to_int(product.get("stock_quantity"), 0) > 0]

    if vehicle_make or vehicle_model or vehicle_year is not None or vehicle_engine:
        vehicle_make_normalized = vehicle_make.strip().lower() if vehicle_make else None
        vehicle_model_normalized = vehicle_model.strip().lower() if vehicle_model else None
        vehicle_engine_normalized = vehicle_engine.strip().lower() if vehicle_engine else None

        def _matches_vehicle(product: dict[str, Any]) -> bool:
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

                if vehicle_make_normalized and make != vehicle_make_normalized:
                    continue
                if vehicle_model_normalized and model != vehicle_model_normalized:
                    continue
                if vehicle_engine_normalized and vehicle_engine_normalized not in engine:
                    continue
                if vehicle_year is not None:
                    if year_from > 0 and vehicle_year < year_from:
                        continue
                    if year_to > 0 and vehicle_year > year_to:
                        continue

                return True

            return False

        filtered = [product for product in filtered if _matches_vehicle(product)]

    if search:
        search_text = " ".join(search.strip().lower().split())
        if search_text:
            tokens = [token for token in search_text.split(" ") if token]
            scored: list[tuple[tuple[int, int, int], dict[str, Any]]] = []
            for product in filtered:
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
            filtered = [item[1] for item in scored]
        else:
            filtered.sort(key=lambda product: _to_int(product.get("id"), 0))
    else:
        filtered.sort(key=lambda product: _to_int(product.get("id"), 0))

    return filtered

# ---------- Categories ----------
@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(
    parent_id: Optional[int] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Get all categories, optionally filtered by parent"""
    query = select(Category)
    if parent_id is not None:
        query = query.where(Category.parent_id == parent_id)
    if active_only:
        query = query.where(Category.is_active)
    query = query.order_by(Category.sort_order)
    
    result = await db.execute(query)
    return result.scalars().all()

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
    db: AsyncSession = Depends(get_db)
):
    """Get products with filters and search"""
    snapshot_products = await _load_latest_products_snapshot(db)
    if snapshot_products is not None:
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
        compatibility_query = select(ProductCompatibility.id).where(ProductCompatibility.product_id == Product.id)

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
                func.lower(ProductCompatibility.engine).ilike(f"%{vehicle_engine.strip().lower()}%")
            )
        if vehicle_year is not None:
            compatibility_query = compatibility_query.where(
                and_(
                    or_(ProductCompatibility.year_from.is_(None), ProductCompatibility.year_from <= vehicle_year),
                    or_(ProductCompatibility.year_to.is_(None), ProductCompatibility.year_to >= vehicle_year),
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
    lead: LeadCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
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

    notify_event(
        "lead.created",
        {
            "id": db_lead.id,
            "uuid": db_lead.uuid,
            "type": db_lead.type,
            "status": db_lead.status,
            "phone": db_lead.phone,
            "created_at": db_lead.created_at.isoformat() if db_lead.created_at else None,
        },
    )
    return db_lead


# ---------- Orders ----------
@router.post("/orders", response_model=OrderResponse, status_code=201)
async def create_order(
    order_data: OrderCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create a new order (guest checkout or one-click order)."""
    await _enforce_form_rate_limit(request, "orders")

    if not order_data.consent_given:
        raise HTTPException(status_code=400, detail="Consent is required")

    if order_data.source == "checkout" and len(order_data.items) == 0:
        raise HTTPException(status_code=400, detail="Checkout order must contain at least one item")

    if order_data.payment_method == "invoice" and not order_data.legal_entity_inn:
        raise HTTPException(status_code=400, detail="Legal entity INN is required for invoice payment")

    order_payload = order_data.model_dump()
    items_payload = order_payload.pop("items", [])
    order_payload["consent_version"] = order_data.consent_version or "v1.0"
    order_payload["consent_text"] = (
        order_data.consent_text
        or "Согласие на обработку персональных данных в соответствии с политикой конфиденциальности"
    )
    order_payload["consent_at"] = _utcnow()

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
        product_id_raw = raw_item.get("product_id")
        product_id: Optional[int] = None
        if product_id_raw is not None:
            try:
                candidate_id = int(product_id_raw)
                exists_result = await db.execute(select(Product.id).where(Product.id == candidate_id))
                if exists_result.scalar_one_or_none() is not None:
                    product_id = candidate_id
            except (TypeError, ValueError):
                product_id = None

        quantity = max(int(raw_item.get("quantity") or 1), 1)
        unit_price = _to_float(raw_item.get("unit_price"))
        line_total = _to_float(raw_item.get("line_total"))
        if line_total is None and unit_price is not None:
            line_total = round(unit_price * quantity, 2)

        order_item = OrderItem(
            order_id=db_order.id,
            product_id=product_id,
            product_sku=raw_item.get("product_sku"),
            product_name=raw_item.get("product_name"),
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
        )
        db.add(order_item)

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
            "items_count": len(items_payload),
            "consent_given": db_order.consent_given,
            "consent_version": db_order.consent_version,
            "consent_text": db_order.consent_text,
            "consent_at": db_order.consent_at.isoformat() if db_order.consent_at else None,
        },
        ip_address=db_order.ip_address,
    )
    db.add(audit)
    await db.commit()

    order_result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == db_order.id)
    )
    created_order = order_result.scalar_one()

    notify_event(
        "order.created",
        {
            "id": created_order.id,
            "uuid": created_order.uuid,
            "source": created_order.source,
            "status": created_order.status,
            "customer_phone": created_order.customer_phone,
            "items_count": len(created_order.items),
            "created_at": created_order.created_at.isoformat() if created_order.created_at else None,
        },
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
        raise HTTPException(status_code=400, detail="Phone must be a valid RU number") from exc

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
            raise HTTPException(status_code=400, detail="vehicle_type must be 'passenger' or 'truck'")

    query = select(ServiceCatalogItem).where(ServiceCatalogItem.is_active.is_(True))
    if normalized_vehicle_type is not None:
        query = query.where(
            or_(
                ServiceCatalogItem.vehicle_type == normalized_vehicle_type,
                ServiceCatalogItem.vehicle_type == "both",
            )
        )
    query = query.order_by(ServiceCatalogItem.sort_order.asc(), ServiceCatalogItem.id.asc())

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/service-requests", response_model=ServiceRequestResponse, status_code=201)
async def create_service_request(
    request_data: ServiceRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Create a new service request (repair appointment)"""
    await _enforce_form_rate_limit(request, "service_requests")

    if not request_data.consent_given:
        raise HTTPException(status_code=400, detail="Consent is required")

    service_request_data = request_data.model_dump()
    service_request_data["consent_version"] = request_data.consent_version or "v1.0"
    service_request_data["consent_text"] = (
        request_data.consent_text
        or "Согласие на обработку персональных данных в соответствии с политикой конфиденциальности"
    )
    service_request_data["consent_at"] = _utcnow()

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
            "consent_at": db_request.consent_at.isoformat() if db_request.consent_at else None,
            "phone": db_request.phone,
            "status": db_request.status,
        },
        ip_address=db_request.ip_address,
    )
    db.add(audit)
    await db.commit()

    notify_event(
        "service_request.created",
        {
            "id": db_request.id,
            "uuid": db_request.uuid,
            "status": db_request.status,
            "vehicle_type": db_request.vehicle_type,
            "service_type": db_request.service_type,
            "phone": db_request.phone,
            "created_at": db_request.created_at.isoformat() if db_request.created_at else None,
        },
    )

    return db_request

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
            "consent_at": db_request.consent_at.isoformat() if db_request.consent_at else None,
        },
        ip_address=db_request.ip_address,
    )
    db.add(audit)
    await db.commit()

    notify_event(
        "vin_request.created",
        {
            "id": db_request.id,
            "uuid": db_request.uuid,
            "status": db_request.status,
            "vin": db_request.vin,
            "phone": db_request.phone,
            "created_at": db_request.created_at.isoformat() if db_request.created_at else None,
        },
    )

    return db_request

# ---------- Public Content ----------
@router.get("/content", response_model=List[dict])
async def get_public_content(db: AsyncSession = Depends(get_db)):
    """Get all public content (for frontend)"""
    query = select(SiteContent).order_by(SiteContent.key)
    result = await db.execute(query)
    content = result.scalars().all()
    return [{"key": c.key, "value": c.value} for c in content]
