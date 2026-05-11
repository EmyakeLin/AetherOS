#!/bin/bash
# N.O.V.A Aether OS — Low Performance Mode Startup

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT=${1:-8411}

echo ""
echo "  N.O.V.A Aether OS [LOW PERFORMANCE MODE]"
echo "  =========================================="
echo ""

# Create virtual environment (if not exists)
if [ ! -d ".venv" ]; then
    echo "  [INFO] Creating virtual environment..."
    python3 -m venv .venv
fi
source .venv/bin/activate

# Check Python dependencies
MISSING=""
check_import() { python3 -c "import $1" 2>/dev/null; }
for pkg in fastapi uvicorn websockets ptyprocess openai anthropic watchdog python_multipart; do
    check_import "$pkg" || MISSING="$MISSING $pkg"
done
check_import "yaml" || MISSING="$MISSING pyyaml"
if [ -n "$MISSING" ]; then
    echo "  [INFO] Installing missing deps:$MISSING"
    pip install -r requirements.txt -q 2>/dev/null || pip install -r requirements.txt
else
    echo "  [OK] Dependencies satisfied"
fi

# Ensure directories exist
mkdir -p static/{core,apps/{files,ide,terminal,agent,browser,monitor,settings},lib/monaco}
mkdir -p agent/{tools/{builtin,custom}}

# Create low performance mode marker file
echo "  [INFO] Enabling low performance mode..."
echo '{"low_perf": true}' > static/perf-mode.json

echo ""
echo "  [INFO] Starting server on port $PORT..."
echo "  [INFO] http://localhost:$PORT"
echo "  [INFO] Low performance mode: ENABLED"
echo ""

# Start server with low-perf flag
python server.py --port "$PORT" --low-perf &
SERVER_PID=$!

sleep 2

URL="http://localhost:$PORT/?low_perf=1"
if command -v xdg-open &> /dev/null; then
    xdg-open "$URL" 2>/dev/null &
elif command -v open &> /dev/null; then
    open "$URL" 2>/dev/null &
else
    echo "  Please open browser manually: $URL"
fi

# Cleanup on exit
cleanup() {
    echo ""
    echo "  [INFO] Stopping server..."
    rm -f static/perf-mode.json
    kill $SERVER_PID 2>/dev/null
    exit 0
}
trap cleanup INT TERM

wait $SERVER_PID
