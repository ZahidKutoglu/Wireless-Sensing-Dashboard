#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -d "$ROOT/backend/.venv" ]]; then
  python3 -m venv "$ROOT/backend/.venv"
fi
# shellcheck disable=SC1091
source "$ROOT/backend/.venv/bin/activate"
pip install -r "$ROOT/backend/requirements.txt"
if [[ ! -f "$ROOT/backend/models/model.pkl" ]]; then
  python "$ROOT/backend/train_model.py"
fi

(cd "$ROOT/frontend" && npm install)

echo "Starting API on :8010 and dashboard on :3000"
uvicorn app.main:app --host 0.0.0.0 --port 8010 --app-dir "$ROOT/backend" &
API_PID=$!
trap 'kill $API_PID' EXIT
(cd "$ROOT/frontend" && npm run dev)
