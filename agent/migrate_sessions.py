"""
迁移脚本：将旧 SQLite 会话数据迁移到新的 JSON 文件存储
同步写入 SQLite 索引
"""

import json
import sqlite3
import sys
import time
from pathlib import Path


def migrate():
    old_db = Path.home() / ".aetheros" / "data" / "agent.db"
    new_base = Path.home() / ".aetheros" / "agent"
    new_sessions_dir = new_base / "sessions"
    new_index_db = new_base / "index.db"

    new_sessions_dir.mkdir(parents=True, exist_ok=True)

    if not old_db.exists():
        print("旧数据库不存在，跳过迁移")
        return

    # 连接旧数据库
    old_db_conn = sqlite3.connect(old_db)
    old_db_conn.row_factory = sqlite3.Row

    # 连接新索引数据库
    new_db = sqlite3.connect(new_index_db)
    new_db.execute("PRAGMA journal_mode=WAL")
    new_db.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '新会话',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            message_count INTEGER DEFAULT 0
        )
    """)
    new_db.execute("""
        CREATE INDEX IF NOT EXISTS idx_sessions_updated
        ON sessions(updated_at DESC)
    """)
    new_db.commit()

    # 获取所有会话
    sessions = old_db_conn.execute("SELECT * FROM sessions ORDER BY updated_at DESC").fetchall()
    print(f"找到 {len(sessions)} 个会话")

    for session in sessions:
        session_id = session["id"]
        json_path = new_sessions_dir / f"{session_id}.json"

        # 获取该会话的所有消息
        messages = old_db_conn.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC",
            (session_id,)
        ).fetchall()

        # 构建 JSON 数据
        session_data = {
            "id": session_id,
            "title": session["title"],
            "created_at": session["created_at"],
            "updated_at": session["updated_at"],
            "system_prompt": session["system_prompt"],
            "messages": []
        }

        for msg in messages:
            msg_obj = {
                "role": msg["role"],
                "timestamp": msg["timestamp"],
            }
            if msg["content"]:
                msg_obj["content"] = msg["content"]
            if msg["tool_call_id"]:
                msg_obj["tool_call_id"] = msg["tool_call_id"]
            if msg["tool_calls"]:
                try:
                    msg_obj["tool_calls"] = json.loads(msg["tool_calls"])
                except (json.JSONDecodeError, TypeError):
                    pass
            if msg["tool_name"]:
                msg_obj["tool_name"] = msg["tool_name"]
            if msg["reasoning_content"]:
                msg_obj["reasoning_content"] = msg["reasoning_content"]

            session_data["messages"].append(msg_obj)

        # 写入 JSON 文件
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2)

        # 写入 SQLite 索引
        new_db.execute(
            "INSERT OR REPLACE INTO sessions (id, title, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?)",
            (session_id, session["title"], session["created_at"], session["updated_at"], len(messages))
        )

        print(f"  迁移 {session_id}: {len(messages)} 条消息")

    new_db.commit()
    old_db_conn.close()
    new_db.close()
    print("迁移完成!")


if __name__ == "__main__":
    migrate()
