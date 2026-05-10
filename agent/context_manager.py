"""
Eos Context Manager — Dynamic File State & Defragmentation

Core mechanisms:
  1. Cache-Aware State Notification: notify model of file changes at user prompt end
  2. Tombstoning & Lazy-Loading: replace stale read_file results when model re-reads
  3. Context Defragmentation: merge chunked reads of the same file
  4. Local Delta Injection: append current chunk at response end, clear on next call
  5. Forced Refresh on Modified files: trigger full refresh after file modification
  6. Tool call argument shrinking: omit write_file/patch content for successful calls
"""

import hashlib
import json
from typing import Any, Optional


class FileState:
    """Tracks the state of a single file across the conversation."""

    def __init__(self, path: str):
        self.path = path
        self.read_call_ids: list[str] = []  # All read_file call_ids for this file
        self.read_ranges: list[tuple[int, int]] = []  # (offset, limit) pairs
        self.read_contents: list[str] = []  # Content returned for each read
        self.content_hash: Optional[str] = None  # Hash of latest version
        self.modified_by_call_id: Optional[str] = None  # Last write/patch call_id
        self.merged_content: Optional[str] = None  # Current merged global view
        self.is_dirty: bool = False  # File modified since last read
        self.last_read_call_id: Optional[str] = None  # Most recent read call_id


class ContextManager:
    """
    Manages context for the Eos Agent.

    Tracks file states, handles tombstoning, defragmentation,
    and tool call argument shrinking.
    """

    def __init__(self):
        # path -> FileState
        self._files: dict[str, FileState] = {}
        # call_id -> {"tool": str, "args": dict, "result": str, "success": bool}
        self._tool_calls: dict[str, dict] = {}
        # call_id -> call_id (retry mapping)
        self._retry_map: dict[str, str] = {}
        # Pending state change notifications for next user message
        self._pending_notifications: list[str] = []
        # Previous delta injection call_ids to clear
        self._delta_call_ids: list[str] = []

    def _get_file(self, path: str) -> FileState:
        """Get or create FileState for a path."""
        if path not in self._files:
            self._files[path] = FileState(path)
        return self._files[path]

    def _hash_content(self, content: str) -> str:
        """Hash content for change detection."""
        return hashlib.md5(content.encode("utf-8", errors="replace")).hexdigest()[:12]

    # ── Tool call tracking ──────────────────────────────────────────────

    def record_tool_call(
        self,
        call_id: str,
        tool_name: str,
        tool_args: dict,
        result: str,
        success: bool,
    ):
        """Record a completed tool call."""
        self._tool_calls[call_id] = {
            "tool": tool_name,
            "args": tool_args,
            "result": result,
            "success": success,
        }

        if tool_name == "read_file" and success:
            path = tool_args.get("path", "")
            offset = tool_args.get("offset", 1)
            limit = tool_args.get("limit", 500)
            fs = self._get_file(path)
            fs.read_call_ids.append(call_id)
            fs.read_ranges.append((offset, limit))
            fs.read_contents.append(result)
            fs.last_read_call_id = call_id

        elif tool_name == "write_file" and success:
            path = tool_args.get("path", "")
            content = tool_args.get("content", "")
            fs = self._get_file(path)
            fs.content_hash = self._hash_content(content)
            fs.modified_by_call_id = call_id
            fs.is_dirty = True
            self._pending_notifications.append(
                f"文件已被 write_file 修改: {path}"
            )

        elif tool_name == "patch" and success:
            path = tool_args.get("path", "")
            fs = self._get_file(path)
            fs.modified_by_call_id = call_id
            fs.is_dirty = True
            self._pending_notifications.append(
                f"文件已被 patch 修改: {path}"
            )

    def record_retry(self, original_call_id: str, new_call_id: str):
        """Record that new_call_id is a retry of original_call_id."""
        self._retry_map[original_call_id] = new_call_id

    # ── Tool call argument shrinking ────────────────────────────────────

    def shrink_tool_call_args(
        self, tool_name: str, tool_args: dict, success: bool
    ) -> dict:
        """
        Shrink tool call arguments for successful calls.

        Failed calls are kept intact for retry. Successful calls have
        their content replaced with a size indicator.
        """
        if not success:
            return tool_args  # Keep failed calls intact

        if tool_name == "write_file":
            content = tool_args.get("content", "")
            if len(content) > 200:
                return {
                    **tool_args,
                    "content": f"[omitted: {len(content)} chars]",
                }
            return tool_args

        elif tool_name == "patch":
            mode = tool_args.get("mode", "replace")
            if mode == "replace":
                old_str = tool_args.get("old_string", "")
                new_str = tool_args.get("new_string", "")
                result = {**tool_args}
                if len(old_str) > 200:
                    result["old_string"] = f"[omitted: {len(old_str)} chars]"
                if len(new_str) > 200:
                    result["new_string"] = f"[omitted: {len(new_str)} chars]"
                return result
            elif mode == "patch":
                patch_content = tool_args.get("patch", "")
                if len(patch_content) > 200:
                    return {
                        **tool_args,
                        "patch": f"[omitted: {len(patch_content)} chars]",
                    }
                return tool_args

        return tool_args

    # ── Failed call cleanup ─────────────────────────────────────────────

    def get_failed_call_ids(self) -> set[str]:
        """Get call_ids of failed tool calls that were later retried successfully."""
        failed = set()
        for original_id, new_id in self._retry_map.items():
            if new_id in self._tool_calls and self._tool_calls[new_id]["success"]:
                failed.add(original_id)
        return failed

    # ── Tombstoning ─────────────────────────────────────────────────────

    def tombstone_stale_reads(self, path: str) -> list[str]:
        """
        When a file is re-read after modification, tombstone all previous
        read results for this file.

        Returns list of call_ids whose results were tombstoned.
        """
        fs = self._get_file(path)
        if not fs.is_dirty:
            return []

        tombstoned = []
        for call_id in fs.read_call_ids[:-1]:  # Skip the most recent read
            if call_id in self._tool_calls:
                self._tool_calls[call_id]["result"] = (
                    "[此文件内容已过期，新版文件请见下文]"
                )
                tombstoned.append(call_id)

        fs.is_dirty = False
        return tombstoned

    # ── Context defragmentation ─────────────────────────────────────────

    def defragment_read(self, path: str, current_call_id: str, current_content: str) -> str:
        """
        Merge chunked reads of the same file.

        When a new chunk is read:
        1. Replace previous read results with "[读取的文章片段已合并处理]"
        2. Generate merged global view in current response
        3. Append current chunk as local delta

        Returns the merged content to return to the model.
        """
        fs = self._get_file(path)
        if len(fs.read_call_ids) <= 1:
            return current_content  # First read, no merging needed

        # Get all previously read ranges and contents
        all_ranges = []
        for i, (call_id, (offset, limit)) in enumerate(
            zip(fs.read_call_ids[:-1], fs.read_ranges[:-1])
        ):
            all_ranges.append((offset, limit, fs.read_contents[i]))
            # Tombstone previous reads
            if call_id in self._tool_calls:
                self._tool_calls[call_id]["result"] = (
                    "[读取的文章片段已合并处理]"
                )

        # Add current read
        current_offset, current_limit = fs.read_ranges[-1]
        all_ranges.append((current_offset, current_limit, current_content))

        # Build merged view
        merged = self._build_merged_view(all_ranges)

        # Track current call_id for delta cleanup
        self._delta_call_ids.append(current_call_id)

        return merged

    def _build_merged_view(self, ranges: list[tuple[int, int, str]]) -> str:
        """
        Build a merged view from multiple read ranges.

        Gaps between ranges are marked with "... lines X-Y hidden: have not read ..."
        """
        if not ranges:
            return ""

        # Sort by offset
        sorted_ranges = sorted(ranges, key=lambda r: r[0])

        # Parse line numbers from content
        parsed = []
        for offset, limit, content in sorted_ranges:
            lines = content.split("\n")
            parsed.append((offset, offset + len(lines) - 1, lines))

        # Merge with gap markers
        result_lines = []
        prev_end = 0
        for start, end, lines in parsed:
            if start > prev_end + 1:
                result_lines.append(
                    f"... lines {prev_end + 1}-{start - 1} hidden: have not read ..."
                )
            result_lines.extend(lines)
            prev_end = end

        return "\n".join(result_lines)

    # ── Delta injection ─────────────────────────────────────────────────

    def get_delta_suffix(self, path: str, call_id: str, content: str) -> str:
        """
        Append current chunk as a local delta block.

        This is cleared on the next tool call or conversation turn.
        """
        return f"\n\n--- 当前读取内容 ({path}) ---\n{content}\n---"

    def clear_previous_deltas(self) -> list[str]:
        """Get call_ids of previous deltas to clear, then reset."""
        call_ids = self._delta_call_ids.copy()
        self._delta_call_ids.clear()
        return call_ids

    # ── Cache-aware state notification ──────────────────────────────────

    def get_pending_notifications(self) -> str:
        """
        Get pending file change notifications to append to user message.

        Returns formatted notification string, or empty string if none.
        """
        if not self._pending_notifications:
            return ""

        notification = "\n\n[文件状态变更通知]\n"
        for msg in self._pending_notifications:
            notification += f"- {msg}\n"
        notification += "历史中可能包含过期的文件内容，请根据需要重新读取。"

        self._pending_notifications.clear()
        return notification

    # ── Build final messages ────────────────────────────────────────────

    def process_messages(
        self, messages: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Process messages before sending to LLM:

        1. Remove failed calls that were retried
        2. Shrink successful write_file/patch arguments
        3. Apply tombstoned results
        4. Append file change notifications to last user message
        """
        failed_ids = self.get_failed_call_ids()
        result = []

        for msg in messages:
            # Skip failed tool calls and their results
            if msg.get("role") == "assistant" and msg.get("tool_calls"):
                filtered_calls = []
                for tc in msg["tool_calls"]:
                    tc_id = tc.get("id", "")
                    if tc_id in failed_ids:
                        continue
                    # Shrink successful call arguments
                    tool_name = tc.get("function", {}).get("name", "")
                    args_str = tc.get("function", {}).get("arguments", "{}")
                    try:
                        args = json.loads(args_str) if isinstance(args_str, str) else args_str
                    except (json.JSONDecodeError, TypeError):
                        args = {}

                    call_info = self._tool_calls.get(tc_id, {})
                    success = call_info.get("success", True)
                    shrunk_args = self.shrink_tool_call_args(tool_name, args, success)

                    tc_copy = {**tc}
                    tc_copy["function"] = {
                        **tc["function"],
                        "arguments": json.dumps(shrunk_args, ensure_ascii=False),
                    }
                    filtered_calls.append(tc_copy)

                if filtered_calls or not msg.get("content"):
                    result.append({**msg, "tool_calls": filtered_calls})
                else:
                    # Only content, no tool calls
                    result.append({"role": "assistant", "content": msg["content"]})
                continue

            # Skip tool results for failed calls
            if msg.get("role") == "tool":
                tc_id = msg.get("tool_call_id", "")
                if tc_id in failed_ids:
                    continue
                # Use tombstoned/defragmented result if available
                call_info = self._tool_calls.get(tc_id)
                if call_info and "result" in call_info:
                    result.append({**msg, "content": call_info["result"]})
                    continue

            result.append(msg)

        # Append file change notifications to last user message
        notification = self.get_pending_notifications()
        if notification and result:
            for i in range(len(result) - 1, -1, -1):
                if result[i].get("role") == "user":
                    content = result[i].get("content", "")
                    if isinstance(content, str):
                        result[i] = {**result[i], "content": content + notification}
                    break

        return result

    # ── System prompt rules ─────────────────────────────────────────────

    @staticmethod
    def get_system_prompt_rules() -> str:
        """
        Return system prompt rules for context management.

        These rules tell the model how to handle retries and file state.
        """
        return """
## Context Management Rules

1. **Failed tool calls**: If a tool call fails, you MUST reference the failed call's ID when retrying. Example: "Retrying call_001 with corrected arguments."
2. **File state awareness**: After a file is modified (via write_file or patch), you will receive a file change notification. If you need the updated content, call read_file again.
3. **Stale content**: Historical read_file results may be marked as outdated. Do not rely on outdated content — re-read the file if needed.
4. **Chunked reads**: When reading a file in chunks, previous chunks are merged automatically. The merged view includes gap markers for unread sections.
"""
