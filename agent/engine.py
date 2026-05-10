"""
Eos Agent — 核心引擎
Agent 循环：用户消息 → LLM → 工具调用 → 循环 → 最终响应
支持中断：用户可随时打断当前运行

LLM 调用统一通过 llm_service（全局 LLM 配置），引擎自身不管理 API Key/客户端。
"""

import json
import time
import logging
from typing import AsyncGenerator

from context import ContextManager
from context_manager import ContextManager as FileContextManager
from prompt_builder import build_system_prompt, clear_section_cache
from model_tools import get_tool_definitions, handle_function_call
from storage import get_storage

logger = logging.getLogger(__name__)


class CustomAgentEngine:
    def __init__(self, config: dict = None, llm_service=None):
        config = config or {}
        self.model = config.get("model", "")
        self.max_iterations = config.get("max_iterations", 50)
        self.llm_service = llm_service
        self.session_id = None  # 当前 session ID，由外部设置
        # 中断信号
        self._interrupted = False

        # 构建系统提示词（支持模块化架构）
        user_system_prompt = config.get("system_prompt", "")
        extra_context = config.get("extra_context", {})
        override_system_prompt = config.get("override_system_prompt")
        append_system_prompt = config.get("append_system_prompt")
        language = config.get("language", "中文")

        system_prompt = build_system_prompt(
            user_system_prompt=user_system_prompt,
            extra_context=extra_context,
            tools_schema=get_tool_definitions(),
            language=language,
            override_system_prompt=override_system_prompt,
            append_system_prompt=append_system_prompt,
        )

        # 初始化上下文管理器（传入构建好的 system_prompt）
        ctx_config = {**config, "system_prompt": system_prompt}
        self.context = ContextManager(ctx_config)
        self.file_context = FileContextManager()

    def interrupt(self):
        """请求中断当前运行"""
        self._interrupted = True

    def clear_interrupt(self):
        """清除中断状态（每轮开始时调用）"""
        self._interrupted = False

    def clear_cache(self):
        """清除系统提示词缓存（调用 /clear 或 /compact 时）"""
        clear_section_cache()

    async def _persist_message(self, role: str, content: str = None,
                               tool_call_id: str = None, tool_calls: list = None,
                               tool_name: str = None, reasoning_content: str = None):
        """持久化消息到数据库"""
        if not self.session_id:
            return
        try:
            await get_storage().add_message(
                self.session_id, role, content,
                tool_call_id, tool_calls, tool_name, reasoning_content
            )
        except Exception as e:
            logger.warning(f"Failed to persist message: {e}")

    async def run(self, user_message: str) -> AsyncGenerator[dict, None]:
        """主循环：处理用户消息，执行工具调用"""
        self.clear_interrupt()
        self.context.add_message("user", user_message)
        messages = self.context.build_messages(user_message)

        # 持久化用户消息
        await self._persist_message("user", user_message)

        # 获取工具定义
        tools_schema = get_tool_definitions()

        if not self.llm_service or not self.model:
            yield {
                "type": "text",
                "content": "Agent 引擎未配置。请在设置中选择模型。\n\n"
                           f"当前模型: {self.model or '未设置'}\n"
                           f"已注册工具: {len(tools_schema)} 个"
            }
            yield {"type": "done"}
            return

        for iteration in range(self.max_iterations):
            # ── 中断检查点 ──
            if self._interrupted:
                yield {"type": "interrupted"}
                return

            try:
                call_id = f"agent-{int(time.time()*1000)}-{iteration}"
                yield {"type": "thinking", "call_id": call_id, "model": self.model}

                # 处理消息（缩减参数、清理失败调用、注入通知）
                processed_messages = self.file_context.process_messages(messages)

                # 调用 LLM（流式传输，统一通过 llm_service.chat_stream）
                start_time = time.time()
                text_content = ""
                reasoning_content = ""
                raw_tool_calls = []
                tokens = 0

                async for event in self.llm_service.chat_stream(
                    messages=processed_messages, model=self.model, tools=tools_schema,
                ):
                    if event["type"] == "text":
                        text_content += event["content"]
                        yield {"type": "text", "content": event["content"]}
                    elif event["type"] == "thinking":
                        reasoning_content += event["content"]
                        yield {"type": "thinking", "content": event["content"]}
                    elif event["type"] == "tool_call":
                        raw_tool_calls.append(event)
                    elif event["type"] == "done":
                        tokens = event.get("usage", {}).get("total_tokens", 0)
                    elif event["type"] == "error":
                        yield {"type": "error", "message": event["message"]}
                        yield {"type": "done"}
                        return

                latency = round(time.time() - start_time, 2)

                # 处理工具调用
                if raw_tool_calls:
                    # 标准化工具调用格式
                    normalized_tool_calls = []
                    for tc in raw_tool_calls:
                        args = tc.get("arguments", {})
                        args_str = json.dumps(args, ensure_ascii=False) if isinstance(args, dict) else args
                        normalized_tool_calls.append({
                            "id": tc.get("id", ""),
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": args_str,
                            }
                        })

                    assistant_msg = {
                        "role": "assistant",
                        "content": text_content or None,
                        "tool_calls": normalized_tool_calls,
                    }
                    if reasoning_content:
                        assistant_msg["reasoning_content"] = reasoning_content

                    # 持久化 assistant 消息（含 tool_calls）
                    await self._persist_message(
                        "assistant",
                        content=text_content or None,
                        tool_calls=normalized_tool_calls,
                        reasoning_content=reasoning_content or None,
                    )

                    tool_result_msgs = []

                    for tc in normalized_tool_calls:
                        # ── 中断检查点（工具执行前） ──
                        if self._interrupted:
                            yield {"type": "interrupted"}
                            return

                        tool_name = tc["function"]["name"]
                        tool_args = tc["function"].get("arguments", {})
                        if isinstance(tool_args, str):
                            try:
                                tool_args = json.loads(tool_args)
                            except (json.JSONDecodeError, TypeError):
                                tool_args = {}
                        tc_id = tc.get("id", "")

                        yield {
                            "type": "tool_call",
                            "name": tool_name,
                            "arguments": tool_args,
                            "call_id": tc_id,
                            "model": self.model,
                            "latency": latency,
                        }

                        # 执行工具
                        try:
                            result_str = await handle_function_call(tool_name, tool_args)
                            yield {
                                "type": "tool_result",
                                "name": tool_name,
                                "result": result_str[:2000],
                            }
                            tool_result_msgs.append({
                                "role": "tool",
                                "tool_call_id": tc_id,
                                "content": result_str,
                            })
                            # 持久化工具结果
                            await self._persist_message(
                                "tool",
                                content=result_str,
                                tool_call_id=tc_id,
                                tool_name=tool_name,
                            )
                            # 记录成功的工具调用
                            self.file_context.record_tool_call(
                                tc_id, tool_name, tool_args, result_str, True
                            )
                        except Exception as e:
                            error_str = str(e)
                            yield {
                                "type": "tool_result",
                                "name": tool_name,
                                "error": error_str,
                            }
                            tool_result_msgs.append({
                                "role": "tool",
                                "tool_call_id": tc_id,
                                "content": f"错误: {error_str}",
                            })
                            # 持久化错误结果
                            await self._persist_message(
                                "tool",
                                content=f"错误: {error_str}",
                                tool_call_id=tc_id,
                                tool_name=tool_name,
                            )
                            # 记录失败的工具调用
                            self.file_context.record_tool_call(
                                tc_id, tool_name, tool_args, error_str, False
                            )

                    # 一次性添加 assistant 消息和所有工具结果
                    messages.append(assistant_msg)
                    messages.extend(tool_result_msgs)

                    # 继续循环，让 LLM 处理工具结果
                    continue

                else:
                    # 纯文本响应 = 最终答案
                    if text_content:
                        # 存储时保留 reasoning_content（DeepSeek 等模型需要回传）
                        ctx_msg = {"role": "assistant", "content": text_content}
                        if reasoning_content:
                            ctx_msg["reasoning_content"] = reasoning_content
                        self.context.messages.append(ctx_msg)

                        # 持久化最终响应
                        await self._persist_message(
                            "assistant",
                            content=text_content,
                            reasoning_content=reasoning_content or None,
                        )

                    yield {
                        "type": "done",
                        "tokens": tokens,
                        "call_id": call_id,
                    }
                    return

            except Exception as e:
                yield {"type": "error", "message": str(e)}
                yield {"type": "done"}
                return

        # 超过最大迭代次数
        yield {"type": "error", "message": f"超过最大迭代次数 ({self.max_iterations})"}
        yield {"type": "done"}
