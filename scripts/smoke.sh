#!/usr/bin/env bash
set -euo pipefail

WEB_BASE_URL="${WEB_BASE_URL:-http://localhost:3000}"
API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-10}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
WITH_WRITE=0

usage() {
  cat <<'EOF'
Smoke checks for release validation.

Usage:
  bash scripts/smoke.sh [--with-write] [--web-base URL] [--api-base URL] [--admin-token TOKEN]

Options:
  --with-write         Run write checks for public forms (creates test records)
  --web-base URL       Override WEB base URL (default: http://localhost:3000)
  --api-base URL       Override API base URL (default: http://localhost:8000)
  --admin-token TOKEN  Optional admin JWT token for admin endpoint checks
  -h, --help           Show help

Env:
  WEB_BASE_URL, API_BASE_URL, ADMIN_TOKEN, SMOKE_TIMEOUT_SECONDS
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-write)
      WITH_WRITE=1
      shift
      ;;
    --web-base)
      WEB_BASE_URL="${2:-}"
      shift 2
      ;;
    --api-base)
      API_BASE_URL="${2:-}"
      shift 2
      ;;
    --admin-token)
      ADMIN_TOKEN="${2:-}"
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

WEB_BASE_URL="${WEB_BASE_URL%/}"
API_BASE_URL="${API_BASE_URL%/}"

ts() { date +"%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(ts)] $*"; }
ok() { echo "✅ $*"; }
fail() { echo "❌ $*" >&2; exit 1; }

request_expect() {
  local expected="$1"
  local method="$2"
  local url="$3"
  local body="${4:-}"
  local auth="${5:-}"
  local tmp
  tmp="$(mktemp)"

  local code
  if [[ -n "$body" ]]; then
    if [[ -n "$auth" ]]; then
      code="$(curl -sS -m "$SMOKE_TIMEOUT_SECONDS" -o "$tmp" -w "%{http_code}" \
        -X "$method" "$url" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $auth" \
        --data "$body")" || { rm -f "$tmp"; fail "Request failed: $method $url"; }
    else
      code="$(curl -sS -m "$SMOKE_TIMEOUT_SECONDS" -o "$tmp" -w "%{http_code}" \
        -X "$method" "$url" \
        -H "Content-Type: application/json" \
        --data "$body")" || { rm -f "$tmp"; fail "Request failed: $method $url"; }
    fi
  else
    if [[ -n "$auth" ]]; then
      code="$(curl -sS -m "$SMOKE_TIMEOUT_SECONDS" -o "$tmp" -w "%{http_code}" \
        -X "$method" "$url" \
        -H "Authorization: Bearer $auth")" || { rm -f "$tmp"; fail "Request failed: $method $url"; }
    else
      code="$(curl -sS -m "$SMOKE_TIMEOUT_SECONDS" -o "$tmp" -w "%{http_code}" \
        -X "$method" "$url")" || { rm -f "$tmp"; fail "Request failed: $method $url"; }
    fi
  fi

  if [[ "$code" != "$expected" ]]; then
    local preview
    preview="$(head -c 240 "$tmp" | tr '\n' ' ')"
    rm -f "$tmp"
    fail "$method $url -> expected $expected, got $code; body: $preview"
  fi

  rm -f "$tmp"
}

log "Smoke start"
log "WEB_BASE_URL=$WEB_BASE_URL"
log "API_BASE_URL=$API_BASE_URL"

request_expect "200" "GET" "$WEB_BASE_URL/"
ok "web home"

request_expect "200" "GET" "$API_BASE_URL/health"
ok "api health"

request_expect "200" "GET" "$API_BASE_URL/api/public/content"
ok "public content"

request_expect "200" "GET" "$API_BASE_URL/api/public/products?limit=1"
ok "catalog list"

request_expect "200" "GET" "$API_BASE_URL/api/public/products?search=test&limit=1"
ok "catalog search"

if [[ -n "$ADMIN_TOKEN" ]]; then
  request_expect "200" "GET" "$API_BASE_URL/api/admin/auth/me" "" "$ADMIN_TOKEN"
  ok "admin auth/me"
  request_expect "200" "GET" "$API_BASE_URL/api/admin/leads?limit=1" "" "$ADMIN_TOKEN"
  ok "admin leads list"
  request_expect "200" "GET" "$API_BASE_URL/api/admin/service-requests?limit=1" "" "$ADMIN_TOKEN"
  ok "admin service requests list"
else
  log "ADMIN_TOKEN is empty: skip admin checks"
fi

if [[ "$WITH_WRITE" -eq 1 ]]; then
  stamp="$(date +%s)"

  lead_payload="$(cat <<EOF
{"type":"callback","name":"Smoke Test","phone":"+7999000${stamp: -4}","message":"smoke callback","consent_given":true,"consent_version":"v1.0","consent_text":"smoke consent"}
EOF
)"
  request_expect "201" "POST" "$API_BASE_URL/api/public/leads" "$lead_payload"
  ok "public lead create"

  service_payload="$(cat <<EOF
{"vehicle_type":"passenger","service_type":"Диагностика","name":"Smoke Service","phone":"+7888000${stamp: -4}","description":"smoke service request","consent_given":true,"consent_version":"v1.0","consent_text":"smoke consent"}
EOF
)"
  request_expect "201" "POST" "$API_BASE_URL/api/public/service-requests" "$service_payload"
  ok "public service-request create"
else
  log "--with-write not set: skip write checks"
fi

log "Smoke done"
ok "all checks passed"
