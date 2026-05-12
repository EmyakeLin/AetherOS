"""
Eos-Tools: write_file 工具
用完整文本覆盖文件。
"""

import json
import hashlib
from pathlib import Path
from typing import Optional


def write_file(path: str, content: str, error_fix_id: Optional[str] = None) -> dict:
    """
    用完整文本覆盖文件。

    Args:
        path: 文件路径
        content: 完整文件内容
        error_fix_id: 可选，用于修正失败调用

    Returns:
        包含 status, path, content 等字段的字典
    """
    try:
        file_path = Path(path).resolve()

        # 确保父目录存在
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        # 计算内容 hash
        content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()[:16]

        # 统计行数
        total_lines = content.count('\n') + 1 if content else 0

        return {
            "status": "ok",
            "path": str(file_path),
            "content": content,
            "bytes_written": len(content.encode('utf-8')),
            "total_lines": total_lines,
            "content_hash": content_hash
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
        "name": "write_file",
        "description": "用完整文本覆盖文件。成功后，该文件的所有旧内容在当前版本语义上过期。",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "文件路径"
                },
                "content": {
                    "type": "string",
                    "description": "完整文件内容"
                },
                "error_fix_id": {
                    "type": "string",
                    "description": "可选，用于修正失败的同名工具调用"
                }
            },
            "required": ["path", "content"]
        }
    }
