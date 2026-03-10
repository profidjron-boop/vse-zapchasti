#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://vsez:vsez_dev_password_change_me@localhost:5433/vsez}"
DRY_RUN=0

usage() {
  cat <<'EOF'
Reset branded public content to neutral showcase defaults.

This script removes public text blocks from `site_content`, so frontend
falls back to neutral template copy from code.

Usage:
  bash scripts/reset-neutral-showcase-content.sh [--dry-run]

Env:
  DATABASE_URL   SQLAlchemy URL for Postgres connection.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -x "apps/api/.venv/bin/uv" ]]; then
  echo "apps/api/.venv/bin/uv not found" >&2
  exit 1
fi

(
  cd apps/api
  ./.venv/bin/uv run python - <<'PY'
import os
from sqlalchemy import create_engine, text

database_url = os.environ["DATABASE_URL"]
dry_run = os.environ.get("DRY_RUN", "0") == "1"
prefixes = (
    "home_",
    "contacts_",
    "about_",
    "service_",
    "parts_",
    "vin_",
    "cart_",
    "favorites_",
    "orders_",
    "site_",
    "privacy_",
    "offer_",
)

like_sql = " OR ".join([f"key LIKE :p{i}" for i in range(len(prefixes))])
params = {f"p{i}": f"{prefix}%" for i, prefix in enumerate(prefixes)}

engine = create_engine(database_url)
with engine.begin() as conn:
    before = conn.execute(
        text(f"SELECT count(*) FROM site_content WHERE {like_sql}"),
        params,
    ).scalar_one()
    print(f"matching_rows={before}")
    if dry_run:
        print("dry_run=1 => no changes applied")
    else:
        deleted = conn.execute(
            text(f"DELETE FROM site_content WHERE {like_sql}"),
            params,
        ).rowcount or 0
        after = conn.execute(
            text(f"SELECT count(*) FROM site_content WHERE {like_sql}"),
            params,
        ).scalar_one()
        print(f"deleted_rows={deleted}")
        print(f"remaining_rows={after}")
PY
)
