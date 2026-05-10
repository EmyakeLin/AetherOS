"""
Eos Agent — 会话持久化存储 (v2)
架构：JSON 文件存储完整会话，SQLite 仅作元数据索引

目录结构：
  .aetheros/agent/
  ├── sessions/
  │   ├── {session_id}.json   # 完整会话记录
  │   └── ...
  └── index.db                # SQLite 元数据索引
"""

import json
import time
import uuid
import logging
from pathlib import Path
from typing import Optional

import aiosqlite

logger = logging.getLogger(__name__)


class AgentStorage:
    def __init__(self, base_path: Path):
        self.base_path = base_path
        self.sessions_dir = base_path / "sessions"
        self.db_path = base_path / "index.db"

        # 确保目录存在
        self.sessions_dir.mkdir(parents=True, exist_ok=True)

        self._db: Optional[aiosqlite.Connection] = None

    async def _get_db(self) -> aiosqlite.Connection:
        """获取或创建 SQLite 连接"""
        if self._db is None:
            self._db = await aiosqlite.connect(self.db_path)
            await self._db.execute("PRAGMA journal_mode=WAL")
            await self._db.execute("PRAGMA synchronous=NORMAL")
            self._db.row_factory = aiosqlite.Row
        return self._db

    async def close(self):
        """关闭连接"""
        if self._db:
            await self._db.close()
            self._db = None

    async def init_db(self):
        """创建 SQLite 索引表"""
        db = await self._get_db()
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '新会话',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                message_count INTEGER DEFAULT 0
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_updated
            ON sessions(updated_at DESC)
        """)
        await db.commit()

    # ─────────────────────────────────────────────
    # JSON 文件操作
    # ─────────────────────────────────────────────

    def _session_path(self, session_id: str) -> Path:
        """获取 session JSON 文件路径"""
        return self.sessions_dir / f"{session_id}.json"

    def _read_session_file(self, session_id: str) -> Optional[dict]:
        """读取 session JSON 文件"""
        path = self._session_path(session_id)
        if not path.exists():
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Failed to read session file {path}: {e}")
            return None

    def _write_session_file(self, session_id: str, data: dict):
        """写入 session JSON 文件"""
        path = self._session_path(session_id)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except IOError as e:
            logger.error(f"Failed to write session file {path}: {e}")
            raise

    # ─────────────────────────────────────────────
    # Session CRUD
    # ─────────────────────────────────────────────

    async def create_session(self, title: str = "新会话", system_prompt: str = None) -> dict:
        """创建新会话"""
        now = int(time.time() * 1000)
        session_id = f"session-{now}-{uuid.uuid4().hex[:6]}"

        # 写入 JSON 文件
        session_data = {
            "id": session_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
            "system_prompt": system_prompt,
            "messages": []
        }
        self._write_session_file(session_id, session_data)

        # 写入 SQLite 索引
        db = await self._get_db()
        await db.execute(
            "INSERT INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)",
            (session_id, title, now, now, 0)
        )
        await db.commit()

        return {"id": session_id, "title": title, "created_at": now, "updated_at": now, "message_count": 0}

    async def get_session(self, session_id: str) -> Optional[dict]:
        """获取会话元数据（从 SQLite）"""
        db = await self._get_db()
        async with db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def get_session_with_messages(self, session_id: str) -> Optional[dict]:
        """获取完整会话（含消息，从 JSON 文件）"""
        return self._read_session_file(session_id)

    async def list_sessions(self) -> list:
        """列出所有会话（元数据），按更新时间降序"""
        db = await self._get_db()
        async with db.execute("SELECT * FROM sessions ORDER BY updated_at DESC") as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def update_session(self, session_id: str, updates: dict) -> Optional[dict]:
        """更新会话元数据"""
        allowed = {"title", "message_count"}
        fields = {k: v for k, v in updates.items() if k in allowed}
        if not fields:
            return await self.get_session(session_id)

        fields["updated_at"] = int(time.time() * 1000)
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [session_id]

        db = await self._get_db()
        await db.execute(f"UPDATE sessions SET {set_clause} WHERE id = ?", values)
        await db.commit()

        # 同步更新 JSON 文件中的元数据
        session_data = self._read_session_file(session_id)
        if session_data:
            session_data.update(fields)
            self._write_session_file(session_id, session_data)

        return await self.get_session(session_id)

    async def delete_session(self, session_id: str):
        """删除会话"""
        # 删除 JSON 文件
        path = self._session_path(session_id)
        if path.exists():
            path.unlink()

        # 删除 SQLite 索引
        db = await self._get_db()
        await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        await db.commit()

    # ─────────────────────────────────────────────
    # Message CRUD
    # ─────────────────────────────────────────────

    async def add_message(self, session_id: str, role: str, content: str = None,
                          tool_call_id: str = None, tool_calls: list = None,
                          tool_name: str = None, reasoning_content: str = None) -> dict:
        """添加消息到 JSON 文件"""
        now = int(time.time() * 1000)

        # 构建消息对象
        msg = {
            "role": role,
            "timestamp": now,
        }
        if content is not None:
            msg["content"] = content
        if tool_call_id is not None:
            msg["tool_call_id"] = tool_call_id
        if tool_calls is not None:
            msg["tool_calls"] = tool_calls
        if tool_name is not None:
            msg["tool_name"] = tool_name
        if reasoning_content is not None:
            msg["reasoning_content"] = reasoning_content

        # 读取现有会话
        session_data = self._read_session_file(session_id)
        if not session_data:
            logger.warning(f"Session {session_id} not found, creating new one")
            session_data = {
                "id": session_id,
                "title": "新会话",
                "created_at": now,
                "updated_at": now,
                "system_prompt": None,
                "messages": []
            }

        # 添加消息
        session_data["messages"].append(msg)
        session_data["updated_at"] = now

        # 写入 JSON
        self._write_session_file(session_id, session_data)

        # 更新 SQLite 索引
        db = await self._get_db()
        await db.execute(
            "UPDATE sessions SET updated_at = ?, message_count = message_count + 1 WHERE id = ?",
            (now, session_id)
        )
        await db.commit()

        return msg

    async def get_messages(self, session_id: str) -> list:
        """获取会话所有消息（从 JSON 文件）"""
        session_data = self._read_session_file(session_id)
        if not session_data:
            return []
        return session_data.get("messages", [])

    async def get_messages_as_conversation(self, session_id: str) -> list:
        """获取消息列表，格式化为 LLM 可用的 conversation 格式"""
        messages = await self.get_messages(session_id)
        result = []
        for msg in messages:
            entry = {"role": msg["role"]}
            if msg.get("content"):
                entry["content"] = msg["content"]
            if msg.get("tool_call_id"):
                entry["tool_call_id"] = msg["tool_call_id"]
            if msg.get("tool_calls"):
                entry["tool_calls"] = msg["tool_calls"]
            if msg.get("reasoning_content"):
                entry["reasoning_content"] = msg["reasoning_content"]
            result.append(entry)
        return result

    async def search_sessions(self, query: str, limit: int = 20) -> list:
        """搜索会话（基于标题）"""
        db = await self._get_db()
        async with db.execute(
            "SELECT * FROM sessions WHERE title LIKE ? ORDER BY updated_at DESC LIMIT ?",
            (f"%{query}%", limit)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


# 全局实例
_storage: Optional[AgentStorage] = None


def get_storage() -> AgentStorage:
    global _storage
    if _storage is None:
        _storage = AgentStorage(Path.home() / ".aetheros" / "agent")
    return _storage
