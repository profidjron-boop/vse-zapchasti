from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Float,
    Boolean,
    ForeignKey,
    DateTime,
    JSON,
)
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
    images = relationship(
        "ProductImage", back_populates="product", cascade="all, delete-orphan"
    )
    compatibilities = relationship(
        "ProductCompatibility", back_populates="product", cascade="all, delete-orphan"
    )


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
    uuid = Column(
        String(36), default=lambda: str(uuid.uuid4()), unique=True, index=True
    )
    type = Column(
        String(50), nullable=False
    )  # 'product', 'vin', 'callback', 'parts_search'
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
    manager_comment = Column(Text, nullable=True)

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


class VinRequest(Base):
    __tablename__ = "vin_requests"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(
        String(36), default=lambda: str(uuid.uuid4()), unique=True, index=True
    )
    status = Column(String(50), default="new")  # new, in_progress, closed

    vin = Column(String(50), nullable=False)
    name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=False)
    email = Column(String(255), nullable=True)
    message = Column(Text, nullable=True)

    ip_address = Column(String(50), nullable=True)
    user_agent = Column(Text, nullable=True)
    consent_given = Column(Boolean, default=False)
    consent_version = Column(String(50), nullable=True)
    consent_text = Column(Text, nullable=True)
    consent_at = Column(DateTime, nullable=True)
    operator_comment = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(
        String(36), default=lambda: str(uuid.uuid4()), unique=True, index=True
    )
    status = Column(String(50), default="new")  # new, in_progress, completed, cancelled
    vehicle_type = Column(String(20), nullable=False)  # 'passenger', 'truck'
    service_type = Column(String(100), nullable=False)

    name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=False)
    email = Column(String(255), nullable=True)

    vehicle_make = Column(String(100), nullable=True)
    vehicle_model = Column(String(100), nullable=True)
    vehicle_engine = Column(String(100), nullable=True)
    vehicle_year = Column(Integer, nullable=True)
    vin = Column(String(50), nullable=True)
    mileage = Column(Integer, nullable=True)

    description = Column(Text, nullable=True)
    install_with_part = Column(Boolean, nullable=False, default=False)
    requested_product_sku = Column(String(100), nullable=True, index=True)
    requested_product_name = Column(String(500), nullable=True)
    estimated_bundle_total = Column(Float, nullable=True)
    operator_comment = Column(Text, nullable=True)
    preferred_date = Column(DateTime, nullable=True)
    payment_status = Column(String(50), nullable=False, default="not_required")
    payment_required = Column(Boolean, nullable=False, default=False)
    payment_amount = Column(Float, nullable=True)
    payment_currency = Column(String(10), nullable=False, default="RUB")
    payment_provider = Column(String(100), nullable=True)
    payment_reference = Column(String(255), nullable=True, index=True)
    payment_error = Column(Text, nullable=True)
    payment_updated_at = Column(DateTime, nullable=True)

    # Метаданные
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(Text, nullable=True)
    consent_given = Column(Boolean, default=False)
    consent_version = Column(String(50), nullable=True)
    consent_text = Column(Text, nullable=True)
    consent_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ServiceCatalogItem(Base):
    __tablename__ = "service_catalog_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    vehicle_type = Column(
        String(20), nullable=False, default="passenger"
    )  # passenger, truck, both
    duration_minutes = Column(Integer, nullable=True)
    price = Column(Float, nullable=True)
    prepayment_required = Column(Boolean, nullable=False, default=False)
    prepayment_amount = Column(Float, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    role = Column(
        String(50), default="manager"
    )  # 'admin', 'manager', 'service_manager'
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


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(
        String(36), default=lambda: str(uuid.uuid4()), unique=True, index=True
    )
    status = Column(
        String(50), nullable=False, default="new"
    )  # new, in_progress, ready, closed, canceled
    source = Column(
        String(50), nullable=False, default="checkout"
    )  # checkout, one_click

    customer_name = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=False, index=True)
    customer_email = Column(String(255), nullable=True)
    comment = Column(Text, nullable=True)

    delivery_method = Column(String(50), nullable=True)  # pickup, courier
    payment_method = Column(String(50), nullable=True)  # cash_on_delivery, invoice
    legal_entity_name = Column(String(255), nullable=True)
    legal_entity_inn = Column(String(20), nullable=True)
    invoice_requisites_file_url = Column(String(500), nullable=True)
    invoice_requisites_file_name = Column(String(255), nullable=True)
    payment_status = Column(String(50), nullable=False, default="not_required")
    payment_required = Column(Boolean, nullable=False, default=False)
    payment_amount = Column(Float, nullable=True)
    payment_currency = Column(String(10), nullable=False, default="RUB")
    payment_provider = Column(String(100), nullable=True)
    payment_reference = Column(String(255), nullable=True, index=True)
    payment_error = Column(Text, nullable=True)
    payment_updated_at = Column(DateTime, nullable=True)

    ip_address = Column(String(50), nullable=True)
    user_agent = Column(Text, nullable=True)
    consent_given = Column(Boolean, default=False)
    consent_version = Column(String(50), nullable=True)
    consent_text = Column(Text, nullable=True)
    consent_at = Column(DateTime, nullable=True)
    manager_comment = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    product_sku = Column(String(100), nullable=True, index=True)
    product_name = Column(String(500), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Float, nullable=True)
    line_total = Column(Float, nullable=True)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")


class ImportRun(Base):
    __tablename__ = "import_runs"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False, default="products")
    status = Column(
        String(50), nullable=False, default="started"
    )  # started, finished, failed
    source = Column(String(255), nullable=True)
    summary = Column(JSON, nullable=True)
    errors = Column(JSON, nullable=True)
    snapshot_data = Column(JSON, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    previous_successful_run_id = Column(
        Integer, ForeignKey("import_runs.id"), nullable=True
    )
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    previous_successful_run = relationship("ImportRun", remote_side=[id], uselist=False)
    creator = relationship("User")


class SiteContent(Base):
    __tablename__ = "site_content"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    type = Column(String(50), default="text")  # text, image, html
    description = Column(String(255), nullable=True)  # описание для админки
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
