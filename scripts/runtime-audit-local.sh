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

API_PID=""
WEB_PID=""
API_LOG=""
WEB_LOG=""

usage() {
  cat <<'EOF'
Run runtime-audit with automatic local stack startup.

Usage:
  bash scripts/runtime-audit-local.sh [--web-base URL] [--api-base URL]

Options:
  --web-base URL  Override WEB base URL (default: http://127.0.0.1:3000)
  --api-base URL  Override API base URL (default: http://127.0.0.1:8000)
  -h, --help      Show help

Env:
  WEB_BASE_URL, API_BASE_URL, WEB_HOST, WEB_PORT, API_HOST, API_PORT,
  DATABASE_URL, SMOKE_ADMIN_EMAIL, SMOKE_ADMIN_PASSWORD,
  SMOKE_TIMEOUT_SECONDS, STARTUP_TIMEOUT_SECONDS
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --web-base)
      WEB_BASE_URL="${2:-}"
      shift 2
      ;;
    --api-base)
      API_BASE_URL="${2:-}"
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
    DATABASE_URL="$DATABASE_URL" ./.venv/bin/uv run uvicorn main:app --host "$API_HOST" --port "$API_PORT"
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

log "runtime-audit-local start"
log "WEB_BASE_URL=$WEB_BASE_URL"
log "API_BASE_URL=$API_BASE_URL"

require_prerequisites
start_postgres
start_api
start_web

WEB_BASE_URL="$WEB_BASE_URL" API_BASE_URL="$API_BASE_URL" \
  SMOKE_ADMIN_EMAIL="${SMOKE_ADMIN_EMAIL:-}" SMOKE_ADMIN_PASSWORD="${SMOKE_ADMIN_PASSWORD:-}" \
  bash scripts/runtime-audit.sh

log "runtime-audit-local done"
ok "all checks passed"
