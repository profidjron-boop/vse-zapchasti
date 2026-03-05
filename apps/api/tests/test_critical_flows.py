import os
from pathlib import Path
import sys
from types import SimpleNamespace

from fastapi import HTTPException
import pytest
from starlette.requests import Request

os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")
sys.path.append(str(Path(__file__).resolve().parents[1]))

from models import AuditLog, ImportRun  # noqa: E402
from routers import admin, public  # noqa: E402
from schemas import LeadCreate, ServiceRequestCreate, VinRequestCreate  # noqa: E402


class _ScalarsResult:
    def __init__(self, values):
        self._values = values

    def all(self):
        return list(self._values)


class _ExecResult:
    def __init__(self, scalar=None, scalars=None):
        self._scalar = scalar
        self._scalars = [] if scalars is None else scalars

    def scalar_one_or_none(self):
        return self._scalar

    def scalars(self):
        return _ScalarsResult(self._scalars)


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
