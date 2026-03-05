from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import uuid

from database import get_db
from models import Category, Product, Lead, ServiceRequest, SiteContent
from schemas import (
    CategoryResponse, ProductResponse, LeadCreate, LeadResponse,
    ServiceRequestCreate, ServiceRequestResponse
)

router = APIRouter(prefix="/api/public", tags=["public"])

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
        search_pattern = f"%{search}%"
        query = query.where(
            (Product.name.ilike(search_pattern)) |
            (Product.sku.ilike(search_pattern)) |
            (Product.oem.ilike(search_pattern))
        )
    
    query = query.order_by(Product.id).offset(offset).limit(limit)
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
    db_lead = Lead(
        **lead.model_dump(),
        uuid=str(uuid.uuid4()),
        status="new",
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        consent_version="v1.0"
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
    db_request = ServiceRequest(
        **request_data.model_dump(),
        uuid=str(uuid.uuid4()),
        status="new",
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        consent_version="v1.0"
    )
    db.add(db_request)
    await db.commit()
    await db.refresh(db_request)
    return db_request

# ---------- Public Content ----------
@router.get("/content", response_model=List[dict])
async def get_public_content(db: AsyncSession = Depends(get_db)):
    """Get all public content (for frontend)"""
    query = select(SiteContent).order_by(SiteContent.key)
    result = await db.execute(query)
    content = result.scalars().all()
    return [{"key": c.key, "value": c.value} for c in content]
