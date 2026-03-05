from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

# ---------- Category Schemas ----------
class CategoryBase(BaseModel):
    name: str
    slug: str
    parent_id: Optional[int] = None
    sort_order: int = 0
    is_active: bool = True

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# ---------- Product Schemas ----------
class ProductImageBase(BaseModel):
    url: str
    sort_order: int = 0
    is_main: bool = False

class ProductImageResponse(ProductImageBase):
    id: int

class ProductCompatibilityBase(BaseModel):
    make: str
    model: str
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    engine: Optional[str] = None

class ProductCompatibilityResponse(ProductCompatibilityBase):
    id: int

class ProductBase(BaseModel):
    category_id: int
    sku: str
    oem: Optional[str] = None
    brand: Optional[str] = None
    name: str
    description: Optional[str] = None
    price: Optional[float] = None
    stock_quantity: int = 0
    is_active: bool = True
    attributes: Dict[str, Any] = Field(default_factory=dict)

class ProductCreate(ProductBase):
    images: List[ProductImageBase] = []
    compatibilities: List[ProductCompatibilityBase] = []

class ProductUpdate(BaseModel):
    category_id: Optional[int] = None
    sku: Optional[str] = None
    oem: Optional[str] = None
    brand: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    is_active: Optional[bool] = None
    attributes: Optional[Dict[str, Any]] = None

class ProductResponse(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime
    images: List[ProductImageResponse] = []
    compatibilities: List[ProductCompatibilityResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

# ---------- Lead Schemas ----------
class LeadBase(BaseModel):
    type: str  # 'product', 'vin', 'callback', 'parts_search'
    name: Optional[str] = None
    phone: str
    email: Optional[EmailStr] = None
    message: Optional[str] = None
    vin: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = None
    product_id: Optional[int] = None
    product_sku: Optional[str] = None
    consent_given: bool = False
    consent_version: Optional[str] = None
    consent_text: Optional[str] = None

class LeadCreate(LeadBase):
    pass

class LeadResponse(LeadBase):
    id: int
    uuid: str
    status: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    consent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# ---------- Service Request Schemas ----------
class ServiceRequestBase(BaseModel):
    vehicle_type: str  # 'passenger', 'truck'
    service_type: str
    name: str
    phone: str
    email: Optional[EmailStr] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = None
    vin: Optional[str] = None
    mileage: Optional[int] = None
    description: Optional[str] = None
    preferred_date: Optional[datetime] = None
    consent_given: bool = False
    consent_version: Optional[str] = None
    consent_text: Optional[str] = None

class ServiceRequestCreate(ServiceRequestBase):
    pass

class ServiceRequestResponse(ServiceRequestBase):
    id: int
    uuid: str
    status: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    consent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# ---------- User Schemas ----------
class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: str = "manager"
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

# ---------- Health Response ----------
class HealthResponse(BaseModel):
    status: str
    database: str
    timestamp: datetime

# ---------- Site Content Schemas ----------
class SiteContentBase(BaseModel):
    key: str
    value: Optional[str] = None
    type: str = "text"
    description: Optional[str] = None

class SiteContentCreate(SiteContentBase):
    pass

class SiteContentUpdate(BaseModel):
    value: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None

class SiteContentResponse(SiteContentBase):
    id: int
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
