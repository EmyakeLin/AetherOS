/* ═══════════════════════════════════════════════════════
   N.O.V.A AETHER OS — Settings Application
   Agent config, MCP servers, tools, context, theme
   ═══════════════════════════════════════════════════════ */

registerApp('settings', {
    title: '设置',
    icon: '⚙️',
    factory: (container, win, os) => {
        container.innerHTML = `
            <div style="display:flex;height:100%;background:var(--bg-surface);">
                <!-- Sidebar nav -->
                <div style="width:180px;border-right:1px solid var(--border);padding:12px 8px;flex-shrink:0;display:flex;flex-direction:column;gap:2px;">
                    <div style="font-family:var(--font-display);font-size:10px;letter-spacing:2px;color:var(--text-muted);padding:8px;margin-bottom:4px;">设置</div>
                    <div class="settings-nav active" data-section="general">通用</div>
                    <div class="settings-nav" data-section="tools">工具管理</div>
                    <div class="settings-nav" data-section="mcp">MCP 服务器</div>
                    <div class="settings-nav" data-section="context">上下文管理</div>
                    <div class="settings-nav" data-section="appearance">外观</div>
                    <div class="settings-nav" data-section="keybindings">快捷键</div>
                    <div class="settings-nav" data-section="apps">应用管理</div>
                    <div class="settings-nav" data-section="llm">LLM 模型</div>
                    <div class="settings-nav" data-section="storage">存储空间</div>
                </div>
                <!-- Content -->
                <div id="settings-content" style="flex:1;overflow-y:auto;padding:20px;"></div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .settings-nav{padding:7px 12px;font-size:12px;color:var(--text-secondary);cursor:pointer;border-radius:var(--radius-sm);transition:all 0.1s;}
            .settings-nav:hover{background:var(--bg-hover);color:var(--text-primary);}
            .settings-nav.active{background:var(--accent-glow);color:var(--accent);}
            .settings-group{margin-bottom:24px;}
            .settings-group-title{font-family:var(--font-display);font-size:11px;letter-spacing:2px;color:var(--text-muted);margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--border);}
            .settings-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;gap:16px;}
            .settings-label{font-size:12px;color:var(--text-secondary);flex-shrink:0;min-width:120px;}
            .settings-desc{font-size:10.5px;color:var(--text-muted);margin-top:2px;}
            .settings-input{background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;color:var(--text-primary);font-family:var(--font-mono);font-size:12px;outline:none;transition:border-color 0.15s;flex:1;max-width:360px;}
            .settings-input:focus{border-color:var(--accent-dim);}
            .settings-select{background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;color:var(--text-primary);font-size:12px;outline:none;cursor:pointer;}
            .settings-btn{padding:6px 16px;background:var(--accent-glow);border:1px solid var(--accent-dim);border-radius:var(--radius-sm);color:var(--accent);cursor:pointer;font-size:11px;font-family:var(--font-mono);transition:all 0.15s;}
            .settings-btn:hover{background:rgba(0,229,255,0.2);}
            .settings-btn-danger{border-color:rgba(255,107,107,0.3);color:var(--accent-warm);background:rgba(255,107,107,0.05);}
            .settings-btn-danger:hover{background:rgba(255,107,107,0.15);}
        `;
        container.appendChild(style);

        const contentEl = container.querySelector('#settings-content');

        const sections = {
            general: () => `
                <div class="settings-group">
                    <div class="settings-group-title">通用设置</div>
                    <div class="settings-row">
                        <div><div class="settings-label">系统名称</div><div class="settings-desc">显示在菜单栏的系统名称</div></div>
                        <input class="settings-input" value="N.O.V.A" />
                    </div>
                    <div class="settings-row">
                        <div><div class="settings-label">语言</div><div class="settings-desc">界面语言</div></div>
                        <select class="settings-select"><option selected>中文</option><option>English</option></select>
                    </div>
                    <div class="settings-row">
                        <div><div class="settings-label">自动保存</div><div class="settings-desc">编辑器文件自动保存延迟（毫秒）</div></div>
                        <input class="settings-input" type="number" value="1000" style="max-width:120px;" />
                    </div>
                </div>
                <div class="settings-group">
                    <div class="settings-group-title">后端连接</div>
                    <div class="settings-row">
                        <div><div class="settings-label">服务器地址</div><div class="settings-desc">后端 API 地址</div></div>
                        <input class="settings-input" value="${location.origin}" />
                    </div>
                    <div class="settings-row">
                        <div><div class="settings-label">连接状态</div></div>
                        <span style="color:var(--accent);font-size:12px;">● 已连接</span>
                    </div>
                </div>
            `,

            tools: () => `
                <div class="settings-group">
                    <div class="settings-group-title">已注册工具</div>
                    <div id="tools-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
                        <div style="padding:12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);display:flex;align-items:center;gap:10px;">
                            <span style="font-size:14px;">📄</span>
                            <div style="flex:1;"><div style="font-size:12px;font-weight:600;">read_file</div><div style="font-size:10px;color:var(--text-muted);">读取文件内容</div></div>
                            <span style="font-size:10px;color:var(--accent);">内置</span>
                        </div>
                        <div style="padding:12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);display:flex;align-items:center;gap:10px;">
                            <span style="font-size:14px;">✏️</span>
                            <div style="flex:1;"><div style="font-size:12px;font-weight:600;">write_file</div><div style="font-size:10px;color:var(--text-muted);">写入文件内容</div></div>
                            <span style="font-size:10px;color:var(--accent);">内置</span>
                        </div>
                        <div style="padding:12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);display:flex;align-items:center;gap:10px;">
                            <span style="font-size:14px;">⬛</span>
                            <div style="flex:1;"><div style="font-size:12px;font-weight:600;">run_terminal</div><div style="font-size:10px;color:var(--text-muted);">执行终端命令</div></div>
                            <span style="font-size:10px;color:var(--accent);">内置</span>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="settings-btn">添加自定义工具</button>
                        <button class="settings-btn">从文件热加载</button>
                    </div>
                </div>
                <div class="settings-group">
                    <div class="settings-group-title">自定义工具目录</div>
                    <div class="settings-row">
                        <div><div class="settings-label">工具目录路径</div><div class="settings-desc">Python 文件热加载目录</div></div>
                        <input class="settings-input" value="./agent/tools/custom/" />
                    </div>
                </div>
            `,

            mcp: () => `
                <div class="settings-group">
                    <div class="settings-group-title">MCP 服务器</div>
                    <div id="mcp-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
                        <div style="padding:12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);text-align:center;color:var(--text-muted);font-size:12px;">暂无配置的 MCP 服务器</div>
                    </div>
                    <button class="settings-btn">添加 MCP 服务器</button>
                </div>
                <div class="settings-group">
                    <div class="settings-group-title">配置示例</div>
                    <pre style="background:var(--bg-deep);padding:12px;border-radius:var(--radius-md);font-size:11px;color:var(--text-secondary);overflow-x:auto;border:1px solid var(--border);">mcp_servers:
  filesystem:
    command: npx
    args: ["@modelcontextprotocol/server-filesystem", "/home/user"]
  godot:
    command: npx
    args: ["@coding-solo/godot-mcp"]</pre>
                </div>
            `,

            context: () => `
                <div class="settings-group">
                    <div class="settings-group-title">Eos-Context 文件上下文管理</div>
                    <div class="settings-row">
                        <div><div class="settings-label">状态</div><div class="settings-desc">Eos-Context 文件上下文管理器</div></div>
                        <span id="eos-context-status" style="color:var(--accent);font-size:12px;">✓ 已启用</span>
                    </div>
                    <div class="settings-row">
                        <div><div class="settings-label">操作</div><div class="settings-desc">启用或禁用 Eos-Context 文件上下文管理器</div></div>
                        <button class="settings-btn" id="eos-context-toggle" style="padding:4px 12px;font-size:11px;">禁用</button>
                    </div>
                    <div class="settings-row">
                        <div><div class="settings-label">说明</div><div class="settings-desc">
                            Eos-Context 会自动优化文件操作的上下文：<br>
                            • write_file: 省略 content 参数，标记旧内容为过期<br>
                            • edit_file: 省略 old_string/new_string 参数<br>
                            • read_file: 合并连续读取，标记过期内容<br>
                            • 失败的工具调用不参与上下文管理
                        </div></div>
                    </div>
                </div>
            `,

            appearance: () => `
                <div class="settings-group">
                    <div class="settings-group-title">外观设置</div>
                    <div class="settings-row">
                        <div><div class="settings-label">主题</div><div class="settings-desc">系统颜色主题</div></div>
                        <select class="settings-select" id="settings-theme-select">
                            <option value="light">浅色 · 米色 (Light)</option>
                            <option value="dark">深色 (Dark)</option>
                            <option value="kinetic">物理极简 (Kinetic)</option>
                        </select>
                    </div>
                    <div class="settings-row">
                        <div><div class="settings-label">性能模式</div><div class="settings-desc">低性能模式禁用毛玻璃和复杂动画，提升流畅度</div></div>
                        <select class="settings-select" id="settings-perf-select">
                            <option value="normal">正常模式</option>
                            <option value="low">低性能模式</option>
                        </select>
                    </div>
                    <div class="settings-row">
                        <div><div class="settings-label">强调色</div><div class="settings-desc">系统主色调</div></div>
                        <div style="display:flex;gap:8px;">
                            <div style="width:24px;height:24px;border-radius:50%;background:var(--accent);cursor:pointer;border:2px solid var(--accent);box-shadow:0 0 8px var(--accent);" title="青色"></div>
                            <div style="width:24px;height:24px;border-radius:50%;background:#6c5ce7;cursor:pointer;border:2px solid transparent;" title="紫色"></div>
                            <div style="width:24px;height:24px;border-radius:50%;background:#ff6b6b;cursor:pointer;border:2px solid transparent;" title="红色"></div>
                            <div style="width:24px;height:24px;border-radius:50%;background:#40c060;cursor:pointer;border:2px solid transparent;" title="绿色"></div>
                        </div>
                    </div>
                    <div class="settings-row">
                        <div><div class="settings-label">字体大小</div><div class="settings-desc">全局字体大小</div></div>
                        <input class="settings-input" type="number" value="13" style="max-width:80px;" /> <span style="color:var(--text-muted);font-size:12px;">px</span>
                    </div>
                    <div class="settings-row">
                        <div><div class="settings-label">窗口圆角</div><div class="settings-desc">窗口边框圆角半径</div></div>
                        <input class="settings-input" type="number" value="14" style="max-width:80px;" /> <span style="color:var(--text-muted);font-size:12px;">px</span>
                    </div>
                </div>
            `,

            keybindings: () => `
                <div class="settings-group">
                    <div class="settings-group-title">快捷键</div>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        ${[
                            ['Ctrl+N', '新建文件'],
                            ['Ctrl+O', '打开文件'],
                            ['Ctrl+S', '保存'],
                            ['Ctrl+W', '关闭窗口'],
                            ['Ctrl+M', '最小化窗口'],
                            ['Ctrl+Shift+M', '最大化窗口'],
                            ['Ctrl+F', '查找'],
                            ['Ctrl+H', '替换'],
                            ['Ctrl+`', '切换终端'],
                            ['Ctrl+B', '切换侧边栏'],
                        ].map(([key, desc]) => `
                            <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
                                <span style="font-size:12px;color:var(--text-secondary);">${desc}</span>
                                <kbd style="font-family:var(--font-mono);font-size:10.5px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;padding:3px 8px;color:var(--text-primary);">${key}</kbd>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `,

            apps: () => `
                <div class="settings-group">
                    <div class="settings-group-title">已安装应用</div>
                    <div id="apps-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
                        <div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px;">加载中...</div>
                    </div>
                    <button class="settings-btn" id="apps-refresh-btn">刷新列表</button>
                </div>
                <div class="settings-group">
                    <div class="settings-group-title">创建新应用</div>
                    <div class="settings-row">
                        <div><div class="settings-label">应用 ID</div><div class="settings-desc">唯一标识，用于文件夹名（字母、数字、连字符）</div></div>
                        <input class="settings-input" id="apps-new-id" placeholder="my-app" />
                    </div>
                    <div class="settings-row">
                        <div><div class="settings-label">标题</div><div class="settings-desc">显示在窗口标题和 Dock</div></div>
                        <input class="settings-input" id="apps-new-title" placeholder="我的应用" />
                    </div>
                    <div class="settings-row">
                        <div><div class="settings-label">图标 Emoji</div><div class="settings-desc">应用图标（无 SVG 时使用）</div></div>
                        <input class="settings-input" id="apps-new-emoji" value="📦" style="max-width:80px;" />
                    </div>
                    <div class="settings-row">
                        <div><div class="settings-label">描述</div><div class="settings-desc">应用简介</div></div>
                        <input class="settings-input" id="apps-new-desc" placeholder="应用功能描述" />
                    </div>
                    <div style="margin-top:12px;">
                        <button class="settings-btn" id="apps-create-btn">创建应用</button>
                    </div>
                </div>
            `,

            llm: () => `
                <div class="settings-group">
                    <div class="settings-group-title">LLM Provider 配置</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;">全局模型配置，供所有应用加载使用。</div>
                    <div id="llm-providers-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
                        <div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px;">加载中...</div>
                    </div>
                    <button class="settings-btn" id="llm-add-provider">添加 Provider</button>
                </div>
                <div class="settings-group" id="llm-defaults-section" style="display:none;">
                    <div class="settings-group-title">默认模型</div>
                    <div class="settings-row">
                        <div><div class="settings-label">默认对话模型</div><div class="settings-desc">未指定模型时使用</div></div>
                        <select class="settings-select" id="llm-default-chat" style="max-width:280px;"></select>
                    </div>
                    <div class="settings-row">
                        <div><div class="settings-label">默认图像模型</div><div class="settings-desc">图像生成默认模型</div></div>
                        <select class="settings-select" id="llm-default-image" style="max-width:280px;"></select>
                    </div>
                    <div style="margin-top:12px;">
                        <button class="settings-btn" id="llm-save-defaults">保存默认设置</button>
                    </div>
                </div>
            `,

            storage: () => `
                <div class="settings-group">
                    <div class="settings-group-title">存储空间</div>
                    <div id="storage-loading" style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">正在计算存储占用...</div>
                    <div id="storage-content" style="display:none;"></div>
                </div>
                <div class="settings-group">
                    <div class="settings-group-title">数据目录</div>
                    <div id="storage-dir-info" style="margin-bottom:12px;"></div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="settings-btn" id="storage-change-btn">更改数据目录</button>
                        <button class="settings-btn settings-btn-danger" id="storage-reset-btn" style="display:none;">恢复默认目录</button>
                    </div>
                    <div id="storage-migrate-msg" style="margin-top:10px;font-size:11px;display:none;"></div>
                </div>
                <div class="settings-group">
                    <div class="settings-group-title">磁盘空间</div>
                    <div id="storage-disk-info"></div>
                </div>
            `,
        };

        function showSection(name) {
            contentEl.innerHTML = (sections[name] || sections.general)();
            container.querySelectorAll('.settings-nav').forEach(n => {
                n.classList.toggle('active', n.dataset.section === name);
            });
            // Bind theme select after rendering appearance section
            if (name === 'appearance') {
                const themeSelect = contentEl.querySelector('#settings-theme-select');
                if (themeSelect) {
                    themeSelect.value = os.theme;
                    themeSelect.addEventListener('change', () => os.setTheme(themeSelect.value));
                }
                const perfSelect = contentEl.querySelector('#settings-perf-select');
                if (perfSelect) {
                    perfSelect.value = document.documentElement.classList.contains('low-perf') ? 'low' : 'normal';
                    perfSelect.addEventListener('change', () => os.setPerformanceMode(perfSelect.value));
                }
            }
            // Bind apps section
            if (name === 'apps') {
                loadAppsList();
                contentEl.querySelector('#apps-refresh-btn').addEventListener('click', loadAppsList);
                contentEl.querySelector('#apps-create-btn').addEventListener('click', createApp);
            }
            // Bind LLM section
            if (name === 'llm') {
                loadLLMProviders();
                contentEl.querySelector('#llm-add-provider').addEventListener('click', addLLMProvider);
            }
            // Bind storage section
            if (name === 'storage') {
                loadStorageInfo();
            }
            // Bind context section (Eos-Context)
            if (name === 'context') {
                // 从 localStorage 读取当前设置
                const currentSetting = localStorage.getItem('eos_context_enabled');
                const statusEl = contentEl.querySelector('#eos-context-status');
                if (statusEl) {
                    statusEl.textContent = currentSetting === 'false' ? '✗ 已禁用' : '✓ 已启用';
                    statusEl.style.color = currentSetting === 'false' ? 'var(--accent-warm)' : 'var(--accent)';
                }
                const toggleBtn = contentEl.querySelector('#eos-context-toggle');
                if (toggleBtn) {
                    toggleBtn.textContent = currentSetting === 'false' ? '启用' : '禁用';
                    toggleBtn.addEventListener('click', () => {
                        const enabled = currentSetting === 'false';
                        localStorage.setItem('eos_context_enabled', enabled ? 'true' : 'false');
                        // 通过 WebSocket 发送配置到 Agent
                        if (os.agentWs && os.agentWs.readyState === WebSocket.OPEN) {
                            os.agentWs.send(JSON.stringify({
                                type: 'configure',
                                settings: { eos_context_enabled: enabled }
                            }));
                        }
                        alert('设置已保存并应用。');
                        // 刷新显示
                        if (statusEl) {
                            statusEl.textContent = enabled ? '✓ 已启用' : '✗ 已禁用';
                            statusEl.style.color = enabled ? 'var(--accent)' : 'var(--accent-warm)';
                        }
                        if (toggleBtn) {
                            toggleBtn.textContent = enabled ? '禁用' : '启用';
                        }
                    });
                }
            }
        }

        async function loadAppsList() {
            const listEl = contentEl.querySelector('#apps-list');
            try {
                const data = await os.api('GET', '/api/apps');
                const apps = data.apps || [];
                if (apps.length === 0) {
                    listEl.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px;">暂无应用</div>';
                    return;
                }
                listEl.innerHTML = '';
                apps.forEach(app => {
                    const card = document.createElement('div');
                    card.style.cssText = 'padding:12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);display:flex;align-items:center;gap:10px;';
                    const icon = app.icon ? `<img src="${app.icon}" width="20" height="20" style="object-fit:contain;">` : `<span style="font-size:16px;">${app.emoji || '📦'}</span>`;
                    card.innerHTML = `
                        <span style="width:24px;text-align:center;flex-shrink:0;">${icon}</span>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:12px;font-weight:600;color:var(--text-primary);">${escapeHtml(app.title)}</div>
                            <div style="font-size:10px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(app.description || app.id)}</div>
                        </div>
                        <span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">v${escapeHtml(app.version || '1.0')}</span>
                        <span style="font-size:10px;color:${app.author === 'system' ? 'var(--accent)' : 'var(--text-muted)'};">${app.author === 'system' ? '内置' : '自定义'}</span>
                        ${app.author !== 'system' ? `<button class="settings-btn settings-btn-danger" data-app-id="${escapeHtml(app.id)}" style="padding:3px 10px;font-size:10px;">删除</button>` : ''}
                    `;
                    const delBtn = card.querySelector('[data-app-id]');
                    if (delBtn) {
                        delBtn.addEventListener('click', async () => {
                            if (!confirm(`确定删除应用 "${app.title}"？此操作不可恢复。`)) return;
                            await os.api('DELETE', `/api/apps/${app.id}`);
                            loadAppsList();
                            os._loadApps(); // refresh dock
                        });
                    }
                    listEl.appendChild(card);
                });
            } catch (e) {
                listEl.innerHTML = `<div style="padding:12px;color:var(--accent-warm);font-size:12px;">加载失败: ${e.message}</div>`;
            }
        }

        async function createApp() {
            const id = contentEl.querySelector('#apps-new-id').value.trim();
            const title = contentEl.querySelector('#apps-new-title').value.trim();
            const emoji = contentEl.querySelector('#apps-new-emoji').value.trim();
            const description = contentEl.querySelector('#apps-new-desc').value.trim();
            if (!id || !title) { alert('ID 和标题为必填项'); return; }
            try {
                const result = await os.api('POST', '/api/apps', { id, title, emoji, description });
                if (result.error) { alert(result.error); return; }
                contentEl.querySelector('#apps-new-id').value = '';
                contentEl.querySelector('#apps-new-title').value = '';
                contentEl.querySelector('#apps-new-desc').value = '';
                loadAppsList();
                os._loadApps(); // refresh dock
            } catch (e) { alert('创建失败: ' + e.message); }
        }

        function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

        // ── LLM Provider 管理 ──
        let _llmConfig = null;

        async function loadLLMProviders() {
            const listEl = contentEl.querySelector('#llm-providers-list');
            try {
                _llmConfig = await os.llm.getConfig();
                const providers = _llmConfig.providers || [];
                if (providers.length === 0) {
                    listEl.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px;">暂无配置的 Provider，点击下方按钮添加。</div>';
                    return;
                }
                listEl.innerHTML = '';
                providers.forEach((prov, idx) => {
                    const card = document.createElement('div');
                    card.style.cssText = 'padding:12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);';
                    const models = (prov.models || []).map(m => `<span style="background:var(--bg-surface);border:1px solid var(--border);border-radius:3px;padding:1px 6px;font-size:10px;margin:2px;display:inline-block;">${escapeHtml(m.name || m.id)}</span>`).join('');
                    card.innerHTML = `
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                            <span style="font-size:14px;">${prov.type === 'anthropic' ? '🟣' : '🟢'}</span>
                            <div style="flex:1;"><div style="font-size:12px;font-weight:600;color:var(--text-primary);">${escapeHtml(prov.name)}</div><div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">${escapeHtml(prov.type)} · ${escapeHtml(prov.id)}</div></div>
                            <button class="settings-btn" data-edit="${idx}" style="padding:3px 10px;font-size:10px;">编辑</button>
                            <button class="settings-btn settings-btn-danger" data-del="${idx}" style="padding:3px 10px;font-size:10px;">删除</button>
                        </div>
                        <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">模型:</div>
                        <div>${models || '<span style="font-size:10px;color:var(--text-muted);">无模型</span>'}</div>
                    `;
                    card.querySelector(`[data-del="${idx}"]`).addEventListener('click', () => {
                        if (!confirm(`确定删除 Provider "${prov.name}"？`)) return;
                        _llmConfig.providers.splice(idx, 1);
                        saveLLMConfig(_llmConfig);
                    });
                    card.querySelector(`[data-edit="${idx}"]`).addEventListener('click', () => editLLMProvider(idx));
                    listEl.appendChild(card);
                });

                // 更新默认模型下拉
                updateDefaultModelSelects(providers);
            } catch (e) {
                listEl.innerHTML = `<div style="padding:12px;color:var(--accent-warm);font-size:12px;">加载失败: ${e.message}</div>`;
            }
        }

        function updateDefaultModelSelects(providers) {
            const defaultsSection = contentEl.querySelector('#llm-defaults-section');
            if (!defaultsSection) return;
            defaultsSection.style.display = providers.length > 0 ? '' : 'none';

            const allModels = [];
            providers.forEach(p => (p.models || []).forEach(m => allModels.push({ ref: `${p.id}/${m.id}`, name: `${p.name} / ${m.name || m.id}` })));

            ['llm-default-chat', 'llm-default-image'].forEach(selId => {
                const sel = contentEl.querySelector(`#${selId}`);
                if (!sel) return;
                sel.innerHTML = '<option value="">未设置</option>' + allModels.map(m => `<option value="${escapeHtml(m.ref)}">${escapeHtml(m.name)}</option>`).join('');
            });

            const chatSel = contentEl.querySelector('#llm-default-chat');
            const imgSel = contentEl.querySelector('#llm-default-image');
            if (chatSel && _llmConfig.default_chat_model) chatSel.value = _llmConfig.default_chat_model;
            if (imgSel && _llmConfig.default_image_model) imgSel.value = _llmConfig.default_image_model;

            const saveBtn = contentEl.querySelector('#llm-save-defaults');
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    _llmConfig.default_chat_model = chatSel.value;
                    _llmConfig.default_image_model = imgSel.value;
                    await saveLLMConfig(_llmConfig);
                });
            }
        }

        async function saveLLMConfig(config) {
            try {
                await os.llm.updateConfig(config);
                await loadLLMProviders();
            } catch (e) { alert('保存失败: ' + e.message); }
        }

        function addLLMProvider() {
            editLLMProvider(-1);
        }

        function editLLMProvider(idx) {
            const isNew = idx < 0;
            const prov = isNew ? { id: '', name: '', type: 'openai', api_key: '', api_base: '', models: [] } : { ..._llmConfig.providers[idx] };

            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
            overlay.innerHTML = `
                <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:20px;width:480px;max-height:80vh;overflow-y:auto;">
                    <div style="font-family:var(--font-display);font-size:13px;letter-spacing:1px;margin-bottom:16px;">${isNew ? '添加' : '编辑'} Provider</div>
                    <div class="settings-row"><div class="settings-label">名称</div><input class="settings-input" id="ep-name" value="${escapeHtml(prov.name)}" /></div>
                    <div class="settings-row"><div class="settings-label">ID</div><input class="settings-input" id="ep-id" value="${escapeHtml(prov.id)}" placeholder="自动生成" /></div>
                    <div class="settings-row"><div class="settings-label">类型</div><select class="settings-select" id="ep-type"><option value="openai" ${prov.type==='openai'?'selected':''}>OpenAI 兼容</option><option value="anthropic" ${prov.type==='anthropic'?'selected':''}>Anthropic</option></select></div>
                    <div class="settings-row"><div class="settings-label">API Key</div><input class="settings-input" id="ep-key" type="password" value="${escapeHtml(prov.api_key)}" placeholder="sk-..." /></div>
                    <div class="settings-row"><div class="settings-label">API Base</div><input class="settings-input" id="ep-base" value="${escapeHtml(prov.api_base || '')}" placeholder="留空使用默认" /></div>
                    <div style="margin-top:12px;">
                        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">模型列表（每行一个，格式: model_id | 显示名 | 能力(text,vision,image)）</div>
                        <textarea class="settings-input" id="ep-models" rows="5" style="width:100%;resize:vertical;font-family:var(--font-mono);font-size:11px;">${(prov.models||[]).map(m => `${m.id}|${m.name||m.id}|${(m.capabilities||['text']).join(',')}`).join('\n')}</textarea>
                    </div>
                    <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">
                        <button class="settings-btn" id="ep-cancel">取消</button>
                        <button class="settings-btn" id="ep-save">保存</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector('#ep-cancel').addEventListener('click', () => overlay.remove());
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

            overlay.querySelector('#ep-save').addEventListener('click', () => {
                const name = overlay.querySelector('#ep-name').value.trim();
                let id = overlay.querySelector('#ep-id').value.trim();
                const type = overlay.querySelector('#ep-type').value;
                const api_key = overlay.querySelector('#ep-key').value.trim();
                const api_base = overlay.querySelector('#ep-base').value.trim();
                const modelsText = overlay.querySelector('#ep-models').value.trim();

                if (!name) { alert('名称为必填项'); return; }
                if (!id) id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

                const models = modelsText.split('\n').filter(l => l.trim()).map(line => {
                    const parts = line.split('|').map(s => s.trim());
                    return {
                        id: parts[0],
                        name: parts[1] || parts[0],
                        capabilities: (parts[2] || 'text').split(',').map(s => s.trim()),
                    };
                });

                const updated = { id, name, type, api_key, api_base, models };
                if (!_llmConfig) _llmConfig = { providers: [], default_chat_model: '', default_image_model: '' };
                if (isNew) {
                    _llmConfig.providers.push(updated);
                } else {
                    _llmConfig.providers[idx] = updated;
                }
                overlay.remove();
                saveLLMConfig(_llmConfig);
            });
        }

        // ── 存储空间管理 ──

        function formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
        }

        const STORAGE_COLORS = [
            'var(--accent)',
            '#6c5ce7',
            '#ff6b6b',
            '#40c060',
            '#fdcb6e',
            '#e17055',
            '#00cec9',
            '#a29bfe',
        ];

        async function loadStorageInfo() {
            const loadingEl = contentEl.querySelector('#storage-loading');
            const contentElInner = contentEl.querySelector('#storage-content');
            const dirInfoEl = contentEl.querySelector('#storage-dir-info');
            const diskInfoEl = contentEl.querySelector('#storage-disk-info');
            const changeBtn = contentEl.querySelector('#storage-change-btn');
            const resetBtn = contentEl.querySelector('#storage-reset-btn');
            const migrateMsg = contentEl.querySelector('#storage-migrate-msg');

            try {
                const [usage, config] = await Promise.all([
                    os.api('GET', '/api/storage/usage'),
                    os.api('GET', '/api/storage/config'),
                ]);

                // ── 渲染使用量 breakdown ──
                loadingEl.style.display = 'none';
                contentElInner.style.display = '';

                const total = usage.total || 0;
                const breakdown = usage.breakdown || [];

                let html = '';

                // 总量概览
                html += `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:16px;">
                    <span style="font-size:28px;font-weight:700;font-family:var(--font-display);color:var(--accent);">${escapeHtml(usage.formatted_total)}</span>
                    <span style="font-size:11px;color:var(--text-muted);">已使用</span>
                </div>`;

                // 可视化条形图
                if (total > 0 && breakdown.length > 0) {
                    html += `<div style="height:8px;border-radius:4px;background:var(--bg-deep);overflow:hidden;display:flex;margin-bottom:20px;">`;
                    breakdown.forEach((item, i) => {
                        const pct = (item.size / total * 100);
                        if (pct > 0.5) {
                            const color = STORAGE_COLORS[i % STORAGE_COLORS.length];
                            html += `<div style="width:${pct}%;background:${color};transition:width 0.3s;" title="${escapeHtml(item.name)}: ${escapeHtml(item.formatted_size)}"></div>`;
                        }
                    });
                    html += `</div>`;
                }

                // 各子目录详情
                if (breakdown.length > 0) {
                    html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
                    breakdown.forEach((item, i) => {
                        const pct = total > 0 ? (item.size / total * 100).toFixed(1) : '0';
                        const color = STORAGE_COLORS[i % STORAGE_COLORS.length];
                        const icon = item.name === 'aether-cards' ? '🃏' :
                                     item.name === 'agent' ? '🤖' :
                                     item.name === 'data' ? '💾' :
                                     item.name === 'llm' ? '🧠' :
                                     item.name === 'images' ? '🖼️' :
                                     item.name.endsWith('.db') ? '📀' :
                                     item.name.endsWith('.json') ? '📄' : '📁';
                        html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-sm);background:var(--bg-elevated);border:1px solid var(--border);">
                            <span style="font-size:16px;width:24px;text-align:center;">${icon}</span>
                            <div style="flex:1;min-width:0;">
                                <div style="display:flex;justify-content:space-between;align-items:center;">
                                    <span style="font-size:12px;font-weight:600;color:var(--text-primary);font-family:var(--font-mono);">${escapeHtml(item.name)}</span>
                                    <span style="font-size:12px;color:var(--text-secondary);font-family:var(--font-mono);">${escapeHtml(item.formatted_size)}</span>
                                </div>
                                <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                                    <div style="flex:1;height:3px;border-radius:2px;background:var(--bg-deep);overflow:hidden;">
                                        <div style="width:${pct}%;height:100%;background:${color};border-radius:2px;"></div>
                                    </div>
                                    <span style="font-size:10px;color:var(--text-muted);min-width:36px;text-align:right;">${pct}%</span>
                                </div>
                            </div>
                            <span style="font-size:10px;color:var(--text-muted);">${item.file_count} 文件</span>
                        </div>`;
                    });
                    html += `</div>`;
                } else {
                    html += `<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:12px;">数据目录为空</div>`;
                }

                contentElInner.innerHTML = html;

                // ── 数据目录信息 ──
                dirInfoEl.innerHTML = `
                    <div style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);">
                        <span style="font-size:14px;">📂</span>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:12px;font-family:var(--font-mono);color:var(--text-primary);word-break:break-all;">${escapeHtml(config.current_dir)}</div>
                            <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${config.is_custom ? '自定义目录（需重启生效）' : '默认目录'}</div>
                        </div>
                    </div>
                `;

                if (config.is_custom) {
                    resetBtn.style.display = '';
                }

                // ── 磁盘空间 ──
                const diskUsed = (usage.disk_total || 0) - (usage.disk_free || 0);
                const diskPct = usage.disk_total > 0 ? (diskUsed / usage.disk_total * 100).toFixed(1) : '0';
                diskInfoEl.innerHTML = `
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;">
                        <span style="color:var(--text-secondary);">系统磁盘</span>
                        <span style="color:var(--text-muted);font-family:var(--font-mono);">${escapeHtml(usage.formatted_disk_free || '0 B')} 可用 / ${escapeHtml(usage.formatted_disk_total || '0 B')} 总计</span>
                    </div>
                    <div style="height:6px;border-radius:3px;background:var(--bg-deep);overflow:hidden;">
                        <div style="width:${diskPct}%;height:100%;background:${parseFloat(diskPct) > 90 ? 'var(--accent-warm)' : 'var(--accent)'};border-radius:3px;transition:width 0.3s;"></div>
                    </div>
                `;

                // ── 绑定按钮事件 ──
                changeBtn.addEventListener('click', () => showMigrateDialog(config));
                resetBtn.addEventListener('click', async () => {
                    if (!confirm('确定恢复为默认数据目录？\n\n此操作将取消自定义目录映射，需要重启服务器生效。数据不会被删除。')) return;
                    try {
                        const res = await os.api('POST', '/api/storage/reset-path');
                        if (res.error) { alert(res.error); return; }
                        migrateMsg.style.display = '';
                        migrateMsg.style.color = 'var(--accent)';
                        migrateMsg.textContent = res.message;
                    } catch (e) { alert('操作失败: ' + e.message); }
                });

            } catch (e) {
                loadingEl.innerHTML = `<div style="color:var(--accent-warm);">加载失败: ${escapeHtml(e.message)}</div>`;
            }
        }

        function showMigrateDialog(config) {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
            overlay.innerHTML = `
                <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:24px;width:520px;">
                    <div style="font-family:var(--font-display);font-size:13px;letter-spacing:1px;margin-bottom:16px;">更改数据目录</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px;line-height:1.6;">
                        当前目录: <code style="color:var(--text-primary);background:var(--bg-deep);padding:1px 4px;border-radius:2px;">${escapeHtml(config.current_dir)}</code><br>
                        将所有数据复制到新目录，然后重启服务器生效。原目录数据不会被删除。
                    </div>
                    <div style="margin-bottom:16px;">
                        <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:6px;">新目录路径</label>
                        <div style="display:flex;gap:8px;">
                            <input class="settings-input" id="migrate-path" placeholder="/path/to/new/data/dir" style="flex:1;" />
                            <button class="settings-btn" id="migrate-browse" style="flex-shrink:0;">选择</button>
                        </div>
                    </div>
                    <div id="migrate-status" style="font-size:11px;margin-bottom:12px;display:none;padding:8px;border-radius:var(--radius-sm);"></div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                        <button class="settings-btn" id="migrate-cancel">取消</button>
                        <button class="settings-btn" id="migrate-confirm">开始迁移</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const pathInput = overlay.querySelector('#migrate-path');
            const statusEl = overlay.querySelector('#migrate-status');
            const confirmBtn = overlay.querySelector('#migrate-confirm');

            overlay.querySelector('#migrate-cancel').addEventListener('click', () => overlay.remove());
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

            // 文件夹选择（使用 input[type=file] webkitdirectory hack）
            overlay.querySelector('#migrate-browse').addEventListener('click', () => {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.webkitdirectory = true;
                fileInput.style.display = 'none';
                fileInput.addEventListener('change', () => {
                    if (fileInput.files.length > 0) {
                        // 从第一个文件的路径提取目录
                        const fullPath = fileInput.files[0].webkitRelativePath;
                        const dirName = fullPath.split('/')[0];
                        // 提示用户手动输入完整路径
                        pathInput.value = dirName;
                        pathInput.focus();
                        statusEl.style.display = '';
                        statusEl.style.background = 'rgba(0,229,255,0.05)';
                        statusEl.style.color = 'var(--text-muted)';
                        statusEl.textContent = '浏览器无法直接获取完整路径，请手动输入目标目录的绝对路径。';
                    }
                    fileInput.remove();
                });
                document.body.appendChild(fileInput);
                fileInput.click();
            });

            confirmBtn.addEventListener('click', async () => {
                const targetDir = pathInput.value.trim();
                if (!targetDir) {
                    statusEl.style.display = '';
                    statusEl.style.background = 'rgba(255,107,107,0.05)';
                    statusEl.style.color = 'var(--accent-warm)';
                    statusEl.textContent = '请输入目标目录路径';
                    return;
                }

                confirmBtn.disabled = true;
                confirmBtn.textContent = '迁移中...';
                statusEl.style.display = '';
                statusEl.style.background = 'rgba(0,229,255,0.05)';
                statusEl.style.color = 'var(--accent)';
                statusEl.textContent = '正在复制数据，请稍候...';

                try {
                    const res = await os.api('POST', '/api/storage/migrate', { target_dir: targetDir });
                    if (res.error) {
                        statusEl.style.background = 'rgba(255,107,107,0.05)';
                        statusEl.style.color = 'var(--accent-warm)';
                        statusEl.textContent = res.error;
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = '开始迁移';
                        return;
                    }
                    statusEl.style.background = 'rgba(64,192,96,0.08)';
                    statusEl.style.color = '#40c060';
                    statusEl.textContent = res.message;
                    confirmBtn.textContent = '完成';
                    confirmBtn.disabled = false;
                    confirmBtn.addEventListener('click', () => overlay.remove(), { once: true });
                } catch (e) {
                    statusEl.style.background = 'rgba(255,107,107,0.05)';
                    statusEl.style.color = 'var(--accent-warm)';
                    statusEl.textContent = '迁移失败: ' + e.message;
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = '开始迁移';
                }
            });
        }

        container.querySelectorAll('.settings-nav').forEach(nav => {
            nav.addEventListener('click', () => showSection(nav.dataset.section));
        });

        showSection('general');
    }
});
