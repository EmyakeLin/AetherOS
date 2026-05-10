"""
内置工具 — 精确文件编辑
patch — 查找并替换文件中的指定文本
"""

from pathlib import Path


async def _patch(params: dict) -> str:
    path = params.get("path", "")
    old_text = params.get("old_text", "")
    new_text = params.get("new_text", "")

    if not path:
        return "错误: 未指定路径"
    if not old_text:
        return "错误: 未指定要替换的文本 (old_text)"

    try:
        p = Path(path).expanduser()
        if not p.exists():
            return f"错误: 文件不存在: {path}"

        content = p.read_text(encoding="utf-8", errors="replace")

        # 唯一性检查
        count = content.count(old_text)
        if count == 0:
            return f"错误: 在 {path} 中未找到要替换的文本"
        if count > 1:
            return f"错误: 在 {path} 中找到 {count} 处匹配，请提供更多上下文使匹配唯一"

        # 替换
        new_content = content.replace(old_text, new_text, 1)
        p.write_text(new_content, encoding="utf-8")

        # 计算行号
        before = content[:content.index(old_text)]
        line_no = before.count('\n') + 1
        lines_affected = old_text.count('\n') + 1

        return f"已修改: {path} (第 {line_no} 行, 替换了 {lines_affected} 行)"

    except Exception as e:
        return f"错误: {e}"


TOOL_SCHEMAS = [
    {
        "name": "patch",
        "description": "精确编辑文件：查找并替换指定文本（要求匹配唯一）",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径"},
                "old_text": {"type": "string", "description": "要替换的原始文本（必须在文件中唯一）"},
                "new_text": {"type": "string", "description": "替换后的新文本"}
            },
            "required": ["path", "old_text", "new_text"]
        },
        "handler": _patch,
        "toolset": "file",
    },
]
