# AetherOS 统一 LLM 接口 API 文档

> 供 AI Agent 及应用开发者使用的完整参考。所有 LLM 调用通过此接口进行，系统自动绕过代理并追踪调用状态。

---

## 目录

- [概述](#概述)
- [两种调用模式](#两种调用模式)
- [前端 API（os.llm）](#前端-apiosllm)
  - [os.llm.chat()](#osllmchat)
  - [os.llm.generateImage()](#osllmgenerateimage)
  - [os.llm.getProviders()](#osllmgetproviders)
  - [os.llm.getModels()](#osllmgetmodels)
  - [os.llm.getConfig()](#osllmgetconfig)
  - [os.llm.updateConfig()](#osllmupdateconfig)
- [后端 REST API](#后端-rest-api)
  - [POST /api/llm/chat](#post-apillmchat)
  - [POST /api/llm/generate-image](#post-apillmgenerate-image)
  - [GET /api/llm/config](#get-apillmconfig)
  - [PUT /api/llm/config](#put-apillmconfig)
  - [GET /api/llm/providers](#get-apillmproviders)
  - [GET /api/llm/models](#get-apillmmodels)
- [配置文件格式](#配置文件格式)
- [SSE 流式响应格式](#sse-流式响应格式)
- [完整示例](#完整示例)

---

## 概述

AetherOS 提供统一的 LLM 调用接口，所有应用（Cards、Agent、自定义应用等）通过同一套 API 调用模型。

**核心特性：**
- 自动绕过系统代理（`httpx.Client(proxy=None)`）
- 支持 Anthropic 和 OpenAI 兼容两种 provider 类型
- 侧边栏实时追踪所有模型调用状态
- 支持流式对话（SSE）和非流式调用
- 支持图像生成

---

## 两种调用模式

### 引用模式（使用全局配置）

模型通过 Settings 应用统一配置，调用时只需传 `provider_id/model_id` 格式的模型引用。

```javascript
await os.llm.chat({
    model: 'openai-main/gpt-4o',    // provider_id/model_id
    messages: [{ role: 'user', content: '你好' }],
    appId: 'my-app',
    onText: (content) => console.log(content),
});
```

适用场景：Agent 应用、使用全局配置的应用。

### 内联模式（应用自管配置）

应用自行管理 API Key 和配置，调用时在请求中直接传入。

```javascript
await os.llm.chat({
    model: 'gpt-4o',                // 模型名（非 provider_id/model_id 格式）
    apiKey: 'sk-...',               // 直接传入 API Key
    apiBase: 'https://api.openai.com/v1',  // 可选
    messages: [{ role: 'user', content: '你好' }],
    appId: 'cards',
    onText: (content) => console.log(content),
});
```

适用场景：Cards 应用等需要独立管理模型配置的应用。

**判断规则：** 如果请求中包含 `apiKey` 字段，走内联模式；否则走引用模式。

---

## 前端 API（os.llm）

在应用的 `factory(container, win, os)` 中通过 `os.llm` 访问。所有调用自动在侧边栏「模型调用」面板中注册追踪。

---

### os.llm.chat()

流式对话，返回 `Promise<string>`（调用 ID）。

**参数：** `options` 对象

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `messages` | `Array` | 是 | 消息数组，格式见下方 |
| `model` | `string` | 是 | 模型引用（`provider_id/model_id`）或模型名 |
| `apiKey` | `string` | 否 | 内联 API Key（内联模式） |
| `apiBase` | `string` | 否 | 内联 API Base URL（内联模式） |
| `appId` | `string` | 否 | 调用来源标识，显示在侧边栏，默认 `'unknown'` |
| `onText` | `function` | 否 | 流式文本回调 `(content: string) => void` |
| `onDone` | `function` | 否 | 完成回调 `(data: {type, usage}) => void` |
| `onError` | `function` | 否 | 错误回调 `(message: string) => void` |
| `maxTokens` | `number` | 否 | 最大生成 token 数，默认 `4096` |
| `system` | `string` | 否 | 系统提示词 |

**messages 格式：**

```javascript
// 纯文本
[{ role: 'user', content: '你好' }]

// 多轮对话
[
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '你好！有什么可以帮你？' },
    { role: 'user', content: '解释量子计算' },
]

// 多模态（含图片，仅部分模型支持）
[{
    role: 'user',
    content: [
        { type: 'text', text: '这张图片是什么？' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '...' } },
    ]
}]
```

**返回值：** `string` — 调用 ID（如 `'llm-1715001234567-a3x2'`），可用于后续追踪。

**示例：**

```javascript
registerApp('my-chat', {
    title: '我的对话',
    icon: '💬',
    factory: (container, win, os) => {
        container.innerHTML = '<div id="output" style="padding:16px;"></div>';
        const output = container.querySelector('#output');

        async function ask(question) {
            const p = document.createElement('div');
            output.appendChild(p);

            await os.llm.chat({
                model: 'openai-main/gpt-4o',
                messages: [{ role: 'user', content: question }],
                appId: 'my-chat',
                maxTokens: 2048,
                system: '你是一个有帮助的助手。',
                onText: (content) => { p.textContent += content; },
                onDone: () => { p.style.color = 'var(--accent)'; },
                onError: (msg) => { p.textContent = '错误: ' + msg; p.style.color = 'var(--accent-warm)'; },
            });
        }

        ask('你好，介绍一下 AetherOS');
    }
});
```

---

### os.llm.generateImage()

图像生成，返回 `Promise<Object>`。

**参数：** `options` 对象

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | `string` | 是 | 图像描述提示词 |
| `model` | `string` | 是 | 模型引用或模型名 |
| `apiKey` | `string` | 否 | 内联 API Key |
| `apiBase` | `string` | 否 | 内联 API Base URL |
| `appId` | `string` | 否 | 调用来源标识 |

**返回值：**

成功时：
```json
{ "ok": true, "filename": "gen-a1b2c3d4.png", "revised_prompt": "..." }
```

失败时：
```json
{ "error": "错误信息" }
```

**示例：**

```javascript
const result = await os.llm.generateImage({
    prompt: '赛博朋克风格的城市夜景',
    model: 'openai-main/dall-e-3',
    appId: 'my-app',
});
if (result.ok) {
    console.log('图片已保存:', result.filename);
}
```

---

### os.llm.getProviders()

获取已配置的 provider 列表（API Key 已脱敏），返回 `Promise<Array>`。

```javascript
const providers = await os.llm.getProviders();
// [
//   { id: 'openai-main', name: 'OpenAI', type: 'openai', models: [...] },
//   { id: 'anthropic-main', name: 'Anthropic', type: 'anthropic', models: [...] },
// ]
```

---

### os.llm.getModels()

获取扁平模型列表，返回 `Promise<Array>`。适合用于构建模型选择器。

```javascript
const models = await os.llm.getModels();
// [
//   {
//     provider_id: 'openai-main',
//     provider_name: 'OpenAI',
//     model_id: 'gpt-4o',
//     ref: 'openai-main/gpt-4o',
//     name: 'GPT-4o',
//     capabilities: ['text', 'vision'],
//     type: 'openai'
//   },
//   ...
// ]
```

**构建模型选择器示例：**

```javascript
const models = await os.llm.getModels();
const select = document.createElement('select');
models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.ref;
    opt.textContent = `${m.provider_name} / ${m.name}`;
    select.appendChild(opt);
});
```

---

### os.llm.getConfig()

获取完整 LLM 配置（API Key 脱敏），返回 `Promise<Object>`。

```javascript
const config = await os.llm.getConfig();
// {
//   providers: [...],
//   default_chat_model: 'openai-main/gpt-4o',
//   default_image_model: 'openai-main/dall-e-3',
// }
```

---

### os.llm.updateConfig(config)

更新 LLM 配置，返回 `Promise<Object>`。

```javascript
const config = await os.llm.getConfig();
config.providers.push({
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'openai',
    api_key: 'sk-...',
    api_base: 'https://api.deepseek.com/v1',
    models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat', capabilities: ['text'] }],
});
await os.llm.updateConfig(config);
```

---

### os.llm.invalidateCache()

清除 providers 和 models 的前端缓存。调用 `updateConfig()` 时会自动清除。

```javascript
os.llm.invalidateCache();
```

---

## 后端 REST API

所有端点的基础路径为服务器地址（默认 `http://localhost:8000`）。

---

### POST /api/llm/chat

流式对话（SSE）。

**请求体：**

```json
{
    "model": "openai-main/gpt-4o",
    "messages": [
        { "role": "user", "content": "你好" }
    ],
    "max_tokens": 4096,
    "system": "你是一个有帮助的助手。",
    "api_key": "",
    "api_base": ""
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | `string` | 是 | `provider_id/model_id` 格式（引用模式）或模型名（内联模式） |
| `messages` | `array` | 是 | 消息数组 |
| `max_tokens` | `number` | 否 | 最大生成 token 数，默认 4096 |
| `system` | `string` | 否 | 系统提示词 |
| `api_key` | `string` | 条件 | 内联模式必填。引用模式时不传或传空 |
| `api_base` | `string` | 否 | 内联模式的 API Base URL |

**响应：** `Content-Type: text/event-stream`

SSE 事件流，格式见 [SSE 流式响应格式](#sse-流式响应格式)。

**错误响应（HTTP 400）：**

```json
{ "error": "内联模式需要 api_key，或使用 provider_id/model_id 格式" }
```

---

### POST /api/llm/generate-image

图像生成。

**请求体：**

```json
{
    "model": "openai-main/dall-e-3",
    "prompt": "赛博朋克风格的城市夜景",
    "api_key": "",
    "api_base": ""
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | `string` | 是 | 模型引用或模型名 |
| `prompt` | `string` | 是 | 图像描述提示词 |
| `api_key` | `string` | 条件 | 内联模式必填 |
| `api_base` | `string` | 否 | 内联模式的 API Base URL |

**成功响应：**

```json
{
    "ok": true,
    "filename": "gen-a1b2c3d4.png",
    "revised_prompt": "A cyberpunk cityscape at night..."
}
```

**错误响应（HTTP 400）：**

```json
{ "error": "错误信息" }
```

---

### GET /api/llm/config

获取 LLM 配置（API Key 脱敏）。

**响应：**

```json
{
    "providers": [
        {
            "id": "openai-main",
            "name": "OpenAI",
            "type": "openai",
            "api_key": "sk-12****abcd",
            "api_base": "",
            "models": [
                { "id": "gpt-4o", "name": "GPT-4o", "capabilities": ["text", "vision"] }
            ]
        }
    ],
    "default_chat_model": "openai-main/gpt-4o",
    "default_image_model": "openai-main/dall-e-3"
}
```

---

### PUT /api/llm/config

更新 LLM 配置。传入完整的配置对象，会覆盖现有配置。

**请求体：** 与 `GET /api/llm/config` 响应结构相同（`api_key` 传完整值，不传脱敏值）。

**响应：**

```json
{ "ok": true }
```

---

### GET /api/llm/providers

获取 provider 列表（不含 API Key）。

**响应：**

```json
[
    {
        "id": "openai-main",
        "name": "OpenAI",
        "type": "openai",
        "models": [
            { "id": "gpt-4o", "name": "GPT-4o", "capabilities": ["text", "vision"] }
        ]
    }
]
```

---

### GET /api/llm/models

获取扁平模型列表。

**响应：**

```json
[
    {
        "provider_id": "openai-main",
        "provider_name": "OpenAI",
        "model_id": "gpt-4o",
        "ref": "openai-main/gpt-4o",
        "name": "GPT-4o",
        "capabilities": ["text", "vision"],
        "type": "openai"
    }
]
```

---

## 配置文件格式

配置存储在 `~/.aether/llm/config.json`：

```json
{
    "providers": [
        {
            "id": "openai-main",
            "name": "OpenAI",
            "type": "openai",
            "api_key": "sk-...",
            "api_base": "",
            "models": [
                { "id": "gpt-4o", "name": "GPT-4o", "capabilities": ["text", "vision"] },
                { "id": "dall-e-3", "name": "DALL-E 3", "capabilities": ["image"] }
            ]
        },
        {
            "id": "anthropic-main",
            "name": "Anthropic",
            "type": "anthropic",
            "api_key": "sk-ant-...",
            "api_base": "",
            "models": [
                { "id": "claude-sonnet-4-20250514", "name": "Claude Sonnet", "capabilities": ["text", "vision"] }
            ]
        },
        {
            "id": "deepseek",
            "name": "DeepSeek",
            "type": "openai",
            "api_key": "sk-...",
            "api_base": "https://api.deepseek.com/v1",
            "models": [
                { "id": "deepseek-chat", "name": "DeepSeek Chat", "capabilities": ["text"] }
            ]
        }
    ],
    "default_chat_model": "openai-main/gpt-4o",
    "default_image_model": "openai-main/dall-e-3"
}
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `providers[].id` | 唯一标识，用于 `provider_id/model_id` 引用 |
| `providers[].name` | 显示名称 |
| `providers[].type` | `"openai"` 或 `"anthropic"` |
| `providers[].api_key` | API 密钥 |
| `providers[].api_base` | 自定义端点 URL，留空使用官方默认 |
| `providers[].models[].id` | 模型 ID，传给 SDK |
| `providers[].models[].name` | 显示名称 |
| `providers[].models[].capabilities` | `["text"]`、`["text","vision"]`、`["image"]` 等 |

---

## SSE 流式响应格式

`POST /api/llm/chat` 返回 `text/event-stream`，每个事件以 `data: ` 前缀的 JSON 行：

```
data: {"type":"text","content":"你好"}

data: {"type":"text","content":"！有什么"}

data: {"type":"text","content":"可以帮你的？"}

data: {"type":"done","usage":{"input_tokens":12,"output_tokens":15,"total_tokens":27}}
```

**事件类型：**

| type | 字段 | 说明 |
|------|------|------|
| `text` | `content` | 流式生成的文本片段，拼接即为完整回复 |
| `done` | `usage` | 调用完成，含 token 用量 |
| `error` | `message` | 错误信息 |

**手动解析 SSE 示例：**

```javascript
const resp = await fetch('/api/llm/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        model: 'openai-main/gpt-4o',
        messages: [{ role: 'user', content: '你好' }],
    }),
});

const reader = resp.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let fullText = '';

while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const d = JSON.parse(line.slice(6));
        if (d.type === 'text') fullText += d.content;
        if (d.type === 'done') console.log('完成，tokens:', d.usage.total_tokens);
        if (d.type === 'error') console.error(d.message);
    }
}
```

---

## 完整示例

### 示例 1：最小对话应用

```javascript
registerApp('chat-demo', {
    title: '对话演示',
    icon: '💬',
    factory: (container, win, os) => {
        container.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;">
                <div id="msgs" style="flex:1;overflow-y:auto;padding:16px;"></div>
                <div style="display:flex;padding:8px;border-top:1px solid var(--border);">
                    <input id="input" style="flex:1;" placeholder="输入消息..." />
                    <button id="send">发送</button>
                </div>
            </div>
        `;
        const msgs = container.querySelector('#msgs');
        const input = container.querySelector('#input');

        container.querySelector('#send').onclick = async () => {
            const text = input.value.trim();
            if (!text) return;
            input.value = '';

            // 用户消息
            const userDiv = document.createElement('div');
            userDiv.textContent = '你: ' + text;
            msgs.appendChild(userDiv);

            // AI 回复
            const aiDiv = document.createElement('div');
            aiDiv.textContent = 'AI: ';
            msgs.appendChild(aiDiv);

            await os.llm.chat({
                model: 'openai-main/gpt-4o',
                messages: [{ role: 'user', content: text }],
                appId: 'chat-demo',
                onText: (content) => { aiDiv.textContent += content; },
                onError: (msg) => { aiDiv.textContent = '错误: ' + msg; },
            });
        };
    }
});
```

### 示例 2：内联模式（自管 API Key）

```javascript
registerApp('inline-chat', {
    title: '自管对话',
    icon: '🔑',
    factory: (container, win, os) => {
        // 应用自行管理 API Key
        const MY_API_KEY = 'sk-your-key-here';
        const MY_MODEL = 'deepseek-chat';
        const MY_BASE = 'https://api.deepseek.com/v1';

        async function ask(question) {
            const result = { text: '' };
            await os.llm.chat({
                model: MY_MODEL,
                apiKey: MY_API_KEY,
                apiBase: MY_BASE,
                appId: 'inline-chat',
                messages: [{ role: 'user', content: question }],
                onText: (content) => { result.text += content; },
            });
            return result.text;
        }

        // ... 使用 ask() 构建 UI
    }
});
```

### 示例 3：使用 os.api 直接调用后端

```javascript
// 不经过 os.llm，直接调 REST API（适合非浏览器环境或需要更多控制时）
async function directChat(model, messages) {
    const resp = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages }),
    });
    // ... 解析 SSE 流
}

// 获取可用模型列表
const models = await os.api('GET', '/api/llm/models');
```

### 示例 4：构建模型选择器

```javascript
async function renderModelSelector(container, os) {
    const models = await os.llm.getModels();
    const select = document.createElement('select');
    select.style.cssText = 'background:var(--bg-elevated);border:1px solid var(--border);padding:6px 10px;color:var(--text-primary);font-size:12px;';

    // 按 provider 分组
    const grouped = {};
    models.forEach(m => {
        if (!grouped[m.provider_name]) grouped[m.provider_name] = [];
        grouped[m.provider_name].push(m);
    });

    Object.entries(grouped).forEach(([provider, ms]) => {
        const group = document.createElement('optgroup');
        group.label = provider;
        ms.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.ref;
            opt.textContent = m.name + (m.capabilities.includes('vision') ? ' 👁' : '');
            group.appendChild(opt);
        });
        select.appendChild(group);
    });

    container.appendChild(select);
    return select; // select.value 即为 ref（如 "openai-main/gpt-4o"）
}
```
