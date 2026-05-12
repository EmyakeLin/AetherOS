"""
N.O.V.A Aether OS — Backend Server
FastAPI + WebSocket: filesystem, terminal PTY, LSP proxy, agent bridge
"""

import os
import sys
import json
import asyncio
import signal
import uuid
import time
import subprocess
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Body, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import uvicorn

# ── App setup ──

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="N.O.V.A Aether OS")

# ── LLM 统一服务 ──
sys.path.insert(0, str(BASE_DIR / "llm"))
from llm.service import LLMService
llm_service = LLMService()

# ── Terminal sessions ──

terminal_sessions: dict[str, dict] = {}


# ═══════════════════════════════════════════════
# 区域 1: 文件系统 API
# ═══════════════════════════════════════════════

@app.get("/api/fs/list")
async def fs_list(path: str = Query("")):
    """列目录"""
    try:
        target = Path(path) if path else Path.home()
        if not target.is_absolute():
            target = Path.home() / path
        if not target.exists():
            return {"error": f"路径不存在: {path}", "items": []}
        if not target.is_dir():
            return {"error": f"不是目录: {path}", "items": []}

        items = []
        try:
            for entry in sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
                try:
                    stat = entry.stat()
                    items.append({
                        "name": entry.name,
                        "is_dir": entry.is_dir(),
                        "size": stat.st_size if entry.is_file() else None,
                        "mtime": stat.st_mtime,
                    })
                except (PermissionError, OSError):
                    items.append({
                        "name": entry.name,
                        "is_dir": entry.is_dir(),
                        "size": None,
                        "mtime": None,
                    })
        except PermissionError:
            return {"error": "权限不足", "items": []}

        return {"path": str(target), "items": items}
    except Exception as e:
        return {"error": str(e), "items": []}


@app.get("/api/fs/read")
async def fs_read(path: str = Query("")):
    """读文件"""
    try:
        target = Path(path)
        if not target.exists():
            return {"error": f"文件不存在: {path}"}
        if not target.is_file():
            return {"error": f"不是文件: {path}"}
        # Limit to 5MB
        if target.stat().st_size > 5 * 1024 * 1024:
            return {"error": "文件过大 (>5MB)"}
        content = target.read_text(encoding="utf-8", errors="replace")
        return {"path": str(target), "content": content}
    except Exception as e:
        return {"error": str(e)}


@app.put("/api/fs/write")
async def fs_write(body: dict = Body(...)):
    """写文件"""
    try:
        path = body.get("path", "")
        content = body.get("content", "")
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return {"ok": True, "path": str(target)}
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/fs/edit")
async def fs_edit(body: dict = Body(...)):
    """编辑文件（定点替换）"""
    try:
        path = body.get("path", "")
        old_string = body.get("old_string", "")
        new_string = body.get("new_string", "")
        replace_all = body.get("replace_all", False)

        target = Path(path)
        if not target.exists():
            return {"error": f"文件不存在: {path}"}

        content = target.read_text(encoding="utf-8")
        if old_string not in content:
            return {"error": f"未找到匹配文本"}

        if replace_all:
            new_content = content.replace(old_string, new_string)
        else:
            new_content = content.replace(old_string, new_string, 1)

        target.write_text(new_content, encoding="utf-8")

        # 计算 diff 信息
        old_lines = content.splitlines()
        new_lines = new_content.splitlines()
        line_delta = len(new_lines) - len(old_lines)

        return {
            "ok": True,
            "path": str(target),
            "line_delta": line_delta,
            "old_line_count": len(old_lines),
            "new_line_count": len(new_lines)
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/fs/mkdir")
async def fs_mkdir(body: dict = Body(...)):
    """创建目录"""
    try:
        path = body.get("path", "")
        target = Path(path)
        target.mkdir(parents=True, exist_ok=True)
        return {"ok": True, "path": str(target)}
    except Exception as e:
        return {"error": str(e)}


# ═══════════════════════════════════════════════
# 区域 1.5: 工具执行 API (Eos-Tools)
# ═══════════════════════════════════════════════

sys.path.insert(0, str(BASE_DIR / "Eos-Tools"))
from read_file import read_file as tool_read_file
from write_file import write_file as tool_write_file
from edit_file import edit_file as tool_edit_file
from trace_file import trace_file as tool_trace_file

@app.post("/api/tools/execute")
async def tools_execute(body: dict = Body(...)):
    """执行 Eos-Tools 工具"""
    tool_name = body.get("tool", "")
    args = body.get("args", {})
    try:
        if tool_name == "read_file":
            result = tool_read_file(
                path=args.get("path", ""),
                offset=args.get("offset", 1),
                limit=args.get("limit", 500),
                trace=args.get("trace", False),
                error_fix_id=args.get("error_fix_id")
            )
        elif tool_name == "write_file":
            result = tool_write_file(
                path=args.get("path", ""),
                content=args.get("content", ""),
                error_fix_id=args.get("error_fix_id")
            )
        elif tool_name == "edit_file":
            result = tool_edit_file(
                path=args.get("path", ""),
                mode=args.get("mode", "replace"),
                old_string=args.get("old_string", ""),
                new_string=args.get("new_string", ""),
                replace_all=args.get("replace_all", False),
                patch=args.get("patch", ""),
                trace_update=args.get("trace_update", True),
                error_fix_id=args.get("error_fix_id")
            )
        elif tool_name == "trace_file":
            result = tool_trace_file(
                path=args.get("path", ""),
                operation=args.get("operation", "trace")
            )
        else:
            return {"status": "error", "error": f"Unknown tool: {tool_name}"}
        return result
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.get("/api/tools/definitions")
async def tools_definitions():
    """获取工具定义"""
    return {
        "read_file": tool_read_file.__doc__ or "读取文件内容",
        "write_file": tool_write_file.__doc__ or "用完整文本覆盖文件",
        "edit_file": tool_edit_file.__doc__ or "局部编辑文件",
        "trace_file": tool_trace_file.__doc__ or "控制文件 trace 状态"
    }


# ═══════════════════════════════════════════════
# 区域 2: 应用管理 API
# ═══════════════════════════════════════════════

APPS_DIR = STATIC_DIR / "apps"

ENTRY_TEMPLATE = '''/* ═══════════════════════════════════════════════════════
   {title} — Custom Application
   ═══════════════════════════════════════════════════════ */

registerApp('{id}', {{
    title: '{title}',
    icon: '{emoji}',
    factory: (container, win, os) => {{
        container.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;background:var(--bg-surface);">
                <div style="padding:16px;border-bottom:1px solid var(--border);flex-shrink:0;">
                    <span style="font-family:var(--font-display);font-size:14px;font-weight:600;color:var(--text-primary);">{title}</span>
                </div>
                <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;">
                    {description}
                </div>
            </div>
        `;
    }}
}});
'''


@app.get("/api/apps")
async def list_apps():
    """扫描所有应用清单"""
    apps = []
    if not APPS_DIR.exists():
        return {"apps": apps}
    for entry in sorted(APPS_DIR.iterdir()):
        if not entry.is_dir():
            continue
        manifest = entry / "app.json"
        if manifest.exists():
            try:
                data = json.loads(manifest.read_text(encoding="utf-8"))
                data["_path"] = str(entry.relative_to(STATIC_DIR))
                apps.append(data)
            except Exception:
                pass
    return {"apps": apps}


@app.post("/api/apps")
async def create_app(body: dict = Body(...)):
    """创建新应用"""
    try:
        app_id = body.get("id", "").strip()
        title = body.get("title", "").strip()
        if not app_id or not title:
            return {"error": "id 和 title 为必填项"}
        if not app_id.replace("-", "").replace("_", "").isalnum():
            return {"error": "id 只能包含字母、数字、连字符和下划线"}

        app_dir = APPS_DIR / app_id
        if app_dir.exists():
            return {"error": f"应用已存在: {app_id}"}

        app_dir.mkdir(parents=True, exist_ok=True)

        manifest = {
            "id": app_id,
            "title": title,
            "icon": body.get("icon", ""),
            "emoji": body.get("emoji", "📦"),
            "entry": body.get("entry", f"{app_id}.js"),
            "version": body.get("version", "1.0.0"),
            "author": body.get("author", "user"),
            "description": body.get("description", ""),
            "dock": body.get("dock", True),
            "width": body.get("width", 800),
            "height": body.get("height", 500),
        }

        (app_dir / "app.json").write_text(
            json.dumps(manifest, indent=4, ensure_ascii=False), encoding="utf-8"
        )

        entry_content = ENTRY_TEMPLATE.format(
            id=app_id,
            title=title,
            emoji=manifest["emoji"],
            description=manifest["description"] or "在此编写应用逻辑",
        )
        (app_dir / manifest["entry"]).write_text(entry_content, encoding="utf-8")

        return {"ok": True, "app": manifest}
    except Exception as e:
        return {"error": str(e)}


@app.put("/api/apps/{app_id}")
async def update_app(app_id: str, body: dict = Body(...)):
    """更新应用元数据"""
    try:
        app_dir = APPS_DIR / app_id
        manifest_path = app_dir / "app.json"
        if not manifest_path.exists():
            return {"error": f"应用不存在: {app_id}"}

        current = json.loads(manifest_path.read_text(encoding="utf-8"))
        for key in ("title", "icon", "emoji", "description", "dock", "version", "author", "width", "height"):
            if key in body:
                current[key] = body[key]

        manifest_path.write_text(
            json.dumps(current, indent=4, ensure_ascii=False), encoding="utf-8"
        )
        return {"ok": True, "app": current}
    except Exception as e:
        return {"error": str(e)}


@app.delete("/api/apps/{app_id}")
async def delete_app(app_id: str):
    """删除应用"""
    try:
        app_dir = APPS_DIR / app_id
        if not app_dir.exists():
            return {"error": f"应用不存在: {app_id}"}
        import shutil
        shutil.rmtree(app_dir)
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/exec")
async def exec_command(body: dict = Body(...)):
    """执行命令并返回结果"""
    try:
        command = body.get("command", "")
        cwd = body.get("cwd", os.getcwd())
        timeout = body.get("timeout", 30)
        if not command:
            return {"error": "未指定命令"}
        proc = await asyncio.create_subprocess_shell(
            command,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return {"error": f"执行超时 ({timeout}s)", "stdout": "", "stderr": "", "exit_code": -1}
        return {
            "stdout": stdout.decode("utf-8", errors="replace"),
            "stderr": stderr.decode("utf-8", errors="replace"),
            "exit_code": proc.returncode,
        }
    except Exception as e:
        return {"error": str(e), "stdout": "", "stderr": "", "exit_code": -1}


@app.delete("/api/fs/delete")
async def fs_delete(path: str = Query("")):
    """删除文件/目录"""
    try:
        import shutil
        target = Path(path)
        if not target.exists():
            return {"error": f"不存在: {path}"}
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/fs/rename")
async def fs_rename(body: dict = Body(...)):
    """重命名"""
    try:
        old_path = body.get("old_path", "")
        new_path = body.get("new_path", "")
        Path(old_path).rename(new_path)
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/fs/search")
async def fs_search(body: dict = Body(...)):
    """全文搜索 (grep)"""
    try:
        query = body.get("query", "")
        path = body.get("path", ".")
        if not query:
            return {"results": []}
        proc = await asyncio.create_subprocess_exec(
            "grep", "-rn", "--include=*", "-m", "50", query, path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        lines = stdout.decode("utf-8", errors="replace").strip().split("\n") if stdout else []
        return {"results": [l for l in lines if l]}
    except Exception as e:
        return {"error": str(e), "results": []}


# ═══════════════════════════════════════════════
# 区域 3: 终端 PTY
# ═══════════════════════════════════════════════

@app.websocket("/ws/terminal/{session_id}")
async def ws_terminal(websocket: WebSocket, session_id: str):
    """完整 PTY 终端"""
    await websocket.accept()

    try:
        import ptyprocess
    except ImportError:
        await websocket.send_text("错误: ptyprocess 未安装。请运行: pip install ptyprocess\r\n")
        await websocket.close()
        return

    try:
        shell = os.environ.get("SHELL", "/bin/bash")
        cwd = os.getcwd()
        proc = ptyprocess.PtyProcess.spawn([shell], cwd=cwd, dimensions=(24, 80))

        terminal_sessions[session_id] = {"proc": proc, "ws": websocket}

        loop = asyncio.get_event_loop()

        async def read_pty():
            """从 PTY 读取并发送到 WebSocket"""
            try:
                while True:
                    data = await loop.run_in_executor(None, proc.read, 4096)
                    if not data:
                        break
                    await websocket.send_bytes(data)
            except Exception:
                pass

        async def write_pty():
            """从 WebSocket 接收并写入 PTY"""
            try:
                while True:
                    msg = await websocket.receive()
                    if msg.get("type") == "websocket.receive":
                        if "bytes" in msg:
                            proc.write(msg["bytes"])
                        elif "text" in msg:
                            data = json.loads(msg["text"])
                            if data.get("type") == "input":
                                proc.write(data["data"].encode())
                            elif data.get("type") == "resize":
                                rows = data.get("rows", 24)
                                cols = data.get("cols", 80)
                                proc.setwinsize(rows, cols)
            except Exception:
                pass

        await asyncio.gather(read_pty(), write_pty())

    except Exception as e:
        try:
            await websocket.send_text(f"终端错误: {e}\r\n")
        except Exception:
            pass
    finally:
        terminal_sessions.pop(session_id, None)
        try:
            proc.kill(9)
        except Exception:
            pass


# ═══════════════════════════════════════════════
# 区域 4: 代码执行
# ═══════════════════════════════════════════════

run_sessions: dict[str, dict] = {}


@app.post("/api/run")
async def run_code(body: dict = Body(...)):
    """启动程序运行"""
    try:
        command = body.get("command", "")
        cwd = body.get("cwd", os.getcwd())
        if not command:
            return {"error": "未指定命令"}

        session_id = "run-" + str(uuid.uuid4())[:8]
        proc = await asyncio.create_subprocess_shell(
            command,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        run_sessions[session_id] = {"proc": proc, "start": time.time()}
        return {"session_id": session_id}
    except Exception as e:
        return {"error": str(e)}


@app.websocket("/ws/run/{session_id}")
async def ws_run(websocket: WebSocket, session_id: str):
    """连接到运行中的进程"""
    await websocket.accept()
    session = run_sessions.get(session_id)
    if not session:
        await websocket.send_text("错误: 会话不存在")
        await websocket.close()
        return

    proc = session["proc"]

    try:
        async for line in proc.stdout:
            await websocket.send_text(line.decode("utf-8", errors="replace"))
        async for line in proc.stderr:
            await websocket.send_text(line.decode("utf-8", errors="replace"))
        await websocket.send_text(f"\n[进程退出，代码: {proc.returncode}]")
    except Exception:
        pass
    finally:
        run_sessions.pop(session_id, None)


# ═══════════════════════════════════════════════
# 区域 5: Agent 桥接
# ═══════════════════════════════════════════════

@app.websocket("/ws/agent/{agent_id}")
async def ws_agent_bridge(websocket: WebSocket, agent_id: str):
    """连接外部 Agent (hermes/claude code)"""
    await websocket.accept()
    await websocket.send_text(json.dumps({
        "type": "info",
        "message": f"Agent bridge {agent_id} 已连接。外部 Agent 桥接功能待配置。"
    }))
    try:
        while True:
            msg = await websocket.receive_text()
            # Echo back for now
            await websocket.send_text(json.dumps({
                "type": "echo",
                "content": msg
            }))
    except WebSocketDisconnect:
        pass


# ═══════════════════════════════════════════════
# 区域 6: 自定义 Agent 引擎
# ═══════════════════════════════════════════════

agent_engines: dict[str, dict] = {}


@app.post("/api/agent/message")
async def agent_message(body: dict = Body(...)):
    """发送消息给 Agent (HTTP fallback)"""
    content = body.get("content", "")
    agent_id = body.get("agent_id", "default")
    return {"ok": True, "message": "请使用 WebSocket 连接进行实时对话"}


@app.websocket("/ws/agent/custom/{agent_id}")
async def ws_custom_agent(websocket: WebSocket, agent_id: str):
    """自定义 Agent WebSocket — 双 Task 架构：消息监听 + 引擎处理"""
    await websocket.accept()

    try:
        sys.path.insert(0, str(BASE_DIR / "agent"))
        import logging
        from engine import CustomAgentEngine
        from context import ContextManager
        from context_manager import ContextManager as FileContextManager

        logger = logging.getLogger(__name__)

        config_path = BASE_DIR / "agent" / "config.yaml"
        config = {}
        if config_path.exists():
            import yaml
            config = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}

        engine = CustomAgentEngine(config, llm_service=llm_service)
        agent_engines[agent_id] = engine

        await websocket.send_text(json.dumps({
            "type": "info",
            "message": "Agent 引擎已就绪"
        }))

        msg_queue = asyncio.Queue()

        # Task A: 消息监听 — 接收 WebSocket 消息，分发到队列或中断
        async def listen_messages():
            try:
                while True:
                    msg = await websocket.receive_text()
                    data = json.loads(msg)
                    msg_type = data.get("type", "")
                    if msg_type == "interrupt":
                        engine.interrupt()
                    elif msg_type == "configure":
                        # 更新引擎配置（模型/提示词/迭代次数，API Key 由全局 LLM 配置管理）
                        settings = data.get("settings", {})
                        if settings.get("model"):
                            engine.model = settings["model"]
                        if settings.get("systemPrompt"):
                            engine.system_prompt = settings["systemPrompt"]
                            engine.context.system_prompt = settings["systemPrompt"]
                        if settings.get("maxIterations"):
                            engine.max_iterations = int(settings["maxIterations"])
                        await websocket.send_text(json.dumps({
                            "type": "info",
                            "message": f"已配置: model={engine.model}"
                        }))
                    elif msg_type == "session_id":
                        # 设置当前 session ID 并加载历史消息
                        session_id = data.get("session_id")
                        if session_id:
                            engine.session_id = session_id
                            # 从 SQLite 加载历史消息到内存
                            try:
                                from storage import get_storage
                                history = await get_storage().get_messages_as_conversation(session_id)
                                engine.context.messages = history
                                # 同步文件上下文状态
                                engine.file_context = FileContextManager()
                                await websocket.send_text(json.dumps({
                                    "type": "info",
                                    "message": f"已加载 {len(history)} 条历史消息"
                                }))
                            except Exception as e:
                                logger.warning(f"Failed to load history: {e}")
                    elif msg_type == "message":
                        content = data.get("content", "")
                        session_id = data.get("session_id")
                        if session_id and session_id != engine.session_id:
                            engine.session_id = session_id
                            # 切换 session 时加载历史消息
                            try:
                                from storage import get_storage
                                history = await get_storage().get_messages_as_conversation(session_id)
                                engine.context.messages = history
                                engine.file_context = FileContextManager()
                            except Exception as e:
                                logger.warning(f"Failed to load history: {e}")
                        if content:
                            await msg_queue.put(content)
            except WebSocketDisconnect:
                pass

        # Task B: 消息处理 — 从队列取消息，运行引擎
        async def process_messages():
            try:
                while True:
                    user_content = await msg_queue.get()
                    try:
                        async for event in engine.run(user_content):
                            if event.get("type") == "done":
                                qsize = msg_queue.qsize()
                                if qsize > 0:
                                    event["queued"] = qsize
                            await websocket.send_text(json.dumps(event))
                    except Exception as e:
                        await websocket.send_text(json.dumps({
                            "type": "error", "message": str(e)
                        }))
                        await websocket.send_text(json.dumps({"type": "done"}))
            except asyncio.CancelledError:
                pass

        listener = asyncio.create_task(listen_messages())
        processor = asyncio.create_task(process_messages())

        # 任一 task 结束则取消另一个
        done, pending = await asyncio.wait(
            [listener, processor], return_when=asyncio.FIRST_COMPLETED
        )
        for t in pending:
            t.cancel()
            try:
                await t
            except (asyncio.CancelledError, Exception):
                pass

    except ImportError as e:
        await websocket.send_text(json.dumps({
            "type": "info",
            "message": f"Agent 引擎模块未完全加载 ({e})，运行在回显模式"
        }))
        try:
            while True:
                msg = await websocket.receive_text()
                data = json.loads(msg)
                if data.get("type") == "message":
                    await websocket.send_text(json.dumps({
                        "type": "text",
                        "content": f"[回显] 收到消息: {data.get('content', '')}\n\nAgent 引擎尚未配置 LLM API。请在设置中配置 API Key 和模型。"
                    }))
                    await websocket.send_text(json.dumps({"type": "done"}))
        except WebSocketDisconnect:
            pass

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": str(e)
            }))
        except Exception:
            pass


@app.get("/api/agent/tools")
async def agent_tools():
    """列出已注册工具"""
    try:
        sys.path.insert(0, str(BASE_DIR / "agent"))
        from tools.registry import registry
        return {"tools": registry.list_tools()}
    except ImportError:
        return {"tools": [
            {"name": "read_file", "description": "读取文件内容"},
            {"name": "write_file", "description": "写入文件内容"},
            {"name": "run_terminal", "description": "执行终端命令"},
        ]}


@app.post("/api/agent/tools/register")
async def agent_tools_register(body: dict = Body(...)):
    """注册自定义工具"""
    return {"ok": True, "message": "工具注册功能待连接 Agent 引擎"}


@app.post("/api/agent/tool")
async def agent_tool_call(body: dict = Body(...)):
    """直接调用 Agent 工具（用于调试）"""
    tool_name = body.get("name", "")
    tool_params = body.get("params", {})

    if not tool_name:
        return JSONResponse(status_code=400, content={"error": "未指定工具名称"})

    try:
        sys.path.insert(0, str(BASE_DIR / "agent"))
        from model_tools import handle_function_call
        result = await handle_function_call(tool_name, tool_params)
        return {"result": result}
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/agent/context/process")
async def agent_context_process(body: dict = Body(...)):
    """处理消息列表，返回 ContextManager 处理后的结果（用于调试）"""
    messages = body.get("messages", [])
    options = body.get("options", {})

    try:
        sys.path.insert(0, str(BASE_DIR / "agent"))
        from context_manager import ContextManager

        cm = ContextManager()

        # 记录所有工具调用
        for msg in messages:
            if msg.get("role") == "assistant" and msg.get("tool_calls"):
                for tc in msg["tool_calls"]:
                    tc_id = tc.get("id", "")
                    tool_name = tc.get("function", {}).get("name", tc.get("name", ""))
                    args_str = tc.get("function", {}).get("arguments", tc.get("arguments", "{}"))

                    import json
                    try:
                        args = json.loads(args_str) if isinstance(args_str, str) else args_str
                    except:
                        args = {}

                    # 查找对应的 tool result
                    result_msg = next((m for m in messages if m.get("role") == "tool" and m.get("tool_call_id") == tc_id), None)
                    if result_msg:
                        result_content = result_msg.get("content", "")
                        is_success = not result_content.startswith("错误") and not result_content.startswith("Error")
                        cm.record_tool_call(tc_id, tool_name, args, result_content, is_success)

        # 检测 retry 映射
        tool_calls_info = []
        for msg in messages:
            if msg.get("role") == "assistant" and msg.get("tool_calls"):
                for tc in msg["tool_calls"]:
                    tc_id = tc.get("id", "")
                    tool_name = tc.get("function", {}).get("name", tc.get("name", ""))
                    info = cm._tool_calls.get(tc_id, {})
                    tool_calls_info.append({"id": tc_id, "name": tool_name, "success": info.get("success", True)})

        for i in range(len(tool_calls_info) - 1):
            curr = tool_calls_info[i]
            next_tc = tool_calls_info[i + 1]
            if not curr["success"] and next_tc["success"] and curr["name"] == next_tc["name"]:
                cm.record_retry(curr["id"], next_tc["id"])

        # 处理消息
        processed = cm.process_messages(messages, options)

        # 统计信息
        tombstoned = sum(1 for c in cm._tool_calls.values() if c.get("result", "").startswith("[此文件内容已过期"))

        return {
            "processed": processed,
            "stats": {
                "message_count": len(processed),
                "tombstoned": tombstoned,
                "has_notifications": any("[文件状态变更通知]" in (m.get("content") or "") for m in processed if m.get("role") == "user")
            }
        }
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@app.get("/api/agent/context")
async def agent_context():
    """获取当前上下文状态"""
    return {"messages": [], "tokens": 0}


@app.post("/api/agent/context/configure")
async def agent_context_configure(body: dict = Body(...)):
    """配置上下文管理"""
    return {"ok": True}


# ── Agent 会话管理 ──

from agent.storage import get_storage


@app.on_event("startup")
async def init_agent_storage():
    """启动时初始化 Agent 存储"""
    await get_storage().init_db()


@app.on_event("shutdown")
async def close_agent_storage():
    """关闭时释放 Agent 存储连接"""
    await get_storage().close()


@app.get("/api/agent/sessions")
async def agent_sessions_list():
    """列出所有会话"""
    return {"sessions": await get_storage().list_sessions()}


@app.post("/api/agent/sessions")
async def agent_sessions_create(body: dict = Body(...)):
    """创建新会话"""
    title = body.get("title", "新会话")
    session = await get_storage().create_session(title)
    return session


@app.get("/api/agent/sessions/{session_id}")
async def agent_sessions_get(session_id: str):
    """获取单个会话"""
    session = await get_storage().get_session(session_id)
    if not session:
        return {"error": "会话不存在"}
    return session


@app.put("/api/agent/sessions/{session_id}")
async def agent_sessions_update(session_id: str, body: dict = Body(...)):
    """更新会话"""
    session = await get_storage().update_session(session_id, body)
    if not session:
        return {"error": "会话不存在"}
    return session


@app.delete("/api/agent/sessions/{session_id}")
async def agent_sessions_delete(session_id: str):
    """删除会话"""
    await get_storage().delete_session(session_id)
    return {"ok": True}


@app.get("/api/agent/sessions/{session_id}/messages")
async def agent_messages_list(session_id: str):
    """获取会话消息"""
    return {"messages": await get_storage().get_messages(session_id)}


@app.post("/api/agent/sessions/{session_id}/messages")
async def agent_messages_add(session_id: str, body: dict = Body(...)):
    """添加消息"""
    role = body.get("role", "user")
    content = body.get("content", "")
    message = await get_storage().add_message(session_id, role, content)
    return message


# ═══════════════════════════════════════════════
# 区域 7: 模型监控
# ═══════════════════════════════════════════════

@app.get("/api/monitor/models")
async def monitor_models():
    return {"models": []}


@app.get("/api/monitor/tokens")
async def monitor_tokens():
    return {"total": 0, "by_model": {}}


@app.get("/api/monitor/agents")
async def monitor_agents():
    return {"agents": list(agent_engines.keys())}


@app.websocket("/ws/monitor")
async def ws_monitor(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await asyncio.sleep(5)
            await websocket.send_text(json.dumps({
                "type": "heartbeat",
                "agents": list(agent_engines.keys()),
                "timestamp": time.time(),
            }))
    except WebSocketDisconnect:
        pass


# ═══════════════════════════════════════════════
# 区域 8: LSP 管理
# ═══════════════════════════════════════════════

lsp_servers: dict[str, dict] = {}


@app.get("/api/lsp/available")
async def lsp_available():
    """列出可用的 LSP 服务器"""
    available = []
    # Check pylsp
    try:
        proc = await asyncio.create_subprocess_exec(
            "pylsp", "--help",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        if proc.returncode == 0:
            available.append({"id": "python", "name": "Python LSP", "command": "pylsp"})
    except FileNotFoundError:
        pass

    # Check typescript-language-server
    try:
        proc = await asyncio.create_subprocess_exec(
            "typescript-language-server", "--help",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        if proc.returncode == 0:
            available.append({"id": "typescript", "name": "TypeScript LSP", "command": "typescript-language-server"})
    except FileNotFoundError:
        pass

    return {"available": available}


@app.websocket("/ws/lsp/{language}")
async def ws_lsp(websocket: WebSocket, language: str):
    """LSP 代理 WebSocket"""
    await websocket.accept()

    if language == "python":
        cmd = ["pylsp"]
    elif language in ("javascript", "typescript"):
        cmd = ["typescript-language-server", "--stdio"]
    else:
        await websocket.send_text(json.dumps({"error": f"不支持的语言: {language}"}))
        await websocket.close()
        return

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        async def forward_to_lsp():
            try:
                while True:
                    msg = await websocket.receive_text()
                    proc.stdin.write(msg.encode())
                    await proc.stdin.drain()
            except Exception:
                pass

        async def forward_to_frontend():
            try:
                while True:
                    data = await proc.stdout.read(4096)
                    if not data:
                        break
                    await websocket.send_text(data.decode())
            except Exception:
                pass

        await asyncio.gather(forward_to_lsp(), forward_to_frontend())

    except FileNotFoundError:
        await websocket.send_text(json.dumps({"error": f"LSP 服务器未安装: {cmd[0]}"}))
    except Exception as e:
        await websocket.send_text(json.dumps({"error": str(e)}))
    finally:
        try:
            proc.kill()
        except Exception:
            pass


# ═══════════════════════════════════════════════
# 区域 9: 灵感卡片
# ═══════════════════════════════════════════════

CARDS_DIR = Path.home() / ".aetheros" / "aether-cards"
CARDS_JSON = CARDS_DIR / "cards.json"
CARDS_CONFIG_JSON = CARDS_DIR / "config.json"
CARDS_IMG_DIR = CARDS_DIR / "images"
CARDS_IMG_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/api/aether-cards/load")
async def cards_load():
    """加载卡片数据"""
    if CARDS_JSON.exists():
        return json.loads(CARDS_JSON.read_text(encoding="utf-8"))
    return {"version": 1, "canvas": {"offsetX": 0, "offsetY": 0, "zoom": 1}, "cards": []}


@app.put("/api/aether-cards/save")
async def cards_save(body: dict = Body(...)):
    """保存卡片数据"""
    CARDS_DIR.mkdir(parents=True, exist_ok=True)
    CARDS_JSON.write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True}


@app.post("/api/aether-cards/upload")
async def cards_upload(file: UploadFile = File(...)):
    """上传图片到卡片存储"""
    ext = Path(file.filename).suffix if file.filename else ".png"
    filename = f"{uuid.uuid4().hex[:12]}{ext}"
    dest = CARDS_IMG_DIR / filename
    content = await file.read()
    dest.write_bytes(content)
    return {"ok": True, "path": str(dest), "filename": filename}


@app.get("/api/aether-cards/config")
async def cards_config_load():
    """加载卡片 LLM 配置"""
    if CARDS_CONFIG_JSON.exists():
        return json.loads(CARDS_CONFIG_JSON.read_text(encoding="utf-8"))
    return {"textModels": [], "imageModels": []}


@app.put("/api/aether-cards/config")
async def cards_config_save(body: dict = Body(...)):
    """保存卡片 LLM 配置"""
    CARDS_DIR.mkdir(parents=True, exist_ok=True)
    CARDS_CONFIG_JSON.write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True}


@app.post("/api/aether-cards/chat")
async def cards_chat(body: dict = Body(...)):
    """卡片 LLM 流式对话（SSE）"""
    from fastapi.responses import StreamingResponse

    messages = body.get("messages", [])
    model = body.get("model", "")
    api_key = body.get("api_key", "")
    api_base = body.get("api_base", "")
    multimodal = body.get("multimodal", False)

    if not model or not api_key:
        return {"error": "未配置模型或 API Key"}

    async def stream():
        try:
            import httpx as _httpx

            if "claude" in model.lower():
                # Anthropic API
                import anthropic
                http_client = _httpx.Client(proxy=None, timeout=60)
                client = anthropic.Anthropic(api_key=api_key, http_client=http_client)
                system_msg = None
                chat_msgs = []
                for m in messages:
                    if m.get("role") == "system":
                        system_msg = m["content"]
                    else:
                        chat_msgs.append(m)

                kwargs = {"model": model, "max_tokens": 4096, "messages": chat_msgs}
                if system_msg:
                    kwargs["system"] = system_msg

                # 流式调用
                with client.messages.stream(**kwargs) as stream:
                    for text in stream.text_stream:
                        yield f"data: {json.dumps({'type': 'text', 'content': text})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"

            else:
                # OpenAI-compatible API
                import openai
                http_client = _httpx.Client(proxy=None, timeout=60)
                client_args = {"api_key": api_key, "http_client": http_client}
                if api_base:
                    client_args["base_url"] = api_base
                client = openai.OpenAI(**client_args)

                kwargs = {"model": model, "messages": messages, "max_tokens": 4096, "stream": True}
                response = await asyncio.to_thread(
                    lambda: client.chat.completions.create(**kwargs)
                )
                for chunk in response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield f"data: {json.dumps({'type': 'text', 'content': chunk.choices[0].delta.content})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/api/aether-cards/generate-image")
async def cards_generate_image(body: dict = Body(...)):
    """卡片文生图"""
    prompt = body.get("prompt", "")
    model = body.get("model", "")
    api_key = body.get("api_key", "")
    api_base = body.get("api_base", "")

CARDS_CHAT_HISTORY_JSON = CARDS_DIR / "chat_history.json"


@app.get("/api/aether-cards/chat-history")
async def cards_chat_history_load():
    """加载对话历史"""
    if not CARDS_CHAT_HISTORY_JSON.exists():
        return {"conversations": {}}
    try:
        return json.loads(CARDS_CHAT_HISTORY_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {"conversations": {}}


@app.put("/api/aether-cards/chat-history")
async def cards_chat_history_save(body: dict = Body(...)):
    """保存对话历史"""
    CARDS_DIR.mkdir(parents=True, exist_ok=True)
    CARDS_CHAT_HISTORY_JSON.write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True}

    if not model or not api_key:
        return {"error": "未配置模型或 API Key"}

    try:
        import openai
        import httpx as _httpx
        http_client = _httpx.Client(proxy=None, timeout=120)
        client_args = {"api_key": api_key, "http_client": http_client}
        if api_base:
            client_args["base_url"] = api_base
        client = openai.OpenAI(**client_args)

        response = await asyncio.to_thread(
            lambda: client.images.generate(model=model, prompt=prompt, n=1, size="1024x1024")
        )

        # 保存图片到卡片存储
        import base64
        import urllib.request
        img_data = response.data[0]
        filename = f"gen-{uuid.uuid4().hex[:8]}.png"

        if hasattr(img_data, 'b64_json') and img_data.b64_json:
            img_bytes = base64.b64decode(img_data.b64_json)
            (CARDS_IMG_DIR / filename).write_bytes(img_bytes)
        elif hasattr(img_data, 'url') and img_data.url:
            urllib.request.urlretrieve(img_data.url, str(CARDS_IMG_DIR / filename))
        else:
            return {"error": "生成的图片无数据"}

        return {"ok": True, "filename": filename, "revised_prompt": getattr(img_data, 'revised_prompt', '')}

    except Exception as e:
        return {"error": str(e)}


# ═══════════════════════════════════════════════
# 统一 LLM 调用接口
# ═══════════════════════════════════════════════

@app.post("/api/llm/chat")
async def llm_chat(body: dict = Body(...)):
    """统一 LLM 流式对话（SSE）。支持引用模式和内联模式。"""
    from fastapi.responses import StreamingResponse

    messages = body.get("messages", [])
    model = body.get("model", "")
    api_key = body.get("api_key", "")
    api_base = body.get("api_base", "")
    max_tokens = body.get("max_tokens", 4096)
    system = body.get("system", None)

    if not model:
        return JSONResponse({"error": "未指定模型"}, status_code=400)
    if not api_key and "/" not in model:
        return JSONResponse({"error": "内联模式需要 api_key，或使用 provider_id/model_id 格式"}, status_code=400)

    async def stream():
        async for event in llm_service.chat_stream(
            messages=messages, model=model,
            max_tokens=max_tokens, system=system,
            api_key=api_key or None, api_base=api_base or None,
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/api/llm/generate-image")
async def llm_generate_image(body: dict = Body(...)):
    """统一图像生成。"""
    prompt = body.get("prompt", "")
    model = body.get("model", "")
    api_key = body.get("api_key", "")
    api_base = body.get("api_base", "")

    if not model:
        return JSONResponse({"error": "未指定模型"}, status_code=400)

    result = await llm_service.generate_image(
        prompt=prompt, model=model,
        api_key=api_key or None, api_base=api_base or None,
    )

    if "error" in result:
        return JSONResponse(result, status_code=400)

    # 保存图片到卡片存储（兼容性）
    import base64
    img_bytes = result.get("image_bytes")
    if img_bytes:
        filename = f"gen-{uuid.uuid4().hex[:8]}.png"
        CARDS_IMG_DIR.mkdir(parents=True, exist_ok=True)
        (CARDS_IMG_DIR / filename).write_bytes(img_bytes)
        return {"ok": True, "filename": filename, "revised_prompt": result.get("revised_prompt", "")}

    return JSONResponse({"error": "生成失败"}, status_code=500)


@app.get("/api/llm/config")
async def llm_get_config():
    """获取 LLM 配置（key 脱敏）。"""
    return llm_service.get_config()


@app.put("/api/llm/config")
async def llm_update_config(body: dict = Body(...)):
    """更新 LLM 配置。"""
    llm_service.update_config(body)
    return {"ok": True}


@app.get("/api/llm/providers")
async def llm_list_providers():
    """获取 provider 列表（脱敏）。"""
    return llm_service.list_providers()


@app.get("/api/llm/models")
async def llm_list_models():
    """获取扁平模型列表。"""
    return llm_service.list_models()


# ═══════════════════════════════════════════════
# 区域 11: 通用数据库 API
# ═══════════════════════════════════════════════

import aiosqlite

DATA_DIR = Path.home() / ".aetheros" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# 禁止的 SQL 操作
FORBIDDEN_KEYWORDS = {"DROP", "ALTER", "ATTACH", "DETACH", "VACUUM", "REINDEX"}

# 连接池：数据库名 -> 连接
_db_pool: dict[str, aiosqlite.Connection] = {}


async def _get_db_connection(database: str) -> aiosqlite.Connection:
    """获取或创建数据库连接（连接复用）"""
    if database not in _db_pool:
        db_path = _validate_db_name(database)
        db = await aiosqlite.connect(db_path)
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA synchronous=NORMAL")
        _db_pool[database] = db
    return _db_pool[database]


@app.on_event("shutdown")
async def close_db_pool():
    """关闭所有数据库连接"""
    for db in _db_pool.values():
        await db.close()
    _db_pool.clear()


def _validate_db_name(database: str) -> Path:
    """验证数据库名称，返回安全路径"""
    # 只允许字母、数字、下划线、连字符
    safe = "".join(c for c in database if c.isalnum() or c in "_-")
    if not safe:
        raise ValueError("无效的数据库名称")
    return DATA_DIR / f"{safe}.db"


def _validate_sql(sql: str):
    """验证 SQL 语句安全性"""
    upper = sql.upper().strip()
    for keyword in FORBIDDEN_KEYWORDS:
        if keyword in upper:
            raise ValueError(f"禁止的操作: {keyword}")


@app.post("/api/db/{database}/query")
async def db_query(database: str, body: dict = Body(...)):
    """执行 SELECT 查询"""
    try:
        sql = body.get("sql", "")
        params = body.get("params", [])

        _validate_sql(sql)

        db = await _get_db_connection(database)
        db.row_factory = aiosqlite.Row
        async with db.execute(sql, params) as cursor:
            rows = await cursor.fetchall()
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            return {"rows": [dict(row) for row in rows], "columns": columns}
    except Exception as e:
        return {"error": str(e), "rows": [], "columns": []}


@app.post("/api/db/{database}/execute")
async def db_execute(database: str, body: dict = Body(...)):
    """执行 INSERT/UPDATE/DELETE"""
    try:
        sql = body.get("sql", "")
        params = body.get("params", [])

        _validate_sql(sql)

        db = await _get_db_connection(database)
        cursor = await db.execute(sql, params)
        await db.commit()
        return {"rows_affected": cursor.rowcount, "last_row_id": cursor.lastrowid}
    except Exception as e:
        return {"error": str(e), "rows_affected": 0, "last_row_id": None}


@app.post("/api/db/{database}/batch")
async def db_batch(database: str, body: dict = Body(...)):
    """批量执行 SQL 语句（事务）"""
    try:
        statements = body.get("statements", [])
        if not statements:
            return {"error": "statements 不能为空", "results": []}

        db = await _get_db_connection(database)
        await db.execute("BEGIN")
        results = []
        for stmt in statements:
            sql = stmt.get("sql", "")
            params = stmt.get("params", [])
            _validate_sql(sql)
            cursor = await db.execute(sql, params)
            results.append({"rows_affected": cursor.rowcount, "last_row_id": cursor.lastrowid})
        await db.commit()
        return {"results": results}
    except Exception as e:
        # 事务会自动回滚
        return {"error": str(e), "results": []}


# ═══════════════════════════════════════════════
# 静态文件 & 入口
# ═══════════════════════════════════════════════
# 区域 12: 存储管理
# ═══════════════════════════════════════════════

import shutil


def _get_data_root() -> Path:
    """获取数据根目录，优先读取配置，否则使用默认 ~/.aetheros"""
    config_path = Path.home() / ".aetheros" / "data_dir.json"
    if config_path.exists():
        try:
            cfg = json.loads(config_path.read_text(encoding="utf-8"))
            custom = cfg.get("data_dir")
            if custom:
                p = Path(custom)
                if p.exists():
                    return p
        except Exception:
            pass
    return Path.home() / ".aetheros"


def _dir_size(path: Path) -> int:
    """递归计算目录大小（字节）"""
    total = 0
    try:
        for entry in path.rglob("*"):
            if entry.is_file():
                total += entry.stat().st_size
    except (PermissionError, OSError):
        pass
    return total


def _format_size(size_bytes: int) -> str:
    """格式化文件大小"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


@app.get("/api/storage/usage")
async def storage_usage():
    """获取存储空间使用情况"""
    root = _get_data_root()
    if not root.exists():
        return {"root": str(root), "total": 0, "formatted_total": "0 B", "breakdown": []}

    breakdown = []
    try:
        entries = sorted(root.iterdir(), key=lambda e: e.name)
    except PermissionError:
        entries = []

    for entry in entries:
        if entry.is_dir():
            size = _dir_size(entry)
            # 统计文件数
            file_count = sum(1 for _ in entry.rglob("*") if _.is_file())
            breakdown.append({
                "name": entry.name,
                "path": str(entry),
                "size": size,
                "formatted_size": _format_size(size),
                "file_count": file_count,
            })
        elif entry.is_file():
            size = entry.stat().st_size
            breakdown.append({
                "name": entry.name,
                "path": str(entry),
                "size": size,
                "formatted_size": _format_size(size),
                "file_count": 1,
            })

    # 按大小降序排列
    breakdown.sort(key=lambda x: x["size"], reverse=True)
    total = sum(b["size"] for b in breakdown)

    # 计算磁盘总空间和可用空间
    disk_total = 0
    disk_free = 0
    try:
        usage = shutil.disk_usage(root)
        disk_total = usage.total
        disk_free = usage.free
    except Exception:
        pass

    return {
        "root": str(root),
        "total": total,
        "formatted_total": _format_size(total),
        "breakdown": breakdown,
        "disk_total": disk_total,
        "disk_free": disk_free,
        "formatted_disk_total": _format_size(disk_total),
        "formatted_disk_free": _format_size(disk_free),
    }


@app.get("/api/storage/config")
async def storage_config():
    """获取存储配置信息"""
    root = _get_data_root()
    default_path = str(Path.home() / ".aetheros")
    config_path = Path.home() / ".aetheros" / "data_dir.json"
    is_custom = config_path.exists()
    custom_dir = None
    if is_custom:
        try:
            cfg = json.loads(config_path.read_text(encoding="utf-8"))
            custom_dir = cfg.get("data_dir")
        except Exception:
            pass
    return {
        "current_dir": str(root),
        "default_dir": default_path,
        "is_custom": is_custom and custom_dir is not None,
        "custom_dir": custom_dir,
    }


@app.post("/api/storage/migrate")
async def storage_migrate(body: dict = Body(...)):
    """迁移数据目录到新位置"""
    new_dir = body.get("target_dir", "").strip()
    if not new_dir:
        return {"error": "目标目录不能为空"}

    target = Path(new_dir).expanduser().resolve()
    source = _get_data_root()

    if str(target) == str(source):
        return {"error": "目标目录与当前目录相同"}

    if target.exists() and any(target.iterdir()):
        # 目标目录非空，检查是否已有 aetheros 数据
        if (target / "data").exists() or (target / "agent").exists() or (target / "llm").exists():
            return {"error": f"目标目录 {target} 已包含 AetherOS 数据，请选择空目录或手动处理"}

    try:
        # 创建目标目录
        target.mkdir(parents=True, exist_ok=True)

        # 复制数据到新位置
        if source.exists():
            for item in source.iterdir():
                dest = target / item.name
                if item.is_dir():
                    if dest.exists():
                        shutil.rmtree(dest)
                    shutil.copytree(item, dest)
                else:
                    shutil.copy2(item, dest)

        # 保存配置
        config_path = Path.home() / ".aetheros" / "data_dir.json"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(
            json.dumps({"data_dir": str(target)}, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

        return {
            "ok": True,
            "message": f"数据已迁移到 {target}。请重启服务器以使更改生效。",
            "new_dir": str(target),
        }
    except Exception as e:
        return {"error": f"迁移失败: {str(e)}"}


@app.post("/api/storage/reset-path")
async def storage_reset_path():
    """重置数据目录为默认路径"""
    config_path = Path.home() / ".aetheros" / "data_dir.json"
    if config_path.exists():
        config_path.unlink()
    return {"ok": True, "message": "已重置为默认目录。请重启服务器以使更改生效。"}


# ═══════════════════════════════════════════════

@app.get("/")
async def root():
    return FileResponse(STATIC_DIR / "index.html")


# Mount static files AFTER all API routes
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/core", StaticFiles(directory=str(STATIC_DIR / "core")), name="core")
app.mount("/apps", StaticFiles(directory=str(STATIC_DIR / "apps")), name="apps")
app.mount("/aether-cards-images", StaticFiles(directory=str(CARDS_IMG_DIR)), name="aether-cards-images")
app.mount("/lib", StaticFiles(directory=str(STATIC_DIR / "lib")), name="lib")
app.mount("/fonts", StaticFiles(directory=str(BASE_DIR / "fonts")), name="fonts")
app.mount("/svg", StaticFiles(directory=str(BASE_DIR / "svg")), name="svg")
app.mount("/debug", StaticFiles(directory=str(STATIC_DIR / "debug")), name="debug")


# ═══════════════════════════════════════════════
# 性能模式 API
# ═══════════════════════════════════════════════

# 全局低性能模式标志
LOW_PERF_MODE = False


@app.get("/api/system/perf-mode")
async def get_perf_mode():
    """获取系统性能模式"""
    marker_path = STATIC_DIR / "perf-mode.json"
    marker_exists = marker_path.exists()
    return {
        "low_perf": LOW_PERF_MODE or marker_exists,
        "source": "flag" if LOW_PERF_MODE else ("marker" if marker_exists else "default")
    }


# ═══════════════════════════════════════════════
# 启动
# ═══════════════════════════════════════════════

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="N.O.V.A Aether OS Server")
    parser.add_argument("--port", type=int, default=8420)
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--low-perf", action="store_true", help="Enable low performance mode")
    args = parser.parse_args()

    # Set low performance mode flag
    LOW_PERF_MODE = args.low_perf

    print(f"\n  ▽ N.O.V.A Aether OS")
    print(f"  ├─ Server: http://localhost:{args.port}")
    print(f"  ├─ Static: {STATIC_DIR}")
    print(f"  ├─ Agent:  {BASE_DIR / 'agent'}")
    if LOW_PERF_MODE:
        print(f"  └─ Mode:   LOW PERFORMANCE (reduced effects)")
    else:
        print(f"  └─ Mode:   Normal")
    print()

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
