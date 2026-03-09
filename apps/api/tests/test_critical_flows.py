import os
from pathlib import Path
import sys
from types import SimpleNamespace
import json
import io
import zipfile

from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import pytest
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request

os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-32-bytes-minimum-key")
sys.path.append(str(Path(__file__).resolve().parents[1]))

import main as app_main  # noqa: E402
import notifications  # noqa: E402
from models import AuditLog, ImportRun  # noqa: E402
from routers import admin, public  # noqa: E402
from schemas import LeadCreate, OrderCreate, ServiceRequestCreate, VinRequestCreate  # noqa: E402


class _ScalarsResult:
    def __init__(self, values):
        self._values = values

    def all(self):
        return list(self._values)


class _ExecResult:
    def __init__(self, scalar=None, scalars=None, rows=None):
        self._scalar = scalar
        self._scalars = [] if scalars is None else scalars
        self._rows = [] if rows is None else rows

    def scalar_one_or_none(self):
        return self._scalar

    def scalar_one(self):
        if self._scalar is None:
            raise AssertionError("scalar value is required")
        return self._scalar

    def scalars(self):
        return _ScalarsResult(self._scalars)

    def all(self):
        return list(self._rows)


class FakeAsyncSession:
    def __init__(self):
        self.added = []
        self._execute_calls = 0
        self._runs_by_id = {}
        self._next_id = 1

    def add(self, obj):
        self.added.append(obj)

    async def execute(self, _query):
        self._execute_calls += 1
        if self._execute_calls == 1:
            # previous successful import run
            return _ExecResult(scalar=None)
        if self._execute_calls == 2:
            # categories list
            return _ExecResult(scalars=[])
        if self._execute_calls == 3:
            # snapshot select
            return _ExecResult(scalars=[])
        return _ExecResult(scalar=None, scalars=[])

    async def commit(self):
        return None

    async def flush(self):
        return None

    async def rollback(self):
        return None

    async def refresh(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = self._next_id
            self._next_id += 1
        if isinstance(obj, ImportRun):
            self._runs_by_id[obj.id] = obj

    async def get(self, model, obj_id):
        if model is ImportRun:
            return self._runs_by_id.get(obj_id)
        return None


class FakeUploadFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self._content = content

    async def read(self) -> bytes:
        return self._content


def _make_request(path: str) -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": path,
        "headers": [(b"user-agent", b"pytest")],
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("testserver", 80),
        "query_string": b"",
    }
    return Request(scope)


def _make_request_with_headers(path: str, method: str, headers: dict[str, str]) -> Request:
    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "headers": [(key.lower().encode("utf-8"), value.encode("utf-8")) for key, value in headers.items()],
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("testserver", 80),
        "query_string": b"",
    }
    return Request(scope)


@pytest.mark.asyncio
async def test_public_create_lead_success():
    public._rate_limit_buckets.clear()
    db = FakeAsyncSession()
    payload = LeadCreate(type="callback", phone="8 (999) 111-22-33", consent_given=True)

    lead = await public.create_lead(payload, _make_request("/api/public/leads"), db)

    assert lead.status == "new"
    assert lead.phone == "+79991112233"
    assert lead.consent_given is True
    assert lead.consent_at is not None


@pytest.mark.asyncio
async def test_public_create_service_request_success_and_audit():
    public._rate_limit_buckets.clear()
    db = FakeAsyncSession()
    payload = ServiceRequestCreate(
        vehicle_type="passenger",
        service_type="Диагностика",
        name="Иван",
        phone="8 999 111 22 33",
        description="Стук в подвеске",
        consent_given=True,
    )

    request_obj = await public.create_service_request(payload, _make_request("/api/public/service-requests"), db)

    assert request_obj.status == "new"
    assert request_obj.phone == "+79991112233"
    assert request_obj.consent_at is not None
    assert any(isinstance(item, AuditLog) and item.entity_type == "service_request" for item in db.added)


@pytest.mark.asyncio
async def test_public_create_vin_request_success_and_audit():
    public._rate_limit_buckets.clear()
    db = FakeAsyncSession()
    payload = VinRequestCreate(
        vin="XTA210930Y1234567",
        phone="8(999)1112233",
        consent_given=True,
    )

    request_obj = await public.create_vin_request(payload, _make_request("/api/public/vin-requests"), db)

    assert request_obj.status == "new"
    assert request_obj.phone == "+79991112233"
    assert request_obj.consent_at is not None
    assert any(isinstance(item, AuditLog) and item.entity_type == "vin_request" for item in db.added)


@pytest.mark.asyncio
async def test_rbac_allows_and_denies_roles():
    guard = admin.require_roles("admin", "manager")

    allowed_user = SimpleNamespace(role="manager", is_active=True)
    denied_user = SimpleNamespace(role="service_manager", is_active=True)

    assert await guard(current_user=allowed_user) is allowed_user

    with pytest.raises(HTTPException) as denied_exc:
        await guard(current_user=denied_user)
    assert denied_exc.value.status_code == 403


@pytest.mark.asyncio
async def test_import_products_strict_rejects_invalid_rows(monkeypatch):
    db = FakeAsyncSession()
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)

    monkeypatch.setattr(admin, "_parse_import_rows", lambda _name, _content: [{"sku": "", "name": ""}])

    upload = FakeUploadFile(filename="products.csv", content=b"sku,name\n,\n")

    with pytest.raises(HTTPException) as exc:
        await admin.admin_import_products(
            file=upload,
            default_category_id=1,
            skip_invalid=False,
            db=db,
            current_user=current_user,
        )

    assert exc.value.status_code == 400
    assert "skip_invalid=true" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_import_products_skip_invalid_allows_completion(monkeypatch):
    db = FakeAsyncSession()
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)

    monkeypatch.setattr(admin, "_parse_import_rows", lambda _name, _content: [{"sku": "", "name": ""}])

    upload = FakeUploadFile(filename="products.csv", content=b"sku,name\n,\n")
    result = await admin.admin_import_products(
        file=upload,
        default_category_id=1,
        skip_invalid=True,
        db=db,
        current_user=current_user,
    )

    assert result["failed"] == 1
    assert result["created"] == 0
    assert result["updated"] == 0


@pytest.mark.asyncio
async def test_import_products_accepts_trigger_mode(monkeypatch):
    db = FakeAsyncSession()
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)

    monkeypatch.setattr(admin, "_parse_import_rows", lambda _name, _content: [])

    upload = FakeUploadFile(filename="products.csv", content=b"sku,name\n")
    result = await admin.admin_import_products(
        file=upload,
        default_category_id=1,
        skip_invalid=False,
        trigger_mode="daily",
        db=db,
        current_user=current_user,
    )

    assert result["trigger_mode"] == "daily"


@pytest.mark.asyncio
async def test_import_products_rejects_invalid_trigger_mode(monkeypatch):
    db = FakeAsyncSession()
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)

    monkeypatch.setattr(admin, "_parse_import_rows", lambda _name, _content: [])

    upload = FakeUploadFile(filename="products.csv", content=b"sku,name\n")
    with pytest.raises(HTTPException) as exc:
        await admin.admin_import_products(
            file=upload,
            default_category_id=1,
            skip_invalid=False,
            trigger_mode="weekly",
            db=db,
            current_user=current_user,
        )

    assert exc.value.status_code == 400
    assert "trigger_mode must be one of" in str(exc.value.detail)


def test_admin_csrf_validation_accepts_matching_cookie_and_header():
    request = _make_request_with_headers(
        "/api/admin/leads",
        "POST",
        {
            "cookie": "admin_csrf_token=test-csrf-token",
            "x-csrf-token": "test-csrf-token",
        },
    )

    admin._validate_csrf(request)


def test_admin_csrf_validation_rejects_missing_or_invalid_header():
    request = _make_request_with_headers(
        "/api/admin/leads",
        "POST",
        {
            "cookie": "admin_csrf_token=test-csrf-token",
            "x-csrf-token": "wrong-token",
        },
    )

    with pytest.raises(HTTPException) as exc:
        admin._validate_csrf(request)

    assert exc.value.status_code == 403
    assert "CSRF token is missing or invalid" in str(exc.value.detail)


def test_snapshot_product_normalization_keeps_compatibilities():
    normalized = public._normalize_snapshot_product(
        {
            "id": 10,
            "category_id": 3,
            "sku": "SKU-10",
            "name": "Тестовый товар",
            "is_active": True,
            "compatibilities": [
                {
                    "id": 77,
                    "make": "GAZ",
                    "model": "GAZelle",
                    "year_from": 2014,
                    "year_to": 2024,
                    "engine": "Cummins",
                }
            ],
        }
    )

    assert normalized is not None
    assert normalized["compatibilities"] == [
        {
            "id": 77,
            "make": "GAZ",
            "model": "GAZelle",
            "year_from": 2014,
            "year_to": 2024,
            "engine": "Cummins",
        }
    ]


def test_snapshot_vehicle_filters_match_compatibilities():
    products = [
        {
            "id": 1,
            "category_id": 1,
            "sku": "SKU-1",
            "name": "Совместимый товар",
            "is_active": True,
            "compatibilities": [
                {
                    "make": "kamaz",
                    "model": "6520",
                    "year_from": 2018,
                    "year_to": 2025,
                    "engine": "diesel",
                }
            ],
        },
        {
            "id": 2,
            "category_id": 1,
            "sku": "SKU-2",
            "name": "Несовместимый товар",
            "is_active": True,
            "compatibilities": [],
        },
    ]

    filtered = public._apply_snapshot_filters(
        products,
        vehicle_make="KAMAZ",
        vehicle_model="6520",
        vehicle_year=2020,
        vehicle_engine="diesel",
    )

    assert [item["id"] for item in filtered] == [1]


@pytest.mark.asyncio
async def test_public_create_order_invoice_requires_legal_entity_inn():
    public._rate_limit_buckets.clear()
    db = FakeAsyncSession()
    payload = OrderCreate(
        source="checkout",
        customer_phone="+79991112233",
        payment_method="invoice",
        consent_given=True,
        items=[{"product_name": "Тест", "quantity": 1}],
    )

    with pytest.raises(HTTPException) as exc:
        await public.create_order(payload, _make_request("/api/public/orders"), db)

    assert exc.value.status_code == 400
    assert "INN" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_public_upload_order_requisites_rejects_invalid_extension(tmp_path):
    public._rate_limit_buckets.clear()
    original_dir = public.ORDER_REQUISITES_UPLOAD_DIR
    public.ORDER_REQUISITES_UPLOAD_DIR = tmp_path
    public.ORDER_REQUISITES_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    upload = FakeUploadFile(filename="requisites.exe", content=b"MZ")

    try:
        with pytest.raises(HTTPException) as exc:
            await public.upload_order_requisites_file(
                _make_request("/api/public/orders/requisites-upload"),
                upload,
                FakeAsyncSession(),
            )
    finally:
        public.ORDER_REQUISITES_UPLOAD_DIR = original_dir

    assert exc.value.status_code == 400
    assert "PDF" in str(exc.value.detail)


def test_notifications_validate_webhook_url_allows_allowlisted_host():
    allowed_hosts = {"example.com"}

    validated_primary = notifications._validate_webhook_url("https://example.com/hook", allowed_hosts)
    validated_subdomain = notifications._validate_webhook_url("https://api.example.com/hook", allowed_hosts)

    assert validated_primary == "https://example.com/hook"
    assert validated_subdomain == "https://api.example.com/hook"


def test_notifications_validate_webhook_url_rejects_invalid_scheme_and_host():
    with pytest.raises(ValueError):
        notifications._validate_webhook_url("file:///tmp/payload", {"example.com"})

    with pytest.raises(ValueError):
        notifications._validate_webhook_url("https://evil.example.org/hook", {"example.com"})


def test_admin_parse_import_rows_rejects_oversized_content(monkeypatch):
    monkeypatch.setattr(admin, "PRODUCT_IMPORT_MAX_BYTES", 10)

    with pytest.raises(HTTPException) as exc:
        admin._parse_import_rows("products.csv", b"01234567890")

    assert exc.value.status_code == 400
    assert "exceeds" in str(exc.value.detail)


def test_admin_parse_import_rows_rejects_unknown_extension():
    with pytest.raises(HTTPException) as exc:
        admin._parse_import_rows("products.txt", b"sku,name\n")

    assert exc.value.status_code == 400
    assert "CSV and XLSX" in str(exc.value.detail)


class _AuthSession:
    async def execute(self, _query):
        return _ExecResult(scalar=SimpleNamespace(id=42, role="admin", is_active=True))


@pytest.mark.asyncio
async def test_admin_get_current_user_accepts_bearer_token():
    token = admin.create_access_token({"sub": "42"})
    request = _make_request("/api/admin/auth/me")

    user = await admin.get_current_user(request=request, token=token, db=_AuthSession())

    assert user.id == 42
    assert request.state.auth_source == "bearer"


@pytest.mark.asyncio
async def test_admin_get_current_user_rejects_cookie_without_csrf_header():
    token = admin.create_access_token({"sub": "42"})
    request = _make_request_with_headers(
        "/api/admin/leads",
        "POST",
        {"cookie": f"admin_session={token}"},
    )

    with pytest.raises(HTTPException) as exc:
        await admin.get_current_user(request=request, token=None, db=_AuthSession())

    assert exc.value.status_code == 403


def test_main_origin_and_error_helpers(monkeypatch):
    monkeypatch.setenv("WEB_ORIGIN", " https://example.ru/ , invalid , http://localhost:3000 ")

    origins = app_main._load_allowed_origins()

    assert origins == ["https://example.ru", "http://localhost:3000"]
    assert app_main._normalize_origin("https://domain.tld/") == "https://domain.tld"
    assert app_main._normalize_origin("ftp://domain.tld") is None
    assert app_main._error_detail_with_trace("", "trace-1") == "Код: trace-1"
    assert app_main._error_detail_with_trace("Ошибка", "trace-1") == "Ошибка Код: trace-1"


def test_main_error_response_contract():
    response = app_main._error_response(400, "bad_request", "Некорректный запрос", "trace-123")
    payload = json.loads(response.body.decode("utf-8"))

    assert response.status_code == 400
    assert response.headers["X-Request-Id"] == "trace-123"
    assert payload["error"]["code"] == "bad_request"
    assert payload["error"]["trace_id"] == "trace-123"
    assert "Код: trace-123" in payload["detail"]


@pytest.mark.asyncio
async def test_main_http_exception_handler_keeps_trace_id():
    request = _make_request("/missing")
    request.state.trace_id = "trace-http-1"

    response = await app_main.http_exception_handler(
        request,
        StarletteHTTPException(status_code=404, detail="Не найдено"),
    )
    payload = json.loads(response.body.decode("utf-8"))

    assert response.status_code == 404
    assert payload["error"]["trace_id"] == "trace-http-1"


@pytest.mark.asyncio
async def test_main_validation_and_unhandled_exception_handlers():
    request = _make_request("/api/public/orders")
    request.state.trace_id = "trace-handler-1"

    validation_response = await app_main.validation_exception_handler(
        request,
        RequestValidationError(
            [{"type": "missing", "loc": ("body", "phone"), "msg": "Field required", "input": None}]
        ),
    )
    validation_payload = json.loads(validation_response.body.decode("utf-8"))
    assert validation_response.status_code == 422
    assert validation_payload["error"]["code"] == "validation_error"

    unhandled_response = await app_main.unhandled_exception_handler(request, RuntimeError("boom"))
    unhandled_payload = json.loads(unhandled_response.body.decode("utf-8"))
    assert unhandled_response.status_code == 500
    assert unhandled_payload["error"]["code"] == "internal_error"


@pytest.mark.asyncio
async def test_main_health_and_ready_endpoints(monkeypatch):
    async def _db_ready_true():
        return True

    async def _db_ready_false():
        return False

    monkeypatch.setattr(app_main, "_is_database_ready", _db_ready_true)
    assert await app_main.api_health_check() == {"ok": True, "database": "ok"}
    assert await app_main.api_ready_check() == {"ok": True, "ready": True, "database": "ok"}

    monkeypatch.setattr(app_main, "_is_database_ready", _db_ready_false)
    health_down = await app_main.api_health_check()
    ready_down = await app_main.api_ready_check()

    assert isinstance(health_down, JSONResponse)
    assert isinstance(ready_down, JSONResponse)
    assert health_down.status_code == 503
    assert ready_down.status_code == 503


@pytest.mark.asyncio
async def test_main_security_headers_middleware_sets_required_headers():
    request = _make_request_with_headers(
        "/api/public/content",
        "GET",
        {
            "x-request-id": "trace-header-1",
            "x-forwarded-proto": "https",
        },
    )

    async def _next(_request: Request) -> JSONResponse:
        return JSONResponse(status_code=200, content={"ok": True})

    response = await app_main.add_security_headers(request, _next)

    assert response.status_code == 200
    assert response.headers["X-Request-Id"] == "trace-header-1"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "Strict-Transport-Security" in response.headers


@pytest.mark.asyncio
async def test_public_upload_order_requisites_accepts_valid_pdf(tmp_path):
    public._rate_limit_buckets.clear()
    original_dir = public.ORDER_REQUISITES_UPLOAD_DIR
    public.ORDER_REQUISITES_UPLOAD_DIR = tmp_path
    public.ORDER_REQUISITES_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    upload = FakeUploadFile(filename="requisites.pdf", content=b"%PDF-1.7\nTest")

    try:
        response = await public.upload_order_requisites_file(
            _make_request("/api/public/orders/requisites-upload"),
            upload,
            FakeAsyncSession(),
        )
    finally:
        public.ORDER_REQUISITES_UPLOAD_DIR = original_dir

    saved_name = response.url.rsplit("/", 1)[-1]
    assert response.url.startswith("/uploads/order-requisites/")
    assert response.filename == "requisites.pdf"
    assert response.size_bytes > 0
    assert (tmp_path / saved_name).is_file()


def test_public_resolve_invoice_requisites_path_rejects_invalid_prefix():
    with pytest.raises(HTTPException) as exc:
        public._resolve_invoice_requisites_path("/uploads/not-allowed/file.pdf")

    assert exc.value.status_code == 400
    assert "Недопустимый путь" in str(exc.value.detail)


def test_public_apply_snapshot_search_blank_query_sorts_by_id():
    products = [
        {"id": 5, "name": "B", "sku": "B-1", "oem": "", "brand": ""},
        {"id": 2, "name": "A", "sku": "A-1", "oem": "", "brand": ""},
    ]

    filtered = public._apply_snapshot_search(products, "   ")
    assert [item["id"] for item in filtered] == [2, 5]


def _build_minimal_xlsx(*, worksheet_target: str = "worksheets/sheet1.xml") -> bytes:
    workbook_xml = """<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
"""
    rels_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="{worksheet_target}"/>
</Relationships>
"""
    worksheet_xml = """<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>sku</t></is></c>
      <c r="B1" t="inlineStr"><is><t>name</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>SKU-TEST</t></is></c>
      <c r="B2" t="inlineStr"><is><t>Тестовый товар</t></is></c>
    </row>
  </sheetData>
</worksheet>
"""

    payload = io.BytesIO()
    with zipfile.ZipFile(payload, mode="w") as archive:
        archive.writestr("xl/workbook.xml", workbook_xml)
        archive.writestr("xl/_rels/workbook.xml.rels", rels_xml)
        archive.writestr("xl/worksheets/sheet1.xml", worksheet_xml)
    return payload.getvalue()


def test_admin_extract_xlsx_rows_parses_valid_file():
    rows = admin._extract_xlsx_rows(_build_minimal_xlsx())

    assert len(rows) == 1
    assert rows[0]["sku"] == "SKU-TEST"
    assert rows[0]["name"] == "Тестовый товар"


def test_admin_extract_xlsx_rows_rejects_unsafe_worksheet_target():
    with pytest.raises(HTTPException) as exc:
        admin._extract_xlsx_rows(_build_minimal_xlsx(worksheet_target="../evil.xml"))

    assert exc.value.status_code == 400
    assert "Invalid XLSX worksheet target" in str(exc.value.detail)


def test_admin_parse_import_compatibilities_extracts_year_engine_and_dedupes():
    value = "KAMAZ 6520 2018-2022 (6.7);\nKAMAZ 6520 2018-2022 (6.7); GAZelle Next 2021"
    compatibilities, raw = admin._parse_import_compatibilities(value)

    assert raw == value
    assert len(compatibilities) == 2
    assert compatibilities[0]["make"] == "KAMAZ"
    assert compatibilities[0]["model"] == "6520"
    assert compatibilities[0]["year_from"] == 2018
    assert compatibilities[0]["year_to"] == 2022
    assert compatibilities[0]["engine"] == "6.7"


def test_admin_import_helpers_parse_trigger_stock_and_prices():
    assert admin._normalize_import_trigger_mode("hourly") == "hourly"
    assert admin._parse_stock_quantity("10-100") == 10
    assert admin._parse_stock_quantity(">100") == 100
    assert admin._parse_optional_float("1 234,50") == 1234.5
    assert admin._parse_optional_float("по запросу") is None

    with pytest.raises(HTTPException):
        admin._normalize_import_trigger_mode("weekly")


class _OrderSession(FakeAsyncSession):
    def __init__(self):
        super().__init__()
        self._created_order = None

    async def flush(self):
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                obj.id = self._next_id
                self._next_id += 1
            if obj.__class__.__name__ == "Order":
                self._created_order = obj

    async def execute(self, _query):
        if self._created_order is not None:
            self._created_order.items = [
                item for item in self.added if item.__class__.__name__ == "OrderItem"
            ]
            return _ExecResult(scalar=self._created_order)
        return _ExecResult(scalar=None)


@pytest.mark.asyncio
async def test_public_create_order_one_click_success_without_invoice():
    public._rate_limit_buckets.clear()
    db = _OrderSession()
    payload = OrderCreate(
        source="one_click",
        customer_phone="+79991112233",
        payment_method="cash_on_delivery",
        consent_given=True,
        items=[],
    )

    created_order = await public.create_order(payload, _make_request("/api/public/orders"), db)

    assert created_order.status == "new"
    assert created_order.invoice_requisites_file_url is None
    assert created_order.invoice_requisites_file_name is None


class _OrdersReadSession:
    def __init__(self, rows):
        self._rows = rows
        self.execute_calls = 0

    async def execute(self, _query):
        self.execute_calls += 1
        return _ExecResult(scalars=self._rows)


@pytest.mark.asyncio
async def test_admin_get_orders_returns_rows_for_valid_filters():
    db = _OrdersReadSession([SimpleNamespace(id=101), SimpleNamespace(id=102)])
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)

    result = await admin.admin_get_orders(
        skip=0,
        limit=50,
        status=" NEW ",
        search="7999",
        date_from="2026-03-01",
        date_to="2026-03-05",
        db=db,
        current_user=current_user,
    )

    assert [item.id for item in result] == [101, 102]
    assert db.execute_calls == 1


@pytest.mark.asyncio
async def test_admin_get_orders_rejects_invalid_dates():
    db = _OrdersReadSession([])
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)

    with pytest.raises(HTTPException) as invalid_date_exc:
        await admin.admin_get_orders(
            skip=0,
            limit=50,
            status=None,
            search=None,
            date_from="2026/03/01",
            date_to=None,
            db=db,
            current_user=current_user,
        )

    assert invalid_date_exc.value.status_code == 400
    assert "date_from must be in YYYY-MM-DD format" in str(invalid_date_exc.value.detail)

    with pytest.raises(HTTPException) as invalid_range_exc:
        await admin.admin_get_orders(
            skip=0,
            limit=50,
            status=None,
            search=None,
            date_from="2026-03-10",
            date_to="2026-03-01",
            db=db,
            current_user=current_user,
        )

    assert invalid_range_exc.value.status_code == 400
    assert "date_from must be less than or equal to date_to" in str(invalid_range_exc.value.detail)


class _ImportRunDetailsSession:
    def __init__(self, runs_by_id: dict[int, ImportRun], users_by_id: dict[int, str]):
        self._runs_by_id = runs_by_id
        self._users_by_id = users_by_id

    async def get(self, model, obj_id):
        if model is ImportRun:
            return self._runs_by_id.get(obj_id)
        return None

    async def execute(self, _query):
        return _ExecResult(rows=[(user_id, email) for user_id, email in self._users_by_id.items()])


@pytest.mark.asyncio
async def test_admin_get_import_run_details_returns_enriched_payload():
    previous_run = ImportRun(
        id=10,
        entity_type="products",
        status="finished",
        source="daily:products.csv",
    )
    current_run = ImportRun(
        id=11,
        entity_type="products",
        status="failed",
        source="manual:products.csv",
        summary={"total": "4", "created": "1", "updated": "2", "failed": "1"},
        errors=["Row 2: bad sku", 123],
        snapshot_data=[{"id": 1, "sku": "SKU-1", "name": "Test"}],
        created_by=7,
        previous_successful_run_id=10,
    )
    db = _ImportRunDetailsSession(
        runs_by_id={10: previous_run, 11: current_run},
        users_by_id={7: "admin@example.com"},
    )
    current_user = SimpleNamespace(id=7, role="admin", is_active=True)

    payload = await admin.admin_get_import_run_details(run_id=11, db=db, current_user=current_user)

    assert payload["id"] == 11
    assert payload["created_by_user"] == "admin@example.com"
    assert payload["total"] == 4
    assert payload["created"] == 1
    assert payload["updated"] == 2
    assert payload["failed"] == 1
    assert payload["errors"] == ["Row 2: bad sku", "123"]
    assert payload["errors_count"] == 2
    assert payload["previous_successful_run"]["id"] == 10
    assert payload["snapshot_metadata"]["items_count"] == 1
    assert "sku" in payload["snapshot_metadata"]["sample_keys"]


@pytest.mark.asyncio
async def test_admin_get_import_run_details_returns_404_for_unknown_run():
    db = _ImportRunDetailsSession(runs_by_id={}, users_by_id={})
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)

    with pytest.raises(HTTPException) as exc:
        await admin.admin_get_import_run_details(run_id=404, db=db, current_user=current_user)

    assert exc.value.status_code == 404


class _ImportRunsSession:
    def __init__(self, runs: list[ImportRun], users_rows: list[tuple[int, str]]):
        self._runs = runs
        self._users_rows = users_rows
        self._execute_calls = 0

    async def execute(self, _query):
        self._execute_calls += 1
        if self._execute_calls == 1:
            return _ExecResult(scalars=self._runs)
        return _ExecResult(rows=self._users_rows)


@pytest.mark.asyncio
async def test_admin_get_import_runs_returns_serialized_items():
    run = ImportRun(
        id=21,
        entity_type="products",
        status="finished",
        source="manual:products.csv",
        summary={"total": 10, "created": 4, "updated": 5, "failed": 1},
        created_by=9,
    )
    db = _ImportRunsSession(runs=[run], users_rows=[(9, "ops@example.com")])
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)

    payload = await admin.admin_get_import_runs(
        skip=0,
        limit=50,
        entity_type=None,
        status=None,
        db=db,
        current_user=current_user,
    )

    assert len(payload) == 1
    assert payload[0]["id"] == 21
    assert payload[0]["created_by_user"] == "ops@example.com"
    assert payload[0]["total"] == 10
    assert payload[0]["failed"] == 1


def test_admin_import_detail_helpers_extract_errors_and_snapshot_metadata():
    run = ImportRun(
        errors=["bad row", 123],
        snapshot_data=[{"id": 1, "sku": "SKU-1", "name": "Name-1"}],
    )

    errors = admin._extract_import_errors(run)
    metadata = admin._extract_snapshot_metadata(run)

    assert errors == ["bad row", "123"]
    assert metadata["items_count"] == 1
    assert metadata["has_snapshot"] is True
    assert metadata["sample_keys"] == ["id", "name", "sku"]


def test_admin_product_snapshot_helpers_find_remove_and_upsert():
    snapshot_items = [{"id": 1, "sku": "OLD-1"}, {"id": 2, "sku": "OLD-2"}]

    index = admin._find_product_snapshot_index(snapshot_items, 2)
    assert index == 1
    assert admin._remove_snapshot_item(snapshot_items, index) is True
    assert [item["id"] for item in snapshot_items] == [1]
    assert admin._remove_snapshot_item(snapshot_items, None) is False


class _OrderStatusSession:
    def __init__(self, order):
        self._order = order
        self._execute_calls = 0
        self.commits = 0
        self.added = []

    async def execute(self, _query):
        self._execute_calls += 1
        if self._execute_calls in {1, 2}:
            return _ExecResult(scalar=self._order)
        return _ExecResult(scalar=None)

    async def commit(self):
        self.commits += 1

    def add(self, obj):
        self.added.append(obj)


@pytest.mark.asyncio
async def test_admin_update_order_status_success(monkeypatch):
    order = SimpleNamespace(
        id=51,
        status="in_progress",
        manager_comment=None,
        uuid="order-51",
        customer_phone="+79990001122",
        updated_at=None,
        items=[],
    )
    db = _OrderStatusSession(order)
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)
    events = []
    monkeypatch.setattr(admin, "notify_event", lambda event, payload: events.append((event, payload)))

    payload = admin.OrderStatusUpdate(status="ready", manager_comment="  принято  ")
    updated = await admin.admin_update_order_status(
        order_id=51,
        payload=payload,
        db=db,
        current_user=current_user,
    )

    assert updated.status == "ready"
    assert updated.manager_comment == "принято"
    assert db.commits == 2
    assert any(isinstance(item, AuditLog) and item.action == "update_order_status" for item in db.added)
    assert events and events[0][0] == "order.status_changed"
    assert events[0][1]["old_status"] == "in_progress"
    assert events[0][1]["new_status"] == "ready"


@pytest.mark.asyncio
async def test_admin_update_order_status_rejects_invalid_transition():
    order = SimpleNamespace(
        id=52,
        status="new",
        manager_comment=None,
        uuid="order-52",
        customer_phone="+79990001123",
        updated_at=None,
        items=[],
    )
    db = _OrderStatusSession(order)
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)
    payload = admin.OrderStatusUpdate(status="closed", manager_comment=None)

    with pytest.raises(HTTPException) as exc:
        await admin.admin_update_order_status(
            order_id=52,
            payload=payload,
            db=db,
            current_user=current_user,
        )

    assert exc.value.status_code == 400
    assert "Invalid status transition" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_admin_update_order_status_rejects_unknown_status():
    order = SimpleNamespace(
        id=53,
        status="new",
        manager_comment=None,
        uuid="order-53",
        customer_phone="+79990001124",
        updated_at=None,
        items=[],
    )
    db = _OrderStatusSession(order)
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)
    payload = SimpleNamespace(status="unexpected", manager_comment=None)

    with pytest.raises(HTTPException) as exc:
        await admin.admin_update_order_status(
            order_id=53,
            payload=payload,
            db=db,
            current_user=current_user,
        )

    assert exc.value.status_code == 400
    assert "Unknown status" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_admin_update_order_status_returns_404_when_order_missing():
    db = _OrderStatusSession(order=None)
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)
    payload = admin.OrderStatusUpdate(status="ready", manager_comment=None)

    with pytest.raises(HTTPException) as exc:
        await admin.admin_update_order_status(
            order_id=404,
            payload=payload,
            db=db,
            current_user=current_user,
        )

    assert exc.value.status_code == 404


class _QueuedSession:
    def __init__(self, results: list[_ExecResult]):
        self._results = list(results)
        self.commits = 0
        self.added = []
        self.deleted = []
        self._next_id = 1000

    async def execute(self, _query):
        if self._results:
            return self._results.pop(0)
        return _ExecResult(scalar=None)

    async def commit(self):
        self.commits += 1

    def add(self, obj):
        self.added.append(obj)

    async def refresh(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = self._next_id
            self._next_id += 1

    async def delete(self, obj):
        self.deleted.append(obj)


@pytest.mark.asyncio
async def test_admin_update_product_updates_scalar_fields(monkeypatch):
    async def _noop_snapshot_sync(*_args, **_kwargs):
        return None

    monkeypatch.setattr(admin, "_sync_latest_products_snapshot", _noop_snapshot_sync)

    product = SimpleNamespace(
        id=71,
        sku="SKU-71",
        name="Старое имя",
        price=10.0,
        stock_quantity=3,
        compatibilities=[],
        images=[],
    )
    db = _QueuedSession([_ExecResult(scalar=product), _ExecResult(scalar=product)])
    current_user = SimpleNamespace(id=1, role="manager", is_active=True)
    payload = admin.ProductUpdate(name="Новое имя", price=25.5, stock_quantity=9)

    updated = await admin.admin_update_product(
        product_id=71,
        product_update=payload,
        db=db,
        current_user=current_user,
    )

    assert updated.name == "Новое имя"
    assert updated.price == 25.5
    assert updated.stock_quantity == 9
    assert db.commits == 2
    assert any(isinstance(item, AuditLog) and item.entity_type == "product" for item in db.added)
    assert not any(isinstance(item, admin.ProductCompatibility) for item in db.added)


@pytest.mark.asyncio
async def test_admin_update_product_replaces_compatibilities(monkeypatch):
    async def _noop_snapshot_sync(*_args, **_kwargs):
        return None

    monkeypatch.setattr(admin, "_sync_latest_products_snapshot", _noop_snapshot_sync)

    product = SimpleNamespace(
        id=72,
        sku="SKU-72",
        name="Товар",
        price=100.0,
        stock_quantity=1,
        compatibilities=[
            SimpleNamespace(make="GAZ", model="Next", year_from=2019, year_to=2022, engine="2.8")
        ],
        images=[],
    )
    db = _QueuedSession(
        [
            _ExecResult(scalar=product),  # select product by id
            _ExecResult(scalar=None),     # delete compatibilities
            _ExecResult(scalar=product),  # select updated product
        ]
    )
    current_user = SimpleNamespace(id=1, role="manager", is_active=True)
    payload = admin.ProductUpdate(
        compatibilities=[
            {"make": "KAMAZ", "model": "6520", "year_from": 2018, "year_to": 2024, "engine": "diesel"},
            {"make": "URAL", "model": "4320", "year_from": 2015, "year_to": None, "engine": None},
        ]
    )

    await admin.admin_update_product(
        product_id=72,
        product_update=payload,
        db=db,
        current_user=current_user,
    )

    compatibility_adds = [item for item in db.added if isinstance(item, admin.ProductCompatibility)]
    assert len(compatibility_adds) == 2
    assert {item.make for item in compatibility_adds} == {"KAMAZ", "URAL"}

    audit_items = [item for item in db.added if isinstance(item, AuditLog)]
    assert audit_items
    assert "compatibilities" in (audit_items[-1].new_values or {})


@pytest.mark.asyncio
async def test_admin_update_product_returns_404_when_not_found():
    db = _QueuedSession([_ExecResult(scalar=None)])
    current_user = SimpleNamespace(id=1, role="manager", is_active=True)
    payload = admin.ProductUpdate(name="irrelevant")

    with pytest.raises(HTTPException) as exc:
        await admin.admin_update_product(
            product_id=404,
            product_update=payload,
            db=db,
            current_user=current_user,
        )

    assert exc.value.status_code == 404


class _SingleFetchSession:
    def __init__(self, entity):
        self.entity = entity
        self.commits = 0
        self.added = []

    async def execute(self, _query):
        return _ExecResult(scalar=self.entity)

    async def commit(self):
        self.commits += 1

    async def refresh(self, _obj):
        return None

    def add(self, obj):
        self.added.append(obj)


@pytest.mark.asyncio
async def test_admin_update_service_request_status_success(monkeypatch):
    service_request = SimpleNamespace(
        id=81,
        uuid="sr-81",
        status="new",
        operator_comment=None,
        phone="+79991112233",
        updated_at=None,
    )
    db = _SingleFetchSession(service_request)
    current_user = SimpleNamespace(id=1, role="service_manager", is_active=True)
    events = []
    monkeypatch.setattr(admin, "notify_event", lambda event, payload: events.append((event, payload)))
    payload = admin.ServiceRequestStatusUpdate(status="in_progress", operator_comment="  взяли в работу  ")

    updated = await admin.admin_update_service_request_status(
        request_id=81,
        payload=payload,
        db=db,
        current_user=current_user,
    )

    assert updated.status == "in_progress"
    assert updated.operator_comment == "взяли в работу"
    assert db.commits == 2
    assert any(isinstance(item, AuditLog) and item.entity_type == "service_request" for item in db.added)
    assert events and events[0][0] == "service_request.status_changed"


@pytest.mark.asyncio
async def test_admin_update_service_request_status_rejects_invalid_transition():
    service_request = SimpleNamespace(
        id=82,
        uuid="sr-82",
        status="closed",
        operator_comment=None,
        phone="+79991112234",
        updated_at=None,
    )
    db = _SingleFetchSession(service_request)
    current_user = SimpleNamespace(id=1, role="service_manager", is_active=True)
    payload = admin.ServiceRequestStatusUpdate(status="in_progress", operator_comment=None)

    with pytest.raises(HTTPException) as exc:
        await admin.admin_update_service_request_status(
            request_id=82,
            payload=payload,
            db=db,
            current_user=current_user,
        )

    assert exc.value.status_code == 400
    assert "Invalid status transition" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_admin_update_service_request_status_returns_404_when_missing():
    db = _SingleFetchSession(entity=None)
    current_user = SimpleNamespace(id=1, role="service_manager", is_active=True)
    payload = admin.ServiceRequestStatusUpdate(status="in_progress", operator_comment=None)

    with pytest.raises(HTTPException) as exc:
        await admin.admin_update_service_request_status(
            request_id=404,
            payload=payload,
            db=db,
            current_user=current_user,
        )

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_admin_update_vin_request_status_success(monkeypatch):
    vin_request = SimpleNamespace(
        id=91,
        uuid="vin-91",
        vin="XTA210930Y1234567",
        status="new",
        operator_comment=None,
        phone="+79991112235",
        updated_at=None,
    )
    db = _SingleFetchSession(vin_request)
    current_user = SimpleNamespace(id=1, role="manager", is_active=True)
    events = []
    monkeypatch.setattr(admin, "notify_event", lambda event, payload: events.append((event, payload)))
    payload = admin.VinRequestStatusUpdate(status="in_progress", operator_comment="  проверяем  ")

    updated = await admin.admin_update_vin_request_status(
        request_id=91,
        payload=payload,
        db=db,
        current_user=current_user,
    )

    assert updated.status == "in_progress"
    assert updated.operator_comment == "проверяем"
    assert db.commits == 2
    assert any(isinstance(item, AuditLog) and item.entity_type == "vin_request" for item in db.added)
    assert events and events[0][0] == "vin_request.status_changed"


@pytest.mark.asyncio
async def test_admin_update_vin_request_status_rejects_invalid_transition():
    vin_request = SimpleNamespace(
        id=92,
        uuid="vin-92",
        vin="XTA210930Y1234568",
        status="closed",
        operator_comment=None,
        phone="+79991112236",
        updated_at=None,
    )
    db = _SingleFetchSession(vin_request)
    current_user = SimpleNamespace(id=1, role="manager", is_active=True)
    payload = admin.VinRequestStatusUpdate(status="in_progress", operator_comment=None)

    with pytest.raises(HTTPException) as exc:
        await admin.admin_update_vin_request_status(
            request_id=92,
            payload=payload,
            db=db,
            current_user=current_user,
        )

    assert exc.value.status_code == 400
    assert "Invalid status transition" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_admin_update_vin_request_status_returns_404_when_missing():
    db = _SingleFetchSession(entity=None)
    current_user = SimpleNamespace(id=1, role="manager", is_active=True)
    payload = admin.VinRequestStatusUpdate(status="in_progress", operator_comment=None)

    with pytest.raises(HTTPException) as exc:
        await admin.admin_update_vin_request_status(
            request_id=404,
            payload=payload,
            db=db,
            current_user=current_user,
        )

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_admin_get_order_success_and_not_found():
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)

    existing_order = SimpleNamespace(id=301, status="new", items=[])
    found_db = _SingleFetchSession(entity=existing_order)
    found = await admin.admin_get_order(order_id=301, db=found_db, current_user=current_user)
    assert found.id == 301

    missing_db = _SingleFetchSession(entity=None)
    with pytest.raises(HTTPException) as exc:
        await admin.admin_get_order(order_id=404, db=missing_db, current_user=current_user)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_admin_get_service_request_success_and_not_found():
    current_user = SimpleNamespace(id=1, role="service_manager", is_active=True)

    existing_request = SimpleNamespace(id=401, status="new")
    found_db = _SingleFetchSession(entity=existing_request)
    found = await admin.admin_get_service_request(request_id=401, db=found_db, current_user=current_user)
    assert found.id == 401

    missing_db = _SingleFetchSession(entity=None)
    with pytest.raises(HTTPException) as exc:
        await admin.admin_get_service_request(request_id=404, db=missing_db, current_user=current_user)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_admin_get_vin_request_success_and_not_found():
    current_user = SimpleNamespace(id=1, role="manager", is_active=True)

    existing_request = SimpleNamespace(id=501, status="new")
    found_db = _SingleFetchSession(entity=existing_request)
    found = await admin.admin_get_vin_request(request_id=501, db=found_db, current_user=current_user)
    assert found.id == 501

    missing_db = _SingleFetchSession(entity=None)
    with pytest.raises(HTTPException) as exc:
        await admin.admin_get_vin_request(request_id=404, db=missing_db, current_user=current_user)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_admin_get_status_reference_endpoints():
    assert admin.ORDER_STATUSES == await admin.admin_get_order_statuses(current_user=SimpleNamespace())
    assert ["new", "in_progress", "closed"] == await admin.admin_get_vin_request_statuses(
        current_user=SimpleNamespace()
    )


@pytest.mark.asyncio
async def test_admin_categories_crud_paths():
    current_user = SimpleNamespace(id=1, role="manager", is_active=True)

    list_db = _QueuedSession([_ExecResult(scalars=[SimpleNamespace(id=1, name="Категория")])])
    categories = await admin.admin_get_categories(db=list_db, current_user=current_user)
    assert len(categories) == 1

    duplicate_db = _QueuedSession([_ExecResult(scalar=SimpleNamespace(id=10))])
    with pytest.raises(HTTPException) as duplicate_exc:
        await admin.admin_create_category(
            category=admin.CategoryCreate(name="Масла", slug="masla"),
            db=duplicate_db,
            current_user=current_user,
        )
    assert duplicate_exc.value.status_code == 400

    create_db = _QueuedSession([_ExecResult(scalar=None)])
    created = await admin.admin_create_category(
        category=admin.CategoryCreate(name="Масла", slug="masla"),
        db=create_db,
        current_user=current_user,
    )
    assert created.id is not None
    assert any(isinstance(item, AuditLog) and item.entity_type == "category" for item in create_db.added)

    existing_category = SimpleNamespace(id=11, name="Старая", slug="old", is_active=True)
    get_db = _QueuedSession([_ExecResult(scalar=existing_category)])
    found = await admin.admin_get_category(category_id=11, db=get_db, current_user=current_user)
    assert found.id == 11

    missing_get_db = _QueuedSession([_ExecResult(scalar=None)])
    with pytest.raises(HTTPException) as not_found_exc:
        await admin.admin_get_category(category_id=404, db=missing_get_db, current_user=current_user)
    assert not_found_exc.value.status_code == 404

    update_category = SimpleNamespace(id=12, name="Старая", slug="old", is_active=True)
    update_db = _QueuedSession([_ExecResult(scalar=update_category)])
    updated = await admin.admin_update_category(
        category_id=12,
        category_update=admin.CategoryUpdate(name="Новая", slug="new", is_active=False),
        db=update_db,
        current_user=current_user,
    )
    assert updated.name == "Новая"
    assert updated.slug == "new"
    assert updated.is_active is False

    missing_update_db = _QueuedSession([_ExecResult(scalar=None)])
    with pytest.raises(HTTPException) as missing_update_exc:
        await admin.admin_update_category(
            category_id=404,
            category_update=admin.CategoryUpdate(name="x"),
            db=missing_update_db,
            current_user=current_user,
        )
    assert missing_update_exc.value.status_code == 404

    delete_user = SimpleNamespace(id=1, role="admin", is_active=True)
    delete_category = SimpleNamespace(id=13, name="Удалить", slug="remove", is_active=True)
    delete_db = _QueuedSession([_ExecResult(scalar=delete_category)])
    deleted_result = await admin.admin_delete_category(category_id=13, db=delete_db, current_user=delete_user)
    assert deleted_result is None
    assert delete_db.deleted and delete_db.deleted[0].id == 13

    missing_delete_db = _QueuedSession([_ExecResult(scalar=None)])
    with pytest.raises(HTTPException) as missing_delete_exc:
        await admin.admin_delete_category(category_id=404, db=missing_delete_db, current_user=delete_user)
    assert missing_delete_exc.value.status_code == 404


@pytest.mark.asyncio
async def test_admin_service_catalog_crud_and_validation_paths():
    current_user = SimpleNamespace(id=1, role="service_manager", is_active=True)

    list_db = _QueuedSession([_ExecResult(scalars=[SimpleNamespace(id=1, name="Диагностика")])])
    payload = await admin.admin_get_service_catalog(
        include_inactive=False,
        vehicle_type=None,
        db=list_db,
        current_user=current_user,
    )
    assert len(payload) == 1

    with pytest.raises(HTTPException) as invalid_vehicle_exc:
        await admin.admin_get_service_catalog(
            include_inactive=True,
            vehicle_type="plane",
            db=_QueuedSession([_ExecResult(scalars=[])]),
            current_user=current_user,
        )
    assert invalid_vehicle_exc.value.status_code == 400

    with pytest.raises(HTTPException) as missing_prepayment_exc:
        await admin.admin_create_service_catalog_item(
            payload=admin.ServiceCatalogItemCreate(
                name="Ремонт",
                vehicle_type="passenger",
                prepayment_required=True,
                prepayment_amount=None,
            ),
            db=_QueuedSession([]),
            current_user=current_user,
        )
    assert missing_prepayment_exc.value.status_code == 400

    create_db = _QueuedSession([])
    created_item = await admin.admin_create_service_catalog_item(
        payload=admin.ServiceCatalogItemCreate(
            name="Диагностика",
            vehicle_type="both",
            prepayment_required=False,
            prepayment_amount=1000,
        ),
        db=create_db,
        current_user=current_user,
    )
    assert created_item.id is not None
    assert created_item.prepayment_amount is None
    assert any(isinstance(item, AuditLog) and item.entity_type == "service_catalog_item" for item in create_db.added)

    missing_update_db = _QueuedSession([_ExecResult(scalar=None)])
    with pytest.raises(HTTPException) as missing_update_exc:
        await admin.admin_update_service_catalog_item(
            item_id=404,
            payload=admin.ServiceCatalogItemUpdate(name="x"),
            db=missing_update_db,
            current_user=current_user,
        )
    assert missing_update_exc.value.status_code == 404

    existing_item = SimpleNamespace(
        id=31,
        name="Сервис",
        vehicle_type="passenger",
        duration_minutes=60,
        price=1500.0,
        prepayment_required=False,
        prepayment_amount=None,
        sort_order=0,
        is_active=True,
        updated_at=None,
    )
    invalid_update_db = _QueuedSession([_ExecResult(scalar=existing_item)])
    with pytest.raises(HTTPException) as invalid_update_exc:
        await admin.admin_update_service_catalog_item(
            item_id=31,
            payload=admin.ServiceCatalogItemUpdate(prepayment_required=True, prepayment_amount=None),
            db=invalid_update_db,
            current_user=current_user,
        )
    assert invalid_update_exc.value.status_code == 400

    update_item = SimpleNamespace(
        id=32,
        name="Сервис",
        vehicle_type="both",
        duration_minutes=45,
        price=1200.0,
        prepayment_required=True,
        prepayment_amount=500.0,
        sort_order=1,
        is_active=True,
        updated_at=None,
    )
    update_db = _QueuedSession([_ExecResult(scalar=update_item)])
    updated_item = await admin.admin_update_service_catalog_item(
        item_id=32,
        payload=admin.ServiceCatalogItemUpdate(prepayment_required=False, prepayment_amount=1000),
        db=update_db,
        current_user=current_user,
    )
    assert updated_item.prepayment_required is False
    assert updated_item.prepayment_amount is None

    missing_delete_db = _QueuedSession([_ExecResult(scalar=None)])
    with pytest.raises(HTTPException) as missing_delete_exc:
        await admin.admin_delete_service_catalog_item(
            item_id=404,
            db=missing_delete_db,
            current_user=current_user,
        )
    assert missing_delete_exc.value.status_code == 404

    delete_item = SimpleNamespace(id=33, is_active=True, updated_at=None)
    delete_db = _QueuedSession([_ExecResult(scalar=delete_item)])
    deleted_item = await admin.admin_delete_service_catalog_item(
        item_id=33,
        db=delete_db,
        current_user=current_user,
    )
    assert deleted_item.is_active is False


@pytest.mark.asyncio
async def test_admin_content_crud_paths():
    current_user = SimpleNamespace(id=1, role="admin", is_active=True)

    list_db = _QueuedSession([_ExecResult(scalars=[SimpleNamespace(id=1, key="hero_title", value="x")])])
    content_rows = await admin.admin_get_content(db=list_db, current_user=current_user)
    assert len(content_rows) == 1

    existing_content = SimpleNamespace(id=41, key="hero_title", value="Old", type="text")
    get_db = _QueuedSession([_ExecResult(scalar=existing_content)])
    found = await admin.admin_get_content_by_key(key="hero_title", db=get_db, current_user=current_user)
    assert found.id == 41

    missing_get_db = _QueuedSession([_ExecResult(scalar=None)])
    with pytest.raises(HTTPException) as missing_get_exc:
        await admin.admin_get_content_by_key(key="missing", db=missing_get_db, current_user=current_user)
    assert missing_get_exc.value.status_code == 404

    duplicate_create_db = _QueuedSession([_ExecResult(scalar=SimpleNamespace(id=99))])
    with pytest.raises(HTTPException) as duplicate_create_exc:
        await admin.admin_create_content(
            content=admin.SiteContentCreate(key="hero_title", value="A", type="text"),
            db=duplicate_create_db,
            current_user=current_user,
        )
    assert duplicate_create_exc.value.status_code == 400

    create_db = _QueuedSession([_ExecResult(scalar=None)])
    created = await admin.admin_create_content(
        content=admin.SiteContentCreate(key="hero_subtitle", value="B", type="text"),
        db=create_db,
        current_user=current_user,
    )
    assert created.id is not None
    assert any(isinstance(item, AuditLog) and item.entity_type == "content" for item in create_db.added)

    update_content = SimpleNamespace(id=42, key="hero_subtitle", value="old", type="text")
    update_db = _QueuedSession([_ExecResult(scalar=update_content)])
    updated = await admin.admin_update_content(
        key="hero_subtitle",
        content_update=admin.SiteContentUpdate(value="new"),
        db=update_db,
        current_user=current_user,
    )
    assert updated.value == "new"

    missing_update_db = _QueuedSession([_ExecResult(scalar=None)])
    with pytest.raises(HTTPException) as missing_update_exc:
        await admin.admin_update_content(
            key="missing",
            content_update=admin.SiteContentUpdate(value="x"),
            db=missing_update_db,
            current_user=current_user,
        )
    assert missing_update_exc.value.status_code == 404

    delete_content = SimpleNamespace(id=43, key="hero_subtitle", value="x", type="text")
    delete_db = _QueuedSession([_ExecResult(scalar=delete_content)])
    deleted = await admin.admin_delete_content(key="hero_subtitle", db=delete_db, current_user=current_user)
    assert deleted is None
    assert delete_db.deleted and delete_db.deleted[0].id == 43

    missing_delete_db = _QueuedSession([_ExecResult(scalar=None)])
    with pytest.raises(HTTPException) as missing_delete_exc:
        await admin.admin_delete_content(key="missing", db=missing_delete_db, current_user=current_user)
    assert missing_delete_exc.value.status_code == 404


@pytest.mark.asyncio
async def test_public_rate_limit_redis_and_fallback_paths(monkeypatch):
    class _RedisOk:
        def __init__(self):
            self.expire_calls = 0

        async def incr(self, _key):
            return 1

        async def expire(self, _key, _ttl):
            self.expire_calls += 1

    redis_ok = _RedisOk()

    async def _get_redis_ok():
        return redis_ok

    monkeypatch.setattr(public, "_get_redis_rate_limit_client", _get_redis_ok)
    await public._enforce_form_rate_limit(_make_request("/api/public/leads"), "leads")
    assert redis_ok.expire_calls == 1

    class _RedisLimited:
        async def incr(self, _key):
            return 999

        async def expire(self, _key, _ttl):
            return None

    async def _get_redis_limited():
        return _RedisLimited()

    monkeypatch.setattr(public, "_get_redis_rate_limit_client", _get_redis_limited)
    with pytest.raises(HTTPException) as limited_exc:
        await public._enforce_form_rate_limit(_make_request("/api/public/leads"), "leads")
    assert limited_exc.value.status_code == 429

    class _RedisBroken:
        async def incr(self, _key):
            raise RuntimeError("redis down")

        async def expire(self, _key, _ttl):
            return None

    async def _get_redis_broken():
        return _RedisBroken()

    monkeypatch.setattr(public, "_get_redis_rate_limit_client", _get_redis_broken)
    monkeypatch.setattr(public, "FORM_RATE_LIMITS_PER_SCOPE", {"leads": 1})
    public._rate_limit_buckets.clear()

    await public._enforce_form_rate_limit(_make_request("/api/public/leads"), "leads")
    with pytest.raises(HTTPException) as fallback_limit_exc:
        await public._enforce_form_rate_limit(_make_request("/api/public/leads"), "leads")
    assert fallback_limit_exc.value.status_code == 429


@pytest.mark.asyncio
async def test_public_redis_client_and_env_helpers(monkeypatch):
    monkeypatch.setenv("PUBLIC_TEST_POSITIVE_INT", "7")
    assert public._env_positive_int("PUBLIC_TEST_POSITIVE_INT", 3) == 7
    monkeypatch.setenv("PUBLIC_TEST_POSITIVE_INT", "-5")
    assert public._env_positive_int("PUBLIC_TEST_POSITIVE_INT", 3) == 3
    monkeypatch.setenv("PUBLIC_TEST_POSITIVE_INT", "bad")
    assert public._env_positive_int("PUBLIC_TEST_POSITIVE_INT", 3) == 3

    monkeypatch.setattr(public, "REDIS_RATE_LIMIT_URL", "")
    monkeypatch.setattr(public, "_redis_rate_limit_client", None)
    assert await public._get_redis_rate_limit_client() is None

    sentinel = object()

    class _RedisFactory:
        @staticmethod
        def from_url(url, decode_responses):
            assert url == "redis://example:6379/0"
            assert decode_responses is True
            return sentinel

    monkeypatch.setattr(public, "Redis", _RedisFactory)
    monkeypatch.setattr(public, "REDIS_RATE_LIMIT_URL", "redis://example:6379/0")
    monkeypatch.setattr(public, "_redis_rate_limit_client", None)

    assert await public._get_redis_rate_limit_client() is sentinel
    assert await public._get_redis_rate_limit_client() is sentinel


def test_public_helper_validation_and_normalization_paths():
    assert public._extract_client_ip(_make_request("/api/public/content")) == "127.0.0.1"

    request_without_client = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [],
            "scheme": "http",
            "server": ("testserver", 80),
            "query_string": b"",
        }
    )
    assert public._extract_client_ip(request_without_client) == "unknown"

    assert public._normalize_client_filename(" folder/../../name.pdf ") == "name.pdf"
    assert public._normalize_optional_filter("  ABC  ") == "abc"
    assert public._normalize_optional_filter("   ") is None
    assert public._normalize_optional_filter(None) is None

    public._validate_order_requisites_signature(".png", b"\x89PNG\r\n\x1a\nbody")
    public._validate_order_requisites_signature(".jpg", b"\xff\xd8\xffbody")
    with pytest.raises(HTTPException):
        public._validate_order_requisites_signature(".png", b"not-png")
    with pytest.raises(HTTPException):
        public._validate_order_requisites_signature(".jpg", b"not-jpg")


@pytest.mark.asyncio
async def test_public_snapshot_loading_and_product_endpoints(monkeypatch):
    run = SimpleNamespace(
        snapshot_data=[
            {"id": 1, "category_id": 2, "sku": "SKU-1", "name": "Масло", "is_active": True},
            {"id": 0, "category_id": 2, "sku": "BAD", "name": "bad"},
        ]
    )
    snapshot_db = _QueuedSession([_ExecResult(scalar=run)])

    monkeypatch.setattr(public, "PUBLIC_PRODUCTS_READ_MODE", "snapshot")
    loaded = await public._load_latest_products_snapshot(snapshot_db)
    assert loaded is not None
    assert len(loaded) == 1
    assert loaded[0]["sku"] == "SKU-1"

    monkeypatch.setattr(public, "PUBLIC_PRODUCTS_READ_MODE", "db")
    assert await public._load_latest_products_snapshot(snapshot_db) is None

    async def _snapshot_products(_db):
        return [
            {"id": 1, "category_id": 2, "sku": "SKU-1", "name": "Масло", "is_active": True, "stock_quantity": 5},
            {"id": 2, "category_id": 2, "sku": "SKU-2", "name": "Фильтр", "is_active": False, "stock_quantity": 10},
        ]

    monkeypatch.setattr(public, "_load_latest_products_snapshot", _snapshot_products)
    snapshot_products = await public.get_products(
        category_id=2,
        search=None,
        brand=None,
        vehicle_make=None,
        vehicle_model=None,
        vehicle_year=None,
        vehicle_engine=None,
        in_stock_only=True,
        limit=20,
        offset=0,
        db=_QueuedSession([]),
    )
    assert len(snapshot_products) == 1
    assert snapshot_products[0]["id"] == 1

    snapshot_product = await public.get_product(product_id=1, db=_QueuedSession([]))
    assert snapshot_product["sku"] == "SKU-1"

    with pytest.raises(HTTPException) as missing_snapshot_product_exc:
        await public.get_product(product_id=404, db=_QueuedSession([]))
    assert missing_snapshot_product_exc.value.status_code == 404

    with pytest.raises(HTTPException) as missing_snapshot_sku_exc:
        await public.get_product_by_sku(sku="MISSING", db=_QueuedSession([]))
    assert missing_snapshot_sku_exc.value.status_code == 404


@pytest.mark.asyncio
async def test_public_db_mode_product_and_read_endpoints(monkeypatch):
    async def _no_snapshot(_db):
        return None

    monkeypatch.setattr(public, "_load_latest_products_snapshot", _no_snapshot)

    product_row = SimpleNamespace(id=11, sku="SKU-11", is_active=True, items=[])
    products_db = _QueuedSession([_ExecResult(scalars=[product_row])])
    db_products = await public.get_products(
        category_id=None,
        search="масло",
        brand="Brand",
        vehicle_make="KAMAZ",
        vehicle_model="6520",
        vehicle_year=2020,
        vehicle_engine="diesel",
        in_stock_only=True,
        limit=10,
        offset=0,
        db=products_db,
    )
    assert len(db_products) == 1

    product_db = _QueuedSession([_ExecResult(scalar=product_row)])
    by_id = await public.get_product(product_id=11, db=product_db)
    assert by_id.id == 11

    missing_product_db = _QueuedSession([_ExecResult(scalar=None)])
    with pytest.raises(HTTPException) as missing_product_exc:
        await public.get_product(product_id=404, db=missing_product_db)
    assert missing_product_exc.value.status_code == 404

    sku_db = _QueuedSession([_ExecResult(scalar=product_row)])
    by_sku = await public.get_product_by_sku(sku="SKU-11", db=sku_db)
    assert by_sku.id == 11

    missing_sku_db = _QueuedSession([_ExecResult(scalar=None)])
    with pytest.raises(HTTPException) as missing_sku_exc:
        await public.get_product_by_sku(sku="NONE", db=missing_sku_db)
    assert missing_sku_exc.value.status_code == 404

    with pytest.raises(HTTPException) as bad_phone_exc:
        await public.get_order_history(phone="12345", limit=5, db=_QueuedSession([]))
    assert bad_phone_exc.value.status_code == 400

    history_db = _QueuedSession([_ExecResult(scalars=[SimpleNamespace(id=1, status="new", items=[])])])
    history = await public.get_order_history(phone="+7 (999) 111-22-33", limit=5, db=history_db)
    assert len(history) == 1

    with pytest.raises(HTTPException) as invalid_vehicle_type_exc:
        await public.get_service_catalog(vehicle_type="plane", db=_QueuedSession([]))
    assert invalid_vehicle_type_exc.value.status_code == 400

    service_catalog_db = _QueuedSession([_ExecResult(scalars=[SimpleNamespace(id=1, name="Диагностика")])])
    catalog = await public.get_service_catalog(vehicle_type="truck", db=service_catalog_db)
    assert len(catalog) == 1

    content_db = _QueuedSession([_ExecResult(scalars=[SimpleNamespace(key="hero", value="value")])])
    content = await public.get_public_content(db=content_db)
    assert content == [{"key": "hero", "value": "value"}]
