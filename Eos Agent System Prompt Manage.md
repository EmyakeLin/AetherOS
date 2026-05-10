# Eos Agent 系统提示词管理指南

## 文件结构

```
AetherOS/
├── agent/
│   ├── prompts.json      ← 提示词内容（主要编辑文件）
│   ├── prompt_builder.py ← 提示词组装逻辑（一般不需要改）
│   ├── config.yaml       ← Agent 配置（模型、语言等）
│   └── engine.py         ← Agent 引擎（一般不需要改）
└── Eos Agent System Prompt Manage.md  ← 本文档
```

## prompts.json 字段说明

### 静态段落（会话期间不变，可缓存）

| 字段 | 作用 | 示例 |
|------|------|------|
| `identity` | Agent 身份声明 | "You are Eos Agent, an intelligent AI assistant..." |
| `platform` | 运行平台描述 | "# Platform\nYou run in AetherOS..." |
| `system_rules` | 系统级规则 | 工具权限、system-reminder 标签、上下文压缩说明 |
| `doing_tasks` | 任务执行指南 | 代码风格、不过度工程、安全编码规范 |
| `actions` | 操作谨慎性指南 | 破坏性操作需确认、风险操作示例 |
| `tool_usage` | 工具使用指南 | 必须调用工具、并行执行、不要只描述不执行 |
| `tone_style` | 语气风格 | 无 emoji、简洁、引用代码时带文件路径 |
| `output_efficiency` | 输出效率指南 | 直奔主题、简洁直接、关注决策和状态更新 |

### 动态段落（每轮可能变化）

| 字段 | 作用 | 模板变量 |
|------|------|----------|
| `language_template` | 语言偏好指令 | `{language}` |
| `env_info_template` | 环境信息 | `{cwd}`, `{is_git}`, `{platform}`, `{model}` |

### 特殊字段

| 字段 | 作用 | 说明 |
|------|------|------|
| `agent_prompt` | Agent 模式提示词 | 当 Eos Agent 被 API 或其他系统调用时使用（非用户直接对话）。用于简洁的任务完成场景，完成后返回报告。当前主会话模式不使用此字段。 |

## 如何修改提示词

### 1. 直接编辑 prompts.json

用任意文本编辑器打开 `agent/prompts.json`，修改对应字段即可。

**示例：修改身份声明**

```json
{
  "identity": "你是 Eos Agent，一个专注于 Python 开发的 AI 助手。你擅长 Django、FastAPI 和数据分析。"
}
```

**示例：添加自定义规则**

```json
{
  "system_rules": "# System\n - All text you output...\n - 新增的自定义规则..."
}
```

### 2. 使用模板变量

动态段落支持模板变量，会自动替换为实际值：

```json
{
  "language_template": "# Language\n请始终使用 {language} 回复。技术术语保持英文原文。",
  "env_info_template": "# Environment\n当前目录: {cwd}\nGit: {is_git}\n平台: {platform}\n模型: {model}"
}
```

### 3. 热重载（无需重启）

修改 prompts.json 后，可以通过代码热重载：

```python
from prompt_builder import reload_prompts
reload_prompts()  # 重新加载配置并清除缓存
```

或重启 Agent 服务自动加载。

### 4. 临时覆盖（config.yaml）

在 `agent/config.yaml` 中可以临时覆盖：

```yaml
# 自定义 system_prompt（追加在末尾）
system_prompt: |
  你是 Eos Agent，一个强大的 AI 编程助手。
  请用中文回复。

# 语言偏好
language: "中文"

# 完全覆盖（优先级最高，忽略所有其他段落）
# override_system_prompt: "完全自定义的提示词..."

# 始终追加（在所有段落之后）
# append_system_prompt: "额外的指令..."
```

## 优先级链

当多处配置冲突时，按以下优先级生效：

```
override_system_prompt (config.yaml)  ← 最高优先级，完全覆盖
    ↓
agent_prompt (prompts.json)           ← Agent 模式专用
    ↓
system_prompt (config.yaml)           ← 用户自定义，追加在末尾
    ↓
prompts.json 各段落                   ← 默认配置
```

## 常见修改场景

### 场景 1：让 Agent 更简洁

修改 `output_efficiency`：

```json
{
  "output_efficiency": "# Output efficiency\n\n只输出必要信息。不要解释过程。一行能说清的不要用三行。"
}
```

### 场景 2：添加安全规则

修改 `system_rules`：

```json
{
  "system_rules": "# System\n - ...\n - 禁止执行 rm -rf /\n - 禁止修改系统关键文件\n - 所有删除操作必须先确认"
}
```

### 场景 3：针对特定项目

在 `config.yaml` 中设置：

```yaml
system_prompt: |
  当前项目是 AetherOS，一个浏览器操作系统。
  技术栈：Python FastAPI + 原生 JS。
  代码风格：中文注释，无类型注解。
```

### 场景 4：完全自定义

在 `config.yaml` 中设置：

```yaml
override_system_prompt: |
  你是一个代码审查专家。
  只审查代码，不执行修改。
  输出格式：问题描述 + 严重程度 + 建议修复。
```

## 注意事项

1. **JSON 格式**：确保 JSON 格式正确，可以用 [jsonlint.com](https://jsonlint.com) 验证
2. **换行符**：JSON 中用 `\n` 表示换行
3. **引号转义**：JSON 中的引号需要转义，如 `\"code\"`
4. **编码**：文件必须是 UTF-8 编码
5. **备份**：修改前建议备份 `prompts.json`
