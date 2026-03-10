import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not set in environment")


def _env_bool(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    value = raw_value.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default


def _env_positive_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        parsed = int(raw_value)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


# Convert postgresql+psycopg to postgresql+asyncpg for async operations
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg", "postgresql+asyncpg")
SQLALCHEMY_ECHO = _env_bool("SQLALCHEMY_ECHO", default=False)
DB_POOL_SIZE = _env_positive_int("DB_POOL_SIZE", default=20)
DB_MAX_OVERFLOW = _env_positive_int("DB_MAX_OVERFLOW", default=40)
DB_POOL_TIMEOUT_SECONDS = _env_positive_int("DB_POOL_TIMEOUT_SECONDS", default=30)
DB_POOL_RECYCLE_SECONDS = _env_positive_int("DB_POOL_RECYCLE_SECONDS", default=1800)

engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=SQLALCHEMY_ECHO,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_timeout=DB_POOL_TIMEOUT_SECONDS,
    pool_recycle=DB_POOL_RECYCLE_SECONDS,
    pool_pre_ping=True,
)

AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
