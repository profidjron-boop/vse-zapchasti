import re
from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime

SERVICE_REQUEST_STATUSES = {"new", "in_progress", "closed"}
VIN_REQUEST_STATUSES = {"new", "in_progress", "closed"}
ORDER_STATUSES = {"new", "in_progress", "ready", "closed", "canceled"}
ORDER_DELIVERY_METHODS = {"pickup", "courier"}
ORDER_PAYMENT_METHODS = {"cash_on_delivery", "invoice"}
ORDER_SOURCES = {"checkout", "one_click"}
LEAD_TYPES = {"product", "callback", "vin", "parts_search"}
USER_ROLES = {"admin", "manager", "service_manager"}
SERVICE_CATALOG_VEHICLE_TYPES = {"passenger", "truck", "both"}


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)

    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if len(digits) == 10:
        digits = "7" + digits
    if len(digits) != 11 or not digits.startswith("7"):
        raise ValueError("Phone must be a valid RU number")

    return f"+{digits}"

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

    @field_validator("url")
    @classmethod
    def validate_self_hosted_url(cls, value: str) -> str:
        normalized = value.strip()
        if normalized.startswith("http://") or normalized.startswith("https://"):
            raise ValueError("External image URLs are not allowed")
        if not normalized.startswith("/uploads/"):
            raise ValueError("Image URL must point to self-hosted /uploads path")
        return normalized

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
    compatibilities: Optional[List[ProductCompatibilityBase]] = None

class ProductResponse(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime
    images: List[ProductImageResponse] = []
    compatibilities: List[ProductCompatibilityResponse] = []
    
    model_config = ConfigDict(from_attributes=True)


# ---------- Order Schemas ----------
class OrderItemBase(BaseModel):
    product_id: Optional[int] = None
    product_sku: Optional[str] = None
    product_name: str
    quantity: int = Field(default=1, ge=1)
    unit_price: Optional[float] = None
    line_total: Optional[float] = None

    @field_validator("product_name")
    @classmethod
    def validate_product_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("product_name is required")
        return normalized

    @field_validator("product_sku")
    @classmethod
    def normalize_sku(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemResponse(OrderItemBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class OrderBase(BaseModel):
    source: str = "checkout"
    customer_name: Optional[str] = None
    customer_phone: str
    customer_email: Optional[EmailStr] = None
    comment: Optional[str] = None

    delivery_method: Optional[str] = None
    payment_method: Optional[str] = None
    legal_entity_name: Optional[str] = None
    legal_entity_inn: Optional[str] = None
    invoice_requisites_file_url: Optional[str] = None
    invoice_requisites_file_name: Optional[str] = None

    consent_given: bool = False
    consent_version: Optional[str] = None
    consent_text: Optional[str] = None
    items: List[OrderItemCreate] = Field(default_factory=list)

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ORDER_SOURCES:
            raise ValueError(f"source must be one of: {', '.join(sorted(ORDER_SOURCES))}")
        return normalized

    @field_validator("customer_phone")
    @classmethod
    def validate_customer_phone(cls, value: str) -> str:
        return normalize_phone(value)

    @field_validator("delivery_method")
    @classmethod
    def validate_delivery_method(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in ORDER_DELIVERY_METHODS:
            raise ValueError(
                f"delivery_method must be one of: {', '.join(sorted(ORDER_DELIVERY_METHODS))}"
            )
        return normalized

    @field_validator("payment_method")
    @classmethod
    def validate_payment_method(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in ORDER_PAYMENT_METHODS:
            raise ValueError(
                f"payment_method must be one of: {', '.join(sorted(ORDER_PAYMENT_METHODS))}"
            )
        return normalized

    @field_validator("customer_name", "comment", "legal_entity_name", "invoice_requisites_file_name")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("legal_entity_inn")
    @classmethod
    def normalize_legal_inn(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = re.sub(r"\D", "", value)
        return normalized or None

    @field_validator("invoice_requisites_file_url")
    @classmethod
    def validate_invoice_requisites_file_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        if normalized.startswith("http://") or normalized.startswith("https://"):
            raise ValueError("External invoice requisites file URLs are not allowed")
        if not normalized.startswith("/uploads/"):
            raise ValueError("Invoice requisites file URL must point to self-hosted /uploads path")
        return normalized


class OrderCreate(OrderBase):
    @field_validator("items")
    @classmethod
    def validate_items_for_checkout(cls, value: List[OrderItemCreate]) -> List[OrderItemCreate]:
        return value


class OrderResponse(OrderBase):
    id: int
    uuid: str
    status: str
    manager_comment: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    consent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class OrderStatusUpdate(BaseModel):
    status: str
    manager_comment: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ORDER_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(ORDER_STATUSES))}")
        return normalized

    @field_validator("manager_comment")
    @classmethod
    def normalize_manager_comment(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class OrderPublicItemResponse(BaseModel):
    product_sku: Optional[str] = None
    product_name: str
    quantity: int
    unit_price: Optional[float] = None
    line_total: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class OrderPublicResponse(BaseModel):
    id: int
    uuid: str
    status: str
    source: str
    delivery_method: Optional[str] = None
    payment_method: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[OrderPublicItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class OrderRequisitesUploadResponse(BaseModel):
    url: str
    filename: str
    size_bytes: int
    content_type: str

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

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized in {"product inquiry", "product_inquiry"}:
            normalized = "product"
        if normalized not in LEAD_TYPES:
            raise ValueError(f"type must be one of: {', '.join(sorted(LEAD_TYPES))}")
        return normalized

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        return normalize_phone(value)

    @field_validator("name", "message", "vin", "vehicle_make", "vehicle_model", "product_sku")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

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

# ---------- VIN Request Schemas ----------
class VinRequestBase(BaseModel):
    vin: str
    phone: str
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    message: Optional[str] = None
    operator_comment: Optional[str] = None
    consent_given: bool = False
    consent_version: Optional[str] = None
    consent_text: Optional[str] = None

    @field_validator("vin")
    @classmethod
    def validate_vin(cls, value: str) -> str:
        normalized = value.strip().upper()
        if len(normalized) != 17 or not re.fullmatch(r"[A-HJ-NPR-Z0-9]{17}", normalized):
            raise ValueError("VIN must contain 17 symbols")
        return normalized

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        return normalize_phone(value)

    @field_validator("name", "message", "operator_comment")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class VinRequestCreate(VinRequestBase):
    pass


class VinRequestResponse(VinRequestBase):
    id: int
    uuid: str
    status: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    consent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VinRequestStatusUpdate(BaseModel):
    status: str
    operator_comment: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VIN_REQUEST_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VIN_REQUEST_STATUSES))}")
        return normalized

    @field_validator("operator_comment")
    @classmethod
    def normalize_comment(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

# ---------- Service Request Schemas ----------
class ServiceRequestBase(BaseModel):
    vehicle_type: str  # 'passenger', 'truck'
    service_type: str
    name: Optional[str] = None
    phone: str
    email: Optional[EmailStr] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_engine: Optional[str] = None
    vehicle_year: Optional[int] = None
    vin: Optional[str] = None
    mileage: Optional[int] = None
    description: str
    install_with_part: bool = False
    requested_product_sku: Optional[str] = None
    requested_product_name: Optional[str] = None
    estimated_bundle_total: Optional[float] = Field(default=None, ge=0)
    operator_comment: Optional[str] = None
    preferred_date: Optional[datetime] = None
    consent_given: bool = False
    consent_version: Optional[str] = None
    consent_text: Optional[str] = None

    @field_validator("vehicle_type")
    @classmethod
    def validate_vehicle_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"passenger", "truck"}:
            raise ValueError("vehicle_type must be 'passenger' or 'truck'")
        return normalized

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        return normalize_phone(value)

    @field_validator("service_type", "description")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Field must not be empty")
        return normalized

    @field_validator("name", "vehicle_make", "vehicle_model", "vehicle_engine", "vin", "requested_product_name")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("requested_product_sku")
    @classmethod
    def normalize_requested_product_sku(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().upper()
        return normalized or None

    @field_validator("operator_comment")
    @classmethod
    def validate_operator_comment(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

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


class ServiceRequestStatusUpdate(BaseModel):
    status: str
    operator_comment: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in SERVICE_REQUEST_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(SERVICE_REQUEST_STATUSES))}")
        return normalized

    @field_validator("operator_comment")
    @classmethod
    def validate_comment(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ServiceCatalogItemBase(BaseModel):
    name: str
    vehicle_type: str = "passenger"
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    price: Optional[float] = Field(default=None, ge=0)
    prepayment_required: bool = False
    prepayment_amount: Optional[float] = Field(default=None, ge=0)
    sort_order: int = 0
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("name is required")
        return normalized

    @field_validator("vehicle_type")
    @classmethod
    def validate_vehicle_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in SERVICE_CATALOG_VEHICLE_TYPES:
            raise ValueError(
                f"vehicle_type must be one of: {', '.join(sorted(SERVICE_CATALOG_VEHICLE_TYPES))}"
            )
        return normalized


class ServiceCatalogItemCreate(ServiceCatalogItemBase):
    pass


class ServiceCatalogItemUpdate(BaseModel):
    name: Optional[str] = None
    vehicle_type: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    price: Optional[float] = Field(default=None, ge=0)
    prepayment_required: Optional[bool] = None
    prepayment_amount: Optional[float] = Field(default=None, ge=0)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("vehicle_type")
    @classmethod
    def validate_vehicle_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in SERVICE_CATALOG_VEHICLE_TYPES:
            raise ValueError(
                f"vehicle_type must be one of: {', '.join(sorted(SERVICE_CATALOG_VEHICLE_TYPES))}"
            )
        return normalized


class ServiceCatalogItemResponse(ServiceCatalogItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ---------- User Schemas ----------
class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: str = "manager"
    is_active: bool = True

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in USER_ROLES:
            raise ValueError(f"role must be one of: {', '.join(sorted(USER_ROLES))}")
        return normalized

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in USER_ROLES:
            raise ValueError(f"role must be one of: {', '.join(sorted(USER_ROLES))}")
        return normalized

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    email: str
    name: Optional[str] = None
    role: str = "manager"
    is_active: bool = True
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
