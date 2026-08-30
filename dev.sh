#!/usr/bin/env bash
# Runs the API on :8000 and the Vite dev server on :5173 (which proxies /api).
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d server/.venv ]; then
  python3 -m venv server/.venv
  server/.venv/bin/pip install -r server/requirements.txt
fi
[ -d node_modules ] || npm install

server/.venv/bin/python -m uvicorn app.main:app --app-dir server --reload --port 8000 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT

npm run dev -- --host
