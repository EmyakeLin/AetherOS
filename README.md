# N.O.V.A Aether OS — 架构与使用指南

## 项目概述

AetherOS 是一个**基于浏览器的桌面操作系统**，运行在 Python FastAPI 后端之上，前端使用原生 JavaScript 构建，无需任何编译/打包步骤。它的设计理念是：在浏览器中提供一个完整的类桌面环境，同时深度集成 AI Agent 能力。

### 核心理念

- **零构建** — 前端代码直接作为静态文件服务，修改 JS/CSS 后刷新即可生效
- **全栈 Python 后端** — FastAPI 提供 REST API + WebSocket，统一管理文件系统、终端、LLM 调用、Agent 引擎
- **原生桌面体验** — 窗口管理、任务栏、多桌面、snap 吸附、最小化/全屏，全部手写实现
- **AI 原生** — Agent 引擎是第一公民，支持流式输出、工具调用、会话持久化、上下文管理
- **跨平台兼容** — Linux、macOS、Windows 10+、Windows 7 均可运行

### 快速启动

```bash
git clone https://github.com/EmyakeLin/AetherOS.git
cd AetherOS
./start.sh          # Linux/macOS
# 或
start.bat           # Windows 10+
# 或
start-win7.bat      # Windows 7
```

启动后访问 `http://localhost:8411`。首次运行会自动创建虚拟环境并安装依赖。

---

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    浏览器 (Browser)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │  桌面环境  │ │  AI Agent │ │  终端     │ │  代码编辑器  │ │
│  │  (原生JS)  │ │  (原生JS) │ │ (原生JS)  │ │ (Monaco)   │ │
│  └─────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬─────┘ │
│        │            │            │               │       │
│  ┌─────┴────────────┴────────────┴───────────────┴─────┐ │
│  │               REST API + WebSocket                   │ │
│  └─────────────────────────┬───────────────────────────┘ │
└─────────────────────────────┼────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────┐
│                     FastAPI Server (server.py)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │  文件API  │ │ 终端WS    │ │ LLM服务  │ │ Agent引擎  │  │
│  └──────────┘ └──────────┘ └────┬─────┘ └──────┬─────┘  │
│                                 │               │        │
│  ┌──────────────────────────────┴───────────────┴─────┐  │
│  │              agent/engine.py                        │  │
│  │     CustomAgentEngine — 流式、中断、工具调用        │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                 │
│  ┌──────────────────────┴─────────────────────────────┐  │
│  │  llm/service.py  │  agent/context.py               │  │
│  │  Provider 管理     │  上下文压缩 & Token 统计        │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                 │
│  ┌──────────────────────┴─────────────────────────────┐  │
│  │              Agent 工具层                            │  │
│  │  eos_tools/  │  agent/tools/  │  agent/skills/     │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 关键数据流

| 方向 | 路径 | 说明 |
|------|------|------|
| 用户 → LLM | 前端 → WebSocket → Agent Engine → LLM Service → Provider API | 流式对话 |
| Agent 工具调用 | Agent Engine → 工具执行 → 文件系统/终端 | 文件读写、命令执行 |
| 终端 I/O | 前端 → WebSocket → PTY 进程 | 实时终端交互 |
| Token 统计 | Agent Engine → Context Manager → 前端 Header | 实时上下文占用 |

项目总计 **78 个文件**，约 **4050 个函数/方法节点**，**7131 条调用/包含关系**。后端 Python **61 个文件**，前端 JavaScript **17 个文件**。

---

## 核心桌面系统

### 入口文件

`static/index.html` 是整个 OS 的唯一 HTML 入口。它包含：
- **Boot 动画** — 启动时的六边形 Logo + 进度条动画
- **Menu Bar** — 顶部系统菜单栏（文件/编辑/视图/终端/窗口/帮助）
- **Sidebar** — 左侧可折叠侧边栏，显示模型调用、Agent 面板、窗口预览、自定义面板
- **Desktop** — 窗口容器和 Dock 栏
- **主题预加载** — 通过 `<script>` 标签在页面渲染前设置 `data-theme` 属性，避免闪烁

### OS 控制器 — AetherOS 类

`static/core/os.js` (约 1500 行) 是整个前端的核心，包含 `AetherOS` 类：

```javascript
class AetherOS {
    windows: Map        // 窗口管理 (Map<id, OSWindow>)
    focusedId: string   // 当前聚焦窗口
    theme: string       // 当前主题 (light/dark/kinetic)
    modelCalls: []      // 模型调用追踪
    agentPanels: Map    // Agent 运行面板
    llm: LLMClient      // 统一 LLM 客户端

    boot()              // 启动：加载应用清单 → 恢复布局 → 隐藏 Boot 动画
    openApp(id)         // 打开应用
    focusWindow(id)     // 聚焦窗口
    // Dock、Sidebar、Menu 事件绑定...
}
```

### 窗口管理器 — OSWindow 类

`static/core/window.js` (约 350 行) 实现了完整的窗口系统：

| 功能 | 实现 |
|------|------|
| **拖拽移动** | titlebar mousedown → mousemove 更新位置 |
| **8 向缩放** | 8 个 resize-handle (n/s/e/w/ne/nw/se/sw) |
| **Snap 吸附** | 拖拽到屏幕边缘自动半屏/全屏，带预览区域 |
| **最小化/最大化/关闭** | 窗口控制按钮 + 动画 |
| **Z-Index 管理** | WindowStack 类自动递增 |
| **布局持久化** | 窗口位置/大小通过 debounced 保存到后端 |

### 应用注册系统

应用通过 `registerApp(id, config)` 注册：

```javascript
registerApp('terminal', {
    title: '终端',
    icon: '>_',
    factory: (container, win, os) => { /* 创建应用实例 */ },
    getState: (win) => { /* 获取可持久化状态 */ },
    setState: (state, win, os) => { /* 恢复状态 */ }
});
```

### 前端文件结构

```
static/
├── index.html          # 唯一 HTML 入口
├── core/
│   ├── os.js           # AetherOS 主控制器
│   ├── os.css          # 全局样式（主题变量、布局、动画）
│   └── window.js       # OSWindow 窗口管理器
├── apps/               # 内置应用（每个应用独立目录）
│   ├── agent/          # AI 助手
│   ├── files/          # 文件管理器
│   ├── terminal/       # 终端模拟器
│   ├── ide/            # 代码编辑器
│   ├── browser/        # 浏览器
│   ├── monitor/        # 系统监控
│   ├── settings/       # 系统设置
│   ├── aether-cards/   # 卡片笔记
│   └── drawboard/      # 画板
└── lib/                # 第三方库 (Monaco Editor)
```

---

## 后端架构

### server.py — 统一后端服务

`server.py`（约 1500 行）是整个系统的后端核心，基于 FastAPI 框架。它管理所有 API 路由和 WebSocket 连接。

#### 文件系统 API

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/fs/list` | GET | 列出目录内容 |
| `/api/fs/read` | GET | 读取文件内容（支持 offset/limit） |
| `/api/fs/write` | POST | 完整覆盖写入文件 |
| `/api/fs/edit` | POST | 局部编辑（replace 模式） |
| `/api/fs/mkdir` | POST | 创建目录 |
| `/api/fs/delete` | DELETE | 删除文件/目录 |
| `/api/fs/rename` | POST | 重命名 |
| `/api/fs/search` | POST | 文本搜索（支持正则） |
| `/api/fs/upload` | POST | 文件上传 |

#### 终端 API

| 路由 | 类型 | 说明 |
|------|------|------|
| `/api/tools/exec` | POST | 执行终端命令 |
| `/api/ws/terminal/{session_id}` | WebSocket | PTY 双向通信 |

终端使用 `pty` 模块（Unix）或 `pywinpty`（Windows 7）创建伪终端进程，通过 WebSocket 进行双向 I/O 传输。

#### LLM 服务 API

| 路由 | 类型 | 说明 |
|------|------|------|
| `/api/llm/chat` | POST | 流式对话（SSE） |
| `/api/llm/generate-image` | POST | 图像生成 |
| `/api/llm/config` | GET/POST | 读取/更新 Provider 配置 |
| `/api/llm/providers` | GET | 列出所有 Provider |
| `/api/llm/models` | GET | 列出所有可用模型 |

#### Agent API

| 路由 | 类型 | 说明 |
|------|------|------|
| `/ws/agent/{agent_id}` | WebSocket | 外部 Agent 桥接 |
| `/ws/agent/custom/{agent_id}` | WebSocket | Agent 主通信通道（双 Task 架构） |
| `/api/agent/message` | POST | 同步消息（HTTP fallback） |
| `/api/agent/context` | GET | 获取上下文状态 |
| `/api/agent/context/process` | POST | 调试：查看上下文处理结果 |
| `/api/agent/context/configure` | POST | 配置上下文处理器 |
| `/api/agent/tools` | GET | 列出已注册工具 |
| `/api/agent/tool` | POST | 直接调用工具（调试） |
| `/api/agent/sessions/*` | REST | 会话 CRUD |
| `/api/agent/sessions/*/messages` | REST | 消息历史 |

#### 其他 API

| 路由 | 说明 |
|------|------|
| `/api/apps` | 应用清单管理 |
| `/api/storage/*` | 存储使用统计和管理 |
| `/api/db/{database}/query` | SQLite 数据库查询 |
| `/api/db/{database}/execute` | SQLite 数据库执行 |
| `/api/lsp/available` | LSP 语言服务器状态 |
| `/api/ws/lsp/{language}` | LSP WebSocket 代理 |
| `/api/monitor/*` | 系统监控面板 |
| `/api/perf-mode` | 获取当前性能模式 |
---

## AI Agent 引擎

### CustomAgentEngine

`agent/engine.py` 中的 `CustomAgentEngine` 类是 Agent 的核心引擎。它管理：

- **流式对话** — 通过 WebSocket 实时传输模型输出
- **工具调用** — 解析模型返回的 tool_calls，并行执行，返回结果
- **中断控制** — 用户可随时取消正在进行的对话
- **系统提示词** — 动态构建，支持 Skill 注入
- **上下文管理** — 自动估算 token 用量，调用上下文处理器优化消息列表

```python
class CustomAgentEngine:
    async def run(self, user_message: str) -> AsyncGenerator[dict, None]:
        """Agent 主循环 — 流式输出 + 工具调用 + 中断控制"""
        # 1. 持久化用户消息，从 storage 加载完整对话
        # 2. 上下文处理（EosContextProcessor 压缩 + Token 统计）
        # 3. 调用 LLM Service 流式输出
        # 4. 检测 tool_calls → 并行执行 → 追加结果 → 继续循环
        # 5. 每步 yield 事件到前端（text/thinking/tool_call/tool_result/token_stats/done）
```

### 上下文管理 — ContextProcessor

`agent/context.py` 实现了可插拔的上下文处理管道：

```python
class ContextProcessor(ABC):
    """上下文处理器基类"""
    def process_messages(self, messages: List[Dict]) -> List[Dict]:
        """处理消息列表，返回优化后的列表"""
```

**EosContextProcessor** — 具体的文件上下文管理器：
- **写入保留** — `eos_write_file` 的 content 保留（仅 >400K 字符的超大文件截断），确保 LLM 知道文件当前内容
- **过期标记** — 文件被 write/edit 修改后，之前对该文件的 read 结果被标记为过期（仅过期 write/edit 之前的 read）
- **失败检测** — JSON 解析 + 错误前缀检测，确保失败的工具调用不被误判为成功
- **失败修正** — 通过 `error_fix_id` 标记失败调用已被修正

**Token 估算**（`estimate_tokens`）：1 token ≈ 4 字符的简化算法。

### 会话持久化 — AgentStorage

`agent/storage.py` 使用 **SQLite + JSON** 双格式存储：

| 格式 | 用途 |
|------|------|
| SQLite | 会话元数据、消息索引、快速查询 |
| JSON | 完整消息历史备份、跨版本迁移 |

```python
class AgentStorage:
    async def connect()        # 初始化 SQLite 数据库
    async def create_session() # 创建新会话
    async def get_session()    # 获取会话详情
    async def list_sessions()  # 列出所有会话
    async def delete_session() # 删除会话
    async def append()         # 追加消息到会话
```

### Agent 工具系统

**agent/tools/** — 内置工具集：文件操作工具、代码搜索工具、终端执行工具。

**agent/skills/** — Skill 系统，允许动态注入专业能力到系统提示词中。

**安全机制**：终端工具内置命令黑名单，拦截 rm -rf /、fork bomb、管道下载执行等危险模式。


---

## LLM 统一服务

### LLMService

`llm/service.py` 提供所有应用共享的统一 LLM 调用层：



### Provider 管理

- 支持 **OpenAI 兼容 API** 和 **Anthropic API**
- 配置存储在 `~/.aetheros/llm/config.json`
- 每个 Provider 可配置多个模型，模型可设定 `context_limit`
- 通过 `provider_id/model_id` 引用模型（如 `openai/gpt-4`）
- 支持内联模式：应用直接传入 api_key/api_base，不存储在服务器

### 代理绕过

LLMService 通过自定义 `httpx.HTTPTransport(proxy=None)` 强制直连，完全忽略系统代理环境变量。这是项目中**唯一的代理绕过点**，确保所有 LLM 调用不受系统代理影响。

### 流式输出格式

统一的输出格式，前端可据此渲染不同类型的内容：



---

## Eos-Tools 文件管理工具集

位于 `eos_tools/` 目录，是一组供 Agent 使用的文件操作工具：

| 工具 | 文件 | 说明 |
|------|------|------|
| read_file | read_file.py | 读取文件，支持 offset/limit/trace |
| write_file | write_file.py | 覆盖写入文件 |
| edit_file | edit_file.py | 局部编辑（replace/patch 模式） |
| trace_file | trace_file.py | 控制文件 trace 状态 |

### 设计特点

- **标准返回格式** — 每个工具返回统一的 JSON：`{"status": "ok", "path": "...", ...}`
- **内容 hash** — write_file 返回 SHA256 hash 用于验证
- **错误处理** — 统一返回 `{"status": "error", "error": "..."}`
- **error_fix_id** — 支持标记修正之前的失败调用
- **trace 模式** — 可追踪文件的所有读/写/改操作


---

## 内置应用详解

### AI 助手 (agent)

文件: `static/apps/agent/agent.js`，前端最复杂的应用。
- 通过 WebSocket 与 Agent Engine 通信
- 流式显示模型输出（文本 + 思维链）
- 实时 Token 统计显示在 header 栏（input/output/total + 上下文百分比）
- 多会话管理：切换、创建、删除历史会话
- 工具调用可视化：显示工具名称、参数、执行结果
- "新对话"按钮先跳转首页，首次发消息才创建 session

### 文件管理器 (files)

文件: `static/apps/files/files.js`
- 服务器文件系统浏览和编辑
- 树形目录导航
- 文件创建、删除、重命名
- 文件上传支持
- 文件内容搜索（支持正则表达式）

### 终端模拟器 (terminal)

文件: `static/apps/terminal/terminal.js`
- 基于 WebSocket 的真实 PTY 终端
- 支持完整的终端控制序列
- 多会话支持
- Unix 使用 ptyprocess，Windows 7 使用 pywinpty
- 命令历史记录

### 代码编辑器 (ide)

文件: `static/apps/ide/ide.js`
- 基于 Monaco Editor（VS Code 内核）
- 语法高亮、代码补全
- 多文件标签页
- 文件树浏览
- LSP（语言服务器协议）支持

### 浏览器 (browser)

文件: `static/apps/browser/browser.js`
- 多标签页 iframe 浏览器
- 代理导航（通过 localhost:8412）
- 书签管理
- 自定义新标签页（搜索 + 快捷链接）
- 地址栏自动补全

### 系统监控 (monitor)

文件: `static/apps/monitor/monitor.js`
- 实时资源监控面板
- 模型调用追踪
- Agent 运行状态
- WebSocket 实时数据推送

### 设置 (settings)

文件: `static/apps/settings/settings.js`
- 主题切换（亮色/暗色/Kinetic）
- 性能模式开关
- Provider 和模型配置
- LLM 参数调整（temperature、max_tokens 等）
- 存储管理

### Aether Cards (卡片笔记)

文件: `static/apps/aether-cards/`
- 卡片式笔记管理
- 支持自定义应用注册
- 内置画板 (drawboard)
- LLM 集成


---

## 主题系统

AetherOS 支持三种主题，通过 CSS 自定义变量实现：

| 主题 | data-theme | 特点 |
|------|-----------|------|
| **亮色** (Light) | `light` | 默认主题，高可读性，适合日常使用 |
| **暗色** (Dark) | `dark` | 深色背景，减少眼部疲劳 |
| **Kinetic** | `kinetic` | 动态光标特效，磁吸交互，对角线动画 |

### 主题变量体系

`static/core/os.css` 中定义了大量 CSS 自定义变量：

```css
[data-theme="light"] {
    --bg: #f5f5f7;          /* 桌面背景 */
    --surface: #ffffff;     /* 窗口/卡片背景 */
    --text: #1a1a2e;        /* 主文字色 */
    --accent: #0066cc;      /* 强调色 */
    --glass-bg: rgba(255,255,255,0.72); /* 毛玻璃背景 */
    /* ... 更多变量 */
}
```

### Kinetic 主题特效

Kinetic 主题启用了高级交互特效：
- **光标追踪** — 自定义光标跟随，带弹性动画
- **磁吸效果** — `.magnetic-target` 元素会被光标吸引
- **对角线动画** — 标签页上的斜纹流动效果（TabStripesEffect 类）
- **悬停反馈** — `.interactive-target` 元素的光标环放大效果

主题切换通过 `localStorage` 持久化，页面加载时通过 `<script>` 在渲染前设置，避免闪烁。

---

## 低性能模式

为老旧设备或资源受限环境设计，通过以下优化提升流畅度：

| 优化项 | 说明 |
|--------|------|
| 禁用毛玻璃效果 | 移除 `backdrop-filter`，减少 GPU 负载 |
| 简化动画 | 减少或禁用过渡动画 |
| 移除背景效果 | 隐藏桌面网格和 canvas 动画 |
| 减少阴影 | 简化多层阴影效果 |
| 加速启动 | Boot 动画时间缩短 4 倍 |

### 启用方式

1. **启动脚本**: `./start-lowperf.sh` 或 `start-lowperf.bat`
2. **系统设置**: 设置 → 外观 → 性能模式 中手动切换
3. **命令行参数**: `python server.py --port 8411 --low-perf`
4. **URL 参数**: `http://localhost:8411/?low_perf=1`
5. **自动检测**: 系统自动检测移动设备和低核心数 CPU


---

## 配置指南

### LLM Provider 配置

配置存储在 `~/.aetheros/llm/config.json`，也可通过设置界面配置：

```json
{
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "type": "openai",
      "api_key": "sk-...",
      "api_base": "https://api.openai.com/v1",
      "models": [
        { "id": "gpt-4o", "name": "GPT-4o", "capabilities": ["text", "image"], "context_limit": 128000 }
      ]
    },
    {
      "id": "anthropic",
      "name": "Anthropic",
      "type": "anthropic",
      "api_key": "sk-ant-...",
      "models": [
        { "id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "capabilities": ["text"], "context_limit": 200000 }
      ]
    }
  ],
  "default_chat_model": "openai/gpt-4o",
  "default_image_model": ""
}
```

- `context_limit` 为可选字段，未配置时自动从模型名称推断
- `api_key` 在 API 返回时自动脱敏

### Agent 配置

`agent/config.yaml` — Agent 行为配置，包括系统提示词、工具开关、Skill 注册等。

### 数据库操作

AetherOS 内置 SQLite 数据库支持，所有应用可通过统一 API 访问：

```
POST /api/db/{database}/query     # SELECT 查询
POST /api/db/{database}/execute   # INSERT/UPDATE/DELETE
POST /api/db/{database}/batch     # 批量操作
```

数据库文件存储在服务器端，通过名称隔离不同应用的数据。

---

## 开发指南

### 零构建开发

项目无构建步骤，前端代码直接作为静态文件服务：

1. 启动服务器: `python server.py --port 8411`
2. 修改 `static/` 下的任何文件
3. 刷新浏览器即可看到效果

### 添加新应用

1. 在 `static/apps/` 创建应用目录
2. 创建主 JS 文件，调用 `registerApp(id, config)` 注册
3. `factory(container, win, os)` 函数返回应用 DOM 元素
4. 可选实现 `getState(win)` / `setState(state, win, os)` 支持状态持久化

示例：
```javascript
registerApp('my-app', {
    title: '我的应用',
    icon: '🚀',
    factory: (container, win, os) => {
        const el = document.createElement('div');
        el.textContent = 'Hello AetherOS!';
        return el;
    }
});
```

### 应用状态持久化

窗口布局会自动持久化（位置、大小）。应用可通过 `getState`/`setState` 实现自定义状态保存/恢复。

### 前端依赖

唯一的前端第三方依赖是 **Monaco Editor**，存储在 `static/lib/` 下。其余全部为原生 JavaScript 实现。


---

## 安全设计

### 网络安全

- **默认绑定 127.0.0.1** — 仅本机可访问，如需局域网访问需显式 `--host 0.0.0.0`
- **代理绕过** — LLM 调用通过自定义 transport 直连 API，不经过系统代理
- **API Key 脱敏** — Provider 列表 API 自动移除 api_key 字段

### 终端安全

Agent 终端工具内置命令安全黑名单：
- `rm -rf /` 等破坏性命令
- fork bomb 模式
- 管道下载执行管道模式
- 其他危险模式

### 文件系统安全

- 文件操作基于服务器端路径解析
- 上传文件限制
- 数据库名称校验防止路径穿越

---

## 跨平台兼容层

### compat/pty_compat.py

统一 PTY（伪终端）接口，屏蔽平台差异：

| 平台 | 实现 | 依赖 |
|------|------|------|
| Linux/macOS | ptyprocess | 标准库 |
| Windows 10+ | pywinpty | winpty |
| Windows 7 | pywinpty (兼容版本) | 特定版本约束 |

### Windows 7 特殊支持

- **专用启动脚本**: `start-win7.bat`
- **独立虚拟环境**: `.venv-win7/`（使用 Python 3.8.10）
- **兼容依赖**: `requirements-win7.txt`（降级版本）
- **离线安装**: `download_deps_win7.bat` 下载依赖包
- **GBK 编码处理**: 后端对 Windows GBK 输出做了转码兼容

---

## 存储管理

AetherOS 支持数据根目录自定义（`--data` 参数），提供：

| API | 说明 |
|-----|------|
| `/api/storage/usage` | 查看存储使用情况（按应用/类型统计） |
| `/api/storage/config` | 查看当前数据目录配置 |
| `/api/storage/migrate` | 迁移数据到新路径 |
| `/api/storage/reset-path` | 重置数据路径 |

---

## 项目统计

| 指标 | 数值 |
|------|------|
| 总文件数 | 78 |
| 代码节点 | 4,050（函数/方法/类） |
| 调用关系 | 7,131 |
| 后端语言 | Python 3.10+（61 文件） |
| 前端语言 | 原生 JavaScript（17 文件） |
| 后端框架 | FastAPI |
| 前端依赖 | Monaco Editor（唯一第三方库） |
| API 路由 | 50+ REST + 5 条 WebSocket |
| 内置应用 | 9 个 |

## 技术栈总览

| 层次 | 技术 |
|------|------|
| **后端框架** | Python FastAPI |
| **前端** | 原生 JavaScript（零框架） |
| **终端** | PTY (ptyprocess / pywinpty) |
| **代码编辑器** | Monaco Editor |
| **数据库** | SQLite (aiosqlite) |
| **LLM SDK** | OpenAI Python SDK / Anthropic Python SDK |
| **HTTP 传输** | httpx（直连绕过代理） |
| **WebSocket** | FastAPI WebSocket |
| **存储** | JSON + SQLite 双格式 |
| **CSS 架构** | CSS 自定义变量 + 主题切换 |
| **版本** | v1.3.0a |

---

## 许可证

MIT License

## 相关文档

- [README.md](./README.md) — 快速开始和功能介绍
- [CLAUDE.md](./CLAUDE.md) — 开发指南和项目约定
