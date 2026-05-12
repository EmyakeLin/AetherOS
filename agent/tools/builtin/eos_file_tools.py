"""
内置工具 — Eos-Tools 文件管理工具集
eos_read_file, eos_write_file, eos_edit_file
支持上下文管理
"""

import sys
from pathlib import Path

# 添加 Eos-Tools 目录到路径
eos_tools_dir = Path(__file__).parent.parent.parent.parent / "Eos-Tools"
sys.path.insert(0, str(eos_tools_dir))

from read_file import read_file as _read_file_impl
from write_file import write_file as _write_file_impl
from edit_file import edit_file as _edit_file_impl


async def _eos_read_file(params: dict) -> str:
    path = params.get("path", "")
    offset = params.get("offset", 1)
    limit = params.get("limit", 500)
    trace = params.get("trace", False)
    error_fix_id = params.get("error_fix_id")

    result = _read_file_impl(
        path=path,
        offset=offset,
        limit=limit,
        trace=trace,
        error_fix_id=error_fix_id
    )

    if result.get("status") == "error":
        return f"错误: {result.get('error', '未知错误')}"

    content = result.get("content", "")
    return content


async def _eos_write_file(params: dict) -> str:
    path = params.get("path", "")
    content = params.get("content", "")
    error_fix_id = params.get("error_fix_id")

    result = _write_file_impl(
        path=path,
        content=content,
        error_fix_id=error_fix_id
    )

    if result.get("status") == "error":
        return f"错误: {result.get('error', '未知错误')}"

    return f"已写入: {path} ({result.get('bytes_written', 0)} 字符, {result.get('total_lines', 0)} 行)"


async def _eos_edit_file(params: dict) -> str:
    path = params.get("path", "")
    mode = params.get("mode", "replace")
    old_string = params.get("old_string", "")
    new_string = params.get("new_string", "")
    replace_all = params.get("replace_all", False)
    patch = params.get("patch", "")
    trace_update = params.get("trace_update", True)
    error_fix_id = params.get("error_fix_id")

    result = _edit_file_impl(
        path=path,
        mode=mode,
        old_string=old_string,
        new_string=new_string,
        replace_all=replace_all,
        patch=patch,
        trace_update=trace_update,
        error_fix_id=error_fix_id
    )

    if result.get("status") == "error":
        return f"错误: {result.get('error', '未知错误')}"

    diff = result.get("diff", "")
    return f"已编辑: {path}\n\n```diff\n{diff}\n```"


# ── 自注册 ──

TOOL_SCHEMAS = [
    {
        "name": "eos_read_file",
        "description": "读取文件内容（支持上下文管理）",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径"},
                "offset": {"type": "integer", "description": "起始行号 (1-indexed)", "default": 1},
                "limit": {"type": "integer", "description": "读取行数", "default": 500},
                "trace": {"type": "boolean", "description": "是否启用 trace", "default": False},
                "error_fix_id": {"type": "string", "description": "用于修正失败的同名工具调用"}
            },
            "required": ["path"]
        },
        "handler": _eos_read_file,
        "toolset": "eos-tools-file-management",
    },
    {
        "name": "eos_write_file",
        "description": "用完整文本覆盖文件（支持上下文管理）",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径"},
                "content": {"type": "string", "description": "完整文件内容"},
                "error_fix_id": {"type": "string", "description": "用于修正失败的同名工具调用"}
            },
            "required": ["path", "content"]
        },
        "handler": _eos_write_file,
        "toolset": "eos-tools-file-management",
    },
    {
        "name": "eos_edit_file",
        "description": "局部编辑文件（支持上下文管理）",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径"},
                "mode": {"type": "string", "enum": ["replace", "patch"], "description": "编辑模式", "default": "replace"},
                "old_string": {"type": "string", "description": "要替换的文本（replace 模式）"},
                "new_string": {"type": "string", "description": "替换后的文本（replace 模式）"},
                "replace_all": {"type": "boolean", "description": "是否替换所有匹配", "default": False},
                "patch": {"type": "string", "description": "unified diff 内容（patch 模式）"},
                "trace_update": {"type": "boolean", "description": "是否更新 trace", "default": True},
                "error_fix_id": {"type": "string", "description": "用于修正失败的同名工具调用"}
            },
            "required": ["path"]
        },
        "handler": _eos_edit_file,
        "toolset": "eos-tools-file-management",
    },
]
