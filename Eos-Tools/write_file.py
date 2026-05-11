from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any, Dict, Optional


def write_file(path: str, content: str, error_fix_id: Optional[str] = None) -> Dict[str, Any]:
    resolved = str(Path(path).expanduser())
    try:
        target = Path(resolved)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        data = content.encode("utf-8")
        result = {
            "status": "ok",
            "path": resolved,
            "content": content,
            "bytes_written": len(data),
            "total_lines": 0 if content == "" else len(content.splitlines()),
            "content_hash": hashlib.sha256(data).hexdigest(),
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
    "name": "write_file",
    "description": "Write full file content. Context projection may omit arguments, but successful output preserves full text semantics.",
    "parameters": {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "content": {"type": "string"},
            "error_fix_id": {"type": "string"},
        },
        "required": ["path", "content"],
    },
}
