# Web OS 开发文档

> 版本：v1.0
> 日期：2026-05-09
> 用途：供 Claude Code 进行项目开发的完整参考文档
> 本文档忠实记录了整个对话过程中的所有讨论、决策和用户原始需求

---

# 目录

- [第一部分：项目背景与核心需求](#第一部分项目背景与核心需求)
- [第二部分：Hermes Agent 源码架构分析](#第二部分hermes-agent-源码架构分析)
- [第三部分：Web OS 完整架构设计](#第三部分web-os-完整架构设计)
- [第四部分：UI 设计规范](#第四部分ui-设计规范)
- [第五部分：用户原始消息记录](#第五部分用户原始消息记录)

---

# 第一部分：项目背景与核心需求

## 1.1 项目定位

构建一个**基于浏览器的 Vibe Coding 氛围编程操作系统**，内置一个与 Hermes Agent 同等量级的 AI Agent。该系统必须能够承担起所有开发任务，包括语法检查、文件运行与调试等。

## 1.2 核心技术决策

经过讨论，确定以下技术路线：

| 决策项 | 结论 | 理由 |
|--------|------|------|
| Python 执行方式 | **后端执行** | 需要完整 Python 能力，读写本地文件，运行任意脚本 |
| 终端类型 | **完整交互式 PTY** | 支持 vim、top、htop 等交互式程序 |
| 代码编辑器 | **Monaco Editor + LSP** | VS Code 同款引擎，完整 IntelliSense |
| 项目工作区 | **支持打开文件夹** | 类似 VS Code 的 workspace |
| AI Agent | **统一应用，支持分窗口** | 自创 Agent + 外部 Agent（hermes/claude code）共存 |
| 前端框架 | **原生 JS（无 React/Vue）** | 最少文件量，最高集成度 |
| 启动方式 | **脚本一键启动** | `./start.sh` 即可运行 |

## 1.3 文件数量要求

用户要求**较少的文件量**进行开发，高度集成。最终规划约 20 个文件。

---

# 第二部分：Hermes Agent 源码架构分析

> 基于 `/home/emyake/.hermes/hermes-agent/` 源码的实际分析，版本 0.11.0，Nous Research 出品。

## 2.1 总体结论：一个 AI Agent 需要什么

构建一个具有 Hermes 量级能力的 AI Agent，需要以下 **七大核心模块**：

| 模块 | 职责 | 对应源码 |
|------|------|----------|
| **Agent 循环引擎** | 对话主循环、工具调用迭代、中断/重试 | `run_agent.py` (~12,800 行) |
| **模型传输层** | 适配不同 LLM 提供商的协议差异 | `agent/transports/` |
| **工具系统** | 工具注册、发现、调度、执行 | `tools/registry.py` + `tools/*.py` |
| **会话持久化** | 消息历史存储、全文搜索、成本追踪 | `hermes_state.py` (SQLite + FTS5) |
| **上下文管理** | 压缩、记忆注入、Prompt 缓存 | `agent/context_compressor.py` + `agent/memory_manager.py` |
| **系统提示词组装** | 身份、技能索引、上下文文件、安全扫描 | `agent/prompt_builder.py` |
| **网关/平台适配** | 多平台消息收发、会话路由 | `gateway/` |

## 2.2 Agent 循环引擎（run_agent.py）

`AIAgent` 类的 `run_conversation()` 方法实现完整的工具调用循环：

```
用户消息 → 构建 system prompt → 进入主循环:
  while (未超最大迭代次数 AND 预算未耗尽) OR 有宽限调用:
    1. 检查中断信号
    2. 消耗迭代预算
    3. 准备 API 消息（注入记忆、插件上下文）
    4. 调用 LLM API
    5. 如果返回 tool_calls:
       - 逐个执行工具
       - 将结果追加到消息历史
       - 继续循环
    6. 如果返回纯文本:
       - 作为最终响应返回
```

关键设计：
- **IterationBudget**：线程安全的迭代计数器，父 Agent 默认 90 次，子 Agent 默认 50 次
- **宽限调用（grace call）**：预算耗尽后允许模型再做最后一次调用来总结
- **中断机制**：用户发送新消息时可以中断当前循环
- **重试逻辑**：无效工具调用、空内容、不完整 scratchpad 都有独立重试计数器
- **AIAgent 构造函数接收约 60 个参数**

## 2.3 模型传输层（agent/transports/）

```
ProviderTransport (抽象基类)
├── convert_messages()    → 将 OpenAI 格式转为提供商原生格式
├── convert_tools()       → 将工具定义转为提供商原生格式
├── build_kwargs()        → 构建完整的 API 调用参数
└── normalize_response()  → 将响应统一为 NormalizedResponse
```

已实现的传输适配器：
- `chat_completions.py` — OpenAI 兼容接口
- `anthropic.py` — Anthropic Messages API
- `codex.py` — OpenAI Codex Responses API
- `bedrock.py` — AWS Bedrock
- `gemini_native.py` — Google Gemini 原生接口

## 2.4 工具系统（tools/ + tools/registry.py）

**自注册架构** — 每个工具文件在模块导入时自动注册到全局注册表：

```python
# tools/file_tools.py
from tools.registry import registry

registry.register(
    name="read_file",
    toolset="file",
    schema={...},  # JSON Schema
    handler=handle_read_file,
    check_fn=None,
    requires_env=None,
    is_async=False,
    emoji="📄",
)
```

`ToolRegistry` 单例管理所有工具的 schema、handler、可用性检查，使用 `threading.RLock` 保护。

## 2.5 工具集系统（toolsets.py）

工具按逻辑分组，支持嵌套组合。每个平台有独立的工具集配置。

## 2.6 会话持久化（hermes_state.py）

SQLite + WAL 模式 + FTS5 全文搜索。存储会话元数据、完整消息历史、token 统计、成本追踪。

## 2.7 上下文管理

- **上下文压缩**：用便宜模型总结中间消息，保护头部（系统提示词）和尾部（最近消息）
- **记忆系统**：内置记忆 + 可插拔外部提供者（honcho、mem0、supermemory 等）
- **Prompt 缓存**：系统提示词构建一次后缓存，后续复用

## 2.8 系统提示词组装（agent/prompt_builder.py）

由多部分组装：Agent 身份 → 平台提示 → 记忆指导 → 技能索引 → 上下文文件（含注入扫描）→ 工具使用强制指导 → 用户自定义 → 记忆上下文块。

## 2.9 关键设计模式

1. **自注册工具模式** — 消除中心化配置
2. **传输层抽象** — 统一不同 LLM 提供商
3. **上下文窗口管理** — 压缩 + 缓存 + 分层注入
4. **会话持久化** — SQLite + FTS5
5. **多平台网关** — 单一核心，多适配器
6. **记忆即插件** — 可替换的记忆后端
7. **迭代预算控制** — 防止无限循环
8. **优雅降级** — 错误分类 → 重试 → 回退

---

# 第三部分：Web OS 完整架构设计

## 3.1 最终文件结构

```
~/桌面/webos/
│
├── start.sh                    # 一键启动（pip install + 启动服务 + 打开浏览器）
├── stop.sh                     # 一键停止
├── server.py                   # FastAPI 后端（所有后端逻辑的唯一入口）
├── requirements.txt            # Python 依赖
│
├── static/
│   ├── index.html              # OS 主页面（DOM 结构 + 应用注册）
│   ├── core/
│   │   ├── os.js               # 核心 OS（窗口管理器、Dock、侧边栏、桌面）
│   │   ├── os.css              # 全局样式
│   │   └── window.js           # 窗口类（拖拽、缩放、最小化、最大化、关闭）
│   │
│   ├── apps/
│   │   ├── files/
│   │   │   └── files.js        # 文件管理器
│   │   │
│   │   ├── ide/
│   │   │   └── ide.js          # IDE（Monaco Editor + LSP + 调试面板 + 终端）
│   │   │
│   │   ├── terminal/
│   │   │   └── terminal.js     # 独立终端应用
│   │   │
│   │   ├── agent/
│   │   │   └── agent.js        # Agent 应用（统一界面、分窗口、与 IDE 联动）
│   │   │
│   │   ├── monitor/
│   │   │   └── monitor.js      # 模型监控
│   │   │
│   │   └── settings/
│   │       └── settings.js     # 设置
│   │
│   └── lib/                    # 第三方库
│       ├── xterm.min.js
│       ├── xterm-fit.min.js
│       ├── xterm-webgl.min.js
│       └── monaco/             # Monaco Editor
│
└── agent/                      # 自定义 Agent 后端
    ├── engine.py               # Agent 循环引擎
    ├── context.py              # 上下文管理（用户自行设计的接口）
    ├── tools/
    │   ├── registry.py         # 工具注册中心（MCP + 自定义工具统一入口）
    │   ├── builtin/            # 内置工具
    │   └── custom/             # 用户自定义工具目录（热加载）
    └── config.yaml             # Agent 配置
```

## 3.2 后端架构（server.py）

### 3.2.1 模块划分（单文件内分区）

```python
# ── 区域 1：文件系统 API ──
@app.get("/api/fs/list")          # 列目录（支持 workspace 根目录切换）
@app.get("/api/fs/read")          # 读文件
@app.put("/api/fs/write")         # 写文件
@app.post("/api/fs/mkdir")        # 创建目录
@app.delete("/api/fs/delete")     # 删除文件/目录
@app.post("/api/fs/rename")       # 重命名
@app.post("/api/fs/search")       # 全文搜索（grep）

# ── 区域 2：LSP 代理 ──
@app.websocket("/ws/lsp/{language}")
# 前端 ←→ server.py ←→ pylsp/typescript-language-server/etc.
# 转发 LSP JSON-RPC 消息

# ── 区域 3：终端 PTY ──
@app.websocket("/ws/terminal/{session_id}")
# 完整 PTY 支持：stdin/stdout/stderr、resize、信号（Ctrl+C/Z）
# 使用 ptyprocess 创建伪终端
# 支持多个终端会话并行

# ── 区域 4：代码执行 ──
@app.post("/api/run")             # 启动程序，返回 session_id
@app.websocket("/ws/run/{session_id}")  # 连接到运行中的进程，实时输出

# ── 区域 5：Agent 桥接 ──
@app.websocket("/ws/agent/{agent_id}")
# 连接本地 hermes / claude code / 自定义 agent

# ── 区域 6：自定义 Agent 引擎 ──
@app.post("/api/agent/message")
@app.websocket("/ws/agent/custom/{id}")
@app.get("/api/agent/tools")
@app.post("/api/agent/tools/register")
@app.get("/api/agent/context")
@app.post("/api/agent/context/configure")

# ── 区域 7：模型监控 ──
@app.get("/api/monitor/models")
@app.get("/api/monitor/tokens")
@app.get("/api/monitor/agents")
@app.websocket("/ws/monitor")

# ── 区域 8：LSP 管理 ──
@app.get("/api/lsp/available")
@app.post("/api/lsp/start")
@app.post("/api/lsp/stop")
```

### 3.2.2 PTY 终端实现

```python
import ptyprocess
import asyncio
import os

class TerminalSession:
    def __init__(self, session_id: str, cwd: str = None):
        self.session_id = session_id
        self.pty = ptyprocess.PtyProcess.spawn(
            [os.environ.get("SHELL", "/bin/bash")],
            cwd=cwd or os.getcwd(),
            dimensions=(24, 80),
        )

    async def read_loop(self, websocket):
        loop = asyncio.get_event_loop()
        while True:
            data = await loop.run_in_executor(None, self.pty.read, 4096)
            if not data:
                break
            await websocket.send_bytes(data)

    def write(self, data: bytes):
        self.pty.write(data)

    def resize(self, rows: int, cols: int):
        self.pty.setwinsize(rows, cols)

    def kill(self):
        self.pty.kill(9)
```

### 3.2.3 LSP 代理实现

```python
class LSPProxy:
    def __init__(self, language: str):
        if language == "python":
            self.proc = await asyncio.create_subprocess_exec(
                "pylsp", "--tcp", "--port", "0",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
            )
        elif language in ("javascript", "typescript"):
            self.proc = await asyncio.create_subprocess_exec(
                "typescript-language-server", "--stdio",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
            )

    async def proxy(self, websocket):
        async def forward_to_lsp():
            async for message in websocket.iter_text():
                self.proc.stdin.write(message.encode())

        async def forward_to_frontend():
            while True:
                data = await self.proc.stdout.read(4096)
                await websocket.send_text(data.decode())

        await asyncio.gather(forward_to_lsp(), forward_to_frontend())
```

## 3.3 桌面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  菜单栏                                                         │
│  ▽ WebOS   文件  编辑  视图  终端  窗口  帮助          时钟     │
├────┬────────────────────────────────────────────────────────────┤
│    │                                                            │
│ 侧 │              桌面区域                                       │
│ 边 │           （窗口管理系统）                                   │
│ 栏 │                                                            │
│(折 │    ┌──────────────┐  ┌──────────────┐                      │
│叠) │    │   IDE 窗口    │  │  Agent 窗口   │                      │
│    │    │              │  │              │                      │
│    │    │              │  │              │                      │
│    │    └──────────────┘  └──────────────┘                      │
│    │                                                            │
├────┴────────────────────────────────────────────────────────────┤
│  Dock 栏（底部）                                                 │
│  📁  📝  ⬛  🤖  📊  🔧  ⚙️                                      │
└─────────────────────────────────────────────────────────────────┘
```

## 3.4 窗口管理系统

```javascript
class OSWindow {
    constructor(appId, title, content, options) {
        this.id = generateId();
        this.appId = appId;
        this.title = title;
        this.element = this.createDOM();
        this.state = 'normal';       // normal / minimized / maximized
        this.position = options.position;
        this.zIndex = WindowStack.next();
    }

    // 窗口操作
    drag(startX, startY) {}       // 拖拽移动
    resize(edge, dx, dy) {}       // 边缘拖拽缩放
    minimize() {}                 // 最小化到 Dock
    maximize() {}                 // 最大化
    close() {}                    // 关闭
    focus() {}                    // 置顶 + 激活
    snap(direction) {}            // 左/右半屏吸附
}

// 窗口控制按钮位置：右上角
// 布局：[标题] ............ [最小化] [全屏] [关闭]

const AppRegistry = {
    'files':    { title: '文件管理器', icon: '📁', factory: FilesApp },
    'ide':      { title: 'IDE',       icon: '📝', factory: IDEApp },
    'terminal': { title: '终端',      icon: '⬛', factory: TerminalApp },
    'agent':    { title: 'Agent',     icon: '🤖', factory: AgentApp },
    'monitor':  { title: '监控',      icon: '📊', factory: MonitorApp },
    'settings': { title: '设置',      icon: '⚙️', factory: SettingsApp },
};
```

## 3.5 侧边栏设计

### 3.5.1 行为

- **默认状态**：折叠，仅显示系统图标（▽）
- **展开/折叠**：点击左上角系统图标（▽）切换
- **位置**：左侧

### 3.5.2 模型调用模块

使用**圆角磨砂玻璃**形式显示。

```
折叠态：                    展开态（点击系统图标后）：
┌──┐                       ┌─────────────────────────┐
│▽│                        │ 📊 模型调用               │
│  │   点击展开 →          │ ┌─────────────────────┐  │
│系│                       │ │ ◆ mimo-v2.5-pro     │  │
│统│                       │ │ 1,234 tokens │ 2.3s  │  │
│图│                       │ └─────────────────────┘  │
│标│                       │ ┌─────────────────────┐  │
└──┘                       │ │ ◆ deepseek-v4       │  │
                           │ │ 567 tokens   │ 1.1s  │  │
                           │ └─────────────────────┘  │
                           │                          │
                           │ [查看全部调用记录 ▾]      │
                           └─────────────────────────┘
```

规则：
- 只显示**当前正在请求的模型**并显示本次 token 使用情况
- 单击卡片 → 展开该次调用的详细信息
- 同名模型的不同调用分别显示（两个 mimo-v2.5-pro 调用各自独立卡片）
- 系统自动监控所有已注册应用的模型请求，识别后追加到当前调用列表
- "查看全部"按钮 → 弹出完整调用历史面板

### 3.5.3 Agent 运行面板

使用**圆角磨砂玻璃**形式显示。

```
┌─────────────────────────────────┐
│ ◇ hermes-agent                  │  ← Agent 名称
│ 🔄 工具调用: read_file          │  ← 当前进程状态
│ ⏱️ 00:03:21                     │  ← 本轮运行时间
│ 📏 上下文: 12,345 tokens        │  ← 对话上下文长度
│                          [切换→]│  ← 跳转到该 Agent 窗口
└─────────────────────────────────┘
```

状态类型：
- 💭 思考中
- 📤 输出中
- 🔧 工具调用: {tool_name}
- 💤 空闲

功能：
- 单击展开详细概况（完整对话轮次、工具调用历史、token 消耗曲线等）
- "切换"按钮直接聚焦到对应 Agent 窗口

### 3.5.4 自定义面板

预留接口，用户可注册自定义组件。

## 3.6 IDE 应用（独立程序）

### 3.6.1 布局

```
┌─────────────────────────────────────────────────────┐
│  IDE 标题栏                    [最小化] [全屏] [关闭]│
├────────┬────────────────────────────┬───────────────┤
│        │  标签栏（多文件 Tab）       │               │
│ 文件   │  main.py │ utils.py │ ...  │   缩略地图    │
│ 树     ├────────────────────────────┤   (可选)      │
│        │                            │               │
│  📁src │     Monaco Editor          │               │
│  ├─main│     (代码编辑区)            │               │
│  ├─util│                            │               │
│  └─test│     - 语法高亮             │               │
│        │     - 智能补全（LSP）       │               │
│  📁test│     - 错误波浪线            │               │
│        │     - 跳转定义              │               │
│        │     - 重命名重构            │               │
│        │     - 代码格式化            │               │
│        ├────────────────────────────┤               │
│        │  面板区域（可切换/可拖拽）    │               │
│        │  [问题] [终端] [输出] [调试] │               │
│        │  ┌──────────────────────┐  │               │
│        │  │ 终端（xterm.js）      │  │               │
│        │  │ $ python main.py     │  │               │
│        │  │ Hello World          │  │               │
│        │  └──────────────────────┘  │               │
├────────┴────────────────────────────┴───────────────┤
│  状态栏：行 12, 列 34 │ Python │ UTF-8 │ LSP: ✅    │
└─────────────────────────────────────────────────────┘
```

### 3.6.2 核心功能

- **Monaco Editor**：VS Code 同款编辑器引擎
- **LSP 集成**：通过 WebSocket 连接后端 pylsp / ts-ls，获得完整 IntelliSense
- **内嵌终端**：IDE 内部直接打开终端面板（复用 PTY 模块）
- **调试支持**：通过 Debug Adapter Protocol（DAP）连接 debugpy
- **多标签**：同时打开多个文件，Tab 切换
- **文件树**：左侧显示当前 workspace 的目录结构

## 3.7 Agent 应用

### 3.7.1 统一界面 + 分窗口

```
┌──────────────────────────────────────────────────────┐
│  Agent 标题栏                      [最小化] [全屏][关]│
├──────────────────────┬───────────────────────────────┤
│                      │                               │
│  对话面板             │  工具/终端面板                  │
│                      │                               │
│  🤖 你好，有什么      │  ┌─ 工具调用 ──────────────┐  │
│      需要帮助？       │  │ ✅ read_file("main.py") │  │
│                      │  │ ✅ terminal("pytest")   │  │
│  👤 帮我重构这个函数   │  │ ⏳ write_file(...)      │  │
│                      │  └─────────────────────────┘  │
│  🤖 好的，我先读取    │                               │
│      文件内容...      │  ┌─ 终端输出 ──────────────┐  │
│                      │  │ $ pytest -v             │  │
│  [代码块] ── [应用]   │  │ test_main.py PASSED    │  │
│                      │  │ ========================│  │
│  🤖 已完成重构，      │  │ 1 passed in 0.23s      │  │
│      请查看 diff。    │  └─────────────────────────┘  │
│                      │                               │
├──────────────────────┴───────────────────────────────┤
│  输入框                                    [发送 ▶]  │
└──────────────────────────────────────────────────────┘
```

### 3.7.2 与 IDE 的联动

```
Agent ←→ IDE 双向联动：

1. Agent → IDE：
   - Agent 修改文件后，IDE 自动刷新编辑器内容
   - Agent 打开文件时，IDE 自动跳转到对应文件和行号
   - Agent 的代码建议可以直接 diff 预览后应用

2. IDE → Agent：
   - IDE 中选中的代码可以一键发送给 Agent 作为上下文
   - IDE 的报错信息可以一键发送给 Agent 请求修复
   - 右键菜单："发送给 Agent" / "让 Agent 解释" / "让 Agent 重构"

3. 共享状态：
   - 当前打开的文件列表
   - 光标位置和选区
   - 终端会话
   - 工作区根目录
```

### 3.7.3 多 Agent 支持

统一应用下支持多个 Agent 分窗口运行：
- 用户自创 Agent（核心）
- 外部 Agent（hermes、claude code 等）
- 每个 Agent 独立窗口，共享侧边栏监控

## 3.8 自定义 Agent 引擎

### 3.8.1 核心引擎

```python
class CustomAgentEngine:
    def __init__(self, config: dict):
        self.model = config["model"]
        self.tools = ToolRegistry()
        self.context = ContextManager()     # 用户设计
        self.max_iterations = config.get("max_iterations", 50)

    async def run(self, user_message: str, stream_callback=None):
        messages = self.context.build_messages(user_message)

        for i in range(self.max_iterations):
            response = await self.call_llm(messages)

            if not response.tool_calls:
                yield response.content
                return

            for tool_call in response.tool_calls:
                result = await self.tools.execute(
                    tool_call.name,
                    tool_call.arguments,
                )
                messages.append(tool_result(result))
                if stream_callback:
                    stream_callback(tool_call, result)

    async def call_llm(self, messages):
        """调用 LLM API（OpenAI 兼容接口）"""
        ...
```

### 3.8.2 工具创建接口

用户要求：不仅支持传统的 MCP，更要提供创建工具的接口，且接入用户自行设计的工具。

**方式 A：Python 文件热加载**

```python
# agent/tools/custom/hello.py

TOOL_SCHEMA = {
    "description": "向指定用户问好",
    "parameters": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "用户名"}
        },
        "required": ["name"]
    }
}

async def handler(params: dict) -> str:
    name = params["name"]
    return f"你好，{name}！"
```

**方式 B：Web UI 创建（设置页面）**

提供可视化界面定义工具名称、描述、参数、处理函数。

**方式 C：MCP 接入**

```yaml
# agent/config.yaml
mcp_servers:
  godot:
    command: npx
    args: ["@coding-solo/godot-mcp"]
  filesystem:
    command: npx
    args: ["@modelcontextprotocol/server-filesystem", "/home/user"]
```

**工具注册中心统一管理三种方式：**

```python
class ToolRegistry:
    def register(self, name, schema, handler):
        """注册自定义工具"""
        ...

    def register_file(self, path):
        """从 Python 文件热加载工具"""
        ...

    async def connect_mcp(self, name, command, args):
        """连接 MCP 服务器，自动注册其工具"""
        ...

    async def execute(self, name, params):
        """执行工具"""
        ...

    def list_tools(self):
        """返回所有已注册工具的 schema（供 LLM 使用）"""
        ...
```

### 3.8.3 上下文管理接口

用户要求：具备更好的上下文管理方案，也要由用户自行设计。

```python
class ContextManager:
    def __init__(self, config: dict):
        self.strategy = config.get("strategy", "sliding_window")
        self.max_tokens = config.get("max_tokens", 128000)
        self.system_prompt = config.get("system_prompt", "")
        self.messages: list[dict] = []

    def build_messages(self, user_message: str) -> list[dict]:
        """构建发送给 LLM 的消息列表
        用户可重写此方法实现自定义策略"""
        ...

    def add_message(self, role: str, content: str):
        ...

    def compress(self):
        """压缩上下文（用户自定义压缩逻辑）"""
        ...

    def inject_context(self, context: dict):
        """注入额外上下文（文件内容、终端输出等）"""
        ...

    def get_state(self) -> dict:
        """导出当前上下文状态（供前端监控显示）"""
        ...
```

## 3.9 启动脚本

```bash
#!/bin/bash
# start.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT=${1:-8420}

echo "🚀 启动 Web OS..."

if [ ! -d ".venv" ]; then
    echo "📦 创建虚拟环境..."
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt -q

echo "🔧 启动服务器 (端口 $PORT)..."
python server.py --port "$PORT" &
SERVER_PID=$!

sleep 2

URL="http://localhost:$PORT"
echo "✅ Web OS 已启动: $URL"
if command -v xdg-open &> /dev/null; then
    xdg-open "$URL"
elif command -v open &> /dev/null; then
    open "$URL"
else
    echo "请手动打开浏览器访问: $URL"
fi

echo "按 Ctrl+C 停止服务器"
trap "kill $SERVER_PID 2>/dev/null; exit" INT TERM
wait $SERVER_PID
```

## 3.10 依赖清单

```
# requirements.txt

fastapi>=0.104.0
uvicorn[standard]>=0.24.0
websockets>=12.0
ptyprocess>=0.7.0
pylsp-mypy>=0.6.0
python-lsp-server[all]
watchdog>=3.0.0
openai>=1.0.0
anthropic>=0.39.0
mcp>=1.2.0
pyyaml>=6.0
```

## 3.11 技术选型总结

| 组件 | 技术方案 | 理由 |
|------|----------|------|
| 后端框架 | FastAPI + WebSocket | 原生 async、WebSocket 支持好 |
| 终端模拟 | xterm.js + ptyprocess | 完整 PTY 支持，GPU 加速渲染 |
| 代码编辑器 | Monaco Editor | VS Code 同款引擎，LSP 生态完整 |
| LSP 集成 | pylsp + WebSocket 代理 | Python 完整智能提示 |
| 文件系统 | 直接 API + watchdog 监控 | 简单可靠，实时刷新 |
| Agent 引擎 | 自定义 Python 引擎 | 完全可控，支持自定义工具和上下文 |
| 工具系统 | 自注册 + MCP + 热加载 | 三种方式统一，扩展性强 |
| 窗口管理 | 纯 JS 实现 | 无框架依赖 |
| 前端框架 | 原生 JS（无 React/Vue） | 最少文件量，最高集成度 |

---

# 第四部分：UI 设计规范

## 4.1 系统设计元素

用户定义了三个系统级视觉元素，作为整体设计风格和视觉调性的基础：

| 元素 | 形态 | 用途 |
|------|------|------|
| **▽ 倒三角形** | 系统图标（Logo） | 定义整体视觉元素 |
| **⬡ 被切割的正六边形** | 系统设计元素 | 定义整体视觉风格 |
| **○ 圆形** | 系统设计元素 | 定义整体视觉风格 |

**重要说明：**
- 这三个元素是**系统级视觉语言**，定义整体设计风格和视觉调性
- 它们**不是**直接拿去做下拉菜单、图标容器或状态指示器的
- 具体的 UI 组件（下拉菜单、图标容器、状态指示器、卡片等）需要**单独设计**
- UI 组件可能会借鉴这三个系统元素的风格，但形态独立

## 4.2 去苹果化规范

- **不含任何苹果元素**：不使用苹果 logo、不模仿 macOS 的特定苹果风格元素
- **菜单栏左侧**：使用系统名称（N.O.V.A Aether OS）或 ▽ 系统图标，不用苹果图标
- **窗口控制按钮**：位于**右上角**，顺序为 [最小化] [全屏] [关闭]

## 4.3 侧边栏规范

- **默认状态**：折叠，仅显示系统图标（▽）
- **展开/折叠**：点击左上角系统图标（▽）切换
- **位置**：左侧

### 模型调用模块
- 使用**圆角磨砂玻璃**形式显示
- 只显示当前正在请求的模型并显示本次 token 使用情况
- 单击卡片 → 展开详细信息（展开后才显示更多内容）
- 同名模型的不同调用分别显示
- 系统自动监控所有已注册应用的模型请求，识别后追加
- "查看全部调用记录"按钮

### Agent 运行面板
- 使用**圆角磨砂玻璃**形式显示
- 内容：Agent 名称、当前进程状态（思考/输出/工具调用/空闲）、当前轮次运行时间、对话上下文长度
- 工具调用状态需显示工具名称
- 单击展开详细概况
- "切换至该 Agent 窗口"按钮

## 4.4 Dock 栏规范

- **位置**：底部
- **功能**：应用启动/切换、运行指示器

## 4.5 暂定设计说明

用户正在绘制页面元素设计稿。在设计稿完成前，以 ▽、⬡、○ 三个元素作为 UI 设计的临时参考。具体 UI 组件设计待设计稿确认后确定。

---

# 第五部分：用户原始消息记录

以下为对话过程中用户发送的所有原始消息，按时间顺序排列：

---

## 消息 1：初始需求

```
请你分析hermes agent（本地，目录为home/emyake/.hermes）的源码，告诉我让一个ai agent工作，需要什么。稍后我将构建一个基于浏览器的vibe coding氛围编程操作系统，需要内置一个这样量级的ai agent。你现在只看源码即可。你也可以上网搜索相关的信息，但是不得参考任何有ai写作痕迹的文章。必须遵守hermes守则。最后，你需要在home/emyake/桌面（不是Desktop）生成一个供人类阅读的markdown文件，同时在对话中简要告诉我相关信息。
```

---

## 消息 2：确认后端方案与核心需求

```
好的。我希望这个项目具备高度集成性，支持我使用较少的文件量进行开发，且启动方便（封装成脚本文件，可以直接启动）。我需要确认一点：能否在这个网页中实现这一操作系统中存储的html程序以及python程序的运行？或者，允许网页操作系统运行电脑上的python文件，并同步输入值与返回值？
```

---

## 消息 3：确认后端方案 + 完整开发需求

```
就后端吧。我的这个操作系统必须能够承担起所有的开发任务，这其中就包含了语法检查、文件运行与调试等内容。当运行某些代码时，直接交由电脑系统来运行，Web OS中只显示终端信息或者报错信息等，就像VS Code下方的显示框一样。同时，我的Web OS也应当具有与本地ai agent（如claude code、hermes）交互的能力（单独搭建ui，作为Web OS的一个应用程序）。我的Web OS必须为生产力而精心设计，包含侧边栏以及类macos操作系统
```

---

## 消息 4：详细设计补充

```
1、支持完整的交互式终端。2、做成统一的agent应用（最好直接跟我要自创的agent放在同一个应用下），支持分窗口。3、需要连接后端LSP。4、都要有。5、关于侧边栏：支持显示窗口概览（方便切换窗口），显示模型调用情况（正在调用什么模型、模型调用产生的token消耗、各agent的运行情况），以及一些支持自定义的功能（预留接口）；侧边栏不同于Dock栏，Dock栏要放在底部。6、要具备一个专门定制的IDE（独立程序）；Agent应用应当与这个IDE有直接的联动。7、我自创的Agent不仅支持传统的MCP，更要给我一个创建工具的接口，且接入我自行设计的工具，且具备更好的上下文管理方案（也要由我设计）。
```

---

## 消息 5：UI 设计修正（关键）

```
整体不错，但细节有瑕疵。1、侧边栏常态是折叠的，点击左上角系统图标即可展开/折叠。2、我的系统不应该包含任何有关苹果的元素，且最小化、全屏与关闭按钮也应该在右上角。3、侧边栏内：模型调用模块中，只显示当前正在请求的模型并显示本次token使用情况（以圆角磨砂玻璃形式显示，单击后展开详细信息，此时再显示更多内容），支持显示多个模型（只要该应用在系统中注册，则系统会自动监控其模型调用请求并识别，然后追加到当前调用的模型中），同名模型的不同调用也要分别显示，同时也应该支持显示所有模型的调用情况（单独的一个按钮）；agent运行面板同样使用圆角磨砂玻璃形式显示，内容包括agent名称、当前进程（思考、输出、工具调用、空闲，工具调用的话应该显示工具名称）、当前轮次运行时间、对话上下文长度，在点击后支持查看更详细的概况，且要有直接切换至该agent窗口的按钮。 我正在绘制页面元素设计，在此期间，你暂时以"倒三角形"以及"被切割的正六边形"还有"圆形"作为UI设计元素。
```

---

## 消息 6：UI 设计元素澄清

```
不对。暂定倒三角形为我的系统图标。这些元素都是系统设计元素，而不是具体的内容。下拉菜单、图标容器、状态指示器等要单独设计。其次，点击系统图标（左上角）是展开整个侧边栏。
```

---

## 消息 7：编写开发文档

```
先这样做。请你将整个对话的所有内容编写成一个完整的开发文档，涵盖我们讨论的所有内容，同时必须附加我的所有消息原文。稍后我将使用claude code使用此开发文档进行开发。
```

---

# 附录：Agent 守则

开发过程中必须遵守的守则（摘自对话开头的系统指令）：

1. **节约 token 策略** — 最少量工具调用轮次，高度允许并发调用
2. **中文语义策略** — 使用中文语义理解需求
3. **问题导向策略** — 按第一原理解题
4. **严谨思维策略** — 准确、清晰、有序、可靠
5. **认知谦逊策略** — 承认不确定性，多路径推理
6. **有效合作策略** — 困惑时询问，用户愤怒时停下反思
7. **反思总结策略** — 出错必反思根本原因

---

*文档生成完毕。本文档可供 Claude Code 直接参考进行项目开发。*
