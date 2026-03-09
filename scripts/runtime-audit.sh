#!/usr/bin/env bash
set -euo pipefail

WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:3000}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8000}"
SMOKE_ADMIN_EMAIL="${SMOKE_ADMIN_EMAIL:-}"
SMOKE_ADMIN_PASSWORD="${SMOKE_ADMIN_PASSWORD:-}"

ts() { date +"%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(ts)] $*"; }
ok() { echo "✅ $*"; }
fail() { echo "❌ $*" >&2; exit 1; }

request_code() {
  local method="$1"
  local url="$2"
  curl -sS -m 12 -o /dev/null -w "%{http_code}" -X "$method" "$url"
}

assert_code() {
  local method="$1"
  local url="$2"
  local expected="$3"
  local code
  code="$(request_code "$method" "$url" || true)"
  if [[ "$code" != "$expected" ]]; then
    fail "$method $url -> expected $expected, got $code"
  fi
  ok "$method $url -> $code"
}

assert_any_code() {
  local method="$1"
  local url="$2"
  shift 2
  local expected=("$@")
  local code
  code="$(request_code "$method" "$url" || true)"
  for item in "${expected[@]}"; do
    if [[ "$code" == "$item" ]]; then
      ok "$method $url -> $code"
      return 0
    fi
  done
  fail "$method $url -> expected one of ${expected[*]}, got $code"
}

log "runtime-audit start"
log "WEB_BASE_URL=$WEB_BASE_URL"
log "API_BASE_URL=$API_BASE_URL"

assert_code GET "$WEB_BASE_URL/" 200
assert_code GET "$WEB_BASE_URL/parts" 200
assert_code GET "$WEB_BASE_URL/service" 200
assert_code GET "$WEB_BASE_URL/contacts" 200
assert_any_code GET "$WEB_BASE_URL/admin" 200 307

assert_code GET "$API_BASE_URL/health" 200
assert_code GET "$API_BASE_URL/api/public/content" 200
assert_code GET "$API_BASE_URL/api/public/categories" 200
assert_code GET "$API_BASE_URL/api/public/products?limit=3" 200
assert_code GET "$API_BASE_URL/api/public/service-catalog" 200

log "checking categories shape"
tmp_categories="$(mktemp)"
curl -sS "$API_BASE_URL/api/public/categories" >"$tmp_categories"
python - "$tmp_categories" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    payload = json.load(f)

if not isinstance(payload, list) or not payload:
    raise SystemExit("categories payload is empty")

names = [str(item.get("name", "")).strip() for item in payload]
display = [
    name for name in names
    if name and not name.lower().startswith("бренд:") and not name.lower().startswith("импорт ")
]

if not display:
    raise SystemExit("no display categories found (only technical categories)")

print(f"categories_total={len(payload)} display_categories={len(display)}")
PY
rm -f "$tmp_categories"
ok "categories shape"

log "checking public write endpoints"
tmp_body="$(mktemp)"
cat >"$tmp_body" <<'JSON'
{
  "vehicle_type": "passenger",
  "service_type": "Диагностика",
  "name": "Runtime Audit",
  "phone": "+79991234567",
  "description": "Проверка формы runtime-audit",
  "consent_given": true,
  "consent_version": "v1.0"
}
JSON
code="$(curl -sS -m 12 -o /dev/null -w "%{http_code}" -X POST "$API_BASE_URL/api/public/service-requests" -H "Content-Type: application/json" --data @"$tmp_body" || true)"
if [[ "$code" != "200" && "$code" != "201" ]]; then
  fail "POST $API_BASE_URL/api/public/service-requests -> expected 200/201, got $code"
fi
ok "POST $API_BASE_URL/api/public/service-requests -> $code"

cat >"$tmp_body" <<'JSON'
{
  "type": "callback",
  "name": "Runtime Audit",
  "phone": "+79991234567",
  "message": "Проверка формы runtime-audit",
  "consent_given": true,
  "consent_version": "v1.0"
}
JSON
code="$(curl -sS -m 12 -o /dev/null -w "%{http_code}" -X POST "$API_BASE_URL/api/public/leads" -H "Content-Type: application/json" --data @"$tmp_body" || true)"
if [[ "$code" != "200" && "$code" != "201" ]]; then
  fail "POST $API_BASE_URL/api/public/leads -> expected 200/201, got $code"
fi
ok "POST $API_BASE_URL/api/public/leads -> $code"
rm -f "$tmp_body"

if [[ -n "$SMOKE_ADMIN_EMAIL" && -n "$SMOKE_ADMIN_PASSWORD" ]]; then
  log "checking admin auth and protected endpoints"
  token="$(
    curl -sS -X POST "$API_BASE_URL/api/admin/auth/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      --data-urlencode "username=$SMOKE_ADMIN_EMAIL" \
      --data-urlencode "password=$SMOKE_ADMIN_PASSWORD" \
    | python -c 'import json,sys; print((json.load(sys.stdin) or {}).get("access_token",""))'
  )"
  [[ -n "$token" ]] || fail "admin token is empty"

  for endpoint in "/api/admin/auth/me" "/api/admin/leads?limit=5" "/api/admin/service-requests?limit=5"; do
    code="$(curl -sS -m 12 -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $token" "$API_BASE_URL$endpoint" || true)"
    [[ "$code" == "200" ]] || fail "GET $API_BASE_URL$endpoint -> expected 200, got $code"
    ok "GET $API_BASE_URL$endpoint -> $code"
  done
fi

log "runtime-audit done"
ok "all checks passed"
