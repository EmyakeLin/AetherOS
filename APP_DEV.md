# N.O.V.A Aether OS — 应用开发指南

## 快速开始

### 方式一：通过设置界面创建

1. 打开 **设置** → **应用管理**
2. 填写应用 ID、标题、图标、描述
3. 点击 **创建应用**
4. 在 `static/apps/{id}/` 中编辑生成的 JS 文件

### 方式二：手动创建

在 `static/apps/` 下新建文件夹，包含 `app.json` 和入口 JS 文件：

```
static/apps/my-app/
├── app.json        # 必须
├── my-app.js       # 必须（入口 JS）
├── style.css       # 可选
└── icon.svg        # 可选
```

### 方式三：通过 API 创建

```bash
curl -X POST http://localhost:8420/api/apps \
  -H "Content-Type: application/json" \
  -d '{"id":"my-app","title":"我的应用","emoji":"🎯","description":"应用描述"}'
```

---

## 应用清单 (`app.json`)

```json
{
    "id": "my-app",
    "title": "我的应用",
    "icon": "/apps/my-app/icon.svg",
    "emoji": "🎯",
    "entry": "my-app.js",
    "version": "1.0.0",
    "author": "user",
    "description": "应用功能描述",
    "dock": true,
    "width": 800,
    "height": 500
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 唯一标识，与文件夹名一致，仅允许字母、数字、连字符、下划线 |
| `title` | string | 是 | 窗口标题和 Dock 显示名 |
| `icon` | string | 否 | SVG 图标路径（如 `/apps/my-app/icon.svg`），优先于 emoji |
| `emoji` | string | 否 | Emoji 回退图标，默认 `📦` |
| `entry` | string | 否 | 入口 JS 文件名，默认 `{id}.js` |
| `version` | string | 否 | 版本号，默认 `1.0.0` |
| `author` | string | 否 | 作者，默认 `user` |
| `description` | string | 否 | 应用描述 |
| `dock` | bool | 否 | 是否显示在 Dock 栏，默认 `true` |
| `width` | number | 否 | 默认窗口宽度，默认 `800` |
| `height` | number | 否 | 默认窗口高度，默认 `500` |

---

## 入口 JS 文件

入口文件必须调用全局函数 `registerApp()` 注册应用：

```javascript
registerApp('my-app', {
    title: '我的应用',
    icon: '🎯',
    factory: (container, win, os) => {
        // 在这里构建应用 UI
    }
});
```

### registerApp 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 应用 ID，必须与 `app.json` 中的 `id` 一致 |
| `config` | object | 应用配置对象 |

### config 对象

```javascript
{
    title: string,          // 窗口标题（可选，覆盖 app.json）
    icon: string,           // 图标（可选，覆盖 app.json）
    options: {              // 窗口初始位置/尺寸（可选，覆盖 app.json）
        x: number,
        y: number,
        w: number,
        h: number
    },
    factory: Function       // 必须，应用初始化函数
}
```

---

## Factory 函数

Factory 是应用的核心，在窗口打开时被调用。接收三个参数：

```javascript
factory: (container, win, os) => { ... }
```

### 参数 `container` (HTMLElement)

窗口内容区的 DOM 元素，已设置 `width:100%; height:100%; display:flex; flex-direction:column;`。

直接操作此元素来构建应用 UI：

```javascript
container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;background:var(--bg-surface);">
        <div style="padding:16px;border-bottom:1px solid var(--border);">
            应用标题
        </div>
        <div style="flex:1;overflow:auto;padding:16px;">
            应用内容
        </div>
    </div>
`;
```

### 参数 `win` (OSWindow)

窗口实例，提供以下 API：

| 方法/属性 | 说明 |
|-----------|------|
| `win.id` | 窗口唯一 ID |
| `win.appId` | 应用 ID |
| `win.setTitle(title)` | 修改窗口标题 |
| `win.emit(event, data)` | 发送自定义事件 |
| `win.on(event, handler)` | 监听自定义事件 |
| `win.close()` | 关闭窗口 |
| `win.minimize()` | 最小化 |
| `win.toggleMaximize()` | 最大化/还原 |

**事件通信示例**（IDE 通过事件接收文件管理器的打开请求）：

```javascript
// 发送方（文件管理器）
ideWin.emit('open-file', { path: '/path/to/file.js' });

// 接收方（IDE）
win.on('open-file', ({ path }) => {
    openFile(path);
});
```

### 参数 `os` (AetherOS)

全局 OS 实例，提供以下 API：

| 方法/属性 | 说明 |
|-----------|------|
| `os.api(method, path, body?)` | HTTP 请求，返回 JSON |
| `os.ws(path, handlers)` | WebSocket 连接 |
| `os.openApp(appId)` | 打开另一个应用 |
| `os.toggleSidebar()` | 切换侧边栏 |
| `os.registerModelCall(call)` | 注册模型调用记录 |
| `os.updateModelCall(id, updates)` | 更新调用记录 |
| `os.removeModelCall(id)` | 移除调用记录 |
| `os.registerAgentPanel(agent)` | 注册 Agent 面板 |
| `os.updateAgentPanel(id, updates)` | 更新 Agent 面板 |
| `os.removeAgentPanel(id)` | 移除 Agent 面板 |
| `os.focusWindow(id)` | 聚焦指定窗口 |
| `os.modelCalls` | 当前活跃模型调用列表 |
| `os.callHistory` | 历史调用记录 |
| `os.agentPanels` | Agent 面板 Map |

---

## 后端 API

### 应用管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/apps` | GET | 获取所有已安装应用列表 |
| `/api/apps` | POST | 创建新应用 |
| `/api/apps/{id}` | PUT | 更新应用元数据 |
| `/api/apps/{id}` | DELETE | 删除应用 |

### 文件系统

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/fs/list?path=` | GET | 列目录 |
| `/api/fs/read?path=` | GET | 读文件 |
| `/api/fs/write` | PUT | 写文件 `{path, content}` |
| `/api/fs/mkdir` | POST | 创建目录 `{path}` |
| `/api/fs/delete?path=` | DELETE | 删除文件/目录 |
| `/api/fs/search` | POST | 全文搜索 `{query, path}` |

### 代码执行

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/exec` | POST | 执行命令 `{command, cwd?, timeout?}`，返回 `{stdout, stderr, exit_code}` |

### WebSocket

| 端点 | 说明 |
|------|------|
| `/ws/terminal/{session_id}` | PTY 终端 |
| `/ws/agent/custom/{agent_id}` | Agent 引擎 |
| `/ws/monitor` | 系统监控心跳 |

---

## CSS 变量

应用应使用系统 CSS 变量以自动适配主题：

```css
/* 背景 */
var(--bg-deep)        /* 最深层背景 */
var(--bg-base)        /* 基础背景 */
var(--bg-surface)     /* 表面背景 */
var(--bg-elevated)    /* 抬高背景 */
var(--bg-hover)       /* 悬停背景 */

/* 强调色 */
var(--accent)         /* 主强调色 */
var(--accent-dim)     /* 暗强调色 */
var(--accent-glow)    /* 强调色辉光 */
var(--accent-secondary) /* 次强调色 */
var(--accent-warm)    /* 警告/错误色 */

/* 文本 */
var(--text-primary)   /* 主文本 */
var(--text-secondary) /* 次文本 */
var(--text-muted)     /* 弱文本 */

/* 边框 */
var(--border)         /* 默认边框 */
var(--border-active)  /* 激活边框 */

/* 圆角 */
var(--radius-sm)      /* 6px */
var(--radius-md)      /* 10px */
var(--radius-lg)      /* 14px */
var(--radius-xl)      /* 20px */

/* 字体 */
var(--font-mono)      /* 等宽字体 */
var(--font-display)   /* 展示字体 */
var(--font-body)      /* 正文字体 */
```

使用变量后，应用在深色/浅色主题下自动适配，无需额外处理。

---

## 完整示例

### 计数器应用

**`static/apps/counter/app.json`**：

```json
{
    "id": "counter",
    "title": "计数器",
    "emoji": "🔢",
    "entry": "counter.js",
    "description": "一个简单的计数器应用",
    "dock": true,
    "width": 400,
    "height": 300
}
```

**`static/apps/counter/counter.js`**：

```javascript
registerApp('counter', {
    title: '计数器',
    icon: '🔢',
    factory: (container, win, os) => {
        let count = 0;

        container.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;background:var(--bg-surface);align-items:center;justify-content:center;gap:24px;">
                <div id="counter-value" style="font-size:72px;font-family:var(--font-mono);font-weight:700;color:var(--accent);">0</div>
                <div style="display:flex;gap:12px;">
                    <button id="counter-dec" style="padding:10px 24px;font-size:18px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-primary);cursor:pointer;">−</button>
                    <button id="counter-reset" style="padding:10px 24px;font-size:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-secondary);cursor:pointer;">重置</button>
                    <button id="counter-inc" style="padding:10px 24px;font-size:18px;background:var(--accent-glow);border:1px solid var(--accent-dim);border-radius:var(--radius-md);color:var(--accent);cursor:pointer;">+</button>
                </div>
            </div>
        `;

        const display = container.querySelector('#counter-value');
        const update = () => { display.textContent = count; };

        container.querySelector('#counter-inc').addEventListener('click', () => { count++; update(); });
        container.querySelector('#counter-dec').addEventListener('click', () => { count--; update(); });
        container.querySelector('#counter-reset').addEventListener('click', () => { count = 0; update(); });
    }
});
```

---

## 应用生命周期

1. **发现**：OS 启动时调用 `GET /api/apps` 扫描所有 `app.json`
2. **加载**：为每个应用动态插入 `<script>` 标签加载入口 JS
3. **注册**：入口 JS 执行 `registerApp()`，将 config 存入 `AppRegistry`
4. **打开**：用户点击 Dock 或调用 `os.openApp(id)`，创建窗口并调用 `factory()`
5. **运行**：factory 函数构建 UI、绑定事件、建立连接
6. **关闭**：窗口关闭时 DOM 被移除，WebSocket 等连接需在 `win.on('close', ...)` 中手动清理

---

## API 快速参考

```bash
# 列出所有应用
curl http://localhost:8420/api/apps

# 创建应用
curl -X POST http://localhost:8420/api/apps \
  -H "Content-Type: application/json" \
  -d '{"id":"demo","title":"演示","emoji":"✨","description":"演示应用"}'

# 更新应用
curl -X PUT http://localhost:8420/api/apps/demo \
  -H "Content-Type: application/json" \
  -d '{"title":"新标题","emoji":"🎉"}'

# 删除应用
curl -X DELETE http://localhost:8420/api/apps/demo

# 执行命令
curl -X POST http://localhost:8420/api/exec \
  -H "Content-Type: application/json" \
  -d '{"command":"python3 /path/to/script.py"}'
```
