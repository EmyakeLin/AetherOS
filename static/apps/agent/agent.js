/* ═══════════════════════════════════════════════════════
   N.O.V.A AETHER OS — Agent Application
   Unified Agent interface with session management & tool panel
   ═══════════════════════════════════════════════════════ */

registerApp('agent', {
    title: 'Agent',
    icon: '🤖',
    factory: (container, win, os) => {
        const agentId = 'agent-' + Date.now();

        container.innerHTML = `
            <div style="display:flex;height:100%;background:var(--bg-surface);position:relative;overflow:hidden;">
                <!-- Session sidebar -->
                <div id="session-sidebar" class="session-sidebar">
                    <div class="session-header">
                        <span style="font-family:var(--font-display);font-size:10px;letter-spacing:2px;color:var(--text-muted);">会话列表</span>
                        <button id="session-new-btn" class="session-new-btn" title="新建会话">+ 新</button>
                    </div>
                    <div id="session-list" class="session-list"></div>
                </div>
                <!-- Chat panel -->
                <div style="flex:1;display:flex;flex-direction:column;border-right:1px solid var(--border);min-width:0;">
                    <div style="padding:8px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">
                        <button id="session-toggle-btn" class="session-toggle-btn" title="切换侧边栏">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="6" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="10" width="12" height="1.5" rx="0.75" fill="currentColor"/></svg>
                        </button>
                        <span id="session-title-display" style="font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">新会话</span>
                        <div style="flex:1;"></div>
                        <button id="agent-settings-btn" class="session-toggle-btn" title="模型设置">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" stroke-width="1.2"/><path d="M11.8 8.5c0-.2 0-.4-.1-.5l1-1.3-1.2-2.1-1.4.5c-.3-.2-.7-.4-1-.6L8.9 2.3H6.1L5.9 3.5c-.4.1-.7.3-1 .6L3.5 3.6l-1.2 2.1 1 1.3c0 .2-.1.4-.1.5s0 .3.1.5l-1 1.3 1.2 2.1 1.4-.5c.3.2.7.4 1 .6l.2 1.2h2.8l.2-1.2c.4-.1.7-.3 1-.6l1.4.5 1.2-2.1-1-1.3c.1-.2.1-.3.1-.5z" stroke="currentColor" stroke-width="1.2"/></svg>
                        </button>
                    </div>
                    <div id="agent-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;"></div>
                    <div style="padding:12px;border-top:1px solid var(--border);display:flex;gap:8px;">
                        <textarea id="agent-input" placeholder="输入消息... (Enter 发送, Shift+Enter 换行)" style="flex:1;resize:none;height:40px;max-height:120px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);padding:8px 12px;color:var(--text-primary);font-family:var(--font-body);font-size:13px;outline:none;transition:border-color 0.15s;" rows="1"></textarea>
                        <button id="agent-stop" style="padding:8px 14px;background:rgba(255,107,107,0.15);border:1px solid rgba(255,107,107,0.3);border-radius:var(--radius-md);color:#ff6b6b;font-weight:600;font-size:12px;cursor:pointer;transition:all 0.15s;white-space:nowrap;display:none;align-items:center;gap:4px;">停止</button>
                        <button id="agent-send" style="padding:8px 18px;background:linear-gradient(135deg,var(--accent),var(--accent-secondary));border:none;border-radius:var(--radius-md);color:var(--bg-deep);font-weight:600;font-size:12px;cursor:pointer;transition:all 0.15s;white-space:nowrap;display:flex;align-items:center;gap:6px;">发送 <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 1.5L10.5 6L1.5 10.5V7L7.5 6L1.5 4.5V1.5Z" fill="currentColor"/></svg></button>
                    </div>
                </div>
                <!-- Tool/terminal panel -->
                <div style="width:320px;display:flex;flex-direction:column;flex-shrink:0;">
                    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
                        <div style="padding:8px 12px;font-family:var(--font-display);font-size:10px;letter-spacing:2px;color:var(--text-muted);border-bottom:1px solid var(--border);">工具调用</div>
                        <div id="agent-tools" style="flex:1;overflow-y:auto;padding:8px;font-size:11px;font-family:var(--font-mono);"></div>
                    </div>
                    <div style="height:200px;border-top:1px solid var(--border);display:flex;flex-direction:column;">
                        <div style="padding:8px 12px;font-family:var(--font-display);font-size:10px;letter-spacing:2px;color:var(--text-muted);border-bottom:1px solid var(--border);">终端输出</div>
                        <div id="agent-terminal" style="flex:1;overflow-y:auto;padding:8px;font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);background:#060a14;"></div>
                    </div>
                </div>
                <!-- Settings drawer -->
                <div id="agent-settings-overlay" class="settings-overlay"></div>
                <div id="agent-settings-drawer" class="settings-drawer">
                    <div class="settings-drawer-header">
                        <span class="settings-drawer-title">模型设置</span>
                        <button id="settings-close-btn" class="settings-close-btn">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                        </button>
                    </div>
                    <div class="settings-drawer-body">
                        <div class="settings-field">
                            <label class="settings-label">模型</label>
                            <select id="settings-model" class="settings-select">
                                <option value="">加载中...</option>
                            </select>
                            <div id="settings-model-hint" class="settings-hint"></div>
                        </div>
                        <div class="settings-field">
                            <label class="settings-label">System Prompt</label>
                            <textarea id="settings-system-prompt" class="settings-textarea" rows="5" placeholder="你是 Eos Agent，一个强大的 AI 编程助手..."></textarea>
                        </div>
                        <div class="settings-field">
                            <label class="settings-label">最大迭代次数</label>
                            <input id="settings-max-iter" class="settings-input settings-input-sm" type="number" min="1" max="200" value="50">
                        </div>
                        <div class="settings-actions">
                            <button id="settings-save-btn" class="settings-save-btn">保存</button>
                            <button id="settings-reset-btn" class="settings-reset-btn">重置默认</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            /* Session sidebar */
            .session-sidebar{width:240px;border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;background:var(--bg-surface);transition:width 0.2s ease,opacity 0.15s;overflow:hidden;}
            .session-sidebar.collapsed{width:0;opacity:0;border-right:none;}
            .session-header{padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
            .session-new-btn{padding:4px 10px;background:var(--accent-glow);border:1px solid var(--accent-dim);border-radius:var(--radius-sm);color:var(--accent);cursor:pointer;font-size:11px;font-family:var(--font-mono);transition:all 0.15s;}
            .session-new-btn:hover{background:rgba(0,229,255,0.2);}
            .session-list{flex:1;overflow-y:auto;padding:4px;}
            .session-item{padding:10px 12px;border-radius:var(--radius-sm);cursor:pointer;position:relative;transition:background 0.1s;margin-bottom:2px;}
            .session-item:hover{background:var(--bg-hover);}
            .session-item.active{background:var(--accent-glow);border:1px solid var(--accent-dim);}
            .session-item-title{font-size:12px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;padding-right:20px;}
            .session-item-meta{font-size:10px;color:var(--text-muted);font-family:var(--font-mono);display:flex;gap:4px;}
            .session-item-delete{position:absolute;top:8px;right:8px;opacity:0;background:none;border:none;color:var(--accent-warm);cursor:pointer;padding:2px;transition:opacity 0.15s;}
            .session-item:hover .session-item-delete{opacity:0.7;}
            .session-item-delete:hover{opacity:1 !important;}
            .session-toggle-btn{background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;border-radius:var(--radius-sm);transition:all 0.15s;display:flex;align-items:center;}
            .session-toggle-btn:hover{color:var(--text-primary);background:var(--bg-hover);}

            /* Existing styles */
            #agent-input:focus{border-color:var(--accent-dim)!important;box-shadow:0 0 0 1px var(--accent-glow);}
            #agent-send:hover{box-shadow:0 0 16px rgba(0,229,255,0.3);}
            #agent-stop:hover{background:rgba(255,107,107,0.25);box-shadow:0 0 12px rgba(255,107,107,0.2);}
            .agent-msg{max-width:85%;padding:10px 14px;border-radius:var(--radius-lg);line-height:1.6;font-size:13px;word-break:break-word;}
            .agent-msg.user{align-self:flex-end;background:linear-gradient(135deg,rgba(0,229,255,0.12),rgba(108,92,231,0.12));border:1px solid rgba(0,229,255,0.15);color:var(--text-primary);}
            .agent-msg.assistant{align-self:flex-start;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-primary);}
            .agent-msg .msg-role{font-size:10px;color:var(--text-muted);margin-bottom:4px;font-family:var(--font-mono);}
            .agent-msg pre{background:var(--bg-deep);padding:10px;border-radius:var(--radius-sm);overflow-x:auto;margin:8px 0;font-size:12px;line-height:1.5;}
            .agent-msg code{font-family:var(--font-mono);}
            .tool-entry{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:var(--radius-sm);margin-bottom:4px;background:var(--bg-elevated);border:1px solid var(--border);}
            .tool-entry.pending{border-color:var(--accent-dim);background:var(--accent-glow);}
            .tool-entry.done{opacity:0.7;}
            .tool-entry.error{border-color:rgba(255,107,107,0.3);background:rgba(255,107,107,0.05);}
            .tool-icon{font-size:12px;flex-shrink:0;}
            .tool-name{font-weight:600;color:var(--text-primary);}
            .tool-status{font-size:10px;color:var(--text-muted);}
            #agent-input::-webkit-scrollbar{width:4px;}
            #agent-input::-webkit-scrollbar-thumb{background:var(--text-muted);border-radius:2px;}

            /* Settings drawer */
            .settings-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(2px);z-index:90;opacity:0;pointer-events:none;transition:opacity 0.2s;}
            .settings-overlay.open{opacity:1;pointer-events:auto;}
            .settings-drawer{position:absolute;top:0;right:0;bottom:0;width:340px;background:var(--bg-elevated);border-left:1px solid var(--accent-dim);z-index:100;display:flex;flex-direction:column;transform:translateX(100%);transition:transform 0.25s cubic-bezier(0.4,0,0.2,1);box-shadow:-8px 0 32px rgba(0,0,0,0.4);}
            .settings-drawer.open{transform:translateX(0);}
            .settings-drawer-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);flex-shrink:0;}
            .settings-drawer-title{font-family:var(--font-display);font-size:11px;letter-spacing:2px;color:var(--accent);text-transform:uppercase;}
            .settings-close-btn{background:none;border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-muted);cursor:pointer;padding:4px;display:flex;align-items:center;transition:all 0.15s;}
            .settings-close-btn:hover{color:var(--accent-warm);border-color:var(--accent-warm);}
            .settings-drawer-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:16px;}
            .settings-field{display:flex;flex-direction:column;gap:6px;}
            .settings-label{font-family:var(--font-display);font-size:10px;letter-spacing:1.5px;color:var(--text-muted);text-transform:uppercase;}
            .settings-input{width:100%;padding:8px 12px;background:var(--bg-deep);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-family:var(--font-mono);font-size:12px;outline:none;transition:border-color 0.15s,box-shadow 0.15s;box-sizing:border-box;}
            .settings-input:focus{border-color:var(--accent-dim);box-shadow:0 0 0 1px var(--accent-glow);}
            .settings-input::placeholder{color:var(--text-muted);opacity:0.5;}
            .settings-input-sm{width:100px;}
            .settings-textarea{width:100%;padding:8px 12px;background:var(--bg-deep);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-family:var(--font-mono);font-size:12px;outline:none;resize:vertical;min-height:80px;transition:border-color 0.15s,box-shadow 0.15s;box-sizing:border-box;line-height:1.5;}
            .settings-textarea:focus{border-color:var(--accent-dim);box-shadow:0 0 0 1px var(--accent-glow);}
            .settings-textarea::placeholder{color:var(--text-muted);opacity:0.5;}
            .settings-select{width:100%;padding:8px 12px;background:var(--bg-deep);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-family:var(--font-mono);font-size:12px;outline:none;transition:border-color 0.15s,box-shadow 0.15s;box-sizing:border-box;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px;}
            .settings-select:focus{border-color:var(--accent-dim);box-shadow:0 0 0 1px var(--accent-glow);}
            .settings-select option{background:var(--bg-deep);color:var(--text-primary);}
            .settings-select optgroup{color:var(--accent);font-weight:600;}
            .settings-hint{font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;min-height:14px;}
            .settings-actions{display:flex;gap:8px;margin-top:8px;padding-top:16px;border-top:1px solid var(--border);}
            .settings-save-btn{flex:1;padding:8px 0;background:linear-gradient(135deg,var(--accent),var(--accent-secondary));border:none;border-radius:var(--radius-sm);color:var(--bg-deep);font-family:var(--font-display);font-size:11px;letter-spacing:1px;font-weight:700;cursor:pointer;transition:all 0.15s;text-transform:uppercase;}
            .settings-save-btn:hover{box-shadow:0 0 16px rgba(0,229,255,0.3);transform:translateY(-1px);}
            .settings-reset-btn{padding:8px 14px;background:none;border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-muted);font-family:var(--font-display);font-size:10px;letter-spacing:1px;cursor:pointer;transition:all 0.15s;}
            .settings-reset-btn:hover{color:var(--accent-warm);border-color:rgba(255,107,107,0.3);}
            /* settings saved toast */
            .settings-toast{position:absolute;bottom:20px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--bg-deep);border:1px solid var(--accent-dim);border-radius:var(--radius-sm);padding:8px 16px;font-family:var(--font-mono);font-size:11px;color:var(--accent);opacity:0;transition:all 0.3s;pointer-events:none;z-index:110;}
            .settings-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
        `;
        container.appendChild(style);

        const messagesEl = container.querySelector('#agent-messages');
        const inputEl = container.querySelector('#agent-input');
        const sendBtn = container.querySelector('#agent-send');
        const stopBtn = container.querySelector('#agent-stop');
        const toolsEl = container.querySelector('#agent-tools');
        const terminalEl = container.querySelector('#agent-terminal');
        const sessionSidebar = container.querySelector('#session-sidebar');
        const sessionListEl = container.querySelector('#session-list');
        const sessionNewBtn = container.querySelector('#session-new-btn');
        const sessionToggleBtn = container.querySelector('#session-toggle-btn');
        const sessionTitleDisplay = container.querySelector('#session-title-display');

        let ws = null;
        let messages = [];
        let isStreaming = false;
        let currentSessionId = null;
        let sessionCache = [];

        // ── Register agent panel in sidebar ──
        os.registerAgentPanel({ id: agentId, name: 'Eos Agent', windowId: win.id });

        // ══════════════════════════════════════
        // Session management
        // ══════════════════════════════════════

        async function loadSessions() {
            try {
                const res = await os.api('GET', '/api/agent/sessions');
                sessionCache = res.sessions || [];
                renderSessionList();
            } catch (e) {
                console.warn('Failed to load sessions:', e);
            }
        }

        function renderSessionList() {
            sessionListEl.innerHTML = '';
            for (const session of sessionCache) {
                const el = document.createElement('div');
                el.className = `session-item${session.id === currentSessionId ? ' active' : ''}`;
                el.dataset.sessionId = session.id;
                const timeStr = formatTime(session.updated_at);
                el.innerHTML = `
                    <div class="session-item-title">${escapeHtml(session.title)}</div>
                    <div class="session-item-meta">
                        <span>${session.message_count} 条消息</span>
                        <span>·</span>
                        <span>${timeStr}</span>
                    </div>
                    <button class="session-item-delete" title="删除会话">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
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

        async function createNewSession() {
            try {
                const session = await os.api('POST', '/api/agent/sessions', { title: '新会话' });
                sessionCache.unshift(session);
                currentSessionId = session.id;
                messagesEl.innerHTML = '';
                messages = [];
                renderSessionList();
                updateSessionTitle('新会话');
                addWelcomeMessage();
            } catch (e) {
                console.warn('Failed to create session:', e);
            }
        }

        async function switchSession(sessionId) {
            if (sessionId === currentSessionId) return;
            currentSessionId = sessionId;
            messagesEl.innerHTML = '';
            messages = [];

            try {
                const res = await os.api('GET', `/api/agent/sessions/${sessionId}/messages`);
                const msgs = res.messages || [];
                for (const msg of msgs) {
                    addMessage(msg.role, msg.content, true);
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
                // Update cache
                const session = sessionCache.find(s => s.id === currentSessionId);
                if (session) {
                    session.message_count = (session.message_count || 0) + 1;
                    session.updated_at = Date.now();
                    // Auto-generate title from first user message
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
            sessionTitleDisplay.textContent = title || '新会话';
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

        // ══════════════════════════════════════
        // WebSocket connection
        // ══════════════════════════════════════

        function connect() {
            const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(`${proto}//${location.host}/ws/agent/custom/${agentId}`);

            ws.onopen = () => {
                os.updateAgentPanel(agentId, { status: 'idle', contextTokens: 0 });
                addSystemMessage('已连接到 Agent 引擎');
                // Send settings to engine
                const s = loadSettings();
                if (s.model) {
                    ws.send(JSON.stringify({ type: 'configure', settings: s }));
                }
            };

            ws.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    handleMessage(data);
                } catch (err) {
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
                    appendAssistantText(data.content);
                    _finishActiveCall('done', {
                        tokens: data.tokens || 0,
                        latency: data.latency || 0,
                    });
                    break;
                case 'tool_call':
                    addToolEntry(data.name, data.arguments, 'pending');
                    os.updateAgentPanel(agentId, { status: 'tool', toolName: data.name });
                    _finishActiveCall('done', {
                        tokens: data.tokens || 0,
                        latency: data.latency || 0,
                    });
                    break;
                case 'tool_result':
                    updateToolEntry(data.name, data.result, data.error);
                    os.updateAgentPanel(agentId, { status: 'output' });
                    break;
                case 'done':
                    _finishActiveCall('done');
                    os.updateAgentPanel(agentId, { status: 'idle' });
                    _setStreaming(false);
                    if (data.tokens) {
                        os.updateAgentPanel(agentId, { contextTokens: data.tokens });
                    }
                    if (data.queued) {
                        addSystemMessage(`队列中还有 ${data.queued} 条消息等待处理`);
                    }
                    break;
                case 'error':
                    _finishActiveCall('error', { error: data.message });
                    addSystemMessage('错误: ' + data.message);
                    os.updateAgentPanel(agentId, { status: 'idle' });
                    _setStreaming(false);
                    break;
                case 'interrupted':
                    addSystemMessage('Agent 已中断');
                    os.updateAgentPanel(agentId, { status: 'idle' });
                    _setStreaming(false);
                    break;
                case 'queued':
                    addSystemMessage(`消息已排队 (位置: ${data.position})`);
                    break;
            }
        }

        // ══════════════════════════════════════
        // Message rendering
        // ══════════════════════════════════════

        function addMessage(role, content, skipPersist = false) {
            const el = document.createElement('div');
            el.className = `agent-msg ${role}`;
            el.innerHTML = `<div class="msg-role">${role === 'user' ? '👤 你' : '🤖 Agent'}</div><div>${formatContent(content)}</div>`;
            messagesEl.appendChild(el);
            messagesEl.scrollTop = messagesEl.scrollHeight;
            messages.push({ role, content });

            if (!skipPersist && role !== 'system') {
                persistMessage(role, content);
            }
        }

        function addSystemMessage(text) {
            const el = document.createElement('div');
            el.style.cssText = 'text-align:center;font-size:10.5px;color:var(--text-muted);padding:4px 0;';
            el.textContent = text;
            messagesEl.appendChild(el);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function addWelcomeMessage() {
            addMessage('assistant', '你好！我是 Eos Agent，有什么需要帮助的？\n\n我可以帮你：\n- 读写和编辑文件\n- 运行终端命令\n- 分析和重构代码\n- 回答技术问题', true);
        }

        let _currentAssistantEl = null;
        let _assistantContent = '';

        function appendAssistantText(text) {
            if (!_currentAssistantEl) {
                _currentAssistantEl = document.createElement('div');
                _currentAssistantEl.className = 'agent-msg assistant';
                _currentAssistantEl.innerHTML = `<div class="msg-role">🤖 Agent</div><div class="msg-content"></div>`;
                messagesEl.appendChild(_currentAssistantEl);
                _assistantContent = '';
            }
            _assistantContent += text;
            _currentAssistantEl.querySelector('.msg-content').innerHTML += formatContent(text);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function finishAssistantMessage() {
            if (_currentAssistantEl) {
                const content = _assistantContent || _currentAssistantEl.querySelector('.msg-content').textContent;
                messages.push({ role: 'assistant', content });
                persistMessage('assistant', content);
                _currentAssistantEl = null;
                _assistantContent = '';
            }
        }

        function formatContent(text) {
            return text
                .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
                .replace(/`([^`]+)`/g, '<code style="background:var(--bg-deep);padding:1px 4px;border-radius:3px;">$1</code>')
                .replace(/\n/g, '<br>');
        }

        // ══════════════════════════════════════
        // Tool entries
        // ══════════════════════════════════════

        function addToolEntry(name, args, status) {
            const el = document.createElement('div');
            el.className = `tool-entry ${status}`;
            el.dataset.toolName = name;
            const argsStr = typeof args === 'string' ? args : JSON.stringify(args || {});
            el.innerHTML = `
                <span class="tool-icon">${status === 'pending' ? '⏳' : '✅'}</span>
                <span class="tool-name">${escapeHtml(name)}</span>
                <span class="tool-status">${escapeHtml(argsStr.slice(0, 40))}</span>
            `;
            toolsEl.appendChild(el);
            toolsEl.scrollTop = toolsEl.scrollHeight;
        }

        function updateToolEntry(name, result, error) {
            const entries = toolsEl.querySelectorAll('.tool-entry');
            for (const el of entries) {
                if (el.dataset.toolName === name && el.classList.contains('pending')) {
                    el.classList.remove('pending');
                    el.classList.add(error ? 'error' : 'done');
                    el.querySelector('.tool-icon').textContent = error ? '❌' : '✅';
                    if (error) {
                        el.querySelector('.tool-status').textContent = error.slice(0, 50);
                    }
                    break;
                }
            }
            if (result) {
                terminalEl.innerHTML += `<div style="color:var(--accent);">$ ${escapeHtml(name)}</div><div>${escapeHtml(typeof result === 'string' ? result : JSON.stringify(result)).slice(0, 500)}</div>`;
                terminalEl.scrollTop = terminalEl.scrollHeight;
            }
        }

        function escapeHtml(s) {
            const d = document.createElement('div');
            d.textContent = s || '';
            return d.innerHTML;
        }

        // ══════════════════════════════════════
        // Send message
        // ══════════════════════════════════════

        function _setStreaming(active) {
            isStreaming = active;
            stopBtn.style.display = active ? 'flex' : 'none';
            sendBtn.style.display = active ? 'none' : 'flex';
        }

        async function sendMessage() {
            const text = inputEl.value.trim();
            if (!text) return;

            // Ensure session exists
            if (!currentSessionId) {
                await createNewSession();
            }

            addMessage('user', text);
            inputEl.value = '';
            inputEl.style.height = '40px';

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'message', content: text }));
                if (!isStreaming) {
                    _setStreaming(true);
                    os.updateAgentPanel(agentId, { status: 'thinking' });
                }
                // Reset assistant state for each new message (queued or fresh)
                _currentAssistantEl = null;
                _assistantContent = '';
            } else {
                addMessage('assistant', 'Agent 引擎未连接。请确保后端服务正在运行。', true);
            }
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
            inputEl.style.height = '40px';
            inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
        });

        // ══════════════════════════════════════
        // Session sidebar toggle
        // ══════════════════════════════════════

        sessionToggleBtn.addEventListener('click', () => {
            sessionSidebar.classList.toggle('collapsed');
        });

        sessionNewBtn.addEventListener('click', createNewSession);

        // ══════════════════════════════════════
        // Settings drawer
        // ══════════════════════════════════════

        const settingsBtn = container.querySelector('#agent-settings-btn');
        const settingsOverlay = container.querySelector('#agent-settings-overlay');
        const settingsDrawer = container.querySelector('#agent-settings-drawer');
        const settingsCloseBtn = container.querySelector('#settings-close-btn');
        const settingsModel = container.querySelector('#settings-model');
        const settingsModelHint = container.querySelector('#settings-model-hint');
        const settingsSystemPrompt = container.querySelector('#settings-system-prompt');
        const settingsMaxIter = container.querySelector('#settings-max-iter');
        const settingsSaveBtn = container.querySelector('#settings-save-btn');
        const settingsResetBtn = container.querySelector('#settings-reset-btn');

        const SETTINGS_KEY = 'eos-agent-settings';

        const DEFAULT_SETTINGS = {
            model: '',
            systemPrompt: '你是 Eos Agent，一个强大的 AI 编程助手。\n你可以读写文件、执行终端命令、分析代码。\n请用中文回复。',
            maxIterations: 50,
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

        async function populateModelSelect() {
            try {
                const models = await os.llm.getModels();
                const select = settingsModel;
                select.innerHTML = '';
                if (!models || models.length === 0) {
                    select.innerHTML = '<option value="">未配置模型（请在设置中添加 Provider）</option>';
                    settingsModelHint.textContent = '请在系统设置中配置 LLM Provider';
                    return;
                }
                // Group by provider
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
            } catch (e) {
                settingsModel.innerHTML = '<option value="">加载失败</option>';
                settingsModelHint.textContent = '无法获取模型列表';
            }
        }

        function fillSettingsForm(s) {
            settingsModel.value = s.model || '';
            settingsSystemPrompt.value = s.systemPrompt || '';
            settingsMaxIter.value = s.maxIterations || 50;
        }

        function readSettingsForm() {
            return {
                model: settingsModel.value,
                systemPrompt: settingsSystemPrompt.value,
                maxIterations: parseInt(settingsMaxIter.value, 10) || 50,
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
            let toast = container.querySelector('.settings-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'settings-toast';
                container.appendChild(toast);
            }
            toast.textContent = msg;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 1800);
        }

        settingsBtn.addEventListener('click', openSettings);
        settingsOverlay.addEventListener('click', closeSettings);
        settingsCloseBtn.addEventListener('click', closeSettings);

        settingsSaveBtn.addEventListener('click', () => {
            const s = readSettingsForm();
            saveSettings(s);
            closeSettings();
            // Apply immediately if connected
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

        // ══════════════════════════════════════
        // Cleanup & init
        // ══════════════════════════════════════

        win.on('close', () => {
            if (ws) ws.close();
            os.removeAgentPanel(agentId);
        });

        // Connect WebSocket
        addSystemMessage('正在连接 Agent 引擎...');
        connect();

        // Load sessions and restore
        loadSessions().then(() => {
            if (sessionCache.length > 0) {
                switchSession(sessionCache[0].id);
            } else {
                createNewSession();
            }
        });
    }
});
