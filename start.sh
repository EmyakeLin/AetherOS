#!/bin/bash
# N.O.V.A Aether OS — 一键启动脚本

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT=${1:-8411}

echo ""
echo "  ▽ N.O.V.A Aether OS"
echo "  ════════════════════"
echo ""

# 创建虚拟环境（如果不存在）
if [ ! -d ".venv" ]; then
    echo "  📦 创建虚拟环境..."
    python3 -m venv .venv
fi
source .venv/bin/activate

# 检查 Python 依赖，缺失时才安装
MISSING=""
check_import() { python3 -c "import $1" 2>/dev/null; }
for pkg in fastapi uvicorn websockets ptyprocess openai anthropic watchdog python_multipart; do
    check_import "$pkg" || MISSING="$MISSING $pkg"
done
check_import "yaml" || MISSING="$MISSING pyyaml"
if [ -n "$MISSING" ]; then
    echo "  📦 安装缺失依赖:$MISSING"
    pip install -r requirements.txt -q 2>/dev/null || pip install -r requirements.txt
else
    echo "  ✓ Python 依赖已满足"
fi

# 确保目录存在
mkdir -p static/{core,apps/{files,ide,terminal,agent,browser,monitor,settings},lib/monaco}
mkdir -p agent/{tools/{builtin,custom}}

echo ""
echo "  🚀 启动服务器 (端口 $PORT)..."
echo "  └─ http://localhost:$PORT"
echo ""

python server.py --port "$PORT" &
SERVER_PID=$!

sleep 2

URL="http://localhost:$PORT"
if command -v xdg-open &> /dev/null; then
    xdg-open "$URL" 2>/dev/null &
elif command -v open &> /dev/null; then
    open "$URL" 2>/dev/null &
else
    echo "  请手动打开浏览器访问: $URL"
fi

trap "echo ''; echo '  ▽ 正在停止...'; kill $SERVER_PID 2>/dev/null; exit 0" INT TERM
wait $SERVER_PID
