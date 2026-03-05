from collections import defaultdict, deque
from datetime import UTC, datetime
import os
from threading import Lock
import time
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from typing import Any, List, Optional
import uuid

from database import get_db
from models import AuditLog, Category, ImportRun, Product, Lead, ServiceRequest, SiteContent, VinRequest
from schemas import (
    CategoryResponse, ProductResponse, LeadCreate, LeadResponse,
    ServiceRequestCreate, ServiceRequestResponse, VinRequestCreate, VinRequestResponse
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
PUBLIC_PRODUCTS_READ_MODE = os.getenv("PUBLIC_PRODUCTS_READ_MODE", "snapshot").strip().lower()


def _enforce_form_rate_limit(request: Request, scope: str) -> None:
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
        "compatibilities": [],
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
        )
        return filtered[offset : offset + limit]

    query = select(Product).where(Product.is_active)
    
    if category_id:
        query = query.where(Product.category_id == category_id)
    
    if brand:
        query = query.where(Product.brand == brand)
    
    if in_stock_only:
        query = query.where(Product.stock_quantity > 0)
    
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

    query = select(Product).where(Product.id == product_id, Product.is_active)
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

    query = select(Product).where(Product.sku == sku, Product.is_active)
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
    _enforce_form_rate_limit(request, "leads")

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
    return db_lead

# ---------- Service Requests ----------
@router.post("/service-requests", response_model=ServiceRequestResponse, status_code=201)
async def create_service_request(
    request_data: ServiceRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Create a new service request (repair appointment)"""
    _enforce_form_rate_limit(request, "service_requests")

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

    return db_request

# ---------- VIN Requests ----------
@router.post("/vin-requests", response_model=VinRequestResponse, status_code=201)
async def create_vin_request(
    request_data: VinRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create a new VIN request"""
    _enforce_form_rate_limit(request, "vin_requests")

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

    return db_request

# ---------- Public Content ----------
@router.get("/content", response_model=List[dict])
async def get_public_content(db: AsyncSession = Depends(get_db)):
    """Get all public content (for frontend)"""
    query = select(SiteContent).order_by(SiteContent.key)
    result = await db.execute(query)
    content = result.scalars().all()
    return [{"key": c.key, "value": c.value} for c in content]
