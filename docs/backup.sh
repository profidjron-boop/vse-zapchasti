#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="${BACKUP_DIR:-backups/postgres}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-vsez}"
POSTGRES_USER="${POSTGRES_USER:-vsez}"
OUTPUT_FILE=""

usage() {
  cat <<'EOF'
Create Postgres backup from docker compose service.

Usage:
  bash docs/backup.sh [--output FILE]

Options:
  --output FILE  Full path to output dump file (.dump)
  -h, --help     Show help

Env:
  BACKUP_DIR        Directory for generated dump (default: backups/postgres)
  POSTGRES_SERVICE  Docker compose service name (default: postgres)
  POSTGRES_DB       Database name (default: vsez)
  POSTGRES_USER     Database user (default: vsez)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      OUTPUT_FILE="${2:-}"
      shift 2
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

command -v docker >/dev/null 2>&1 || {
  echo "docker is required" >&2
  exit 1
}

mkdir -p "$BACKUP_DIR"

if [[ -z "$OUTPUT_FILE" ]]; then
  stamp="$(date +%Y%m%d_%H%M%S)"
  OUTPUT_FILE="$BACKUP_DIR/${POSTGRES_DB}_${stamp}.dump"
fi

echo "[backup] ensuring postgres service is running"
docker compose up -d "$POSTGRES_SERVICE" >/dev/null

echo "[backup] creating dump: $OUTPUT_FILE"
docker compose exec -T "$POSTGRES_SERVICE" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-privileges \
  > "$OUTPUT_FILE"

checksum_file="${OUTPUT_FILE}.sha256"
sha256sum "$OUTPUT_FILE" > "$checksum_file"

echo "[backup] done"
echo "[backup] sha256: $checksum_file"
echo
echo "Restore example:"
echo "  docker compose exec -T $POSTGRES_SERVICE createdb -U $POSTGRES_USER ${POSTGRES_DB}_restore"
echo "  cat $OUTPUT_FILE | docker compose exec -T $POSTGRES_SERVICE pg_restore -U $POSTGRES_USER -d ${POSTGRES_DB}_restore --clean --if-exists"
