# Agent 上下文管理系统开发记录

**日期**: 2026-05-11
**目标**: 实现高效的上下文管理，减少 token 消耗，保持逻辑连贯性

---

## 一、开发成果

### 1. 新增文件

#### `agent/context_manager.py`
上下文管理模块，实现了以下核心机制：

- **工具调用参数缩减**: 成功的 write_file/patch 调用参数替换为 `[omitted: X chars]`
- **文件过期通知 (Cache-Aware State Notification)**: 文件被修改时，在用户消息末尾追加变更通知
- **墓碑化 (Tombstoning)**: 文件被重新读取时，历史 read_file 结果替换为 `[此文件内容已过期，新版文件请见下文]`
- **分块合并 (Context Defragmentation)**: 同一文件多次分块读取时，合并结果并标记未读区域
- **失败调用清理**: 失败的工具调用在重试成功后从消息历史中移除
- **系统提示词规则注入**: 提供上下文管理规则，指导模型正确处理重试和文件状态

### 2. 修改文件

#### `agent/engine.py`
- 集成 `ContextManager`，在 LLM 调用前处理消息
- 完整持久化所有消息到 SQLite（user, assistant, tool, tool_calls）
- 适配 LLM service 返回的两种 tool_calls 格式
- 确保 tool_calls 包含 `type: "function"` 字段

#### `agent/storage.py`
- 重构 `add_message` 方法，支持完整消息结构
- 新增字段: `tool_call_id`, `tool_calls`, `tool_name`, `reasoning_content`
- 新增 `get_messages_as_conversation` 方法，返回 LLM 可用的 conversation 格式
- 启用 WAL 模式支持并发读取

#### `agent/context.py`
- 在系统提示词末尾追加上下文管理规则

#### `server.py`
- WebSocket 连接支持 `session_id` 消息类型
- 切换 session 时从 SQLite 加载历史消息到内存
- 导入 `FileContextManager` 和 `logger`

#### `static/apps/agent/agent.js`
- 发送消息时包含 `session_id`
- 切换 session 时通知后端加载历史消息
- WebSocket 连接建立时发送当前 session_id

### 3. 数据库变更

```sql
ALTER TABLE messages ADD COLUMN tool_call_id TEXT;
ALTER TABLE messages ADD COLUMN tool_calls TEXT;
ALTER TABLE messages ADD COLUMN tool_name TEXT;
ALTER TABLE messages ADD COLUMN reasoning_content TEXT;
ALTER TABLE sessions ADD COLUMN system_prompt TEXT;
```

---

## 二、架构设计

### 消息流程

```
用户消息
    ↓
ContextManager.build_messages() → 构建系统提示词 + 历史消息
    ↓
FileContextManager.process_messages() → 缩减参数、清理失败调用、注入通知
    ↓
LLM API 调用
    ↓
响应处理
    ├─ 工具调用 → 执行工具 → 持久化到 SQLite → 继续循环
    └─ 纯文本 → 持久化到 SQLite → 返回最终响应
```

### 存储结构

```sql
-- 会话表
sessions (id, title, created_at, updated_at, message_count, system_prompt)

-- 消息表（完整记录）
messages (id, session_id, role, content, tool_call_id, tool_calls, tool_name, reasoning_content, timestamp)
```

### 上下文管理规则（注入系统提示词）

1. 失败的工具调用必须引用调用 ID 重试
2. 文件修改后会收到变更通知
3. 历史 read_file 结果可能被标记为过期
4. 分块读取会自动合并

---

## 三、调试方法

### 查看完整消息记录

```bash
# 查看某个 session 的所有消息
sqlite3 ~/.aetheros/data/agent.db "SELECT role, tool_name, substr(content, 1, 80) FROM messages WHERE session_id='你的session-id' ORDER BY timestamp;"

# 查看 tool_calls 详情
sqlite3 ~/.aetheros/data/agent.db "SELECT tool_calls FROM messages WHERE tool_calls IS NOT NULL AND session_id='你的session-id';"
```

### 查看日志文件

```bash
# 实时监控
tail -f ~/.aetheros/data/agent_messages.jsonl

# 查看最新记录
tail -1 ~/.aetheros/data/agent_messages.jsonl | python3 -m json.tool
```

---

## 四、已知问题

1. **重启后内存清空**: 需要切换 session 才能加载历史消息到内存
2. **数据库表结构**: 旧数据库需要手动添加新列（已通过 ALTER TABLE 解决）
3. **tool_calls 格式**: LLM service 返回的格式不统一，需要适配两种格式

---

## 五、参考

- 设计文档: `Eos Agent Development/Eos-Context系统设计.md`
- Hermes Agent 架构分析: `~/桌面/hermes-agent-架构分析.md`
