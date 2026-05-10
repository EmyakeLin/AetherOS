"""
Eos Agent — 会话持久化存储
使用 SQLite 存储完整的会话记录（包括工具调用）
"""

import json
import time
import uuid
from pathlib import Path
from typing import Optional

import aiosqlite


class AgentStorage:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db: Optional[aiosqlite.Connection] = None

    async def _get_db(self) -> aiosqlite.Connection:
        """获取或创建持久化连接"""
        if self._db is None:
            self._db = await aiosqlite.connect(self.db_path)
            await self._db.execute("PRAGMA journal_mode=WAL")
            await self._db.execute("PRAGMA synchronous=NORMAL")
            self._db.row_factory = aiosqlite.Row
        return self._db

    async def close(self):
        """关闭连接（服务器关闭时调用）"""
        if self._db:
            await self._db.close()
            self._db = None

    async def init_db(self):
        """创建表结构"""
        db = await self._get_db()
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '新会话',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                message_count INTEGER DEFAULT 0,
                system_prompt TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT,
                tool_call_id TEXT,
                tool_calls TEXT,
                tool_name TEXT,
                reasoning_content TEXT,
                timestamp INTEGER NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_session
            ON messages(session_id, timestamp)
        """)
        await db.commit()

    async def create_session(self, title: str = "新会话", system_prompt: str = None) -> dict:
        """创建新会话"""
        now = int(time.time() * 1000)
        session_id = f"session-{now}-{uuid.uuid4().hex[:6]}"
        db = await self._get_db()
        await db.execute(
            "INSERT INTO sessions (id, title, created_at, updated_at, system_prompt) VALUES (?, ?, ?, ?, ?)",
            (session_id, title, now, now, system_prompt)
        )
        await db.commit()
        return {"id": session_id, "title": title, "created_at": now, "updated_at": now, "message_count": 0}

    async def get_session(self, session_id: str) -> Optional[dict]:
        """获取单个会话"""
        db = await self._get_db()
        async with db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def list_sessions(self) -> list:
        """列出所有会话，按更新时间降序"""
        db = await self._get_db()
        async with db.execute("SELECT * FROM sessions ORDER BY updated_at DESC") as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def update_session(self, session_id: str, updates: dict) -> Optional[dict]:
        """更新会话字段"""
        allowed = {"title", "message_count", "system_prompt"}
        fields = {k: v for k, v in updates.items() if k in allowed}
        if not fields:
            return await self.get_session(session_id)

        fields["updated_at"] = int(time.time() * 1000)
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [session_id]

        db = await self._get_db()
        await db.execute(f"UPDATE sessions SET {set_clause} WHERE id = ?", values)
        await db.commit()
        return await self.get_session(session_id)

    async def delete_session(self, session_id: str):
        """删除会话及其所有消息"""
        db = await self._get_db()
        await db.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        await db.commit()

    async def add_message(self, session_id: str, role: str, content: str = None,
                          tool_call_id: str = None, tool_calls: list = None,
                          tool_name: str = None, reasoning_content: str = None) -> dict:
        """添加消息（支持完整的消息结构）"""
        now = int(time.time() * 1000)
        db = await self._get_db()

        # 序列化 tool_calls 为 JSON
        tool_calls_json = json.dumps(tool_calls, ensure_ascii=False) if tool_calls else None

        cursor = await db.execute(
            """INSERT INTO messages
               (session_id, role, content, tool_call_id, tool_calls, tool_name, reasoning_content, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (session_id, role, content, tool_call_id, tool_calls_json, tool_name, reasoning_content, now)
        )
        await db.execute(
            "UPDATE sessions SET updated_at = ?, message_count = message_count + 1 WHERE id = ?",
            (now, session_id)
        )
        await db.commit()

        return {
            "id": cursor.lastrowid,
            "session_id": session_id,
            "role": role,
            "content": content,
            "tool_call_id": tool_call_id,
            "tool_calls": tool_calls,
            "tool_name": tool_name,
            "reasoning_content": reasoning_content,
            "timestamp": now,
        }

    async def get_messages(self, session_id: str) -> list:
        """获取会话所有消息，按时间升序（完整格式）"""
        db = await self._get_db()
        async with db.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC",
            (session_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            result = []
            for row in rows:
                msg = dict(row)
                # 反序列化 tool_calls
                if msg.get("tool_calls"):
                    try:
                        msg["tool_calls"] = json.loads(msg["tool_calls"])
                    except (json.JSONDecodeError, TypeError):
                        msg["tool_calls"] = []
                else:
                    msg["tool_calls"] = None
                result.append(msg)
            return result

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


# 全局实例
_storage: Optional[AgentStorage] = None


def get_storage() -> AgentStorage:
    global _storage
    if _storage is None:
        _storage = AgentStorage(Path.home() / ".aetheros" / "data" / "agent.db")
    return _storage
