"""
内置工具 — 终端执行
run_command
"""

import subprocess


async def _run_command(params: dict) -> str:
    command = params.get("command", "")
    cwd = params.get("cwd", None)
    if not command:
        return "错误: 未指定命令"
    try:
        result = subprocess.run(
            command, shell=True, cwd=cwd,
            capture_output=True, text=True, timeout=30
        )
        output = result.stdout + result.stderr
        if result.returncode != 0:
            output += f"\n[退出码: {result.returncode}]"
        return output[:5000] or "(无输出)"
    except subprocess.TimeoutExpired:
        return "错误: 命令超时 (30s)"
    except Exception as e:
        return f"错误: {e}"


TOOL_SCHEMAS = [
    {
        "name": "run_command",
        "description": "执行终端命令",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "要执行的命令"},
                "cwd": {"type": "string", "description": "工作目录 (可选)"}
            },
            "required": ["command"]
        },
        "handler": _run_command,
        "toolset": "terminal",
    },
]
