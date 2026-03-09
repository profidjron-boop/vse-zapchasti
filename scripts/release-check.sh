#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="${BACKUP_DIR:-backups/postgres}"
RUN_WRITE_SMOKE=1
RELEASE_REQUIRE_ADMIN_SMOKE="${RELEASE_REQUIRE_ADMIN_SMOKE:-0}"
RELEASE_REQUIRE_HANDOFF_METADATA="${RELEASE_REQUIRE_HANDOFF_METADATA:-0}"

usage() {
  cat <<'EOF'
Release readiness check (backup + restore-check + smoke).

Usage:
  bash scripts/release-check.sh [--skip-write-smoke]

Options:
  --skip-write-smoke  Skip `scripts/smoke.sh --with-write`
  -h, --help          Show help

Env:
  BACKUP_DIR          Directory for backup dump (default: backups/postgres)
  ADMIN_TOKEN         Optional token for admin checks in smoke scripts
  SMOKE_ADMIN_EMAIL, SMOKE_ADMIN_PASSWORD
                     Optional admin credentials for smoke token resolution
  SMOKE_ADMIN_BOOTSTRAP
                     Optional (0/1). When unset and admin credentials are provided,
                     release-check enables bootstrap automatically.
  RELEASE_REQUIRE_ADMIN_SMOKE
                     1 = fail early if neither ADMIN_TOKEN nor admin credentials are set
  RELEASE_REQUIRE_HANDOFF_METADATA
                     1 = fail early if handoff metadata placeholders are still present
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-write-smoke)
      RUN_WRITE_SMOKE=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

ts() { date +"%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(ts)] $*"; }

if [[ "$RELEASE_REQUIRE_ADMIN_SMOKE" == "1" ]]; then
  if [[ -z "${ADMIN_TOKEN:-}" && ( -z "${SMOKE_ADMIN_EMAIL:-}" || -z "${SMOKE_ADMIN_PASSWORD:-}" ) ]]; then
    echo "❌ RELEASE_REQUIRE_ADMIN_SMOKE=1 but ADMIN_TOKEN or SMOKE_ADMIN_EMAIL+SMOKE_ADMIN_PASSWORD not provided" >&2
    exit 1
  fi
fi

if [[ "$RELEASE_REQUIRE_HANDOFF_METADATA" == "1" ]]; then
  log "release-check: handoff metadata strict check"
  bash docs/handoff.sh --strict
fi

if [[ -z "${SMOKE_ADMIN_BOOTSTRAP:-}" && -z "${ADMIN_TOKEN:-}" && -n "${SMOKE_ADMIN_EMAIL:-}" && -n "${SMOKE_ADMIN_PASSWORD:-}" ]]; then
  export SMOKE_ADMIN_BOOTSTRAP=1
  log "release-check: SMOKE_ADMIN_BOOTSTRAP not set, enabling bootstrap for admin smoke user"
fi

mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y%m%d_%H%M%S)"
backup_file="$BACKUP_DIR/release_${stamp}.dump"

log "release-check: verify-all"
bash ./scripts/verify-all.sh

log "release-check: dependency audit (api)"
(
  cd apps/api
  UV_CACHE_DIR=./.uv-cache ./.venv/bin/uv run --with pip-audit pip-audit --strict
)

log "release-check: dependency audit (web)"
pnpm --dir apps/web audit --prod --audit-level high

log "release-check: backup"
bash docs/backup.sh --output "$backup_file"

log "release-check: restore-check"
bash docs/restore-check.sh --input "$backup_file"

log "release-check: smoke (read)"
bash scripts/smoke.sh

if [[ "$RUN_WRITE_SMOKE" -eq 1 ]]; then
  log "release-check: smoke (write)"
  bash scripts/smoke.sh --with-write
fi

log "release-check: done"
echo "✅ RELEASE CHECK GREEN"
