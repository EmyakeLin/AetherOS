# Aether OS

一个基于浏览器的桌面操作系统，集成 AI Agent，使用 Python FastAPI 后端和原生 JavaScript 前端。

## 功能特性

- **桌面环境** - 窗口管理、任务栏、多桌面
- **文件管理器** - 服务器端文件系统浏览和编辑
- **终端模拟器** - 完整的 PTY 终端支持
- **代码编辑器** - 基于 Monaco Editor 的 IDE
- **AI Agent** - 支持 Anthropic/OpenAI API 的智能助手，实时 token 统计，上下文自动管理
- **应用商店** - 可扩展的应用架构
- **主题系统** - 暗色/亮色主题切换
- **低性能模式** - 禁用毛玻璃和动画，提升老旧设备流畅度

## 系统要求

- Python 3.10+（Windows 7 需要 Python 3.8.10）
- 现代浏览器（Chrome/Firefox/Safari/Edge）

## 快速开始

### Linux / macOS

```bash
# 克隆仓库
git clone https://github.com/EmyakeLin/AetherOS.git
cd AetherOS

# 启动（自动创建虚拟环境和安装依赖）
./start.sh
```

### Windows

```cmd
# 克隆仓库
git clone https://github.com/EmyakeLin/AetherOS.git
cd AetherOS

# 启动（自动创建虚拟环境和安装依赖）
start.bat
```

### Windows 7

```cmd
# 克隆仓库
git clone https://github.com/EmyakeLin/AetherOS.git
cd AetherOS

# 启动（使用 Win7 专用脚本，自动创建 .venv-win7）
start-win7.bat
```

首次运行会自动：
1. 创建 Python 虚拟环境（`.venv/` 或 `.venv-win7/`）
2. 安装所需依赖
3. 启动服务器并打开浏览器

## 启动选项

### Linux / macOS

```bash
# 默认端口 8411
./start.sh

# 自定义端口
./start.sh 8420

# 低性能模式启动
./start-lowperf.sh

# 停止服务器
./stop.sh
```

### Windows

```cmd
# 默认端口 8411
start.bat

# 自定义端口
start.bat 8420

# 低性能模式启动
start-lowperf.bat

# 停止服务器
stop.bat
```

### Windows 7

```cmd
# 默认端口 8411
start-win7.bat

# 自定义端口
start-win7.bat 8420

# 下载离线依赖（用于无网络环境）
download_deps_win7.bat
```

启动后访问 `http://localhost:8411`（或自定义端口）。

## 低性能模式

低性能模式专为老旧设备或资源受限环境设计，通过以下优化提升流畅度：

- **禁用毛玻璃效果** - 移除 `backdrop-filter`，减少 GPU 负载
- **简化动画** - 减少或禁用过渡动画
- **移除背景效果** - 隐藏桌面网格和 canvas 动画
- **减少阴影** - 简化多层阴影效果
- **加速启动** - Boot 动画时间缩短 4 倍

### 使用方式

1. **启动脚本** - 使用 `start-lowperf.sh`（Linux/macOS）或 `start-lowperf.bat`（Windows）
2. **系统设置** - 在 设置 → 外观 → 性能模式 中手动切换
3. **自动检测** - 系统会自动检测移动设备和低核心数 CPU

### 启动参数

```bash
# 通过命令行参数启用
python server.py --port 8411 --low-perf

# 通过 URL 参数启用
http://localhost:8411/?low_perf=1
```

## 手动安装

如果自动安装失败，可以手动操作：

```bash
# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate  # Linux/macOS
# 或
.venv\Scripts\activate.bat  # Windows

# 安装依赖
pip install -r requirements.txt

# 启动服务器
python server.py --port 8411
```

## 配置

### AI Agent

Agent 支持流式传输、工具调用、会话持久化、实时 token 统计。配置文件位于 `agent/config.yaml`。

功能：
- **流式传输** - 实时显示模型输出和思维链
- **工具调用** - 文件读写、代码搜索、终端执行（含安全黑名单）
- **会话持久化** - SQLite + JSON 存储，支持多会话切换
- **Token 统计** - header 栏实时显示 input/output/total tokens 和上下文占用百分比
- **上下文管理** - 自动推断模型上下文限制，智能压缩过期文件内容

### LLM 模型

在 设置 → LLM 模型 中配置 Provider 和模型，支持：
- OpenAI 兼容 API
- Anthropic API
- 自定义 API 端点

模型配置支持可选的 `context_limit` 字段，未配置时自动从模型名称推断。

### 主题

在系统设置中切换暗色/亮色主题，或通过 CSS 自定义变量修改。默认主题为亮色。

## 项目结构

```
AetherOS/
├── server.py           # FastAPI 后端服务
├── start.sh            # Linux/macOS 启动脚本
├── start.bat           # Windows 启动脚本
├── start-win7.bat      # Windows 7 专用启动脚本
├── start-lowperf.sh    # Linux/macOS 低性能模式启动
├── start-lowperf.bat   # Windows 低性能模式启动
├── stop.sh             # Linux/macOS 停止脚本
├── stop.bat            # Windows 停止脚本
├── requirements.txt    # Python 依赖（Linux/Mac/Win10+）
├── requirements-win7.txt # Win7 兼容依赖
├── download_deps_win7.bat # Win7 离线依赖下载
├── compat/             # 平台兼容层
│   └── pty_compat.py   # PTY 兼容层（Unix/Win7）
├── static/
│   ├── index.html      # 主页面
│   ├── core/           # 核心系统（OS、窗口管理）
│   ├── apps/           # 内置应用
│   └── lib/            # 第三方库（Monaco Editor）
├── agent/              # AI Agent 引擎
│   ├── engine.py       # Agent 循环（流式、中断、并行工具）
│   ├── context.py      # 上下文管理（token 统计、智能压缩）
│   ├── storage.py      # 会话持久化（JSON + SQLite）
│   ├── tools/          # 内置工具（文件、搜索、终端）
│   └── skills/         # Skill 系统
├── llm/                # 统一 LLM 服务
│   └── service.py      # Provider 管理、流式调用、图像生成
└── eos_tools/          # 文件操作工具集
```

## 内置应用

- **文件管理** - 浏览和管理服务器文件
- **终端** - 命令行终端
- **代码编辑** - Monaco Editor 代码编辑器
- **AI 助手** - 智能对话助手（支持流式传输、工具调用、会话持久化）
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

## 安全说明

服务器默认绑定 `127.0.0.1`，仅本机可访问。如需局域网访问，使用 `--host 0.0.0.0` 显式开启。

Agent 终端工具内置命令安全黑名单，拦截 `rm -rf /`、fork bomb、`curl|sh` 等危险模式。

## 更新日志

### v1.3.0a (2026-05-18)

- **Token 统计** - Agent header 栏实时显示 input/output/total tokens 和上下文占用百分比
- **上下文限制自动推断** - 从模型名称智能推断上下文窗口大小，支持手动配置覆盖
- **安全加固** - 默认绑定 127.0.0.1，终端命令黑名单，bare except 修复，临时文件安全
- **新对话优化** - 点击"新对话"跳转首页，首次发消息才创建 session
- **Eos Agent 退役** - 独立后端移至废案目录，功能已合并至主 Agent

### v1.2.1 (2026-05-13)

- **Windows 7 兼容** - 新增 `start-win7.bat` 专用启动脚本
- **PTY 兼容层** - 新增 `compat/pty_compat.py`，Unix 使用 ptyprocess，Win7 使用 pywinpty
- **离线依赖** - 新增 `download_deps_win7.bat` 和 `requirements-win7.txt`，支持无网络安装
- **依赖降级** - Win7 版本使用 Python 3.8.10 兼容的依赖版本

### v1.1.1 (2026-05-12)

- **Windows 适配** - 新增 `start.bat`、`stop.bat`、`start-lowperf.bat` 启动脚本
- **低性能模式** - 新增低性能模式，禁用毛玻璃和动画，提升老旧设备流畅度
- **默认亮色主题** - 默认主题从暗色改为亮色，提升可读性
- **自动性能检测** - 自动检测移动设备和低核心数 CPU，启用低性能模式
- **Agent 优化** - 修复 Windows 平台 GBK 编码问题

### v1.0.0

- 初始版本发布
- 桌面环境、窗口管理、多应用支持
- AI Agent 引擎，支持 Anthropic/OpenAI API
- 会话持久化存储
- Monaco Editor 集成

## 许可证

MIT License
