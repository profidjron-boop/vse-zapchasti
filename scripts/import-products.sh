#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8000}"
IMPORT_MODE="${IMPORT_MODE:-auto}"   # auto/manual/hourly/daily/event
IMPORT_EVENT_TRIGGER=0
IMPORT_SERVER_SOURCE=0
IMPORT_FILE_PATH="${IMPORT_FILE_PATH:-}"
IMPORT_SOURCE_URL="${IMPORT_SOURCE_URL:-}"
IMPORT_SOURCE_AUTH_HEADER="${IMPORT_SOURCE_AUTH_HEADER:-}"
IMPORT_SOURCE_USERNAME="${IMPORT_SOURCE_USERNAME:-}"
IMPORT_SOURCE_PASSWORD="${IMPORT_SOURCE_PASSWORD:-}"
IMPORT_DEFAULT_CATEGORY_ID="${IMPORT_DEFAULT_CATEGORY_ID:-}"
IMPORT_SKIP_INVALID="${IMPORT_SKIP_INVALID:-0}"
IMPORT_CONNECT_TIMEOUT_SECONDS="${IMPORT_CONNECT_TIMEOUT_SECONDS:-5}"
IMPORT_HTTP_TIMEOUT_SECONDS="${IMPORT_HTTP_TIMEOUT_SECONDS:-30}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
IMPORT_ADMIN_EMAIL="${IMPORT_ADMIN_EMAIL:-}"
IMPORT_ADMIN_PASSWORD="${IMPORT_ADMIN_PASSWORD:-}"

usage() {
  cat <<'EOF'
Catalog import trigger (manual/scheduled/event) via existing admin API.

Usage:
  bash scripts/import-products.sh [options]

Options:
  --file <path>            CSV/XLSX file path (or env IMPORT_FILE_PATH)
  --source-url <url>       Download CSV/XLSX from 1C/ERP URL before import
  --source-auth <value>    Authorization header for source URL (optional)
  --mode <mode>            auto/manual/hourly/daily/event (default: auto)
  --event                  Mark this run as event-triggered (required when mode=event)
  --server-source          Trigger API-side source import (uses API env IMPORT_SOURCE_*)
  --api <url>              API base url (default: http://127.0.0.1:8000)
  --default-category-id N  Fallback category id for rows without category
  --skip-invalid           Use skip_invalid=1 (default strict)
  -h, --help               Show help

Env for auth:
  ADMIN_TOKEN
  or IMPORT_ADMIN_EMAIL + IMPORT_ADMIN_PASSWORD

Env for source sync:
  IMPORT_SOURCE_URL
  IMPORT_SOURCE_AUTH_HEADER
  IMPORT_SOURCE_USERNAME + IMPORT_SOURCE_PASSWORD

Optional network timeout tuning:
  IMPORT_CONNECT_TIMEOUT_SECONDS (default: 5)
  IMPORT_HTTP_TIMEOUT_SECONDS (default: 30)

Examples:
  IMPORT_FILE_PATH=./imports/products.xlsx ADMIN_TOKEN=... bash scripts/import-products.sh --mode hourly
  IMPORT_FILE_PATH=./imports/products.csv IMPORT_ADMIN_EMAIL=admin@x IMPORT_ADMIN_PASSWORD=... bash scripts/import-products.sh --mode event --event
  IMPORT_ADMIN_EMAIL=admin@x IMPORT_ADMIN_PASSWORD=... bash scripts/import-products.sh --mode event --event --server-source
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)
      IMPORT_FILE_PATH="${2:-}"
      shift 2
      ;;
    --source-url)
      IMPORT_SOURCE_URL="${2:-}"
      shift 2
      ;;
    --source-auth)
      IMPORT_SOURCE_AUTH_HEADER="${2:-}"
      shift 2
      ;;
    --mode)
      IMPORT_MODE="${2:-}"
      shift 2
      ;;
    --event)
      IMPORT_EVENT_TRIGGER=1
      shift
      ;;
    --server-source)
      IMPORT_SERVER_SOURCE=1
      shift
      ;;
    --api)
      API_BASE_URL="${2:-}"
      shift 2
      ;;
    --default-category-id)
      IMPORT_DEFAULT_CATEGORY_ID="${2:-}"
      shift 2
      ;;
    --skip-invalid)
      IMPORT_SKIP_INVALID=1
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

TEMP_IMPORT_FILE=""
cleanup() {
  if [[ -n "$TEMP_IMPORT_FILE" && -f "$TEMP_IMPORT_FILE" ]]; then
    rm -f "$TEMP_IMPORT_FILE"
  fi
}
trap cleanup EXIT

normalize_mode() {
  local raw="${1:-}"
  local normalized
  normalized="$(echo "$raw" | tr '[:upper:]' '[:lower:]' | xargs)"
  case "$normalized" in
    manual|hourly|daily|event)
      echo "$normalized"
      ;;
    *)
      echo "manual"
      ;;
  esac
}

read_mode_from_public_content() {
  local payload
  payload="$(curl -fsS \
    --connect-timeout "$IMPORT_CONNECT_TIMEOUT_SECONDS" \
    --max-time "$IMPORT_HTTP_TIMEOUT_SECONDS" \
    "$API_BASE_URL/api/public/content" || true)"
  if [[ -z "$payload" ]]; then
    echo "manual"
    return
  fi

  python - "$payload" <<'PY'
import json
import sys

raw = sys.argv[1]
try:
    rows = json.loads(raw)
except Exception:
    print("manual")
    raise SystemExit(0)

if not isinstance(rows, list):
    print("manual")
    raise SystemExit(0)

mode = "manual"
for row in rows:
    if not isinstance(row, dict):
        continue
    if str(row.get("key", "")).strip() == "import_products_update_mode":
        value = str(row.get("value", "")).strip().lower()
        if value in {"manual", "hourly", "daily", "event"}:
            mode = value
        break

print(mode)
PY
}

resolve_admin_token() {
  if [[ -n "$ADMIN_TOKEN" ]]; then
    echo "$ADMIN_TOKEN"
    return
  fi

  if [[ -z "$IMPORT_ADMIN_EMAIL" || -z "$IMPORT_ADMIN_PASSWORD" ]]; then
    echo ""
    return
  fi

  local tmp
  tmp="$(mktemp)"
  local code
  code="$(curl -sS -o "$tmp" -w "%{http_code}" \
    --connect-timeout "$IMPORT_CONNECT_TIMEOUT_SECONDS" \
    --max-time "$IMPORT_HTTP_TIMEOUT_SECONDS" \
    -X POST "$API_BASE_URL/api/admin/auth/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "username=$IMPORT_ADMIN_EMAIL" \
    --data-urlencode "password=$IMPORT_ADMIN_PASSWORD")" || {
      rm -f "$tmp"
      echo ""
      return
    }

  if [[ "$code" != "200" ]]; then
    rm -f "$tmp"
    echo ""
    return
  fi

  python - "$tmp" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
try:
    payload = json.loads(path.read_text(encoding="utf-8"))
except Exception:
    print("")
    raise SystemExit(0)
print(str(payload.get("access_token", "")))
PY
  rm -f "$tmp"
}

resolve_import_file() {
  if [[ -n "$IMPORT_FILE_PATH" ]]; then
    return
  fi

  if [[ -z "$IMPORT_SOURCE_URL" ]]; then
    return
  fi

  local lower_url
  lower_url="$(echo "$IMPORT_SOURCE_URL" | tr '[:upper:]' '[:lower:]')"
  local extension=".csv"
  if [[ "$lower_url" == *.xlsx* ]]; then
    extension=".xlsx"
  fi

  TEMP_IMPORT_FILE="$(mktemp --suffix "$extension")"

  local curl_args=("-fL" "-sS" "-o" "$TEMP_IMPORT_FILE")
  curl_args+=("--connect-timeout" "$IMPORT_CONNECT_TIMEOUT_SECONDS" "--max-time" "$IMPORT_HTTP_TIMEOUT_SECONDS")
  if [[ -n "$IMPORT_SOURCE_AUTH_HEADER" ]]; then
    curl_args+=("-H" "Authorization: $IMPORT_SOURCE_AUTH_HEADER")
  fi
  if [[ -n "$IMPORT_SOURCE_USERNAME" || -n "$IMPORT_SOURCE_PASSWORD" ]]; then
    curl_args+=("-u" "${IMPORT_SOURCE_USERNAME}:${IMPORT_SOURCE_PASSWORD}")
  fi

  echo "ℹ️ downloading import source: $IMPORT_SOURCE_URL"
  if ! curl "${curl_args[@]}" "$IMPORT_SOURCE_URL"; then
    echo "❌ Failed to download import source URL" >&2
    exit 1
  fi

  IMPORT_FILE_PATH="$TEMP_IMPORT_FILE"
}

mode_candidate="$IMPORT_MODE"
if [[ "$(normalize_mode "$mode_candidate")" == "manual" && "$(echo "$mode_candidate" | tr '[:upper:]' '[:lower:]' | xargs)" == "auto" ]]; then
  mode_candidate="$(read_mode_from_public_content)"
fi
mode="$(normalize_mode "$mode_candidate")"

if [[ "$mode" == "manual" ]]; then
  echo "ℹ️ import mode=manual, scheduler/event trigger skipped"
  exit 0
fi

if [[ "$mode" == "event" && "$IMPORT_EVENT_TRIGGER" -ne 1 ]]; then
  echo "ℹ️ import mode=event, but --event flag was not provided; skipped"
  exit 0
fi

if [[ -n "$IMPORT_DEFAULT_CATEGORY_ID" && ! "$IMPORT_DEFAULT_CATEGORY_ID" =~ ^[0-9]+$ ]]; then
  echo "❌ IMPORT_DEFAULT_CATEGORY_ID must be a non-negative integer" >&2
  exit 1
fi
if [[ ! "$IMPORT_CONNECT_TIMEOUT_SECONDS" =~ ^[0-9]+$ || "$IMPORT_CONNECT_TIMEOUT_SECONDS" -le 0 ]]; then
  echo "❌ IMPORT_CONNECT_TIMEOUT_SECONDS must be a positive integer" >&2
  exit 1
fi
if [[ ! "$IMPORT_HTTP_TIMEOUT_SECONDS" =~ ^[0-9]+$ || "$IMPORT_HTTP_TIMEOUT_SECONDS" -le 0 ]]; then
  echo "❌ IMPORT_HTTP_TIMEOUT_SECONDS must be a positive integer" >&2
  exit 1
fi

if [[ "$IMPORT_SERVER_SOURCE" != "1" ]]; then
  resolve_import_file

  if [[ -z "$IMPORT_FILE_PATH" ]]; then
    echo "❌ IMPORT_FILE_PATH or IMPORT_SOURCE_URL is required for mode=$mode" >&2
    exit 1
  fi

  if [[ ! -f "$IMPORT_FILE_PATH" ]]; then
    echo "❌ Import file not found: $IMPORT_FILE_PATH" >&2
    exit 1
  fi
fi

token="$(resolve_admin_token)"
if [[ -z "$token" ]]; then
  echo "❌ ADMIN_TOKEN is not set and cannot resolve token via IMPORT_ADMIN_EMAIL/IMPORT_ADMIN_PASSWORD" >&2
  exit 1
fi

if [[ "$IMPORT_SERVER_SOURCE" == "1" ]]; then
  endpoint="$API_BASE_URL/api/admin/products/import-from-source?trigger_mode=$mode"
else
  endpoint="$API_BASE_URL/api/admin/products/import?trigger_mode=$mode"
fi
if [[ "$IMPORT_SKIP_INVALID" == "1" ]]; then
  endpoint="${endpoint}&skip_invalid=true"
fi
if [[ -n "$IMPORT_DEFAULT_CATEGORY_ID" ]]; then
  endpoint="${endpoint}&default_category_id=$IMPORT_DEFAULT_CATEGORY_ID"
fi

tmp="$(mktemp)"
if [[ "$IMPORT_SERVER_SOURCE" == "1" ]]; then
  code="$(curl -sS -o "$tmp" -w "%{http_code}" \
    --connect-timeout "$IMPORT_CONNECT_TIMEOUT_SECONDS" \
    --max-time "$IMPORT_HTTP_TIMEOUT_SECONDS" \
    -X POST "$endpoint" \
    -H "Authorization: Bearer $token")"
else
  code="$(curl -sS -o "$tmp" -w "%{http_code}" \
    --connect-timeout "$IMPORT_CONNECT_TIMEOUT_SECONDS" \
    --max-time "$IMPORT_HTTP_TIMEOUT_SECONDS" \
    -X POST "$endpoint" \
    -H "Authorization: Bearer $token" \
    -F "file=@$IMPORT_FILE_PATH")"
fi

if [[ "$code" != "200" ]]; then
  echo "❌ Import failed with HTTP $code" >&2
  head -c 500 "$tmp" >&2 || true
  echo >&2
  rm -f "$tmp"
  exit 1
fi

if [[ "$IMPORT_SERVER_SOURCE" == "1" ]]; then
  echo "✅ Import finished (mode=$mode, source=api-env)"
else
  echo "✅ Import finished (mode=$mode)"
fi
python - "$tmp" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
payload = json.loads(path.read_text(encoding="utf-8"))
print(
    f"run_id={payload.get('run_id')} created={payload.get('created')} "
    f"updated={payload.get('updated')} failed={payload.get('failed')}"
)
PY
rm -f "$tmp"
