"""
Eos Agent — 核心引擎
Agent 循环：用户消息 → LLM → 工具调用 → 循环 → 最终响应
支持中断：用户可随时打断当前运行

LLM 调用统一通过 llm_service（全局 LLM 配置），引擎自身不管理 API Key/客户端。
"""

import json
import time
from typing import AsyncGenerator

from context import ContextManager
from tools.registry import registry


class CustomAgentEngine:
    def __init__(self, config: dict = None, llm_service=None):
        config = config or {}
        self.model = config.get("model", "")
        self.max_iterations = config.get("max_iterations", 50)
        self.system_prompt = config.get("system_prompt", "你是 Eos Agent。")
        self.tools = registry
        self.context = ContextManager(config)
        self.llm_service = llm_service
        # 中断信号
        self._interrupted = False

    def interrupt(self):
        """请求中断当前运行"""
        self._interrupted = True

    def clear_interrupt(self):
        """清除中断状态（每轮开始时调用）"""
        self._interrupted = False

    async def run(self, user_message: str) -> AsyncGenerator[dict, None]:
        """主循环：处理用户消息，执行工具调用"""
        self.clear_interrupt()
        self.context.add_message("user", user_message)
        messages = self.context.build_messages(user_message)

        # 获取工具定义
        tools_schema = self.tools.list_tools()

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

                # 调用 LLM（统一通过 llm_service）
                start_time = time.time()
                response = await self.llm_service.chat(
                    messages=messages, model=self.model, tools=tools_schema,
                )
                latency = round(time.time() - start_time, 2)
                tokens = response.get("usage", {}).get("total_tokens", 0) if response else 0

                if not response:
                    yield {"type": "error", "message": "LLM 返回空响应"}
                    yield {"type": "done"}
                    return

                # 处理工具调用
                if response.get("tool_calls"):
                    # 输出思考文本
                    if response.get("content"):
                        yield {"type": "text", "content": response["content"]}

                    for tc in response["tool_calls"]:
                        # ── 中断检查点（工具执行前） ──
                        if self._interrupted:
                            yield {"type": "interrupted"}
                            return

                        tool_name = tc["name"]
                        tool_args = tc.get("arguments", {})
                        call_id = tc.get("id", "")

                        yield {
                            "type": "tool_call",
                            "name": tool_name,
                            "arguments": tool_args,
                            "call_id": call_id,
                            "model": self.model,
                            "latency": latency,
                        }

                        # 执行工具
                        try:
                            result = await self.tools.execute(tool_name, tool_args)
                            yield {
                                "type": "tool_result",
                                "name": tool_name,
                                "result": str(result)[:2000],
                            }

                            # 添加工具结果到消息
                            messages.append({
                                "role": "assistant",
                                "content": None,
                                "tool_calls": [{
                                    "id": call_id,
                                    "type": "function",
                                    "function": {"name": tool_name, "arguments": json.dumps(tool_args)}
                                }]
                            })
                            messages.append({
                                "role": "tool",
                                "tool_call_id": call_id,
                                "content": str(result)
                            })

                        except Exception as e:
                            yield {
                                "type": "tool_result",
                                "name": tool_name,
                                "error": str(e),
                            }
                            messages.append({
                                "role": "tool",
                                "tool_call_id": call_id,
                                "content": f"错误: {e}"
                            })

                    # 继续循环，让 LLM 处理工具结果
                    continue

                else:
                    # 纯文本响应 = 最终答案
                    content = response.get("content", "")
                    if content:
                        self.context.add_message("assistant", content)
                        yield {"type": "text", "content": content, "call_id": call_id, "model": self.model, "latency": latency, "tokens": tokens}

                    # 计算 token
                    usage = response.get("usage", {})
                    yield {
                        "type": "done",
                        "tokens": usage.get("total_tokens", 0),
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
