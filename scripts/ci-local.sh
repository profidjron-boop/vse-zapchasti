#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="pr"

usage() {
  cat <<'EOF'
Local CI runner (fallback when GitHub Actions is unavailable).

Usage:
  bash scripts/ci-local.sh [--mode pr|main]

Modes:
  pr    release-check in lightweight mode (skip write-smoke)
  main  full release-check (includes write-smoke)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
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

case "$MODE" in
  pr)
    bash scripts/release-check.sh --skip-write-smoke
    ;;
  main)
    bash scripts/release-check.sh
    ;;
  *)
    echo "Unsupported mode: $MODE (expected: pr|main)" >&2
    exit 1
    ;;
esac
