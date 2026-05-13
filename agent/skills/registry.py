"""
Eos Agent — Skill 注册中心
统一管理 Skill 定义：元数据、提示词、执行逻辑
"""

import json
import importlib.util
import logging
import threading
from pathlib import Path
from typing import Optional, Callable

logger = logging.getLogger(__name__)


class Skill:
    """已加载的 Skill 实例"""

    def __init__(self, name: str, description: str, trigger: str,
                 tools: list, prompt: str,
                 execute_fn: Optional[Callable] = None,
                 metadata: dict = None):
        self.name = name
        self.description = description
        self.trigger = trigger
        self.tools = tools
        self.prompt = prompt
        self.execute_fn = execute_fn
        self.metadata = metadata or {}

    def has_custom_execution(self) -> bool:
        return self.execute_fn is not None

    async def execute(self, params: dict) -> Optional[str]:
        """执行 Skill 自定义逻辑"""
        if self.execute_fn:
            import asyncio
            if asyncio.iscoroutinefunction(self.execute_fn):
                return await self.execute_fn(params)
            return await asyncio.to_thread(self.execute_fn, params)
        return None


class SkillRegistry:
    """Skill 注册中心 — 目录扫描 + 懒加载"""

    def __init__(self):
        self._skills: dict = {}
        self._lock = threading.RLock()
        self._definitions_dir = Path(__file__).parent / "definitions"

    def register(self, skill: Skill):
        with self._lock:
            self._skills[skill.name] = skill

    def unregister(self, name: str):
        with self._lock:
            self._skills.pop(name, None)

    def get(self, name: str) -> Optional[Skill]:
        with self._lock:
            return self._skills.get(name)

    def list_skills(self) -> list:
        """返回所有 Skill 的摘要（供 LLM 和前端使用）"""
        with self._lock:
            return [
                {
                    "name": s.name,
                    "description": s.description,
                    "trigger": s.trigger,
                    "tools": s.tools,
                }
                for s in self._skills.values()
            ]

    def find_by_slash_command(self, text: str) -> Optional[tuple]:
        """
        检测文本是否以 /skill-name 开头。
        返回 (Skill, 剩余文本) 或 None。
        """
        if not text.startswith("/"):
            return None
        parts = text[1:].split(None, 1)
        if not parts:
            return None
        command = parts[0].lower()
        remainder = parts[1] if len(parts) > 1 else ""
        with self._lock:
            for s in self._skills.values():
                aliases = s.metadata.get("aliases", [])
                if s.name.lower() == command or command in aliases:
                    return s, remainder
        return None

    def scan_definitions(self):
        """扫描 definitions/ 目录，加载所有 Skill"""
        if not self._definitions_dir.exists():
            return
        for entry in sorted(self._definitions_dir.iterdir()):
            if entry.is_dir() and not entry.name.startswith("_"):
                self._load_skill_dir(entry)

    def _load_skill_dir(self, directory: Path):
        """从目录加载单个 Skill"""
        skill_json = directory / "skill.json"
        if not skill_json.exists():
            return

        try:
            meta = json.loads(skill_json.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"Failed to load skill.json from {directory}: {e}")
            return

        name = meta.get("name", directory.name)
        prompt_file = directory / "prompt.md"
        prompt = ""
        if prompt_file.exists():
            prompt = prompt_file.read_text(encoding="utf-8")

        execute_fn = None
        skill_py = directory / "skill.py"
        if skill_py.exists():
            execute_fn = self._load_execute_fn(skill_py, name)

        skill = Skill(
            name=name,
            description=meta.get("description", ""),
            trigger=meta.get("trigger", ""),
            tools=meta.get("tools", []),
            prompt=prompt,
            execute_fn=execute_fn,
            metadata=meta,
        )
        self.register(skill)
        logger.info(f"Loaded skill: {name}")

    def _load_execute_fn(self, path: Path, skill_name: str) -> Optional[Callable]:
        """从 skill.py 加载 execute 函数"""
        try:
            spec = importlib.util.spec_from_file_location(
                f"skill_{skill_name}", path
            )
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            return getattr(module, "execute", None)
        except Exception as e:
            logger.warning(f"Failed to load skill.py from {path}: {e}")
            return None


# 全局单例
skill_registry = SkillRegistry()
skill_registry.scan_definitions()
