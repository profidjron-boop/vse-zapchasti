#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

WEB_HOST="${WEB_HOST:-127.0.0.1}"
WEB_PORT="${WEB_PORT:-3000}"
API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-8000}"
WEB_BASE_URL="${WEB_BASE_URL:-http://${WEB_HOST}:${WEB_PORT}}"
API_BASE_URL="${API_BASE_URL:-http://${API_HOST}:${API_PORT}}"
DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://vsez:vsez_dev_password_change_me@localhost:5433/vsez}"
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-10}"
STARTUP_TIMEOUT_SECONDS="${STARTUP_TIMEOUT_SECONDS:-120}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
SMOKE_ADMIN_EMAIL="${SMOKE_ADMIN_EMAIL:-}"
SMOKE_ADMIN_PASSWORD="${SMOKE_ADMIN_PASSWORD:-}"
SMOKE_ADMIN_BOOTSTRAP="${SMOKE_ADMIN_BOOTSTRAP:-0}"
WITH_WRITE=0
API_PID=""
WEB_PID=""
API_LOG=""
WEB_LOG=""

usage() {
  cat <<'EOF'
Smoke checks for release validation.

Usage:
  bash scripts/smoke.sh [--with-write] [--web-base URL] [--api-base URL] [--admin-token TOKEN]

Options:
  --with-write         Run extra write checks for public leads endpoint
  --web-base URL       Override WEB base URL (default: http://localhost:3000)
  --api-base URL       Override API base URL (default: http://localhost:8000)
  --admin-token TOKEN  Optional admin JWT token for admin endpoint checks
  -h, --help           Show help

Env:
  WEB_BASE_URL, API_BASE_URL, WEB_HOST, WEB_PORT, API_HOST, API_PORT, DATABASE_URL,
  ADMIN_TOKEN, SMOKE_ADMIN_EMAIL, SMOKE_ADMIN_PASSWORD, SMOKE_ADMIN_BOOTSTRAP,
  SMOKE_TIMEOUT_SECONDS, STARTUP_TIMEOUT_SECONDS
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
have() { command -v "$1" >/dev/null 2>&1; }

cleanup() {
  if [[ -n "$WEB_PID" ]] && kill -0 "$WEB_PID" >/dev/null 2>&1; then
    kill "$WEB_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

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

wait_for_http() {
  local expected="$1"
  local method="$2"
  local url="$3"
  local label="$4"
  local pid="${5:-}"
  local log_file="${6:-}"
  local deadline=$(( $(date +%s) + STARTUP_TIMEOUT_SECONDS ))
  local code

  while [[ "$(date +%s)" -lt "$deadline" ]]; do
    if [[ -n "$pid" ]] && ! kill -0 "$pid" >/dev/null 2>&1; then
      if [[ -n "$log_file" && -f "$log_file" ]]; then
        log "$label process exited early, last logs:"
        tail -n 40 "$log_file" || true
      fi
      fail "$label process exited before readiness check"
    fi

    code="$(curl -s -m "$SMOKE_TIMEOUT_SECONDS" -o /dev/null -w "%{http_code}" -X "$method" "$url" 2>/dev/null || true)"
    if [[ "$code" == "$expected" ]]; then
      ok "$label"
      return 0
    fi
    sleep 1
  done

  if [[ -n "$log_file" && -f "$log_file" ]]; then
    log "Timeout waiting for $label, last logs:"
    tail -n 40 "$log_file" || true
  fi

  fail "Timeout waiting for $label at $url"
}

assert_port_free() {
  local host="$1"
  local port="$2"
  local label="$3"

  if (echo >/dev/tcp/"$host"/"$port") >/dev/null 2>&1; then
    fail "$label port ${host}:${port} is already in use. Stop existing process or override ${label}_PORT."
  fi
}

resolve_admin_token() {
  if [[ -n "$ADMIN_TOKEN" ]]; then
    return 0
  fi

  if [[ -z "$SMOKE_ADMIN_EMAIL" || -z "$SMOKE_ADMIN_PASSWORD" ]]; then
    return 0
  fi

  log "ADMIN_TOKEN is empty: requesting admin token via credentials"

  local tmp
  tmp="$(mktemp)"

  local code
  code="$(curl -sS -m "$SMOKE_TIMEOUT_SECONDS" -o "$tmp" -w "%{http_code}" \
    -X POST "$API_BASE_URL/api/admin/auth/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "username=$SMOKE_ADMIN_EMAIL" \
    --data-urlencode "password=$SMOKE_ADMIN_PASSWORD")" || {
      rm -f "$tmp"
      fail "Request failed: POST $API_BASE_URL/api/admin/auth/token"
    }

  if [[ "$code" != "200" ]]; then
    local preview
    preview="$(head -c 240 "$tmp" | tr '\n' ' ')"
    rm -f "$tmp"
    fail "Admin token request failed: expected 200, got $code; body: $preview"
  fi

  ADMIN_TOKEN="$(
    apps/api/.venv/bin/python -c \
      'import json,sys; print((json.load(open(sys.argv[1])) or {}).get("access_token",""))' \
      "$tmp"
  )"
  rm -f "$tmp"

  if [[ -z "$ADMIN_TOKEN" ]]; then
    fail "Admin token response does not contain access_token"
  fi
}

bootstrap_smoke_admin_user() {
  if [[ "$SMOKE_ADMIN_BOOTSTRAP" != "1" ]]; then
    return 0
  fi

  if [[ -z "$SMOKE_ADMIN_EMAIL" || -z "$SMOKE_ADMIN_PASSWORD" ]]; then
    fail "SMOKE_ADMIN_BOOTSTRAP=1 requires SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD"
  fi

  log "Ensuring dedicated smoke admin user exists"

  local password_hash
  password_hash="$(
    (
      cd apps/api
      DATABASE_URL="$DATABASE_URL" JWT_SECRET_KEY="${JWT_SECRET_KEY:-dev_smoke_secret_change_me}" ./.venv/bin/python -c \
        "from routers.admin import get_password_hash; print(get_password_hash('${SMOKE_ADMIN_PASSWORD}'))"
    )
  )"

  docker compose exec -T postgres psql -U vsez -d vsez -v ON_ERROR_STOP=1 \
    -c "INSERT INTO users (email, password_hash, name, role, is_active, created_at, updated_at) VALUES ('${SMOKE_ADMIN_EMAIL}', '${password_hash}', 'Smoke Admin', 'admin', true, NOW(), NOW()) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', is_active = true, updated_at = NOW();" >/dev/null
  ok "smoke admin ready"
}

require_prerequisites() {
  have curl || fail "curl is required"
  have docker || fail "docker is required"
  have pnpm || fail "pnpm is required"
  [[ -x "apps/api/.venv/bin/uv" ]] || fail "apps/api/.venv/bin/uv not found"
}

start_postgres() {
  log "Starting postgres via docker compose"
  docker compose up -d postgres >/dev/null
  ok "postgres up"
}

start_api() {
  assert_port_free "$API_HOST" "$API_PORT" "API"
  API_LOG="$(mktemp)"
  log "Starting API on $API_BASE_URL"
  (
    cd apps/api
    DATABASE_URL="$DATABASE_URL" JWT_SECRET_KEY="${JWT_SECRET_KEY:-dev_smoke_secret_change_me}" UPLOAD_DIR="${UPLOAD_DIR:-apps/web/public/uploads}" ./.venv/bin/uv run alembic upgrade head
    DATABASE_URL="$DATABASE_URL" JWT_SECRET_KEY="${JWT_SECRET_KEY:-dev_smoke_secret_change_me}" UPLOAD_DIR="${UPLOAD_DIR:-apps/web/public/uploads}" ./.venv/bin/uv run uvicorn main:app --host "$API_HOST" --port "$API_PORT"
  ) >"$API_LOG" 2>&1 &
  API_PID=$!
  wait_for_http "200" "GET" "$API_BASE_URL/health" "api health ready" "$API_PID" "$API_LOG"
}

start_web() {
  assert_port_free "$WEB_HOST" "$WEB_PORT" "WEB"
  WEB_LOG="$(mktemp)"
  log "Building web"
  pnpm --dir apps/web run build >/dev/null
  ok "web build"

  log "Starting web on $WEB_BASE_URL"
  (
    API_BASE_URL="$API_BASE_URL" NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" \
      pnpm --dir apps/web exec next start --hostname "$WEB_HOST" --port "$WEB_PORT"
  ) >"$WEB_LOG" 2>&1 &
  WEB_PID=$!
  wait_for_http "200" "GET" "$WEB_BASE_URL/" "web ready" "$WEB_PID" "$WEB_LOG"
}

log "Smoke start"
log "WEB_BASE_URL=$WEB_BASE_URL"
log "API_BASE_URL=$API_BASE_URL"

require_prerequisites
start_postgres
start_api
start_web

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

stamp="$(date +%s)"
service_payload="$(cat <<EOF
{"vehicle_type":"passenger","service_type":"Диагностика","name":"Smoke Service","phone":"+7888000${stamp: -4}","description":"smoke service request","consent_given":true,"consent_version":"v1.0"}
EOF
)"
request_expect "201" "POST" "$API_BASE_URL/api/public/service-requests" "$service_payload"
ok "public service-request create"

order_phone="+7991000${stamp: -4}"
order_payload="$(cat <<EOF
{"source":"one_click","customer_name":"Smoke Order","customer_phone":"$order_phone","consent_given":true,"consent_version":"v1.0","items":[{"product_name":"Smoke Item","quantity":1}]}
EOF
)"
request_expect "201" "POST" "$API_BASE_URL/api/public/orders" "$order_payload"
ok "public order create"

encoded_order_phone="${order_phone/+/%2B}"
request_expect "200" "GET" "$API_BASE_URL/api/public/orders/history?phone=${encoded_order_phone}&limit=1"
ok "public order history"

checkout_phone="+7992000${stamp: -4}"
checkout_payload="$(cat <<EOF
{"source":"checkout","customer_name":"Smoke Checkout","customer_phone":"$checkout_phone","delivery_method":"pickup","payment_method":"invoice","legal_entity_name":"ООО Тест","legal_entity_inn":"2465001234","consent_given":true,"consent_version":"v1.0","items":[{"product_name":"Smoke Checkout Item","quantity":1}]}
EOF
)"
request_expect "201" "POST" "$API_BASE_URL/api/public/orders" "$checkout_payload"
ok "public checkout order create"

encoded_checkout_phone="${checkout_phone/+/%2B}"
request_expect "200" "GET" "$API_BASE_URL/api/public/orders/history?phone=${encoded_checkout_phone}&limit=1"
ok "public checkout order history"

bootstrap_smoke_admin_user

resolve_admin_token

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
  lead_payload="$(cat <<EOF
{"type":"callback","name":"Smoke Test","phone":"+7999000${stamp: -4}","message":"smoke callback","consent_given":true,"consent_version":"v1.0","consent_text":"smoke consent"}
EOF
)"
  request_expect "201" "POST" "$API_BASE_URL/api/public/leads" "$lead_payload"
  ok "public lead create"
else
  log "--with-write not set: skip extra lead write check"
fi

log "Smoke done"
ok "all checks passed"
