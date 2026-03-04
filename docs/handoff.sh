#!/bin/bash
set -euo pipefail

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
