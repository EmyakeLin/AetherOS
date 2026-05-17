/* ═══════════════════════════════════════════════════════
   N.O.V.A AETHER OS — Agent Application
   ChatGPT-inspired layout × Cyberpunk neon aesthetic
   ═══════════════════════════════════════════════════════ */

registerApp('agent', {
    title: 'Agent',
    icon: '🤖',
    getState: (win) => ({ currentSessionId: win._agentSessionId || null }),
    setState: async (state, win, os) => { if (state.currentSessionId) win._agentSessionId = state.currentSessionId; },
    factory: (container, win, os) => {
        const agentId = 'agent-' + Date.now();

        container.innerHTML = `
            <div class="agent-root">
                <!-- Session sidebar -->
                <aside id="session-sidebar" class="agent-sidebar">
                    <div class="sidebar-top">
                        <button id="session-new-btn" class="new-chat-btn">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                            <span>新会话</span>
                        </button>
                        <div class="sidebar-search">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2"/><path d="M9.5 9.5L13 13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                            <input id="session-filter" type="text" placeholder="搜索会话..." />
                        </div>
                    </div>
                    <div id="session-list" class="session-list"></div>
                    <div class="sidebar-bottom">
                        <button id="sidebar-settings-btn" class="sidebar-bottom-btn">
                            <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.2"/><path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="9" cy="9" r="2.5" stroke="currentColor" stroke-width="1.2"/></svg>
                            <span>设置</span>
                        </button>
                        <button id="sidebar-help-btn" class="sidebar-bottom-btn">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/><path d="M6 6.5a2 2 0 013.5 1.5c0 1-1.5 1.2-1.5 2.5M8 12.5v.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                            <span>帮助</span>
                        </button>
                    </div>
                </aside>

                <!-- Main area (page container) -->
                <main class="agent-main">
                    <!-- Home page -->
                    <div id="home-page" class="agent-page home-page">
                        <div class="home-content">
                            <div class="home-header">
                                <div class="home-icon">
                                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                                        <circle cx="24" cy="24" r="22" stroke="var(--accent)" stroke-width="1.5" opacity="0.3"/>
                                        <circle cx="24" cy="24" r="14" stroke="var(--accent)" stroke-width="1.2" opacity="0.5"/>
                                        <circle cx="24" cy="24" r="5" fill="var(--accent)" opacity="0.8"/>
                                        <circle cx="24" cy="24" r="5" fill="var(--accent)">
                                            <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite"/>
                                            <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2s" repeatCount="indefinite"/>
                                        </circle>
                                    </svg>
                                </div>
                                <h1 class="home-title">Eos Agent</h1>
                            </div>
                            <p class="home-welcome-text" id="home-welcome-text"></p>
                            <div class="home-input-wrap">
                                <div class="input-container">
                                    <textarea id="home-input" placeholder="发送消息..." rows="1"></textarea>
                                    <div class="input-actions">
                                        <button id="home-send" class="send-btn" disabled>
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3L13 8L3 13V9.5L9 8L3 6.5V3Z" fill="currentColor"/></svg>
                                        </button>
                                    </div>
                                </div>
                                <div class="input-hint">Enter 发送 · Shift+Enter 换行</div>
                            </div>
                        </div>
                    </div>

                    <!-- Chat page -->
                    <div id="chat-page" class="agent-page chat-page" style="display:none">
                        <header class="agent-header">
                            <button id="session-toggle-btn" class="icon-btn" title="切换侧边栏">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="3.5" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="8.25" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="13" width="14" height="1.5" rx="0.75" fill="currentColor"/></svg>
                            </button>
                            <div class="header-title">
                                <span id="session-title-display">Eos Agent</span>
                                <span class="model-badge" id="model-badge"></span>
                            </div>
                            <div style="flex:1"></div>
                            <div class="mode-switch" id="mode-switch">
                                <button class="mode-btn active" data-mode="assistant">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5C4 1.5 1.5 3.5 1.5 7c0 1.5.8 2.8 2 3.5L3 13l2.5-1.5c.5.1 1 .1 1.5.1 3 0 5.5-2 5.5-5.5S10 1.5 7 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    Assistant
                                </button>
                                <button class="mode-btn" data-mode="coder">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4.5 4L1.5 7l3 3M9.5 4l3 3-3 3M8 2L6 12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    Coder
                                </button>
                            </div>
                            <button id="panel-toggle-btn" class="icon-btn" title="工具面板">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="7" height="16" rx="1.5" stroke="currentColor" stroke-width="1.2"/><rect x="10" y="1" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2"/><rect x="10" y="10" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2"/></svg>
                            </button>
                        </header>

                        <div class="chat-body">
                            <div id="agent-messages" class="agent-messages">
                                <div id="welcome-screen-chat" class="welcome-screen">
                                    <div class="welcome-glow"></div>
                                    <div class="welcome-icon">
                                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                                            <circle cx="24" cy="24" r="22" stroke="var(--accent)" stroke-width="1.5" opacity="0.3"/>
                                            <circle cx="24" cy="24" r="14" stroke="var(--accent)" stroke-width="1.2" opacity="0.5"/>
                                            <circle cx="24" cy="24" r="5" fill="var(--accent)" opacity="0.8"/>
                                            <circle cx="24" cy="24" r="5" fill="var(--accent)">
                                                <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite"/>
                                                <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2s" repeatCount="indefinite"/>
                                            </circle>
                                        </svg>
                                    </div>
                                    <h2 class="welcome-title">Eos Agent</h2>
                                    <p class="welcome-sub">有什么需要帮助的？</p>
                                    <div class="welcome-chips">
                                        <button class="chip" data-prompt="帮我分析当前项目的代码结构">分析代码结构</button>
                                        <button class="chip" data-prompt="读取并解释 server.py 的核心逻辑">解释后端逻辑</button>
                                        <button class="chip" data-prompt="帮我写一个 Python 脚本来处理数据">编写脚本</button>
                                        <button class="chip" data-prompt="检查项目中是否有潜在的安全问题">安全审查</button>
                                    </div>
                                </div>
                            </div>

                            <aside id="agent-panel" class="agent-panel">
                                <div class="panel-tabs">
                                    <button class="panel-tab active" data-tab="thinking">
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M7 4v3l2 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                        <span>思维链</span>
                                        <span id="thinking-indicator" class="thinking-badge" style="display:none">●</span>
                                    </button>
                                    <button class="panel-tab" data-tab="tools">
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M2 7h7M2 10h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                                        <span>工具与终端</span>
                                        <span id="tool-count" class="panel-count">0</span>
                                    </button>
                                </div>
                                <div class="panel-content">
                                    <div id="thinking-panel" class="panel-section thinking-section">
                                        <div id="agent-thinking" class="panel-body thinking-body">
                                            <div class="thinking-placeholder">等待模型思考...</div>
                                        </div>
                                    </div>
                                    <div id="tools-panel" class="panel-section tools-section" style="display:none">
                                        <div class="panel-section-header">
                                            <span class="panel-section-icon">
                                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M2 7h7M2 10h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                                            </span>
                                            <span>工具调用</span>
                                        </div>
                                        <div id="agent-tools" class="panel-body tools-body"></div>
                                        <div class="panel-divider"></div>
                                        <div class="panel-section-header">
                                            <span class="panel-section-icon">
                                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M4 5.5L6 7.5L4 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 9.5H10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                                            </span>
                                            <span>终端</span>
                                            <button id="terminal-clear" class="panel-action-btn" title="清空">清空</button>
                                        </div>
                                        <div id="agent-terminal" class="panel-body terminal-body"></div>
                                    </div>
                                </div>
                            </aside>
                        </div>

                        <div class="agent-input-wrap">
                            <div class="input-container">
                                <textarea id="agent-input" placeholder="发送消息..." rows="1"></textarea>
                                <div class="input-actions">
                                    <button id="agent-stop" class="stop-btn" style="display:none">
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor"/></svg>
                                    </button>
                                    <button id="agent-send" class="send-btn" disabled>
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3L13 8L3 13V9.5L9 8L3 6.5V3Z" fill="currentColor"/></svg>
                                    </button>
                                </div>
                            </div>
                            <div class="input-hint">Enter 发送 · Shift+Enter 换行</div>
                        </div>
                    </div>

                    <!-- Settings page -->
                    <div id="settings-page" class="agent-page settings-page" style="display:none">
                        <div class="settings-page-header">
                            <button id="settings-back-btn" class="settings-back-btn">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                <span>返回</span>
                            </button>
                            <span class="settings-page-title">Agent 设置</span>
                        </div>
                        <div class="settings-page-body">
                            <div class="settings-section">
                                <div class="settings-section-title">模型配置</div>
                                <div class="settings-field">
                                    <label class="settings-label">模型</label>
                                    <select id="settings-model" class="settings-select">
                                        <option value="">加载中...</option>
                                    </select>
                                    <div id="settings-model-hint" class="settings-hint"></div>
                                </div>
                            </div>
                            <div class="settings-section">
                                <div class="settings-section-title">辅助模型（用于自动命名对话）</div>
                                <div class="settings-field">
                                    <label class="settings-label">辅助模型来源</label>
                                    <select id="settings-helper-source" class="settings-select">
                                        <option value="">不使用辅助模型</option>
                                        <option value="os">使用系统模型</option>
                                        <option value="custom">自定义配置</option>
                                    </select>
                                </div>
                                <div id="helper-os-config" style="display:none">
                                    <div class="settings-field">
                                        <label class="settings-label">模型</label>
                                        <select id="settings-helper-model" class="settings-select">
                                            <option value="">加载中...</option>
                                        </select>
                                    </div>
                                </div>
                                <div id="helper-custom-config" style="display:none">
                                    <div class="settings-field">
                                        <label class="settings-label">API Key</label>
                                        <input id="settings-helper-key" class="settings-input" type="password" placeholder="sk-...">
                                    </div>
                                    <div class="settings-field">
                                        <label class="settings-label">API Base URL</label>
                                        <input id="settings-helper-url" class="settings-input" type="text" placeholder="https://api.openai.com/v1">
                                    </div>
                                    <div class="settings-field">
                                        <label class="settings-label">模型名称</label>
                                        <input id="settings-helper-name" class="settings-input" type="text" placeholder="gpt-4o-mini">
                                    </div>
                                </div>
                            </div>
                            <div class="settings-section">
                                <div class="settings-section-title">Agent 行为</div>
                                <div class="settings-field">
                                    <label class="settings-label">System Prompt</label>
                                    <textarea id="settings-system-prompt" class="settings-textarea" rows="5" placeholder="你是 Eos Agent..."></textarea>
                                </div>
                                <div class="settings-field">
                                    <label class="settings-label">最大模型请求次数</label>
                                    <input id="settings-max-iter" class="settings-input" type="number" min="1" max="200" value="50">
                                </div>
                                <div class="settings-field">
                                    <label class="settings-label">工具集</label>
                                    <select id="settings-toolset" class="settings-select">
                                        <option value="">所有工具</option>
                                        <option value="default">默认工具集（文件 + 终端）</option>
                                        <option value="file">文件操作</option>
                                        <option value="terminal">终端执行</option>
                                        <option value="eos-tools-file-management">Eos-Tools 文件管理</option>
                                    </select>
                                </div>
                                <div class="settings-field">
                                    <label class="settings-label">工具调用扫描动画速度（秒）</label>
                                    <input id="settings-scan-speed" class="settings-input" type="number" min="0.2" max="5" step="0.1" value="1.0">
                                </div>
                            </div>
                            <div class="settings-actions">
                                <button id="settings-save-btn" class="settings-save-btn">保存</button>
                                <button id="settings-reset-btn" class="settings-reset-btn">重置</button>
                            </div>
                        </div>
                    </div>
                </main>

                <!-- Help popover -->
                <div id="help-popover" class="help-popover" style="display:none">
                    <div class="help-popover-header">
                        <span class="help-popover-title">快捷键与提示</span>
                        <button id="help-close-btn" class="help-close-btn">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                        </button>
                    </div>
                    <div class="help-popover-body">
                        <div class="help-section">
                            <div class="help-section-label">快捷键</div>
                            <div class="help-row"><kbd>Enter</kbd><span>发送消息</span></div>
                            <div class="help-row"><kbd>Shift + Enter</kbd><span>换行</span></div>
                            <div class="help-row"><kbd>Ctrl + Shift + Enter</kbd><span>新建会话</span></div>
                        </div>
                        <div class="help-section">
                            <div class="help-section-label">快速提示</div>
                            <div class="help-tip">点击会话标题可重命名</div>
                            <div class="help-tip">使用搜索框快速查找历史会话</div>
                            <div class="help-tip">切换 Assistant / Coder 模式获得不同体验</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        /* ══════════════════════════════════════════
           STYLES — ChatGPT layout × Cyberpunk neon
           ══════════════════════════════════════════ */
        const style = document.createElement('style');
        style.textContent = `
            /* ── Root layout ── */
            .agent-root {
                display: flex;
                height: 100%;
                background: var(--bg-base);
                position: relative;
                overflow: hidden;
            }

            /* ── Sidebar ── */
            .agent-sidebar {
                width: 260px;
                display: flex;
                flex-direction: column;
                background: var(--bg-deep);
                border-right: 1px solid var(--border);
                flex-shrink: 0;
                transition: width 0.3s var(--ease-out), opacity 0.2s;
                overflow: hidden;
            }
            .agent-sidebar.collapsed {
                width: 0;
                opacity: 0;
                border-right: none;
            }
            .sidebar-top {
                padding: 12px;
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .new-chat-btn {
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                padding: 10px 14px;
                background: var(--accent-glow);
                border: 1px solid var(--accent-dim);
                border-radius: var(--radius-md);
                color: var(--accent);
                font-family: var(--font-body);
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .new-chat-btn:hover {
                background: rgba(0, 229, 255, 0.2);
                border-color: var(--accent);
                box-shadow: 0 0 20px rgba(0, 229, 255, 0.1);
            }
            .sidebar-search {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 7px 10px;
                background: var(--bg-surface);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                color: var(--text-muted);
                transition: border-color 0.2s;
            }
            .sidebar-search:focus-within {
                border-color: var(--accent-dim);
            }
            .sidebar-search input {
                flex: 1;
                background: none;
                border: none;
                outline: none;
                color: var(--text-primary);
                font-family: var(--font-body);
                font-size: 12px;
            }
            .sidebar-search input::placeholder {
                color: var(--text-muted);
            }
            .session-list {
                flex: 1;
                overflow-y: auto;
                padding: 4px 8px;
            }

            /* ── Sidebar bottom ── */
            .sidebar-bottom {
                flex-shrink: 0;
                padding: 8px;
                border-top: 1px solid var(--border);
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .sidebar-bottom-btn {
                display: flex;
                align-items: center;
                gap: 10px;
                width: 100%;
                padding: 8px 12px;
                background: none;
                border: none;
                border-radius: var(--radius-md);
                color: var(--text-muted);
                font-family: var(--font-body);
                font-size: 13px;
                cursor: pointer;
                transition: all 0.15s;
            }
            .sidebar-bottom-btn:hover {
                background: var(--bg-hover);
                color: var(--text-primary);
            }
            .sidebar-bottom-btn svg {
                flex-shrink: 0;
            }

            /* ── Session items ── */
            .session-group-label {
                padding: 8px 8px 4px;
                font-family: var(--font-display);
                font-size: 10px;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                color: var(--text-muted);
            }
            .session-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                border-radius: var(--radius-md);
                cursor: pointer;
                transition: all 0.15s;
                position: relative;
                margin-bottom: 2px;
            }
            .session-item:hover {
                background: var(--bg-hover);
            }
            .session-item.active {
                background: var(--accent-glow);
                border: 1px solid rgba(0, 229, 255, 0.15);
            }
            .session-item-icon {
                width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                color: var(--text-muted);
            }
            .session-item.active .session-item-icon {
                color: var(--accent);
            }
            .session-item-body {
                flex: 1;
                min-width: 0;
            }
            .session-item-title {
                font-size: 13px;
                color: var(--text-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.3;
            }
            .session-item-time {
                font-size: 11px;
                color: var(--text-muted);
                margin-top: 2px;
            }
            .session-item-delete {
                opacity: 0;
                background: none;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                padding: 4px;
                border-radius: var(--radius-sm);
                display: flex;
                align-items: center;
                transition: all 0.15s;
            }
            .session-item:hover .session-item-delete {
                opacity: 0.6;
            }
            .session-item-delete:hover {
                opacity: 1 !important;
                color: var(--accent-warm);
                background: rgba(255, 107, 107, 0.1);
            }

            /* ── Main area ── */
            .agent-main {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-width: 0;
                position: relative;
                overflow: hidden;
            }

            /* ── Page system ── */
            .agent-page {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .home-page {
                align-items: center;
                justify-content: center;
            }
            .home-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 24px;
                max-width: 600px;
                width: 100%;
                padding: 0 24px;
            }
            .home-header {
                display: flex;
                align-items: center;
                gap: 16px;
            }
            .home-icon {
                filter: drop-shadow(0 0 20px rgba(0, 229, 255, 0.3));
            }
            .home-title {
                font-family: var(--font-display);
                font-size: 32px;
                font-weight: 700;
                color: var(--text-primary);
                letter-spacing: 2px;
                margin: 0;
            }
            .home-welcome-text {
                font-size: 20px;
                color: var(--text-primary);
                text-align: center;
                line-height: 1.6;
                margin: 0;
                min-height: 32px;
            }
            .home-input-wrap {
                width: 100%;
                max-width: 560px;
                transition: transform 0.5s var(--ease-out), opacity 0.3s;
            }
            .home-input-wrap.moved {
                transform: translateY(40px);
                opacity: 0;
            }
            .chat-page {
                display: flex;
                flex-direction: column;
            }
            .chat-body {
                flex: 1;
                display: flex;
                overflow: hidden;
            }
            .agent-header {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                border-bottom: 1px solid var(--border);
                flex-shrink: 0;
                background: var(--bg-base);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
            }
            .header-title {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .header-title span:first-child,
            .header-title .title-edit {
                font-family: var(--font-body);
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary);
            }
            .header-title .title-edit {
                background: var(--bg-surface);
                border: 1px solid var(--accent);
                border-radius: var(--radius-sm);
                padding: 2px 8px;
                outline: none;
                width: 200px;
                box-shadow: 0 0 0 2px var(--accent-glow);
            }
            #session-title-display {
                cursor: pointer;
                padding: 2px 4px;
                border-radius: var(--radius-sm);
                transition: background 0.15s;
            }
            #session-title-display:hover {
                background: var(--bg-surface);
            }
            .session-item-title {
                cursor: pointer;
                padding: 1px 2px;
                border-radius: 2px;
                transition: background 0.15s;
            }
            .session-item-title:hover {
                background: var(--bg-surface);
            }
            .session-item-title.editing {
                background: var(--bg-surface);
                border: 1px solid var(--accent);
                outline: none;
                padding: 0 4px;
                min-width: 60px;
            }
            .model-badge {
                font-family: var(--font-mono);
                font-size: 10px;
                color: var(--accent);
                background: var(--accent-glow);
                border: 1px solid var(--accent-dim);
                padding: 2px 8px;
                border-radius: 20px;
                display: none;
            }
            .model-badge.visible {
                display: inline-block;
            }
            .icon-btn {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: none;
                border: 1px solid transparent;
                border-radius: var(--radius-sm);
                color: var(--text-muted);
                cursor: pointer;
                transition: all 0.15s;
            }
            .icon-btn:hover {
                color: var(--text-primary);
                background: var(--bg-hover);
                border-color: var(--border);
            }

            /* ── Mode switch ── */
            .mode-switch {
                display: flex;
                align-items: center;
                background: var(--bg-deep);
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                padding: 2px;
                gap: 2px;
            }
            .mode-btn {
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 5px 12px;
                background: none;
                border: none;
                border-radius: var(--radius-sm);
                color: var(--text-muted);
                font-family: var(--font-display);
                font-size: 11px;
                font-weight: 500;
                letter-spacing: 0.5px;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            }
            .mode-btn:hover {
                color: var(--text-primary);
                background: var(--bg-hover);
            }
            .mode-btn.active {
                color: var(--accent);
                background: var(--accent-glow);
                box-shadow: 0 0 8px rgba(0, 229, 255, 0.15);
            }
            .mode-btn svg {
                flex-shrink: 0;
            }

            /* ── Messages ── */
            .agent-messages {
                flex: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }

            /* ── Welcome screen ── */
            .welcome-screen {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 20px;
                position: relative;
            }
            .welcome-glow {
                position: absolute;
                width: 300px;
                height: 300px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(0, 229, 255, 0.06) 0%, transparent 70%);
                pointer-events: none;
            }
            .welcome-icon {
                margin-bottom: 20px;
                filter: drop-shadow(0 0 20px rgba(0, 229, 255, 0.2));
            }
            .welcome-title {
                font-family: var(--font-display);
                font-size: 24px;
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: 8px;
                letter-spacing: 2px;
            }
            .welcome-sub {
                font-size: 14px;
                color: var(--text-muted);
                margin-bottom: 32px;
            }
            .welcome-chips {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                max-width: 420px;
                width: 100%;
            }
            .chip {
                padding: 14px 16px;
                background: var(--bg-elevated);
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                color: var(--text-secondary);
                font-family: var(--font-body);
                font-size: 13px;
                cursor: pointer;
                text-align: left;
                transition: all 0.2s;
                line-height: 1.4;
            }
            .chip:hover {
                background: var(--bg-hover);
                border-color: var(--accent-dim);
                color: var(--text-primary);
                transform: translateY(-1px);
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            }

            /* ── Message rows (ChatGPT style) ── */
            .msg-row {
                display: flex;
                gap: 16px;
                padding: 20px 24px;
                animation: msg-in 0.3s var(--ease-out);
                max-width: 820px;
                width: 100%;
                margin: 0 auto;
            }
            @keyframes msg-in {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .msg-row.user-row {
                background: transparent;
            }
            .msg-row.assistant-row {
                background: var(--bg-surface);
            }
            .msg-avatar {
                width: 28px;
                height: 28px;
                border-radius: var(--radius-sm);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                font-size: 14px;
            }
            .msg-avatar.user-avatar {
                background: linear-gradient(135deg, var(--accent-dim), var(--accent-secondary));
            }
            .msg-avatar.assistant-avatar {
                background: var(--accent-glow);
                border: 1px solid var(--accent-dim);
            }
            .msg-body {
                flex: 1;
                min-width: 0;
            }
            .msg-role-label {
                font-family: var(--font-display);
                font-size: 12px;
                font-weight: 600;
                color: var(--text-secondary);
                margin-bottom: 6px;
                letter-spacing: 0.5px;
            }
            .msg-content {
                font-size: 14px;
                line-height: 1.75;
                color: var(--text-primary);
                word-break: break-word;
                user-select: text;
                cursor: text;
            }
            .msg-content pre {
                background: var(--bg-deep);
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                padding: 14px 16px;
                overflow-x: auto;
                margin: 12px 0;
                font-size: 12.5px;
                line-height: 1.6;
                position: relative;
            }
            .msg-content pre code {
                font-family: var(--font-code);
            }
            .msg-content code {
                font-family: var(--font-code);
            }
            .msg-content :not(pre) > code {
                background: var(--bg-elevated);
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 12.5px;
                border: 1px solid var(--border);
            }
            .code-copy-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                padding: 4px 8px;
                background: var(--bg-hover);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                color: var(--text-muted);
                font-family: var(--font-mono);
                font-size: 10px;
                cursor: pointer;
                opacity: 0;
                transition: all 0.15s;
            }
            .msg-content pre:hover .code-copy-btn {
                opacity: 1;
            }
            .code-copy-btn:hover {
                color: var(--accent);
                border-color: var(--accent-dim);
            }

            /* System messages */
            .sys-msg {
                text-align: center;
                font-size: 12px;
                color: var(--text-muted);
                padding: 8px 20px;
                font-family: var(--font-mono);
                user-select: text;
                cursor: text;
            }

            /* ── Thinking indicator ── */
            .thinking-indicator {
                display: flex;
                gap: 16px;
                padding: 20px 24px;
                max-width: 820px;
                width: 100%;
                margin: 0 auto;
                background: var(--bg-surface);
                animation: msg-in 0.3s var(--ease-out);
            }
            .thinking-dots {
                display: flex;
                gap: 4px;
                align-items: center;
                padding: 8px 0;
            }
            .thinking-dots span {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: var(--accent);
                opacity: 0.4;
                animation: dot-bounce 1.4s ease-in-out infinite;
            }
            .thinking-dots span:nth-child(2) { animation-delay: 0.16s; }
            .thinking-dots span:nth-child(3) { animation-delay: 0.32s; }
            @keyframes dot-bounce {
                0%, 80%, 100% { opacity: 0.4; transform: scale(1); }
                40% { opacity: 1; transform: scale(1.3); }
            }

            /* Streaming cursor */
            .streaming-cursor::after {
                content: '';
                display: inline-block;
                width: 2px;
                height: 1em;
                background: var(--accent);
                margin-left: 2px;
                vertical-align: text-bottom;
                animation: cursor-blink 0.8s step-end infinite;
            }
            @keyframes cursor-blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
            }

            /* ── Input area ── */
            .agent-input-wrap {
                padding: 12px 24px 16px;
                flex-shrink: 0;
                max-width: 820px;
                width: 100%;
                margin: 0 auto;
            }
            .input-container {
                display: flex;
                align-items: flex-end;
                gap: 8px;
                background: var(--bg-elevated);
                border: 1px solid var(--border);
                border-radius: 16px;
                padding: 8px 8px 8px 16px;
                transition: border-color 0.2s, box-shadow 0.2s;
                position: relative;
            }
            .input-container:focus-within {
                border-color: var(--accent-dim);
                box-shadow: 0 0 0 1px var(--accent-glow), 0 0 20px rgba(0, 229, 255, 0.05);
            }
            /* Skill autocomplete */
            .skill-autocomplete {
                display: none;
                position: absolute;
                bottom: 100%;
                left: 0;
                right: 0;
                background: var(--bg-elevated);
                border: 1px solid var(--border);
                border-radius: 8px 8px 0 0;
                max-height: 200px;
                overflow-y: auto;
                z-index: 10;
            }
            .skill-autocomplete-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 12px;
                cursor: pointer;
                transition: background 0.15s;
            }
            .skill-autocomplete-item:hover {
                background: var(--bg-hover);
            }
            .skill-name {
                font-family: var(--font-mono);
                color: var(--accent);
                font-weight: 600;
                white-space: nowrap;
            }
            .skill-desc {
                color: var(--text-secondary);
                font-size: 0.85em;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .input-container textarea {
                flex: 1;
                resize: none;
                background: none;
                border: none;
                outline: none;
                color: var(--text-primary);
                font-family: var(--font-body);
                font-size: 14px;
                line-height: 1.5;
                max-height: 160px;
                padding: 4px 0;
            }
            .input-container textarea::placeholder {
                color: var(--text-muted);
            }
            .input-actions {
                display: flex;
                gap: 4px;
                align-items: center;
                flex-shrink: 0;
            }
            .send-btn {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--accent);
                border: none;
                border-radius: 50%;
                color: var(--bg-deep);
                cursor: pointer;
                transition: all 0.2s;
            }
            .send-btn:disabled {
                opacity: 0.3;
                cursor: default;
            }
            .send-btn:not(:disabled):hover {
                background: var(--accent-bright);
                box-shadow: 0 0 16px rgba(0, 229, 255, 0.3);
                transform: scale(1.05);
            }
            .stop-btn {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255, 107, 107, 0.15);
                border: 1px solid rgba(255, 107, 107, 0.3);
                border-radius: 50%;
                color: var(--accent-warm);
                cursor: pointer;
                transition: all 0.2s;
            }
            .stop-btn:hover {
                background: rgba(255, 107, 107, 0.25);
                box-shadow: 0 0 12px rgba(255, 107, 107, 0.2);
            }
            .input-hint {
                text-align: center;
                font-size: 11px;
                color: var(--text-muted);
                margin-top: 6px;
                opacity: 0.6;
            }

            /* ── Right panel ── */
            .agent-panel {
                width: 300px;
                display: flex;
                flex-direction: column;
                background: var(--bg-deep);
                border-left: 1px solid var(--border);
                flex-shrink: 0;
                transition: width 0.3s var(--ease-out), opacity 0.2s;
                overflow: hidden;
            }
            .agent-panel.collapsed {
                width: 0;
                opacity: 0;
                border-left: none;
            }
            .panel-tabs {
                display: flex;
                border-bottom: 1px solid var(--border);
                flex-shrink: 0;
            }
            .panel-tab {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 10px 0;
                background: none;
                border: none;
                color: var(--text-muted);
                font-family: var(--font-display);
                font-size: 11px;
                letter-spacing: 0.5px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
            }
            .panel-tab:hover {
                color: var(--text-secondary);
                background: var(--bg-elevated);
            }
            .panel-tab.active {
                color: var(--accent);
            }
            .panel-tab.active::after {
                content: '';
                position: absolute;
                bottom: -1px;
                left: 20%;
                right: 20%;
                height: 2px;
                background: var(--accent);
                border-radius: 1px;
            }
            .panel-tab svg {
                opacity: 0.7;
            }
            .panel-tab.active svg {
                opacity: 1;
            }
            .thinking-badge {
                color: var(--accent);
                font-size: 8px;
                animation: pulse 1.5s ease-in-out infinite;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }
            .panel-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 0;
            }
            .panel-section {
                display: flex;
                flex-direction: column;
                min-height: 0;
            }
            .thinking-section {
                flex: 1;
            }
            .tools-section {
                flex: 1;
            }
            .panel-section-header {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 14px;
                font-family: var(--font-display);
                font-size: 11px;
                letter-spacing: 1px;
                color: var(--text-secondary);
                border-bottom: 1px solid var(--border);
                flex-shrink: 0;
            }
            .panel-section-icon {
                color: var(--accent);
                display: flex;
                align-items: center;
            }
            .panel-count {
                margin-left: auto;
                font-family: var(--font-mono);
                font-size: 10px;
                color: var(--text-muted);
                background: var(--bg-elevated);
                padding: 1px 6px;
                border-radius: 10px;
            }
            .panel-action-btn {
                margin-left: auto;
                background: none;
                border: none;
                color: var(--text-muted);
                font-family: var(--font-mono);
                font-size: 10px;
                cursor: pointer;
                padding: 2px 6px;
                border-radius: var(--radius-sm);
                transition: all 0.15s;
            }
            .panel-action-btn:hover {
                color: var(--accent);
                background: var(--accent-glow);
            }
            .panel-body {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
            }
            .thinking-body {
                font-family: var(--font-mono);
                font-size: 12px;
                line-height: 1.6;
                color: var(--text-secondary);
            }
            .thinking-placeholder {
                color: var(--text-muted);
                font-style: italic;
                text-align: center;
                padding: 20px;
            }
            .thinking-content {
                white-space: pre-wrap;
                word-break: break-word;
            }
            .thinking-content p {
                margin: 0 0 8px 0;
            }
            .thinking-content code {
                background: var(--bg-elevated);
                padding: 1px 4px;
                border-radius: 3px;
                font-size: 11px;
            }
            .thinking-content pre {
                background: var(--bg-elevated);
                padding: 8px;
                border-radius: var(--radius-sm);
                overflow-x: auto;
                margin: 8px 0;
            }
            .thinking-content pre code {
                background: none;
                padding: 0;
            }
            .thinking-block {
                margin-bottom: 8px;
            }
            .thinking-separator {
                height: 1px;
                margin: 12px 0;
            }
            .thinking-separator.light {
                background: linear-gradient(90deg, transparent, var(--border), transparent);
                opacity: 0.5;
            }
            .thinking-separator.deep {
                background: var(--border);
                opacity: 1;
                margin: 16px 0;
            }
            .panel-divider {
                height: 1px;
                background: var(--border);
                flex-shrink: 0;
            }
            .terminal-body {
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--text-secondary);
                background: var(--bg-deep);
                line-height: 1.6;
            }
            .tools-body {
                font-family: var(--font-mono);
                font-size: 11px;
            }

            /* ── Tool entries ── */
            .tool-entry {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 8px 10px;
                border-radius: var(--radius-sm);
                margin-bottom: 4px;
                background: var(--bg-elevated);
                border: 1px solid var(--border);
                transition: all 0.2s;
                animation: tool-slide-in 0.4s var(--ease-out);
            }
            @keyframes tool-slide-in {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .tool-entry.pending {
                border-color: var(--accent-dim);
                background: var(--accent-glow);
            }
            .tool-entry.done {
                opacity: 0.6;
            }
            .tool-entry.error {
                border-color: rgba(255, 107, 107, 0.3);
                background: rgba(255, 107, 107, 0.05);
            }
            .tool-icon {
                font-size: 12px;
                flex-shrink: 0;
                line-height: 1.4;
            }
            .tool-info {
                flex: 1;
                min-width: 0;
            }
            .tool-name {
                font-weight: 600;
                color: var(--text-primary);
                font-size: 11px;
            }
            .tool-status {
                font-size: 10px;
                color: var(--text-muted);
                margin-top: 2px;
                word-break: break-all;
            }

            /* ── Agent Tool 子 Agent 特殊样式 ── */
            .tool-entry.agent-tool {
                border-color: rgba(179, 136, 255, 0.3);
                background: rgba(179, 136, 255, 0.06);
            }
            .tool-entry.agent-tool.pending {
                border-color: rgba(179, 136, 255, 0.5);
                background: rgba(179, 136, 255, 0.1);
                animation: tool-slide-in 0.4s var(--ease-out), agent-pulse 2s ease-in-out infinite;
            }
            .tool-entry.agent-tool .tool-icon {
                font-size: 14px;
            }
            .tool-entry.agent-tool .tool-name {
                color: #b388ff;
            }
            .tool-entry.agent-tool .tool-status {
                color: #b388ff;
            }
            .tool-entry.agent-tool .agent-type-badge {
                display: inline-block;
                padding: 1px 6px;
                border-radius: 8px;
                font-size: 9px;
                font-weight: 600;
                text-transform: uppercase;
                margin-left: 6px;
                vertical-align: middle;
            }
            .agent-type-badge.explore { background: rgba(0, 229, 255, 0.15); color: #00e5ff; }
            .agent-type-badge.plan { background: rgba(255, 193, 7, 0.15); color: #ffc107; }
            .agent-type-badge.general_purpose { background: rgba(179, 136, 255, 0.15); color: #b388ff; }
            .tool-entry.agent-tool .agent-result-summary {
                font-size: 10px;
                color: var(--text-muted);
                margin-top: 2px;
                max-height: 60px;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            @keyframes agent-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }

            /* ── Settings page ── */
            .settings-page {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                animation: settings-page-in 0.25s var(--ease-out);
            }
            @keyframes settings-page-in {
                from { opacity: 0; transform: translateY(12px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .settings-page-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 20px;
                border-bottom: 1px solid var(--border);
                flex-shrink: 0;
            }
            .settings-back-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                background: none;
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                color: var(--text-muted);
                font-family: var(--font-body);
                font-size: 13px;
                cursor: pointer;
                transition: all 0.15s;
            }
            .settings-back-btn:hover {
                color: var(--accent);
                border-color: var(--accent-dim);
                background: var(--accent-glow);
            }
            .settings-page-title {
                font-family: var(--font-display);
                font-size: 15px;
                font-weight: 600;
                color: var(--text-primary);
                letter-spacing: 0.5px;
            }
            .settings-page-body {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
                max-width: 640px;
                width: 100%;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                gap: 28px;
            }
            .settings-section {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .settings-section-title {
                font-family: var(--font-display);
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                color: var(--accent);
                padding-bottom: 8px;
                border-bottom: 1px solid var(--border);
            }
            .settings-page-body {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            .settings-field {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .settings-label {
                font-family: var(--font-display);
                font-size: 12px;
                font-weight: 500;
                color: var(--text-secondary);
            }
            .settings-input {
                width: 100%;
                padding: 10px 14px;
                background: var(--bg-deep);
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                color: var(--text-primary);
                font-family: var(--font-mono);
                font-size: 13px;
                outline: none;
                transition: border-color 0.2s, box-shadow 0.2s;
                box-sizing: border-box;
            }
            .settings-input:focus {
                border-color: var(--accent-dim);
                box-shadow: 0 0 0 1px var(--accent-glow);
            }
            .settings-textarea {
                width: 100%;
                padding: 10px 14px;
                background: var(--bg-deep);
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                color: var(--text-primary);
                font-family: var(--font-mono);
                font-size: 13px;
                outline: none;
                resize: vertical;
                min-height: 100px;
                transition: border-color 0.2s, box-shadow 0.2s;
                box-sizing: border-box;
                line-height: 1.5;
            }
            .settings-textarea:focus {
                border-color: var(--accent-dim);
                box-shadow: 0 0 0 1px var(--accent-glow);
            }
            .settings-select {
                width: 100%;
                padding: 10px 14px;
                background: var(--bg-deep);
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                color: var(--text-primary);
                font-family: var(--font-mono);
                font-size: 13px;
                outline: none;
                transition: border-color 0.2s, box-shadow 0.2s;
                box-sizing: border-box;
                appearance: none;
                -webkit-appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 12px center;
                padding-right: 32px;
            }
            .settings-select:focus {
                border-color: var(--accent-dim);
                box-shadow: 0 0 0 1px var(--accent-glow);
            }
            .settings-select option {
                background: var(--bg-deep);
                color: var(--text-primary);
            }
            .settings-select optgroup {
                color: var(--accent);
                font-weight: 600;
            }
            .settings-hint {
                font-size: 11px;
                color: var(--text-muted);
                font-family: var(--font-mono);
            }
            .settings-actions {
                display: flex;
                gap: 10px;
                margin-top: 8px;
                padding-top: 20px;
                border-top: 1px solid var(--border);
            }
            .settings-save-btn {
                flex: 1;
                padding: 10px 0;
                background: var(--accent);
                border: none;
                border-radius: var(--radius-md);
                color: var(--bg-deep);
                font-family: var(--font-display);
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
                letter-spacing: 0.5px;
            }
            .settings-save-btn:hover {
                background: var(--accent-bright);
                box-shadow: 0 0 20px rgba(0, 229, 255, 0.3);
            }
            .settings-reset-btn {
                padding: 10px 18px;
                background: none;
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                color: var(--text-muted);
                font-family: var(--font-display);
                font-size: 12px;
                cursor: pointer;
                transition: all 0.15s;
            }
            .settings-reset-btn:hover {
                color: var(--accent-warm);
                border-color: rgba(255, 107, 107, 0.3);
            }

            /* ── Help popover ── */
            .help-popover {
                position: absolute;
                bottom: 16px;
                left: 272px;
                width: 320px;
                background: var(--bg-surface);
                border: 1px solid var(--accent-dim);
                border-radius: var(--radius-lg);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 229, 255, 0.08);
                z-index: 80;
                animation: help-pop-in 0.2s var(--ease-out);
                overflow: hidden;
            }
            @keyframes help-pop-in {
                from { opacity: 0; transform: translateY(8px) scale(0.97); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .help-popover-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                border-bottom: 1px solid var(--border);
            }
            .help-popover-title {
                font-family: var(--font-display);
                font-size: 13px;
                font-weight: 600;
                color: var(--text-primary);
            }
            .help-close-btn {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: none;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                border-radius: var(--radius-sm);
                transition: all 0.15s;
            }
            .help-close-btn:hover {
                color: var(--accent-warm);
                background: rgba(255, 107, 107, 0.1);
            }
            .help-popover-body {
                padding: 12px 16px;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .help-section-label {
                font-family: var(--font-display);
                font-size: 10px;
                font-weight: 600;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                color: var(--text-muted);
                margin-bottom: 8px;
            }
            .help-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 0;
            }
            .help-row kbd {
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--accent);
                background: var(--accent-glow);
                border: 1px solid var(--accent-dim);
                border-radius: 4px;
                padding: 2px 8px;
            }
            .help-row span {
                font-size: 12px;
                color: var(--text-secondary);
            }
            .help-tip {
                font-size: 12px;
                color: var(--text-secondary);
                padding: 4px 0;
                padding-left: 12px;
                position: relative;
            }
            .help-tip::before {
                content: '';
                position: absolute;
                left: 0;
                top: 50%;
                transform: translateY(-50%);
                width: 4px;
                height: 4px;
                border-radius: 50%;
                background: var(--accent);
                opacity: 0.5;
            }

            /* Toast */
            .agent-toast {
                position: absolute;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(16px);
                background: var(--bg-deep);
                border: 1px solid var(--accent-dim);
                border-radius: var(--radius-md);
                padding: 8px 20px;
                font-family: var(--font-mono);
                font-size: 12px;
                color: var(--accent);
                opacity: 0;
                transition: all 0.3s;
                pointer-events: none;
                z-index: 120;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            }
            .agent-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }

            /* ── Scrollbar styling ── */
            .session-list::-webkit-scrollbar,
            .agent-messages::-webkit-scrollbar,
            .panel-body::-webkit-scrollbar,
            .settings-page-body::-webkit-scrollbar {
                width: 5px;
            }
            .session-list::-webkit-scrollbar-thumb,
            .agent-messages::-webkit-scrollbar-thumb,
            .panel-body::-webkit-scrollbar-thumb,
            .settings-page-body::-webkit-scrollbar-thumb {
                background: var(--text-muted);
                border-radius: 3px;
            }

            /* ── Tool call indicator ── */
            .tool-call-indicator {
                display: flex;
                align-items: center;
                padding: 10px 16px;
                width: 100%;
                height: 40px;
                margin: 8px 0;
                background: var(--bg-elevated);
                border: 1px solid var(--accent-dim);
                border-radius: var(--radius-md);
                cursor: pointer;
                position: relative;
                overflow: hidden;
                transition: all 0.2s;
                flex-shrink: 0;
                box-sizing: border-box;
            }
            .tool-call-indicator:hover {
                background: var(--bg-hover);
                border-color: var(--accent);
            }
            .tool-call-indicator.completed {
                opacity: 0.7;
                border-color: var(--border);
            }
            .tool-call-content {
                display: flex;
                align-items: center;
                gap: 8px;
                z-index: 1;
            }
            .tool-call-icon {
                font-size: 14px;
                color: var(--accent);
            }
            .tool-call-text {
                font-family: var(--font-mono);
                font-size: 12px;
                color: var(--text-secondary);
            }
            .tool-call-name {
                font-family: var(--font-mono);
                font-size: 12px;
                font-weight: 600;
                color: var(--accent);
            }
            .tool-call-time {
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--text-muted);
            }
            .tool-call-count {
                font-family: var(--font-mono);
                font-size: 10px;
                color: var(--text-muted);
                background: var(--bg-surface);
                padding: 2px 6px;
                border-radius: 10px;
                margin-left: auto;
            }
            .tool-call-scan {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.2), transparent);
                pointer-events: none;
                opacity: 0;
            }
            @keyframes tool-scan {
                0% { transform: translateX(-100%); opacity: 1; }
                70% { transform: translateX(0%); opacity: 1; }
                100% { transform: translateX(0%); opacity: 0.3; }
            }

            /* ── Assistant text container ── */
            .assistant-text {
                line-height: 1.75;
                color: var(--text-primary);
                word-break: break-word;
            }

            /* ── Tool entry count label ── */
            .tool-entry-count {
                font-family: var(--font-mono);
                font-size: 10px;
                color: var(--text-muted);
                background: var(--bg-surface);
                padding: 1px 5px;
                border-radius: 8px;
                flex-shrink: 0;
            }

            /* ── Tool modal ── */
            .tool-modal-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(2px);
                -webkit-backdrop-filter: blur(2px);
                z-index: 100;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: modal-in 0.2s ease-out;
            }
            @keyframes modal-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .tool-modal {
                width: min(700px, 90%);
                height: min(500px, 80%);
                background: var(--bg-surface);
                border: 1px solid var(--accent-dim);
                border-radius: var(--radius-lg);
                box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5), 0 0 60px rgba(0, 229, 255, 0.1);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .tool-modal-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 14px 20px;
                border-bottom: 1px solid var(--border);
                flex-shrink: 0;
            }
            .tool-modal-title {
                font-family: var(--font-display);
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary);
            }
            .tool-modal-count {
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--accent);
                background: var(--accent-glow);
                padding: 2px 8px;
                border-radius: 10px;
            }
            .tool-modal-nav {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-left: auto;
            }
            .tool-modal-prev,
            .tool-modal-next {
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: none;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                color: var(--text-muted);
                cursor: pointer;
                transition: all 0.15s;
            }
            .tool-modal-prev:hover:not(:disabled),
            .tool-modal-next:hover:not(:disabled) {
                color: var(--accent);
                border-color: var(--accent-dim);
                background: var(--accent-glow);
            }
            .tool-modal-prev:disabled,
            .tool-modal-next:disabled {
                opacity: 0.3;
                cursor: default;
            }
            .tool-modal-close {
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: none;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                border-radius: var(--radius-sm);
                margin-left: auto;
                font-size: 18px;
                transition: all 0.15s;
            }
            .tool-modal-close:hover {
                color: var(--accent-warm);
                background: rgba(255, 107, 107, 0.1);
            }
            .tool-modal-body {
                display: flex;
                gap: 1px;
                flex: 1;
                min-height: 0;
                background: var(--border);
            }
            .tool-modal-col {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: var(--bg-surface);
                min-width: 0;
            }
            .tool-modal-col-title {
                font-family: var(--font-display);
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 1px;
                text-transform: uppercase;
                color: var(--text-muted);
                padding: 10px 16px;
                border-bottom: 1px solid var(--border);
                flex-shrink: 0;
            }
            .tool-modal-content {
                flex: 1;
                overflow-y: auto;
                padding: 12px 16px;
                margin: 0;
                font-family: var(--font-mono);
                font-size: 12px;
                line-height: 1.6;
                color: var(--text-primary);
                white-space: pre-wrap;
                word-break: break-word;
            }
            .tool-modal-content.error {
                color: var(--accent-warm);
            }

            /* ── Tool complete effect ── */
            .tool-complete-effect {
                position: absolute;
                inset: 0;
                pointer-events: none;
                z-index: 10;
                overflow: hidden;
                border-radius: var(--radius-md);
            }
            .tool-complete-scan {
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent 0%, rgba(0, 229, 255, 0.3) 50%, transparent 100%);
                animation: toolCompleteScan 0.6s ease-out forwards;
            }
            @keyframes toolCompleteScan {
                to { left: 100%; }
            }
            .tool-complete-check {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%) scale(0);
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: #00e676;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: checkPop 0.3s 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                           checkFade 0.4s 1.2s ease-out forwards;
            }
            @keyframes checkPop {
                to { transform: translateY(-50%) scale(1); }
            }
            @keyframes checkFade {
                to { opacity: 0; }
            }
            .tool-complete-check svg {
                width: 14px;
                height: 14px;
                opacity: 0;
                animation: checkDraw 0.3s 0.6s ease-out forwards;
            }
            @keyframes checkDraw {
                to { opacity: 1; }
            }
            .tool-complete-border {
                position: absolute;
                inset: 0;
                border-radius: var(--radius-md);
                border: 2px solid transparent;
                animation: borderGlow 1.2s 0.3s ease-in-out forwards;
            }
            @keyframes borderGlow {
                0% { border-color: var(--accent); }
                20% { border-color: #00e676; }
                50% { border-color: rgba(0, 230, 118, 0.6); }
                80% { border-color: rgba(0, 230, 118, 0.2); }
                100% { border-color: rgba(0, 230, 118, 0); }
            }

            /* ── Light theme overrides ── */
            [data-theme="light"] .agent-root { background: var(--bg-base); }
            [data-theme="light"] .agent-sidebar { background: var(--bg-deep); }
            [data-theme="light"] .agent-panel { background: var(--bg-deep); }
            [data-theme="light"] .msg-row.assistant-row { background: var(--bg-surface); }
            [data-theme="light"] .welcome-glow { background: radial-gradient(circle, rgba(184, 134, 11, 0.06) 0%, transparent 70%); }
            [data-theme="light"] .thinking-dots span { background: var(--accent); }
            [data-theme="light"] .send-btn { background: var(--accent); color: var(--bg-deep); }
        `;
        container.appendChild(style);

        /* ══════════════════════════════════════════
           DOM refs
           ══════════════════════════════════════════ */
        const messagesEl = container.querySelector('#agent-messages');
        const welcomeEl = container.querySelector('#welcome-screen-chat');
        const homePage = container.querySelector('#home-page');
        const chatPage = container.querySelector('#chat-page');
        const settingsPage = container.querySelector('#settings-page');
        const homeInput = container.querySelector('#home-input');
        const homeSendBtn = container.querySelector('#home-send');
        const homeWelcomeText = container.querySelector('#home-welcome-text');
        const homeInputWrap = container.querySelector('.home-input-wrap');
        const inputEl = container.querySelector('#agent-input');
        const sendBtn = container.querySelector('#agent-send');
        const stopBtn = container.querySelector('#agent-stop');
        const toolsEl = container.querySelector('#agent-tools');
        const toolCountEl = container.querySelector('#tool-count');
        const terminalEl = container.querySelector('#agent-terminal');
        const thinkingEl = container.querySelector('#agent-thinking');
        const thinkingIndicator = container.querySelector('#thinking-indicator');
        const thinkingPanel = container.querySelector('#thinking-panel');
        const toolsPanel = container.querySelector('#tools-panel');
        const panelTabs = container.querySelectorAll('.panel-tab');
        const sessionSidebar = container.querySelector('#session-sidebar');
        const sessionListEl = container.querySelector('#session-list');
        const sessionNewBtn = container.querySelector('#session-new-btn');
        const sessionToggleBtn = container.querySelector('#session-toggle-btn');
        let sessionTitleDisplay = container.querySelector('#session-title-display');
        sessionTitleDisplay.addEventListener('dblclick', enableTitleEdit);
        const modelBadge = container.querySelector('#model-badge');
        const panelToggleBtn = container.querySelector('#panel-toggle-btn');
        const agentPanel = container.querySelector('#agent-panel');
        const sessionFilter = container.querySelector('#session-filter');
        const terminalClearBtn = container.querySelector('#terminal-clear');

        /* ══════════════════════════════════════════
           Page router
           ══════════════════════════════════════════ */
        let currentPage = 'home';

        function navigateTo(page) {
            container.querySelectorAll('.agent-page').forEach(p => p.style.display = 'none');
            const target = container.querySelector(`#${page}-page`);
            if (target) target.style.display = 'flex';
            currentPage = page;
        }

        /* ══════════════════════════════════════════
           State
           ══════════════════════════════════════════ */
        let ws = null;
        let messages = [];
        let isStreaming = false;
        let currentSessionId = null;
        let sessionCache = [];
        let _toolCount = 0;

        // Tool call indicator state
        let _conversationRound = 0;  // 对话轮次，会话内累加
        let _iterationInRound = 0;   // 当前轮次中的迭代次数（模型请求次数）
        let _iterationCount = 0;     // 当前位置累积的工具调用次数
        let _segmentToolCount = 0;   // 当前连续工具调用段的计数
        let _toolCallHistory = [];   // 工具调用历史
        let _toolIndicatorEl = null; // 消息区域的工具调用指示器元素
        let _toolStartTime = 0;      // 工具调用开始时间
        let _toolTimerInterval = null; // 工具调用计时器
        let _currentIteration = 0;   // 当前模型请求迭代次数（从后端获取）

        // Thinking panel state
        let _thinkingContent = '';   // 思维链内容累积
        let _isThinkingActive = false; // 是否正在思考
        let _currentThinkingTab = 'thinking'; // 当前选项卡：'thinking' 或 'tools'

        // Mode state
        let agentMode = 'assistant'; // 'assistant' or 'coder'
        const MODE_CONFIGS = {
            assistant: {
                systemPrompt: '你是 Eos Agent，一个强大的 AI 助手。\n你可以读写文件、执行终端命令、分析代码、回答问题。\n请用中文回复，保持友好和专业。',
                toolset: '',
                welcomeChips: [
                    { text: '分析代码结构', prompt: '帮我分析当前项目的代码结构' },
                    { text: '解释后端逻辑', prompt: '读取并解释 server.py 的核心逻辑' },
                    { text: '安全审查', prompt: '检查项目中是否有潜在的安全问题' },
                    { text: '项目概览', prompt: '给我一个项目的整体概览' },
                ],
            },
            coder: {
                systemPrompt: '你是一个专业的编程助手（Coder模式）。\n你专注于代码编写、调试和优化。\n请直接给出代码解决方案，减少解释，用中文回复。',
                toolset: 'default',
                welcomeChips: [
                    { text: '编写脚本', prompt: '帮我写一个 Python 脚本来处理数据' },
                    { text: '修复 Bug', prompt: '帮我找出并修复这个文件中的 bug' },
                    { text: '代码重构', prompt: '重构这段代码，提高可读性和性能' },
                    { text: '编写测试', prompt: '为这个函数编写单元测试' },
                ],
            },
        };

        // ── Register agent panel in sidebar ──
        os.registerAgentPanel({ id: agentId, name: 'Eos Agent', windowId: win.id });

        /* ══════════════════════════════════════════
           Session management
           ══════════════════════════════════════════ */

        async function loadSessions() {
            try {
                const res = await os.api('GET', '/api/agent/sessions');
                sessionCache = res.sessions || [];
                renderSessionList();
            } catch (e) {
                console.warn('Failed to load sessions:', e);
            }
        }

        function groupSessions(sessions) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const yesterday = today - 86400000;
            const week = today - 7 * 86400000;
            const groups = { today: [], yesterday: [], week: [], older: [] };
            for (const s of sessions) {
                const t = s.updated_at || 0;
                if (t >= today) groups.today.push(s);
                else if (t >= yesterday) groups.yesterday.push(s);
                else if (t >= week) groups.week.push(s);
                else groups.older.push(s);
            }
            return groups;
        }

        function renderSessionList(filter = '') {
            sessionListEl.innerHTML = '';
            const lf = filter.toLowerCase();
            const filtered = lf ? sessionCache.filter(s => (s.title || '').toLowerCase().includes(lf)) : sessionCache;
            const groups = groupSessions(filtered);
            const labels = { today: '今天', yesterday: '昨天', week: '最近 7 天', older: '更早' };

            for (const [key, list] of Object.entries(groups)) {
                if (list.length === 0) continue;
                const label = document.createElement('div');
                label.className = 'session-group-label';
                label.textContent = labels[key];
                sessionListEl.appendChild(label);

                for (const session of list) {
                    const el = document.createElement('div');
                    el.className = `session-item${session.id === currentSessionId ? ' active' : ''}`;
                    el.innerHTML = `
                        <div class="session-item-icon">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3.5C2 2.67 2.67 2 3.5 2h9c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5H5l-3 2V3.5z" stroke="currentColor" stroke-width="1.2"/></svg>
                        </div>
                        <div class="session-item-body">
                            <div class="session-item-title" data-session-id="${session.id}">${escapeHtml(session.title)}</div>
                            <div class="session-item-time">${formatTime(session.updated_at)}</div>
                        </div>
                        <button class="session-item-delete" title="删除">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 4L10 10M10 4L4 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                        </button>
                    `;
                    el.addEventListener('click', (e) => {
                        if (e.target.closest('.session-item-delete')) return;
                        if (e.target.closest('.session-item-title.editing')) return;
                        switchSession(session.id);
                        navigateTo('chat');
                    });
                    // 双击标题重命名
                    const titleEl = el.querySelector('.session-item-title');
                    titleEl.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        startSidebarRename(titleEl, session);
                    });
                    el.querySelector('.session-item-delete').addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                    });
                    sessionListEl.appendChild(el);
                }
            }

            if (filtered.length === 0) {
                sessionListEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">无匹配会话</div>';
            }
        }

        function resetToHome() {
            currentSessionId = null;
            win._agentSessionId = null;
            messagesEl.innerHTML = '';
            messages = [];
            _toolCount = 0;
            toolCountEl.textContent = '0';
            toolsEl.innerHTML = '';
            terminalEl.innerHTML = '';
            thinkingEl.innerHTML = '<div class="thinking-placeholder">等待模型思考...</div>';
            _currentThinkingBlock = null;
            showWelcome(true);
            updateSessionTitle('新会话');
            navigateTo('home');
            renderSessionList();
        }

        async function createNewSession() {
            try {
                const session = await os.api('POST', '/api/agent/sessions', { title: '新会话' });
                sessionCache.unshift(session);
                currentSessionId = session.id;
                messagesEl.innerHTML = '';
                messages = [];
                showWelcome(true);
                _toolCount = 0;
                toolCountEl.textContent = '0';
                toolsEl.innerHTML = '';
                terminalEl.innerHTML = '';
                renderSessionList();
                updateSessionTitle('新会话');

                // 通知后端新 session
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'session_id', session_id: session.id }));
                }
            } catch (e) {
                console.warn('Failed to create session:', e);
            }
        }

        async function switchSession(sessionId) {
            if (sessionId === currentSessionId) return;
            currentSessionId = sessionId;
            win._agentSessionId = sessionId;
            messagesEl.innerHTML = '';
            messages = [];
            _toolCount = 0;
            toolCountEl.textContent = '0';
            toolsEl.innerHTML = '';
            terminalEl.innerHTML = '';
            // 清除思维链内容
            thinkingEl.innerHTML = '<div class="thinking-placeholder">等待模型思考...</div>';
            _currentThinkingBlock = null;
            _conversationRound = 0;

            // 通知后端切换 session 并加载历史消息
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'session_id', session_id: sessionId }));
            }

            try {
                const res = await os.api('GET', `/api/agent/sessions/${sessionId}/messages`);
                const msgs = res.messages || [];
                if (msgs.length === 0) {
                    showWelcome(true);
                } else {
                    showWelcome(false);

                    // 构建 tool 结果映射
                    const toolResults = {};
                    for (const toolMsg of msgs) {
                        if (toolMsg.role === 'tool' && toolMsg.tool_call_id) {
                            toolResults[toolMsg.tool_call_id] = toolMsg;
                        }
                    }

                    // 一轮对话 = 用户输入 → 所有模型输出 → 直到下一条用户输入
                    let currentRound = 0;
                    let currentIteration = 0;
                    let roundSegments = [];  // 本轮的内容段：{type: 'text', content} 或 {type: 'tool_calls', calls}
                    let lastProcessedContent = '';

                    function flushRound() {
                        if (roundSegments.length === 0) return;
                        currentRound++;
                        currentIteration = 0;

                        // 创建用户消息头（Eos 图标）
                        showWelcome(false);
                        const row = document.createElement('div');
                        row.className = 'msg-row assistant-row';
                        row.innerHTML = `
                            <div class="msg-avatar assistant-avatar">E</div>
                            <div class="msg-body">
                                <div class="msg-role-label">Eos Agent</div>
                                <div class="msg-content">
                                    <div class="msg-text"></div>
                                </div>
                            </div>
                        `;
                        messagesEl.appendChild(row);
                        const textContainer = row.querySelector('.msg-text');

                        // 按顺序渲染每个段
                        for (const segment of roundSegments) {
                            if (segment.type === 'text' && segment.content) {
                                const span = document.createElement('span');
                                span.innerHTML = formatContent(segment.content);
                                textContainer.appendChild(span);
                            } else if (segment.type === 'tool_calls' && segment.calls.length > 0) {
                                // 只显示最新的一个工具面板
                                const lastTc = segment.calls[segment.calls.length - 1];
                                const toolName = lastTc.function?.name || lastTc.name || 'unknown';
                                const toolArgs = lastTc.function?.arguments || lastTc.arguments || {};
                                const toolResult = toolResults[lastTc.id];
                                const resultContent = toolResult?.content || '';
                                const isError = resultContent.startsWith('错误:') || resultContent.startsWith('Error:');

                                // 添加所有工具调用到右侧面板
                                for (const tc of segment.calls) {
                                    currentIteration++;
                                    const tcName = tc.function?.name || tc.name || 'unknown';
                                    const tcArgs = tc.function?.arguments || tc.arguments || {};
                                    const tcResult = toolResults[tc.id];
                                    const tcResultContent = tcResult?.content || '';
                                    const tcIsError = tcResultContent.startsWith('错误:') || tcResultContent.startsWith('Error:');
                                    addToolEntry(tcName, tcArgs, tcIsError ? 'error' : 'done', `R${currentRound}-${currentIteration}`);
                                }

                                // 添加工具面板到文本位置
                                const toolIndicator = document.createElement('div');
                                toolIndicator.className = 'tool-call-indicator completed';
                                const mergedCount = segment.calls.length;
                                toolIndicator.innerHTML = `
                                    <div class="tool-call-content">
                                        <span class="tool-call-icon">⚡</span>
                                        <span class="tool-call-text">Function Calling — 工具调用结束</span>
                                        <span class="tool-call-name">[${escapeHtml(toolName)}]</span>
                                        <span class="tool-call-time"></span>
                                        <span class="tool-call-count" data-full-round="Round ${mergedCount}">Round ${mergedCount}</span>
                                    </div>
                                    <div class="tool-call-scan"></div>
                                `;
                                toolIndicator.addEventListener('click', () => {
                                    // 获取当前 round 的所有工具调用
                                    const roundCalls = segment.calls.map(tc => {
                                        const tcName = tc.function?.name || tc.name || 'unknown';
                                        const tcArgs = tc.function?.arguments || tc.arguments || {};
                                        const tcResult = toolResults[tc.id];
                                        const tcResultContent = tcResult?.content || '';
                                        const tcIsError = tcResultContent.startsWith('错误:') || tcResultContent.startsWith('Error:');
                                        return {
                                            name: tcName,
                                            args: typeof tcArgs === 'string' ? JSON.parse(tcArgs) : tcArgs,
                                            result: tcResultContent,
                                            error: tcIsError ? tcResultContent : null,
                                            iteration: currentIteration
                                        };
                                    });

                                    let currentIndex = roundCalls.length - 1;
                                    const overlay = document.createElement('div');
                                    overlay.className = 'tool-modal-overlay';

                                    function renderModalContent(index) {
                                        const call = roundCalls[index];
                                        overlay.innerHTML = `
                                            <div class="tool-modal">
                                                <div class="tool-modal-header">
                                                    <span class="tool-modal-title">工具调用详情</span>
                                                    <div class="tool-modal-nav">
                                                        <button class="tool-modal-prev" ${index === 0 ? 'disabled' : ''}>
                                                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7L9 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                                        </button>
                                                        <span class="tool-modal-count">${index + 1} / ${roundCalls.length}</span>
                                                        <button class="tool-modal-next" ${index === roundCalls.length - 1 ? 'disabled' : ''}>
                                                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                                        </button>
                                                    </div>
                                                    <button class="tool-modal-close">×</button>
                                                </div>
                                                <div class="tool-modal-body">
                                                    <div class="tool-modal-col">
                                                        <div class="tool-modal-col-title">参数</div>
                                                        <pre class="tool-modal-content">${escapeHtml(JSON.stringify(call.args, null, 2))}</pre>
                                                    </div>
                                                    <div class="tool-modal-col">
                                                        <div class="tool-modal-col-title">${call.error ? '错误' : '返回值'}</div>
                                                        <pre class="tool-modal-content ${call.error ? 'error' : ''}">${escapeHtml(call.error || call.result)}</pre>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                        overlay.querySelector('.tool-modal-close').addEventListener('click', () => overlay.remove());
                                        const prevBtn = overlay.querySelector('.tool-modal-prev');
                                        const nextBtn = overlay.querySelector('.tool-modal-next');
                                        if (prevBtn && !prevBtn.disabled) {
                                            prevBtn.addEventListener('click', () => {
                                                currentIndex--;
                                                renderModalContent(currentIndex);
                                            });
                                        }
                                        if (nextBtn && !nextBtn.disabled) {
                                            nextBtn.addEventListener('click', () => {
                                                currentIndex++;
                                                renderModalContent(currentIndex);
                                            });
                                        }
                                    }

                                    overlay.addEventListener('click', (e) => {
                                        if (e.target === overlay) overlay.remove();
                                    });
                                    renderModalContent(currentIndex);
                                    container.querySelector('.agent-root').appendChild(overlay);
                                });
                                textContainer.appendChild(toolIndicator);
                                // 立即触发响应式更新
                                updateToolIndicatorResponsive();
                                // 扫描光效
                                const settings = loadSettings();
                                const scanSpeed = settings.toolScanSpeed || 1.0;
                                const scan = toolIndicator.querySelector('.tool-call-scan');
                                if (scan) {
                                    scan.style.animation = `tool-scan ${scanSpeed}s ease-out forwards`;
                                    scan.addEventListener('animationend', () => {
                                        // 保持最终状态
                                    }, { once: true });
                                }

                                _toolCallHistory.push({
                                    name: toolName,
                                    args: typeof toolArgs === 'string' ? JSON.parse(toolArgs) : toolArgs,
                                    result: resultContent,
                                    error: isError ? resultContent : null,
                                    time: Date.now(),
                                    iterationCount: currentIteration,
                                    roundLabel: `R${currentRound}-${currentIteration}`,
                                });
                            }
                        }

                        // 智能滚动
                        const isAtBottom = messagesEl.scrollHeight - messagesEl.scrollTop <= messagesEl.clientHeight + 100;
                        if (isAtBottom) {
                            messagesEl.scrollTop = messagesEl.scrollHeight;
                        }

                        roundSegments = [];
                    }

                    for (const msg of msgs) {
                        if (msg.role === 'user') {
                            flushRound();
                            addMessage('user', msg.content, true);
                            lastProcessedContent = '';
                        } else if (msg.role === 'assistant') {
                            if (msg.content === lastProcessedContent) continue;
                            lastProcessedContent = msg.content || '';

                            // 添加文本段
                            if (msg.content) {
                                roundSegments.push({ type: 'text', content: msg.content });
                            }
                            // 添加工具调用段（合并连续的工具调用）
                            if (msg.tool_calls && msg.tool_calls.length > 0) {
                                const lastSegment = roundSegments[roundSegments.length - 1];
                                if (lastSegment && lastSegment.type === 'tool_calls') {
                                    // 合并到上一个工具调用段
                                    lastSegment.calls.push(...msg.tool_calls);
                                } else {
                                    // 创建新的工具调用段
                                    roundSegments.push({ type: 'tool_calls', calls: msg.tool_calls });
                                }
                            }
                        }
                    }

                    flushRound();
                }
                const session = sessionCache.find(s => s.id === sessionId);
                if (session) updateSessionTitle(session.title);
                renderSessionList();
            } catch (e) {
                console.warn('Failed to load messages:', e);
            }
        }

        async function deleteSession(sessionId) {
            try {
                await os.api('DELETE', `/api/agent/sessions/${sessionId}`);
                sessionCache = sessionCache.filter(s => s.id !== sessionId);
                if (currentSessionId === sessionId) {
                    if (sessionCache.length > 0) {
                        await switchSession(sessionCache[0].id);
                    } else {
                        resetToHome();
                    }
                } else {
                    renderSessionList();
                }
            } catch (e) {
                console.warn('Failed to delete session:', e);
            }
        }

        let _lastUserMessage = '';  // 记录最后一条用户消息，用于生成标题

        async function persistMessage(role, content) {
            if (!currentSessionId) return;
            try {
                await os.api('POST', `/api/agent/sessions/${currentSessionId}/messages`, { role, content });
                const session = sessionCache.find(s => s.id === currentSessionId);
                if (session) {
                    session.message_count = (session.message_count || 0) + 1;
                    session.updated_at = Date.now();
                    if (role === 'user') {
                        _lastUserMessage = content;
                        // 如果没有配置辅助模型，立即生成标题
                        const settings = loadSettings();
                        if (!settings.helperSource && session.title === '新会话') {
                            const title = generateTitleLocal(content);
                            await os.api('PUT', `/api/agent/sessions/${currentSessionId}`, { title });
                            session.title = title;
                            updateSessionTitle(title);
                        }
                    }
                    sessionCache.sort((a, b) => b.updated_at - a.updated_at);
                    renderSessionList();
                }
            } catch (e) {
                console.warn('Failed to persist message:', e);
            }
        }

        async function generateSessionTitle(assistantContent) {
            console.log('[Title] generateSessionTitle called, sessionId:', currentSessionId, 'lastUser:', JSON.stringify(_lastUserMessage)?.slice(0,50), 'assistant:', JSON.stringify(assistantContent)?.slice(0,50));
            if (!currentSessionId || !_lastUserMessage) { console.log('[Title] early exit: no session or no user msg'); return; }
            const session = sessionCache.find(s => s.id === currentSessionId);
            if (!session) { console.log('[Title] early exit: session not found in cache'); return; }
            if (session.title !== '新会话') { console.log('[Title] early exit: title already set:', session.title); return; }

            const settings = loadSettings();
            console.log('[Title] settings.helperSource:', settings.helperSource, 'helperModel:', settings.helperModel);

            try {
                const title = await generateTitle(_lastUserMessage, _lastUserMessage, assistantContent);
                console.log('[Title] generateTitle returned:', JSON.stringify(title)?.slice(0,80));
                if (title) {
                    await os.api('PUT', `/api/agent/sessions/${currentSessionId}`, { title });
                    session.title = title;
                    updateSessionTitle(title);
                    renderSessionList();
                }
            } catch (e) {
                console.warn('Failed to generate session title:', e);
            }
        }

        function updateSessionTitle(title) {
            sessionTitleDisplay.textContent = title || 'Eos Agent';
        }

        async function generateTitle(content, userMessage, assistantMessage) {
            const settings = loadSettings();
            console.log('[Title] generateTitle, content:', JSON.stringify(content)?.slice(0,50), 'helperSource:', settings.helperSource);

            // 如果配置了辅助模型，使用它生成标题
            if (settings.helperSource) {
                console.log('[Title] trying helper model:', settings.helperSource, settings.helperModel || settings.helperName);
                try {
                    let title = await generateTitleWithHelperModel(settings, userMessage, assistantMessage);
                    console.log('[Title] helper model returned:', JSON.stringify(title)?.slice(0,80));
                    if (title) {
                        // 清理标题：去除引号、多余空白
                        title = title.replace(/^["']|["']$/g, '').trim();
                        if (title.length > 0 && title.length <= 50) {
                            return title;
                        }
                    }
                } catch (e) {
                    console.warn('[Title] Helper model failed:', e);
                }
            }

            // 降级到本地生成
            const localTitle = generateTitleLocal(content);
            console.log('[Title] local fallback:', JSON.stringify(localTitle)?.slice(0,80));
            return localTitle;
        }

        function generateTitleLocal(content) {
            // 清理内容：去除多余空白、换行、markdown标记
            let text = content
                .replace(/```[\s\S]*?```/g, '[代码]')  // 代码块
                .replace(/`[^`]+`/g, '')                 // 行内代码
                .replace(/[#*_~\[\]()]/g, '')            // markdown符号
                .replace(/\s+/g, ' ')                    // 合并空白
                .trim();

            // 如果内容太短，直接返回
            if (text.length <= 20) return text || '新会话';

            // 尝试在标点处截断
            const punctuations = ['。', '？', '！', '，', '；', '.', '?', '!', ',', ';'];
            let cutPos = 30;
            for (const p of punctuations) {
                const pos = text.indexOf(p, 10);
                if (pos > 0 && pos < 40) {
                    cutPos = pos + 1;
                    break;
                }
            }

            return text.slice(0, cutPos).trim() + (text.length > cutPos ? '...' : '');
        }

        async function generateTitleWithHelperModel(settings, userMessage, assistantMessage) {
            const prompt = `请为以下对话生成一个简短的标题（不超过20个字，不要包含引号或其他标点符号）：

用户：${userMessage}
助手：${assistantMessage}

标题：`;

            if (settings.helperSource === 'os') {
                // 使用系统模型（流式 API，需要 onText 回调累积内容）
                if (!settings.helperModel) return null;
                let text = '';
                await os.llm.chat({
                    model: settings.helperModel,
                    messages: [{ role: 'user', content: prompt }],
                    maxTokens: 100,
                    onText: (t) => { text += t; },
                    onDone: () => {},
                    onError: (msg) => { console.warn('[Title] helper model error:', msg); },
                });
                console.log('[Title] helper model text:', JSON.stringify(text)?.slice(0,80));
                return text.trim() || null;
            } else if (settings.helperSource === 'custom') {
                // 使用自定义配置（非流式 inline-chat）
                if (!settings.helperKey || !settings.helperUrl || !settings.helperName) return null;
                const response = await os.api('POST', '/api/llm/inline-chat', {
                    api_key: settings.helperKey,
                    api_base: settings.helperUrl,
                    model: settings.helperName,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 100,
                });
                if (response && response.content) {
                    return response.content.trim();
                }
            }
            return null;
        }

        function enableTitleEdit() {
            const currentTitle = sessionTitleDisplay.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'title-edit';
            input.value = currentTitle === 'Eos Agent' ? '' : currentTitle;
            input.placeholder = '输入标题...';

            const finishEdit = async (save) => {
                const newTitle = input.value.trim();
                if (save && newTitle && newTitle !== currentTitle) {
                    try {
                        await os.api('PUT', `/api/agent/sessions/${currentSessionId}`, { title: newTitle });
                        const session = sessionCache.find(s => s.id === currentSessionId);
                        if (session) session.title = newTitle;
                        updateSessionTitle(newTitle);
                        renderSessionList();
                    } catch (e) {
                        console.warn('Failed to rename session:', e);
                        updateSessionTitle(currentTitle);
                    }
                } else {
                    updateSessionTitle(currentTitle);
                }
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); finishEdit(true); }
                if (e.key === 'Escape') finishEdit(false);
            });
            input.addEventListener('blur', () => finishEdit(true));

            sessionTitleDisplay.replaceWith(input);
            input.focus();
            input.select();

            // 编辑完成后恢复原始元素
            input.addEventListener('blur', () => {
                const span = document.createElement('span');
                span.id = 'session-title-display';
                span.textContent = input.value.trim() || 'Eos Agent';
                span.addEventListener('dblclick', enableTitleEdit);
                input.replaceWith(span);
                // 更新引用
                sessionTitleDisplay = span;
            }, { once: true });
        }

        function startSidebarRename(titleEl, session) {
            const currentTitle = session.title;
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'session-item-title editing';
            input.value = currentTitle;
            input.style.width = '100%';

            const finishEdit = async (save) => {
                const newTitle = input.value.trim();
                if (save && newTitle && newTitle !== currentTitle) {
                    try {
                        await os.api('PUT', `/api/agent/sessions/${session.id}`, { title: newTitle });
                        session.title = newTitle;
                        if (session.id === currentSessionId) {
                            updateSessionTitle(newTitle);
                        }
                    } catch (e) {
                        console.warn('Failed to rename session:', e);
                    }
                }
                renderSessionList();
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); finishEdit(true); }
                if (e.key === 'Escape') finishEdit(false);
                e.stopPropagation();
            });
            input.addEventListener('blur', () => finishEdit(true));
            input.addEventListener('click', (e) => e.stopPropagation());

            titleEl.replaceWith(input);
            input.focus();
            input.select();
        }

        function formatTime(ts) {
            if (!ts) return '';
            const d = new Date(ts);
            const now = new Date();
            const diffMs = now - d;
            const diffMin = Math.floor(diffMs / 60000);
            const diffHr = Math.floor(diffMs / 3600000);
            if (diffMin < 1) return '刚刚';
            if (diffMin < 60) return `${diffMin} 分钟前`;
            if (diffHr < 24) return `${diffHr} 小时前`;
            const month = d.getMonth() + 1;
            const day = d.getDate();
            return `${month}/${day}`;
        }

        /* ══════════════════════════════════════════
           WebSocket connection
           ══════════════════════════════════════════ */

        function connect() {
            const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(`${proto}//${location.host}/ws/agent/custom/${agentId}`);

            ws.onopen = () => {
                os.updateAgentPanel(agentId, { status: 'idle', contextTokens: 0 });
                addSystemMessage('已连接到 Agent 引擎');
                const s = loadSettings();
                // 始终发送配置（包括 toolset、eos_context_enabled 等）
                ws.send(JSON.stringify({ type: 'configure', settings: s }));
                if (s.model) {
                    updateModelBadge(s.model);
                }
                // 请求 Skill 列表
                setTimeout(fetchSkills, 500);
                // 如果有当前 session，发送给后端加载历史消息
                if (currentSessionId) {
                    ws.send(JSON.stringify({ type: 'session_id', session_id: currentSessionId }));
                }
            };

            ws.onmessage = (e) => {
                try {
                    handleMessage(JSON.parse(e.data));
                } catch {
                    appendAssistantText(e.data);
                }
            };

            ws.onclose = () => {
                os.updateAgentPanel(agentId, { status: 'idle' });
                addSystemMessage('连接已断开，正在重连...');
                setTimeout(connect, 3000);
            };

            ws.onerror = () => {};
        }

        let _activeCallId = null;

        function _finishActiveCall(status, extra) {
            if (_activeCallId) {
                os.updateModelCall(_activeCallId, { status, endTime: Date.now(), ...extra });
                _activeCallId = null;
            }
        }

        function handleMessage(data) {
            switch (data.type) {
                case 'thinking':
                    _finishActiveCall('done');
                    os.updateAgentPanel(agentId, { status: 'thinking' });
                    showThinkingIndicator();
                    // 思维链内容处理
                    if (data.content) {
                        if (!_isThinkingActive) {
                            setThinkingActive(true);
                        }
                        appendThinkingContent(data.content);
                    }
                    // 保存后端发送的迭代次数（模型请求次数）
                    if (data.iteration) {
                        _currentIteration = data.iteration;
                    }
                    if (data.call_id && data.model) {
                        _activeCallId = data.call_id;
                        os.registerModelCall({
                            id: data.call_id,
                            model: data.model,
                            type: 'chat',
                            status: 'streaming',
                            app: 'Agent',
                            startTime: Date.now(),
                        });
                    }
                    break;
                case 'text':
                    removeThinkingIndicator();
                    // 思维链区域添加浅分隔线（文本输出打断思维链）
                    if (_isThinkingActive) {
                        setThinkingActive(false);
                        addThinkingSeparator('light');
                    }
                    // 模型输出文本，重置迭代计数
                    _iterationCount = 0;
                    _segmentToolCount = 0;  // 文本打断连续工具调用段
                    // 如果有正在进行的工具调用，标记完成
                    if (_toolIndicatorEl) {
                        updateToolIndicator('工具调用结束');
                        playCompleteEffect(_toolIndicatorEl);
                        _toolIndicatorEl = null;
                    }
                    appendAssistantText(data.content);
                    _finishActiveCall('done', { tokens: data.tokens || 0, latency: data.latency || 0 });
                    break;
                case 'tool_call':
                    removeThinkingIndicator();
                    _iterationCount++;
                    _segmentToolCount++;
                    _toolStartTime = Date.now();
                    // 使用后端发送的迭代次数（模型请求次数）
                    const roundLabel = `R${_currentIteration}-${_segmentToolCount}`;
                    _toolCallHistory.push({
                        name: data.name,
                        args: data.arguments,
                        result: null,
                        error: null,
                        time: _toolStartTime,
                        iterationCount: _currentIteration,
                        roundLabel: roundLabel,
                    });
                    showToolIndicator(data.name, _currentIteration);
                    startToolTimer();
                    addToolEntry(data.name, data.arguments, 'pending', roundLabel, data.call_id);
                    os.updateAgentPanel(agentId, { status: 'tool', toolName: data.name });
                    _finishActiveCall('done', { tokens: data.tokens || 0, latency: data.latency || 0 });
                    break;
                case 'tool_result':
                    const elapsed = ((Date.now() - _toolStartTime) / 1000).toFixed(1);
                    updateToolIndicator(data.name, elapsed);
                    updateToolEntry(data.name, data.result, data.error, data.call_id);
                    // 更新历史记录
                    const lastCall = _toolCallHistory[_toolCallHistory.length - 1];
                    if (lastCall && lastCall.name === data.name) {
                        lastCall.result = data.result;
                        lastCall.error = data.error;
                    }
                    os.updateAgentPanel(agentId, { status: 'output' });
                    break;
                case 'skill_activated':
                    addSystemMessage(`Skill "${data.skill}" 已激活`);
                    if (data.args) addSystemMessage(`参数: ${data.args}`);
                    break;
                case 'token_stats':
                    updateTokenDisplay(data);
                    break;
                case 'done':
                    removeThinkingIndicator();
                    // 如果有正在进行的工具调用，标记完成
                    if (_toolIndicatorEl) {
                        updateToolIndicator('工具调用结束');
                        playCompleteEffect(_toolIndicatorEl);
                        _toolIndicatorEl = null;
                    }
                    const finalContent = _assistantContent;  // 在清空前保存
                    console.log('[Title] done event, finalContent:', JSON.stringify(finalContent)?.slice(0,80));
                    finishAssistantMessage();
                    _finishActiveCall('done');
                    os.updateAgentPanel(agentId, { status: 'idle' });
                    _setStreaming(false);
                    _sending = false;
                    if (data.total_tokens) updateTokenDisplay(data);
                    if (data.tokens) os.updateAgentPanel(agentId, { contextTokens: data.tokens });
                    if (data.queued) addSystemMessage(`队列中还有 ${data.queued} 条消息等待处理`);
                    // 生成会话标题（如果需要）
                    generateSessionTitle(finalContent || '');
                    break;
                case 'error':
                    removeThinkingIndicator();
                    // 如果有正在进行的工具调用，标记完成
                    if (_toolIndicatorEl) {
                        updateToolIndicator('工具调用结束');
                        playCompleteEffect(_toolIndicatorEl);
                        _toolIndicatorEl = null;
                    }
                    _finishActiveCall('error', { error: data.message });
                    addSystemMessage('错误: ' + data.message);
                    os.updateAgentPanel(agentId, { status: 'idle' });
                    _setStreaming(false);
                    _sending = false;
                    break;
                case 'interrupted':
                    removeThinkingIndicator();
                    // 如果有正在进行的工具调用，标记完成
                    if (_toolIndicatorEl) {
                        updateToolIndicator('工具调用结束');
                        playCompleteEffect(_toolIndicatorEl);
                        _toolIndicatorEl = null;
                    }
                    addSystemMessage('Agent 已中断');
                    os.updateAgentPanel(agentId, { status: 'idle' });
                    _setStreaming(false);
                    _sending = false;
                    break;
                case 'queued':
                    addSystemMessage(`消息已排队 (位置: ${data.position})`);
                    break;
            }
        }

        /* ══════════════════════════════════════════
           Tool call indicator
           ══════════════════════════════════════════ */

        function showToolIndicator(toolName, iterationCount) {
            // 如果已经存在工具调用指示器，更新它
            if (_toolIndicatorEl) {
                _toolIndicatorEl.querySelector('.tool-call-name').textContent = `[${escapeHtml(toolName)}]`;
                const countEl = _toolIndicatorEl.querySelector('.tool-call-count');
                countEl.textContent = `Iteration ${iterationCount}`;
                countEl.dataset.fullRound = `Iteration ${iterationCount}`;
                _toolIndicatorEl.dataset.toolName = toolName;
                _toolIndicatorEl.dataset.iterationCount = iterationCount;
            } else {
                // 先渲染缓冲区的文本
                flushPendingText();

                // 移除流式临时元素
                if (_assistantTextEl) {
                    _assistantTextEl.querySelectorAll('.streaming-pending').forEach(el => el.remove());
                }

                // 创建工具调用指示器
                _toolIndicatorEl = document.createElement('div');
                _toolIndicatorEl.className = 'tool-call-indicator';
                _toolIndicatorEl.addEventListener('click', () => openToolModal());
                _toolIndicatorEl.innerHTML = `
                    <div class="tool-call-content">
                        <span class="tool-call-icon">⚡</span>
                        <span class="tool-call-text">Function Calling — 正在调用工具</span>
                        <span class="tool-call-name">[${escapeHtml(toolName)}]</span>
                        <span class="tool-call-time"></span>
                        <span class="tool-call-count" data-full-round="Iteration ${iterationCount}">Iteration ${iterationCount}</span>
                    </div>
                    <div class="tool-call-scan"></div>
                `;
                _toolIndicatorEl.dataset.toolName = toolName;
                _toolIndicatorEl.dataset.iterationCount = iterationCount;

                // 创建或复用 assistant 消息块
                if (!_currentAssistantEl) {
                    _currentAssistantEl = document.createElement('div');
                    _currentAssistantEl.className = 'msg-row assistant-row';
                    _currentAssistantEl.innerHTML = `
                        <div class="msg-avatar assistant-avatar">E</div>
                        <div class="msg-body">
                            <div class="msg-role-label">Eos Agent</div>
                            <div class="msg-content">
                                <div class="msg-text"></div>
                            </div>
                        </div>
                    `;
                    messagesEl.appendChild(_currentAssistantEl);
                    _assistantContentEl = _currentAssistantEl.querySelector('.msg-content');
                    _assistantTextEl = _currentAssistantEl.querySelector('.msg-text');
                    _assistantContent = '';
                    _pendingText = '';
                }

                // 将工具调用指示器插入到 msg-text 容器中（在当前文本之后）
                _assistantTextEl.appendChild(_toolIndicatorEl);

                // 立即触发响应式更新
                updateToolIndicatorResponsive();

                // 智能滚动
                const isAtBottom = messagesEl.scrollHeight - messagesEl.scrollTop <= messagesEl.clientHeight + 100;
                if (isAtBottom) {
                    messagesEl.scrollTop = messagesEl.scrollHeight;
                }
            }

            // 清除旧的定时器
            if (_toolTimerInterval) {
                clearInterval(_toolTimerInterval);
                _toolTimerInterval = null;
            }

            // 触发扫描动画
            const settings = loadSettings();
            const scanSpeed = settings.toolScanSpeed || 1.0;
            const scan = _toolIndicatorEl.querySelector('.tool-call-scan');
            scan.style.animation = 'none';
            scan.offsetHeight; // 强制重排
            scan.style.animation = `tool-scan ${scanSpeed}s ease-out forwards`;

            // 动画结束后保留光效（缓慢浮现）
            scan.addEventListener('animationend', () => {
                // 保持最终状态，不清理动画
            }, { once: true });

            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function updateToolIndicator(toolName, elapsed) {
            if (!_toolIndicatorEl) return;
            const timeEl = _toolIndicatorEl.querySelector('.tool-call-time');
            const nameEl = _toolIndicatorEl.querySelector('.tool-call-name');
            if (timeEl && elapsed) {
                timeEl.textContent = `[${elapsed}s]`;
            }
            if (nameEl && toolName && toolName !== '工具调用结束') {
                nameEl.textContent = `[${escapeHtml(toolName)}]`;
            }
            if (toolName === '工具调用结束') {
                // 停止计时器
                if (_toolTimerInterval) {
                    clearInterval(_toolTimerInterval);
                    _toolTimerInterval = null;
                }
                const textEl = _toolIndicatorEl.querySelector('.tool-call-text');
                if (textEl) textEl.textContent = 'Function Calling — 工具调用结束';
                _toolIndicatorEl.classList.add('completed');
                // 触发响应式更新
                updateToolIndicatorResponsive();
            }
        }

        function startToolTimer() {
            if (!_toolIndicatorEl) return;
            const timeEl = _toolIndicatorEl.querySelector('.tool-call-time');
            if (!timeEl) return;

            // 清除旧的定时器
            if (_toolTimerInterval) {
                clearInterval(_toolTimerInterval);
            }

            // 启动新的定时器，每 0.1 秒更新一次
            _toolTimerInterval = setInterval(() => {
                if (!_toolStartTime) return;
                const elapsed = ((Date.now() - _toolStartTime) / 1000).toFixed(1);
                timeEl.textContent = `[${elapsed}s]`;
            }, 100);
        }

        function removeToolIndicator() {
            if (_toolIndicatorEl) {
                _toolIndicatorEl.remove();
                _toolIndicatorEl = null;
            }
        }

        function openToolModal() {
            if (!_toolIndicatorEl) return;

            // 获取当前迭代的所有工具调用
            const currentIteration = _currentIteration;
            const roundCalls = _toolCallHistory.filter(call => call.roundLabel.startsWith(`R${currentIteration}-`));
            if (roundCalls.length === 0) return;

            // 当前显示的索引
            let currentIndex = roundCalls.length - 1;

            // 创建模态框
            const overlay = document.createElement('div');
            overlay.className = 'tool-modal-overlay';

            function renderModalContent(index) {
                const call = roundCalls[index];
                const args = call.args || {};
                const result = call.result || '等待返回值...';
                const error = call.error || null;
                const iterationLabel = call.roundLabel || '';

                overlay.innerHTML = `
                    <div class="tool-modal">
                        <div class="tool-modal-header">
                            <span class="tool-modal-title">工具调用详情</span>
                            <div class="tool-modal-nav">
                                <button class="tool-modal-prev" ${index === 0 ? 'disabled' : ''}>
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7L9 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                </button>
                                <span class="tool-modal-count">${index + 1} / ${roundCalls.length}</span>
                                <button class="tool-modal-next" ${index === roundCalls.length - 1 ? 'disabled' : ''}>
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                </button>
                            </div>
                            <button class="tool-modal-close">×</button>
                        </div>
                        <div class="tool-modal-body">
                            <div class="tool-modal-col">
                                <div class="tool-modal-col-title">参数</div>
                                <pre class="tool-modal-content">${escapeHtml(JSON.stringify(args, null, 2))}</pre>
                            </div>
                            <div class="tool-modal-col">
                                <div class="tool-modal-col-title">${error ? '错误' : '返回值'}</div>
                                <pre class="tool-modal-content ${error ? 'error' : ''}">${escapeHtml(error || result)}</pre>
                            </div>
                        </div>
                    </div>
                `;

                // 绑定事件
                overlay.querySelector('.tool-modal-close').addEventListener('click', () => overlay.remove());
                const prevBtn = overlay.querySelector('.tool-modal-prev');
                const nextBtn = overlay.querySelector('.tool-modal-next');
                if (prevBtn && !prevBtn.disabled) {
                    prevBtn.addEventListener('click', () => {
                        currentIndex--;
                        renderModalContent(currentIndex);
                    });
                }
                if (nextBtn && !nextBtn.disabled) {
                    nextBtn.addEventListener('click', () => {
                        currentIndex++;
                        renderModalContent(currentIndex);
                    });
                }
            }

            // 关闭逻辑
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.remove();
            });

            renderModalContent(currentIndex);
            container.querySelector('.agent-root').appendChild(overlay);
        }

        function playCompleteEffect(indicatorEl) {
            if (!indicatorEl) return;

            const effect = document.createElement('div');
            effect.className = 'tool-complete-effect';
            indicatorEl.appendChild(effect);

            effect.innerHTML = `
                <div class="tool-complete-scan"></div>
                <div class="tool-complete-border"></div>
                <div class="tool-complete-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 12 10 16 18 8"/>
                    </svg>
                </div>
            `;

            // 1.8s 后清理
            setTimeout(() => effect.remove(), 1800);
        }

        /* ══════════════════════════════════════════
           Message rendering
           ══════════════════════════════════════════ */

        function showWelcome(show) {
            if (!welcomeEl) return;
            welcomeEl.style.display = show ? 'flex' : 'none';
        }

        function addMessage(role, content, skipPersist = false) {
            showWelcome(false);
            const row = document.createElement('div');
            row.className = `msg-row ${role === 'user' ? 'user-row' : 'assistant-row'}`;

            const avatar = document.createElement('div');
            avatar.className = `msg-avatar ${role === 'user' ? 'user-avatar' : 'assistant-avatar'}`;
            avatar.textContent = role === 'user' ? 'U' : 'E';

            const body = document.createElement('div');
            body.className = 'msg-body';

            const label = document.createElement('div');
            label.className = 'msg-role-label';
            label.textContent = role === 'user' ? '你' : 'Eos Agent';

            const contentEl = document.createElement('div');
            contentEl.className = 'msg-content';

            // 为 assistant 消息添加 .msg-text 容器
            if (role === 'assistant') {
                const textEl = document.createElement('div');
                textEl.className = 'msg-text';
                textEl.innerHTML = formatContent(content);
                contentEl.appendChild(textEl);
            } else {
                contentEl.innerHTML = formatContent(content);
            }

            body.appendChild(label);
            body.appendChild(contentEl);
            row.appendChild(avatar);
            row.appendChild(body);
            messagesEl.appendChild(row);

            // 智能滚动：仅当用户在底部时才自动滚动
            const isAtBottom = messagesEl.scrollHeight - messagesEl.scrollTop <= messagesEl.clientHeight + 100;
            if (isAtBottom) {
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }

            messages.push({ role, content });

            if (!skipPersist && role !== 'system') {
                persistMessage(role, content);
            }
        }

        function addSystemMessage(text) {
            showWelcome(false);
            const el = document.createElement('div');
            el.className = 'sys-msg';
            el.textContent = text;
            messagesEl.appendChild(el);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        let _thinkingEl = null;

        function showThinkingIndicator() {
            if (_thinkingEl) return;
            showWelcome(false);

            // 确保 assistant 消息块存在
            if (!_currentAssistantEl) {
                _currentAssistantEl = document.createElement('div');
                _currentAssistantEl.className = 'msg-row assistant-row';
                _currentAssistantEl.innerHTML = `
                    <div class="msg-avatar assistant-avatar">E</div>
                    <div class="msg-body">
                        <div class="msg-role-label">Eos Agent</div>
                        <div class="msg-content">
                            <div class="msg-text"></div>
                        </div>
                    </div>
                `;
                messagesEl.appendChild(_currentAssistantEl);
                _assistantContentEl = _currentAssistantEl.querySelector('.msg-content');
                _assistantTextEl = _currentAssistantEl.querySelector('.msg-text');
                _assistantContent = '';
                _pendingText = '';
            }

            // 创建 thinking 指示器（作为 msg-text 的子元素）
            _thinkingEl = document.createElement('div');
            _thinkingEl.className = 'thinking-indicator';
            _thinkingEl.innerHTML = `
                <div class="thinking-dots"><span></span><span></span><span></span></div>
            `;
            _assistantTextEl.appendChild(_thinkingEl);

            // 智能滚动
            const isAtBottom = messagesEl.scrollHeight - messagesEl.scrollTop <= messagesEl.clientHeight + 100;
            if (isAtBottom) {
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }
        }

        function removeThinkingIndicator() {
            if (_thinkingEl) {
                _thinkingEl.remove();
                _thinkingEl = null;
            }
        }

        let _currentAssistantEl = null;
        let _assistantContent = '';
        let _assistantContentEl = null;
        let _assistantTextEl = null;   // 文本容器
        let _pendingText = '';         // 待渲染的文本缓冲区

        function flushPendingText() {
            // 将缓冲区的文本渲染为一个 <span> 元素
            if (_pendingText && _assistantTextEl) {
                const span = document.createElement('span');
                span.innerHTML = formatContent(_pendingText);
                _assistantTextEl.appendChild(span);
                _pendingText = '';
            }
        }

        function appendAssistantText(text) {
            if (!_currentAssistantEl) {
                // 移除 thinking 指示器
                if (_thinkingEl) {
                    _thinkingEl.remove();
                    _thinkingEl = null;
                }
                _currentAssistantEl = document.createElement('div');
                _currentAssistantEl.className = 'msg-row assistant-row';
                _currentAssistantEl.innerHTML = `
                    <div class="msg-avatar assistant-avatar">E</div>
                    <div class="msg-body">
                        <div class="msg-role-label">Eos Agent</div>
                        <div class="msg-content">
                            <div class="msg-text streaming-cursor"></div>
                        </div>
                    </div>
                `;
                messagesEl.appendChild(_currentAssistantEl);
                _assistantContentEl = _currentAssistantEl.querySelector('.msg-content');
                _assistantTextEl = _currentAssistantEl.querySelector('.msg-text');
                _assistantContent = '';
                _pendingText = '';
            }

            // 只追加到缓冲区，不立即渲染
            _assistantContent += text;
            _pendingText += text;

            // 实时显示：创建临时 span 显示流式内容
            let streamingSpan = _assistantTextEl.querySelector('.streaming-pending');
            if (!streamingSpan) {
                streamingSpan = document.createElement('span');
                streamingSpan.className = 'streaming-pending';
                _assistantTextEl.appendChild(streamingSpan);
            }
            streamingSpan.innerHTML = formatContent(_pendingText);
            streamingSpan.classList.add('streaming-cursor');

            // 智能滚动：仅当用户在底部时才自动滚动
            const isAtBottom = messagesEl.scrollHeight - messagesEl.scrollTop <= messagesEl.clientHeight + 100;
            if (isAtBottom) {
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }
        }

        function finishAssistantMessage() {
            if (_currentAssistantEl) {
                // 渲染剩余缓冲区
                flushPendingText();

                // 移除所有流式光标和临时元素
                _assistantTextEl.querySelectorAll('.streaming-cursor').forEach(el => {
                    el.classList.remove('streaming-cursor');
                });
                _assistantTextEl.querySelectorAll('.streaming-pending').forEach(el => {
                    el.remove();
                });

                const content = _assistantContent || _assistantTextEl.textContent;
                messages.push({ role: 'assistant', content });
                // 不调用 persistMessage，后端会持久化
                _currentAssistantEl = null;
                _assistantContent = '';
                _assistantContentEl = null;
                _assistantTextEl = null;
                _pendingText = '';
                // 不设置 _toolIndicatorEl = null，保留工具面板引用
            }
        }

        function formatContent(text) {
            if (!text) return '';

            // 配置 marked
            if (typeof marked !== 'undefined') {
                marked.setOptions({
                    breaks: true,
                    gfm: true,
                    headerIds: false,
                    mangle: false,
                });

                // 自定义渲染器：添加代码复制按钮
                const renderer = new marked.Renderer();
                renderer.code = function(codeObj) {
                    const code = typeof codeObj === 'object' ? codeObj.text : codeObj;
                    const lang = typeof codeObj === 'object' ? codeObj.lang : arguments[1];
                    const escaped = escapeHtml(code);
                    const langLabel = lang ? `<span style="position:absolute;top:6px;left:10px;font-size:10px;color:var(--text-muted);font-family:var(--font-mono)">${escapeHtml(lang)}</span>` : '';
                    return `<pre style="position:relative">${langLabel}<button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.textContent.replace('复制','').trim());this.textContent='已复制';setTimeout(()=>this.textContent='复制',1500)">复制</button><code>${escaped}</code></pre>`;
                };

                try {
                    let html = marked.parse(text, { renderer });

                    // LaTeX 渲染：行内公式 $...$ 和块级公式 $$...$$
                    if (typeof katex !== 'undefined') {
                        // 块级公式 $$...$$
                        html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
                            try {
                                return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
                            } catch (e) {
                                return `<span class="katex-error">${escapeHtml(tex)}</span>`;
                            }
                        });
                        // 行内公式 $...$
                        html = html.replace(/\$([^\$\n]+?)\$/g, (_, tex) => {
                            try {
                                return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
                            } catch (e) {
                                return `<span class="katex-error">${escapeHtml(tex)}</span>`;
                            }
                        });
                    }

                    return html;
                } catch (e) {
                    // fallback：简单格式化
                    return text
                        .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
                            const escaped = escapeHtml(code);
                            const langLabel = lang ? `<span style="position:absolute;top:6px;left:10px;font-size:10px;color:var(--text-muted);font-family:var(--font-mono)">${lang}</span>` : '';
                            return `<pre style="position:relative">${langLabel}<button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.textContent.replace('复制','').trim());this.textContent='已复制';setTimeout(()=>this.textContent='复制',1500)">复制</button><code>${escaped}</code></pre>`;
                        })
                        .replace(/`([^`]+)`/g, '<code>$1</code>')
                        .replace(/\n/g, '<br>');
                }
            }

            // fallback：简单格式化
            return text
                .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
                    const escaped = escapeHtml(code);
                    const langLabel = lang ? `<span style="position:absolute;top:6px;left:10px;font-size:10px;color:var(--text-muted);font-family:var(--font-mono)">${lang}</span>` : '';
                    return `<pre style="position:relative">${langLabel}<button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.textContent.replace('复制','').trim());this.textContent='已复制';setTimeout(()=>this.textContent='复制',1500)">复制</button><code>${escaped}</code></pre>`;
                })
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br>');
        }

        /* ══════════════════════════════════════════
           Tool entries
           ══════════════════════════════════════════ */

        function addToolEntry(name, args, status, iterationLabel, callId) {
            _toolCount++;
            toolCountEl.textContent = _toolCount;
            const el = document.createElement('div');
            const isAgentTool = name === 'agent_tool';
            el.className = `tool-entry ${status}${isAgentTool ? ' agent-tool' : ''}`;
            el.dataset.toolName = name;
            if (callId) el.dataset.callId = callId;
            const argsStr = typeof args === 'string' ? args : JSON.stringify(args || {});
            if (isAgentTool) {
                const agentType = args?.agent_type || 'general_purpose';
                const typeLabels = { explore: '搜索', plan: '规划', general_purpose: '通用' };
                el.innerHTML = `
                    <span class="tool-entry-count">${escapeHtml(iterationLabel || '')}</span>
                    <span class="tool-icon">${status === 'pending' ? '🤖' : '✅'}</span>
                    <div class="tool-info">
                        <div class="tool-name">子 Agent <span class="agent-type-badge ${agentType}">${escapeHtml(typeLabels[agentType] || agentType)}</span></div>
                        <div class="tool-status">${escapeHtml((args?.prompt || '').slice(0, 80))}</div>
                    </div>
                `;
            } else {
                el.innerHTML = `
                    <span class="tool-entry-count">${escapeHtml(iterationLabel || '')}</span>
                    <span class="tool-icon">${status === 'pending' ? '⏳' : '✅'}</span>
                    <div class="tool-info">
                        <div class="tool-name">${escapeHtml(name)}</div>
                        <div class="tool-status">${escapeHtml(argsStr.slice(0, 60))}</div>
                    </div>
                `;
            }
            // 智能滚动：仅当用户在底部时才自动滚动
            const isAtBottom = toolsEl.scrollHeight - toolsEl.scrollTop <= toolsEl.clientHeight + 50;
            toolsEl.appendChild(el);
            if (isAtBottom) {
                toolsEl.scrollTop = toolsEl.scrollHeight;
            }
        }

        function _formatAgentToolResult(result) {
            try {
                const data = typeof result === 'string' ? JSON.parse(result) : result;
                const parts = [];
                if (data.error) {
                    parts.push(`❌ ${data.error}`);
                } else if (data.result) {
                    parts.push(data.result.slice(0, 200));
                }
                const meta = [];
                if (data.iterations !== undefined) meta.push(`${data.iterations} 次工具调用`);
                if (data.agent_type) meta.push(data.agent_type);
                if (meta.length) parts.push(`📊 ${meta.join(' · ')}`);
                return parts.join('\n');
            } catch {
                return typeof result === 'string' ? result.slice(0, 200) : JSON.stringify(result).slice(0, 200);
            }
        }

        function updateToolEntry(name, result, error, callId) {
            const entries = toolsEl.querySelectorAll('.tool-entry');
            for (const el of entries) {
                // 优先按 call_id 精确匹配，回退到 name + pending 匹配
                const matchById = callId && el.dataset.callId === callId && el.classList.contains('pending');
                const matchByName = !callId && el.dataset.toolName === name && el.classList.contains('pending');
                if (matchById || matchByName) {
                    el.classList.remove('pending');
                    el.classList.add(error ? 'error' : 'done');
                    const iconEl = el.querySelector('.tool-icon');
                    if (name === 'agent_tool') {
                        iconEl.textContent = error ? '❌' : '🧠';
                        const statusEl = el.querySelector('.tool-status');
                        if (result && !error) {
                            statusEl.textContent = _formatAgentToolResult(result).split('\n')[0];
                        } else if (error) {
                            statusEl.textContent = error.slice(0, 80);
                        }
                    } else {
                        iconEl.textContent = error ? '❌' : '✅';
                        if (error) el.querySelector('.tool-status').textContent = error.slice(0, 60);
                    }
                    break;
                }
            }
            if (result) {
                const r = name === 'agent_tool' ? _formatAgentToolResult(result) : (typeof result === 'string' ? result : JSON.stringify(result));
                terminalEl.innerHTML += `<div style="color:var(--accent)">$ ${escapeHtml(name)}</div><div>${escapeHtml(r).slice(0, 500)}</div>`;
                terminalEl.scrollTop = terminalEl.scrollHeight;
            }
        }

        function escapeHtml(s) {
            const d = document.createElement('div');
            d.textContent = s || '';
            return d.innerHTML;
        }

        /* ══════════════════════════════════════════
           Send message
           ══════════════════════════════════════════ */

        function _setStreaming(active) {
            isStreaming = active;
            stopBtn.style.display = active ? 'flex' : 'none';
            sendBtn.style.display = active ? 'none' : 'flex';
            sendBtn.disabled = !inputEl.value.trim() && !active;
        }

        let _sending = false;
        let _lastSendTime = 0;
        const MIN_SEND_INTERVAL = 500; // 最小发送间隔 500ms

        async function sendMessage() {
            if (_sending) return;
            const now = Date.now();
            if (now - _lastSendTime < MIN_SEND_INTERVAL) return;
            _lastSendTime = now;

            const text = inputEl.value.trim();
            if (!text) return;

            _sending = true;

            if (currentPage !== 'chat') navigateTo('chat');
            if (!currentSessionId) await createNewSession();

            _conversationRound++;
            _iterationInRound = 0;
            _iterationCount = 0;
            _segmentToolCount = 0;
            _toolCallHistory = [];
            _currentIteration = 0;

            // 新对话轮次，添加深分隔线
            if (_conversationRound > 1) {
                addThinkingSeparator('deep');
            }

            addMessage('user', text, true);  // skipPersist=true，后端会持久化
            _lastUserMessage = text;  // 保存用户消息，用于生成标题
            inputEl.value = '';
            inputEl.style.height = '44px';
            sendBtn.disabled = true;

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'message', content: text, session_id: currentSessionId }));
                if (!isStreaming) {
                    _setStreaming(true);
                    os.updateAgentPanel(agentId, { status: 'thinking' });
                }
                _currentAssistantEl = null;
                _assistantContent = '';
            } else {
                addMessage('assistant', 'Agent 引擎未连接。请确保后端服务正在运行。', true);
                _sending = false;
            }

            // 注意：_sending 会在 done/error/interrupted 事件中重置为 false
        }

        function sendInterrupt() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'interrupt' }));
            }
        }

        sendBtn.addEventListener('click', sendMessage);
        stopBtn.addEventListener('click', sendInterrupt);

        inputEl.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        inputEl.addEventListener('input', () => {
            inputEl.style.height = '44px';
            inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
            sendBtn.disabled = !inputEl.value.trim() && !isStreaming;
            // Skill 自动补全
            const text = inputEl.value;
            if (text.startsWith('/') && !text.includes(' ')) {
                showSkillAutocomplete(text.slice(1));
            } else if (_skillAutocomplete) {
                _skillAutocomplete.style.display = 'none';
            }
        });

        // Tell Eos: 接收来自其他 App 的输入
        win.on('set-input', ({ text }) => {
            inputEl.value = text;
            inputEl.style.height = '44px';
            inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
            sendBtn.disabled = false;
            inputEl.focus();
        });

        /* ══════════════════════════════════════════
           Skill autocomplete
           ══════════════════════════════════════════ */

        let _skillAutocomplete = null;
        let _cachedSkills = [];

        function showSkillAutocomplete(filter) {
            if (!_skillAutocomplete) {
                _skillAutocomplete = document.createElement('div');
                _skillAutocomplete.className = 'skill-autocomplete';
                inputEl.parentElement.appendChild(_skillAutocomplete);
            }

            const skills = _cachedSkills || [];
            const filtered = filter
                ? skills.filter(s => s.name.toLowerCase().startsWith(filter.toLowerCase()))
                : skills;

            if (filtered.length === 0) {
                _skillAutocomplete.style.display = 'none';
                return;
            }

            _skillAutocomplete.innerHTML = filtered.map(s =>
                `<div class="skill-autocomplete-item" data-name="${s.name}">
                    <span class="skill-name">/${s.name}</span>
                    <span class="skill-desc">${s.description}</span>
                </div>`
            ).join('');
            _skillAutocomplete.style.display = 'block';

            _skillAutocomplete.querySelectorAll('.skill-autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    inputEl.value = `/${item.dataset.name} `;
                    _skillAutocomplete.style.display = 'none';
                    inputEl.focus();
                });
            });
        }

        // Skill 列表（通过 info 事件获取）
        function fetchSkills() {
            // Skills are loaded at startup, use hardcoded list for now
            // In production, this would be fetched from the engine via info event
            _cachedSkills = [
                { name: 'example', description: '示例 Skill，用于验证 Skill 框架是否正常工作', tools: ['search_files'] }
            ];
        }

        /* ══════════════════════════════════════════
           Home page
           ══════════════════════════════════════════ */

        const WELCOME_MESSAGES = [
            '有什么我可以帮你的？',
            '今天想聊些什么？',
            '准备好了，开始吧。',
            '需要什么帮助吗？',
            '随时为你服务。',
            '说说你的想法。',
        ];

        function setRandomWelcome() {
            const msg = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
            homeWelcomeText.textContent = msg;
        }

        setRandomWelcome();

        homeInput.addEventListener('input', () => {
            homeInput.style.height = '44px';
            homeInput.style.height = Math.min(homeInput.scrollHeight, 160) + 'px';
            homeSendBtn.disabled = !homeInput.value.trim();
        });

        homeInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendFromHome();
            }
        });

        homeSendBtn.addEventListener('click', sendFromHome);

        async function sendFromHome() {
            const text = homeInput.value.trim();
            if (!text) return;

            // 动画：输入框下移并消失
            homeInputWrap.classList.add('moved');

            // 等待动画完成后跳转
            setTimeout(async () => {
                navigateTo('chat');
                inputEl.value = text;
                inputEl.style.height = '44px';
                inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
                sendBtn.disabled = false;
                await sendMessage();
                // 重置首页输入框
                homeInput.value = '';
                homeInput.style.height = '44px';
                homeSendBtn.disabled = true;
                homeInputWrap.classList.remove('moved');
                setRandomWelcome();
            }, 400);
        }

        /* ══════════════════════════════════════════
           Sidebar & panel toggles
           ══════════════════════════════════════════ */

        sessionToggleBtn.addEventListener('click', () => {
            sessionSidebar.classList.toggle('collapsed');
        });

        panelToggleBtn.addEventListener('click', () => {
            agentPanel.classList.toggle('collapsed');
        });

        sessionNewBtn.addEventListener('click', () => {
            resetToHome();
        });

        sessionFilter.addEventListener('input', () => {
            renderSessionList(sessionFilter.value);
        });

        terminalClearBtn.addEventListener('click', () => {
            terminalEl.innerHTML = '';
        });

        // ── Panel tab switching ──
        function switchPanelTab(tabName) {
            _currentThinkingTab = tabName;
            panelTabs.forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === tabName);
            });
            thinkingPanel.style.display = tabName === 'thinking' ? 'flex' : 'none';
            toolsPanel.style.display = tabName === 'tools' ? 'flex' : 'none';
        }

        panelTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                switchPanelTab(tab.dataset.tab);
            });
        });

        // ── Thinking content management ──
        let _currentThinkingBlock = null; // 当前思维链块

        function appendThinkingContent(content) {
            if (!content) return;

            // 清空占位符
            const placeholder = thinkingEl.querySelector('.thinking-placeholder');
            if (placeholder) {
                placeholder.remove();
            }

            // 如果没有当前块，创建一个
            if (!_currentThinkingBlock) {
                _currentThinkingBlock = document.createElement('div');
                _currentThinkingBlock.className = 'thinking-block';
                _currentThinkingBlock.innerHTML = '<div class="thinking-content"></div>';
                thinkingEl.appendChild(_currentThinkingBlock);
            }

            // 追加内容到当前块
            const contentEl = _currentThinkingBlock.querySelector('.thinking-content');
            contentEl.innerHTML = formatContent(contentEl.textContent + content);

            // 自动滚动到底部
            thinkingEl.scrollTop = thinkingEl.scrollHeight;
        }

        function addThinkingSeparator(type = 'light') {
            // type: 'light' (文本输出分隔) 或 'deep' (新对话轮次分隔)
            _currentThinkingBlock = null; // 重置当前块
            const sep = document.createElement('div');
            sep.className = `thinking-separator ${type}`;
            thinkingEl.appendChild(sep);
        }

        function setThinkingActive(active) {
            _isThinkingActive = active;
            thinkingIndicator.style.display = active ? 'inline' : 'none';
            if (active && _currentThinkingTab === 'tools') {
                // 自动切换到思维链选项卡
                switchPanelTab('thinking');
            }
            if (!active) {
                _currentThinkingBlock = null; // 流式结束，重置当前块
            }
        }

        /* ══════════════════════════════════════════
           Settings drawer
           ══════════════════════════════════════════ */

        const settingsBackBtn = container.querySelector('#settings-back-btn');
        const sidebarSettingsBtn = container.querySelector('#sidebar-settings-btn');
        const sidebarHelpBtn = container.querySelector('#sidebar-help-btn');
        const helpPopover = container.querySelector('#help-popover');
        const helpCloseBtn = container.querySelector('#help-close-btn');
        const settingsModel = container.querySelector('#settings-model');
        const settingsModelHint = container.querySelector('#settings-model-hint');
        const settingsSystemPrompt = container.querySelector('#settings-system-prompt');
        const settingsMaxIter = container.querySelector('#settings-max-iter');
        const settingsScanSpeed = container.querySelector('#settings-scan-speed');
        const settingsToolset = container.querySelector('#settings-toolset');
        const settingsSaveBtn = container.querySelector('#settings-save-btn');
        const settingsResetBtn = container.querySelector('#settings-reset-btn');

        const SETTINGS_KEY = 'eos-agent-settings';
        const DEFAULT_SETTINGS = {
            model: '',
            systemPrompt: '你是 Eos Agent，一个强大的 AI 助手。\n你可以读写文件、执行终端命令、分析代码、回答问题。\n请用中文回复，保持友好和专业。',
            maxIterations: 50,
            toolScanSpeed: 1.0,  // 工具调用扫描动画速度（秒）
            toolset: '',  // 工具集（空字符串表示所有工具）
            agentMode: 'assistant',  // 模式：assistant 或 coder
            helperSource: '',  // 辅助模型来源：'' | 'os' | 'custom'
            helperModel: '',  // 系统模型引用
            helperKey: '',  // 自定义 API Key
            helperUrl: '',  // 自定义 API Base URL
            helperName: '',  // 自定义模型名称
        };

        function loadSettings() {
            try {
                const raw = localStorage.getItem(SETTINGS_KEY);
                if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
            } catch {}
            return { ...DEFAULT_SETTINGS };
        }

        function saveSettings(s) {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
        }

        function updateModelBadge(modelRef) {
            if (modelRef) {
                const short = modelRef.split('/').pop() || modelRef;
                modelBadge.textContent = short;
                modelBadge.classList.add('visible');
            } else {
                modelBadge.classList.remove('visible');
            }
        }

        async function populateModelSelect() {
            try {
                const models = await os.llm.getModels();
                const select = settingsModel;
                select.innerHTML = '';
                if (!models || models.length === 0) {
                    select.innerHTML = '<option value="">未配置模型</option>';
                    settingsModelHint.textContent = '请在系统设置中配置 LLM Provider';
                    return;
                }
                const grouped = {};
                models.forEach(m => {
                    if (!grouped[m.provider_name]) grouped[m.provider_name] = [];
                    grouped[m.provider_name].push(m);
                });
                Object.entries(grouped).forEach(([provider, ms]) => {
                    const group = document.createElement('optgroup');
                    group.label = provider;
                    ms.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m.ref;
                        const caps = m.capabilities || [];
                        const tags = [];
                        if (caps.includes('vision')) tags.push('👁');
                        if (caps.includes('image')) tags.push('🎨');
                        opt.textContent = m.name + (tags.length ? ' ' + tags.join('') : '');
                        group.appendChild(opt);
                    });
                    select.appendChild(group);
                });
                settingsModelHint.textContent = `共 ${models.length} 个模型`;
            } catch {
                settingsModel.innerHTML = '<option value="">加载失败</option>';
                settingsModelHint.textContent = '无法获取模型列表';
            }
        }

        async function populateHelperModelSelect() {
            try {
                const models = await os.llm.getModels();
                const select = container.querySelector('#settings-helper-model');
                if (!select) return;
                select.innerHTML = '';
                if (!models || models.length === 0) {
                    select.innerHTML = '<option value="">未配置模型</option>';
                    return;
                }
                const grouped = {};
                models.forEach(m => {
                    if (!grouped[m.provider_name]) grouped[m.provider_name] = [];
                    grouped[m.provider_name].push(m);
                });
                Object.entries(grouped).forEach(([provider, ms]) => {
                    const group = document.createElement('optgroup');
                    group.label = provider;
                    ms.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m.ref;
                        opt.textContent = m.name;
                        group.appendChild(opt);
                    });
                    select.appendChild(group);
                });
            } catch (e) {
                console.warn('Failed to populate helper model select:', e);
            }
        }

        function fillSettingsForm(s) {
            settingsModel.value = s.model || '';
            settingsSystemPrompt.value = s.systemPrompt || '';
            settingsMaxIter.value = s.maxIterations || 50;
            settingsScanSpeed.value = s.toolScanSpeed || 1.0;
            settingsToolset.value = s.toolset || '';
            // 辅助模型配置
            const helperSource = container.querySelector('#settings-helper-source');
            const helperModel = container.querySelector('#settings-helper-model');
            const helperKey = container.querySelector('#settings-helper-key');
            const helperUrl = container.querySelector('#settings-helper-url');
            const helperName = container.querySelector('#settings-helper-name');
            helperSource.value = s.helperSource || '';
            helperModel.value = s.helperModel || '';
            helperKey.value = s.helperKey || '';
            helperUrl.value = s.helperUrl || '';
            helperName.value = s.helperName || '';
            updateHelperConfigVisibility(s.helperSource || '');
        }

        function readSettingsForm() {
            const helperSource = container.querySelector('#settings-helper-source').value;
            return {
                model: settingsModel.value,
                systemPrompt: settingsSystemPrompt.value,
                maxIterations: parseInt(settingsMaxIter.value, 10) || 50,
                toolScanSpeed: parseFloat(settingsScanSpeed.value) || 1.0,
                toolset: settingsToolset.value,
                helperSource: helperSource,
                helperModel: container.querySelector('#settings-helper-model').value,
                helperKey: container.querySelector('#settings-helper-key').value,
                helperUrl: container.querySelector('#settings-helper-url').value,
                helperName: container.querySelector('#settings-helper-name').value,
            };
        }

        function updateHelperConfigVisibility(source) {
            const osConfig = container.querySelector('#helper-os-config');
            const customConfig = container.querySelector('#helper-custom-config');
            osConfig.style.display = source === 'os' ? 'block' : 'none';
            customConfig.style.display = source === 'custom' ? 'block' : 'none';
        }

        async function openSettings() {
            await Promise.all([populateModelSelect(), populateHelperModelSelect()]);
            fillSettingsForm(loadSettings());
            navigateTo('settings');
        }

        function closeSettings() {
            if (currentSessionId) {
                navigateTo('chat');
            } else {
                navigateTo('home');
            }
        }

        function showToast(msg) {
            let toast = container.querySelector('.agent-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'agent-toast';
                container.querySelector('.agent-root').appendChild(toast);
            }
            toast.textContent = msg;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
        }

        /* ══════════════════════════════════════════
           Mode switch
           ══════════════════════════════════════════ */

        const modeSwitchEl = container.querySelector('#mode-switch');
        const modeBtns = modeSwitchEl.querySelectorAll('.mode-btn');

        function switchMode(mode) {
            if (mode === agentMode) return;
            agentMode = mode;

            // Update UI
            modeBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });

            // Update welcome chips
            const config = MODE_CONFIGS[mode];
            const chipsEl = container.querySelector('.welcome-chips');
            if (chipsEl && config.welcomeChips) {
                chipsEl.innerHTML = config.welcomeChips.map(chip =>
                    `<button class="chip" data-prompt="${escapeHtml(chip.prompt)}">${escapeHtml(chip.text)}</button>`
                ).join('');
                // Re-bind chip events
                chipsEl.querySelectorAll('.chip[data-prompt]').forEach(chip => {
                    chip.addEventListener('click', () => {
                        inputEl.value = chip.dataset.prompt;
                        inputEl.style.height = '44px';
                        inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
                        sendBtn.disabled = false;
                        inputEl.focus();
                    });
                });
            }

            // Save mode to settings
            const settings = loadSettings();
            settings.agentMode = mode;
            // Update toolset for the new mode
            settings.toolset = config.toolset;
            saveSettings(settings);

            // Send updated config to backend
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'configure', settings: loadSettings() }));
            }

            showToast(`已切换到 ${mode === 'assistant' ? 'Assistant' : 'Coder'} 模式`);
        }

        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => switchMode(btn.dataset.mode));
        });

        // Load saved mode
        function initMode() {
            const settings = loadSettings();
            agentMode = settings.agentMode || 'assistant';
            modeBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === agentMode);
            });
        }

        initMode();

        sidebarSettingsBtn.addEventListener('click', openSettings);
        settingsBackBtn.addEventListener('click', closeSettings);

        settingsSaveBtn.addEventListener('click', () => {
            const s = readSettingsForm();
            saveSettings(s);
            closeSettings();
            updateModelBadge(s.model);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'configure', settings: s }));
                showToast('设置已保存并生效');
            } else {
                showToast('设置已保存，连接后生效');
            }
        });

        // 辅助模型来源变化时更新配置界面
        const helperSourceSelect = container.querySelector('#settings-helper-source');
        if (helperSourceSelect) {
            helperSourceSelect.addEventListener('change', (e) => {
                updateHelperConfigVisibility(e.target.value);
                if (e.target.value === 'os') {
                    populateHelperModelSelect();
                }
            });
        }

        settingsResetBtn.addEventListener('click', () => {
            fillSettingsForm(DEFAULT_SETTINGS);
            saveSettings(DEFAULT_SETTINGS);
            showToast('已重置为默认值');
        });

        /* ══════════════════════════════════════════
           Help popover
           ══════════════════════════════════════════ */

        function toggleHelp() {
            const isVisible = helpPopover.style.display !== 'none';
            helpPopover.style.display = isVisible ? 'none' : 'block';
        }

        sidebarHelpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleHelp();
        });

        helpCloseBtn.addEventListener('click', () => {
            helpPopover.style.display = 'none';
        });

        document.addEventListener('click', (e) => {
            if (helpPopover.style.display !== 'none' &&
                !helpPopover.contains(e.target) &&
                e.target !== sidebarHelpBtn && !sidebarHelpBtn.contains(e.target)) {
                helpPopover.style.display = 'none';
            }
        });

        /* ══════════════════════════════════════════
           Responsive tool indicator
           ══════════════════════════════════════════ */

        function updateToolIndicatorResponsive() {
            const indicators = container.querySelectorAll('.tool-call-indicator');
            const width = messagesEl.clientWidth;

            indicators.forEach(indicator => {
                const textEl = indicator.querySelector('.tool-call-text');
                const countEl = indicator.querySelector('.tool-call-count');
                if (!textEl || !countEl) return;

                const isCompleted = indicator.classList.contains('completed');
                const fullText = isCompleted ? 'Function Calling — 工具调用结束' : 'Function Calling — 正在调用工具';
                const shortText = isCompleted ? '已完成' : '调用中';
                const fullRound = countEl.dataset.fullRound || countEl.textContent;
                const shortRound = fullRound.replace('Round ', '').replace('Iteration ', '');

                if (width > 600) {
                    textEl.textContent = fullText;
                    countEl.textContent = fullRound;
                } else if (width > 450) {
                    textEl.textContent = fullText.replace('Function Calling — ', '');
                    countEl.textContent = fullRound;
                } else if (width > 350) {
                    textEl.textContent = shortText;
                    countEl.textContent = fullRound;
                } else {
                    textEl.textContent = shortText;
                    countEl.textContent = shortRound;
                }
            });
        }

        const _resizeObserver = new ResizeObserver((entries) => {
            updateToolIndicatorResponsive();
        });
        _resizeObserver.observe(container);

        /* ══════════════════════════════════════════
           Token Stats Display
           ══════════════════════════════════════════ */

        const headerEl = container.querySelector('.agent-header');
        if (headerEl) {
            const tokenBar = document.createElement('div');
            tokenBar.id = 'agent-token-bar';
            tokenBar.style.cssText = 'display:flex;align-items:center;gap:6px;margin-left:8px;font-size:11px;color:var(--text-secondary,#888);white-space:nowrap;';
            tokenBar.innerHTML = `
                <span>In: <span id="agent-tok-in">0</span></span>
                <span>Out: <span id="agent-tok-out">0</span></span>
                <span style="font-weight:600">Total: <span id="agent-tok-total" style="color:var(--accent,#00e5ff)">0</span></span>
                <span>Ctx: <span id="agent-tok-ctx" style="font-weight:600">0%</span></span>
            `;
            const panelToggle = headerEl.querySelector('#panel-toggle-btn');
            if (panelToggle) {
                headerEl.insertBefore(tokenBar, panelToggle);
            } else {
                headerEl.appendChild(tokenBar);
            }
        }

        function updateTokenDisplay(stats) {
            if (!stats) return;
            const fmt = (n) => {
                if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
                if (n >= 1000) return (n/1000).toFixed(1)+'K';
                return String(n||0);
            };
            const setEl = (id, val) => { const el = container.querySelector('#'+id); if(el) el.textContent = val; };
            setEl('agent-tok-in', fmt(stats.total_input_tokens));
            setEl('agent-tok-out', fmt(stats.total_output_tokens));
            setEl('agent-tok-total', fmt(stats.total_tokens));
            const ctxPct = stats.context_limit > 0 ? Math.round((stats.context_tokens / stats.context_limit) * 100) : 0;
            const ctxEl = container.querySelector('#agent-tok-ctx');
            if (ctxEl) {
                ctxEl.textContent = ctxPct + '%';
                ctxEl.style.color = ctxPct > 85 ? '#ef5350' : ctxPct > 65 ? '#ffa726' : 'var(--accent,#00e5ff)';
            }
        }

        /* ══════════════════════════════════════════
           Cleanup & init
           ══════════════════════════════════════════ */

        win.on('close', () => {
            _resizeObserver.disconnect();
            if (ws) ws.close();
            os.removeAgentPanel(agentId);
        });

        addSystemMessage('正在连接 Agent 引擎...');
        connect();

        loadSessions().then(() => {
            // Restore saved session if available
            if (win._agentSessionId && sessionCache.some(s => s.id === win._agentSessionId)) {
                switchSession(win._agentSessionId);
                navigateTo('chat');
            } else if (sessionCache.length > 0) {
                switchSession(sessionCache[0].id);
                navigateTo('chat');
            } else {
                resetToHome();
            }
        });
    }
});
