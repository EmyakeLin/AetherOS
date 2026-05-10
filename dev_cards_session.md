# 灵感卡片应用开发记录

**开发日期**：2026-05-10
**应用版本**：v2
**涉及文件**：新增 3 个，修改 3 个

---

## 一、应用概述

灵感卡片（Inspiration Cards）是 AetherOS 的画布式创意工具应用。核心功能：

- 无限画布上放置可自由拖拽的灵感卡片
- 每张卡片支持封面图、文本内容、图片附件
- 双击卡片展开详情编辑（文本 + LLM 对话 + 图片管理）
- 卡片可窗口化弹出，窗口内外观与画布完全一致
- 内置 LLM 配置系统，支持文本模型和文生图模型
- LLM 对话独立于系统 Agent 引擎，直接 HTTP 调用，支持 OS 追踪

---

## 二、文件清单

### 新增文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `static/apps/cards/app.json` | 15 | 应用清单（OS 自动发现） |
| `static/apps/cards/cards.js` | ~1265 | 前端应用主体 |
| `static/apps/cards/icon.svg` | 42 | 应用图标（与其他 SVG 统一风格） |

### 修改文件

| 文件 | 变更 |
|------|------|
| `server.py` | +6 个端点 + 1 个静态挂载（见下方） |
| `agent/context.py` | 多模态 array content 支持 |
| `agent/engine.py` | 修复代理 `socks://` scheme 问题 |

---

## 三、后端新增 API（server.py）

### 卡片数据

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/cards/load` | GET | 加载卡片数据（`~/.aether/cards/cards.json`） |
| `/api/cards/save` | PUT | 保存卡片数据（JSON body） |

### LLM 配置

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/cards/config` | GET | 加载 LLM 配置（`~/.aether/cards/config.json`） |
| `/api/cards/config` | PUT | 保存 LLM 配置 |

### LLM 调用

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/cards/chat` | POST | 流式文本 LLM 对话（SSE），支持 Anthropic / OpenAI-compatible |
| `/api/cards/generate-image` | POST | 文生图调用，自动保存图片到存储目录 |

### 图片服务

| 端点 | 说明 |
|------|------|
| `/api/cards/upload` | POST，multipart 上传图片 |
| `/cards-images/{filename}` | 静态文件挂载，图片直接访问 |

### 请求格式示例

**`/api/cards/chat`（SSE 流式）**：
```json
{
    "messages": [{"role": "user", "content": "..."}],
    "model": "gpt-4",
    "api_key": "sk-xxx",
    "api_base": "https://api.openai.com/v1",
    "multimodal": false
}
```
返回 `text/event-stream`，事件格式：
```
data: {"type": "text", "content": "token..."}
data: {"type": "done"}
data: {"type": "error", "message": "..."}
```

**`/api/cards/generate-image`**：
```json
{
    "prompt": "a cat in space",
    "model": "dall-e-3",
    "api_key": "sk-xxx",
    "api_base": ""
}
```
返回：`{"ok": true, "filename": "gen-xxxxxxxx.png", "revised_prompt": "..."}`

---

## 四、数据模型

### 卡片对象

```json
{
    "id": "card-{timestamp}-{random}",
    "title": "标题",
    "content": "markdown 文本内容",
    "images": ["filename1.png", "filename2.jpg"],
    "coverImage": "filename1.png",
    "ratio": [2, 3],
    "position": { "x": 200, "y": 300 },
    "size": { "w": 200, "h": 300 },
    "windowed": false,
    "created": 1715300000000,
    "updated": 1715300000000
}
```

### 持久化格式（`~/.aether/cards/cards.json`）

```json
{
    "version": 2,
    "canvas": { "offsetX": 0, "offsetY": 0, "zoom": 1 },
    "cards": [ ... ]
}
```

### LLM 配置格式（`~/.aether/cards/config.json`）

```json
{
    "textModels": [
        {
            "name": "OpenAI",
            "apiKey": "sk-xxx",
            "apiBase": "",
            "models": [
                { "name": "gpt-4o", "multimodal": true },
                { "name": "gpt-4o-mini", "multimodal": false }
            ]
        }
    ],
    "imageModels": [
        {
            "name": "OpenAI",
            "apiKey": "sk-xxx",
            "apiBase": "",
            "models": [
                { "name": "dall-e-3" }
            ]
        }
    ]
}
```

### 存储路径

- `~/.aether/cards/cards.json` — 卡片数据
- `~/.aether/cards/config.json` — LLM 模型配置
- `~/.aether/cards/images/` — 图片文件（含上传和 AI 生成）

---

## 五、前端架构（cards.js）

### 画布层

- **平移**：mousedown 背景拖拽 → `transform: translate(x,y) scale(z)`
- **缩放**：wheel 事件，以鼠标为中心，范围 0.15~4.0
- **网格**：CSS `radial-gradient` 点阵，间距随 zoom 缩放，`GRID_SIZE=20`
- **坐标系**：卡片 position 为世界坐标，canvasOffset/canvasZoom 控制视图变换

### 卡片渲染

- 默认比例 `2:3`（200x300），`ratio` 字段可扩展
- 封面图显示在标题下方，占卡片高度约 45%
- 内容预览截取前 200 字符
- 图片缩略条最多显示 5 张，超出显示 `+N`
- 选中态：`border-color: var(--accent)` + 发光阴影

### 选中框与 8 点缩放

选中卡片时在画布坐标系外渲染独立的选择框层：

```
nw ─── n ─── ne
│              │
w       ·      e
│              │
sw ─── s ─── se
```

- 8 个 `.sel-handle` 空心圆环，`pointer-events: all`
- 拖拽时实时更新卡片 position/size，自动保持 `ratio` 比例
- 所有尺寸对齐 `GRID_SIZE=20` 网格（`snap()` 函数）
- 选择框在 detail overlay 打开或卡片窗口化时隐藏

### 窗口化

- 点击卡片标题栏弹出按钮 → `popoutCard(cardId)`
- 注册动态 app `cards-win-{cardId}`（`dock: false`）
- 窗口内使用 `renderWindowedCard()` 渲染，与画布 `renderCard()` 结构一致
- 外层 flex 容器居中，卡片使用 `aspect-ratio` 保持比例
- 双击窗口化卡片 → `openDetailInWindow()`，窗口平滑扩大，显示详情编辑界面
- 「返回」按钮平滑恢复窗口尺寸，回到卡片视图

### 详情视图

主 overlay 和窗口化卡片共享相同的布局：

```
+------------------------------------------+
|  [← 返回]  标题: [可编辑]                  |
+-------------------+----------------------+
|  文本编辑          |  LLM 对话             |
|  (textarea)        |  [模型选择器 ▼]       |
|                    |  消息流               |
|                    |  [输入框] [发送]       |
+-------------------+----------------------+
|  图片区 [缩略图...] [+ 添加图片]           |
+------------------------------------------+
```

- 文本区 `oninput` debounce 500ms 保存
- 图片悬停显示「设为封面」按钮
- 右键图片可移除

### LLM 对话系统

**不走系统 Agent 引擎**，独立 HTTP 调用：

1. `sendChatMessage()` 根据模型类型分发：
   - `text` → `sendTextChat()` → `POST /api/cards/chat`（SSE 流式）
   - `img` → `sendImageGen()` → `POST /api/cards/generate-image`

2. 流式响应解析：逐行读取 `data: {...}` 事件
3. 多模态：`@filename` 引用图片 → `buildMultimodal()` 转 base64 content blocks
4. OS 追踪：`os.registerModelCall()` / `os.updateModelCall()` 暴露调用状态

**模型选择器**：
- 从 `CardsLLMConfig` 填充 `<select>`
- 文本模型标注 `[多模态]`，文生图模型带 🎨 前缀
- 选中偏好存 `localStorage('cards-model-pref')`

### LLM 配置面板

工具栏「LLM」按钮打开，左侧导航切换：

- **文本模型**：添加 Provider（名称 + API Key + Base URL）→ 添加模型（名称 + 多模态开关）
- **文生图模型**：同上结构，无多模态开关
- 配置 debounce 500ms → `PUT /api/cards/config`

---

## 六、已修复的技术问题

### 代理 `socks://` scheme 错误

**症状**：LLM 调用时报 `unknown scheme for proxy URL`

**原因**：系统环境变量 `ALL_PROXY=socks://127.0.0.1:7890/`，`httpx` 库自动读取代理变量，但未安装 `socksio` 依赖无法处理 `socks://` scheme

**修复**：创建 OpenAI/Anthropic client 时显式传入 `httpx.Client(proxy=None, timeout=60)`：
- `server.py` — `/api/cards/chat` 和 `/api/cards/generate-image`
- `agent/engine.py` — `_get_client()` 方法

### 多模态消息格式

**问题**：`agent/context.py` 的 `add_message()` / `build_messages()` 只支持 string content

**修复**：改为支持 `str | list`（content blocks），`_sliding_window()` 和 `get_state()` 中对 array content 取 text block 长度之和

---

## 七、应用注册机制

AetherOS 使用 `app.json` 自动发现，**无需手动编辑 `index.html` 或 `os.js`**：

1. `static/apps/cards/app.json` 定义清单
2. OS 启动时 `GET /api/apps` 扫描所有 `app.json`
3. 动态插入 `<script>` 加载 `cards.js`
4. `cards.js` 执行 `registerApp('cards', {...})` 注册到 `AppRegistry`
5. OS `_buildDock()` 自动构建 Dock 项

---

## 八、关键代码位置

| 功能 | 位置 |
|------|------|
| 画布平移/缩放 | `cards.js` `applyTransform()`, `setZoom()`, wheel/mousedown handler |
| 卡片 CRUD | `cards.js` `createCard()`, `deleteCard()`, `renderCard()` |
| 8 点缩放 | `cards.js` `updateSelFrame()`, `handleResize()` |
| 窗口化 | `cards.js` `popoutCard()`, `renderWindowedCard()`, `openDetailInWindow()` |
| LLM 流式对话 | `cards.js` `sendTextChat()` → `server.py` `cards_chat()` |
| 文生图 | `cards.js` `sendImageGen()` → `server.py` `cards_generate_image()` |
| 模型选择器 | `cards.js` `renderModelSelector()`, `getSelectedModel()` |
| LLM 配置面板 | `cards.js` `openLLMPanel()`, `renderLLMSection()` |
| 代理修复 | `server.py` L793/L819, `engine.py` L38/L44 |
| 多模态支持 | `context.py` `add_message()`, `build_messages()`, `_sliding_window()` |
| OS 调用追踪 | `cards.js` `os.registerModelCall()`, `os.updateModelCall()` |

---

## 九、后续可扩展方向

1. **画布性能优化**：卡片数量 >100 时考虑虚拟化渲染
2. **卡片连线**：卡片之间可绘制连接线，形成思维导图
3. **协作功能**：WebSocket 同步多端编辑
4. **导出功能**：卡片内容导出为 Markdown / PDF
5. **标签系统**：卡片添加标签，支持按标签过滤
6. **文生图模型适配**：当前仅支持 OpenAI Images API，可扩展支持其他 provider
