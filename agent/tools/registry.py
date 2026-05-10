"""
Eos Agent — 工具注册中心
统一管理：内置工具、自定义工具文件
支持自注册架构 + 工具集分组
"""

import os
import json
import asyncio
import importlib.util
import threading
from pathlib import Path
from typing import Callable, Optional


class ToolRegistry:
    """工具注册中心 — 自注册架构"""

    def __init__(self):
        self._tools: dict[str, dict] = {}
        self._lock = threading.RLock()
        self._builtin_dir = Path(__file__).parent / "builtin"
        self._custom_dir = Path(__file__).parent / "custom"

    def register(self, name: str, description: str, parameters: dict,
                 handler: Callable, toolset: str = "custom"):
        """注册工具"""
        with self._lock:
            self._tools[name] = {
                "name": name,
                "description": description,
                "parameters": parameters,
                "handler": handler,
                "toolset": toolset,
            }

    def unregister(self, name: str):
        with self._lock:
            self._tools.pop(name, None)

    async def execute(self, name: str, params: dict) -> str:
        """执行工具"""
        tool = self._tools.get(name)
        if not tool:
            return f"错误: 工具 '{name}' 未注册"

        handler = tool["handler"]
        try:
            if asyncio.iscoroutinefunction(handler):
                result = await handler(params)
            else:
                result = await asyncio.to_thread(handler, params)
            return str(result)
        except Exception as e:
            return f"工具执行错误: {e}"

    def list_tools(self) -> list[dict]:
        """返回所有工具的 schema（供 LLM 使用）"""
        with self._lock:
            return [
                {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": t["parameters"],
                }
                for t in self._tools.values()
            ]

    def list_tools_by_toolset(self, toolset_name: str) -> list[dict]:
        """按工具集过滤工具 schema"""
        from toolsets import resolve_toolset
        allowed = resolve_toolset(toolset_name)
        with self._lock:
            return [
                {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": t["parameters"],
                }
                for t in self._tools.values()
                if t["name"] in allowed
            ]

    def get(self, name: str) -> Optional[dict]:
        return self._tools.get(name)

    def load_builtin(self):
        """加载内置工具"""
        self._load_dir(self._builtin_dir)

    def load_custom(self):
        """热加载自定义工具目录"""
        self._load_dir(self._custom_dir)

    def _load_dir(self, directory: Path):
        """扫描目录，加载所有工具模块"""
        if not directory.exists():
            return
        for f in directory.glob("*.py"):
            if f.name.startswith("_"):
                continue
            self._load_module(f)

    def _load_module(self, path: Path):
        """从 Python 文件加载工具 — 支持单工具 (TOOL_SCHEMA) 和多工具 (TOOL_SCHEMAS)"""
        try:
            spec = importlib.util.spec_from_file_location(path.stem, path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            # 多工具模式：TOOL_SCHEMAS 是一个列表
            schemas = getattr(module, "TOOL_SCHEMAS", None)
            if schemas and isinstance(schemas, list):
                for entry in schemas:
                    name = entry.get("name", path.stem)
                    handler = entry.get("handler")
                    if handler:
                        self.register(
                            name=name,
                            description=entry.get("description", ""),
                            parameters=entry.get("parameters", {"type": "object", "properties": {}}),
                            handler=handler,
                            toolset=entry.get("toolset", "custom"),
                        )
                return

            # 单工具模式：TOOL_SCHEMA + handler
            schema = getattr(module, "TOOL_SCHEMA", None)
            handler = getattr(module, "handler", None)
            if schema and handler:
                name = schema.get("name", path.stem)
                self.register(
                    name=name,
                    description=schema.get("description", ""),
                    parameters=schema.get("parameters", {"type": "object", "properties": {}}),
                    handler=handler,
                    toolset=schema.get("toolset", "custom"),
                )
        except Exception as e:
            print(f"加载工具失败 {path}: {e}")


# ── 全局单例 ──
registry = ToolRegistry()
registry.load_builtin()
registry.load_custom()
