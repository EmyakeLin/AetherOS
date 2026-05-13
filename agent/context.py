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
        self.messages: list[dict] = []
        self.extra_context: dict = {}

        # Context management rules (injected into system prompt)
        self._context_rules = FileContextManager.get_system_prompt_rules()

    def build_messages(self, user_message) -> list[dict]:
        """构建发送给 LLM 的消息列表。user_message 可以是 str 或 list（多模态 content blocks）"""
        messages = []

        # System prompt (append context management rules)
        if self.system_prompt:
            full_system = self.system_prompt + "\n\n" + self._context_rules
            messages.append({"role": "system", "content": full_system})

        # Inject extra context
        if self.extra_context:
            ctx_parts = []
            for key, value in self.extra_context.items():
                ctx_parts.append(f"[{key}]\n{value}")
            if ctx_parts:
                ctx_text = "\n\n".join(ctx_parts)
                messages.append({"role": "system", "content": f"额外上下文:\n{ctx_text}"})

        # Apply strategy
        if self.strategy == "sliding_window":
            messages.extend(self._sliding_window())
        elif self.strategy == "summary":
            messages.extend(self._with_summary())
        else:
            messages.extend(self.messages)

        # Current user message (supports str or list for multimodal)
        messages.append({"role": "user", "content": user_message})

        return messages

    def _sliding_window(self) -> list[dict]:
        """滑动窗口：保留最近的消息，直到达到 token 限制"""
        # Simple approximation: 1 token ≈ 4 chars
        max_chars = self.max_tokens * 4 * self.compress_threshold
        result = []
        total_chars = 0

        for msg in reversed(self.messages):
            content = msg.get("content", "")
            # Handle multimodal content (list of blocks)
            if isinstance(content, list):
                msg_chars = sum(len(b.get("text", "")) for b in content if isinstance(b, dict))
            else:
                msg_chars = len(content)
            if total_chars + msg_chars > max_chars:
                break
            result.insert(0, msg)
            total_chars += msg_chars

        return result

    def _with_summary(self) -> list[dict]:
        """摘要压缩：保留首尾消息，中间用摘要替代"""
        if len(self.messages) <= 10:
            return self.messages

        # Keep first 2 and last 6 messages
        head = self.messages[:2]
        tail = self.messages[-6:]
        middle = self.messages[2:-6]

        # Create summary placeholder
        summary = f"[已压缩 {len(middle)} 条历史消息]"
        return head + [{"role": "system", "content": summary}] + tail

    def add_message(self, role: str, content):
        """添加消息。content 可以是 str 或 list（多模态 content blocks）"""
        self.messages.append({"role": role, "content": content})

    def compress(self):
        """手动触发上下文压缩"""
        if self.strategy == "sliding_window":
            self.messages = self._sliding_window()
        elif self.strategy == "summary":
            self.messages = self._with_summary()

    def inject_context(self, context: dict):
        """注入额外上下文（文件内容、终端输出等）"""
        self.extra_context.update(context)

    def clear_context(self, key: str = None):
        if key:
            self.extra_context.pop(key, None)
        else:
            self.extra_context.clear()

    def get_state(self) -> dict:
        """导出当前上下文状态（供前端监控显示）"""
        total_chars = 0
        for m in self.messages:
            content = m.get("content", "")
            if isinstance(content, list):
                total_chars += sum(len(b.get("text", "")) for b in content if isinstance(b, dict))
            else:
                total_chars += len(content)
        estimated_tokens = total_chars // 4
        return {
            "strategy": self.strategy,
            "message_count": len(self.messages),
            "estimated_tokens": estimated_tokens,
            "max_tokens": self.max_tokens,
            "extra_context_keys": list(self.extra_context.keys()),
        }
