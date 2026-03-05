from datetime import datetime, timedelta
from pathlib import Path
import shutil
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AuditLog, Category, Lead, Product, ServiceRequest, SiteContent, User
from schemas import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    SiteContentCreate,
    SiteContentResponse,
    SiteContentUpdate,
    TokenResponse,
    UserResponse,
)

# JWT settings
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/admin/auth/token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    query = select(User).where(User.id == int(user_id))
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_admin_user(current_user: User = Depends(get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])
UPLOAD_DIR = Path("/home/greka/vse-zapchasti/apps/web/public/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ---------- Authentication ----------
@router.post("/auth/token", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """Login and get access token"""
    query = select(User).where(User.email == form_data.username)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/auth/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user info"""
    return current_user

# ---------- Products ----------
@router.get("/products", response_model=List[ProductResponse])
async def admin_get_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get all products (admin only)"""
    query = select(Product).offset(skip).limit(limit).order_by(Product.id)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/products/{product_id}", response_model=ProductResponse)
async def admin_get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
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
@router.get("/categories", response_model=List[CategoryResponse])
async def admin_get_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get all categories (admin)"""
    query = select(Category).order_by(Category.sort_order)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def admin_create_category(
    category: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
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
async def admin_get_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
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

# ---------- Service Requests ----------
@router.get("/service-requests")
async def admin_get_service_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get all service requests"""
    query = select(ServiceRequest).order_by(ServiceRequest.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

# ---------- Site Content ----------
@router.get("/content", response_model=List[SiteContentResponse])
async def admin_get_content(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get all site content blocks"""
    query = select(SiteContent).order_by(SiteContent.key)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/content/{key}", response_model=SiteContentResponse)
async def admin_get_content_by_key(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get site content by key"""
    query = select(SiteContent).where(SiteContent.key == key)
    result = await db.execute(query)
    content = result.scalar_one_or_none()
    
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    return content

@router.post("/content", response_model=SiteContentResponse, status_code=201)
async def admin_create_content(
    content: SiteContentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Create new content block"""
    # Check if key exists
    existing = await db.execute(select(SiteContent).where(SiteContent.key == content.key))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Key already exists")
    
    db_content = SiteContent(**content.model_dump())
    db.add(db_content)
    await db.commit()
    await db.refresh(db_content)
    
    # Audit log
    audit = AuditLog(
        action="create",
        entity_type="content",
        entity_id=db_content.id,
        new_values=content.model_dump()
    )
    db.add(audit)
    await db.commit()
    
    return db_content

@router.put("/content/{key}", response_model=SiteContentResponse)
async def admin_update_content(
    key: str,
    content_update: SiteContentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Update content block"""
    query = select(SiteContent).where(SiteContent.key == key)
    result = await db.execute(query)
    content = result.scalar_one_or_none()
    
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Store old value for audit
    old_values = {"value": content.value}
    
    # Update only provided fields
    update_data = content_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(content, field, value)
    
    await db.commit()
    await db.refresh(content)
    
    # Audit log
    audit = AuditLog(
        action="update",
        entity_type="content",
        entity_id=content.id,
        old_values=old_values,
        new_values=update_data
    )
    db.add(audit)
    await db.commit()
    
    return content


@router.delete("/content/{key}", status_code=204)
async def admin_delete_content(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Delete content block by key"""
    result = await db.execute(select(SiteContent).where(SiteContent.key == key))
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    content_id = content.id
    old_values = {"key": content.key, "value": content.value, "type": content.type}

    await db.delete(content)
    await db.commit()

    audit = AuditLog(
        action="delete",
        entity_type="content",
        entity_id=content_id,
        old_values=old_values,
    )
    db.add(audit)
    await db.commit()

    return None

@router.post("/upload")
async def admin_upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Upload a file (image, etc.)"""
    # Проверяем расширение
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    # Генерируем уникальное имя
    filename = f"{uuid.uuid4()}{ext}"
    file_path = UPLOAD_DIR / filename
    
    # Сохраняем файл
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Возвращаем URL для доступа к файлу
    file_url = f"/uploads/{filename}"
    
    # Аудит
    audit = AuditLog(
        action="upload",
        entity_type="file",
        new_values={"filename": filename, "url": file_url}
    )
    db.add(audit)
    await db.commit()
    
    return {"url": file_url, "filename": filename}

# ---------- Leads ----------
@router.get("/leads", response_model=List[dict])
async def admin_get_leads(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    type: Optional[str] = Query(None, description="Filter by lead type"),
    search: Optional[str] = Query(None, min_length=2, description="Search in phone, name, email"),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get all leads with filters"""
    query = select(Lead)
    
    if status:
        query = query.where(Lead.status == status)
    if type:
        query = query.where(Lead.type == type)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Lead.phone.ilike(search_pattern),
                Lead.name.ilike(search_pattern),
                Lead.email.ilike(search_pattern),
                Lead.vin.ilike(search_pattern)
            )
        )
    if date_from:
        query = query.where(Lead.created_at >= date_from)
    if date_to:
        query = query.where(Lead.created_at <= date_to + " 23:59:59")
    
    query = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/leads/{lead_id}", response_model=dict)
async def admin_get_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get single lead by ID"""
    query = select(Lead).where(Lead.id == lead_id)
    result = await db.execute(query)
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead

@router.put("/leads/{lead_id}/status")
async def admin_update_lead_status(
    lead_id: int,
    status: str,
    comment: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Update lead status"""
    query = select(Lead).where(Lead.id == lead_id)
    result = await db.execute(query)
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    old_status = lead.status
    lead.status = status
    lead.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # Audit log
    audit = AuditLog(
        action="update_status",
        entity_type="lead",
        entity_id=lead_id,
        old_values={"status": old_status},
        new_values={"status": status, "comment": comment}
    )
    db.add(audit)
    await db.commit()
    
    return {"status": "updated", "new_status": status}

@router.delete("/leads/{lead_id}", status_code=204)
async def admin_delete_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Delete lead"""
    query = select(Lead).where(Lead.id == lead_id)
    result = await db.execute(query)
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    await db.delete(lead)
    await db.commit()
    
    # Audit log
    audit = AuditLog(
        action="delete",
        entity_type="lead",
        entity_id=lead_id
    )
    db.add(audit)
    await db.commit()
    
    return None

@router.get("/leads/statuses", response_model=List[str])
async def admin_get_lead_statuses(
    current_user: User = Depends(get_admin_user)
):
    """Get all possible lead statuses"""
    return ["new", "in_progress", "contacted", "offer_sent", "won", "lost", "cancelled"]
