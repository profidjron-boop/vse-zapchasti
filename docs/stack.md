# Stack (RU Stack Lock) — Все запчасти

**Mode:** Strict  
**Region:** РФ (data+infra in РФ)  
**Runtime policy:** **NO CDN** — все ассеты (JS/CSS/Images/Fonts) только self-hosted.  
**Licenses default:** MIT / Apache-2.0 / BSD / OFL (GPL/AGPL только через ADR).

## Frontend
- TypeScript 5.x (strict)
- React 18+
- Next.js 14+ (App Router)
- Tailwind CSS 3+
- Package manager: pnpm
- Tests: Vitest (unit), Playwright (e2e — только если потребуется и будет добавлено)
- Lint/format: ESLint + Prettier (по факту репо)

## Backend
- Python 3.12+
- FastAPI (stable)
- Pydantic v2
- SQLAlchemy 2.x + Alembic
- Tests: Pytest (+ asyncio)

## Data
- PostgreSQL 15+
- Redis 7+ (только если потребуется по scope, фиксируется ADR)

## Infra (RF)
- Linux VPS РФ (YC/Selectel/Timeweb и т.п.)
- Docker + Docker Compose
- Nginx reverse proxy + TLS (Let’s Encrypt)

