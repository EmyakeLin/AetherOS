"""
AetherOS 统一 LLM 服务
所有应用通过此服务调用 LLM，统一绕过系统代理、统一追踪调用。
"""

import json
import asyncio
import queue
import re
from pathlib import Path
from typing import AsyncGenerator, Optional


class LLMService:
    """统一 LLM 服务 — 管理 provider 配置、客户端创建、模型调用。"""

    CONFIG_PATH = Path.home() / ".aetheros" / "llm" / "config.json"

    def __init__(self):
        self._config: dict = {"providers": [], "default_chat_model": "", "default_image_model": ""}
        self._clients: dict = {}  # provider_id -> client
        self._inline_clients: dict = {}  # (api_key, api_base) -> client
        self._load_config()

    # ── 配置管理 ──────────────────────────────────────────────

    def _load_config(self):
        if self.CONFIG_PATH.exists():
            try:
                self._config = json.loads(self.CONFIG_PATH.read_text(encoding="utf-8"))
            except Exception:
                pass

    def _save_config(self):
        self.CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.CONFIG_PATH.write_text(json.dumps(self._config, ensure_ascii=False, indent=2), encoding="utf-8")

    def get_config(self) -> dict:
        """返回配置，API key 脱敏。"""
        import copy
        cfg = copy.deepcopy(self._config)
        for p in cfg.get("providers", []):
            k = p.get("api_key", "")
            if len(k) > 8:
                p["api_key"] = k[:4] + "****" + k[-4:]
        return cfg

    def update_config(self, config: dict):
        """更新并持久化配置，清除失效的客户端缓存。"""
        old_ids = {p["id"] for p in self._config.get("providers", [])}
        self._config = config
        new_ids = {p["id"] for p in config.get("providers", [])}
        for pid in old_ids - new_ids:
            self._clients.pop(pid, None)
        for pid in new_ids:
            self._clients.pop(pid, None)
        self._save_config()

    def list_providers(self) -> list:
        """返回脱敏的 provider 列表。"""
        import copy
        providers = copy.deepcopy(self._config.get("providers", []))
        for p in providers:
            p.pop("api_key", None)
        return providers

    def list_models(self) -> list:
        """返回扁平模型列表，每项含 provider_id, model_id, name, capabilities, provider_name。"""
        models = []
        for p in self._config.get("providers", []):
            for m in p.get("models", []):
                models.append({
                    "provider_id": p["id"],
                    "provider_name": p.get("name", p["id"]),
                    "model_id": m["id"],
                    "ref": f"{p['id']}/{m['id']}",
                    "name": m.get("name", m["id"]),
                    "capabilities": m.get("capabilities", ["text"]),
                    "type": p.get("type", "openai"),
                })
        return models

    # ── 客户端创建（唯一的代理绕过点）────────────────────────

    def _get_or_create_client(self, provider_id: str):
        """从已存储的 provider 创建客户端，统一 proxy=None。"""
        if provider_id in self._clients:
            return self._clients[provider_id]

        prov = next((p for p in self._config.get("providers", []) if p["id"] == provider_id), None)
        if not prov:
            raise ValueError(f"Provider not found: {provider_id}")

        client = self._create_client(prov["api_key"], prov.get("api_base", ""), prov.get("type", "openai"))
        self._clients[provider_id] = client
        return client

    def _get_or_create_inline_client(self, api_key: str, api_base: str = "", model: str = ""):
        """为内联调用创建/缓存客户端（Cards 等自管配置应用使用）。"""
        cache_key = (api_key, api_base)
        if cache_key in self._inline_clients:
            return self._inline_clients[cache_key]

        provider_type = self._resolve_model_type(model, api_key)
        client = self._create_client(api_key, api_base, provider_type)
        self._inline_clients[cache_key] = client
        return client

    def _create_client(self, api_key: str, api_base: str, provider_type: str):
        """创建 SDK 客户端，通过自定义 transport 完全绕过系统代理。"""
        import httpx as _httpx

        # httpx.HTTPTransport(proxy=None) 强制直连，忽略所有代理环境变量
        transport = _httpx.HTTPTransport(proxy=None)
        http_client = _httpx.Client(transport=transport, timeout=60)

        if provider_type == "anthropic":
            import anthropic
            return anthropic.Anthropic(api_key=api_key, http_client=http_client)
        else:
            import openai
            kwargs = {"api_key": api_key, "http_client": http_client}
            if api_base:
                kwargs["base_url"] = api_base
            return openai.OpenAI(**kwargs)

    @staticmethod
    def _resolve_model_type(model: str, api_key: str = "") -> str:
        """根据模型名和 API key 判断 provider 类型。"""
        if "claude" in model.lower():
            return "anthropic"
        if api_key.startswith("sk-ant-"):
            return "anthropic"
        return "openai"

    def _resolve_provider(self, model: str, api_key: str = None, api_base: str = None):
        """解析模型引用，返回 (client, model_id, provider_type)。
        支持 'provider_id/model_id' 引用模式和内联模式。"""
        if api_key:
            # 内联模式
            client = self._get_or_create_inline_client(api_key, api_base, model)
            provider_type = self._resolve_model_type(model, api_key)
            return client, model, provider_type

        # 引用模式
        if "/" in model:
            provider_id, model_id = model.split("/", 1)
        else:
            # 尝试在所有 provider 中查找模型
            provider_id, model_id = self._find_model_provider(model)

        client = self._get_or_create_client(provider_id)
        prov = next(p for p in self._config["providers"] if p["id"] == provider_id)
        return client, model_id, prov.get("type", "openai")

    def _find_model_provider(self, model_id: str) -> tuple:
        """在所有 provider 中查找模型，返回 (provider_id, model_id)。"""
        for p in self._config.get("providers", []):
            for m in p.get("models", []):
                if m["id"] == model_id:
                    return p["id"], model_id
        raise ValueError(f"Model not found in any provider: {model_id}")

    # ── 流式对话 ──────────────────────────────────────────────

    async def chat_stream(self, messages: list, model: str,
                          max_tokens: int = 4096, system: str = None,
                          api_key: str = None, api_base: str = None,
                          **kwargs) -> AsyncGenerator[dict, None]:
        """流式对话。统一输出格式：
        {'type': 'text', 'content': '...'}
        {'type': 'done', 'usage': {...}}
        {'type': 'error', 'message': '...'}
        """
        try:
            client, model_id, provider_type = self._resolve_provider(model, api_key, api_base)
        except Exception as e:
            yield {"type": "error", "message": str(e)}
            return

        try:
            if provider_type == "anthropic":
                async for event in self._stream_anthropic(client, model_id, messages, max_tokens, system):
                    yield event
            else:
                async for event in self._stream_openai(client, model_id, messages, max_tokens, system):
                    yield event
        except Exception as e:
            yield {"type": "error", "message": str(e)}

    async def _stream_anthropic(self, client, model, messages, max_tokens, system):
        chat_msgs = [m for m in messages if m.get("role") != "system"]
        sys_msg = system or next((m["content"] for m in messages if m.get("role") == "system"), None)

        call_kwargs = {"model": model, "max_tokens": max_tokens, "messages": chat_msgs}
        if sys_msg:
            call_kwargs["system"] = sys_msg
        # 启用 thinking（extended thinking）
        call_kwargs["thinking"] = {"type": "enabled", "budget_tokens": 10240}

        q = queue.Queue()
        _SENTINEL = object()

        def _do_stream():
            try:
                with client.messages.stream(**call_kwargs) as stream:
                    for event in stream.events():
                        if event.type == "content_block_delta":
                            if event.delta.type == "thinking_delta":
                                q.put({"type": "thinking", "content": event.delta.thinking})
                            elif event.delta.type == "text_delta":
                                q.put({"type": "text", "content": event.delta.text})
                    final = stream.get_final_message()
                    if final and final.usage:
                        q.put({"type": "done", "usage": {
                            "input_tokens": final.usage.input_tokens,
                            "output_tokens": final.usage.output_tokens,
                            "total_tokens": final.usage.input_tokens + final.usage.output_tokens,
                        }})
                    else:
                        q.put({"type": "done", "usage": {}})
            except Exception as e:
                q.put({"type": "error", "message": str(e)})
            finally:
                q.put(_SENTINEL)

        asyncio.create_task(asyncio.to_thread(_do_stream))

        while True:
            event = await asyncio.get_event_loop().run_in_executor(None, q.get)
            if event is _SENTINEL:
                break
            yield event

    async def _stream_openai(self, client, model, messages, max_tokens, system):
        if system:
            messages = [{"role": "system", "content": system}] + list(messages)

        call_kwargs = {
            "model": model, "messages": messages,
            "max_tokens": max_tokens, "stream": True,
            "stream_options": {"include_usage": True},
        }

        q = queue.Queue()
        _SENTINEL = object()

        def _do_stream():
            try:
                response = client.chat.completions.create(**call_kwargs)
                usage = {}
                for chunk in response:
                    if hasattr(chunk, 'usage') and chunk.usage:
                        usage = {
                            "input_tokens": getattr(chunk.usage, 'prompt_tokens', 0),
                            "output_tokens": getattr(chunk.usage, 'completion_tokens', 0),
                            "total_tokens": getattr(chunk.usage, 'total_tokens', 0),
                        }
                    delta = chunk.choices[0].delta if chunk.choices else None
                    if delta:
                        # reasoning_content（DeepSeek 等）
                        rc = getattr(delta, 'reasoning_content', None)
                        if rc:
                            q.put({"type": "thinking", "content": rc})
                        if delta.content:
                            q.put({"type": "text", "content": delta.content})
                q.put({"type": "done", "usage": usage})
            except Exception as e:
                q.put({"type": "error", "message": str(e)})
            finally:
                q.put(_SENTINEL)

        asyncio.create_task(asyncio.to_thread(_do_stream))

        while True:
            event = await asyncio.get_event_loop().run_in_executor(None, q.get)
            if event is _SENTINEL:
                break
            yield event

    # ── 非流式对话（Agent 引擎用）────────────────────────────

    async def chat(self, messages: list, model: str,
                   tools: list = None, max_tokens: int = 4096,
                   api_key: str = None, api_base: str = None,
                   **kwargs) -> dict:
        """非流式对话，返回 {'content', 'tool_calls', 'usage'}。"""
        try:
            client, model_id, provider_type = self._resolve_provider(model, api_key, api_base)
        except Exception as e:
            return {"content": f"LLM 配置错误: {e}", "tool_calls": [], "usage": {}}

        try:
            if provider_type == "anthropic":
                return await self._call_anthropic(client, model_id, messages, tools, max_tokens)
            else:
                return await self._call_openai(client, model_id, messages, tools, max_tokens)
        except Exception as e:
            return {"content": f"LLM 调用错误: {e}", "tool_calls": [], "usage": {}}

    async def _call_anthropic(self, client, model, messages, tools, max_tokens):
        kwargs = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [m for m in messages if m.get("role") != "system"],
        }
        system = next((m["content"] for m in messages if m.get("role") == "system"), None)
        if system:
            kwargs["system"] = system
        if tools:
            kwargs["tools"] = [self._format_tool_anthropic(t) for t in tools]

        response = await asyncio.to_thread(lambda: client.messages.create(**kwargs))

        result = {"content": "", "tool_calls": [], "usage": {}}
        for block in response.content:
            if block.type == "text":
                result["content"] += block.text
            elif block.type == "tool_use":
                result["tool_calls"].append({
                    "id": block.id,
                    "name": block.name,
                    "arguments": block.input,
                })
        if response.usage:
            result["usage"] = {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
            }
        return result

    async def _call_openai(self, client, model, messages, tools, max_tokens):
        kwargs = {"model": model, "messages": messages, "max_tokens": max_tokens}
        if tools:
            kwargs["tools"] = [self._format_tool_openai(t) for t in tools]
            kwargs["tool_choice"] = "auto"

        response = await asyncio.to_thread(lambda: client.chat.completions.create(**kwargs))

        choice = response.choices[0]
        result = {"content": "", "tool_calls": [], "usage": {}}

        # reasoning_content（DeepSeek 等思考模型必须回传）
        rc = getattr(choice.message, 'reasoning_content', None)
        if rc:
            result["reasoning_content"] = rc

        if choice.message.content:
            result["content"] = choice.message.content

        if choice.message.tool_calls:
            for tc in choice.message.tool_calls:
                args = tc.function.arguments
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except json.JSONDecodeError:
                        args = {}
                result["tool_calls"].append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": args,
                })

        if response.usage:
            result["usage"] = {
                "input_tokens": getattr(response.usage, 'prompt_tokens', 0),
                "output_tokens": getattr(response.usage, 'completion_tokens', 0),
                "total_tokens": response.usage.total_tokens,
            }

        return result

    # ── 图像生成 ──────────────────────────────────────────────

    async def generate_image(self, prompt: str, model: str,
                             api_key: str = None, api_base: str = None,
                             **kwargs) -> dict:
        """图像生成，返回 {'ok': True, 'image_bytes': bytes, 'revised_prompt': str} 或 {'error': '...'}。"""
        try:
            client, model_id, _ = self._resolve_provider(model, api_key, api_base)
        except Exception as e:
            return {"error": str(e)}

        try:
            import httpx as _httpx
            # 图像生成用更长的超时
            if api_key:
                gen_client = self._create_client(api_key, api_base or "", "openai")
            else:
                gen_client = client

            response = await asyncio.to_thread(
                lambda: gen_client.images.generate(model=model_id, prompt=prompt, n=1, size="1024x1024")
            )

            img_data = response.data[0]
            import base64
            if hasattr(img_data, 'b64_json') and img_data.b64_json:
                image_bytes = base64.b64decode(img_data.b64_json)
            elif hasattr(img_data, 'url') and img_data.url:
                import urllib.request
                import io
                buf = io.BytesIO()
                urllib.request.urlretrieve(img_data.url, "/tmp/_aether_img_tmp")
                image_bytes = Path("/tmp/_aether_img_tmp").read_bytes()
            else:
                return {"error": "生成的图片无数据"}

            return {
                "ok": True,
                "image_bytes": image_bytes,
                "revised_prompt": getattr(img_data, 'revised_prompt', ''),
            }
        except Exception as e:
            return {"error": str(e)}

    # ── 工具格式化 ────────────────────────────────────────────

    @staticmethod
    def _format_tool_openai(tool: dict) -> dict:
        return {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool.get("description", ""),
                "parameters": tool.get("parameters", {"type": "object", "properties": {}}),
            }
        }

    @staticmethod
    def _format_tool_anthropic(tool: dict) -> dict:
        return {
            "name": tool["name"],
            "description": tool.get("description", ""),
            "input_schema": tool.get("parameters", {"type": "object", "properties": {}}),
        }
