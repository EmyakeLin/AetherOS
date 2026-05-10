#!/bin/bash
# N.O.V.A Aether OS — 一键停止脚本

echo "  ▽ 停止 N.O.V.A Aether OS..."

PIDS=$(pgrep -f "python.*server.py" 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    echo "  ├─ 终止进程: $PIDS"
    kill $PIDS 2>/dev/null || true
    sleep 1
    kill -9 $PIDS 2>/dev/null || true
    echo "  └─ 已停止"
else
    echo "  └─ 未发现运行中的服务"
fi
