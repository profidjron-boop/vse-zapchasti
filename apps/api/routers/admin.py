from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from database import get_db
from models import Product, Category, AuditLog
from schemas import CategoryCreate, CategoryUpdate, CategoryResponse
from schemas import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ---------- Products ----------
@router.get("/products", response_model=List[ProductResponse])
async def admin_get_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get all products (admin)"""
    query = select(Product).offset(skip).limit(limit).order_by(Product.id)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/products/{product_id}", response_model=ProductResponse)
async def admin_get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    """Get product by ID (admin)"""
    query = select(Product).where(Product.id == product_id)
    result = await db.execute(query)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.post("/products", response_model=ProductResponse, status_code=201)
async def admin_create_product(
    product: ProductCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create new product"""
    # Check if SKU exists
    existing = await db.execute(select(Product).where(Product.sku == product.sku))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="SKU already exists")
    
    db_product = Product(**product.model_dump())
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    
    # Audit log
    audit = AuditLog(
        action="create",
        entity_type="product",
        entity_id=db_product.id,
        new_values=product.model_dump()
    )
    db.add(audit)
    await db.commit()
    
    return db_product

@router.put("/products/{product_id}", response_model=ProductResponse)
async def admin_update_product(
    product_id: int,
    product_update: ProductUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update product"""
    query = select(Product).where(Product.id == product_id)
    result = await db.execute(query)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Store old values for audit
    old_values = {
        "sku": product.sku,
        "name": product.name,
        "price": product.price,
        "stock_quantity": product.stock_quantity
    }
    
    # Update only provided fields
    update_data = product_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    
    await db.commit()
    await db.refresh(product)
    
    # Audit log
    audit = AuditLog(
        action="update",
        entity_type="product",
        entity_id=product_id,
        old_values=old_values,
        new_values=update_data
    )
    db.add(audit)
    await db.commit()
    
    return product

@router.delete("/products/{product_id}", status_code=204)
async def admin_delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete product"""
    query = select(Product).where(Product.id == product_id)
    result = await db.execute(query)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await db.delete(product)
    await db.commit()
    
    # Audit log
    audit = AuditLog(
        action="delete",
        entity_type="product",
        entity_id=product_id
    )
    db.add(audit)
    await db.commit()
    
    return None

# ---------- Categories ----------
@router.get("/categories")
async def admin_get_categories(db: AsyncSession = Depends(get_db)):
    """Get all categories (admin)"""
    query = select(Category).order_by(Category.sort_order)
    result = await db.execute(query)
    return result.scalars().all()

# ---------- Leads ----------
@router.get("/leads")
async def admin_get_leads(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get all leads"""
    from models import Lead
    query = select(Lead).order_by(Lead.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/service-requests")
async def admin_get_service_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get all service requests"""
    from models import ServiceRequest
    query = select(ServiceRequest).order_by(ServiceRequest.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

# ---------- Categories CRUD ----------
@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def admin_create_category(
    category: CategoryCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create new category"""
    # Check if slug exists
    existing = await db.execute(select(Category).where(Category.slug == category.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Slug already exists")
    
    db_category = Category(**category.model_dump())
    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)
    
    # Audit log
    audit = AuditLog(
        action="create",
        entity_type="category",
        entity_id=db_category.id,
        new_values=category.model_dump()
    )
    db.add(audit)
    await db.commit()
    
    return db_category

@router.get("/categories/{category_id}", response_model=CategoryResponse)
async def admin_get_category(category_id: int, db: AsyncSession = Depends(get_db)):
    """Get category by ID"""
    query = select(Category).where(Category.id == category_id)
    result = await db.execute(query)
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def admin_update_category(
    category_id: int,
    category_update: CategoryUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update category"""
    query = select(Category).where(Category.id == category_id)
    result = await db.execute(query)
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Store old values for audit
    old_values = {
        "name": category.name,
        "slug": category.slug,
        "is_active": category.is_active
    }
    
    # Update only provided fields
    update_data = category_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    
    await db.commit()
    await db.refresh(category)
    
    # Audit log
    audit = AuditLog(
        action="update",
        entity_type="category",
        entity_id=category_id,
        old_values=old_values,
        new_values=update_data
    )
    db.add(audit)
    await db.commit()
    
    return category

@router.delete("/categories/{category_id}", status_code=204)
async def admin_delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete category"""
    query = select(Category).where(Category.id == category_id)
    result = await db.execute(query)
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    await db.delete(category)
    await db.commit()
    
    # Audit log
    audit = AuditLog(
        action="delete",
        entity_type="category",
        entity_id=category_id
    )
    db.add(audit)
    await db.commit()
    
    return None
