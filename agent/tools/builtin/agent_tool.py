"""
Agent Tool — 子 Agent 启动器
让主 Agent 可以启动子 Agent 执行复杂任务
支持三种类型：explore（只读搜索）、plan（只读规划）、general_purpose（通用）
"""

import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# 提示词目录
PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"

# Agent 类型配置
_AGENT_PROFILES = {
    "explore": {
        "toolset": "agent-readonly",
        "prompt_file": "agent_explore.md",
        "description": "只读代码搜索",
    },
    "plan": {
        "toolset": "agent-readonly",
        "prompt_file": "agent_plan.md",
        "description": "只读架构规划",
    },
    "general_purpose": {
        "toolset": None,  # 全部工具
        "prompt_file": "agent_general.md",
        "description": "通用任务",
    },
}


def _load_prompt(prompt_file: str) -> str:
    """加载 Agent 系统提示词"""
    path = PROMPTS_DIR / prompt_file
    if not path.exists():
        logger.warning(f"Agent prompt not found: {path}")
        return ""
    return path.read_text(encoding="utf-8")


def _load_agent_config() -> dict:
    """加载 agent/config.yaml 配置"""
    config_path = Path(__file__).parent.parent.parent / "config.yaml"
    if not config_path.exists():
        return {}
    try:
        import yaml
        return yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    except Exception as e:
        logger.warning(f"Failed to load agent config: {e}")
        return {}


async def _agent_tool_handler(params: dict) -> str:
    """子 Agent 工具 handler"""
    prompt = params.get("prompt", "")
    agent_type = params.get("agent_type", "general_purpose")
    max_iterations = params.get("max_iterations", 20)
    model_override = params.get("model")

    if not prompt:
        return json.dumps({"error": "prompt 参数必填"}, ensure_ascii=False)

    profile = _AGENT_PROFILES.get(agent_type)
    if not profile:
        valid = ", ".join(_AGENT_PROFILES.keys())
        return json.dumps({"error": f"未知 agent_type: {agent_type}，可选: {valid}"}, ensure_ascii=False)

    # 加载系统提示词
    system_prompt = _load_prompt(profile["prompt_file"])

    # 构建引擎配置
    agent_config = _load_agent_config()
    if model_override:
        agent_config["model"] = model_override
    agent_config["override_system_prompt"] = system_prompt
    agent_config["toolset"] = profile["toolset"]
    agent_config["max_iterations"] = max_iterations

    # 导入引擎和服务（延迟导入避免循环依赖）
    from llm.service import LLMService
    from agent.engine import CustomAgentEngine

    llm = LLMService()
    engine = CustomAgentEngine(agent_config, llm_service=llm)

    # 收集事件
    tool_calls_log = []
    final_text_parts = []
    error_msg = None

    try:
        async for event in engine.run(prompt):
            event_type = event.get("type")
            if event_type == "text":
                final_text_parts.append(event.get("content", ""))
            elif event_type == "tool_call":
                tool_calls_log.append({
                    "name": event.get("name", ""),
                    "arguments": event.get("arguments", {}),
                })
            elif event_type == "error":
                error_msg = event.get("message", "Unknown error")
    except Exception as e:
        error_msg = str(e)

    if error_msg:
        return json.dumps({
            "agent_type": agent_type,
            "error": error_msg,
            "tool_calls": tool_calls_log,
            "iterations": len(tool_calls_log),
        }, ensure_ascii=False)

    final_text = "".join(final_text_parts).strip()
    if not final_text:
        final_text = "(子 Agent 未产生文本输出)"

    return json.dumps({
        "agent_type": agent_type,
        "result": final_text,
        "tool_calls": tool_calls_log,
        "iterations": len(tool_calls_log),
    }, ensure_ascii=False)


# ── 工具注册 ──

TOOL_SCHEMAS = [
    {
        "name": "agent_tool",
        "description": (
            "启动子 Agent 执行复杂任务。子 Agent 拥有独立的工具集和系统提示词。\n"
            "类型: explore（只读代码搜索）、plan（只读架构规划）、general_purpose（通用任务）\n"
            "适用场景: 需要深度代码探索、架构分析、或独立执行子任务时使用。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "子 Agent 的任务描述，应包含足够的上下文信息"
                },
                "agent_type": {
                    "type": "string",
                    "enum": ["explore", "plan", "general_purpose"],
                    "description": "Agent 类型: explore=只读搜索, plan=只读规划, general_purpose=通用（默认 general_purpose）",
                    "default": "general_purpose",
                },
                "max_iterations": {
                    "type": "integer",
                    "description": "最大迭代次数（默认 20）",
                    "default": 20,
                },
                "model": {
                    "type": "string",
                    "description": "覆盖子 Agent 使用的模型（可选，不填则继承当前模型）",
                },
            },
            "required": ["prompt"],
        },
        "handler": _agent_tool_handler,
        "toolset": "default",
    },
]
