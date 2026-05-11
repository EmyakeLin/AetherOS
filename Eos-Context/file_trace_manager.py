from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

MANAGED_TOOLS = {"read_file", "write_file", "edit_file"}
TRACE_TOOL = "trace_file"
DEFAULT_TRACE_CHAR_LIMIT = 40000


@dataclass
class KnownRange:
    start: int
    lines: List[str]
    source: str = "unknown"
    source_message_index: int = -1
    version: int = 0

    @property
    def end(self) -> int:
        return self.start + len(self.lines) - 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start": self.start,
            "end": self.end,
            "content": self.lines,
            "source": self.source,
            "source_message_index": self.source_message_index,
            "version": self.version,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "KnownRange":
        return cls(
            start=int(data["start"]),
            lines=list(data.get("content", [])),
            source=data.get("source", "unknown"),
            source_message_index=int(data.get("source_message_index", -1)),
            version=int(data.get("version", 0)),
        )


@dataclass
class FileState:
    path: str
    enabled: bool = False
    oversize: bool = False
    current_version: int = 0
    last_event_message_index: int = -1
    last_trace_message_index: int = -1
    known_ranges: List[KnownRange] = field(default_factory=list)
    events: List[Dict[str, Any]] = field(default_factory=list)
    trace_nodes: List[Dict[str, Any]] = field(default_factory=list)
    pending_sources: List[str] = field(default_factory=list)
    pending_changes: List[str] = field(default_factory=list)
    needs_trace: bool = False
    delta_only: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "enabled": self.enabled,
            "oversize": self.oversize,
            "current_version": self.current_version,
            "last_event_message_index": self.last_event_message_index,
            "last_trace_message_index": self.last_trace_message_index,
            "known_ranges": [r.to_dict() for r in self.known_ranges],
            "trace_nodes": self.trace_nodes,
            "events": self.events,
            "pending_sources": self.pending_sources,
            "pending_changes": self.pending_changes,
            "needs_trace": self.needs_trace,
            "delta_only": self.delta_only,
        }

    @classmethod
    def from_dict(cls, path: str, data: Dict[str, Any]) -> "FileState":
        return cls(
            path=path,
            enabled=bool(data.get("enabled", False)),
            oversize=bool(data.get("oversize", False)),
            current_version=int(data.get("current_version", 0)),
            last_event_message_index=int(data.get("last_event_message_index", -1)),
            last_trace_message_index=int(data.get("last_trace_message_index", -1)),
            known_ranges=[KnownRange.from_dict(r) for r in data.get("known_ranges", [])],
            trace_nodes=list(data.get("trace_nodes", [])),
            events=list(data.get("events", [])),
            pending_sources=list(data.get("pending_sources", [])),
            pending_changes=list(data.get("pending_changes", [])),
            needs_trace=bool(data.get("needs_trace", False)),
            delta_only=bool(data.get("delta_only", False)),
        )


def normalize_path(path: str) -> str:
    if not path:
        return ""
    return str(Path(path).expanduser())


def load_cache(path: str | Path, session_id: str = "") -> Dict[str, Any]:
    p = Path(path)
    if not p.exists():
        return {"session_id": session_id, "version": 1, "last_processed_message_index": -1, "files": {}}
    return json.loads(p.read_text(encoding="utf-8"))


def save_cache(path: str | Path, cache: Dict[str, Any]) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def _state(cache: Dict[str, Any], path: str) -> FileState:
    files = cache.setdefault("files", {})
    norm = normalize_path(path)
    if norm not in files:
        files[norm] = FileState(path=norm).to_dict()
    return FileState.from_dict(norm, files[norm])


def _put_state(cache: Dict[str, Any], state: FileState) -> None:
    cache.setdefault("files", {})[state.path] = state.to_dict()


def parse_args(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


def parse_content(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, list):
        return {"status": "ok", "content": raw}
    if not isinstance(raw, str):
        return {"status": "ok", "content": ""}
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    return {"status": "ok", "content": raw}


def is_success(payload: Dict[str, Any]) -> bool:
    status = str(payload.get("status", "ok")).lower()
    return status not in {"error", "failed", "failure"} and "error" not in payload


def parse_numbered_lines(content: str, default_start: int = 1) -> KnownRange:
    lines: List[Tuple[int, str]] = []
    for raw_line in str(content).splitlines():
        match = re.match(r"^\s*(\d+)\|(.*)$", raw_line)
        if match:
            lines.append((int(match.group(1)), match.group(2)))
    if lines:
        start = lines[0][0]
        return KnownRange(start=start, lines=[line for _, line in lines])
    return KnownRange(start=default_start, lines=str(content).splitlines())


def full_content_range(content: str) -> KnownRange:
    return KnownRange(start=1, lines=str(content).splitlines())


def merge_ranges(ranges: List[KnownRange]) -> List[KnownRange]:
    if not ranges:
        return []
    ordered = sorted(ranges, key=lambda r: (r.start, r.end))
    merged: List[KnownRange] = []
    for rng in ordered:
        if not rng.lines:
            continue
        if not merged:
            merged.append(copy.deepcopy(rng))
            continue
        last = merged[-1]
        if rng.start <= last.end + 1:
            overlap = max(0, last.end - rng.start + 1)
            if overlap < len(rng.lines):
                last.lines.extend(rng.lines[overlap:])
            last.version = max(last.version, rng.version)
        else:
            merged.append(copy.deepcopy(rng))
    return merged


def find_subsequence(haystack: List[str], needle: List[str]) -> Optional[int]:
    if not needle:
        return None
    limit = len(haystack) - len(needle)
    for i in range(limit + 1):
        if haystack[i:i + len(needle)] == needle:
            return i
    return None


def apply_replace_to_ranges(ranges: List[KnownRange], old: str, new: str) -> Tuple[List[KnownRange], Optional[Dict[str, Any]]]:
    old_lines = old.splitlines()
    new_lines = new.splitlines()
    if not old_lines:
        return ranges, None
    result: List[KnownRange] = []
    applied: Optional[Dict[str, Any]] = None
    delta = len(new_lines) - len(old_lines)
    old_start_line: Optional[int] = None
    old_end_line: Optional[int] = None
    new_start_line: Optional[int] = None
    new_end_line: Optional[int] = None

    for rng in merge_ranges(ranges):
        if applied is None:
            idx = find_subsequence(rng.lines, old_lines)
            if idx is not None:
                old_start_line = rng.start + idx
                old_end_line = old_start_line + len(old_lines) - 1
                new_start_line = old_start_line
                new_end_line = new_start_line + len(new_lines) - 1
                updated_lines = rng.lines[:idx] + new_lines + rng.lines[idx + len(old_lines):]
                result.append(KnownRange(start=rng.start, lines=updated_lines, source="edit_file", source_message_index=rng.source_message_index, version=rng.version + 1))
                applied = {
                    "old_range": [old_start_line, old_end_line],
                    "new_range": [new_start_line, new_end_line],
                    "line_delta": delta,
                }
                continue
        if applied is not None and old_end_line is not None and rng.start > old_end_line:
            result.append(KnownRange(start=rng.start + delta, lines=rng.lines, source=rng.source, source_message_index=rng.source_message_index, version=rng.version + 1))
        else:
            result.append(copy.deepcopy(rng))
    return merge_ranges(result), applied


def render_known_content(ranges: List[KnownRange]) -> str:
    chunks: List[str] = []
    previous_end: Optional[int] = None
    for rng in merge_ranges(ranges):
        if previous_end is not None and rng.start > previous_end + 1:
            chunks.append(f"[Unknown lines {previous_end + 1}-{rng.start - 1}]")
        for idx, line in enumerate(rng.lines, start=rng.start):
            chunks.append(f"{idx}|{line}")
        previous_end = rng.end
    if not chunks:
        return "[No known content for this file]"
    return "\n".join(chunks)


def render_file_trace(state: FileState, message_index: int, char_limit: int = DEFAULT_TRACE_CHAR_LIMIT) -> Dict[str, Any]:
    source_events = "\n".join(f"- {item}" for item in state.pending_sources) or "- No new source events recorded."
    changes = "\n".join(f"- {item}" for item in state.pending_changes) or "- No content-changing operation recorded."
    if state.delta_only:
        content = (
            f"path: {state.path}\n"
            f"trace_version: {state.current_version}\n"
            f"generated_after_message_index: {message_index}\n"
            "mode: delta_only\n\n"
            "Full file_trace content intentionally not refreshed because trace_update=false. "
            "The internal trace cache has been updated, but this model input only receives the operation delta to preserve cache locality.\n\n"
            f"Source events:\n{source_events}\n\n"
            f"Changes since previous trace:\n{changes}"
        )
        status = "delta_only"
    else:
        known = render_known_content(state.known_ranges)
        mode = "large" if state.oversize else "normal"
        content = (
            f"path: {state.path}\n"
            f"trace_version: {state.current_version}\n"
            f"generated_after_message_index: {message_index}\n"
            f"mode: {mode}\n\n"
            f"Source events:\n{source_events}\n\n"
            f"Changes since previous trace:\n{changes}\n\n"
            f"Current known content:\n{known}"
        )
        status = "active"
        if len(content) > char_limit:
            state.oversize = True
            status = "permanent"
            content = (
                f"path: {state.path}\n"
                f"trace_version: {state.current_version}\n"
                f"generated_after_message_index: {message_index}\n"
                "mode: large\n\n"
                "This file_trace exceeds the configured trace limit. It is managed as a large read_file-like output. "
                "Existing historical file content is not mechanically cleared; only recent operation effects are tracked here.\n\n"
                f"Source events:\n{source_events}\n\nChanges since previous trace:\n{changes}"
            )
    node = {
        "message_index": message_index,
        "version": state.current_version,
        "role": "file_trace",
        "content_hash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        "generated_from_events": [e.get("message_index") for e in state.events[-10:]],
        "status": status,
    }
    state.last_trace_message_index = message_index
    state.trace_nodes.append(node)
    state.pending_sources.clear()
    state.pending_changes.clear()
    state.needs_trace = False
    state.delta_only = False
    return {"role": "file_trace", "path": state.path, "content": content}


def get_tool_calls(message: Dict[str, Any]) -> List[Dict[str, Any]]:
    if message.get("role") != "assistant":
        return []
    return list(message.get("tool_calls") or [])


def tool_name(call: Dict[str, Any]) -> str:
    return str(call.get("function", {}).get("name", ""))


def tool_args(call: Dict[str, Any]) -> Dict[str, Any]:
    return parse_args(call.get("function", {}).get("arguments", "{}"))


def set_tool_args(call: Dict[str, Any], args: Dict[str, Any]) -> None:
    call.setdefault("function", {})["arguments"] = json.dumps(args, ensure_ascii=False)


def collect_results(messages: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    results = {}
    for idx, message in enumerate(messages):
        if message.get("role") == "tool":
            call_id = message.get("tool_call_id") or message.get("id")
            if call_id:
                results[str(call_id)] = {"index": idx, "message": message, "payload": parse_content(message.get("content"))}
    return results


def collect_failed_calls(messages: List[Dict[str, Any]], results: Dict[str, Dict[str, Any]]) -> Dict[str, str]:
    failed: Dict[str, str] = {}
    for message in messages:
        for call in get_tool_calls(message):
            cid = str(call.get("id", ""))
            name = tool_name(call)
            result = results.get(cid)
            if cid and name and result and not is_success(result["payload"]):
                failed[cid] = name
    return failed


def summarize_fixed_failure(message: Dict[str, Any], fixed_by: str) -> None:
    message["content"] = json.dumps({
        "status": "failed_then_fixed",
        "summary": "A previous read_file/write_file/edit_file call failed here and was fixed by a later call.",
        "fixed_by": fixed_by,
    }, ensure_ascii=False)


def process_event(cache: Dict[str, Any], message_index: int, call: Dict[str, Any], result_message: Optional[Dict[str, Any]], payload: Dict[str, Any]) -> None:
    name = tool_name(call)
    args = tool_args(call)
    path = normalize_path(args.get("path") or payload.get("path") or "")
    if name == TRACE_TOOL:
        operation = str(args.get("operation", "trace")).lower()
        state = _state(cache, path)
        state.enabled = operation == "trace"
        state.last_event_message_index = message_index
        state.events.append({"message_index": message_index, "tool": name, "type": operation, "path": path})
        if operation == "trace":
            state.pending_sources.append(f"trace_file msg {message_index} enabled tracing")
            state.needs_trace = True
        _put_state(cache, state)
        return
    if name not in MANAGED_TOOLS or not path:
        return
    state = _state(cache, path)
    if not is_success(payload):
        return
    if name == "read_file":
        if args.get("trace"):
            state.enabled = True
        if not state.enabled:
            _put_state(cache, state)
            return
        content = payload.get("content", "")
        default_start = int(payload.get("start_line") or payload.get("offset") or args.get("offset") or 1)
        rng = parse_numbered_lines(content, default_start=default_start)
        rng.source = "read_file"
        rng.source_message_index = message_index
        rng.version = state.current_version
        state.known_ranges = merge_ranges(state.known_ranges + [rng])
        state.last_event_message_index = message_index
        state.events.append({"message_index": message_index, "tool": name, "type": "read", "range": [rng.start, rng.end], "version_after": state.current_version})
        state.pending_sources.append(f"read_file msg {message_index} captured lines {rng.start}-{rng.end}")
        state.needs_trace = True
    elif name == "write_file":
        if not state.enabled:
            _put_state(cache, state)
            return
        content = payload.get("content", args.get("content", ""))
        rng = full_content_range(content)
        rng.source = "write_file"
        rng.source_message_index = message_index
        state.current_version += 1
        rng.version = state.current_version
        state.known_ranges = [rng]
        state.last_event_message_index = message_index
        state.events.append({"message_index": message_index, "tool": name, "type": "write", "range": [1, rng.end], "version_after": state.current_version})
        state.pending_sources.append(f"write_file msg {message_index} overwrote full file with {rng.end} known lines")
        state.pending_changes.append("write_file performed a full overwrite; previous known content is obsolete for the current version.")
        state.needs_trace = True
    elif name == "edit_file":
        if not state.enabled:
            _put_state(cache, state)
            return
        state.current_version += 1
        trace_update = bool(args.get("trace_update", True))
        applied = None
        if args.get("mode", "replace") == "replace":
            state.known_ranges, applied = apply_replace_to_ranges(state.known_ranges, str(args.get("old_string", "")), str(args.get("new_string", "")))
        event = {"message_index": message_index, "tool": name, "type": "edit", "version_after": state.current_version, "trace_update": trace_update}
        if applied:
            event.update({"affected_old_range": applied["old_range"], "affected_new_range": applied["new_range"], "line_delta": applied["line_delta"]})
            state.pending_sources.append(f"edit_file msg {message_index} replaced old lines {applied['old_range'][0]}-{applied['old_range'][1]} with new lines {applied['new_range'][0]}-{applied['new_range'][1]}")
            state.pending_changes.append(f"Applied edit_file at msg {message_index}; line delta: {applied['line_delta']}.")
        else:
            state.pending_sources.append(f"edit_file msg {message_index} succeeded; exact affected known range was not inferable from available known ranges")
            state.pending_changes.append(f"Applied edit_file at msg {message_index}; unknown regions may have changed.")
        state.events.append(event)
        state.last_event_message_index = message_index
        state.needs_trace = True
        if not trace_update:
            state.delta_only = True
    _put_state(cache, state)


def project_messages(messages: List[Dict[str, Any]], cache: Dict[str, Any], results: Dict[str, Dict[str, Any]], failed_calls: Dict[str, str], char_limit: int) -> List[Dict[str, Any]]:
    transformed: List[Dict[str, Any]] = []
    fixed_failures: Dict[str, str] = {}
    for message in messages:
        for call in get_tool_calls(message):
            name = tool_name(call)
            args = tool_args(call)
            fix = args.get("error_fix_id")
            if fix and failed_calls.get(str(fix)) == name:
                result = results.get(str(call.get("id", "")))
                if result and is_success(result["payload"]):
                    fixed_failures[str(fix)] = str(call.get("id", ""))
    for idx, message in enumerate(messages):
        msg = copy.deepcopy(message)
        for call in get_tool_calls(msg):
            name = tool_name(call)
            args = tool_args(call)
            path = normalize_path(args.get("path", ""))
            state_data = cache.get("files", {}).get(path)
            managed = bool(state_data and state_data.get("enabled"))
            if name == "write_file" and managed and "content" in args:
                args = {k: v for k, v in args.items() if k != "content"}
                args["content_omitted"] = True
                args["trace_managed"] = True
                set_tool_args(call, args)
            elif name == "edit_file" and managed:
                args = {k: v for k, v in args.items() if k not in {"old_string", "new_string", "patch"}}
                args["edit_arguments_omitted"] = True
                args["trace_managed"] = True
                set_tool_args(call, args)
            elif name == "read_file" and managed:
                args["trace_managed"] = True
                set_tool_args(call, args)
        if msg.get("role") == "tool":
            call_id = str(msg.get("tool_call_id") or "")
            if call_id in fixed_failures:
                summarize_fixed_failure(msg, fixed_failures[call_id])
            else:
                original_payload = parse_content(msg.get("content"))
                owner_call = None
                for m in messages:
                    for c in get_tool_calls(m):
                        if str(c.get("id", "")) == call_id:
                            owner_call = c
                            break
                    if owner_call:
                        break
                if owner_call:
                    name = tool_name(owner_call)
                    args = tool_args(owner_call)
                    path = normalize_path(args.get("path") or original_payload.get("path") or "")
                    state_data = cache.get("files", {}).get(path)
                    managed = bool(state_data and state_data.get("enabled"))
                    if managed and name == "read_file" and is_success(original_payload):
                        msg["content"] = json.dumps({"status": "ok", "trace_managed": True, "summary": f"Read {path}. Content incorporated into file_trace."}, ensure_ascii=False)
                    elif managed and name == "write_file" and is_success(original_payload):
                        msg["content"] = json.dumps({"status": "ok", "trace_managed": True, "summary": f"write_file overwrote {path}. Full written content incorporated into file_trace."}, ensure_ascii=False)
                    elif managed and name == "edit_file" and is_success(original_payload):
                        compact = {"status": "ok", "trace_managed": True, "summary": f"edit_file applied to {path}. Effect incorporated into file_trace."}
                        if "diff" in original_payload:
                            compact["diff"] = original_payload["diff"]
                        msg["content"] = json.dumps(compact, ensure_ascii=False)
        transformed.append(msg)
        for path, data in list(cache.get("files", {}).items()):
            state = FileState.from_dict(path, data)
            if state.enabled and state.needs_trace and state.last_event_message_index == idx:
                trace_msg = render_file_trace(state, idx, char_limit)
                transformed.append(trace_msg)
                _put_state(cache, state)
    return transformed


def transform_messages(messages: List[Dict[str, Any]], cache: Optional[Dict[str, Any]] = None, char_limit: int = DEFAULT_TRACE_CHAR_LIMIT) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    cache = copy.deepcopy(cache or {"session_id": "", "version": 1, "last_processed_message_index": -1, "files": {}})
    cache.setdefault("version", 1)
    cache.setdefault("files", {})
    results = collect_results(messages)
    for idx, message in enumerate(messages):
        for call in get_tool_calls(message):
            result = results.get(str(call.get("id", "")))
            payload = result["payload"] if result else {}
            process_event(cache, idx, call, result["message"] if result else None, payload)
    failed_calls = collect_failed_calls(messages, results)
    transformed = project_messages(messages, cache, results, failed_calls, char_limit)
    cache["last_processed_message_index"] = len(messages) - 1
    return transformed, cache


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", required=False)
    parser.add_argument("--trace-cache", required=True)
    parser.add_argument("--input-messages", required=True)
    parser.add_argument("--output-messages", required=True)
    parser.add_argument("--char-limit", type=int, default=DEFAULT_TRACE_CHAR_LIMIT)
    args = parser.parse_args(argv)
    cache = load_cache(args.trace_cache)
    messages = json.loads(Path(args.input_messages).read_text(encoding="utf-8"))
    transformed, cache = transform_messages(messages, cache, args.char_limit)
    Path(args.output_messages).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output_messages).write_text(json.dumps(transformed, ensure_ascii=False, indent=2), encoding="utf-8")
    save_cache(args.trace_cache, cache)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
