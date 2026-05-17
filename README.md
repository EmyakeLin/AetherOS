# N.O.V.A Aether OS

一个运行在浏览器里的桌面操作系统，内置 AI 助手。

打开浏览器，你就有了一个完整的桌面环境——窗口管理、文件管理器、终端、代码编辑器、AI 对话，全部在一个页面里完成。

## 快速开始

```bash
git clone https://github.com/EmyakeLin/AetherOS.git
cd AetherOS
./start.sh          # Linux/macOS
start.bat           # Windows 10+
start-win7.bat      # Windows 7
```

首次运行会自动安装依赖。启动后访问 `http://localhost:8411`。

## 它能做什么

**桌面环境** — 窗口拖拽、缩放、吸附到屏幕边缘、最小化/最大化/关闭，和真实桌面一样操作。

**AI 助手** — 和 AI 对话，它能读写你的文件、执行终端命令、搜索网页、编辑代码。支持 DeepSeek、OpenAI、Claude 等多种模型，流式输出实时显示。

**文件管理** — 浏览、编辑、上传文件，支持全文搜索。

**终端** — 真实的终端，不是模拟的。支持后台运行、多会话。

**代码编辑器** — 基于 Monaco Editor（VS Code 同款内核），语法高亮、代码补全。

**浏览器** — 内嵌网页浏览器，支持多标签页。

**卡片笔记** — 用卡片整理思路，支持 AI 辅助。

**系统监控** — 实时查看 Agent 运行状态和 Token 消耗。

## 配置 AI 模型

启动后打开 **设置 → LLM 模型**，添加你的 API Key 即可。支持：

- **DeepSeek** — 国产模型，性价比高
- **OpenAI** — GPT-4o 等
- **Anthropic** — Claude 系列
- **任意 OpenAI 兼容 API** — 自定义端点

模型配置存储在 `~/.aetheros/llm/config.json`，也可以直接在界面上操作。

## 主题

三种主题可选，在设置里切换：

- **亮色** — 默认，清爽明亮
- **暗色** — 护眼深色
- **Kinetic** — 动态光标特效，磁吸交互

## 低性能模式

老电脑或资源紧张时，启动低性能模式：

```bash
./start-lowperf.sh      # Linux/macOS
start-lowperf.bat       # Windows
```

会自动关闭毛玻璃、动画等效果。系统也会自动检测低配设备并启用。

## 项目结构

```
AetherOS/
├── server.py           # 后端服务（一个文件搞定）
├── start.sh / start.bat
├── static/
│   ├── index.html      # 整个 OS 的入口
│   ├── core/           # 桌面系统核心
│   ├── apps/           # 内置应用（每个应用一个文件夹）
│   └── lib/            # Monaco Editor
├── agent/              # AI Agent 引擎
├── llm/                # LLM 服务层
└── eos_tools/          # 文件操作工具
```

## 安全说明

- 默认只监听 `127.0.0.1`，局域网无法访问。需要局域网访问请加 `--host 0.0.0.0`
- AI 终端工具有危险命令黑名单（`rm -rf /`、fork bomb 等）
- API Key 在接口返回时自动脱敏

## 系统要求

- Python 3.10+（Windows 7 用 Python 3.8.10）
- 现代浏览器（Chrome / Firefox / Safari / Edge）

## 许可证

MIT License

## 更多

详细架构文档见 [docs/architecture.md](./docs/architecture.md)
