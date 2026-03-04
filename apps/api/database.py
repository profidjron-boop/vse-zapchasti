from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not set in environment")

# Convert postgresql+psycopg to postgresql+asyncpg for async operations
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg", "postgresql+asyncpg")

engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=True,
    pool_size=5,
    max_overflow=10
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
