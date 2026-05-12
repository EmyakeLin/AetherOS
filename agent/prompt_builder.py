"""
Eos Agent — 系统提示词组装（模块化架构）

设计借鉴 Claude Code 的系统提示词架构：
- 模块化分段：每个功能段落独立配置
- 静态/动态分离：静态段落可缓存，动态段落每轮重新计算
- 优先级链：override > agent > custom > default
- 配置文件化：所有提示词内容从 prompts.json 加载

缓存策略：
- system_prompt_section(): 计算一次后缓存，直到手动清除
- uncached_system_prompt_section(): 每轮重新计算，用于会话特定内容
"""

import os
import re
import json
import logging
from pathlib import Path
from typing import Optional, Callable, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# prompts.json 路径
PROMPTS_FILE = Path(__file__).parent / "prompts.json"


# =========================================================================
# 提示词配置加载
# =========================================================================

def _load_prompts() -> dict:
    """从 prompts.json 加载提示词配置"""
    try:
        with open(PROMPTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning(f"prompts.json not found at {PROMPTS_FILE}, using defaults")
        return {}
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse prompts.json: {e}, using defaults")
        return {}


# 全局缓存提示词配置
_prompts_config: dict = None


def get_prompts_config() -> dict:
    """获取提示词配置（懒加载）"""
    global _prompts_config
    if _prompts_config is None:
        _prompts_config = _load_prompts()
    return _prompts_config


def reload_prompts():
    """重新加载提示词配置（修改 prompts.json 后调用）"""
    global _prompts_config
    _prompts_config = _load_prompts()
    clear_section_cache()


# =========================================================================
# 安全扫描 — 检测 prompt injection
# =========================================================================

_THREAT_PATTERNS = [
    (r'ignore\s+(previous|all|above|prior)\s+instructions', "prompt_injection"),
    (r'do\s+not\s+tell\s+the\s+user', "deception_hide"),
    (r'system\s+prompt\s+override', "sys_prompt_override"),
    (r'disregard\s+(your|all|any)\s+(instructions|rules|guidelines)', "disregard_rules"),
    (r'act\s+as\s+(if|though)\s+you\s+(have\s+no|don\'t\s+have)\s+(restrictions|limits|rules)', "bypass_restrictions"),
    (r'<!--[^>]*(?:ignore|override|system|secret|hidden)[^>]*-->', "html_comment_injection"),
    (r'<\s*div\s+style\s*=\s*["\'][\s\S]*?display\s*:\s*none', "hidden_div"),
    (r'translate\s+.*\s+into\s+.*\s+and\s+(execute|run|eval)', "translate_execute"),
    (r'curl\s+[^\n]*\$\{?\w*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)', "exfil_curl"),
    (r'cat\s+[^\n]*(\.env|credentials|\.netrc|\.pgpass)', "read_secrets"),
]

_INVISIBLE_CHARS = {
    '​', '‌', '‍', '⁠', '﻿',
    '‪', '‫', '‬', '‭', '‮',
}


def _scan_context_content(content: str, filename: str) -> str:
    """扫描上下文文件内容，检测 prompt injection。返回安全内容或警告。"""
    findings = []

    for char in _INVISIBLE_CHARS:
        if char in content:
            findings.append(f"invisible unicode U+{ord(char):04X}")

    for pattern, pid in _THREAT_PATTERNS:
        if re.search(pattern, content, re.IGNORECASE):
            findings.append(pid)

    if findings:
        return f"[BLOCKED: {filename} 检测到潜在 prompt injection ({', '.join(findings)})。内容未加载。]"

    return content


# =========================================================================
# Section 系统 — 模块化提示词段落
# =========================================================================

@dataclass
class SystemPromptSection:
    """系统提示词段落"""
    name: str
    compute: Callable[[], Optional[str]]
    cache_break: bool = False  # True = 每轮重新计算


# 段落缓存
_section_cache: dict[str, Optional[str]] = {}


def system_prompt_section(name: str, compute: Callable[[], Optional[str]]) -> SystemPromptSection:
    """创建缓存段落：计算一次后缓存，直到手动清除"""
    return SystemPromptSection(name=name, compute=compute, cache_break=False)


def uncached_system_prompt_section(
    name: str,
    compute: Callable[[], Optional[str]],
    reason: str = "",
) -> SystemPromptSection:
    """创建动态段落：每轮重新计算，会破坏缓存"""
    return SystemPromptSection(name=name, compute=compute, cache_break=True)


def resolve_sections(sections: list[SystemPromptSection]) -> list[str]:
    """解析所有段落，返回非空的提示词字符串列表"""
    global _section_cache
    results = []

    for section in sections:
        if not section.cache_break and section.name in _section_cache:
            cached = _section_cache[section.name]
            if cached is not None:
                results.append(cached)
            continue

        value = section.compute()
        _section_cache[section.name] = value
        if value is not None:
            results.append(value)

    return results


def clear_section_cache():
    """清除所有段落缓存（调用 /clear 或 /compact 时）"""
    global _section_cache
    _section_cache.clear()


# =========================================================================
# 核心段落函数 — 从 prompts.json 加载
# =========================================================================

def _get_config_value(key: str, fallback: str = "") -> str:
    """从 prompts.json 获取配置值"""
    config = get_prompts_config()
    return config.get(key, fallback)


def _get_identity_section() -> str:
    """身份声明"""
    return _get_config_value("identity", "You are Eos Agent, an intelligent AI assistant.")


def _get_platform_section() -> str:
    """平台信息"""
    return _get_config_value("platform", "# Platform\nYou run in AetherOS.")


def _get_system_rules_section() -> str:
    """系统规则"""
    return _get_config_value("system_rules", "# System\n - Follow standard guidelines.")


def _get_doing_tasks_section() -> str:
    """任务执行指南"""
    return _get_config_value("doing_tasks", "# Doing tasks\n - Complete tasks efficiently.")


def _get_actions_section() -> str:
    """操作谨慎性指南"""
    return _get_config_value("actions", "# Executing actions with care\nBe careful with destructive operations.")


def _get_tool_usage_section(tools_schema: list = None) -> str:
    """工具使用指南"""
    return _get_config_value("tool_usage", "# Using your tools\n - Use tools to complete tasks.")


def _get_tone_style_section() -> str:
    """语气风格"""
    return _get_config_value("tone_style", "# Tone and style\n - Be concise.")


def _get_output_efficiency_section() -> str:
    """输出效率"""
    return _get_config_value("output_efficiency", "# Output efficiency\nGo straight to the point.")


def _get_eos_tools_section() -> Optional[str]:
    """Eos-Tools 文件管理工具集提示词"""
    eos_tools_prompt_file = Path(__file__).parent / "eos_tools_prompt.md"
    if not eos_tools_prompt_file.exists():
        return None
    try:
        content = eos_tools_prompt_file.read_text(encoding="utf-8")
        return _scan_context_content(content, "eos_tools_prompt.md")
    except Exception as e:
        logger.warning(f"Failed to load eos_tools_prompt.md: {e}")
        return None


# =========================================================================
# 动态段落函数 — 每轮变化的内容
# =========================================================================

def _get_env_info_section(
    cwd: str = None,
    is_git: bool = False,
    platform: str = None,
    model: str = None,
) -> str:
    """环境信息（动态）"""
    template = _get_config_value("env_info_template", "# Environment\nWorking directory: {cwd}")
    return template.format(
        cwd=cwd or os.getcwd(),
        is_git="Yes" if is_git else "No",
        platform=platform or "unknown",
        model=model or "unknown",
    )


def _get_context_section(extra_context: dict = None) -> Optional[str]:
    """上下文注入（动态）"""
    if not extra_context:
        return None

    ctx_parts = []
    for key, value in extra_context.items():
        if isinstance(value, str):
            scanned = _scan_context_content(value, key)
            ctx_parts.append(f"[{key}]\n{scanned}")
        else:
            ctx_parts.append(f"[{key}]\n{value}")

    if not ctx_parts:
        return None

    return "# System Context\n\n" + "\n\n".join(ctx_parts)


def _get_language_section(language: str = "中文") -> str:
    """语言偏好"""
    template = _get_config_value("language_template", "# Language\nAlways respond in {language}.")
    return template.format(language=language)


def _get_user_custom_section(user_system_prompt: str = None) -> Optional[str]:
    """用户自定义提示词"""
    if not user_system_prompt:
        return None
    return user_system_prompt


# =========================================================================
# 主入口：构建系统提示词
# =========================================================================

def build_system_prompt(
    identity: str = None,
    user_system_prompt: str = None,
    extra_context: dict = None,
    tools_schema: list = None,
    cwd: str = None,
    is_git: bool = False,
    platform: str = None,
    model: str = None,
    language: str = "中文",
    override_system_prompt: str = None,
    append_system_prompt: str = None,
) -> str:
    """组装完整的系统提示词。

    优先级链（从高到低）：
    1. override_system_prompt — 完全覆盖（如 loop 模式）
    2. agent_system_prompt — 自定义 Agent 定义
    3. custom_system_prompt — 用户配置的 system_prompt
    4. default_system_prompt — 默认 Eos Agent 提示词

    参数:
        identity: Agent 身份字符串（默认使用内置身份）
        user_system_prompt: 用户自定义 system prompt
        extra_context: 额外上下文（如当前目录、打开的文件等）
        tools_schema: 工具定义列表
        cwd: 当前工作目录
        is_git: 是否是 git 仓库
        platform: 运行平台
        model: 使用的模型
        language: 语言偏好
        override_system_prompt: 完全覆盖的系统提示词
        append_system_prompt: 始终追加在末尾的提示词
    """
    # 优先级 1: 完全覆盖
    if override_system_prompt:
        return override_system_prompt

    # 构建默认段落列表
    sections = []

    # 静态段落（可缓存）
    sections.append(system_prompt_section("identity", _get_identity_section))
    sections.append(system_prompt_section("platform", _get_platform_section))
    sections.append(system_prompt_section("system_rules", _get_system_rules_section))
    sections.append(system_prompt_section("doing_tasks", _get_doing_tasks_section))
    sections.append(system_prompt_section("actions", _get_actions_section))
    sections.append(system_prompt_section("tool_usage", lambda: _get_tool_usage_section(tools_schema)))
    sections.append(system_prompt_section("tone_style", _get_tone_style_section))
    sections.append(system_prompt_section("output_efficiency", _get_output_efficiency_section))
    sections.append(system_prompt_section("eos_tools", _get_eos_tools_section))

    # 动态段落（每轮重新计算）
    sections.append(uncached_system_prompt_section(
        "env_info",
        lambda: _get_env_info_section(cwd, is_git, platform, model),
        "Environment info changes between sessions",
    ))
    sections.append(uncached_system_prompt_section(
        "language",
        lambda: _get_language_section(language),
        "Language preference is session-specific",
    ))
    sections.append(uncached_system_prompt_section(
        "context",
        lambda: _get_context_section(extra_context),
        "Extra context changes between turns",
    ))

    # 用户自定义提示词
    if user_system_prompt:
        sections.append(uncached_system_prompt_section(
            "user_custom",
            lambda: _get_user_custom_section(user_system_prompt),
            "User custom prompt is session-specific",
        ))

    # 同步解析
    results = resolve_sections(sections)

    # 追加提示词
    if append_system_prompt:
        results.append(append_system_prompt)

    return "\n\n".join(results)


def build_system_prompt_with_tools(
    tools_schema: list,
    identity: str = None,
    user_system_prompt: str = None,
    extra_context: dict = None,
    cwd: str = None,
    is_git: bool = False,
    platform: str = None,
    model: str = None,
    language: str = "中文",
) -> tuple[str, list]:
    """组装系统提示词并返回工具列表。

    返回 (system_prompt, tools_schema)
    """
    system_prompt = build_system_prompt(
        identity=identity,
        user_system_prompt=user_system_prompt,
        extra_context=extra_context,
        tools_schema=tools_schema,
        cwd=cwd,
        is_git=is_git,
        platform=platform,
        model=model,
        language=language,
    )
    return system_prompt, tools_schema


# =========================================================================
# Agent 模式提示词
# =========================================================================

def get_agent_system_prompt() -> str:
    """获取 Agent 模式的系统提示词"""
    return _get_config_value("agent_prompt", "You are an agent. Complete the task fully.")
