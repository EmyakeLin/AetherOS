"""
内置工具 — Web Search (DuckDuckGo) + Web Fetch
使用 httpx 直接请求，无额外依赖，兼容 Python 3.8+
"""

import re
import json
import asyncio
import logging
from typing import Any, Dict, List, Optional
from html.parser import HTMLParser

import httpx

logger = logging.getLogger(__name__)

_DDG_URL = "https://html.duckduckgo.com/html/"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

# 正则匹配搜索结果块（跳过广告）
_RESULT_RE = re.compile(
    r'<div[^>]+class="result results_links results_links_deep[^"]*"[^>]*>.*?'
    r'<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>(.*?)</a>.*?'
    r'<a[^>]+class="result__snippet"[^>]*>(.*?)</a>',
    re.DOTALL,
)
_HREF_RE = re.compile(r'uddg=([^&"]+)')
_TAG_RE = re.compile(r'<[^>]+>')


def _strip_tags(html: str) -> str:
    return _TAG_RE.sub("", html).strip()


def _extract_url(raw_href: str) -> str:
    """从 DuckDuckGo 重定向链接中提取真实 URL"""
    m = _HREF_RE.search(raw_href)
    if m:
        from urllib.parse import unquote
        return unquote(m.group(1))
    return raw_href


def _parse_results(html: str, limit: int) -> List[Dict[str, Any]]:
    """解析 DuckDuckGo HTML 搜索结果（过滤广告）"""
    results = []
    for m in _RESULT_RE.finditer(html):
        if len(results) >= limit:
            break
        raw_href, title_html, snippet_html = m.groups()
        url = _extract_url(raw_href)
        # 跳过 DuckDuckGo 广告追踪链接
        if "duckduckgo.com/y.js" in url:
            continue
        results.append({
            "title": _strip_tags(title_html),
            "url": url,
            "description": _strip_tags(snippet_html),
            "position": len(results) + 1,
        })
    return results


def _ddgs_search_sync(query: str, limit: int) -> Dict[str, Any]:
    """同步 DuckDuckGo 搜索"""
    try:
        # 优先使用 HTTP 代理（httpx 原生支持），避免 SOCKS 兼容问题
        import os
        proxy = os.environ.get("http_proxy") or os.environ.get("https_proxy") or None
        if proxy and proxy.startswith("socks"):
            proxy = None  # httpx 不支持 SOCKS，降级为直连
        with httpx.Client(timeout=15.0, follow_redirects=True, proxy=proxy) as client:
            resp = client.post(_DDG_URL, data={"q": query}, headers=_HEADERS)
            resp.raise_for_status()
            results = _parse_results(resp.text, limit)
            if not results:
                return {"success": False, "error": "未找到搜索结果"}
            return {"success": True, "data": {"web": results}}
    except httpx.HTTPStatusError as e:
        logger.warning("DuckDuckGo HTTP 错误: %s", e)
        return {"success": False, "error": f"HTTP 错误: {e.response.status_code}"}
    except Exception as e:
        logger.warning("DuckDuckGo 搜索失败: %s", e)
        return {"success": False, "error": f"搜索失败: {e}"}


async def _web_search(params: dict) -> str:
    query = params.get("query", "")
    if not query:
        return json.dumps({"success": False, "error": "query 参数不能为空"}, ensure_ascii=False)

    limit = params.get("limit", 5)
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = 5
    limit = max(1, min(limit, 20))

    result = await asyncio.to_thread(_ddgs_search_sync, query, limit)
    return json.dumps(result, ensure_ascii=False)


# ── Web Fetch: 网页内容提取 ──────────────────────────────────────────────────

class _HTMLTextExtractor(HTMLParser):
    """从 HTML 中提取纯文本，跳过 script/style 标签"""

    _SKIP_TAGS = {"script", "style", "noscript", "svg", "iframe"}

    def __init__(self):
        super().__init__()
        self._parts: List[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs):
        if tag in self._SKIP_TAGS:
            self._skip_depth += 1

    def handle_endtag(self, tag: str):
        if tag in self._SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str):
        if self._skip_depth == 0:
            text = data.strip()
            if text:
                self._parts.append(text)

    def get_text(self) -> str:
        return "\n".join(self._parts)


def _extract_text_from_html(html: str, max_chars: int = 10000) -> str:
    """从 HTML 中提取纯文本"""
    # 提取 title
    title_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
    title = title_m.group(1).strip() if title_m else ""

    # 提取正文
    extractor = _HTMLTextExtractor()
    try:
        extractor.feed(html)
    except Exception:
        pass
    body = extractor.get_text()

    # 合并并截断
    result = f"{title}\n\n{body}".strip() if title else body
    if len(result) > max_chars:
        result = result[:max_chars] + f"\n\n[... 内容截断，共 {len(body)} 字符]"
    return result


def _web_fetch_sync(url: str, max_chars: int) -> Dict[str, Any]:
    """同步获取网页内容"""
    try:
        import os
        proxy = os.environ.get("http_proxy") or os.environ.get("https_proxy") or None
        if proxy and proxy.startswith("socks"):
            proxy = None
        with httpx.Client(timeout=20.0, follow_redirects=True, proxy=proxy) as client:
            resp = client.get(url, headers=_HEADERS)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "text/html" in content_type or "text/plain" in content_type or not content_type:
                text = _extract_text_from_html(resp.text, max_chars)
            else:
                text = f"[非文本内容: {content_type}]"
            return {
                "success": True,
                "data": {
                    "url": str(resp.url),
                    "content": text,
                },
            }
    except httpx.HTTPStatusError as e:
        return {"success": False, "error": f"HTTP 错误: {e.response.status_code}"}
    except Exception as e:
        logger.warning("网页获取失败 %s: %s", url, e)
        return {"success": False, "error": f"获取失败: {e}"}


async def _web_fetch(params: dict) -> str:
    url = params.get("url", "")
    if not url:
        return json.dumps({"success": False, "error": "url 参数不能为空"}, ensure_ascii=False)

    max_chars = params.get("max_chars", 10000)
    try:
        max_chars = int(max_chars)
    except (TypeError, ValueError):
        max_chars = 10000
    max_chars = max(1000, min(max_chars, 50000))

    result = await asyncio.to_thread(_web_fetch_sync, url, max_chars)
    return json.dumps(result, ensure_ascii=False)


TOOL_SCHEMAS = [
    {
        "name": "web_search",
        "description": "搜索网页信息，返回标题、链接和摘要。免费、无需 API Key。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索关键词",
                },
                "limit": {
                    "type": "integer",
                    "description": "返回结果数量，默认 5，最大 20",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
        "handler": _web_search,
        "toolset": "web",
    },
    {
        "name": "web_fetch",
        "description": "获取网页内容，返回纯文本。支持 HTML 页面，自动提取正文并去除 script/style 等无关标签。",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "要获取的网页 URL",
                },
                "max_chars": {
                    "type": "integer",
                    "description": "返回内容最大字符数，默认 10000，最大 50000",
                    "default": 10000,
                },
            },
            "required": ["url"],
        },
        "handler": _web_fetch,
        "toolset": "web",
    },
]
