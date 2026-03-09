from contextlib import asynccontextmanager
import json
import logging
import os
from time import perf_counter
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from database import engine
from models import Base
from routers import public
from routers import admin

load_dotenv()
logger = logging.getLogger("api.request")


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


AUTO_CREATE_SCHEMA_ON_START = _env_bool("AUTO_CREATE_SCHEMA_ON_START", default=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(
        json.dumps(
            {
                "event": "app_startup",
                "auto_create_schema_on_start": AUTO_CREATE_SCHEMA_ON_START,
            },
            ensure_ascii=False,
        )
    )
    if AUTO_CREATE_SCHEMA_ON_START:
        async with engine.begin() as conn:
            # Explicitly opt-in only (development fallback), production uses Alembic migrations.
            await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    logger.info(json.dumps({"event": "app_shutdown"}, ensure_ascii=False))
    await engine.dispose()

app = FastAPI(
    title="Все запчасти API",
    description="API for auto parts store and service",
    version="0.1.0",
    lifespan=lifespan
)


def _normalize_origin(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().rstrip("/")
    if normalized.startswith("http://") or normalized.startswith("https://"):
        return normalized
    return None


def _load_allowed_origins() -> list[str]:
    raw = os.getenv("WEB_ORIGIN", "").strip()
    origins: list[str] = []

    if raw:
        for item in raw.split(","):
            normalized = _normalize_origin(item)
            if normalized and normalized not in origins:
                origins.append(normalized)

    if origins:
        return origins

    # Local development fallback for loopback hosts.
    return ["http://localhost:3000", "http://127.0.0.1:3000"]


allowed_origins = _load_allowed_origins()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
)


def _get_trace_id(request: Request) -> str:
    trace_id = getattr(request.state, "trace_id", None)
    if isinstance(trace_id, str) and trace_id.strip():
        return trace_id.strip()
    generated = str(uuid.uuid4())
    request.state.trace_id = generated
    return generated


def _error_detail_with_trace(detail: str, trace_id: str) -> str:
    normalized = detail.strip() if detail else ""
    if not normalized:
        return f"Код: {trace_id}"
    if "Код:" in normalized:
        return normalized
    return f"{normalized} Код: {trace_id}"


def _error_response(status_code: int, code: str, message: str, trace_id: str) -> JSONResponse:
    normalized_message = message.strip() if message else "Ошибка запроса"
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": normalized_message,
                "trace_id": trace_id,
            },
            # Backward compatibility for existing frontend handlers.
            "detail": _error_detail_with_trace(normalized_message, trace_id),
        },
        headers={"X-Request-Id": trace_id},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    trace_id = _get_trace_id(request)
    detail = exc.detail if isinstance(exc.detail, str) else "Ошибка запроса"
    return _error_response(
        status_code=exc.status_code,
        code=f"http_{exc.status_code}",
        message=detail,
        trace_id=trace_id,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    trace_id = _get_trace_id(request)
    logger.error(
        json.dumps(
            {
                "event": "validation_error",
                "method": request.method,
                "path": request.url.path,
                "status": 422,
                "trace_id": trace_id,
            },
            ensure_ascii=False,
        )
    )
    return _error_response(
        status_code=422,
        code="validation_error",
        message="Ошибка валидации запроса.",
        trace_id=trace_id,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    trace_id = _get_trace_id(request)
    logger.error(
        json.dumps(
            {
                "event": "unhandled_exception",
                "method": request.method,
                "path": request.url.path,
                "status": 500,
                "trace_id": trace_id,
                "error_type": exc.__class__.__name__,
            },
            ensure_ascii=False,
        )
    )
    return _error_response(
        status_code=500,
        code="internal_error",
        message="Внутренняя ошибка.",
        trace_id=trace_id,
    )


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    incoming_request_id = request.headers.get("x-request-id", "").strip()
    trace_id = incoming_request_id[:128] if incoming_request_id else str(uuid.uuid4())
    request.state.trace_id = trace_id

    started_at = perf_counter()
    response = await call_next(request)

    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    is_https = request.url.scheme == "https" or forwarded_proto == "https"
    if is_https:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    response.headers["X-Request-Id"] = trace_id

    duration_ms = round((perf_counter() - started_at) * 1000, 2)
    logger.info(
        json.dumps(
            {
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
                "trace_id": trace_id,
                "user_id": getattr(request.state, "user_id", None),
            },
            ensure_ascii=False,
        )
    )

    return response


# Routers
app.include_router(public.router)
app.include_router(admin.router)


async def _is_database_ready() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint"""
    return {"ok": True}


@app.get("/api/health", tags=["health"])
async def api_health_check():
    """API health endpoint with DB check."""
    db_ready = await _is_database_ready()
    if not db_ready:
        return JSONResponse(status_code=503, content={"ok": False, "database": "down"})
    return {"ok": True, "database": "ok"}


@app.get("/api/ready", tags=["health"])
async def api_ready_check():
    """Readiness endpoint for orchestrators."""
    db_ready = await _is_database_ready()
    if not db_ready:
        return JSONResponse(status_code=503, content={"ok": False, "ready": False, "database": "down"})
    return {"ok": True, "ready": True, "database": "ok"}


@app.get("/", tags=["root"])
async def root():
    """Root endpoint"""
    return {
        "name": "Все запчасти API",
        "version": "0.1.0",
        "docs": "/docs"
    }
