#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="${BACKUP_DIR:-backups/postgres}"
RUN_WRITE_SMOKE=1

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

mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y%m%d_%H%M%S)"
backup_file="$BACKUP_DIR/release_${stamp}.dump"

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
