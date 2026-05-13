"""
Eos Agent — 上下文管理器
支持滑动窗口、摘要压缩、分层注入等策略
"""

from typing import Optional
import sys
from pathlib import Path

# 添加 Eos-Context 目录到路径
eos_context_dir = Path(__file__).parent.parent / "Eos-Context"
sys.path.insert(0, str(eos_context_dir))
from eos_context_manager import FileContextManager


class ContextManager:
    def __init__(self, config: dict = None):
        config = config or {}
        ctx_config = config.get("context", {})
        self.strategy = ctx_config.get("strategy", "sliding_window")
        self.max_tokens = ctx_config.get("max_tokens", 128000)
        self.compress_threshold = ctx_config.get("compress_threshold", 0.8)
        self.system_prompt = config.get("system_prompt", "")
        self.extra_context: dict = {}

        # Context management rules (injected into system prompt)
        self._context_rules = FileContextManager.get_system_prompt_rules()

    def _sliding_window(self, messages: list[dict]) -> list[dict]:
        """滑动窗口：保留最近的消息，直到达到 token 限制

        注意：确保不会分开 assistant 消息和对应的 tool 消息
        """
        # Simple approximation: 1 token ≈ 4 chars
        max_chars = self.max_tokens * 4 * self.compress_threshold

        # 从后往前遍历，标记需要保留的消息
        keep = [False] * len(messages)
        total_chars = 0
        i = len(messages) - 1

        while i >= 0:
            msg = messages[i]
            content = msg.get("content", "")
            # Handle multimodal content (list of blocks)
            if isinstance(content, list):
                msg_chars = sum(len(b.get("text", "")) for b in content if isinstance(b, dict))
            else:
                msg_chars = len(content)

            # 检查是否超过限制
            if total_chars + msg_chars > max_chars:
                break

            # 如果是 tool 消息，需要确保对应的 assistant 消息也被保留
            if msg.get("role") == "tool":
                tool_call_id = msg.get("tool_call_id")
                if tool_call_id:
                    # 向前查找对应的 assistant 消息
                    j = i - 1
                    while j >= 0:
                        if messages[j].get("role") == "assistant":
                            tool_calls = messages[j].get("tool_calls", [])
                            for tc in tool_calls:
                                if tc.get("id") == tool_call_id:
                                    # 找到对应的 assistant 消息，需要一起保留
                                    # 计算 assistant 消息的大小
                                    assistant_content = messages[j].get("content", "")
                                    if isinstance(assistant_content, list):
                                        assistant_chars = sum(len(b.get("text", "")) for b in assistant_content if isinstance(b, dict))
                                    else:
                                        assistant_chars = len(assistant_content)
                                    # 检查是否超过限制
                                    if total_chars + msg_chars + assistant_chars > max_chars:
                                        # 超过限制，不保留这个 tool 消息
                                        break
                                    # 标记 assistant 消息需要保留
                                    if not keep[j]:
                                        keep[j] = True
                                        total_chars += assistant_chars
                                    break
                            break
                        j -= 1

            # 标记当前消息需要保留
            keep[i] = True
            total_chars += msg_chars
            i -= 1

        # 按原始顺序返回需要保留的消息
        return [msg for i, msg in enumerate(messages) if keep[i]]

    def _with_summary(self, messages: list[dict]) -> list[dict]:
        """摘要压缩：保留首尾消息，中间用摘要替代"""
        if len(messages) <= 10:
            return messages

        # Keep first 2 and last 6 messages
        head = messages[:2]
        tail = messages[-6:]
        middle = messages[2:-6]

        # Create summary placeholder
        summary = f"[已压缩 {len(middle)} 条历史消息]"
        return head + [{"role": "system", "content": summary}] + tail

    def compress(self, messages: list[dict]) -> list[dict]:
        """手动触发上下文压缩"""
        if self.strategy == "none":
            return messages
        elif self.strategy == "sliding_window":
            return self._sliding_window(messages)
        elif self.strategy == "summary":
            return self._with_summary(messages)
        return messages

    def inject_context(self, context: dict):
        """注入额外上下文（文件内容、终端输出等）"""
        self.extra_context.update(context)

    def clear_context(self, key: str = None):
        if key:
            self.extra_context.pop(key, None)
        else:
            self.extra_context.clear()
