# N.O.V.A Aether OS — SVG 图标生成提示词

> 用途：交给专业 AI 生图工具（如 Midjourney / DALL-E / Stable Diffusion）生成 SVG 图标
> 生成后将 SVG 文件放入此目录，前端将替换 emoji 引用

---

## 统一设计规范

- **风格**：Cyber-noir / 科技暗黑风，线条感强
- **配色**：主色 `#00e5ff`（电光蓝），辅色 `#6c5ce7`（靛紫），底色 `#0a0e1a`（深蓝黑）
- **线条**：1.5-2px 描边，圆角端点
- **尺寸**：64x64 viewBox，可缩放
- **背景**：透明
- **质感**：可有微弱发光 / 光晕效果，但保持扁平感
- **系统元素融入**：适当融入 ▽（倒三角）、⬡（六边形）、○（圆形）作为装饰几何元素

---

## 1. 系统 Logo（▽ 倒三角）

**文件名**：`logo.svg`
**用途**：菜单栏左上角系统图标、启动画面

**提示词**：
```
Design a minimal geometric logo icon for a cyberpunk operating system called "N.O.V.A Aether OS". The primary shape is a downward-pointing triangle (▽), clean and sharp. Inside or around it, incorporate subtle hexagonal and circular geometric accents. Color: electric cyan (#00e5ff) with a soft glow effect on a transparent background. Style: flat vector with subtle neon glow, 64x64 SVG. No text. Think: futuristic AI system icon, clean lines, geometric precision.
```

---

## 2. 文件管理器

**文件名**：`files.svg`
**用途**：Dock 栏、应用窗口标题栏

**提示词**：
```
Design a flat vector icon for a file manager / file explorer application in a cyberpunk OS. Show a folder shape with a subtle downward triangle (▽) cutout or accent on the flap. Color: electric cyan (#00e5ff) outlines on transparent background, with a faint indigo (#6c5ce7) inner glow. 1.5px stroke, rounded corners. 64x64 SVG. Minimal, geometric, futuristic. No text.
```

---

## 3. IDE / 代码编辑器

**文件名**：`ide.svg`
**用途**：Dock 栏、应用窗口标题栏

**提示词**：
```
Design a flat vector icon for a code editor / IDE application in a cyberpunk OS. Show angled code brackets `</>` with a cursor bar blinking, integrated into a subtle hexagonal frame. Color: electric cyan (#00e5ff) with indigo (#6c5ce7) accent on transparent background. 1.5px stroke, rounded line caps. 64x64 SVG. Minimal, geometric, futuristic. No text.
```

---

## 4. 终端

**文件名**：`terminal.svg`
**用途**：Dock 栏、应用窗口标题栏

**提示词**：
```
Design a flat vector icon for a terminal / command line application in a cyberpunk OS. Show a terminal prompt `_` with a right-angle bracket `>_` command cursor, enclosed in a rounded rectangle with subtle hexagonal influence. Color: electric cyan (#00e5ff) on transparent background. 1.5px stroke, clean lines. 64x64 SVG. Minimal, geometric, futuristic. No text.
```

---

## 5. Agent（AI 助手）

**文件名**：`agent.svg`
**用途**：Dock 栏、应用窗口标题栏

**提示词**：
```
Design a flat vector icon for an AI agent / chatbot application in a cyberpunk OS. Show an abstract neural node or brain-like geometric shape — a circle (○) with internal connecting lines forming a simple network pattern, with a small downward triangle (▽) accent at the top. Color: electric cyan (#00e5ff) with indigo (#6c5ce7) connections on transparent background. 1.5px stroke. 64x64 SVG. Minimal, geometric, futuristic. No text.
```

---

## 6. 监控

**文件名**：`monitor.svg`
**用途**：Dock 栏、应用窗口标题栏

**提示词**：
```
Design a flat vector icon for a system monitoring / analytics application in a cyberpunk OS. Show a bar chart or pulse line with 3-4 ascending bars or a heartbeat-style waveform line, with a small circular (○) data point accent. Color: electric cyan (#00e5ff) with gradient to indigo (#6c5ce7) on transparent background. 1.5px stroke. 64x64 SVG. Minimal, geometric, futuristic. No text.
```

---

## 7. 设置

**文件名**：`settings.svg`
**用途**：Dock 栏、应用窗口标题栏

**提示词**：
```
Design a 64x64 flat vector icon for a settings/configuration app in a dark cyberpunk OS. The icon is a gear/cog wheel viewed from the front. The cog has exactly 8 teeth, each tooth is a sharp trapezoid shape (not rounded). The outer ring of the cog connects the teeth. Inside the cog there is a hollow circle (the axle hole). All lines are stroked at 1.5px in electric cyan (#00e5ff) with no fill, on a transparent background. Add a very subtle indigo (#6c5ce7) inner glow behind the cog shape using a slightly larger blurred stroke. The style must be clean, geometric, minimal, matching the same visual language as a hexagonal-frame code editor icon and a circular neural network icon — same line weight, same color palette, same level of detail. No gradients, no text, no 3D effects. Pure flat vector line art.
```

---

## 使用说明

1. 使用上述提示词在 AI 生图工具中生成图标
2. 导出为 SVG 格式（64x64 viewBox）
3. 放入此 `/svg` 目录
4. 前端代码中将 emoji 替换为 `<img src="/svg/xxx.svg">` 或内联 SVG

### 命名规范

| 文件名 | 对应应用 |
|--------|----------|
| `logo.svg` | 系统 Logo |
| `files.svg` | 文件管理器 |
| `ide.svg` | IDE |
| `terminal.svg` | 终端 |
| `agent.svg` | Agent |
| `monitor.svg` | 监控 |
| `settings.svg` | 设置 |
