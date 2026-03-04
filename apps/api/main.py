from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from database import engine
from models import Base
from routers import public
from routers import admin

load_dotenv()

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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(public.router)
app.include_router(admin.router)

@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "vse-zapchasti-api",
        "version": "0.1.0"
    }

@app.get("/", tags=["root"])
async def root():
    """Root endpoint"""
    return {
        "name": "Все запчасти API",
        "version": "0.1.0",
        "docs": "/docs"
    }
