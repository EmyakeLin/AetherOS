"""
Eos Agent — 通用上下文管理器
支持管道式处理，多个管理器依次运行
"""

import json
import copy
from typing import Dict, List, Any, Optional, Protocol
from abc import ABC, abstractmethod
from pathlib import Path


class ContextProcessor(ABC):
    """上下文处理器基类"""

    @property
    @abstractmethod
    def name(self) -> str:
        """处理器名称"""
        pass

    @property
    def enabled(self) -> bool:
        """是否启用"""
        return True

    @abstractmethod
    def process_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """处理消息列表"""
        pass


def estimate_tokens(text: str) -> int:
    """估算文本的 token 数量（简化计算：1 token ≈ 4 字符）"""
    return len(text) // 4


def estimate_message_tokens(msg: Dict[str, Any]) -> int:
    """估算单条消息的 token 数量"""
    tokens = 10  # 角色和基本结构
    content = msg.get("content", "")
    if isinstance(content, str):
        tokens += estimate_tokens(content)
    tool_calls = msg.get("tool_calls", [])
    for tc in tool_calls:
        func = tc.get("function", {})
        tokens += estimate_tokens(func.get("name", ""))
        tokens += estimate_tokens(func.get("arguments", "{}"))
    for key in ["reasoning_content", "tool_call_id", "tool_name"]:
        val = msg.get(key)
        if isinstance(val, str):
            tokens += estimate_tokens(val)
    return tokens


class EosContextProcessor(ContextProcessor):
    """Eos 文件上下文管理器"""

    def __init__(self, enabled: bool = True):
        self._enabled = enabled
        self._tool_calls: Dict[str, Dict[str, Any]] = {}

    @property
    def name(self) -> str:
        return "eos_context"

    @property
    def enabled(self) -> bool:
        return self._enabled

    def set_enabled(self, enabled: bool):
        self._enabled = enabled

    def reset(self):
        """重置内部状态"""
        self._tool_calls.clear()

    def process_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """处理 messages，优化文件操作上下文"""
        if not self._enabled:
            return messages

        transformed = copy.deepcopy(messages)
        file_states = {}
        expired_results = {}
        expired_or_merged_ids = set()

        # 计算每条消息的 token 累积位置
        message_tokens = []
        cumulative_tokens = 0
        for msg in transformed:
            tokens = estimate_message_tokens(msg)
            message_tokens.append(cumulative_tokens)
            cumulative_tokens += tokens

        # 第一遍：收集信息
        for i, msg in enumerate(transformed):
            if msg.get("role") != "assistant":
                continue

            tool_calls = msg.get("tool_calls", [])
            for tc in tool_calls:
                func = tc.get("function", {})
                tool_name = func.get("name", "")
                tool_call_id = tc.get("id", "")

                if tool_name not in ["eos_read_file", "eos_write_file", "eos_edit_file"]:
                    continue

                try:
                    args = json.loads(func.get("arguments", "{}"))
                except Exception:
                    args = {}

                path = args.get("path", "")
                if not path:
                    continue

                # 查找对应的 tool result
                result_idx = None
                result_content = None
                for j in range(i + 1, len(transformed)):
                    if transformed[j].get("role") == "tool" and transformed[j].get("tool_call_id") == tool_call_id:
                        result_idx = j
                        result_content = transformed[j].get("content", "")
                        break

                if result_idx is None:
                    continue

                # 检查是否失败（JSON 解析 + 错误前缀检测）
                is_success = True
                try:
                    result_json = json.loads(result_content)
                    is_success = result_json.get("status") == "ok"
                except Exception:
                    # 非 JSON 响应：检查是否为错误消息
                    if result_content.startswith("错误") or result_content.startswith("Error"):
                        is_success = False

                # 处理 error_fix_id
                error_fix_id = args.get("error_fix_id")
                if error_fix_id:
                    for k, msg2 in enumerate(transformed):
                        if msg2.get("role") == "tool" and msg2.get("tool_call_id") == error_fix_id:
                            for l in range(k - 1, -1, -1):
                                if transformed[l].get("role") == "assistant":
                                    for tc2 in transformed[l].get("tool_calls", []):
                                        if tc2.get("id") == error_fix_id:
                                            if tc2.get("function", {}).get("name") == tool_name:
                                                expired_results[error_fix_id] = "我在这里失败过，并已被后续调用修正"
                                                expired_or_merged_ids.add(error_fix_id)
                                            break
                                    break

                if not is_success:
                    continue

                # 初始化文件状态
                if path not in file_states:
                    file_states[path] = {
                        "version": 0,
                        "last_write_index": -1,
                        "last_write_msg_index": -1,
                        "last_edit_index": -1,
                        "last_edit_msg_index": -1,
                        "read_segments": []
                    }

                state = file_states[path]

                # 处理 eos_write_file
                if tool_name == "eos_write_file":
                    func["arguments"] = json.dumps({
                        "path": path,
                        "content_omitted": True
                    })

                    for k, msg2 in enumerate(transformed):
                        if msg2.get("role") == "tool":
                            tc_id = msg2.get("tool_call_id", "")
                            if tc_id == tool_call_id:
                                continue
                            for l in range(k - 1, -1, -1):
                                if transformed[l].get("role") == "assistant":
                                    for tc2 in transformed[l].get("tool_calls", []):
                                        if tc2.get("id") == tc_id:
                                            try:
                                                args2 = json.loads(tc2.get("function", {}).get("arguments", "{}"))
                                            except Exception:
                                                args2 = {}
                                            if args2.get("path") == path and tc2.get("function", {}).get("name") in ["eos_read_file", "eos_write_file", "eos_edit_file"]:
                                                expired_results[tc_id] = "文件内容已过期，请关注最新的文件内容"
                                                expired_or_merged_ids.add(tc_id)
                                            break
                                    break

                    state["version"] += 1
                    state["last_write_index"] = result_idx
                    state["last_write_msg_index"] = i
                    state["read_segments"] = []

                # 处理 eos_edit_file
                elif tool_name == "eos_edit_file":
                    new_args = {
                        "path": path,
                        "old_string_omitted": True,
                        "new_string_omitted": True
                    }
                    if "mode" in args:
                        new_args["mode"] = args["mode"]
                    if "replace_all" in args:
                        new_args["replace_all"] = args["replace_all"]
                    func["arguments"] = json.dumps(new_args)

                    state["version"] += 1
                    state["last_edit_index"] = result_idx
                    state["last_edit_msg_index"] = i

                # 处理 eos_read_file
                elif tool_name == "eos_read_file":
                    # 只过期在 write/edit 之前发生的 read
                    for seg in state["read_segments"]:
                        if seg["tool_call_id"] not in expired_or_merged_ids:
                            if seg["msg_index"] < state.get("last_write_msg_index", -1) or \
                               seg["msg_index"] < state.get("last_edit_msg_index", -1):
                                expired_results[seg["tool_call_id"]] = "文件内容已过期，请关注最新的文件内容"
                                expired_or_merged_ids.add(seg["tool_call_id"])

                    valid_segments = [
                        seg for seg in state["read_segments"]
                        if seg["tool_call_id"] not in expired_or_merged_ids
                    ]

                    current_token_pos = message_tokens[result_idx] if result_idx < len(message_tokens) else cumulative_tokens

                    can_merge = False
                    if valid_segments:
                        oldest_token_pos = valid_segments[0]["token_pos"]
                        span_tokens = current_token_pos - oldest_token_pos
                        read_count = len(valid_segments) + 1
                        merge_threshold = read_count * 300 + 200

                        if span_tokens < merge_threshold:
                            for seg in valid_segments:
                                gap_tokens = abs(current_token_pos - seg["token_pos"])
                                if gap_tokens < 500:
                                    can_merge = True
                                    break

                    if can_merge:
                        for seg in valid_segments:
                            expired_results[seg["tool_call_id"]] = "已合并到后续 eos_read_file 输出"
                            expired_or_merged_ids.add(seg["tool_call_id"])

                    state["read_segments"].append({
                        "token_pos": current_token_pos,
                        "tool_call_id": tool_call_id,
                        "result_idx": result_idx,
                        "msg_index": i,
                    })

        # 第二遍：应用过期标记
        for i, msg in enumerate(transformed):
            if msg.get("role") == "tool":
                tc_id = msg.get("tool_call_id", "")
                if tc_id in expired_results:
                    msg["content"] = json.dumps({
                        "status": "ok",
                        "summary": expired_results[tc_id]
                    }, ensure_ascii=False)

        return transformed


# Model context limit inference patterns (order matters: first match wins)
_CONTEXT_PATTERNS = [
    # Claude
    (r"claude.*opus.4", 200000),
    (r"claude.*sonnet.4", 200000),
    (r"claude.*3\.5.*sonnet", 200000),
    (r"claude.*3.*opus", 200000),
    (r"claude.*3.*sonnet", 200000),
    (r"claude.*3.*haiku", 200000),
    (r"claude", 200000),
    # DeepSeek
    (r"deepseek.*reasoner", 64000),
    (r"deepseek.*coder", 64000),
    (r"deepseek", 1000000),
    # GPT
    (r"gpt-4o", 128000),
    (r"gpt-4-turbo", 128000),
    (r"gpt-4", 8192),
    (r"gpt-3\.5", 16385),
    # Gemini
    (r"gemini.*pro", 1048576),
    (r"gemini.*flash", 1048576),
    (r"gemini", 1048576),
    # Qwen
    (r"qwen.*max", 131072),
    (r"qwen.*plus", 131072),
    (r"qwen", 131072),
    # Kimi / Moonshot
    (r"kimi", 131072),
    (r"moonshot", 131072),
    # GLM
    (r"glm", 131072),
    # Llama
    (r"llama.*3", 131072),
    (r"llama", 8192),
    # Mixtral
    (r"mixtral", 32768),
]

import re as _re


def get_context_limit(model: str) -> int:
    """Infer context limit from model name. Returns token count."""
    if not model:
        return 200000
    model_lower = model.lower()
    for pattern, limit in _CONTEXT_PATTERNS:
        if _re.search(pattern, model_lower):
            return limit
    return 200000


class ContextManager:
    """通用上下文管理器，支持管道式处理"""

    def __init__(self, config: dict = None):
        config = config or {}
        self._processors: List[ContextProcessor] = []
        self._processor_map: Dict[str, ContextProcessor] = {}

        # 注册默认的 EosContextProcessor
        eos_enabled = config.get("eos_context_enabled", True)
        self._eos_processor = EosContextProcessor(enabled=eos_enabled)
        self.register(self._eos_processor)

    def register(self, processor: ContextProcessor):
        """注册处理器"""
        if processor.name in self._processor_map:
            raise ValueError(f"Processor '{processor.name}' already registered")
        self._processors.append(processor)
        self._processor_map[processor.name] = processor

    def unregister(self, name: str):
        """注销处理器"""
        if name not in self._processor_map:
            raise ValueError(f"Processor '{name}' not found")
        processor = self._processor_map.pop(name)
        self._processors.remove(processor)

    def get_processor(self, name: str) -> Optional[ContextProcessor]:
        """获取处理器"""
        return self._processor_map.get(name)

    def enable(self, name: str):
        """启用处理器"""
        processor = self.get_processor(name)
        if processor and hasattr(processor, 'set_enabled'):
            processor.set_enabled(True)

    def disable(self, name: str):
        """禁用处理器"""
        processor = self.get_processor(name)
        if processor and hasattr(processor, 'set_enabled'):
            processor.set_enabled(False)

    def process_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """依次运行所有启用的处理器"""
        result = messages
        for processor in self._processors:
            if processor.enabled:
                result = processor.process_messages(result)
        return result

    def get_system_prompt_rules(self) -> str:
        """获取系统提示规则"""
        rules = []
        for processor in self._processors:
            if processor.enabled and hasattr(processor, 'get_system_prompt_rules'):
                rules.append(processor.get_system_prompt_rules())
        return "\n".join(rules)

    def reset(self, name: str = None):
        """重置处理器状态"""
        if name:
            processor = self.get_processor(name)
            if processor and hasattr(processor, 'reset'):
                processor.reset()
        else:
            for processor in self._processors:
                if hasattr(processor, 'reset'):
                    processor.reset()

    @property
    def eos_context_enabled(self) -> bool:
        return self._eos_processor.enabled

    @eos_context_enabled.setter
    def eos_context_enabled(self, value: bool):
        self._eos_processor.set_enabled(value)

    # ── Token 统计（从 eos-agent 移植） ──

    def update_token_usage(self, input_tokens: int, output_tokens: int):
        """Update cumulative token stats after each LLM call."""
        if not hasattr(self, '_total_input_tokens'):
            self._total_input_tokens = 0
            self._total_output_tokens = 0
        self._total_input_tokens += input_tokens
        self._total_output_tokens += output_tokens

    def get_token_stats(self) -> dict:
        """Return token stats for frontend display."""
        if not hasattr(self, '_total_input_tokens'):
            self._total_input_tokens = 0
            self._total_output_tokens = 0
        return {
            "total_input_tokens": self._total_input_tokens,
            "total_output_tokens": self._total_output_tokens,
            "total_tokens": self._total_input_tokens + self._total_output_tokens,
        }

    def estimate_current_context_tokens(self, messages: list) -> int:
        """Estimate total tokens in current context."""
        total = estimate_tokens(self.system_prompt)
        for msg in messages:
            total += estimate_message_tokens(msg)
        return total

    @staticmethod
    def get_system_prompt_rules_static() -> str:
        """静态方法：获取系统提示规则（不需要实例化）"""
        rules = []
        # EosContextProcessor 的规则
        rules.append("""
## Context Management Rules

1. **Failed tool calls**: If a tool call fails, you MUST reference the failed call's ID when retrying. Example: "Retrying call_001 with corrected arguments."
2. **File state awareness**: After a file is modified (via eos_write_file or eos_edit_file), you will receive a file change notification. If you need the updated content, call eos_read_file again.
3. **Stale content**: Historical eos_read_file results may be marked as outdated. Do not rely on outdated content — re-read the file if needed.
4. **Chunked reads**: When reading a file in chunks, previous chunks are merged automatically. The merged view includes gap markers for unread sections.
""")
        return "\n".join(rules)
