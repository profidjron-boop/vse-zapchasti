#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-vsez}"
POSTGRES_USER="${POSTGRES_USER:-vsez}"
RESTORE_DB="${RESTORE_DB:-${POSTGRES_DB}_restore_check}"
INPUT_FILE=""
KEEP_DB=0

usage() {
  cat <<'EOF'
Verify Postgres backup restore using docker compose service.

Usage:
  bash docs/restore-check.sh --input backups/postgres/<file>.dump [--keep-db]

Options:
  --input FILE  Path to backup file created by docs/backup.sh (required)
  --keep-db     Keep temporary restore DB after successful check
  -h, --help    Show help

Env:
  POSTGRES_SERVICE  Docker compose service name (default: postgres)
  POSTGRES_DB       Main database name (default: vsez)
  POSTGRES_USER     Database user (default: vsez)
  RESTORE_DB        Temporary restore database name (default: vsez_restore_check)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      INPUT_FILE="${2:-}"
      shift 2
      ;;
    --keep-db)
      KEEP_DB=1
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

[[ -n "$INPUT_FILE" ]] || {
  echo "--input is required" >&2
  usage
  exit 1
}

[[ -f "$INPUT_FILE" ]] || {
  echo "Backup file not found: $INPUT_FILE" >&2
  exit 1
}

[[ "$RESTORE_DB" =~ ^[a-zA-Z0-9_]+$ ]] || {
  echo "RESTORE_DB must contain only [a-zA-Z0-9_]" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || {
  echo "docker is required" >&2
  exit 1
}

echo "[restore-check] ensuring postgres service is running"
docker compose up -d "$POSTGRES_SERVICE" >/dev/null

echo "[restore-check] recreating temporary database: $RESTORE_DB"
docker compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${RESTORE_DB}' AND pid <> pg_backend_pid();" >/dev/null
docker compose exec -T "$POSTGRES_SERVICE" dropdb --if-exists -U "$POSTGRES_USER" "$RESTORE_DB"
docker compose exec -T "$POSTGRES_SERVICE" createdb -U "$POSTGRES_USER" "$RESTORE_DB"

echo "[restore-check] restoring dump: $INPUT_FILE"
cat "$INPUT_FILE" | docker compose exec -T "$POSTGRES_SERVICE" pg_restore -U "$POSTGRES_USER" -d "$RESTORE_DB" --clean --if-exists

table_count="$(
  docker compose exec -T "$POSTGRES_SERVICE" \
    psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" \
    | tr -d '[:space:]'
)"

if [[ -z "$table_count" || "$table_count" == "0" ]]; then
  echo "[restore-check] failed: restored DB has no public tables" >&2
  exit 1
fi

revision="$(
  docker compose exec -T "$POSTGRES_SERVICE" \
    psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -tAc "SELECT version_num FROM alembic_version LIMIT 1;" 2>/dev/null \
    | tr -d '[:space:]' || true
)"

echo "[restore-check] ok: restored tables=$table_count"
if [[ -n "$revision" ]]; then
  echo "[restore-check] alembic_version=$revision"
fi

if [[ "$KEEP_DB" -eq 0 ]]; then
  echo "[restore-check] dropping temporary database: $RESTORE_DB"
  docker compose exec -T "$POSTGRES_SERVICE" dropdb --if-exists -U "$POSTGRES_USER" "$RESTORE_DB"
else
  echo "[restore-check] keeping temporary database: $RESTORE_DB"
fi
