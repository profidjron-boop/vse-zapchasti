# Codex Project Instructions — vse-zapchasti (RU Stack Lock)

## Context
Product: "Все запчасти" — магазин запчастей + запись на ремонт (легковая/грузовая).
Jurisdiction: РФ (152-ФЗ). Runtime: NO CDN (self-hosted assets). Region: РФ.

## Stack Lock
Frontend: Next.js (App Router) + TypeScript + React + Tailwind. Package manager: pnpm.
Backend: FastAPI + Pydantic v2 + Python 3.12+. DB: Postgres.
Deviations only via ADR.

## Working Style (Strict)
- One step = one change. Prefer smallest diffs.
- If you modify code, run verify next. Red verify = stop and fix until green.
- Do not invent commands. Use only repo facts:
  - Web tasks: VS Code Tasks "web:lint", "web:typecheck", "web:build" (or pnpm --dir apps/web run ...).
  - API verify commands must be taken from repo Makefile/scripts/docs/verify-gates.md.

## Quality / UX
- No MVP/DEMO/stubs. Buttons must not be dead.
- Empty/loading/error states are required.
- Premium UI: depth background, 2 surfaces, clear CTA x2, responsive.

## Output Discipline
- Prefer editing a single file per change.
- Summarize what changed and what to run next.
