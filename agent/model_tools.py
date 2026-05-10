"""
Eos Agent — 工具编排层
统一处理：工具定义获取、执行、错误处理、结果大小限制
"""

import json
import logging
from typing import Optional

from tools.registry import registry
from toolsets import resolve_toolset

logger = logging.getLogger(__name__)

# 默认结果大小限制（字符数）
DEFAULT_MAX_RESULT_SIZE = 10000
# 终端工具特殊限制
TERMINAL_MAX_RESULT_SIZE = 5000


def get_tool_definitions(toolset: Optional[str] = None) -> list[dict]:
    """
    获取工具定义列表

    Args:
        toolset: 工具集名称，None 表示获取所有工具

    Returns:
        工具 schema 列表，供 LLM 使用
    """
    if toolset:
        return registry.list_tools_by_toolset(toolset)
    return registry.list_tools()


def _truncate_result(result: str, tool_name: str) -> str:
    """
    截断过大的工具结果

    Args:
        result: 原始结果
        tool_name: 工具名称（用于确定限制）

    Returns:
        截断后的结果
    """
    # 确定大小限制
    tool_entry = registry.get(tool_name)
    if tool_entry and "max_result_size_chars" in tool_entry:
        max_size = tool_entry["max_result_size_chars"]
    elif tool_name == "run_command":
        max_size = TERMINAL_MAX_RESULT_SIZE
    else:
        max_size = DEFAULT_MAX_RESULT_SIZE

    if len(result) <= max_size:
        return result

    truncated = result[:max_size]
    return f"{truncated}\n\n... [结果已截断，原始长度: {len(result)} 字符]"


async def handle_function_call(name: str, params: dict) -> str:
    """
    执行工具调用（统一入口）

    Args:
        name: 工具名称
        params: 工具参数

    Returns:
        工具执行结果（字符串）

    Raises:
        ValueError: 工具不存在
        Exception: 工具执行错误
    """
    # 检查工具是否存在
    tool = registry.get(name)
    if not tool:
        raise ValueError(f"工具 '{name}' 未注册")

    # 检查可用性（如果有 check_fn）
    check_fn = tool.get("check_fn")
    if check_fn:
        try:
            is_available = check_fn()
            if not is_available:
                raise ValueError(f"工具 '{name}' 当前不可用")
        except Exception as e:
            raise ValueError(f"工具 '{name}' 可用性检查失败: {e}")

    # 执行工具
    try:
        result = await registry.execute(name, params)
        result_str = str(result)

        # 截断过大的结果
        result_str = _truncate_result(result_str, name)

        return result_str

    except Exception as e:
        logger.error(f"工具执行错误 [{name}]: {e}")
        raise


def get_tool_info(tool_name: str) -> Optional[dict]:
    """
    获取单个工具的详细信息

    Args:
        tool_name: 工具名称

    Returns:
        工具信息字典，不存在返回 None
    """
    return registry.get(tool_name)


def list_available_tools(toolset: Optional[str] = None) -> list[dict]:
    """
    列出可用工具（包含元数据）

    Args:
        toolset: 工具集名称过滤

    Returns:
        工具信息列表
    """
    tools = registry.list_tools()
    if toolset:
        allowed = resolve_toolset(toolset)
        tools = [t for t in tools if t["name"] in allowed]
    return tools
