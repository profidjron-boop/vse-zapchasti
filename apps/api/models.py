from sqlalchemy import Column, Integer, String, Text, Float, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import uuid

Base = declarative_base()

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    parent = relationship("Category", remote_side=[id], backref="children")
    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    sku = Column(String(100), unique=True, index=True, nullable=False)
    oem = Column(String(100), index=True)
    brand = Column(String(100), index=True)
    name = Column(String(500), nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=True)
    stock_quantity = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    attributes = Column(JSON, default={})  # Характеристики в JSON
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    category = relationship("Category", back_populates="products")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    compatibilities = relationship("ProductCompatibility", back_populates="product", cascade="all, delete-orphan")

class ProductImage(Base):
    __tablename__ = "product_images"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    url = Column(String(500), nullable=False)  # Путь к файлу (self-hosted)
    sort_order = Column(Integer, default=0)
    is_main = Column(Boolean, default=False)
    
    # Relationships
    product = relationship("Product", back_populates="images")

class ProductCompatibility(Base):
    __tablename__ = "product_compatibility"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    make = Column(String(100), nullable=False, index=True)
    model = Column(String(100), nullable=False, index=True)
    year_from = Column(Integer, nullable=True)
    year_to = Column(Integer, nullable=True)
    engine = Column(String(100), nullable=True)
    
    # Relationships
    product = relationship("Product", back_populates="compatibilities")

class Lead(Base):
    __tablename__ = "leads"
    
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), default=lambda: str(uuid.uuid4()), unique=True, index=True)
    type = Column(String(50), nullable=False)  # 'product', 'vin', 'callback', 'parts_search'
    status = Column(String(50), default="new")  # new, in_progress, completed, cancelled
    name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=False)
    email = Column(String(255), nullable=True)
    message = Column(Text, nullable=True)
    vin = Column(String(50), nullable=True)
    
    # Данные автомобиля
    vehicle_make = Column(String(100), nullable=True)
    vehicle_model = Column(String(100), nullable=True)
    vehicle_year = Column(Integer, nullable=True)
    
    # Для заявок по товарам
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    product_sku = Column(String(100), nullable=True)
    
    # Метаданные
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(Text, nullable=True)
    consent_given = Column(Boolean, default=False)
    consent_version = Column(String(50), nullable=True)
    consent_text = Column(Text, nullable=True)
    consent_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    product = relationship("Product")

class ServiceRequest(Base):
    __tablename__ = "service_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), default=lambda: str(uuid.uuid4()), unique=True, index=True)
    status = Column(String(50), default="new")  # new, in_progress, completed, cancelled
    vehicle_type = Column(String(20), nullable=False)  # 'passenger', 'truck'
    service_type = Column(String(100), nullable=False)
    
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    email = Column(String(255), nullable=True)
    
    vehicle_make = Column(String(100), nullable=True)
    vehicle_model = Column(String(100), nullable=True)
    vehicle_year = Column(Integer, nullable=True)
    vin = Column(String(50), nullable=True)
    mileage = Column(Integer, nullable=True)
    
    description = Column(Text, nullable=True)
    preferred_date = Column(DateTime, nullable=True)
    
    # Метаданные
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(Text, nullable=True)
    consent_given = Column(Boolean, default=False)
    consent_version = Column(String(50), nullable=True)
    consent_text = Column(Text, nullable=True)
    consent_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    role = Column(String(50), default="manager")  # 'admin', 'manager', 'service_manager'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=True)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    trace_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")

class SiteContent(Base):
    __tablename__ = "site_content"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    type = Column(String(50), default="text")  # text, image, html
    description = Column(String(255), nullable=True)  # описание для админки
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
