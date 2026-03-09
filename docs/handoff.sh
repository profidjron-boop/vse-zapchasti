#!/bin/bash
set -euo pipefail

STRICT=0
if [[ "${1:-}" == "--strict" ]]; then
  STRICT=1
  shift
fi

if [[ $# -gt 0 ]]; then
  echo "Unknown option: $1" >&2
  echo "Usage: docs/handoff.sh [--strict]" >&2
  exit 1
fi

echo "=== Текущее состояние проекта ==="

# Web (repo-defined scripts)
(pnpm web:lint --version 2>/dev/null) || echo "web:lint не настроен"
(pnpm web:typecheck --version 2>/dev/null) || echo "web:typecheck не настроен"

# API (apps/api)
if [ -d apps/api ]; then
  if command -v make >/dev/null 2>&1; then
    ver="$(make --version 2>/dev/null | head -n 1 || true)"
    if [ -n "$ver" ]; then echo "$ver"; fi
  else
    echo "make не найден"
  fi

  (cd apps/api && make -n lint >/dev/null 2>&1 && echo "api:lint target OK" || echo "api:lint не настроен")
  (cd apps/api && make -n test >/dev/null 2>&1 && echo "api:test target OK" || echo "api:test не настроен")
  (cd apps/api && make -n migrate-check >/dev/null 2>&1 && echo "api:migrate-check target OK" || echo "api:migrate-check не настроен")
else
  echo "apps/api не найден"
fi

echo "=== Структура ==="
if command -v tree >/dev/null 2>&1; then
  tree -L 2 -I "node_modules|venv|.venv|__pycache__|.git|.next|dist"
else
  ls -la
fi

echo "=== Handoff metadata check ==="
HANDOFF_DOC="$(ls docs/project-handoff-*.md 2>/dev/null | sort | tail -n 1 || true)"
if [[ -z "$HANDOFF_DOC" ]]; then
  echo "handoff doc не найден (ожидается docs/project-handoff-*.md)"
else
  echo "handoff doc: $HANDOFF_DOC"
  PLACEHOLDER_REGEX='не предоставлено|требуется заполнение|pending explicit sign-off|production tag не предоставлен|Дата последнего production deploy: не предоставлено'
  if command -v rg >/dev/null 2>&1; then
    unresolved="$(rg -n "$PLACEHOLDER_REGEX" "$HANDOFF_DOC" || true)"
  else
    unresolved="$(grep -nE "$PLACEHOLDER_REGEX" "$HANDOFF_DOC" || true)"
  fi

  if [[ -n "$unresolved" ]]; then
    echo "WARN: Найдены незаполненные поля handoff:"
    echo "$unresolved"
    if [[ "$STRICT" -eq 1 ]]; then
      echo "ERROR: strict mode: handoff metadata is incomplete"
      exit 1
    fi
  else
    echo "OK: handoff metadata placeholders not found"
  fi
fi
