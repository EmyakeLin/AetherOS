from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Optional


def _empty_cache(session_id: str = "") -> Dict[str, Any]:
    return {"session_id": session_id, "version": 1, "last_processed_message_index": -1, "files": {}}


def _load_cache(path: str, session_id: str = "") -> Dict[str, Any]:
    p = Path(path)
    if not p.exists():
        return _empty_cache(session_id)
    return json.loads(p.read_text(encoding="utf-8"))


def _save_cache(path: str, cache: Dict[str, Any]) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def trace_file(path: str, operation: str, trace_cache_path: str, session_id: str = "") -> Dict[str, Any]:
    resolved = str(Path(path).expanduser())
    op = operation.lower().strip()
    if op not in {"trace", "untrace"}:
        return {"status": "error", "path": resolved, "error": "operation must be trace or untrace"}
    cache = _load_cache(trace_cache_path, session_id=session_id)
    files = cache.setdefault("files", {})
    state = files.setdefault(resolved, {
        "enabled": False,
        "oversize": False,
        "current_version": 0,
        "last_event_message_index": -1,
        "last_trace_message_index": -1,
        "known_ranges": [],
        "trace_nodes": [],
        "events": [],
    })
    state["enabled"] = op == "trace"
    state.setdefault("events", []).append({"tool": "trace_file", "type": op, "path": resolved})
    _save_cache(trace_cache_path, cache)
    return {"status": "traced" if op == "trace" else "untraced", "path": resolved, "trace_cache_path": str(Path(trace_cache_path))}


SCHEMA = {
    "name": "trace_file",
    "description": "Add or remove a file from session-level file_trace management.",
    "parameters": {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "operation": {"type": "string", "enum": ["trace", "untrace"]},
            "trace_cache_path": {"type": "string"},
            "session_id": {"type": "string"},
        },
        "required": ["path", "operation", "trace_cache_path"],
    },
}
