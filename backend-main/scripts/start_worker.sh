#!/bin/bash
set -euo pipefail

# Configuration — auto-detect project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_PATH="$PROJECT_ROOT/venv"
CELERY_APP="datarepr"

echo "--------------------------------------------------"
echo "Starting HDIS Celery Worker..."
echo "Project Root: $PROJECT_ROOT"
echo "--------------------------------------------------"

# Activate virtual environment
if [ -f "$VENV_PATH/bin/activate" ]; then
    source "$VENV_PATH/bin/activate"
else
    echo "Error: Virtual environment not found at $VENV_PATH"
    exit 1
fi

# Change to project root
cd "$PROJECT_ROOT" || { echo "Error: Cannot change to $PROJECT_ROOT"; exit 1; }

# Check if Redis is running
if ! redis-cli ping >/dev/null 2>&1; then
    echo "--------------------------------------------------"
    echo "⚠️  WARNING: Redis is not running!"
    echo "This is required for Celery background tasks."
    echo ""
    echo "To start Redis on macOS, run:"
    echo "  brew services start redis"
    echo "--------------------------------------------------"
    exit 1
fi

echo "✅ Redis is running. Starting Celery..."
echo "--------------------------------------------------"

# Start Celery Worker
# -A: app name
# -l: log level
# -P: pool type (solo is best for local dev with Ollama/LLMs to avoid OOM)
# -c: concurrency (1 is recommended for local LLM processing)
celery -A $CELERY_APP worker -l info -P solo -c 1
