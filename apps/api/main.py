import asyncio
from contextlib import asynccontextmanager, suppress
import json
import logging
import os
from time import perf_counter
import uuid

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from database import AsyncSessionLocal, engine
from models import Base
from notifications import process_notification_queue
from routers import public
from routers import admin

load_dotenv()
logger = logging.getLogger("api.request")

HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total number of HTTP requests handled by API",
    ["method", "path", "status"],
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
)


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_positive_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


AUTO_CREATE_SCHEMA_ON_START = _env_bool("AUTO_CREATE_SCHEMA_ON_START", default=False)
ERP_SYNC_BACKGROUND_ENABLED = _env_bool("ERP_SYNC_BACKGROUND_ENABLED", default=True)
ERP_SYNC_POLL_SECONDS = _env_positive_int("ERP_SYNC_POLL_SECONDS", default=30)
NOTIFICATION_QUEUE_BACKGROUND_ENABLED = _env_bool(
    "NOTIFICATION_QUEUE_BACKGROUND_ENABLED", default=True
)
NOTIFICATION_QUEUE_POLL_SECONDS = _env_positive_int(
    "NOTIFICATION_QUEUE_POLL_SECONDS", default=20
)


async def _erp_sync_scheduler_loop(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            async with AsyncSessionLocal() as db:
                tick_result = await admin.run_erp_sync_scheduler_tick(db)
            if tick_result.get("action") in {"started", "error"}:
                logger.info(
                    json.dumps(
                        {
                            "event": "erp_sync_tick",
                            **tick_result,
                        },
                        ensure_ascii=False,
                    )
                )
        except Exception as exc:
            logger.error(
                json.dumps(
                    {
                        "event": "erp_sync_scheduler_error",
                        "error_type": exc.__class__.__name__,
                    },
                    ensure_ascii=False,
                )
            )

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=ERP_SYNC_POLL_SECONDS)
        except asyncio.TimeoutError:
            continue


async def _notification_queue_loop(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            result = process_notification_queue(limit=50)
            if result.get("processed", 0) > 0:
                logger.info(
                    json.dumps(
                        {
                            "event": "notifications_queue_tick",
                            **result,
                        },
                        ensure_ascii=False,
                    )
                )
        except Exception as exc:
            logger.error(
                json.dumps(
                    {
                        "event": "notifications_queue_worker_error",
                        "error_type": exc.__class__.__name__,
                    },
                    ensure_ascii=False,
                )
            )

        try:
            await asyncio.wait_for(
                stop_event.wait(),
                timeout=NOTIFICATION_QUEUE_POLL_SECONDS,
            )
        except asyncio.TimeoutError:
            continue


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop_event = asyncio.Event()
    sync_task: asyncio.Task[None] | None = None
    notifications_task: asyncio.Task[None] | None = None
    # Startup
    logger.info(
        json.dumps(
            {
                "event": "app_startup",
                "auto_create_schema_on_start": AUTO_CREATE_SCHEMA_ON_START,
                "erp_sync_background_enabled": ERP_SYNC_BACKGROUND_ENABLED,
                "notification_queue_background_enabled": (
                    NOTIFICATION_QUEUE_BACKGROUND_ENABLED
                ),
            },
            ensure_ascii=False,
        )
    )
    if AUTO_CREATE_SCHEMA_ON_START:
        async with engine.begin() as conn:
            # Explicitly opt-in only (development fallback), production uses Alembic migrations.
            await conn.run_sync(Base.metadata.create_all)
    if ERP_SYNC_BACKGROUND_ENABLED:
        sync_task = asyncio.create_task(_erp_sync_scheduler_loop(stop_event))
    if NOTIFICATION_QUEUE_BACKGROUND_ENABLED:
        notifications_task = asyncio.create_task(_notification_queue_loop(stop_event))
    yield
    # Shutdown
    stop_event.set()
    if sync_task is not None:
        try:
            await asyncio.wait_for(sync_task, timeout=ERP_SYNC_POLL_SECONDS + 5)
        except asyncio.TimeoutError:
            sync_task.cancel()
            with suppress(asyncio.CancelledError):
                await sync_task
    if notifications_task is not None:
        try:
            await asyncio.wait_for(
                notifications_task,
                timeout=NOTIFICATION_QUEUE_POLL_SECONDS + 5,
            )
        except asyncio.TimeoutError:
            notifications_task.cancel()
            with suppress(asyncio.CancelledError):
                await notifications_task
    logger.info(json.dumps({"event": "app_shutdown"}, ensure_ascii=False))
    await engine.dispose()


app = FastAPI(
    title="АвтоПлатформа API",
    description="API for auto parts store and service",
    version="0.1.0",
    lifespan=lifespan,
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


def _error_response(
    status_code: int, code: str, message: str, trace_id: str
) -> JSONResponse:
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


def _resolve_route_label(request: Request) -> str:
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    if isinstance(route_path, str) and route_path.strip():
        return route_path
    return request.url.path


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

    forwarded_proto = (
        request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    )
    is_https = request.url.scheme == "https" or forwarded_proto == "https"
    if is_https:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )

    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    )
    response.headers["X-Request-Id"] = trace_id

    duration_ms = round((perf_counter() - started_at) * 1000, 2)
    route_label = _resolve_route_label(request)
    HTTP_REQUESTS_TOTAL.labels(
        request.method, route_label, str(response.status_code)
    ).inc()
    HTTP_REQUEST_DURATION_SECONDS.labels(request.method, route_label).observe(
        duration_ms / 1000
    )

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
        return JSONResponse(
            status_code=503, content={"ok": False, "ready": False, "database": "down"}
        )
    return {"ok": True, "ready": True, "database": "ok"}


@app.get("/", tags=["root"])
async def root():
    """Root endpoint"""
    return {"name": "АвтоПлатформа API", "version": "0.1.0", "docs": "/docs"}


@app.get("/metrics", tags=["monitoring"])
async def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
