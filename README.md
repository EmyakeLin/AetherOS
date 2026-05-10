# Aether OS

一个基于浏览器的桌面操作系统，集成 AI Agent，使用 Python FastAPI 后端和原生 JavaScript 前端。

## 功能特性

- **桌面环境** - 窗口管理、任务栏、多桌面
- **文件管理器** - 服务器端文件系统浏览和编辑
- **终端模拟器** - 完整的 PTY 终端支持
- **代码编辑器** - 基于 Monaco Editor 的 IDE
- **AI Agent** - 支持 Anthropic/OpenAI API 的智能助手
- **应用商店** - 可扩展的应用架构
- **主题系统** - 暗色/亮色主题切换

## 系统要求

- Python 3.10+
- 现代浏览器（Chrome/Firefox/Safari/Edge）

## 安装

```bash
# 克隆仓库
git clone https://github.com/EmyakeLin/AetherOS.git
cd AetherOS

# 启动（自动创建虚拟环境和安装依赖）
./start.sh
```

首次运行会自动：
1. 创建 Python 虚拟环境（`.venv/`）
2. 安装所需依赖
3. 启动服务器并打开浏览器

## 启动选项

```bash
# 默认端口 8411
./start.sh

# 自定义端口
./start.sh 8420

# 停止服务器
./stop.sh
```

启动后访问 `http://localhost:8411`（或自定义端口）。

## 手动安装

如果自动安装失败，可以手动操作：

```bash
# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务器
python server.py --port 8411
```

## 配置

### AI Agent

Agent 配置文件位于 `agent/config.yaml`，需要配置 API 密钥：

```yaml
providers:
  anthropic:
    api_key: "your-api-key"
  openai:
    api_key: "your-api-key"
```

### 主题

在系统设置中切换暗色/亮色主题，或通过 CSS 自定义变量修改。

## 项目结构

```
AetherOS/
├── server.py           # FastAPI 后端服务
├── start.sh            # 启动脚本
├── stop.sh             # 停止脚本
├── requirements.txt    # Python 依赖
├── static/
│   ├── index.html      # 主页面
│   ├── core/           # 核心系统（OS、窗口管理）
│   ├── apps/           # 内置应用
│   └── lib/            # 第三方库（Monaco Editor）
├── agent/              # AI Agent 引擎
│   ├── engine.py       # Agent 循环
│   ├── context.py      # 上下文管理
│   └── tools/          # 工具注册表
└── docs/               # 文档
```

## 内置应用

- **文件管理** - 浏览和管理服务器文件
- **终端** - 命令行终端
- **代码编辑** - Monaco Editor 代码编辑器
- **AI 助手** - 智能对话助手
- **浏览器** - 内嵌网页浏览器
- **系统监控** - 资源监控面板
- **设置** - 系统配置
- **Cards** - 卡片式笔记应用

## 开发

项目无需构建步骤，前端代码直接作为静态文件服务。

添加新应用：
1. 在 `static/apps/` 创建应用目录
2. 添加 `app.json` 清单文件
3. 实现 `{app-id}.js` 入口文件

详见 `CLAUDE.md` 开发指南。

## 许可证

MIT License
