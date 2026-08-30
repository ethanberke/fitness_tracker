#!/usr/bin/env bash
# Runs the API on :8000 and the Vite dev server on :5173 (which proxies /api).
set -euo pipefail
cd "$(dirname "$0")"

# Git hooks are opt-in per clone; enabling here means a fresh checkout is set up
# by the same command that starts the app.
if [ "$(git config core.hooksPath || true)" != ".githooks" ]; then
  git config core.hooksPath .githooks
  echo "✓ pre-commit hook enabled (bypass once with SKIP_HOOKS=true)"
fi

if [ ! -d server/.venv ]; then
  python3 -m venv server/.venv
  server/.venv/bin/pip install -r server/requirements.txt
fi
[ -d node_modules ] || npm install

server/.venv/bin/python -m uvicorn app.main:app --app-dir server --reload --port 8000 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT

npm run dev -- --host
