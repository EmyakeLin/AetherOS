"""
内置工具 — 文件搜索
search_files — 在文件中搜索文本内容
"""

import os
import re
from pathlib import Path


async def _search_files(params: dict) -> str:
    pattern = params.get("pattern", "")
    path = params.get("path", ".")
    glob_filter = params.get("glob", "")

    if not pattern:
        return "错误: 未指定搜索模式"

    try:
        search_dir = Path(path).expanduser()
        if not search_dir.is_dir():
            return f"错误: 不是目录: {path}"

        # 编译正则（容错：当作纯文本）
        try:
            regex = re.compile(pattern)
        except re.error:
            regex = re.compile(re.escape(pattern))

        results = []
        file_count = 0
        match_count = 0

        for root, dirs, files in os.walk(search_dir):
            # 跳过隐藏目录和常见无关目录
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in
                       {'node_modules', '__pycache__', '.git', 'venv', '.venv'}]

            for fname in files:
                if glob_filter:
                    from fnmatch import fnmatch
                    if not fnmatch(fname, glob_filter):
                        continue

                fpath = Path(root) / fname
                # 跳过二进制文件
                try:
                    if fpath.stat().st_size > 500 * 1024:
                        continue
                    text = fpath.read_text(encoding="utf-8", errors="ignore")
                except (OSError, PermissionError):
                    continue

                file_count += 1
                for i, line in enumerate(text.splitlines(), 1):
                    if regex.search(line):
                        match_count += 1
                        rel = fpath.relative_to(search_dir)
                        results.append(f"{rel}:{i}: {line.rstrip()}")
                        if match_count >= 200:
                            break
                if match_count >= 200:
                    break
            if match_count >= 200:
                break

        if not results:
            return f"未找到匹配项 (搜索了 {file_count} 个文件)"

        header = f"找到 {match_count} 个匹配" + (" (已达上限)" if match_count >= 200 else "") + f"，搜索了 {file_count} 个文件:\n"
        return header + "\n".join(results)

    except Exception as e:
        return f"错误: {e}"


TOOL_SCHEMAS = [
    {
        "name": "search_files",
        "description": "在文件中搜索文本内容（支持正则表达式）",
        "parameters": {
            "type": "object",
            "properties": {
                "pattern": {"type": "string", "description": "搜索模式（支持正则表达式）"},
                "path": {"type": "string", "description": "搜索目录，默认当前目录"},
                "glob": {"type": "string", "description": "文件名过滤（如 '*.py'）"}
            },
            "required": ["pattern"]
        },
        "handler": _search_files,
        "toolset": "file",
    },
]
