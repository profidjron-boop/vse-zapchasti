#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ts() { date +"%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(ts)] $*"; }

fail() {
  echo
  echo "❌ FAIL: $*"
  exit 1
}

ok() { echo "✅ $*"; }

check_no_remote_assets() {
  local search_paths=(
    "apps/web/src"
    "apps/web/public"
    "apps/web/next.config.ts"
  )

  local -a patterns=(
    "next/font/google"
    "<script[^>]*src=['\\\"]https?://"
    "<link[^>]*rel=['\\\"]stylesheet['\\\"][^>]*href=['\\\"]https?://"
    "@import[[:space:]]+url\\(['\\\"]?https?://"
    "url\\(['\\\"]?https?://"
  )

  local matches=""
  for pattern in "${patterns[@]}"; do
    local result=""
    result="$(rg -n --pcre2 "$pattern" "${search_paths[@]}" || true)"
    if [[ -n "$result" ]]; then
      matches+=$'\n'"$result"
    fi
  done

  if [[ -n "$matches" ]]; then
    echo "$matches" | sed '/^[[:space:]]*$/d'
    return 1
  fi
  return 0
}

wait_for_port() {
  local host="$1"
  local port="$2"
  local timeout_sec="${3:-30}"
  local start
  start="$(date +%s)"

  while true; do
    if (echo >/dev/tcp/"$host"/"$port") >/dev/null 2>&1; then
      return 0
    fi
    local now
    now="$(date +%s)"
    if (( now - start >= timeout_sec )); then
      return 1
    fi
    sleep 1
  done
}

ensure_postgres() {
  # Best-effort: if docker compose exists and DB not reachable, try to start it.
  local host="127.0.0.1"
  local port="5433"

  if (echo >/dev/tcp/"$host"/"$port") >/dev/null 2>&1; then
    ok "postgres reachable on $host:$port"
    return 0
  fi

  if command -v docker >/dev/null 2>&1; then
    log "postgres not reachable on $host:$port → starting docker compose"
    docker compose up -d || fail "docker compose up -d"
    log "waiting for postgres on $host:$port"
    wait_for_port "$host" "$port" 30 || fail "postgres still not reachable on $host:$port"
    ok "postgres reachable on $host:$port"
    return 0
  fi

  fail "postgres not reachable on $host:$port and docker not available"
}

log "verify-all: start"
echo

# --- Repo hygiene (safe, no deps) ---
log "git diff --check (whitespace/errors)"
git diff --check || fail "git diff --check found whitespace/errors"
ok "git diff --check"

log "web:no-remote-assets"
check_no_remote_assets || fail "web:no-remote-assets found external runtime assets"
ok "web:no-remote-assets"

# --- Web ---
log "web:lint"
pnpm web:lint || fail "web:lint"
ok "web:lint"

log "web:typecheck"
pnpm web:typecheck || fail "web:typecheck"
ok "web:typecheck"

log "web:build"
pnpm --dir apps/web run build || fail "web:build"
ok "web:build"

# --- API ---
log "api:lint"
( cd apps/api && make lint ) || fail "api:lint"
ok "api:lint"

log "api:test"
( cd apps/api && make test ) || fail "api:test"
ok "api:test"

# DB-dependent gate
ensure_postgres

log "api:migrate-check"
migrate_check_output="$(
  cd apps/api && make migrate-check
)" || fail "api:migrate-check"
echo "$migrate_check_output"

current_revisions="$(
  printf '%s\n' "$migrate_check_output" \
    | awk '/^[0-9a-f]+ / {print $1}' \
    | sort -u \
    | tr '\n' ' ' \
    | sed 's/[[:space:]]*$//'
)"

head_revisions="$(
  cd apps/api && UV_CACHE_DIR=./.uv-cache ./.venv/bin/uv run alembic heads \
    | awk '/^[0-9a-f]+ / {print $1}' \
    | sort -u \
    | tr '\n' ' ' \
    | sed 's/[[:space:]]*$//'
)"

[[ -n "$current_revisions" ]] || fail "api:migrate-check: cannot parse current revision"
[[ -n "$head_revisions" ]] || fail "api:migrate-check: cannot parse head revision"
[[ "$current_revisions" == "$head_revisions" ]] \
  || fail "api:migrate-check: current ($current_revisions) != head ($head_revisions). Run: cd apps/api && make migrate"

ok "api:migrate-check"

# Extra: Python syntax compilation (builtin, catches SyntaxError even if not imported in tests)
log "python:compileall (apps/api)"
python3 -m compileall -q apps/api || fail "python:compileall"
ok "python:compileall"

echo
log "verify-all: done"
echo "✅ ALL GREEN"
