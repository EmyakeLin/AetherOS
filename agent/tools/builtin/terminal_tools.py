"""
内置工具 — 终端执行
run_command — 支持超时、工作目录、后台执行
"""

import subprocess
import asyncio
import json
import os
import signal
import time
from typing import Optional

# 后台进程跟踪
_background_processes = {}


# 危险命令黑名单（正则模式）
import re as _re
_BLOCKED_PATTERNS = [
    r"rm\s+(-[a-zA-Z]*f|--force)\s+/\s*$",       # rm -rf /
    r"rm\s+(-[a-zA-Z]*f|--force)\s+/\s",          # rm -rf /something
    r"mkfs\.",                                      # mkfs.ext4 etc
    r"dd\s+.*of=/dev/",                             # dd to device
    r">\s*/dev/sd",                                 # write to disk device
    r"chmod\s+-R\s+777\s+/",                        # chmod -R 777 /
    r":(){ :\|:& };:",                              # fork bomb
    r"curl.*\|\s*(ba)?sh",                          # curl | sh
    r"wget.*\|\s*(ba)?sh",                          # wget | sh
]


def _check_command_safety(command: str) -> str | None:
    """检查命令安全性，返回错误信息或 None"""
    for pattern in _BLOCKED_PATTERNS:
        if _re.search(pattern, command):
            return f"命令被安全策略拦截: 匹配危险模式 '{pattern}'"
    return None


async def _run_command(params: dict) -> str:
    command = params.get("command", "")
    cwd = params.get("cwd", None)
    timeout = params.get("timeout", 120)
    background = params.get("background", False)
    env_vars = params.get("env", {})

    if not command:
        return "错误: 未指定命令"

    # 安全检查
    block_reason = _check_command_safety(command)
    if block_reason:
        return f"错误: {block_reason}"

    # 合并环境变量
    env = os.environ.copy()
    if env_vars:
        env.update(env_vars)

    try:
        if background:
            # 后台执行
            return await _run_background(command, cwd, env)
        else:
            # 前台执行
            return await _run_foreground(command, cwd, timeout, env)
    except Exception as e:
        return f"错误: {e}"


async def _run_foreground(command: str, cwd: Optional[str], timeout: int, env: dict) -> str:
    """前台执行命令"""
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            env=env,
        )

        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return f"错误: 命令超时 ({timeout}s)"

        output = stdout.decode("utf-8", errors="replace")
        error = stderr.decode("utf-8", errors="replace")

        result = ""
        if output:
            result += output
        if error:
            result += ("\n" if result else "") + error
        if proc.returncode != 0:
            result += f"\n[退出码: {proc.returncode}]"

        # 截断过长输出
        if len(result) > 10000:
            result = result[:5000] + "\n\n... [输出已截断] ...\n\n" + result[-5000:]

        return result or "(无输出)"

    except Exception as e:
        return f"错误: {e}"


async def _run_background(command: str, cwd: Optional[str], env: dict) -> str:
    """后台执行命令"""
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            env=env,
        )

        # 存储后台进程
        pid = proc.pid
        _background_processes[pid] = {
            "process": proc,
            "command": command,
            "start_time": time.time(),
            "cwd": cwd,
        }

        return json.dumps({
            "status": "started",
            "pid": pid,
            "message": f"后台进程已启动 (PID: {pid})",
            "command": command,
        }, ensure_ascii=False)

    except Exception as e:
        return f"错误: {e}"


async def _get_process_output(params: dict) -> str:
    """获取后台进程输出"""
    pid = params.get("pid")
    if not pid:
        return "错误: 未指定进程 ID"

    proc_info = _background_processes.get(pid)
    if not proc_info:
        return f"错误: 未找到进程 {pid}"

    proc = proc_info["process"]

    if proc.returncode is not None:
        # 进程已结束
        stdout = proc.stdout.read() if proc.stdout else b""
        stderr = proc.stderr.read() if proc.stderr else b""
        output = stdout.decode("utf-8", errors="replace")
        error = stderr.decode("utf-8", errors="replace")

        # 清理
        del _background_processes[pid]

        result = ""
        if output:
            result += output
        if error:
            result += ("\n" if result else "") + error
        result += f"\n[退出码: {proc.returncode}]"

        return json.dumps({
            "status": "completed",
            "pid": pid,
            "output": result or "(无输出)",
            "exit_code": proc.returncode,
        }, ensure_ascii=False)
    else:
        # 进程仍在运行
        return json.dumps({
            "status": "running",
            "pid": pid,
            "runtime": round(time.time() - proc_info["start_time"], 1),
            "command": proc_info["command"],
        }, ensure_ascii=False)


async def _list_background_processes(params: dict) -> str:
    """列出后台进程"""
    processes = []
    for pid, info in _background_processes.items():
        proc = info["process"]
        processes.append({
            "pid": pid,
            "command": info["command"],
            "runtime": round(time.time() - info["start_time"], 1),
            "status": "running" if proc.returncode is None else "completed",
        })

    if not processes:
        return "没有后台进程"

    return json.dumps(processes, ensure_ascii=False, indent=2)


async def _kill_process(params: dict) -> str:
    """终止后台进程"""
    pid = params.get("pid")
    if not pid:
        return "错误: 未指定进程 ID"

    proc_info = _background_processes.get(pid)
    if not proc_info:
        return f"错误: 未找到进程 {pid}"

    proc = proc_info["process"]

    try:
        proc.terminate()
        try:
            await asyncio.wait_for(proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()

        del _background_processes[pid]
        return f"进程 {pid} 已终止"
    except Exception as e:
        return f"错误: 终止进程失败: {e}"


TOOL_SCHEMAS = [
    {
        "name": "terminal",
        "description": "执行终端命令。支持前台/后台执行、超时控制、工作目录设置。",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "要执行的命令"},
                "cwd": {"type": "string", "description": "工作目录（绝对路径）"},
                "timeout": {"type": "integer", "description": "超时秒数（默认 120）", "default": 120},
                "background": {"type": "boolean", "description": "是否后台执行", "default": False},
                "env": {"type": "object", "description": "额外环境变量", "additionalProperties": {"type": "string"}},
            },
            "required": ["command"]
        },
        "handler": _run_command,
        "toolset": "terminal",
    },
    {
        "name": "get_process_output",
        "description": "获取后台进程的输出和状态",
        "parameters": {
            "type": "object",
            "properties": {
                "pid": {"type": "integer", "description": "进程 ID"},
            },
            "required": ["pid"]
        },
        "handler": _get_process_output,
        "toolset": "terminal",
    },
    {
        "name": "list_processes",
        "description": "列出所有后台进程",
        "parameters": {
            "type": "object",
            "properties": {},
        },
        "handler": _list_background_processes,
        "toolset": "terminal",
    },
    {
        "name": "kill_process",
        "description": "终止后台进程",
        "parameters": {
            "type": "object",
            "properties": {
                "pid": {"type": "integer", "description": "进程 ID"},
            },
            "required": ["pid"]
        },
        "handler": _kill_process,
        "toolset": "terminal",
    },
]
