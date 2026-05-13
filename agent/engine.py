"""
Eos Agent — 核心引擎
Agent 循环：用户消息 → LLM → 工具调用 → 循环 → 最终响应
支持中断：用户可随时打断当前运行

LLM 调用统一通过 llm_service（全局 LLM 配置），引擎自身不管理 API Key/客户端。
"""

import json
import time
import logging
import sys
from pathlib import Path
from typing import AsyncGenerator

from context import ContextManager
from context_manager import ContextManager as FileContextManager
from prompt_builder import build_system_prompt, clear_section_cache, reload_prompts
from model_tools import get_tool_definitions, handle_function_call
from storage import get_storage
from skills.registry import skill_registry, Skill

# 添加 Eos-Context 目录到路径
eos_context_dir = Path(__file__).parent.parent / "Eos-Context"
sys.path.insert(0, str(eos_context_dir))
from eos_context_manager import FileContextManager as EosContextManager

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

        # Eos-Context 配置
        self.eos_context_enabled = config.get("eos_context_enabled", True)

        # 工具集配置
        self.toolset = config.get("toolset", None)  # None 表示加载所有工具

        # 保存构建参数（供 rebuild_system_prompt 复用）
        self._user_system_prompt = config.get("system_prompt", "")
        self._extra_context = config.get("extra_context", {})
        self._override_system_prompt = config.get("override_system_prompt")
        self._append_system_prompt = config.get("append_system_prompt")
        self._language = config.get("language", "中文")
        self.mode = config.get("mode", "assistant")

        # 构建系统提示词（支持模块化架构）
        system_prompt = build_system_prompt(
            user_system_prompt=self._user_system_prompt,
            extra_context=self._extra_context,
            tools_schema=get_tool_definitions(self.toolset),
            language=self._language,
            override_system_prompt=self._override_system_prompt,
            append_system_prompt=self._append_system_prompt,
            mode=self.mode,
        )

        # 初始化上下文管理器（传入构建好的 system_prompt）
        ctx_config = {**config, "system_prompt": system_prompt}
        self.context = ContextManager(ctx_config)
        self.file_context = FileContextManager()
        self.eos_context = EosContextManager()

    def interrupt(self):
        """请求中断当前运行"""
        self._interrupted = True

    def clear_interrupt(self):
        """清除中断状态（每轮开始时调用）"""
        self._interrupted = False

    def clear_cache(self):
        """清除系统提示词缓存（调用 /clear 或 /compact 时）"""
        clear_section_cache()

    def rebuild_system_prompt(self, mode: str = None):
        """重建系统提示词（模式切换时调用）"""
        if mode:
            self.mode = mode
        reload_prompts()
        clear_section_cache()
        system_prompt = build_system_prompt(
            user_system_prompt=self._user_system_prompt,
            extra_context=self._extra_context,
            tools_schema=get_tool_definitions(self.toolset),
            language=self._language,
            override_system_prompt=self._override_system_prompt,
            append_system_prompt=self._append_system_prompt,
            mode=self.mode,
        )
        self.context.system_prompt = system_prompt

    def _activate_skill(self, skill: Skill, args: str = ""):
        """激活 Skill：注入 Skill 提示词到 system prompt，设置 Skill 工具子集"""
        skill_prompt_section = skill.prompt
        if args:
            skill_prompt_section += f"\n\n## Current Request\n{args}"

        current_prompt = self.context.system_prompt
        self.context.system_prompt = (
            current_prompt
            + "\n\n"
            + f"## Active Skill: {skill.name}\n\n"
            + skill_prompt_section
        )

        if skill.tools:
            self._skill_tools = skill.tools
            self.toolset = None

    def get_effective_tool_definitions(self) -> list:
        """获取当前有效的工具定义（考虑 Skill 工具子集）"""
        if hasattr(self, '_skill_tools') and self._skill_tools:
            all_tools = get_tool_definitions(None)
            return [t for t in all_tools if t["name"] in self._skill_tools]
        return get_tool_definitions(self.toolset)

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

        # ── Skill 斜杠命令检测 ──
        skill_match = skill_registry.find_by_slash_command(user_message)
        if skill_match:
            skill, args = skill_match
            yield {"type": "skill_activated", "skill": skill.name, "args": args}
            self._activate_skill(skill, args)
            if skill.has_custom_execution():
                result = await skill.execute({"args": args, "message": user_message})
                if result:
                    yield {"type": "text", "content": result}
                    yield {"type": "done"}
                    return

        self.context.add_message("user", user_message)
        messages = self.context.build_messages(user_message)

        # 持久化用户消息
        await self._persist_message("user", user_message)

        # 获取工具定义（支持工具集过滤 + Skill 工具子集）
        tools_schema = self.get_effective_tool_definitions()

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
                if self.eos_context_enabled:
                    processed_messages = self.eos_context.process_messages(messages)
                else:
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
                            # 记录到 EosContextManager
                            if self.eos_context_enabled:
                                self.eos_context.record_tool_call(
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
                            # 记录到 EosContextManager
                            if self.eos_context_enabled:
                                self.eos_context.record_tool_call(
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
