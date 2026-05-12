"""
Eos-Tools: edit_file 工具
局部编辑文件，支持 replace 和 patch 两种模式。
"""

import json
import difflib
from pathlib import Path
from typing import Optional


def edit_file(path: str, mode: str = "replace",
              old_string: str = "", new_string: str = "",
              replace_all: bool = False, patch: str = "",
              trace_update: bool = True,
              error_fix_id: Optional[str] = None) -> dict:
    """
    局部编辑文件。

    Args:
        path: 文件路径
        mode: "replace" 或 "patch"
        old_string: 要替换的文本（replace 模式）
        new_string: 替换后的文本（replace 模式）
        replace_all: 是否替换所有匹配（replace 模式）
        patch: unified diff 内容（patch 模式）
        trace_update: 是否更新 trace
        error_fix_id: 可选，用于修正失败调用

    Returns:
        包含 status, diff 等字段的字典
    """
    try:
        file_path = Path(path).resolve()

        if not file_path.exists():
            return {
                "status": "error",
                "path": str(file_path),
                "error": "File not found",
                "tool_call_id": None
            }

        # 读取原文件内容
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()

        original_lines = original_content.splitlines(keepends=True)

        if mode == "replace":
            # replace 模式
            if old_string not in original_content:
                return {
                    "status": "error",
                    "path": str(file_path),
                    "error": f"old_string not found in file",
                    "tool_call_id": None
                }

            if replace_all:
                new_content = original_content.replace(old_string, new_string)
            else:
                new_content = original_content.replace(old_string, new_string, 1)

        elif mode == "patch":
            # patch 模式（简化实现，实际应该解析 unified diff）
            return {
                "status": "error",
                "path": str(file_path),
                "error": "Patch mode not yet implemented",
                "tool_call_id": None
            }

        else:
            return {
                "status": "error",
                "path": str(file_path),
                "error": f"Unknown mode: {mode}",
                "tool_call_id": None
            }

        # 写入新内容
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        new_lines = new_content.splitlines(keepends=True)

        # 计算 diff
        diff = list(difflib.unified_diff(
            original_lines, new_lines,
            fromfile=f"a/{file_path.name}",
            tofile=f"b/{file_path.name}",
            lineterm=""
        ))
        diff_text = "\n".join(diff)

        # 计算行号变化
        old_line_count = len(original_lines)
        new_line_count = len(new_lines)
        line_delta = new_line_count - old_line_count

        # 计算 affected ranges（简化实现）
        # 找到 old_string 在原文件中的行范围
        old_start = -1
        old_end = -1
        for i, line in enumerate(original_lines):
            if old_string in line:
                if old_start == -1:
                    old_start = i + 1
                old_end = i + 1

        new_start = old_start
        new_end = old_start + len(new_string.splitlines()) - 1 if old_start > 0 else -1

        return {
            "status": "ok",
            "path": str(file_path),
            "mode": mode,
            "trace_update": trace_update,
            "diff": diff_text,
            "line_delta": line_delta,
            "affected_old_range": [old_start, old_end] if old_start > 0 else None,
            "affected_new_range": [new_start, new_end] if new_start > 0 else None,
            "old_line_count": old_line_count,
            "new_line_count": new_line_count
        }

    except Exception as e:
        return {
            "status": "error",
            "path": str(Path(path).resolve()),
            "error": str(e),
            "tool_call_id": None
        }


def get_tool_definition() -> dict:
    """获取工具定义"""
    return {
        "name": "edit_file",
        "description": "局部编辑文件。支持 replace（定点替换）和 patch（unified diff）两种模式。",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "文件路径"
                },
                "mode": {
                    "type": "string",
                    "enum": ["replace", "patch"],
                    "description": "编辑模式",
                    "default": "replace"
                },
                "old_string": {
                    "type": "string",
                    "description": "要替换的文本（replace 模式）"
                },
                "new_string": {
                    "type": "string",
                    "description": "替换后的文本（replace 模式）"
                },
                "replace_all": {
                    "type": "boolean",
                    "description": "是否替换所有匹配（replace 模式）",
                    "default": False
                },
                "patch": {
                    "type": "string",
                    "description": "unified diff 内容（patch 模式）"
                },
                "trace_update": {
                    "type": "boolean",
                    "description": "成功后是否更新 trace",
                    "default": True
                },
                "error_fix_id": {
                    "type": "string",
                    "description": "可选，用于修正失败的同名工具调用"
                }
            },
            "required": ["path"]
        }
    }
