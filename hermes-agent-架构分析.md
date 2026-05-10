# Hermes Agent 源码架构分析

> 基于 `/home/emyake/.hermes/hermes-agent/` 源码的实际分析，版本 0.11.0，Nous Research 出品。

---

## 一、总体结论：一个 AI Agent 需要什么

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

---

## 二、核心模块详解

### 2.1 Agent 循环引擎（run_agent.py）

这是整个系统的心脏。`AIAgent` 类的 `run_conversation()` 方法实现了完整的工具调用循环：

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

**关键设计细节：**

- **IterationBudget**：线程安全的迭代计数器，父 Agent 默认 90 次，子 Agent 默认 50 次
- **宽限调用（grace call）**：预算耗尽后允许模型再做最后一次调用来总结
- **中断机制**：用户发送新消息时可以中断当前循环
- **重试逻辑**：无效工具调用、空内容、不完整 scratchpad 都有独立重试计数器
- **连接健康检查**：每轮开始前检测并清理死 TCP 连接
- **SafeWriter**：包装 stdout/stderr 防止管道断裂崩溃

**AIAgent 的构造函数接收约 60 个参数**，包括：
- 模型配置：base_url, api_key, provider, api_mode, model
- 行为参数：max_iterations, quiet_mode, reasoning_effort
- 会话上下文：session_id, platform, session_db
- 回调函数：status_callback, step_callback, stream_callback
- 预算与凭据：iteration_budget, credential_pool

### 2.2 模型传输层（agent/transports/）

Hermes 支持多种 LLM 提供商，通过传输层抽象统一接口：

```
ProviderTransport (抽象基类)
├── convert_messages()    → 将 OpenAI 格式转为提供商原生格式
├── convert_tools()       → 将工具定义转为提供商原生格式
├── build_kwargs()        → 构建完整的 API 调用参数
└── normalize_response()  → 将响应统一为 NormalizedResponse
```

**已实现的传输适配器：**
- `chat_completions.py` — OpenAI 兼容接口（大多数提供商）
- `anthropic.py` — Anthropic Messages API
- `codex.py` — OpenAI Codex Responses API
- `bedrock.py` — AWS Bedrock
- `gemini_native.py` — Google Gemini 原生接口

**NormalizedResponse** 是所有提供商的统一响应类型：
```python
@dataclass
class ToolCall:
    id: Optional[str]       # 工具调用 ID
    name: str               # 工具名称
    arguments: str          # JSON 字符串参数
    provider_data: Optional[Dict]  # 提供商特定元数据
```

### 2.3 工具系统（tools/ + tools/registry.py）

**自注册架构** — 这是 Hermes 工具系统最精妙的设计：

```python
# tools/file_tools.py（每个工具文件在模块级别注册自己）
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

**ToolRegistry 单例**（`tools/registry.py`）：
- `register()` — 注册工具（模块导入时自动调用）
- `get_entry()` — 按名称获取工具条目
- `discover_builtin_tools()` — 扫描 tools/ 目录，导入所有包含 `registry.register()` 的模块
- 线程安全：使用 `threading.RLock` 保护注册表
- 支持 MCP 动态刷新时的安全覆盖

**ToolEntry 包含：**
- `name` — 工具名称（如 "read_file"）
- `toolset` — 所属工具集（如 "file"）
- `schema` — JSON Schema 定义
- `handler` — 处理函数
- `check_fn` — 可用性检查函数
- `is_async` — 是否异步
- `max_result_size_chars` — 结果大小限制

**model_tools.py** 是编排层，提供：
- `get_tool_definitions()` — 获取工具定义列表
- `handle_function_call()` — 执行工具调用
- 异步桥接：`_run_async()` 处理 sync→async 转换

### 2.4 工具集系统（toolsets.py）

工具按逻辑分组，支持嵌套组合：

```python
_HERMES_CORE_TOOLS = [
    "web_search", "web_extract",        # Web
    "terminal", "process",              # 终端
    "read_file", "write_file", "patch", "search_files",  # 文件
    "vision_analyze", "image_generate", # 视觉
    "skills_list", "skill_view", "skill_manage",  # 技能
    "browser_navigate", "browser_snapshot", ...   # 浏览器
    "todo", "memory", "session_search",  # 规划与记忆
    "clarify",                           # 澄清提问
    "execute_code", "delegate_task",     # 代码执行与委派
    "cronjob",                           # 定时任务
    ...
]

TOOLSETS = {
    "web": {"tools": ["web_search", "web_extract"], "includes": []},
    "terminal": {"tools": ["terminal", "process"], "includes": []},
    "file": {"tools": ["read_file", "write_file", "patch", "search_files"], "includes": []},
    "hermes-cli": {"tools": [], "includes": ["web", "terminal", "file", ...]},  # 组合
    ...
}
```

每个平台有独立的工具集配置（`config.yaml` 中的 `platform_toolsets`）。

### 2.5 会话持久化（hermes_state.py）

使用 **SQLite + WAL 模式 + FTS5 全文搜索**：

```sql
-- 会话表
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,           -- 'cli', 'telegram', 'discord' 等
    user_id TEXT,
    model TEXT,
    system_prompt TEXT,
    parent_session_id TEXT,         -- 压缩分裂时的父会话
    message_count INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    estimated_cost_usd REAL,
    title TEXT,
    ...
);

-- 消息表
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,             -- 'user', 'assistant', 'tool', 'system'
    content TEXT,
    tool_call_id TEXT,
    tool_calls TEXT,
    tool_name TEXT,
    reasoning TEXT,                 -- 推理内容
    ...
);

-- FTS5 全文搜索虚拟表
CREATE VIRTUAL TABLE messages_fts USING fts5(content, ...);
```

**关键特性：**
- WAL 模式支持并发读 + 单写（网关多平台场景）
- FTS5 支持快速全文搜索（`session_search` 工具）
- 压缩触发的会话分裂（parent_session_id 链）

### 2.6 上下文管理

#### 2.6.1 上下文压缩（agent/context_compressor.py）

当对话历史超过模型上下文窗口阈值时自动触发：

```
[系统提示词（受保护）] + [旧消息（可压缩）] + [最近 N 条（受保护）]

压缩流程：
1. 检测 token 数是否超过阈值（默认 90% 上下文窗口）
2. 用辅助模型（便宜/快速）总结中间消息
3. 总结格式包含 "已解决问题" / "待解决问题" 追踪
4. 保护头部（系统提示词）和尾部（最近消息）
5. 可多轮压缩处理超长会话
```

**关键参数：**
- `threshold` — 触发压缩的 token 阈值比例（默认 0.9）
- `target_ratio` — 压缩目标比例（默认 0.2）
- `protect_last_n` — 保护最近 N 条消息（默认 20）

#### 2.6.2 记忆系统（agent/memory_manager.py）

```python
class MemoryManager:
    """编排内置记忆提供者 + 最多一个外部插件提供者"""

    def add_provider(self, provider: MemoryProvider)    # 注册提供者
    def prefetch_all(self, query: str) -> str           # 预取（每轮开始前）
    def sync_all(self, user_msg, assistant_response)    # 同步（每轮结束后）
    def build_system_prompt(self) -> str                # 构建记忆上下文块
```

**记忆注入格式：**
```
<memory-context>
[System note: The following is recalled memory context, NOT new user input.]

（记忆内容）
</memory-context>
```

内置提供者使用 `memory` 工具（用户/agent 可主动读写），外部提供者包括 honcho、mem0、supermemory 等。

### 2.7 系统提示词组装（agent/prompt_builder.py）

系统提示词由多个部分组装而成：

```
┌─────────────────────────────────────────┐
│ 1. Agent 身份字符串                      │ DEFAULT_AGENT_IDENTITY
├─────────────────────────────────────────┤
│ 2. 平台提示                              │ PLATFORM_HINTS
├─────────────────────────────────────────┤
│ 3. 记忆指导                              │ MEMORY_GUIDANCE
├─────────────────────────────────────────┤
│ 4. 技能索引                              │ build_skills_system_prompt()
├─────────────────────────────────────────┤
│ 5. 上下文文件                            │ AGENTS.md, SOUL.md, .hermes.md
│    （含注入扫描：检测 prompt injection）  │
├─────────────────────────────────────────┤
│ 6. 工具使用强制指导                      │ TOOL_USE_ENFORCEMENT_GUIDANCE
├─────────────────────────────────────────┤
│ 7. 用户自定义 system prompt              │ config.yaml 中的 agent.system_prompt
├─────────────────────────────────────────┤
│ 8. 记忆上下文块                          │ <memory-context>...</memory-context>
└─────────────────────────────────────────┘
```

**安全特性 — 上下文文件注入扫描：**
- 检测 prompt injection 模式（"ignore previous instructions" 等）
- 检测不可见 Unicode 字符
- 检测隐藏 HTML 元素
- 检测密钥泄露尝试（curl $API_KEY 等）

### 2.8 网关系统（gateway/）

多平台消息适配层：

```
GatewayRunner
├── platform adapters (gateway/platforms/)
│   ├── telegram.py
│   ├── discord.py
│   ├── slack.py
│   ├── whatsapp.py
│   ├── signal.py
│   ├── matrix.py
│   ├── feishu.py
│   ├── dingtalk.py
│   ├── wecom.py
│   ├── email.py
│   ├── sms.py
│   ├── webhook.py
│   ├── api_server.py
│   └── homeassistant.py
├── session management (gateway/session.py)
│   ├── SessionSource — 消息来源追踪
│   ├── SessionContext — 动态系统提示注入
│   └── SessionResetPolicy — 会话重置策略
├── hooks system (gateway/hooks.py)
└── delivery (gateway/delivery.py) — 响应路由
```

**Agent 缓存策略：**
- LRU 缓存，最大 128 个 Agent 实例
- 空闲超过 1 小时自动驱逐
- 每个平台消息到达时复用或创建 Agent

---

## 三、辅助模块

### 3.1 技能系统（skills/ + tools/skills_tool.py）

技能是 **Markdown 文件 + YAML frontmatter**：

```markdown
---
name: my-skill
description: 技能描述
platforms: [cli, telegram]
---

# 技能内容

（Markdown 格式的指导说明）
```

- 技能注入为 **user message**（不是 system prompt），以保持 prompt 缓存
- 支持条件匹配（平台、模型等）
- `skill_manage` 工具支持创建、修补、删除技能

### 3.2 子 Agent 委派（tools/delegate_tool.py）

```python
delegate_task(
    goal="子任务目标",
    context="背景信息",
    toolsets=["terminal", "file"],  # 限定可用工具
    role="leaf"  # leaf=叶子节点, orchestrator=可再委派
)
```

- 使用 ThreadPoolExecutor 并行执行
- 每个子 Agent 有独立的 IterationBudget
- orchestrator 角色可嵌套委派（受 max_spawn_depth 限制）

### 3.3 定时任务（cron/）

- Cron 表达式解析（croniter）
- 任务管理工具（cronjob）
- 独立会话执行，无用户交互

### 3.4 浏览器自动化（tools/browser_tool.py）

- 基于 Playwright 的浏览器控制
- CDP 协议支持
- 截图 + 视觉分析（browser_vision）
- 对话框处理（browser_dialog）

### 3.5 插件系统（plugins/）

- 钩子系统：on_session_start, pre_llm_call 等
- 记忆提供者插件：honcho, mem0, supermemory, holographic 等
- 上下文引擎插件
- 通过 `plugin.yaml` 声明配置

---

## 四、关键设计模式总结

### 4.1 自注册工具模式
每个工具文件在模块导入时自动注册到全局注册表。这消除了中心化配置，新工具只需创建文件即可。

### 4.2 传输层抽象
所有 LLM 提供商的差异被封装在传输适配器中，Agent 循环只处理统一的 NormalizedResponse。

### 4.3 上下文窗口管理
压缩 + prompt 缓存 + 记忆分层注入，确保长对话不会超出模型限制。

### 4.4 会话持久化
SQLite + FTS5 提供可靠的存储和快速搜索，WAL 模式支持并发访问。

### 4.5 多平台网关
单一 Agent 核心，多个平台适配器，通过 SessionSource 路由消息。

### 4.6 记忆即插件
内置记忆 + 可选外部记忆提供者，通过 MemoryManager 统一编排。

### 4.7 迭代预算控制
防止 Agent 无限循环，支持宽限调用让模型有机会总结。

### 4.8 优雅降级
错误分类 → 重试 → 回退模型 → 用户提示，多层容错。

---

## 五、核心依赖

```toml
# LLM SDK
openai >= 2.21.0
anthropic >= 0.39.0

# HTTP
httpx[socks] >= 0.28.1
requests >= 2.33.0

# CLI
rich >= 14.3.3
prompt_toolkit >= 3.0.52

# 工具
fire >= 0.7.1
pyyaml >= 6.0.2
pydantic >= 2.12.5
jinja2 >= 3.1.5
tenacity >= 9.1.4

# Web 工具
exa-py >= 2.9.0
firecrawl-py >= 4.16.0
parallel-web >= 0.4.2

# TTS
edge-tts >= 7.2.7

# 可选：消息平台
python-telegram-bot, discord.py, slack-bolt, aiohttp, ...
```

---

## 六、对你构建浏览器端 Vibe Coding OS 的启示

基于 Hermes 的架构分析，构建一个内置 AI Agent 的浏览器端操作系统，你需要：

### 必须实现的核心
1. **Agent 循环引擎** — 工具调用迭代循环，这是 Agent 的"心脏"
2. **工具系统** — 至少需要文件读写、终端执行、浏览器控制三类工具
3. **模型传输层** — 至少支持 OpenAI 兼容接口（覆盖大多数提供商）
4. **会话管理** — 消息历史持久化（浏览器可用 IndexedDB）
5. **系统提示词组装** — 身份 + 上下文 + 工具指导

### 可以后续迭代的
6. **上下文压缩** — 长对话必需，但初期可以限制对话长度
7. **记忆系统** — 跨会话记忆，初期可用简单的 localStorage
8. **技能系统** — 可复用的工作流模板
9. **子 Agent 委派** — 并行任务处理
10. **多平台网关** — 浏览器端只需 WebSocket

### 浏览器端的技术选型建议
- **终端模拟**：xterm.js（已有成熟的 WebAssembly 方案）
- **文件系统**：Web File System Access API 或虚拟文件系统
- **数据库**：IndexedDB（会话存储）、WebSQL（如果需要全文搜索）
- **通信**：WebSocket 连接后端 Agent 服务
- **UI 框架**：React/Vue + Monaco Editor（代码编辑）

---

## 七、文件规模参考

| 文件 | 行数 | 职责 |
|------|------|------|
| `run_agent.py` | ~12,800 | Agent 核心循环 |
| `cli.py` | ~11,000 | CLI 交互层 |
| `gateway/run.py` | ~11,200 | 网关运行器 |
| `hermes_state.py` | ~1,700 | 会话存储 |
| `agent/prompt_builder.py` | ~1,100 | 提示词组装 |
| `agent/context_compressor.py` | ~1,300 | 上下文压缩 |
| `tools/registry.py` | ~480 | 工具注册表 |
| `toolsets.py` | ~760 | 工具集定义 |
| `agent/memory_manager.py` | ~410 | 记忆管理 |
| `agent/transports/` | ~5 文件 | 传输适配器 |

总计约 **50,000+ 行 Python 代码**（不含测试和文档）。

---

*分析时间：2026-05-09*
*源码路径：/home/emyake/.hermes/hermes-agent/*
*基于实际源码阅读，非推测*
