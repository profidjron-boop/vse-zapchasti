#!/usr/bin/env bash
set -euo pipefail

echo "== whoami =="
whoami || true
echo

echo "== pwd =="
pwd
echo

echo "== git =="
git rev-parse --is-inside-work-tree >/dev/null 2>&1 && {
  git --no-pager status -sb || true
  git --no-pager log --oneline -n 5 || true
} || echo "not a git repo"
echo

echo "== docs presence =="
for f in \
  docs/project-header.md \
  docs/requirements.md \
  docs/stack.md \
  docs/verify-gates.md \
  docs/design-system.md \
  docs/ui-direction.md \
  docs/ux-copy.md \
  docs/deploy.md
do
  if [ -f "$f" ]; then
    echo "OK $f"
  else
    echo "MISSING $f"
  fi
done
echo

echo "== tree (top) =="
ls -la
