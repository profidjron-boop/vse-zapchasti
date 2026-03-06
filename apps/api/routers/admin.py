import csv
from datetime import UTC, datetime, timedelta
import io
import os
from pathlib import Path
import secrets
import shutil
from typing import Any, List, Optional
import uuid
import zipfile
from xml.etree import ElementTree as ET

import bcrypt
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from notifications import notify_event
from models import (
    AuditLog,
    Category,
    ImportRun,
    Lead,
    Order,
    Product,
    ProductCompatibility,
    ProductImage,
    ServiceCatalogItem,
    ServiceRequest,
    SiteContent,
    User,
    VinRequest,
)
from schemas import (
    CategoryCreate,
    CategoryResponse,
    LeadResponse,
    OrderResponse,
    OrderStatusUpdate,
    CategoryUpdate,
    ProductCreate,
    ProductImageBase,
    ProductImageResponse,
    ProductResponse,
    ProductUpdate,
    ServiceCatalogItemCreate,
    ServiceCatalogItemResponse,
    ServiceCatalogItemUpdate,
    ServiceRequestResponse,
    ServiceRequestStatusUpdate,
    SiteContentCreate,
    SiteContentResponse,
    SiteContentUpdate,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
    VinRequestResponse,
    VinRequestStatusUpdate,
)

# JWT settings
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY")
JWT_PREVIOUS_SECRET_KEY = os.getenv("JWT_PREVIOUS_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY environment variable is required")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
ADMIN_SESSION_COOKIE_NAME = "admin_session"
ADMIN_CSRF_COOKIE_NAME = "admin_csrf_token"
LEGACY_ADMIN_TOKEN_COOKIE_NAME = "admin_token"
UNSAFE_HTTP_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


ADMIN_COOKIE_SECURE = _env_bool("ADMIN_COOKIE_SECURE", default=False)
ADMIN_COOKIE_SAMESITE = os.getenv("ADMIN_COOKIE_SAMESITE", "lax").strip().lower()
if ADMIN_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    ADMIN_COOKIE_SAMESITE = "lax"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/admin/auth/token", auto_error=False)


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def verify_password(plain_password, hashed_password):
    plain_bytes = plain_password.encode("utf-8")
    hash_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(plain_bytes, hash_bytes)

def get_password_hash(password):
    password_bytes = password.encode("utf-8")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = _utcnow() + expires_delta
    else:
        expire = _utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def _decode_access_token(token: str) -> dict[str, Any] | None:
    for candidate_key in (JWT_SECRET_KEY, JWT_PREVIOUS_SECRET_KEY):
        if not candidate_key:
            continue
        try:
            return jwt.decode(token, candidate_key, algorithms=[ALGORITHM])
        except JWTError:
            continue
    return None


def _validate_csrf(request: Request) -> None:
    csrf_cookie = (request.cookies.get(ADMIN_CSRF_COOKIE_NAME) or "").strip()
    csrf_header = (request.headers.get("x-csrf-token") or "").strip()
    if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
        raise HTTPException(status_code=403, detail="CSRF token is missing or invalid")


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    cookie_token = (request.cookies.get(ADMIN_SESSION_COOKIE_NAME) or "").strip()
    legacy_cookie_token = (request.cookies.get(LEGACY_ADMIN_TOKEN_COOKIE_NAME) or "").strip()
    bearer_token = (token or "").strip()

    token_candidates: list[tuple[str, str]] = []
    if cookie_token:
        token_candidates.append(("cookie", cookie_token))
    if legacy_cookie_token and legacy_cookie_token != cookie_token:
        token_candidates.append(("cookie", legacy_cookie_token))
    if bearer_token and bearer_token not in {cookie_token, legacy_cookie_token}:
        token_candidates.append(("bearer", bearer_token))

    payload = None
    auth_source = "none"
    for candidate_source, candidate_token in token_candidates:
        payload = _decode_access_token(candidate_token)
        if payload is not None:
            auth_source = candidate_source
            break

    if payload is None:
        raise credentials_exception

    if auth_source == "cookie" and request.method.upper() in UNSAFE_HTTP_METHODS:
        _validate_csrf(request)

    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    query = select(User).where(User.id == int(user_id))
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    request.state.user_id = user.id
    request.state.auth_source = auth_source
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def require_roles(*allowed_roles: str):
    allowed = set(allowed_roles)

    async def _require(current_user: User = Depends(get_current_active_user)):
        if current_user.role not in allowed:
            allowed_str = ", ".join(sorted(allowed))
            raise HTTPException(status_code=403, detail=f"Not enough permissions. Required roles: {allowed_str}")
        return current_user

    return _require


get_admin_user = require_roles("admin")
get_catalog_user = require_roles("admin", "manager")
get_leads_user = require_roles("admin", "manager")
get_orders_user = require_roles("admin")
get_service_requests_user = require_roles("admin", "service_manager")
get_service_catalog_user = require_roles("admin")
get_content_user = require_roles("admin")

router = APIRouter(prefix="/api/admin", tags=["admin"])
REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_UPLOAD_DIR = REPO_ROOT / "apps" / "web" / "public" / "uploads"
raw_upload_dir = os.getenv("UPLOAD_DIR")
UPLOAD_DIR = Path(raw_upload_dir).expanduser() if raw_upload_dir else DEFAULT_UPLOAD_DIR
if not UPLOAD_DIR.is_absolute():
    UPLOAD_DIR = (REPO_ROOT / UPLOAD_DIR).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PRODUCT_IMPORT_ALLOWED_EXTENSIONS = {".csv", ".xlsx"}
IMPORT_TRIGGER_MODES = {"manual", "hourly", "daily", "event"}
LEAD_STATUSES = ["new", "in_progress", "contacted", "offer_sent", "won", "lost", "cancelled"]
LEAD_VALID_TRANSITIONS = {
    "new": {"in_progress", "contacted", "lost", "cancelled"},
    "in_progress": {"contacted", "offer_sent", "lost", "cancelled"},
    "contacted": {"offer_sent", "won", "lost", "cancelled"},
    "offer_sent": {"won", "lost", "cancelled"},
    "won": set(),
    "lost": set(),
    "cancelled": set(),
}
ORDER_STATUSES = ["new", "in_progress", "ready", "closed", "canceled"]
ORDER_VALID_TRANSITIONS = {
    "new": {"in_progress", "canceled"},
    "in_progress": {"ready", "canceled"},
    "ready": {"closed", "canceled"},
    "closed": set(),
    "canceled": set(),
}


def _normalize_header(value: str) -> str:
    return value.strip().lower().replace(" ", "_")


PRODUCT_IMPORT_COLUMN_ALIASES = {
    "артикул": "sku",
    "article": "sku",
    "product_sku": "sku",
    "название": "name",
    "product_name": "name",
    "категория": "category_id",
    "category": "category_id",
    "categoryid": "category_id",
    "category_slug": "category_slug",
    "slug": "category_slug",
    "category_name": "category_name",
    "категория_название": "category_name",
    "бренд": "brand",
    "цена": "price",
    "остаток": "stock_quantity",
    "stock": "stock_quantity",
    "quantity": "stock_quantity",
    "активен": "is_active",
    "active": "is_active",
    "описание": "description",
}


def _canonicalize_import_row(row: dict[str, Any]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for key, value in row.items():
        if key is None:
            continue
        normalized_key = _normalize_header(str(key))
        canonical_key = PRODUCT_IMPORT_COLUMN_ALIASES.get(normalized_key, normalized_key)
        normalized[canonical_key] = str(value or "").strip()
    return normalized


def _normalize_import_trigger_mode(value: Any) -> str:
    if isinstance(value, str):
        raw_value = value
    else:
        raw_value = str(getattr(value, "default", "manual") or "manual")
    normalized = raw_value.strip().lower()
    if normalized not in IMPORT_TRIGGER_MODES:
        allowed = ", ".join(sorted(IMPORT_TRIGGER_MODES))
        raise HTTPException(status_code=400, detail=f"trigger_mode must be one of: {allowed}")
    return normalized


def _decode_csv_content(content: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1251", "utf-8"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=400, detail="Cannot decode CSV file. Use UTF-8 or CP1251.")


def _extract_csv_rows(content: bytes) -> list[dict[str, str]]:
    csv_text = _decode_csv_content(content)
    reader = csv.DictReader(io.StringIO(csv_text))

    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV header row is required.")

    rows: list[dict[str, str]] = []
    for row in reader:
        normalized_row = _canonicalize_import_row(row)
        if any(value for value in normalized_row.values()):
            rows.append(normalized_row)
    return rows


def _xlsx_column_to_index(cell_ref: str) -> int:
    column = "".join(char for char in cell_ref if char.isalpha()).upper()
    if not column:
        return -1

    index = 0
    for char in column:
        index = index * 26 + (ord(char) - ord("A") + 1)
    return index - 1


def _extract_xlsx_rows(content: bytes) -> list[dict[str, str]]:
    namespace = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    rel_namespace = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
    shared_strings: list[str] = []

    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        try:
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in shared_root.findall(".//x:si", namespace):
                text_parts = [(node.text or "") for node in item.findall(".//x:t", namespace)]
                shared_strings.append("".join(text_parts))
        except KeyError:
            shared_strings = []

        worksheet_path = "xl/worksheets/sheet1.xml"
        try:
            workbook = ET.fromstring(archive.read("xl/workbook.xml"))
            rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
            first_sheet = workbook.find(".//x:sheets/x:sheet", namespace)
            if first_sheet is not None:
                rel_id = first_sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
                if rel_id:
                    rel_target = rels.find(f'.//r:Relationship[@Id="{rel_id}"]', rel_namespace)
                    if rel_target is not None:
                        worksheet_path = f"xl/{rel_target.attrib.get('Target', '').lstrip('/')}"
        except KeyError:
            worksheet_path = "xl/worksheets/sheet1.xml"

        try:
            worksheet = ET.fromstring(archive.read(worksheet_path))
        except KeyError as exc:
            raise HTTPException(status_code=400, detail="XLSX worksheet not found.") from exc

    header: list[str] = []
    rows: list[dict[str, str]] = []

    for row_node in worksheet.findall(".//x:sheetData/x:row", namespace):
        indexed_values: dict[int, str] = {}
        for cell in row_node.findall("x:c", namespace):
            cell_ref = cell.attrib.get("r", "")
            column_index = _xlsx_column_to_index(cell_ref)
            if column_index < 0:
                continue

            cell_type = cell.attrib.get("t")
            value = ""

            if cell_type == "s":
                raw = cell.find("x:v", namespace)
                if raw is not None and raw.text and raw.text.isdigit():
                    shared_index = int(raw.text)
                    if 0 <= shared_index < len(shared_strings):
                        value = shared_strings[shared_index]
            elif cell_type == "inlineStr":
                raw = cell.find("x:is/x:t", namespace)
                value = raw.text if raw is not None and raw.text else ""
            else:
                raw = cell.find("x:v", namespace)
                value = raw.text if raw is not None and raw.text else ""

            indexed_values[column_index] = value

        if not indexed_values:
            continue

        max_index = max(indexed_values.keys())
        row_values = [indexed_values.get(index, "") for index in range(max_index + 1)]

        if not header:
            header = [_normalize_header(value) for value in row_values]
            continue

        normalized_row: dict[str, str] = {}
        for index, key in enumerate(header):
            if not key:
                continue
            normalized_row[key] = row_values[index].strip() if index < len(row_values) else ""

        normalized_row = _canonicalize_import_row(normalized_row)
        if any(value for value in normalized_row.values()):
            rows.append(normalized_row)

    return rows


def _parse_import_rows(filename: str, content: bytes) -> list[dict[str, str]]:
    extension = Path(filename).suffix.lower()

    if extension not in PRODUCT_IMPORT_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only CSV and XLSX files are supported.")

    if extension == ".csv":
        return _extract_csv_rows(content)

    return _extract_xlsx_rows(content)


def _parse_optional_int(value: str) -> Optional[int]:
    raw = value.strip()
    if not raw:
        return None
    return int(raw)


def _parse_optional_float(value: str) -> Optional[float]:
    raw = value.strip().replace(" ", "").replace(",", ".")
    if not raw:
        return None
    return float(raw)


def _parse_bool(value: str, default: bool = True) -> bool:
    raw = value.strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "y", "on", "да"}


def _extract_import_counts(run: ImportRun) -> dict[str, int]:
    summary = run.summary if isinstance(run.summary, dict) else {}

    def _to_int(value: Any, default: int = 0) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    created = _to_int(summary.get("created"), 0)
    updated = _to_int(summary.get("updated"), 0)
    failed = _to_int(summary.get("failed"), len(run.errors or []))
    total = _to_int(summary.get("total"), created + updated + failed)

    return {
        "total": total,
        "created": created,
        "updated": updated,
        "failed": failed,
    }


def _serialize_import_run(run: ImportRun, users_by_id: dict[int, str]) -> dict[str, Any]:
    counts = _extract_import_counts(run)
    return {
        "id": run.id,
        "entity_type": run.entity_type,
        "status": run.status,
        "source": run.source,
        "started_at": run.started_at,
        "finished_at": run.finished_at,
        "created_by": run.created_by,
        "created_by_user": users_by_id.get(run.created_by) if run.created_by else None,
        "total": counts["total"],
        "created": counts["created"],
        "updated": counts["updated"],
        "failed": counts["failed"],
        "details_url": f"/admin/imports/{run.id}",
        "previous_successful_run_id": run.previous_successful_run_id,
    }


async def _load_users_map(db: AsyncSession, user_ids: set[int]) -> dict[int, str]:
    if not user_ids:
        return {}

    users_result = await db.execute(select(User.id, User.email).where(User.id.in_(user_ids)))
    return {row[0]: row[1] for row in users_result.all()}

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

    csrf_token = secrets.token_urlsafe(32)
    max_age = int(access_token_expires.total_seconds())
    response = JSONResponse(
        {
            "access_token": access_token,
            "token_type": "bearer",
        }
    )
    response.set_cookie(
        key=ADMIN_SESSION_COOKIE_NAME,
        value=access_token,
        max_age=max_age,
        expires=max_age,
        httponly=True,
        secure=ADMIN_COOKIE_SECURE,
        samesite=ADMIN_COOKIE_SAMESITE,
        path="/",
    )
    response.set_cookie(
        key=ADMIN_CSRF_COOKIE_NAME,
        value=csrf_token,
        max_age=max_age,
        expires=max_age,
        httponly=False,
        secure=ADMIN_COOKIE_SECURE,
        samesite=ADMIN_COOKIE_SAMESITE,
        path="/",
    )
    response.delete_cookie(LEGACY_ADMIN_TOKEN_COOKIE_NAME, path="/")
    return response


@router.post("/auth/logout")
async def logout():
    response = JSONResponse({"ok": True})
    response.delete_cookie(ADMIN_SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(ADMIN_CSRF_COOKIE_NAME, path="/")
    response.delete_cookie(LEGACY_ADMIN_TOKEN_COOKIE_NAME, path="/")
    return response

@router.get("/auth/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user info"""
    return current_user

# ---------- Users ----------
@router.get("/users", response_model=List[UserResponse])
async def admin_get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, min_length=2, description="Search by email or name"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Get users (admin only)."""
    query = select(User)

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                User.email.ilike(search_pattern),
                User.name.ilike(search_pattern),
            )
        )

    query = query.order_by(User.id).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/users", response_model=UserResponse, status_code=201)
async def admin_create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Create user (admin only)."""
    email = str(payload.email).strip().lower()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User with this email already exists")

    db_user = User(
        email=email,
        name=payload.name,
        role=payload.role,
        is_active=payload.is_active,
        password_hash=get_password_hash(payload.password),
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    audit = AuditLog(
        user_id=current_user.id,
        action="create",
        entity_type="user",
        entity_id=db_user.id,
        new_values={
            "email": db_user.email,
            "name": db_user.name,
            "role": db_user.role,
            "is_active": db_user.is_active,
        },
    )
    db.add(audit)
    await db.commit()

    return db_user


@router.put("/users/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Update user role/status/profile (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if (
        payload.name is None
        and payload.role is None
        and payload.is_active is None
        and payload.password is None
    ):
        raise HTTPException(status_code=400, detail="No fields to update")

    if payload.is_active is False and target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    if payload.role is not None and target_user.id == current_user.id and payload.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot change your own role from admin")

    old_values = {
        "name": target_user.name,
        "role": target_user.role,
        "is_active": target_user.is_active,
    }

    if payload.name is not None:
        target_user.name = payload.name
    if payload.role is not None:
        target_user.role = payload.role
    if payload.is_active is not None:
        target_user.is_active = payload.is_active
    if payload.password is not None:
        target_user.password_hash = get_password_hash(payload.password)

    await db.commit()
    await db.refresh(target_user)

    audit = AuditLog(
        user_id=current_user.id,
        action="update",
        entity_type="user",
        entity_id=target_user.id,
        old_values=old_values,
        new_values={
            "name": target_user.name,
            "role": target_user.role,
            "is_active": target_user.is_active,
            "password_changed": payload.password is not None,
        },
    )
    db.add(audit)
    await db.commit()

    return target_user

# ---------- Products ----------
@router.get("/products", response_model=List[ProductResponse])
async def admin_get_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_catalog_user)
):
    """Get all products (admin only)"""
    query = (
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.compatibilities))
        .offset(skip)
        .limit(limit)
        .order_by(Product.id)
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/products/{product_id}", response_model=ProductResponse)
async def admin_get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_catalog_user)
):
    """Get product by ID (admin)"""
    query = (
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.compatibilities))
        .where(Product.id == product_id)
    )
    result = await db.execute(query)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.post("/products", response_model=ProductResponse, status_code=201)
async def admin_create_product(
    product: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_catalog_user)
):
    """Create new product"""
    # Check if SKU exists
    existing = await db.execute(select(Product).where(Product.sku == product.sku))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="SKU already exists")

    product_data = product.model_dump(exclude={"images", "compatibilities"})
    db_product = Product(**product_data)
    db.add(db_product)

    await db.flush()

    for compatibility in product.compatibilities:
        db_compatibility = ProductCompatibility(
            product_id=db_product.id,
            **compatibility.model_dump(),
        )
        db.add(db_compatibility)

    for image in product.images:
        db_image = ProductImage(
            product_id=db_product.id,
            **image.model_dump(),
        )
        db.add(db_image)

    await db.commit()

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="create",
        entity_type="product",
        entity_id=db_product.id,
        new_values=product.model_dump()
    )
    db.add(audit)
    await db.commit()

    created_result = await db.execute(
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.compatibilities))
        .where(Product.id == db_product.id)
    )
    return created_result.scalar_one()


@router.post("/products/{product_id}/images", response_model=ProductImageResponse, status_code=201)
async def admin_attach_product_image(
    product_id: int,
    image: ProductImageBase,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_catalog_user),
):
    """Attach uploaded self-hosted image to product."""
    product_result = await db.execute(select(Product).where(Product.id == product_id))
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    relative_path = image.url.removeprefix("/uploads/").strip("/")
    if not relative_path:
        raise HTTPException(status_code=400, detail="Image URL is invalid")

    file_path = (UPLOAD_DIR / relative_path).resolve()
    upload_root = UPLOAD_DIR.resolve()
    if not str(file_path).startswith(str(upload_root)) or not file_path.is_file():
        raise HTTPException(status_code=400, detail="Uploaded file not found")

    if image.is_main:
        current_main = await db.execute(
            select(ProductImage).where(ProductImage.product_id == product_id, ProductImage.is_main.is_(True))
        )
        for existing_main in current_main.scalars().all():
            existing_main.is_main = False

    db_image = ProductImage(product_id=product_id, **image.model_dump())
    db.add(db_image)
    await db.commit()
    await db.refresh(db_image)

    audit = AuditLog(
        user_id=current_user.id,
        action="attach_image",
        entity_type="product",
        entity_id=product_id,
        new_values=db_image_to_dict(db_image),
    )
    db.add(audit)
    await db.commit()

    return db_image


def db_image_to_dict(image: ProductImage) -> dict[str, Any]:
    return {
        "id": image.id,
        "product_id": image.product_id,
        "url": image.url,
        "sort_order": image.sort_order,
        "is_main": image.is_main,
    }


@router.put("/products/{product_id}", response_model=ProductResponse)
async def admin_update_product(
    product_id: int,
    product_update: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_catalog_user)
):
    """Update product"""
    query = (
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.compatibilities))
        .where(Product.id == product_id)
    )
    result = await db.execute(query)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Store old values for audit
    old_values = {
        "sku": product.sku,
        "name": product.name,
        "price": product.price,
        "stock_quantity": product.stock_quantity,
        "compatibilities": [
            {
                "make": compatibility.make,
                "model": compatibility.model,
                "year_from": compatibility.year_from,
                "year_to": compatibility.year_to,
                "engine": compatibility.engine,
            }
            for compatibility in product.compatibilities
        ],
    }

    has_compatibilities_update = "compatibilities" in product_update.model_fields_set

    # Update only provided scalar fields
    update_data = product_update.model_dump(exclude_unset=True, exclude={"compatibilities"})
    for field, value in update_data.items():
        setattr(product, field, value)

    if has_compatibilities_update:
        await db.execute(delete(ProductCompatibility).where(ProductCompatibility.product_id == product_id))
        for compatibility in product_update.compatibilities or []:
            db.add(
                ProductCompatibility(
                    product_id=product_id,
                    **compatibility.model_dump(),
                )
            )
    
    await db.commit()
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="update",
        entity_type="product",
        entity_id=product_id,
        old_values=old_values,
        new_values={
            **update_data,
            **(
                {
                    "compatibilities": [item.model_dump() for item in (product_update.compatibilities or [])]
                }
                if has_compatibilities_update
                else {}
            ),
        }
    )
    db.add(audit)
    await db.commit()

    updated_result = await db.execute(
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.compatibilities))
        .where(Product.id == product_id)
    )
    return updated_result.scalar_one()

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
        user_id=current_user.id,
        action="delete",
        entity_type="product",
        entity_id=product_id
    )
    db.add(audit)
    await db.commit()
    
    return None


@router.post("/products/import")
async def admin_import_products(
    file: UploadFile = File(...),
    default_category_id: Optional[int] = Query(None, ge=1),
    skip_invalid: bool = Query(False, description="Skip invalid rows and import valid rows only"),
    trigger_mode: str = Query(
        "manual",
        description="manual/hourly/daily/event mode marker for import run audit",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Import products from CSV/XLSX with upsert by SKU."""
    run_id: Optional[int] = None
    collected_errors: list[str] = []
    normalized_trigger_mode = _normalize_import_trigger_mode(trigger_mode)

    previous_successful_run = await db.execute(
        select(ImportRun)
        .where(ImportRun.entity_type == "products", ImportRun.status == "finished")
        .order_by(ImportRun.id.desc())
        .limit(1)
    )
    previous_run = previous_successful_run.scalar_one_or_none()

    run = ImportRun(
        entity_type="products",
        status="started",
        source=f"{normalized_trigger_mode}:{file.filename}" if file.filename else normalized_trigger_mode,
        started_at=_utcnow(),
        created_by=current_user.id,
        previous_successful_run_id=previous_run.id if previous_run else None,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    run_id = run.id

    if not file.filename:
        collected_errors.append("Filename is required.")
        run.status = "failed"
        run.finished_at = _utcnow()
        run.errors = collected_errors
        await db.commit()
        raise HTTPException(status_code=400, detail="Filename is required.")

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        rows = _parse_import_rows(file.filename, content)
        if not rows:
            run.status = "finished"
            run.finished_at = _utcnow()
            run.summary = {
                "file": file.filename,
                "trigger_mode": normalized_trigger_mode,
                "total": 0,
                "created": 0,
                "updated": 0,
                "failed": 0,
            }
            run.errors = []
            run.snapshot_data = []
            await db.commit()
            return {
                "run_id": run.id,
                "file": file.filename,
                "trigger_mode": normalized_trigger_mode,
                "total": 0,
                "created": 0,
                "updated": 0,
                "failed": 0,
                "errors": [],
            }

        categories_result = await db.execute(select(Category))
        categories = categories_result.scalars().all()
        category_by_slug = {category.slug.lower(): category.id for category in categories if category.slug}
        category_by_name = {category.name.lower(): category.id for category in categories if category.name}

        created = 0
        updated = 0

        for row_index, row in enumerate(rows, start=2):
            try:
                sku = row.get("sku", "").strip()
                name = row.get("name", "").strip()
                if not sku or not name:
                    collected_errors.append(f"Row {row_index}: 'sku' and 'name' are required.")
                    continue

                category_id: Optional[int] = None
                if row.get("category_id"):
                    category_id = _parse_optional_int(row["category_id"])
                elif row.get("category_slug"):
                    category_id = category_by_slug.get(row["category_slug"].strip().lower())
                elif row.get("category_name"):
                    category_id = category_by_name.get(row["category_name"].strip().lower())
                else:
                    category_id = default_category_id

                if not category_id:
                    collected_errors.append(f"Row {row_index}: category is required.")
                    continue

                payload = {
                    "category_id": category_id,
                    "oem": row.get("oem") or None,
                    "brand": row.get("brand") or None,
                    "name": name,
                    "description": row.get("description") or None,
                    "price": _parse_optional_float(row.get("price", "")),
                    "stock_quantity": _parse_optional_int(row.get("stock_quantity", "")) or 0,
                    "is_active": _parse_bool(row.get("is_active", ""), default=True),
                }

                existing_result = await db.execute(select(Product).where(Product.sku == sku))
                existing_product = existing_result.scalar_one_or_none()

                if existing_product:
                    for field, value in payload.items():
                        setattr(existing_product, field, value)
                    updated += 1
                else:
                    db.add(Product(sku=sku, **payload))
                    created += 1

            except ValueError as exc:
                collected_errors.append(f"Row {row_index}: {exc}")

        if collected_errors and not skip_invalid:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Import validation failed: {len(collected_errors)} row(s) contain errors. "
                    "Use skip_invalid=true to import valid rows only."
                ),
            )

        await db.flush()

        snapshot_result = await db.execute(
            select(Product)
            .options(selectinload(Product.images), selectinload(Product.compatibilities))
            .order_by(Product.id)
        )
        snapshot_data = []
        for product in snapshot_result.scalars().all():
            images = sorted(
                product.images or [],
                key=lambda image: (image.sort_order, image.id),
            )
            compatibilities = sorted(
                product.compatibilities or [],
                key=lambda compatibility: (
                    (compatibility.make or "").lower(),
                    (compatibility.model or "").lower(),
                    compatibility.year_from or 0,
                    compatibility.year_to or 0,
                    compatibility.id,
                ),
            )
            snapshot_data.append(
                {
                    "id": product.id,
                    "sku": product.sku,
                    "category_id": product.category_id,
                    "oem": product.oem,
                    "brand": product.brand,
                    "name": product.name,
                    "description": product.description,
                    "price": product.price,
                    "stock_quantity": product.stock_quantity,
                    "is_active": product.is_active,
                    "attributes": product.attributes or {},
                    "images": [
                        {
                            "id": image.id,
                            "url": image.url,
                            "sort_order": image.sort_order,
                            "is_main": image.is_main,
                        }
                        for image in images
                    ],
                    "compatibilities": [
                        {
                            "id": compatibility.id,
                            "make": compatibility.make,
                            "model": compatibility.model,
                            "year_from": compatibility.year_from,
                            "year_to": compatibility.year_to,
                            "engine": compatibility.engine,
                        }
                        for compatibility in compatibilities
                    ],
                    "updated_at": product.updated_at.isoformat() if product.updated_at else None,
                }
            )

        audit = AuditLog(
            user_id=current_user.id,
            action="import",
            entity_type="product",
            new_values={
                "run_id": run.id,
                "file": file.filename,
                "trigger_mode": normalized_trigger_mode,
                "skip_invalid": skip_invalid,
                "total": len(rows),
                "created": created,
                "updated": updated,
                "failed": len(collected_errors),
            },
        )
        db.add(audit)

        run.status = "finished"
        run.finished_at = _utcnow()
        run.summary = {
            "file": file.filename,
            "trigger_mode": normalized_trigger_mode,
            "total": len(rows),
            "created": created,
            "updated": updated,
            "failed": len(collected_errors),
        }
        run.errors = collected_errors[:500]
        run.snapshot_data = snapshot_data
        await db.commit()

        return {
            "run_id": run.id,
            "file": file.filename,
            "trigger_mode": normalized_trigger_mode,
            "total": len(rows),
            "created": created,
            "updated": updated,
            "failed": len(collected_errors),
            "errors": collected_errors[:100],
        }
    except HTTPException as http_exc:
        await db.rollback()
        if run_id is not None:
            failed_run = await db.get(ImportRun, run_id)
            if failed_run:
                failed_run.status = "failed"
                failed_run.finished_at = _utcnow()
                failed_run.errors = collected_errors[:500] + [str(http_exc.detail)]
                await db.commit()
        raise
    except Exception as exc:
        await db.rollback()
        if run_id is not None:
            failed_run = await db.get(ImportRun, run_id)
            if failed_run:
                failed_run.status = "failed"
                failed_run.finished_at = _utcnow()
                failed_run.errors = collected_errors[:500] + [str(exc)]
                await db.commit()
        raise HTTPException(status_code=500, detail="Import failed. Please check file format and data.") from exc


@router.get("/imports", response_model=List[dict])
async def admin_get_import_runs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    entity_type: Optional[str] = Query(None, description="Filter by import entity type"),
    status: Optional[str] = Query(None, description="Filter by import status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """List import runs for admin imports dashboard."""
    query = select(ImportRun)

    if entity_type:
        query = query.where(ImportRun.entity_type == entity_type.strip().lower())
    if status:
        query = query.where(ImportRun.status == status.strip().lower())

    query = query.order_by(ImportRun.started_at.desc(), ImportRun.id.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    runs = result.scalars().all()

    user_ids = {run.created_by for run in runs if run.created_by is not None}
    users_by_id = await _load_users_map(db, user_ids)

    return [_serialize_import_run(run, users_by_id) for run in runs]


@router.get("/imports/{run_id}", response_model=dict)
async def admin_get_import_run_details(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Get full import run details for admin view."""
    run = await db.get(ImportRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Import run not found")

    users_by_id = await _load_users_map(db, {run.created_by} if run.created_by is not None else set())
    counts = _extract_import_counts(run)

    errors_raw = run.errors if isinstance(run.errors, list) else []
    errors = [str(item) for item in errors_raw]

    snapshot_items = run.snapshot_data if isinstance(run.snapshot_data, list) else []
    sample_keys: list[str] = []
    if snapshot_items and isinstance(snapshot_items[0], dict):
        sample_keys = sorted(str(key) for key in snapshot_items[0].keys())

    previous = None
    if run.previous_successful_run_id is not None:
        previous_run = await db.get(ImportRun, run.previous_successful_run_id)
        if previous_run:
            previous = {
                "id": previous_run.id,
                "status": previous_run.status,
                "source": previous_run.source,
                "finished_at": previous_run.finished_at,
            }

    return {
        "id": run.id,
        "entity_type": run.entity_type,
        "status": run.status,
        "source": run.source,
        "started_at": run.started_at,
        "finished_at": run.finished_at,
        "created_by": run.created_by,
        "created_by_user": users_by_id.get(run.created_by) if run.created_by is not None else None,
        "total": counts["total"],
        "created": counts["created"],
        "updated": counts["updated"],
        "failed": counts["failed"],
        "summary": run.summary if isinstance(run.summary, dict) else {},
        "errors": errors,
        "errors_count": len(errors),
        "previous_successful_run": previous,
        "snapshot_metadata": {
            "items_count": len(snapshot_items),
            "has_snapshot": bool(snapshot_items),
            "sample_keys": sample_keys[:20],
        },
    }

# ---------- Categories ----------
@router.get("/categories", response_model=List[CategoryResponse])
async def admin_get_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_catalog_user)
):
    """Get all categories (admin)"""
    query = select(Category).order_by(Category.sort_order)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def admin_create_category(
    category: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_catalog_user)
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
        user_id=current_user.id,
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
    current_user: User = Depends(get_catalog_user)
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
    current_user: User = Depends(get_catalog_user)
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
        user_id=current_user.id,
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
        user_id=current_user.id,
        action="delete",
        entity_type="category",
        entity_id=category_id
    )
    db.add(audit)
    await db.commit()
    
    return None

# ---------- Service Requests ----------
@router.get("/service-catalog", response_model=List[ServiceCatalogItemResponse])
async def admin_get_service_catalog(
    include_inactive: bool = Query(False),
    vehicle_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_service_catalog_user),
):
    query = select(ServiceCatalogItem)
    if not include_inactive:
        query = query.where(ServiceCatalogItem.is_active.is_(True))

    if vehicle_type:
        normalized_vehicle_type = vehicle_type.strip().lower()
        if normalized_vehicle_type not in {"passenger", "truck", "both"}:
            raise HTTPException(status_code=400, detail="vehicle_type must be passenger, truck or both")
        query = query.where(ServiceCatalogItem.vehicle_type == normalized_vehicle_type)

    query = query.order_by(ServiceCatalogItem.sort_order.asc(), ServiceCatalogItem.id.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/service-catalog", response_model=ServiceCatalogItemResponse, status_code=201)
async def admin_create_service_catalog_item(
    payload: ServiceCatalogItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_service_catalog_user),
):
    create_data = payload.model_dump()
    if create_data["prepayment_required"]:
        if create_data.get("prepayment_amount") is None or create_data["prepayment_amount"] <= 0:
            raise HTTPException(status_code=400, detail="prepayment_amount must be > 0 when prepayment is required")
    else:
        create_data["prepayment_amount"] = None

    item = ServiceCatalogItem(**create_data)
    db.add(item)
    await db.commit()
    await db.refresh(item)

    audit = AuditLog(
        user_id=current_user.id,
        action="create",
        entity_type="service_catalog_item",
        entity_id=item.id,
        new_values=create_data,
    )
    db.add(audit)
    await db.commit()

    return item


@router.put("/service-catalog/{item_id}", response_model=ServiceCatalogItemResponse)
async def admin_update_service_catalog_item(
    item_id: int,
    payload: ServiceCatalogItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_service_catalog_user),
):
    result = await db.execute(select(ServiceCatalogItem).where(ServiceCatalogItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Service catalog item not found")

    update_data = payload.model_dump(exclude_unset=True)
    old_values = {
        "name": item.name,
        "vehicle_type": item.vehicle_type,
        "duration_minutes": item.duration_minutes,
        "price": item.price,
        "prepayment_required": item.prepayment_required,
        "prepayment_amount": item.prepayment_amount,
        "sort_order": item.sort_order,
        "is_active": item.is_active,
    }

    next_prepayment_required = update_data.get("prepayment_required", item.prepayment_required)
    next_prepayment_amount = update_data.get("prepayment_amount", item.prepayment_amount)
    if next_prepayment_required:
        if next_prepayment_amount is None or next_prepayment_amount <= 0:
            raise HTTPException(status_code=400, detail="prepayment_amount must be > 0 when prepayment is required")
    elif "prepayment_required" in update_data or "prepayment_amount" in update_data:
        update_data["prepayment_amount"] = None

    for key, value in update_data.items():
        setattr(item, key, value)
    item.updated_at = _utcnow()
    await db.commit()
    await db.refresh(item)

    audit = AuditLog(
        user_id=current_user.id,
        action="update",
        entity_type="service_catalog_item",
        entity_id=item.id,
        old_values=old_values,
        new_values=update_data,
    )
    db.add(audit)
    await db.commit()

    return item


@router.delete("/service-catalog/{item_id}", response_model=ServiceCatalogItemResponse)
async def admin_delete_service_catalog_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_service_catalog_user),
):
    result = await db.execute(select(ServiceCatalogItem).where(ServiceCatalogItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Service catalog item not found")

    old_values = {
        "is_active": item.is_active,
    }
    item.is_active = False
    item.updated_at = _utcnow()
    await db.commit()
    await db.refresh(item)

    audit = AuditLog(
        user_id=current_user.id,
        action="deactivate",
        entity_type="service_catalog_item",
        entity_id=item.id,
        old_values=old_values,
        new_values={"is_active": item.is_active},
    )
    db.add(audit)
    await db.commit()

    return item


@router.get("/service-requests", response_model=List[ServiceRequestResponse])
async def admin_get_service_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, min_length=2, description="Search by name or phone"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_service_requests_user),
):
    """Get service requests with filters"""
    query = select(ServiceRequest)

    if status:
        query = query.where(ServiceRequest.status == status.strip().lower())

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                ServiceRequest.phone.ilike(search_pattern),
                ServiceRequest.name.ilike(search_pattern),
            )
        )

    query = query.order_by(ServiceRequest.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/service-requests/{request_id}", response_model=ServiceRequestResponse)
async def admin_get_service_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_service_requests_user),
):
    """Get service request by ID"""
    result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == request_id))
    service_request = result.scalar_one_or_none()

    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")

    return service_request


@router.put("/service-requests/{request_id}/status", response_model=ServiceRequestResponse)
async def admin_update_service_request_status(
    request_id: int,
    payload: ServiceRequestStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_service_requests_user),
):
    """Update service request status and operator comment"""
    result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == request_id))
    service_request = result.scalar_one_or_none()

    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")

    valid_transitions = {
        "new": {"in_progress"},
        "in_progress": {"closed"},
        "closed": set(),
    }

    next_status = payload.status
    current_status = service_request.status or "new"
    if next_status != current_status and next_status not in valid_transitions.get(current_status, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition: {current_status} -> {next_status}",
        )

    old_values = {
        "status": current_status,
        "operator_comment": service_request.operator_comment,
    }

    service_request.status = next_status
    service_request.operator_comment = payload.operator_comment
    service_request.updated_at = _utcnow()
    await db.commit()
    await db.refresh(service_request)

    audit = AuditLog(
        user_id=current_user.id,
        action="update_status",
        entity_type="service_request",
        entity_id=request_id,
        old_values=old_values,
        new_values={
            "status": service_request.status,
            "operator_comment": service_request.operator_comment,
        },
    )
    db.add(audit)
    await db.commit()

    notify_event(
        "service_request.status_changed",
        {
            "id": service_request.id,
            "uuid": service_request.uuid,
            "old_status": current_status,
            "new_status": service_request.status,
            "phone": service_request.phone,
            "operator_comment": service_request.operator_comment,
            "updated_at": service_request.updated_at.isoformat() if service_request.updated_at else None,
        },
    )

    return service_request

# ---------- VIN Requests ----------
@router.get("/vin-requests", response_model=List[VinRequestResponse])
async def admin_get_vin_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, min_length=2, description="Search by VIN, phone, name, email"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_leads_user),
):
    """Get VIN requests with filters"""
    query = select(VinRequest)

    if status:
        query = query.where(VinRequest.status == status.strip().lower())

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                VinRequest.vin.ilike(search_pattern),
                VinRequest.phone.ilike(search_pattern),
                VinRequest.name.ilike(search_pattern),
                VinRequest.email.ilike(search_pattern),
            )
        )

    query = query.order_by(VinRequest.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/vin-requests/statuses", response_model=List[str])
async def admin_get_vin_request_statuses(
    current_user: User = Depends(get_leads_user),
):
    """Get VIN request statuses"""
    return ["new", "in_progress", "closed"]


@router.get("/vin-requests/{request_id}", response_model=VinRequestResponse)
async def admin_get_vin_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_leads_user),
):
    """Get VIN request by ID"""
    result = await db.execute(select(VinRequest).where(VinRequest.id == request_id))
    vin_request = result.scalar_one_or_none()

    if not vin_request:
        raise HTTPException(status_code=404, detail="VIN request not found")

    return vin_request


@router.put("/vin-requests/{request_id}/status", response_model=VinRequestResponse)
async def admin_update_vin_request_status(
    request_id: int,
    payload: VinRequestStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_leads_user),
):
    """Update VIN request status and operator comment"""
    result = await db.execute(select(VinRequest).where(VinRequest.id == request_id))
    vin_request = result.scalar_one_or_none()

    if not vin_request:
        raise HTTPException(status_code=404, detail="VIN request not found")

    valid_transitions = {
        "new": {"in_progress"},
        "in_progress": {"closed"},
        "closed": set(),
    }

    next_status = payload.status
    current_status = vin_request.status or "new"
    if next_status != current_status and next_status not in valid_transitions.get(current_status, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition: {current_status} -> {next_status}",
        )

    old_values = {
        "status": current_status,
        "operator_comment": vin_request.operator_comment,
    }

    vin_request.status = next_status
    vin_request.operator_comment = payload.operator_comment
    vin_request.updated_at = _utcnow()
    await db.commit()
    await db.refresh(vin_request)

    audit = AuditLog(
        user_id=current_user.id,
        action="update_status",
        entity_type="vin_request",
        entity_id=request_id,
        old_values=old_values,
        new_values={
            "status": vin_request.status,
            "operator_comment": vin_request.operator_comment,
        },
    )
    db.add(audit)
    await db.commit()

    notify_event(
        "vin_request.status_changed",
        {
            "id": vin_request.id,
            "uuid": vin_request.uuid,
            "old_status": current_status,
            "new_status": vin_request.status,
            "vin": vin_request.vin,
            "phone": vin_request.phone,
            "operator_comment": vin_request.operator_comment,
            "updated_at": vin_request.updated_at.isoformat() if vin_request.updated_at else None,
        },
    )

    return vin_request

# ---------- Site Content ----------
@router.get("/content", response_model=List[SiteContentResponse])
async def admin_get_content(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_content_user)
):
    """Get all site content blocks"""
    query = select(SiteContent).order_by(SiteContent.key)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/content/{key}", response_model=SiteContentResponse)
async def admin_get_content_by_key(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_content_user)
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
    current_user: User = Depends(get_content_user)
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
        user_id=current_user.id,
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
    current_user: User = Depends(get_content_user)
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
        user_id=current_user.id,
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
    current_user: User = Depends(get_content_user),
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
        user_id=current_user.id,
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
    current_user: User = Depends(get_content_user)
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
        user_id=current_user.id,
        action="upload",
        entity_type="file",
        new_values={"filename": filename, "url": file_url}
    )
    db.add(audit)
    await db.commit()
    
    return {"url": file_url, "filename": filename}


# ---------- Orders ----------
@router.get("/orders", response_model=List[OrderResponse])
async def admin_get_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, min_length=2, description="Search by phone, name, email, order UUID"),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_orders_user),
):
    """Get all orders with filters."""
    query = select(Order).options(selectinload(Order.items))
    date_from_dt: Optional[datetime] = None
    date_to_dt: Optional[datetime] = None

    if status:
        query = query.where(Order.status == status.strip().lower())

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Order.customer_phone.ilike(search_pattern),
                Order.customer_name.ilike(search_pattern),
                Order.customer_email.ilike(search_pattern),
                Order.uuid.ilike(search_pattern),
                Order.legal_entity_inn.ilike(search_pattern),
            )
        )

    if date_from:
        try:
            date_from_dt = datetime.strptime(date_from.strip(), "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="date_from must be in YYYY-MM-DD format") from exc

    if date_to:
        try:
            date_to_dt = datetime.strptime(date_to.strip(), "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="date_to must be in YYYY-MM-DD format") from exc

    if date_from_dt and date_to_dt and date_from_dt > date_to_dt:
        raise HTTPException(status_code=400, detail="date_from must be less than or equal to date_to")

    if date_from_dt:
        query = query.where(Order.created_at >= date_from_dt)
    if date_to_dt:
        query = query.where(Order.created_at < date_to_dt + timedelta(days=1))

    query = query.order_by(Order.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def admin_get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_orders_user),
):
    """Get single order by ID."""
    query = select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.put("/orders/{order_id}/status", response_model=OrderResponse)
async def admin_update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_orders_user),
):
    """Update order status and manager comment."""
    query = select(Order).where(Order.id == order_id)
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    next_status = payload.status.strip().lower()
    current_status = order.status or "new"
    if next_status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Unknown status: {next_status}")

    if next_status != current_status and next_status not in ORDER_VALID_TRANSITIONS.get(current_status, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition: {current_status} -> {next_status}",
        )

    old_values = {
        "status": current_status,
        "manager_comment": order.manager_comment,
    }

    order.status = next_status
    if payload.manager_comment is not None:
        order.manager_comment = payload.manager_comment
    order.updated_at = _utcnow()
    await db.commit()

    audit = AuditLog(
        user_id=current_user.id,
        action="update_order_status",
        entity_type="order",
        entity_id=order_id,
        old_values=old_values,
        new_values={"status": order.status, "manager_comment": order.manager_comment},
    )
    db.add(audit)
    await db.commit()

    result = await db.execute(select(Order).options(selectinload(Order.items)).where(Order.id == order_id))
    updated_order = result.scalar_one()

    notify_event(
        "order.status_changed",
        {
            "id": updated_order.id,
            "uuid": updated_order.uuid,
            "old_status": current_status,
            "new_status": updated_order.status,
            "customer_phone": updated_order.customer_phone,
            "manager_comment": updated_order.manager_comment,
            "updated_at": updated_order.updated_at.isoformat() if updated_order.updated_at else None,
        },
    )
    return updated_order


@router.get("/orders/statuses", response_model=List[str])
async def admin_get_order_statuses(
    current_user: User = Depends(get_orders_user),
):
    """Get all possible order statuses."""
    return ORDER_STATUSES

# ---------- Leads ----------
@router.get("/leads", response_model=List[LeadResponse])
async def admin_get_leads(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    type: Optional[str] = Query(None, description="Filter by lead type"),
    search: Optional[str] = Query(None, min_length=2, description="Search in phone, name, email"),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_leads_user)
):
    """Get all leads with filters"""
    query = select(Lead)
    date_from_dt: Optional[datetime] = None
    date_to_dt: Optional[datetime] = None
    
    if status:
        query = query.where(Lead.status == status.strip().lower())
    if type:
        normalized_type = type.strip().lower()
        if normalized_type in {"product inquiry", "product_inquiry"}:
            normalized_type = "product"
        query = query.where(Lead.type == normalized_type)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Lead.phone.ilike(search_pattern),
                Lead.name.ilike(search_pattern),
                Lead.email.ilike(search_pattern),
                Lead.vin.ilike(search_pattern),
                Lead.product_sku.ilike(search_pattern),
                Lead.message.ilike(search_pattern),
            )
        )
    if date_from:
        try:
            date_from_dt = datetime.strptime(date_from.strip(), "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="date_from must be in YYYY-MM-DD format") from exc

    if date_to:
        try:
            date_to_dt = datetime.strptime(date_to.strip(), "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="date_to must be in YYYY-MM-DD format") from exc

    if date_from_dt and date_to_dt and date_from_dt > date_to_dt:
        raise HTTPException(status_code=400, detail="date_from must be less than or equal to date_to")

    if date_from_dt:
        query = query.where(Lead.created_at >= date_from_dt)
    if date_to_dt:
        query = query.where(Lead.created_at < date_to_dt + timedelta(days=1))
    
    query = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/leads/{lead_id}", response_model=LeadResponse)
async def admin_get_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_leads_user)
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
    current_user: User = Depends(get_leads_user)
):
    """Update lead status"""
    query = select(Lead).where(Lead.id == lead_id)
    result = await db.execute(query)
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    next_status = status.strip().lower()
    if next_status not in LEAD_STATUSES:
        raise HTTPException(status_code=400, detail=f"Unknown status: {next_status}")

    current_status = lead.status or "new"
    if next_status != current_status and next_status not in LEAD_VALID_TRANSITIONS.get(current_status, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition: {current_status} -> {next_status}",
        )

    normalized_comment = None
    if comment is not None:
        normalized_comment = comment.strip() or None

    old_values = {
        "status": current_status,
        "manager_comment": lead.manager_comment,
    }

    lead.status = next_status
    if comment is not None:
        lead.manager_comment = normalized_comment
    lead.updated_at = _utcnow()
    
    await db.commit()
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="update_status",
        entity_type="lead",
        entity_id=lead_id,
        old_values=old_values,
        new_values={"status": lead.status, "manager_comment": lead.manager_comment},
    )
    db.add(audit)
    await db.commit()

    notify_event(
        "lead.status_changed",
        {
            "id": lead.id,
            "uuid": lead.uuid,
            "type": lead.type,
            "old_status": current_status,
            "new_status": lead.status,
            "phone": lead.phone,
            "manager_comment": lead.manager_comment,
            "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
        },
    )
    
    return {"status": "updated", "new_status": lead.status, "manager_comment": lead.manager_comment}

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
        user_id=current_user.id,
        action="delete",
        entity_type="lead",
        entity_id=lead_id
    )
    db.add(audit)
    await db.commit()
    
    return None

@router.get("/leads/statuses", response_model=List[str])
async def admin_get_lead_statuses(
    current_user: User = Depends(get_leads_user)
):
    """Get all possible lead statuses"""
    return LEAD_STATUSES
