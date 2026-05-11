from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Optional


def _line_count(content: str) -> int:
    if content == "":
        return 0
    return len(content.splitlines())


def _number_lines(lines, start: int) -> str:
    return "\n".join(f"{line_no}|{line}" for line_no, line in enumerate(lines, start=start))


def read_file(path: str, offset: int = 1, limit: int = 500, trace: bool = False, error_fix_id: Optional[str] = None) -> Dict[str, Any]:
    resolved = str(Path(path).expanduser())
    try:
        start = max(1, int(offset))
        count = max(1, int(limit))
        text = Path(resolved).read_text(encoding="utf-8")
        lines = text.splitlines()
        selected = lines[start - 1:start - 1 + count]
        end = start + len(selected) - 1 if selected else start - 1
        result = {
            "status": "ok",
            "path": resolved,
            "offset": start,
            "limit": count,
            "start_line": start,
            "end_line": end,
            "total_lines": len(lines),
            "content": _number_lines(selected, start),
            "truncated": end < len(lines),
            "trace_enabled": bool(trace),
        }
        if error_fix_id:
            result["error_fix_id"] = error_fix_id
        return result
    except Exception as exc:
        result = {"status": "error", "path": resolved, "error": str(exc)}
        if error_fix_id:
            result["error_fix_id"] = error_fix_id
        return result


SCHEMA = {
    "name": "read_file",
    "description": "Read a text file with line numbers. Optional trace=true adds the file to file_trace management.",
    "parameters": {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "offset": {"type": "integer", "default": 1},
            "limit": {"type": "integer", "default": 500},
            "trace": {"type": "boolean", "default": False},
            "error_fix_id": {"type": "string"},
        },
        "required": ["path"],
    },
}
