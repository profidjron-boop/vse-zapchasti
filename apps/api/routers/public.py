from collections import defaultdict, deque
from datetime import datetime
import os
from threading import Lock
import time
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from typing import List, Optional
import uuid

from database import get_db
from models import AuditLog, Category, Product, Lead, ServiceRequest, SiteContent, VinRequest
from schemas import (
    CategoryResponse, ProductResponse, LeadCreate, LeadResponse,
    ServiceRequestCreate, ServiceRequestResponse, VinRequestCreate, VinRequestResponse
)

router = APIRouter(prefix="/api/public", tags=["public"])
FORM_RATE_LIMIT_PER_MINUTE = int(os.getenv("PUBLIC_FORMS_RATE_LIMIT_PER_MINUTE", "20"))
FORM_RATE_LIMIT_WINDOW_SECONDS = 60
_rate_limit_buckets: dict[str, deque[float]] = defaultdict(deque)
_rate_limit_lock = Lock()


def _enforce_form_rate_limit(request: Request, scope: str) -> None:
    ip_address = request.client.host if request.client else "unknown"
    bucket_key = f"{scope}:{ip_address}"
    now = time.time()

    with _rate_limit_lock:
        bucket = _rate_limit_buckets[bucket_key]
        while bucket and now - bucket[0] > FORM_RATE_LIMIT_WINDOW_SECONDS:
            bucket.popleft()

        if len(bucket) >= FORM_RATE_LIMIT_PER_MINUTE:
            raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")

        bucket.append(now)

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
    query = select(Product).where(Product.id == product_id, Product.is_active)
    result = await db.execute(query)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.get("/products/by-sku/{sku}", response_model=ProductResponse)
async def get_product_by_sku(sku: str, db: AsyncSession = Depends(get_db)):
    """Get product by SKU"""
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
    lead_data["consent_at"] = datetime.utcnow()

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
    service_request_data["consent_at"] = datetime.utcnow()

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
    vin_request_data["consent_at"] = datetime.utcnow()

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
