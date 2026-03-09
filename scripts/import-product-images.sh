#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8000}"
IMAGES_DIR="${IMAGES_DIR:-}"
IMAGES_ARCHIVE="${IMAGES_ARCHIVE:-}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
IMPORT_ADMIN_EMAIL="${IMPORT_ADMIN_EMAIL:-}"
IMPORT_ADMIN_PASSWORD="${IMPORT_ADMIN_PASSWORD:-}"
SKIP_PRODUCTS_WITH_IMAGES="${SKIP_PRODUCTS_WITH_IMAGES:-1}"
DRY_RUN="${DRY_RUN:-0}"
ALLOW_SECONDARY_IMAGES="${ALLOW_SECONDARY_IMAGES:-0}"

TEMP_DIR=""

usage() {
  cat <<'EOF'
Import local product images by filename (SKU preferred, OEM fallback).

Supported source:
  - directory with images
  - zip archive with images

Filename rules:
  - <SKU>.jpg / .png / .webp ...
  - or <OEM>.jpg / .png / .webp ...

Examples:
  IMAGES_DIR=./imports/product-images \
  IMPORT_ADMIN_EMAIL=admin@vsezapchasti.ru \
  IMPORT_ADMIN_PASSWORD='Admin123!' \
  bash scripts/import-product-images.sh

  IMAGES_ARCHIVE=./imports/product-images.zip \
  ADMIN_TOKEN=... \
  ALLOW_SECONDARY_IMAGES=1 \
  bash scripts/import-product-images.sh

Options:
  --dir <path>           Source directory with images
  --zip <path>           Source zip archive with images
  --api <url>            API base url (default: http://127.0.0.1:8000)
  --skip-with-images     Skip products that already have at least one image (default)
  --allow-secondary      Attach images even if product already has images
  --dry-run              Do not upload/attach files, only show matches
  -h, --help             Show help
EOF
}

cleanup() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}
trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)
      IMAGES_DIR="${2:-}"
      shift 2
      ;;
    --zip)
      IMAGES_ARCHIVE="${2:-}"
      shift 2
      ;;
    --api)
      API_BASE_URL="${2:-}"
      shift 2
      ;;
    --skip-with-images)
      SKIP_PRODUCTS_WITH_IMAGES=1
      shift
      ;;
    --allow-secondary)
      ALLOW_SECONDARY_IMAGES=1
      SKIP_PRODUCTS_WITH_IMAGES=0
      shift
      ;;
    --dry-run)
      DRY_RUN=1
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

have() {
  command -v "$1" >/dev/null 2>&1
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

log() {
  echo "[images-import] $*"
}

require_prerequisites() {
  have curl || fail "curl is required"
  have python3 || fail "python3 is required"
  have find || fail "find is required"
  if [[ -n "$IMAGES_ARCHIVE" ]]; then
    have unzip || fail "unzip is required for zip archives"
  fi
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

  python3 - "$tmp" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
payload = json.loads(path.read_text(encoding="utf-8"))
print(str(payload.get("access_token", "")))
PY
  rm -f "$tmp"
}

resolve_source_dir() {
  if [[ -n "$IMAGES_DIR" && -n "$IMAGES_ARCHIVE" ]]; then
    fail "Use only one source: --dir or --zip"
  fi

  if [[ -n "$IMAGES_DIR" ]]; then
    [[ -d "$IMAGES_DIR" ]] || fail "Images directory not found: $IMAGES_DIR"
    echo "$IMAGES_DIR"
    return
  fi

  if [[ -n "$IMAGES_ARCHIVE" ]]; then
    [[ -f "$IMAGES_ARCHIVE" ]] || fail "Images archive not found: $IMAGES_ARCHIVE"
    TEMP_DIR="$(mktemp -d)"
    unzip -qq "$IMAGES_ARCHIVE" -d "$TEMP_DIR"
    echo "$TEMP_DIR"
    return
  fi

  fail "Provide IMAGES_DIR/--dir or IMAGES_ARCHIVE/--zip"
}

normalize_match_key() {
  python3 - "$1" <<'PY'
import re
import sys

value = sys.argv[1].strip().lower()
print(re.sub(r"[^0-9a-zа-яё]+", "", value))
PY
}

urlencode() {
  python3 - "$1" <<'PY'
from urllib.parse import quote
import sys

print(quote(sys.argv[1], safe=""))
PY
}

lookup_product_json() {
  local key="$1"
  local tmp_exact
  tmp_exact="$(mktemp)"
  local exact_code
  exact_code="$(curl -sS -o "$tmp_exact" -w "%{http_code}" \
    "$API_BASE_URL/api/public/products/by-sku/$(urlencode "$key")")" || {
      rm -f "$tmp_exact"
      return 1
    }

  if [[ "$exact_code" == "200" ]]; then
    cat "$tmp_exact"
    rm -f "$tmp_exact"
    return 0
  fi
  rm -f "$tmp_exact"

  local tmp_search
  tmp_search="$(mktemp)"
  local search_code
  search_code="$(curl -sS -o "$tmp_search" -w "%{http_code}" \
    "$API_BASE_URL/api/public/products?search=$(urlencode "$key")&limit=20")" || {
      rm -f "$tmp_search"
      return 1
    }
  if [[ "$search_code" != "200" ]]; then
    rm -f "$tmp_search"
    return 1
  fi

  python3 - "$tmp_search" "$key" <<'PY'
import json
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
needle = sys.argv[2].strip()

def norm(value: str) -> str:
    return re.sub(r"[^0-9a-zа-яё]+", "", value.strip().lower())

target = norm(needle)
payload = json.loads(path.read_text(encoding="utf-8"))
if not isinstance(payload, list):
    raise SystemExit(1)

for item in payload:
    if not isinstance(item, dict):
        continue
    sku = str(item.get("sku", ""))
    oem = str(item.get("oem", ""))
    if sku == needle or oem == needle or norm(sku) == target or norm(oem) == target:
      print(json.dumps(item, ensure_ascii=False))
      raise SystemExit(0)

raise SystemExit(1)
PY
  local status=$?
  rm -f "$tmp_search"
  return $status
}

json_field() {
  python3 - "$1" "$2" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
value = payload.get(sys.argv[2])
if value is None:
    print("")
elif isinstance(value, bool):
    print("true" if value else "false")
else:
    print(value)
PY
}

json_images_count() {
  python3 - "$1" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
images = payload.get("images")
print(len(images) if isinstance(images, list) else 0)
PY
}

upload_file() {
  local token="$1"
  local image_path="$2"
  local tmp
  tmp="$(mktemp)"
  local code
  code="$(curl -sS -o "$tmp" -w "%{http_code}" \
    -X POST "$API_BASE_URL/api/admin/upload" \
    -H "Authorization: Bearer $token" \
    -F "file=@${image_path}")" || {
      rm -f "$tmp"
      return 1
    }

  if [[ "$code" != "200" ]]; then
    cat "$tmp" >&2
    rm -f "$tmp"
    return 1
  fi

  python3 - "$tmp" <<'PY'
import json
import pathlib
import sys

payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
print(payload["url"])
PY
  rm -f "$tmp"
}

attach_image() {
  local token="$1"
  local product_id="$2"
  local image_url="$3"
  local sort_order="$4"
  local is_main="$5"

  local payload
  payload="$(python3 - "$image_url" "$sort_order" "$is_main" <<'PY'
import json
import sys

print(json.dumps({
    "url": sys.argv[1],
    "sort_order": int(sys.argv[2]),
    "is_main": sys.argv[3].lower() == "true",
}, ensure_ascii=False))
PY
)"

  local code
  code="$(curl -sS -o /tmp/import_product_image_attach.out -w "%{http_code}" \
    -X POST "$API_BASE_URL/api/admin/products/$product_id/images" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$payload")"

  if [[ "$code" != "201" ]]; then
    cat /tmp/import_product_image_attach.out >&2
    return 1
  fi
}

require_prerequisites
SOURCE_DIR="$(resolve_source_dir)"
TOKEN="$(resolve_admin_token)"
[[ -n "$TOKEN" ]] || fail "ADMIN_TOKEN or IMPORT_ADMIN_EMAIL + IMPORT_ADMIN_PASSWORD are required"

matched=0
uploaded=0
skipped_existing=0
unmatched=0
failed=0

log "source=$SOURCE_DIR"

while IFS= read -r -d '' image_path; do
  stem="$(basename "${image_path%.*}")"
  [[ -n "$stem" ]] || continue

  product_json="$(lookup_product_json "$stem" || true)"
  if [[ -z "$product_json" ]]; then
    log "unmatched: $(basename "$image_path")"
    unmatched=$((unmatched + 1))
    continue
  fi

  matched=$((matched + 1))
  product_id="$(json_field "$product_json" "id")"
  product_sku="$(json_field "$product_json" "sku")"
  images_count="$(json_images_count "$product_json")"

  if [[ "$SKIP_PRODUCTS_WITH_IMAGES" == "1" && "$images_count" -gt 0 ]]; then
    log "skip existing images: $(basename "$image_path") -> sku=$product_sku"
    skipped_existing=$((skipped_existing + 1))
    continue
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    log "dry-run match: $(basename "$image_path") -> sku=$product_sku id=$product_id existing_images=$images_count"
    continue
  fi

  image_url="$(upload_file "$TOKEN" "$image_path" || true)"
  if [[ -z "$image_url" ]]; then
    log "upload failed: $(basename "$image_path")"
    failed=$((failed + 1))
    continue
  fi

  sort_order="$images_count"
  is_main="false"
  if [[ "$images_count" -eq 0 ]]; then
    is_main="true"
  fi

  if attach_image "$TOKEN" "$product_id" "$image_url" "$sort_order" "$is_main"; then
    log "attached: $(basename "$image_path") -> sku=$product_sku url=$image_url"
    uploaded=$((uploaded + 1))
  else
    log "attach failed: $(basename "$image_path") -> sku=$product_sku"
    failed=$((failed + 1))
  fi
done < <(find "$SOURCE_DIR" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.gif' -o -iname '*.webp' -o -iname '*.svg' \) -print0)

echo
echo "matched=$matched"
echo "uploaded=$uploaded"
echo "skipped_existing=$skipped_existing"
echo "unmatched=$unmatched"
echo "failed=$failed"
