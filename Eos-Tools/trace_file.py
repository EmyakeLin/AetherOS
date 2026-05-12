"""
Eos-Tools: trace_file 工具
文件状态追踪控制。
"""

import json
from pathlib import Path
from typing import Optional


def trace_file(path: str, operation: str = "trace") -> dict:
    """
    控制文件的 trace 状态。

    Args:
        path: 文件路径
        operation: "trace" 或 "untrace"

    Returns:
        包含 status, path, operation 等字段的字典
    """
    try:
        file_path = Path(path).resolve()

        if operation not in ["trace", "untrace"]:
            return {
                "status": "error",
                "path": str(file_path),
                "error": f"Unknown operation: {operation}. Must be 'trace' or 'untrace'.",
                "tool_call_id": None
            }

        return {
            "status": "ok",
            "path": str(file_path),
            "operation": operation,
            "message": f"File {operation}d successfully"
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
        "name": "trace_file",
        "description": "控制文件的 trace 状态。trace 后，该文件的所有读/写/改操作将被追踪。",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "文件路径"
                },
                "operation": {
                    "type": "string",
                    "enum": ["trace", "untrace"],
                    "description": "操作类型",
                    "default": "trace"
                }
            },
            "required": ["path"]
        }
    }
