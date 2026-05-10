# Agent 应用开发记录 — 会话持久化

**日期**：2026-05-10
**版本**：1.0.0 → 1.1.0
**目标**：实现 Agent 会话持久化，消息存储到 SQLite

---

## 一、架构决策

### 存储方案选型

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 前端 IndexedDB | 纯前端，不改后端 | 不支持跨设备，无 SQL 能力 | ❌ |
| 前端 sql.js | 支持 SQL | 需加载 1MB WASM，数据仍在浏览器 | ❌ |
| 后端 SQLite + 通用 API | 与 Hermes 架构一致，性能好，可跨设备 | 需改 server.py | ✅ |

### 关键设计决策

1. **通用数据库 API**：server.py 提供 `/api/db/{database}/query|execute` 端点，任何 app 都可使用
2. **Agent 存储封装**：`agent/storage.py` 封装 Agent 专用的 CRUD 逻辑
3. **数据目录**：`~/.aether/data/` 统一存放数据库文件
4. **安全限制**：禁止 DROP/ALTER/ATTACH，只允许 `~/.aether/data/` 下的数据库

---

## 二、实现内容

### 新增文件

**`agent/storage.py`** (150行)
- `AgentStorage` 类：SQLite 封装
- `init_db()` — 建表（sessions + messages）
- `create_session(title)` / `get_session(id)` / `list_sessions()`
- `update_session(id, updates)` / `delete_session(id)`
- `add_message(session_id, role, content)` / `get_messages(session_id)`
- 全局单例 `get_storage()`

### 修改文件

**`server.py`**
- 新增区域 11：通用数据库 API
  - `POST /api/db/{database}/query` — SELECT 查询
  - `POST /api/db/{database}/execute` — INSERT/UPDATE/DELETE
- 新增 Agent 会话管理端点（7个）
  - `GET/POST /api/agent/sessions`
  - `GET/PUT/DELETE /api/agent/sessions/{id}`
  - `GET/POST /api/agent/sessions/{id}/messages`
- 启动事件 `init_agent_storage()` 自动建表

**`static/apps/agent/agent.js`** (295行 → 538行)
- 新增会话侧边栏 UI（240px，可折叠）
- 新增会话管理函数：`loadSessions()`, `createNewSession()`, `switchSession()`, `deleteSession()`
- 修改 `addMessage()` 支持 `skipPersist` 参数
- 新增 `persistMessage()` 自动保存消息到后端
- 新增 `finishAssistantMessage()` 在 Agent 回复完成时持久化
- 自动标题生成：首条用户消息前 30 字符

**`static/apps/agent/app.json`**
- 版本号：1.0.0 → 1.1.0

**`requirements.txt`**
- 添加 `aiosqlite>=0.19.0`

---

## 三、数据库设计

**数据库文件**：`~/.aether/data/agent.db`

```sql
-- 会话表
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,           -- 格式: session-{timestamp}-{random}
    title TEXT NOT NULL DEFAULT '新会话',
    created_at INTEGER NOT NULL,   -- Date.now() 毫秒
    updated_at INTEGER NOT NULL,
    message_count INTEGER DEFAULT 0
);

-- 消息表
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,            -- 'user' | 'assistant' | 'system'
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_session ON messages(session_id, timestamp);
```

---

## 四、API 接口

### 通用数据库 API

```
POST /api/db/{database}/query
Body: {"sql": "SELECT * FROM sessions", "params": []}
Response: {"rows": [...], "columns": [...]}

POST /api/db/{database}/execute
Body: {"sql": "INSERT INTO ...", "params": [...]}
Response: {"rows_affected": N, "last_row_id": N}
```

### Agent 会话 API

```
GET    /api/agent/sessions              → {"sessions": [...]}
POST   /api/agent/sessions              → session object
GET    /api/agent/sessions/{id}         → session object
PUT    /api/agent/sessions/{id}         → session object
DELETE /api/agent/sessions/{id}         → {"ok": true}
GET    /api/agent/sessions/{id}/messages → {"messages": [...]}
POST   /api/agent/sessions/{id}/messages → message object
```

---

## 五、UI 变更

### 会话侧边栏

```
┌──────────────────┐
│ 会话列表    [+新] │  ← 顶部栏
├──────────────────┤
│ ▶ 当前会话标题    │  ← 活跃会话高亮
│   3条消息 · 刚刚  │
├──────────────────┤
│   历史会话标题    │
│   12条消息 · 昨天 │
└──────────────────┘
```

- 宽度 240px，可折叠
- 活跃会话：`accent-glow` 背景 + `accent-dim` 边框
- 悬停显示删除按钮（右侧，红色）
- 点击切换会话

### 聊天面板顶部

新增工具栏：
- 左侧：折叠按钮（三横线图标）
- 右侧：当前会话标题

---

## 六、状态管理

```javascript
let currentSessionId = null;  // 当前活跃会话 ID
let sessionCache = [];        // 会话列表缓存
```

### 状态转换

```
页面加载 → loadSessions() → switchSession(最近会话) 或 createNewSession()
发送消息 → persistMessage() → 更新 sessionCache → renderSessionList()
切换会话 → 清空 DOM → GET 消息 → 渲染
新建会话 → POST 创建 → 清空聊天 → 显示欢迎消息
删除会话 → DELETE → 切换到其他会话 或 新建
```

---

## 七、技术要点

1. **factory 是同步函数**：os.js 中 `reg.factory(contentEl, win, this)` 无 await，所以 UI 骨架先渲染，异步操作用 `.then()` 链
2. **消息持久化时机**：用户消息在 `addMessage()` 时持久化，Agent 消息在 `finishAssistantMessage()` 时持久化
3. **WebSocket 与会话独立**：agentId 与 sessionId 分离，会话切换不需要重连 WebSocket
4. **自动标题**：首条用户消息的前 30 字符，替换换行为空格

---

## 八、待完善

- [ ] Agent 引擎上下文恢复（重连后将历史消息注入 context）
- [ ] 会话搜索功能（利用 SQLite FTS5）
- [ ] 消息分页加载（长会话性能优化）
- [ ] 会话导出/导入
- [ ] 通用 DB API 的前端封装（供其他 app 使用）

---

*开发时间：2026-05-10*
*涉及文件：agent/storage.py, server.py, agent.js, app.json, requirements.txt*
