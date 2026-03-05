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
from starlette.exceptions import HTTPException as StarletteHTTPException

from database import engine
from models import Base
from routers import public
from routers import admin

load_dotenv()
logger = logging.getLogger("api.request")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 API starting up...")
    async with engine.begin() as conn:
        # Create tables if they don't exist (for development)
        # In production, use migrations
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    print("🛑 API shutting down...")
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


web_origin = _normalize_origin(os.getenv("WEB_ORIGIN")) or "http://localhost:3000"

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[web_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
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


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    trace_id = _get_trace_id(request)
    detail = exc.detail if isinstance(exc.detail, str) else "Ошибка запроса"
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": _error_detail_with_trace(detail, trace_id)},
        headers={"X-Request-Id": trace_id},
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
    return JSONResponse(
        status_code=422,
        content={"detail": _error_detail_with_trace("Ошибка валидации запроса.", trace_id)},
        headers={"X-Request-Id": trace_id},
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
    return JSONResponse(
        status_code=500,
        content={"detail": _error_detail_with_trace("Внутренняя ошибка.", trace_id)},
        headers={"X-Request-Id": trace_id},
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

@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint"""
    return {"ok": True}

@app.get("/", tags=["root"])
async def root():
    """Root endpoint"""
    return {
        "name": "Все запчасти API",
        "version": "0.1.0",
        "docs": "/docs"
    }
