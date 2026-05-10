/* ═══════════════════════════════════════════════════════
   N.O.V.A AETHER OS — Agent Application
   ChatGPT-inspired layout × Cyberpunk neon aesthetic
   ═══════════════════════════════════════════════════════ */

registerApp('agent', {
    title: 'Agent',
    icon: '🤖',
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
                    </div>
                    <div class="sidebar-search">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2"/><path d="M9.5 9.5L13 13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                        <input id="session-filter" type="text" placeholder="搜索会话..." />
                    </div>
                    <div id="session-list" class="session-list"></div>
                </aside>

                <!-- Main chat area -->
                <main class="agent-main">
                    <!-- Top bar -->
                    <header class="agent-header">
                        <button id="session-toggle-btn" class="icon-btn" title="切换侧边栏">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="3.5" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="8.25" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="13" width="14" height="1.5" rx="0.75" fill="currentColor"/></svg>
                        </button>
                        <div class="header-title">
                            <span id="session-title-display">Eos Agent</span>
                            <span class="model-badge" id="model-badge"></span>
                        </div>
                        <div style="flex:1"></div>
                        <button id="panel-toggle-btn" class="icon-btn" title="工具面板">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="7" height="16" rx="1.5" stroke="currentColor" stroke-width="1.2"/><rect x="10" y="1" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2"/><rect x="10" y="10" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2"/></svg>
                        </button>
                        <button id="agent-settings-btn" class="icon-btn" title="设置">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="2.5" stroke="currentColor" stroke-width="1.2"/><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.4 3.4l1.4 1.4M13.2 13.2l1.4 1.4M3.4 14.6l1.4-1.4M13.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                        </button>
                    </header>

                    <!-- Messages area -->
                    <div id="agent-messages" class="agent-messages">
                        <div id="welcome-screen" class="welcome-screen">
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

                    <!-- Input area -->
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
                </main>

                <!-- Right panel: tools & terminal -->
                <aside id="agent-panel" class="agent-panel">
                    <div class="panel-section">
                        <div class="panel-section-header">
                            <span class="panel-section-icon">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M2 7h7M2 10h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                            </span>
                            <span>工具调用</span>
                            <span id="tool-count" class="panel-count">0</span>
                        </div>
                        <div id="agent-tools" class="panel-body tools-body"></div>
                    </div>
                    <div class="panel-divider"></div>
                    <div class="panel-section" style="flex:1;min-height:0">
                        <div class="panel-section-header">
                            <span class="panel-section-icon">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M4 5.5L6 7.5L4 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 9.5H10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                            </span>
                            <span>终端</span>
                            <button id="terminal-clear" class="panel-action-btn" title="清空">清空</button>
                        </div>
                        <div id="agent-terminal" class="panel-body terminal-body"></div>
                    </div>
                </aside>

                <!-- Settings drawer -->
                <div id="agent-settings-overlay" class="settings-overlay"></div>
                <div id="agent-settings-drawer" class="settings-drawer">
                    <div class="settings-header">
                        <span class="settings-title">设置</span>
                        <button id="settings-close-btn" class="icon-btn">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                        </button>
                    </div>
                    <div class="settings-body">
                        <div class="settings-field">
                            <label class="settings-label">模型</label>
                            <select id="settings-model" class="settings-select">
                                <option value="">加载中...</option>
                            </select>
                            <div id="settings-model-hint" class="settings-hint"></div>
                        </div>
                        <div class="settings-field">
                            <label class="settings-label">System Prompt</label>
                            <textarea id="settings-system-prompt" class="settings-textarea" rows="5" placeholder="你是 Eos Agent..."></textarea>
                        </div>
                        <div class="settings-field">
                            <label class="settings-label">最大迭代次数</label>
                            <input id="settings-max-iter" class="settings-input" type="number" min="1" max="200" value="50">
                        </div>
                        <div class="settings-field">
                            <label class="settings-label">工具调用扫描动画速度（秒）</label>
                            <input id="settings-scan-speed" class="settings-input" type="number" min="0.2" max="5" step="0.1" value="1.0">
                        </div>
                        <div class="settings-actions">
                            <button id="settings-save-btn" class="settings-save-btn">保存</button>
                            <button id="settings-reset-btn" class="settings-reset-btn">重置</button>
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
                margin: 0 12px 8px;
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
            .header-title span:first-child {
                font-family: var(--font-body);
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary);
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
            }
            .input-container:focus-within {
                border-color: var(--accent-dim);
                box-shadow: 0 0 0 1px var(--accent-glow), 0 0 20px rgba(0, 229, 255, 0.05);
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
            .panel-section {
                display: flex;
                flex-direction: column;
                min-height: 0;
            }
            .panel-section:first-child {
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

            /* ── Settings drawer ── */
            .settings-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                z-index: 90;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.25s;
            }
            .settings-overlay.open {
                opacity: 1;
                pointer-events: auto;
            }
            .settings-drawer {
                position: absolute;
                top: 0;
                right: 0;
                bottom: 0;
                width: 360px;
                background: var(--bg-surface);
                border-left: 1px solid var(--border);
                z-index: 100;
                display: flex;
                flex-direction: column;
                transform: translateX(100%);
                transition: transform 0.3s var(--ease-out);
                box-shadow: -8px 0 40px rgba(0, 0, 0, 0.4);
            }
            .settings-drawer.open {
                transform: translateX(0);
            }
            .settings-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                border-bottom: 1px solid var(--border);
                flex-shrink: 0;
            }
            .settings-title {
                font-family: var(--font-display);
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary);
            }
            .settings-body {
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
            .settings-body::-webkit-scrollbar {
                width: 5px;
            }
            .session-list::-webkit-scrollbar-thumb,
            .agent-messages::-webkit-scrollbar-thumb,
            .panel-body::-webkit-scrollbar-thumb,
            .settings-body::-webkit-scrollbar-thumb {
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
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                z-index: 1000;
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
                width: 700px;
                max-width: 90vw;
                max-height: 80vh;
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
                position: fixed;
                pointer-events: none;
                z-index: 999;
                overflow: visible;
            }
            .tool-complete-svg {
                position: absolute;
                right: 0;
                top: 0;
                width: 120px;
                height: 100%;
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
        const welcomeEl = container.querySelector('#welcome-screen');
        const inputEl = container.querySelector('#agent-input');
        const sendBtn = container.querySelector('#agent-send');
        const stopBtn = container.querySelector('#agent-stop');
        const toolsEl = container.querySelector('#agent-tools');
        const toolCountEl = container.querySelector('#tool-count');
        const terminalEl = container.querySelector('#agent-terminal');
        const sessionSidebar = container.querySelector('#session-sidebar');
        const sessionListEl = container.querySelector('#session-list');
        const sessionNewBtn = container.querySelector('#session-new-btn');
        const sessionToggleBtn = container.querySelector('#session-toggle-btn');
        const sessionTitleDisplay = container.querySelector('#session-title-display');
        const modelBadge = container.querySelector('#model-badge');
        const panelToggleBtn = container.querySelector('#panel-toggle-btn');
        const agentPanel = container.querySelector('#agent-panel');
        const sessionFilter = container.querySelector('#session-filter');
        const terminalClearBtn = container.querySelector('#terminal-clear');

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
        let _iterationInRound = 0;   // 当前轮次中的迭代次数
        let _iterationCount = 0;     // 当前位置累积的工具调用次数
        let _toolCallHistory = [];   // 工具调用历史
        let _toolIndicatorEl = null; // 消息区域的工具调用指示器元素
        let _toolStartTime = 0;      // 工具调用开始时间
        let _toolTimerInterval = null; // 工具调用计时器

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
                            <div class="session-item-title">${escapeHtml(session.title)}</div>
                            <div class="session-item-time">${formatTime(session.updated_at)}</div>
                        </div>
                        <button class="session-item-delete" title="删除">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 4L10 10M10 4L4 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                        </button>
                    `;
                    el.addEventListener('click', (e) => {
                        if (e.target.closest('.session-item-delete')) return;
                        switchSession(session.id);
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
            messagesEl.innerHTML = '';
            messages = [];
            _toolCount = 0;
            toolCountEl.textContent = '0';
            toolsEl.innerHTML = '';
            terminalEl.innerHTML = '';

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

                    // 当前轮次和迭代计数
                    let currentRound = 0;
                    let currentIteration = 0;
                    let lastAssistantEl = null;
                    let lastToolsContainer = null;

                    for (const msg of msgs) {
                        // 跳过 tool 消息，它们会在 assistant 消息的 tool_calls 中处理
                        if (msg.role === 'tool') continue;

                        // 渲染消息
                        addMessage(msg.role, msg.content, true);

                        // 如果是 assistant 消息且包含 tool_calls，渲染工具调用面板
                        if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
                            currentRound++;
                            currentIteration = 0;

                            // 获取当前 assistant 消息元素
                            lastAssistantEl = messagesEl.querySelector('.assistant-row:last-child');
                            if (lastAssistantEl) {
                                const msgContent = lastAssistantEl.querySelector('.msg-content');
                                if (msgContent) {
                                    // 获取 msg-tools 容器
                                    lastToolsContainer = msgContent.querySelector('.msg-tools');
                                }
                            }

                            // 为每个 tool_call 渲染工具调用面板
                            for (const tc of msg.tool_calls) {
                                currentIteration++;
                                const toolName = tc.function?.name || tc.name || 'unknown';
                                const toolArgs = tc.function?.arguments || tc.arguments || {};
                                const toolResult = toolResults[tc.id];
                                const resultContent = toolResult?.content || '';
                                const isError = resultContent.startsWith('错误:') || resultContent.startsWith('Error:');

                                // 添加到右侧工具调用面板
                                addToolEntry(toolName, toolArgs, isError ? 'error' : 'done', `R${currentRound}-${currentIteration}`);

                                // 在消息中添加工具调用面板
                                if (lastToolsContainer) {
                                    const toolIndicator = document.createElement('div');
                                    toolIndicator.className = 'tool-call-indicator completed';
                                    toolIndicator.innerHTML = `
                                        <div class="tool-call-content">
                                            <span class="tool-call-icon">⚡</span>
                                            <span class="tool-call-text">Function Calling — 工具调用结束</span>
                                            <span class="tool-call-name">[${escapeHtml(toolName)}]</span>
                                            <span class="tool-call-time"></span>
                                            <span class="tool-call-count">Round ${currentIteration}</span>
                                        </div>
                                    `;
                                    toolIndicator.addEventListener('click', () => {
                                        // 打开工具调用详情模态框
                                        const argsParsed = typeof toolArgs === 'string' ? JSON.parse(toolArgs) : toolArgs;
                                        const overlay = document.createElement('div');
                                        overlay.className = 'tool-modal-overlay';
                                        overlay.innerHTML = `
                                            <div class="tool-modal">
                                                <div class="tool-modal-header">
                                                    <span class="tool-modal-title">工具调用详情</span>
                                                    <span class="tool-modal-count">Round ${currentIteration}</span>
                                                    <button class="tool-modal-close">×</button>
                                                </div>
                                                <div class="tool-modal-body">
                                                    <div class="tool-modal-col">
                                                        <div class="tool-modal-col-title">参数</div>
                                                        <pre class="tool-modal-content">${escapeHtml(JSON.stringify(argsParsed, null, 2))}</pre>
                                                    </div>
                                                    <div class="tool-modal-col">
                                                        <div class="tool-modal-col-title">${isError ? '错误' : '返回值'}</div>
                                                        <pre class="tool-modal-content ${isError ? 'error' : ''}">${escapeHtml(resultContent)}</pre>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                        overlay.addEventListener('click', (e) => {
                                            if (e.target === overlay) overlay.remove();
                                        });
                                        overlay.querySelector('.tool-modal-close').addEventListener('click', () => overlay.remove());
                                        document.body.appendChild(overlay);
                                    });

                                    // 将工具面板插入到工具容器中
                                    lastToolsContainer.appendChild(toolIndicator);
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
                    }
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
                        await createNewSession();
                    }
                } else {
                    renderSessionList();
                }
            } catch (e) {
                console.warn('Failed to delete session:', e);
            }
        }

        async function persistMessage(role, content) {
            if (!currentSessionId) return;
            try {
                await os.api('POST', `/api/agent/sessions/${currentSessionId}/messages`, { role, content });
                const session = sessionCache.find(s => s.id === currentSessionId);
                if (session) {
                    session.message_count = (session.message_count || 0) + 1;
                    session.updated_at = Date.now();
                    if (role === 'user' && session.title === '新会话') {
                        const title = content.slice(0, 30).replace(/\n/g, ' ');
                        await os.api('PUT', `/api/agent/sessions/${currentSessionId}`, { title });
                        session.title = title;
                        updateSessionTitle(title);
                    }
                    sessionCache.sort((a, b) => b.updated_at - a.updated_at);
                    renderSessionList();
                }
            } catch (e) {
                console.warn('Failed to persist message:', e);
            }
        }

        function updateSessionTitle(title) {
            sessionTitleDisplay.textContent = title || 'Eos Agent';
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
                if (s.model) {
                    ws.send(JSON.stringify({ type: 'configure', settings: s }));
                    updateModelBadge(s.model);
                }
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
                    // 模型输出文本，重置迭代计数
                    _iterationCount = 0;
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
                    _iterationInRound++;
                    _toolStartTime = Date.now();
                    _toolCallHistory.push({
                        name: data.name,
                        args: data.arguments,
                        result: null,
                        error: null,
                        time: _toolStartTime,
                        iterationCount: _iterationCount,
                        roundLabel: `R${_conversationRound}-${_iterationInRound}`,
                    });
                    showToolIndicator(data.name, _iterationCount);
                    startToolTimer();
                    addToolEntry(data.name, data.arguments, 'pending', `R${_conversationRound}-${_iterationInRound}`);
                    os.updateAgentPanel(agentId, { status: 'tool', toolName: data.name });
                    _finishActiveCall('done', { tokens: data.tokens || 0, latency: data.latency || 0 });
                    break;
                case 'tool_result':
                    const elapsed = ((Date.now() - _toolStartTime) / 1000).toFixed(1);
                    updateToolIndicator(data.name, elapsed);
                    updateToolEntry(data.name, data.result, data.error);
                    // 更新历史记录
                    const lastCall = _toolCallHistory[_toolCallHistory.length - 1];
                    if (lastCall && lastCall.name === data.name) {
                        lastCall.result = data.result;
                        lastCall.error = data.error;
                    }
                    os.updateAgentPanel(agentId, { status: 'output' });
                    break;
                case 'done':
                    removeThinkingIndicator();
                    // 如果有正在进行的工具调用，标记完成
                    if (_toolIndicatorEl) {
                        updateToolIndicator('工具调用结束');
                        playCompleteEffect(_toolIndicatorEl);
                        _toolIndicatorEl = null;
                    }
                    finishAssistantMessage();
                    _finishActiveCall('done');
                    os.updateAgentPanel(agentId, { status: 'idle' });
                    _setStreaming(false);
                    _sending = false;
                    if (data.tokens) os.updateAgentPanel(agentId, { contextTokens: data.tokens });
                    if (data.queued) addSystemMessage(`队列中还有 ${data.queued} 条消息等待处理`);
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
                _toolIndicatorEl.querySelector('.tool-call-count').textContent = `Round ${iterationCount}`;
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
                        <span class="tool-call-count">Round ${iterationCount}</span>
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
                                <div class="msg-tools"></div>
                            </div>
                        </div>
                    `;
                    messagesEl.appendChild(_currentAssistantEl);
                    _assistantContentEl = _currentAssistantEl.querySelector('.msg-content');
                    _assistantTextEl = _currentAssistantEl.querySelector('.msg-text');
                    _assistantToolEl = _currentAssistantEl.querySelector('.msg-tools');
                    _assistantContent = '';
                    _pendingText = '';
                }

                // 将工具调用指示器插入到工具容器中
                _assistantToolEl.appendChild(_toolIndicatorEl);
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

            // 获取当前工具调用信息
            const toolName = _toolIndicatorEl.dataset.toolName || '';
            const iterationCount = _toolIndicatorEl.dataset.iterationCount || '';

            // 从历史中获取最新的工具调用
            const latestCall = _toolCallHistory[_toolCallHistory.length - 1] || {};
            const args = latestCall.args || {};
            const result = latestCall.result || '等待返回值...';
            const error = latestCall.error || null;

            // 创建模态框
            const overlay = document.createElement('div');
            overlay.className = 'tool-modal-overlay';
            overlay.innerHTML = `
                <div class="tool-modal">
                    <div class="tool-modal-header">
                        <span class="tool-modal-title">工具调用详情</span>
                        <span class="tool-modal-count">Round ${escapeHtml(iterationCount)}</span>
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

            // 关闭逻辑
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                }
            });
            overlay.querySelector('.tool-modal-close').addEventListener('click', () => {
                overlay.remove();
            });

            document.body.appendChild(overlay);
        }

        function playCompleteEffect(indicatorEl) {
            if (!indicatorEl) return;

            const effect = document.createElement('div');
            effect.className = 'tool-complete-effect';
            document.body.appendChild(effect);

            // 追踪位置
            function updatePosition() {
                const rect = indicatorEl.getBoundingClientRect();
                effect.style.left = rect.left + 'px';
                effect.style.top = rect.top + 'px';
                effect.style.width = rect.width + 'px';
                effect.style.height = rect.height + 'px';
            }

            const tracker = setInterval(updatePosition, 16); // 60fps
            updatePosition();

            // 动态 SVG 打勾特效
            effect.innerHTML = `
                <svg class="tool-complete-svg" viewBox="0 0 100 40" preserveAspectRatio="xMaxYMid meet">
                    <!-- 扫描光效 -->
                    <defs>
                        <linearGradient id="scanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color:transparent"/>
                            <stop offset="50%" style="stop-color:rgba(0,229,255,0.5)"/>
                            <stop offset="100%" style="stop-color:transparent"/>
                        </linearGradient>
                    </defs>
                    <rect class="svg-scan" x="-100" y="0" width="100" height="40" fill="url(#scanGrad)">
                        <animate attributeName="x" from="-100" to="0" dur="0.6s" fill="freeze"/>
                    </rect>

                    <!-- 圆圈 -->
                    <circle class="svg-circle" cx="88" cy="20" r="10"
                            fill="none" stroke="var(--accent)" stroke-width="2" opacity="0">
                        <animate attributeName="opacity" from="0" to="1" begin="0.6s" dur="0.2s" fill="freeze"/>
                        <animate attributeName="r" from="0" to="10" begin="0.6s" dur="0.2s" fill="freeze"/>
                    </circle>

                    <!-- 打勾 -->
                    <polyline class="svg-check" points="82,20 86,24 94,16"
                              fill="none" stroke="white" stroke-width="2.5"
                              stroke-linecap="round" stroke-linejoin="round"
                              stroke-dasharray="20" stroke-dashoffset="20" opacity="0">
                        <animate attributeName="opacity" from="0" to="1" begin="0.8s" dur="0.1s" fill="freeze"/>
                        <animate attributeName="stroke-dashoffset" from="20" to="0" begin="0.8s" dur="0.4s" fill="freeze"/>
                    </polyline>

                    <!-- 圆圈变绿 -->
                    <circle class="svg-circle-done" cx="88" cy="20" r="10"
                            fill="#00e676" stroke="#00e676" stroke-width="2" opacity="0">
                        <animate attributeName="opacity" from="0" to="1" begin="1.2s" dur="0.2s" fill="freeze"/>
                    </circle>

                    <!-- 淡化 -->
                    <g opacity="1">
                        <animate attributeName="opacity" from="1" to="0" begin="1.5s" dur="0.3s" fill="freeze"/>
                        <use href="#scanGrad"/>
                        <circle cx="88" cy="20" r="10" fill="#00e676"/>
                    </g>
                </svg>
            `;

            // 1.8s: 清理
            setTimeout(() => {
                clearInterval(tracker);
                effect.remove();
            }, 1800);
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
            contentEl.innerHTML = formatContent(content);

            body.appendChild(label);
            body.appendChild(contentEl);
            row.appendChild(avatar);
            row.appendChild(body);
            messagesEl.appendChild(row);
            messagesEl.scrollTop = messagesEl.scrollHeight;
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
                            <div class="msg-tools"></div>
                        </div>
                    </div>
                `;
                messagesEl.appendChild(_currentAssistantEl);
                _assistantContentEl = _currentAssistantEl.querySelector('.msg-content');
                _assistantTextEl = _currentAssistantEl.querySelector('.msg-text');
                _assistantToolEl = _currentAssistantEl.querySelector('.msg-tools');
                _assistantContent = '';
                _pendingText = '';
            }

            // 创建 thinking 指示器（作为 msg-tools 的子元素，在文本之上）
            _thinkingEl = document.createElement('div');
            _thinkingEl.className = 'thinking-indicator';
            _thinkingEl.innerHTML = `
                <div class="thinking-dots"><span></span><span></span><span></span></div>
            `;
            _assistantToolEl.appendChild(_thinkingEl);
            messagesEl.scrollTop = messagesEl.scrollHeight;
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
        let _assistantToolEl = null;   // 工具面板容器
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
                            <div class="msg-tools"></div>
                        </div>
                    </div>
                `;
                messagesEl.appendChild(_currentAssistantEl);
                _assistantContentEl = _currentAssistantEl.querySelector('.msg-content');
                _assistantTextEl = _currentAssistantEl.querySelector('.msg-text');
                _assistantToolEl = _currentAssistantEl.querySelector('.msg-tools');
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
            messagesEl.scrollTop = messagesEl.scrollHeight;
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
                _assistantToolEl = null;
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

        function addToolEntry(name, args, status, iterationLabel) {
            _toolCount++;
            toolCountEl.textContent = _toolCount;
            const el = document.createElement('div');
            el.className = `tool-entry ${status}`;
            el.dataset.toolName = name;
            const argsStr = typeof args === 'string' ? args : JSON.stringify(args || {});
            el.innerHTML = `
                <span class="tool-entry-count">${escapeHtml(iterationLabel || '')}</span>
                <span class="tool-icon">${status === 'pending' ? '⏳' : '✅'}</span>
                <div class="tool-info">
                    <div class="tool-name">${escapeHtml(name)}</div>
                    <div class="tool-status">${escapeHtml(argsStr.slice(0, 60))}</div>
                </div>
            `;
            // 智能滚动：仅当用户在底部时才自动滚动
            const isAtBottom = toolsEl.scrollHeight - toolsEl.scrollTop <= toolsEl.clientHeight + 50;
            toolsEl.appendChild(el);
            if (isAtBottom) {
                toolsEl.scrollTop = toolsEl.scrollHeight;
            }
        }

        function updateToolEntry(name, result, error) {
            const entries = toolsEl.querySelectorAll('.tool-entry');
            for (const el of entries) {
                if (el.dataset.toolName === name && el.classList.contains('pending')) {
                    el.classList.remove('pending');
                    el.classList.add(error ? 'error' : 'done');
                    el.querySelector('.tool-icon').textContent = error ? '❌' : '✅';
                    if (error) el.querySelector('.tool-status').textContent = error.slice(0, 60);
                    break;
                }
            }
            if (result) {
                const r = typeof result === 'string' ? result : JSON.stringify(result);
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

            if (!currentSessionId) await createNewSession();

            _conversationRound++;
            _iterationInRound = 0;
            _iterationCount = 0;
            _toolCallHistory = [];

            addMessage('user', text, true);  // skipPersist=true，后端会持久化
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
        });

        /* ══════════════════════════════════════════
           Welcome chips
           ══════════════════════════════════════════ */

        container.querySelectorAll('.chip[data-prompt]').forEach(chip => {
            chip.addEventListener('click', () => {
                inputEl.value = chip.dataset.prompt;
                inputEl.style.height = '44px';
                inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
                sendBtn.disabled = false;
                inputEl.focus();
            });
        });

        /* ══════════════════════════════════════════
           Sidebar & panel toggles
           ══════════════════════════════════════════ */

        sessionToggleBtn.addEventListener('click', () => {
            sessionSidebar.classList.toggle('collapsed');
        });

        panelToggleBtn.addEventListener('click', () => {
            agentPanel.classList.toggle('collapsed');
        });

        sessionNewBtn.addEventListener('click', createNewSession);

        sessionFilter.addEventListener('input', () => {
            renderSessionList(sessionFilter.value);
        });

        terminalClearBtn.addEventListener('click', () => {
            terminalEl.innerHTML = '';
        });

        /* ══════════════════════════════════════════
           Settings drawer
           ══════════════════════════════════════════ */

        const settingsBtn = container.querySelector('#agent-settings-btn');
        const settingsOverlay = container.querySelector('#agent-settings-overlay');
        const settingsDrawer = container.querySelector('#agent-settings-drawer');
        const settingsCloseBtn = container.querySelector('#settings-close-btn');
        const settingsModel = container.querySelector('#settings-model');
        const settingsModelHint = container.querySelector('#settings-model-hint');
        const settingsSystemPrompt = container.querySelector('#settings-system-prompt');
        const settingsMaxIter = container.querySelector('#settings-max-iter');
        const settingsScanSpeed = container.querySelector('#settings-scan-speed');
        const settingsSaveBtn = container.querySelector('#settings-save-btn');
        const settingsResetBtn = container.querySelector('#settings-reset-btn');

        const SETTINGS_KEY = 'eos-agent-settings';
        const DEFAULT_SETTINGS = {
            model: '',
            systemPrompt: '你是 Eos Agent，一个强大的 AI 编程助手。\n你可以读写文件、执行终端命令、分析代码。\n请用中文回复。',
            maxIterations: 50,
            toolScanSpeed: 1.0,  // 工具调用扫描动画速度（秒）
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

        function fillSettingsForm(s) {
            settingsModel.value = s.model || '';
            settingsSystemPrompt.value = s.systemPrompt || '';
            settingsMaxIter.value = s.maxIterations || 50;
            settingsScanSpeed.value = s.toolScanSpeed || 1.0;
        }

        function readSettingsForm() {
            return {
                model: settingsModel.value,
                systemPrompt: settingsSystemPrompt.value,
                maxIterations: parseInt(settingsMaxIter.value, 10) || 50,
                toolScanSpeed: parseFloat(settingsScanSpeed.value) || 1.0,
            };
        }

        async function openSettings() {
            await populateModelSelect();
            fillSettingsForm(loadSettings());
            settingsOverlay.classList.add('open');
            settingsDrawer.classList.add('open');
        }

        function closeSettings() {
            settingsOverlay.classList.remove('open');
            settingsDrawer.classList.remove('open');
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

        settingsBtn.addEventListener('click', openSettings);
        settingsOverlay.addEventListener('click', closeSettings);
        settingsCloseBtn.addEventListener('click', closeSettings);

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

        settingsResetBtn.addEventListener('click', () => {
            fillSettingsForm(DEFAULT_SETTINGS);
            saveSettings(DEFAULT_SETTINGS);
            showToast('已重置为默认值');
        });

        /* ══════════════════════════════════════════
           Cleanup & init
           ══════════════════════════════════════════ */

        win.on('close', () => {
            if (ws) ws.close();
            os.removeAgentPanel(agentId);
        });

        addSystemMessage('正在连接 Agent 引擎...');
        connect();

        loadSessions().then(() => {
            if (sessionCache.length > 0) {
                switchSession(sessionCache[0].id);
            } else {
                createNewSession();
            }
        });
    }
});
