#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

progress() {
  local pct=$1 label=$2
  local full=$((pct * 20 / 100))
  local empty=$((20 - full))
  local bar=""
  for ((i=0; i<full; i++)); do bar="${bar}#"; done
  for ((i=0; i<empty; i++)); do bar="${bar}-"; done
  printf "[%s] %3d%%  %s\n" "$bar" "$pct" "$label"
}

PYTHON=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then PYTHON=$cmd; break; fi
done
if [ -z "$PYTHON" ]; then echo "Python not found"; exit 1; fi

echo "========================================"
echo "  Flow - AI Knowledge Tree"
echo "========================================"
echo

progress 0 "Initializing..."

# Step 1: Backend venv + deps
progress 5 "Setting up Python venv..."
cd "$BACKEND_DIR"
if [ ! -d "venv" ]; then
  echo
  $PYTHON -m venv venv
fi
if [ -f "venv/Scripts/activate" ]; then source venv/Scripts/activate; else source venv/bin/activate; fi

progress 15 "Installing Python packages..."
echo
pip install -r requirements.txt

$PYTHON -m uvicorn --version &>/dev/null || pip install uvicorn fastapi pydantic python-multipart

# Step 2: Start backend
echo
progress 40 "Starting backend server..."
$PYTHON -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo
echo "  Backend started at http://localhost:8000 (PID: $BACKEND_PID)"

# Step 3: Frontend deps
progress 60 "Installing frontend packages..."
echo
cd "$FRONTEND_DIR"
npm install

# Step 4: Start frontend
echo
progress 85 "Starting frontend dev server..."
npm run dev &
FRONTEND_PID=$!
echo
echo "  Frontend started at http://localhost:5173 (PID: $FRONTEND_PID)"

progress 100 "Done!"
echo
echo "========================================"
echo "  Startup complete!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API docs: http://localhost:8000/docs"
echo "========================================"
echo
echo "Press Ctrl+C to stop all services"

cleanup() { echo; echo "Stopping..."; kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null; wait 2>/dev/null; echo "Stopped."; exit 0; }
trap cleanup SIGINT SIGTERM
wait
