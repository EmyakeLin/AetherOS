"""
Eos-Tools: read_file 工具
读取文件内容，支持 trace 模式。
"""

import json
from pathlib import Path
from typing import Optional


def read_file(path: str, offset: int = 1, limit: int = 500,
              trace: bool = False, error_fix_id: Optional[str] = None) -> dict:
    """
    读取文件内容。

    Args:
        path: 文件路径
        offset: 起始行号 (1-indexed)
        limit: 读取行数
        trace: 是否启用 trace
        error_fix_id: 可选，用于修正失败调用

    Returns:
        包含 status, path, content 等字段的字典
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

        with open(file_path, 'r', encoding='utf-8') as f:
            all_lines = f.readlines()

        total_lines = len(all_lines)
        start_line = max(1, offset)
        end_line = min(total_lines, offset + limit - 1)

        if start_line > total_lines:
            return {
                "status": "error",
                "path": str(file_path),
                "error": f"Offset {offset} exceeds file length {total_lines}",
                "tool_call_id": None
            }

        # 提取内容（1-indexed 转 0-indexed）
        content_lines = all_lines[start_line - 1:end_line]
        content = "".join(content_lines)

        # 添加行号
        numbered_content = ""
        for i, line in enumerate(content_lines):
            line_num = start_line + i
            numbered_content += f"{line_num}|{line}"

        return {
            "status": "ok",
            "path": str(file_path),
            "offset": offset,
            "limit": limit,
            "start_line": start_line,
            "end_line": end_line,
            "total_lines": total_lines,
            "content": numbered_content,
            "truncated": end_line < total_lines,
            "trace_enabled": trace
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
        "name": "read_file",
        "description": "读取文件内容。支持指定行范围，可选启用 trace 模式。",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "文件路径"
                },
                "offset": {
                    "type": "integer",
                    "description": "起始行号 (1-indexed)",
                    "default": 1
                },
                "limit": {
                    "type": "integer",
                    "description": "读取行数",
                    "default": 500
                },
                "trace": {
                    "type": "boolean",
                    "description": "是否启用 trace 模式",
                    "default": False
                },
                "error_fix_id": {
                    "type": "string",
                    "description": "可选，用于修正失败的同名工具调用"
                }
            },
            "required": ["path"]
        }
    }
