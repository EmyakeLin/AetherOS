"""
内置工具 — 文件操作
read_file, write_file, list_dir
"""

from pathlib import Path


async def _read_file(params: dict) -> str:
    path = params.get("path", "")
    if not path:
        return "错误: 未指定路径"
    try:
        p = Path(path).expanduser()
        if not p.exists():
            return f"错误: 文件不存在: {path}"
        if p.stat().st_size > 1024 * 1024:
            return "错误: 文件过大 (>1MB)"
        return p.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        return f"错误: {e}"


async def _write_file(params: dict) -> str:
    path = params.get("path", "")
    content = params.get("content", "")
    if not path:
        return "错误: 未指定路径"
    try:
        p = Path(path).expanduser()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"已写入: {path} ({len(content)} 字符)"
    except Exception as e:
        return f"错误: {e}"


async def _list_dir(params: dict) -> str:
    path = params.get("path", ".")
    try:
        p = Path(path).expanduser()
        if not p.is_dir():
            return f"错误: 不是目录: {path}"
        items = []
        for entry in sorted(p.iterdir()):
            prefix = "📁" if entry.is_dir() else "📄"
            items.append(f"{prefix} {entry.name}")
        return "\n".join(items) if items else "空目录"
    except Exception as e:
        return f"错误: {e}"


# ── 自注册 ──

TOOL_SCHEMAS = [
    {
        "name": "read_file",
        "description": "读取文件内容",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径"}
            },
            "required": ["path"]
        },
        "handler": _read_file,
        "toolset": "file",
    },
    {
        "name": "write_file",
        "description": "写入文件内容",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径"},
                "content": {"type": "string", "description": "文件内容"}
            },
            "required": ["path", "content"]
        },
        "handler": _write_file,
        "toolset": "file",
    },
    {
        "name": "list_dir",
        "description": "列出目录内容",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "目录路径"}
            },
            "required": ["path"]
        },
        "handler": _list_dir,
        "toolset": "file",
    },
]
