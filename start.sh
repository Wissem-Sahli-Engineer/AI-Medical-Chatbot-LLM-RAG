#!/usr/bin/env bash
# Start the MedRAG chatbot: Ollama, the FastAPI backend (port 8000) and the React interface (port 5180).
set -e
cd "$(dirname "$0")"
VENV="${VENV:-$HOME/venvs/medical-chatbot}"

curl -s localhost:11434/api/tags >/dev/null 2>&1 || { echo "Starting Ollama…"; open -a Ollama 2>/dev/null || (ollama serve >/dev/null 2>&1 &); sleep 4; }

echo "Starting the backend on http://localhost:8000 (first start builds the index, about 4 minutes)…"
"$VENV/bin/uvicorn" backend.app:app --port 8000 &
BACKEND=$!
trap 'kill $BACKEND 2>/dev/null' EXIT

[ -d frontend/node_modules ] || (cd frontend && npm install)
echo "Open http://localhost:5180"
cd frontend && npx vite
