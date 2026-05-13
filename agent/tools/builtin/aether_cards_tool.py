"""
内置工具 — Aether Cards 工作板操作
让 Eos Agent 能够读写 Aether Cards 知识库
"""

import json
import asyncio
from pathlib import Path


DB_PATH = Path.home() / ".aetheros" / "data" / "cards.db"


async def _get_board_id(work_table: str) -> str | None:
    """通过工作板名称获取 board_id"""
    import aiosqlite
    try:
        async with aiosqlite.connect(str(DB_PATH)) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT id FROM boards WHERE title = ?", [work_table]) as cur:
                row = await cur.fetchone()
                return row['id'] if row else None
    except Exception:
        return None


async def _load(params: dict) -> str:
    """加载工作板，返回所有卡片标题及元数据状态。不传 work_table 则列出所有工作板。"""
    work_table = params.get("work_table", "")

    import aiosqlite
    if not work_table:
        # 列出所有工作板
        try:
            async with aiosqlite.connect(str(DB_PATH)) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute("SELECT id, title FROM boards ORDER BY created_at") as cur:
                    boards = await cur.fetchall()
            if not boards:
                return "没有工作板。"
            lines = ["# 工作板列表\n"]
            for b in boards:
                # 获取每个板的卡片数
                async with aiosqlite.connect(str(DB_PATH)) as db:
                    async with db.execute("SELECT COUNT(*) FROM cards WHERE board_id = ?", [b['id']]) as cur:
                        count = (await cur.fetchone())[0]
                lines.append(f"- **{b['title']}** ({count} 张卡片)")
            return '\n'.join(lines)
        except Exception as e:
            return f"错误: {e}"

    board_id = await _get_board_id(work_table)
    if not board_id:
        return f"错误: 未找到工作板 '{work_table}'"

    import aiosqlite
    try:
        async with aiosqlite.connect(str(DB_PATH)) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT title, type, metadata, metadata_version, updated_at, metadata_disabled FROM cards WHERE board_id = ?",
                [board_id]
            ) as cur:
                rows = await cur.fetchall()

        if not rows:
            return f"工作板 '{work_table}' 中没有卡片。"

        lines = [f"# 工作板: {work_table}", f"共 {len(rows)} 张卡片\n"]
        lines.append("| 标题 | 类型 | 元数据状态 |")
        lines.append("|------|------|------------|")
        for row in rows:
            title = row['title'] or '无标题'
            card_type = row['type'] or 'default'
            disabled = row['metadata_disabled']
            metadata = row['metadata']
            version = row['metadata_version']
            updated = row['updated_at']

            if disabled:
                status = "🚫 已禁用"
            elif not metadata:
                status = "— 无元数据"
            elif updated and version and updated > int(version or '0'):
                status = "⚠ 内容已变更"
            else:
                status = "✓ 已有元数据"
            lines.append(f"| {title} | {card_type} | {status} |")

        return '\n'.join(lines)
    except Exception as e:
        return f"错误: {e}"


async def _get(params: dict) -> str:
    """获取一个或多个卡片的内容"""
    work_table = params.get("work_table", "")
    card_name = params.get("card_name", "")
    if not work_table:
        return "错误: 未指定工作板名称 (work_table)"
    if not card_name:
        return "错误: 未指定卡片名称 (card_name)"

    board_id = await _get_board_id(work_table)
    if not board_id:
        return f"错误: 未找到工作板 '{work_table}'"

    names = [n.strip() for n in card_name.split(',') if n.strip()]
    import aiosqlite
    try:
        results = []
        async with aiosqlite.connect(str(DB_PATH)) as db:
            db.row_factory = aiosqlite.Row
            for name in names:
                async with db.execute(
                    "SELECT title, content, metadata, type FROM cards WHERE board_id = ? AND title = ?",
                    [board_id, name]
                ) as cur:
                    row = await cur.fetchone()
                if not row:
                    results.append(f"## {name}\n\n❌ 未找到此卡片\n")
                    continue
                section = f"## {row['title'] or '无标题'}"
                if row['type'] and row['type'] != 'default':
                    section += f" [{row['type']}]"
                section += "\n"
                if row['metadata']:
                    try:
                        meta = json.loads(row['metadata'])
                        section += f"- Summary: {meta.get('summary', 'N/A')}\n"
                        if meta.get('tags'):
                            section += f"- Tags: {', '.join(meta['tags'])}\n"
                        if meta.get('category'):
                            section += f"- Category: {meta['category']}\n"
                    except Exception:
                        pass
                section += f"\n{row['content'] or '(空卡片)'}\n"
                results.append(section)
        return '\n'.join(results)
    except Exception as e:
        return f"错误: {e}"


async def _extract(params: dict) -> str:
    """通过 LLM 分析工作板内容，返回与 purpose 相关的计划或指导"""
    work_table = params.get("work_table", "")
    purpose = params.get("purpose", "")
    if not work_table:
        return "错误: 未指定工作板名称 (work_table)"
    if not purpose:
        return "错误: 未指定意图 (purpose)"

    board_id = await _get_board_id(work_table)
    if not board_id:
        return f"错误: 未找到工作板 '{work_table}'"

    import aiosqlite
    try:
        async with aiosqlite.connect(str(DB_PATH)) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT title, content, metadata, type FROM cards WHERE board_id = ?",
                [board_id]
            ) as cur:
                rows = await cur.fetchall()

        if not rows:
            return f"工作板 '{work_table}' 中没有卡片，无法进行分析。"

        # 构建上下文
        context_parts = []
        for row in rows:
            part = f"### {row['title'] or '无标题'}"
            if row['type'] and row['type'] != 'default':
                part += f" [{row['type']}]"
            if row['metadata']:
                try:
                    meta = json.loads(row['metadata'])
                    part += f"\nMetadata: {json.dumps(meta, ensure_ascii=False)}"
                except Exception:
                    pass
            part += f"\n{row['content'] or '(空)'}\n"
            context_parts.append(part)

        board_context = '\n'.join(context_parts)

        # 调用 LLM
        from agent.engine import llm_service
        messages = [
            {"role": "system", "content": "你是 Aether Cards 知识分析助手。根据用户提供的工作板卡片内容和意图，给出详细的分析、计划或开发指导。使用中文回复。"},
            {"role": "user", "content": f"## 工作板: {work_table}\n\n{board_context}\n\n## 意图\n{purpose}"}
        ]
        result_parts = []
        async for event in llm_service.chat_stream(messages):
            if event.get('type') == 'text':
                result_parts.append(event.get('content', ''))
            elif event.get('type') == 'done':
                break
        return ''.join(result_parts) or "LLM 未返回内容。"
    except Exception as e:
        return f"错误: {e}"


async def _create(params: dict) -> str:
    """创建 Code Card 或 Progress Card"""
    work_table = params.get("work_table", "")
    card_name = params.get("card_name", "")
    content = params.get("content", "")
    card_type = params.get("card_type", "code")

    if not work_table:
        return "错误: 未指定工作板名称 (work_table)"
    if not card_name:
        return "错误: 未指定卡片名称 (card_name)"
    if card_type not in ('code', 'progress'):
        return f"错误: card_type 必须为 'code' 或 'progress'，当前值: '{card_type}'"

    board_id = await _get_board_id(work_table)
    if not board_id:
        return f"错误: 未找到工作板 '{work_table}'"

    import aiosqlite
    try:
        card_id = f"card-{int(asyncio.get_event_loop().time() * 1000)}-{card_name[:8]}"
        now = int(asyncio.get_event_loop().time() * 1000)
        async with aiosqlite.connect(str(DB_PATH)) as db:
            await db.execute(
                "INSERT INTO cards (id, board_id, title, content, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [card_id, board_id, card_name, content, card_type, now, now]
            )
            await db.commit()
        return f"已创建 {card_type} 卡片 '{card_name}' (ID: {card_id})"
    except Exception as e:
        return f"错误: {e}"


async def _edit(params: dict) -> str:
    """编辑 Code Card 或 Progress Card 的内容"""
    work_table = params.get("work_table", "")
    card_name = params.get("card_name", "")
    old_string = params.get("old_string", "")
    new_string = params.get("new_string", "")

    if not work_table:
        return "错误: 未指定工作板名称 (work_table)"
    if not card_name:
        return "错误: 未指定卡片名称 (card_name)"
    if not old_string:
        return "错误: 未指定要替换的文本 (old_string)"

    board_id = await _get_board_id(work_table)
    if not board_id:
        return f"错误: 未找到工作板 '{work_table}'"

    import aiosqlite
    try:
        async with aiosqlite.connect(str(DB_PATH)) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT id, content, type FROM cards WHERE board_id = ? AND title = ?",
                [board_id, card_name]
            ) as cur:
                row = await cur.fetchone()

            if not row:
                return f"错误: 未找到卡片 '{card_name}'"
            if row['type'] not in ('code', 'progress'):
                return f"错误: 只能编辑 Code Card 和 Progress Card，当前类型: '{row['type']}'"

            content = row['content'] or ''
            count = content.count(old_string)
            if count == 0:
                return f"错误: 在卡片 '{card_name}' 中未找到要替换的文本"
            if count > 1:
                return f"错误: 在卡片 '{card_name}' 中找到 {count} 处匹配，请提供更多上下文使匹配唯一"

            new_content = content.replace(old_string, new_string, 1)
            now = int(asyncio.get_event_loop().time() * 1000)
            await db.execute(
                "UPDATE cards SET content = ?, updated_at = ? WHERE id = ?",
                [new_content, now, row['id']]
            )
            await db.commit()

            # 生成 diff
            before_idx = content.index(old_string)
            line_no = content[:before_idx].count('\n') + 1
            return f"已修改卡片 '{card_name}' (第 {line_no} 行)\n\n--- old\n{old_string}\n+++ new\n{new_string}"
    except Exception as e:
        return f"错误: {e}"


async def _dispatch(params: dict) -> str:
    """根据 operation 分发到对应处理函数"""
    op = params.get("operation", "")
    handlers = {
        "load": _load,
        "get": _get,
        "extract": _extract,
        "create": _create,
        "edit": _edit,
    }
    handler = handlers.get(op)
    if not handler:
        return f"错误: 未知操作 '{op}'，可选: load, get, extract, create, edit"
    return await handler(params)


TOOL_SCHEMAS = [
    {
        "name": "aether_cards",
        "description": "操作 Aether Cards 工作板：查看卡片列表、获取卡片内容、通过 AI 分析工作板、创建或编辑卡片。首次使用时先不传 work_table 调 load 获取所有工作板列表。",
        "parameters": {
            "type": "object",
            "properties": {
                "work_table": {"type": "string", "description": "工作板名称（如 '默认工作板'）。load 操作可省略，省略则列出所有工作板。"},
                "operation": {"type": "string", "enum": ["load", "get", "extract", "create", "edit"], "description": "操作类型: load=加载卡片列表(省略work_table则列出所有板), get=获取卡片内容, extract=AI分析, create=创建卡片, edit=编辑卡片"},
                "card_name": {"type": "string", "description": "卡片名称（get/edit/create 操作必需，get 支持逗号分隔多个名称）"},
                "content": {"type": "string", "description": "卡片内容（create 操作必需）"},
                "card_type": {"type": "string", "enum": ["code", "progress"], "description": "卡片类型（create 操作可选，默认 'code'）"},
                "old_string": {"type": "string", "description": "要替换的原始文本（edit 操作必需）"},
                "new_string": {"type": "string", "description": "替换后的新文本（edit 操作必需）"},
                "purpose": {"type": "string", "description": "分析意图（extract 操作必需，描述你想从工作板中获取什么信息）"}
            },
            "required": ["operation"]
        },
        "handler": _dispatch,
        "toolset": "aether-cards",
    },
]
