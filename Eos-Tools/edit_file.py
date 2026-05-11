from __future__ import annotations

import difflib
from pathlib import Path
from typing import Any, Dict, Optional


def _diff(old: str, new: str, path: str) -> str:
    return "".join(difflib.unified_diff(old.splitlines(True), new.splitlines(True), fromfile=f"a/{path}", tofile=f"b/{path}"))


def _find_block(lines: list[str], old_lines: list[str]) -> int:
    if not old_lines:
        return -1
    for idx in range(0, len(lines) - len(old_lines) + 1):
        if lines[idx:idx + len(old_lines)] == old_lines:
            return idx
    return -1


def _parse_v4a_blocks(patch_text: str) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    current: Optional[dict[str, Any]] = None
    in_hunk = False
    for raw in patch_text.splitlines():
        if raw.startswith("*** Update File:"):
            if current:
                blocks.append(current)
            current = {"old": [], "new": []}
            in_hunk = False
            continue
        if raw.startswith("@@"):
            in_hunk = True
            continue
        if raw.startswith("*** End Patch"):
            break
        if current is None or not in_hunk:
            continue
        if raw.startswith("-"):
            current["old"].append(raw[1:])
        elif raw.startswith("+"):
            current["new"].append(raw[1:])
        elif raw.startswith(" "):
            text = raw[1:]
            current["old"].append(text)
            current["new"].append(text)
        else:
            current["old"].append(raw)
            current["new"].append(raw)
    if current:
        blocks.append(current)
    return blocks


def _apply_v4a_patch(old_content: str, patch_text: str, path: str) -> Dict[str, Any]:
    lines = old_content.splitlines()
    operations = []
    for block in _parse_v4a_blocks(patch_text):
        old_lines = block["old"]
        new_lines = block["new"]
        idx = _find_block(lines, old_lines)
        if idx < 0:
            return {"status": "error", "path": path, "error": "patch block not found in file."}
        old_start = idx + 1
        old_end = idx + len(old_lines)
        changed_prefix = 0
        while changed_prefix < len(old_lines) and changed_prefix < len(new_lines) and old_lines[changed_prefix] == new_lines[changed_prefix]:
            changed_prefix += 1
        changed_suffix = 0
        while (
            changed_suffix < len(old_lines) - changed_prefix
            and changed_suffix < len(new_lines) - changed_prefix
            and old_lines[len(old_lines) - 1 - changed_suffix] == new_lines[len(new_lines) - 1 - changed_suffix]
        ):
            changed_suffix += 1
        changed_old_start = old_start + changed_prefix
        changed_old_end = old_end - changed_suffix
        changed_new_start = old_start + changed_prefix
        changed_new_end = changed_new_start + (len(new_lines) - changed_prefix - changed_suffix) - 1
        lines = lines[:idx] + new_lines + lines[idx + len(old_lines):]
        operations.append({"old_range": [changed_old_start, changed_old_end], "new_range": [changed_new_start, changed_new_end], "line_delta": len(new_lines) - len(old_lines)})
    trailing = "\n" if old_content.endswith("\n") else ""
    return {"status": "ok", "path": path, "content": "\n".join(lines) + trailing, "operations": operations}


def edit_file(
    path: str,
    mode: str = "replace",
    old_string: Optional[str] = None,
    new_string: Optional[str] = None,
    replace_all: bool = False,
    patch: Optional[str] = None,
    trace_update: bool = True,
    error_fix_id: Optional[str] = None,
) -> Dict[str, Any]:
    resolved = str(Path(path).expanduser())
    try:
        target = Path(resolved)
        old_content = target.read_text(encoding="utf-8")
        if mode == "patch":
            if not patch:
                return {"status": "error", "path": resolved, "error": "patch content is required for patch mode."}
            patch_result = _apply_v4a_patch(old_content, patch, resolved)
            if patch_result["status"] != "ok":
                return patch_result
            new_content = patch_result["content"]
            target.write_text(new_content, encoding="utf-8")
            result = {
                "status": "ok",
                "path": resolved,
                "mode": mode,
                "trace_update": bool(trace_update),
                "diff": _diff(old_content, new_content, resolved),
                "operations": patch_result["operations"],
                "line_delta": sum(op["line_delta"] for op in patch_result["operations"]),
            }
            if error_fix_id:
                result["error_fix_id"] = error_fix_id
            return result
        if mode != "replace":
            return {"status": "error", "path": resolved, "error": "mode must be replace or patch."}
        if old_string is None or new_string is None:
            return {"status": "error", "path": resolved, "error": "old_string and new_string are required for replace mode."}
        count = old_content.count(old_string)
        if count == 0:
            return {"status": "error", "path": resolved, "error": "old_string not found."}
        if count > 1 and not replace_all:
            return {"status": "error", "path": resolved, "error": f"Found {count} matches; set replace_all=true or provide more context."}
        new_content = old_content.replace(old_string, new_string) if replace_all else old_content.replace(old_string, new_string, 1)
        target.write_text(new_content, encoding="utf-8")
        result = {
            "status": "ok",
            "path": resolved,
            "mode": mode,
            "trace_update": bool(trace_update),
            "diff": _diff(old_content, new_content, resolved),
            "replacements": count if replace_all else 1,
            "line_delta": len(new_string.splitlines()) - len(old_string.splitlines()),
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
    "name": "edit_file",
    "description": "Edit a file. Successful calls return a unified diff and may update file_trace unless trace_update=false.",
    "parameters": {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "mode": {"type": "string", "enum": ["replace", "patch"], "default": "replace"},
            "old_string": {"type": "string"},
            "new_string": {"type": "string"},
            "replace_all": {"type": "boolean", "default": False},
            "patch": {"type": "string"},
            "trace_update": {"type": "boolean", "default": True},
            "error_fix_id": {"type": "string"},
        },
        "required": ["path"],
    },
}
