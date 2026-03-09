# Audit Closure — 2026-03-09

## Scope
- Repo: `vse-zapchasti`
- Baseline: findings `F-01..F-08` from project audit
- Validation date: `2026-03-09`

## Current Result
- Status: `RELEASE CHECK GREEN` (including full smoke path with admin + write checks)
- Runtime: `runtime-audit` green for public + admin protected routes
- API tests: `67 passed`
- Coverage snapshot:
  - `main.py`: `84%`
  - `routers/admin.py`: `64%`
  - `routers/public.py`: `80%`
  - total: `70%`

## Findings Closure

### F-01 (ecdsa / CVE-2024-23342)
- State: `Closed`
- Evidence:
  - `pip-audit` shows `No known vulnerabilities found`
  - `ecdsa` is not present in current `apps/api` environment/lock path

### F-02 (notifications dynamic URL handling)
- State: `Closed`
- Evidence:
  - webhook URL validation includes:
    - scheme checks
    - host allowlist (`NOTIFY_WEBHOOK_ALLOWED_HOSTS`)
  - send path uses `httpx` with controlled request behavior

### F-03 (XML parsing in admin import path)
- State: `Closed`
- Evidence:
  - XLSX XML parsing uses `defusedxml`
  - bounded zip entry size / compression ratio checks are present

### F-04 (JS lockfile / audit path)
- State: `Closed`
- Evidence:
  - Web dependency audit runs against `apps/web/pnpm-lock.yaml`
  - `release-check` includes `pnpm --dir apps/web audit --prod --audit-level high`

### F-05 (coverage gaps in routers/main)
- State: `Closed (target achieved)`
- Evidence:
  - added targeted tests for critical admin/public flows
  - coverage increased to:
    - `routers/admin.py`: `64%` (from low baseline)
    - `routers/public.py`: `80%`
    - `main.py`: `84%`

### F-06 (shell hygiene in import script)
- State: `Closed`
- Evidence:
  - query-string assembly in `scripts/import-products.sh` is explicit and safe
  - no legacy `IFS` query hack remains

### F-07 (rate-limit fallback logging)
- State: `Closed`
- Evidence:
  - redis fallback in `apps/api/routers/public.py` logs warning with context

### F-08 (complexity hotspots)
- State: `Closed`
- Evidence:
  - `admin.py` hotspots were decomposed into helper functions
  - remaining critical-path functions are out of `C/F` hotspot class

## Additional Fix Applied
- `scripts/smoke.sh`:
  - fixed full release path by passing `DATABASE_URL` during smoke-admin bootstrap hash generation
  - verified by successful full `release-check` run with:
    - `SMOKE_ADMIN_BOOTSTRAP=1`
    - `SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD`

## Final Verdict
- Project status: `strong release-candidate / production-ready gate set`
- Remaining risk: mostly operational/process (continuous monitoring), not blocking code-quality or release-path issues.
