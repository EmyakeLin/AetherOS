"""
Eos Agent — 工具集系统
定义工具分组，支持按场景加载不同工具集
"""


# 工具集定义
TOOLSETS = {
    "file": {
        "description": "文件操作",
        "tools": ["read_file", "write_file", "list_dir", "search_files", "patch"],
    },
    "terminal": {
        "description": "终端执行",
        "tools": ["run_command"],
    },
    "default": {
        "description": "默认工具集",
        "includes": ["file", "terminal"],
    },
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
