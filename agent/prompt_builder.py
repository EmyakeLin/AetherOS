"""
Eos Agent — 系统提示词组装
动态组装：身份 + 工具指导 + 上下文注入 + 安全扫描
"""

import re
from pathlib import Path
from typing import Optional


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

    # 检测不可见 Unicode 字符
    for char in _INVISIBLE_CHARS:
        if char in content:
            findings.append(f"invisible unicode U+{ord(char):04X}")

    # 检测威胁模式
    for pattern, pid in _THREAT_PATTERNS:
        if re.search(pattern, content, re.IGNORECASE):
            findings.append(pid)

    if findings:
        return f"[BLOCKED: {filename} 检测到潜在 prompt injection ({', '.join(findings)})。内容未加载。]"

    return content


# =========================================================================
# 常量定义
# =========================================================================

DEFAULT_AGENT_IDENTITY = (
    "你是 Eos Agent，AetherOS 浏览器操作系统中的智能 AI 助手。"
    "你能够帮助用户完成各种任务，包括：文件操作、终端执行、代码编写、信息查询等。"
    "你使用中文与用户沟通，保持简洁高效。"
    "遇到不确定的情况时，坦诚说明并寻求澄清。"
    "优先完成实际任务，而非冗长的解释。"
)

PLATFORM_HINT = (
    "你运行在 AetherOS 浏览器操作系统中。"
    "用户通过浏览器界面与你交互，支持 Markdown 渲染。"
    "你可以使用工具执行文件操作、终端命令、代码搜索等任务。"
    "所有文件操作都在服务器的文件系统中进行。"
)

TOOL_USE_ENFORCEMENT_GUIDANCE = (
    "# 工具使用规则\n"
    "你必须使用工具来完成任务——不要描述你会做什么而不执行。"
    "当你说要执行某个操作（如「我来检查文件」、「我来运行命令」）时，"
    "必须在同一响应中调用相应的工具。不要以承诺未来操作结束响应。\n"
    "持续工作直到任务实际完成。不要只总结下次要做什么。\n"
    "每个响应应该 (a) 包含工具调用来推进任务，或 (b) 向用户交付最终结果。"
    "只描述意图而不执行的响应是不可接受的。"
)


# =========================================================================
# 上下文文件加载
# =========================================================================

CONTEXT_FILE_MAX_CHARS = 20_000


def _truncate_content(content: str, filename: str, max_chars: int = CONTEXT_FILE_MAX_CHARS) -> str:
    """截断过长内容，保留头部和尾部。"""
    if len(content) <= max_chars:
        return content
    head_chars = int(max_chars * 0.7)
    tail_chars = int(max_chars * 0.2)
    head = content[:head_chars]
    tail = content[-tail_chars:]
    marker = f"\n\n[...已截断 {filename}: 保留 {head_chars}+{tail_chars} / {len(content)} 字符]\n\n"
    return head + marker + tail


def _load_claude_md(project_root: Optional[str] = None) -> str:
    """加载 CLAUDE.md 项目指令文件。"""
    if project_root is None:
        project_root = str(Path.cwd())

    cwd_path = Path(project_root).resolve()

    for name in ["CLAUDE.md", "claude.md"]:
        candidate = cwd_path / name
        if candidate.exists():
            try:
                content = candidate.read_text(encoding="utf-8").strip()
                if content:
                    content = _scan_context_content(content, name)
                    result = f"## {name}\n\n{content}"
                    return _truncate_content(result, "CLAUDE.md")
            except Exception:
                pass
    return ""


# =========================================================================
# 系统提示词组装
# =========================================================================

def build_system_prompt(
    identity: str = None,
    user_system_prompt: str = None,
    project_root: str = None,
    extra_context: dict = None,
) -> str:
    """组装完整的系统提示词。

    参数:
        identity: Agent 身份字符串（默认使用 DEFAULT_AGENT_IDENTITY）
        user_system_prompt: 用户自定义 system prompt（从 Agent 设置中配置）
        project_root: 项目根目录（用于加载 CLAUDE.md）
        extra_context: 额外上下文（如当前目录、打开的文件等）
    """
    sections = []

    # 1. Agent 身份
    sections.append(identity or DEFAULT_AGENT_IDENTITY)

    # 2. 平台提示
    sections.append(PLATFORM_HINT)

    # 3. 工具使用强制指导
    sections.append(TOOL_USE_ENFORCEMENT_GUIDANCE)

    # 4. 上下文文件（CLAUDE.md）
    claude_md = _load_claude_md(project_root)
    if claude_md:
        sections.append(claude_md)

    # 5. OS 状态上下文
    if extra_context:
        ctx_parts = []
        for key, value in extra_context.items():
            ctx_parts.append(f"[{key}]\n{value}")
        if ctx_parts:
            sections.append("# 系统上下文\n\n" + "\n\n".join(ctx_parts))

    # 6. 用户自定义 system prompt
    if user_system_prompt:
        sections.append(user_system_prompt)

    return "\n\n".join(sections)


def build_system_prompt_with_tools(
    tools_schema: list,
    identity: str = None,
    user_system_prompt: str = None,
    project_root: str = None,
    extra_context: dict = None,
) -> tuple[str, list]:
    """组装系统提示词并返回工具列表。

    返回 (system_prompt, tools_schema)
    """
    system_prompt = build_system_prompt(
        identity=identity,
        user_system_prompt=user_system_prompt,
        project_root=project_root,
        extra_context=extra_context,
    )
    return system_prompt, tools_schema
