"""
Eos Agent — 工具集系统
定义工具分组，支持按场景加载不同工具集
"""


# 工具集定义
TOOLSETS = {
    # ── 基础工具集 ──
    "file": {
        "description": "文件操作",
        "tools": ["search_files"],
    },
    "terminal": {
        "description": "终端执行",
        "tools": ["terminal"],
    },

    # ── Eos-Tools 文件管理工具集 ──
    "eos-tools-file-management": {
        "description": "Eos-Tools 文件管理工具集（支持上下文管理）",
        "tools": ["eos_read_file", "eos_write_file", "eos_edit_file"],
    },

    # ── Aether Cards 工具集 ──
    "aether-cards": {
        "description": "Aether Cards 工作板操作",
        "tools": ["aether_cards"],
    },

    # ── Agent 只读工具集 ──
    "agent-readonly": {
        "description": "Agent 只读工具集（Explore/Plan 子 Agent 使用）",
        "tools": ["search_files", "read_file", "list_dir", "eos_read_file"],
    },

    # ── 组合工具集 ──
    "default": {
        "description": "默认工具集（文件 + 终端 + Eos-Tools + Cards）",
        "includes": ["file", "terminal", "eos-tools-file-management", "aether-cards"],
    },

    # ── 预留工具集（待实现） ──
    # "browser": {
    #     "description": "浏览器控制",
    #     "tools": ["browser_navigate", "browser_click", "browser_snapshot"],
    # },
    # "web": {
    #     "description": "Web 搜索与提取",
    #     "tools": ["web_search", "web_extract"],
    # },
    # "planning": {
    #     "description": "任务规划",
    #     "tools": ["todo"],
    # },
    # "memory": {
    #     "description": "记忆管理",
    #     "tools": ["memory"],
    # },
}


def resolve_toolset(name: str) -> set[str]:
    """解析工具集，返回所有工具名称集合（支持 includes 递归）"""
    if name not in TOOLSETS:
        return set()

    ts = TOOLSETS[name]
    tools = set(ts.get("tools", []))

    for inc in ts.get("includes", []):
        tools |= resolve_toolset(inc)

    return tools


def list_toolsets() -> dict:
    """返回所有工具集及其解析后的工具列表"""
    return {
        name: {
            "description": ts.get("description", ""),
            "tools": sorted(resolve_toolset(name)),
        }
        for name, ts in TOOLSETS.items()
    }


def register_skill_toolset(skill_name: str, tools: list):
    """动态注册 Skill 工具集"""
    toolset_name = f"skill:{skill_name}"
    TOOLSETS[toolset_name] = {
        "description": f"Skill '{skill_name}' 工具子集",
        "tools": tools,
    }


def unregister_skill_toolset(skill_name: str):
    """移除 Skill 工具集"""
    toolset_name = f"skill:{skill_name}"
    TOOLSETS.pop(toolset_name, None)
