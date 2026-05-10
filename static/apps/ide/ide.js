/* ═══════════════════════════════════════════════════════
   N.O.V.A AETHER OS — IDE Application
   Monaco Editor + File Tree + Resizable Panel + Run
   ═══════════════════════════════════════════════════════ */

registerApp('ide', {
    title: 'IDE',
    icon: '📝',
    factory: (container, win, os) => {
        const runSVG = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 2L11.5 7L3.5 12V2Z" fill="currentColor"/></svg>`;
        const panelToggleSVG = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 7L8 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        const sidebarToggleSVG = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.1" fill="none"/><path d="M5.5 2V12" stroke="currentColor" stroke-width="1.1"/></svg>`;

        container.innerHTML = `
            <div style="display:flex;height:100%;background:var(--bg-surface);">
                <!-- Sidebar: file tree -->
                <div id="ide-sidebar" style="width:220px;border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;transition:width 0.2s var(--ease-out),opacity 0.15s;overflow:hidden;">
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border);flex-shrink:0;">
                        <span style="font-family:var(--font-display);font-size:10px;letter-spacing:2px;color:var(--text-muted);">EXPLORER</span>
                    </div>
                    <div id="ide-tree" style="flex:1;overflow-y:auto;padding:4px;"></div>
                </div>
                <!-- Main area -->
                <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
                    <!-- Tabs + actions -->
                    <div style="display:flex;align-items:center;background:var(--bg-elevated);border-bottom:1px solid var(--border);flex-shrink:0;">
                        <div id="ide-tabs" style="display:flex;flex:1;overflow-x:auto;min-height:34px;"></div>
                        <div style="display:flex;align-items:center;gap:4px;padding:0 8px;flex-shrink:0;">
                            <button id="ide-sidebar-toggle" class="ide-icon-btn" title="切换 Explorer 侧栏">${sidebarToggleSVG}</button>
                            <button id="ide-run-btn" class="ide-icon-btn ide-run-btn" title="运行当前文件">${runSVG}</button>
                            <button id="ide-panel-toggle" class="ide-icon-btn" title="切换底部面板">${panelToggleSVG}</button>
                        </div>
                    </div>
                    <!-- Editor + Panel -->
                    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
                        <div id="ide-editor" style="flex:1;overflow:hidden;position:relative;"></div>
                        <!-- Resize handle -->
                        <div id="ide-panel-resize" style="height:5px;cursor:ns-resize;flex-shrink:0;position:relative;">
                            <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:32px;height:3px;border-radius:2px;background:var(--border);"></div>
                        </div>
                        <!-- Bottom panel -->
                        <div id="ide-panel" style="height:180px;display:flex;flex-direction:column;flex-shrink:0;overflow:hidden;">
                            <div style="display:flex;gap:0;border-bottom:1px solid var(--border);flex-shrink:0;">
                                <button class="ide-panel-tab active" data-panel="problems">问题</button>
                                <button class="ide-panel-tab" data-panel="output">输出</button>
                                <button class="ide-panel-tab" data-panel="terminal">终端</button>
                                <button class="ide-panel-tab" data-panel="debug">调试</button>
                            </div>
                            <div id="ide-panel-content" style="flex:1;overflow-y:auto;padding:8px;font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);"></div>
                        </div>
                    </div>
                    <!-- Status bar -->
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:3px 12px;border-top:1px solid var(--border);background:var(--bg-elevated);font-size:10.5px;color:var(--text-muted);font-family:var(--font-mono);flex-shrink:0;">
                        <div style="display:flex;gap:16px;">
                            <span id="ide-cursor-pos">行 1, 列 1</span>
                            <span id="ide-lang">Plain Text</span>
                        </div>
                        <div style="display:flex;gap:16px;">
                            <span>UTF-8</span>
                            <span id="ide-lsp-status">LSP: <svg width="8" height="8" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;"><circle cx="6" cy="6" r="4.5" stroke="var(--text-muted)" stroke-width="1" fill="none"/></svg></span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .ide-panel-tab{padding:5px 14px;font-size:11px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-family:var(--font-mono);border-bottom:2px solid transparent;transition:all 0.15s;}
            .ide-panel-tab:hover{color:var(--text-secondary);}
            .ide-panel-tab.active{color:var(--accent);border-bottom-color:var(--accent);}
            .ide-tab{display:flex;align-items:center;gap:6px;padding:6px 14px;font-size:11.5px;color:var(--text-muted);cursor:pointer;border-right:1px solid var(--border);white-space:nowrap;transition:all 0.1s;font-family:var(--font-mono);}
            .ide-tab:hover{background:var(--bg-hover);color:var(--text-secondary);}
            .ide-tab.active{background:var(--bg-surface);color:var(--text-primary);border-bottom:2px solid var(--accent);}
            .ide-tab .tab-close{font-size:10px;opacity:0;cursor:pointer;padding:2px;border-radius:3px;}
            .ide-tab:hover .tab-close{opacity:0.6;}
            .ide-tab .tab-close:hover{opacity:1;background:rgba(255,107,107,0.15);color:var(--accent-warm);}
            .ide-tree-item{display:flex;align-items:center;gap:6px;padding:3px 8px;font-size:11px;color:var(--text-secondary);cursor:pointer;border-radius:var(--radius-sm);transition:all 0.1s;}
            .ide-tree-item:hover{background:var(--bg-hover);color:var(--text-primary);}
            .ide-tree-item.active{background:var(--accent-glow);color:var(--accent);}
            .ide-icon-btn{background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px 6px;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;transition:all 0.15s;}
            .ide-icon-btn:hover{color:var(--text-primary);background:var(--bg-hover);}
            .ide-run-btn{color:var(--accent);}
            .ide-run-btn:hover{background:var(--accent-glow);color:var(--accent-bright);}
            .ide-run-btn.running{animation:run-pulse 1s ease-in-out infinite;}
            @keyframes run-pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
            #ide-panel-resize:hover div{background:var(--accent-dim);}
            #ide-sidebar.collapsed{width:0!important;border-right-color:transparent;}
        `;
        container.appendChild(style);

        const tabsEl = container.querySelector('#ide-tabs');
        const editorEl = container.querySelector('#ide-editor');
        const treeEl = container.querySelector('#ide-tree');
        const panelContent = container.querySelector('#ide-panel-content');
        const cursorPosEl = container.querySelector('#ide-cursor-pos');
        const langEl = container.querySelector('#ide-lang');
        const sidebar = container.querySelector('#ide-sidebar');
        const sidebarToggle = container.querySelector('#ide-sidebar-toggle');
        const panelEl = container.querySelector('#ide-panel');
        const panelResize = container.querySelector('#ide-panel-resize');
        const panelToggle = container.querySelector('#ide-panel-toggle');
        const runBtn = container.querySelector('#ide-run-btn');

        let monacoEditor = null;
        let openTabs = [];
        let activeTab = null;
        let sidebarCollapsed = false;
        let panelVisible = true;

        // ── Sidebar toggle ──
        sidebarToggle.addEventListener('click', () => {
            sidebarCollapsed = !sidebarCollapsed;
            sidebar.classList.toggle('collapsed', sidebarCollapsed);
        });

        // ── Panel toggle ──
        panelToggle.addEventListener('click', () => {
            panelVisible = !panelVisible;
            panelEl.style.display = panelVisible ? '' : 'none';
            panelResize.style.display = panelVisible ? '' : 'none';
        });

        // ── Panel resize ──
        let resizingPanel = false, resizeStartY, resizeStartH;
        panelResize.addEventListener('mousedown', e => {
            resizingPanel = true;
            resizeStartY = e.clientY;
            resizeStartH = panelEl.offsetHeight;
            e.preventDefault();
        });
        document.addEventListener('mousemove', e => {
            if (!resizingPanel) return;
            const dy = resizeStartY - e.clientY;
            panelEl.style.height = Math.max(60, Math.min(500, resizeStartH + dy)) + 'px';
        });
        document.addEventListener('mouseup', () => { resizingPanel = false; });

        // ── Run button ──
        const runCommands = {
            python: 'python3', py: 'python3', javascript: 'node', js: 'node',
            typescript: 'npx tsx', ts: 'npx tsx', shell: 'bash', sh: 'bash',
            rust: 'cargo run', rs: 'cargo run', go: 'go run', go: 'go run',
            java: 'javac', c: 'gcc -o /tmp/a.out && /tmp/a.out',
            cpp: 'g++ -o /tmp/a.out && /tmp/a.out',
        };

        runBtn.addEventListener('click', async () => {
            if (!activeTab) return;
            const ext = activeTab.name.split('.').pop().toLowerCase();
            const cmd = runCommands[ext];
            if (!cmd) {
                panelContent.innerHTML = `<div style="color:var(--accent-warm);">不支持运行 .${ext} 文件</div>`;
                panelVisible = true;
                panelEl.style.display = '';
                panelResize.style.display = '';
                return;
            }
            const filePath = activeTab.path;
            const fullCmd = `${cmd} ${filePath}`;

            // Show in output panel
            container.querySelectorAll('.ide-panel-tab').forEach(t => t.classList.remove('active'));
            container.querySelector('[data-panel="output"]').classList.add('active');
            panelContent.innerHTML = `<div style="color:var(--accent);">$ ${escapeHtml(fullCmd)}</div><div style="color:var(--text-muted);margin-top:8px;">运行中...</div>`;
            panelVisible = true;
            panelEl.style.display = '';
            panelResize.style.display = '';
            runBtn.classList.add('running');

            try {
                const result = await os.api('POST', '/api/exec', { command: fullCmd });
                let output = '';
                if (result.stdout) output += `<div style="white-space:pre-wrap;">${escapeHtml(result.stdout)}</div>`;
                if (result.stderr) output += `<div style="color:var(--accent-warm);white-space:pre-wrap;">${escapeHtml(result.stderr)}</div>`;
                if (result.error) output += `<div style="color:var(--accent-warm);">错误: ${escapeHtml(result.error)}</div>`;
                if (!output) output = '<div style="color:var(--text-muted);">（无输出）</div>';
                const exitCode = result.exit_code != null ? `<div style="margin-top:8px;color:${result.exit_code === 0 ? 'var(--accent)' : 'var(--accent-warm)'};">退出码: ${result.exit_code}</div>` : '';
                panelContent.innerHTML = `<div style="color:var(--accent);">$ ${escapeHtml(fullCmd)}</div>${output}${exitCode}`;
            } catch (e) {
                panelContent.innerHTML = `<div style="color:var(--accent);">$ ${escapeHtml(fullCmd)}</div><div style="color:var(--accent-warm);margin-top:8px;">执行失败: ${e.message}</div>`;
            }
            runBtn.classList.remove('running');
        });

        // Register file-open listener BEFORE async Monaco load
        win.on('open-file', ({ path }) => {
            if (monacoEditor) {
                openFile(path);
            } else {
                const check = setInterval(() => {
                    if (monacoEditor) { clearInterval(check); openFile(path); }
                }, 200);
            }
        });

        // ── Load Monaco Editor ──

        async function loadMonaco() {
            return new Promise((resolve, reject) => {
                if (window.monaco) { resolve(window.monaco); return; }
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs/loader.min.js';
                script.onload = () => {
                    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs' } });
                    require(['vs/editor/editor.main'], () => resolve(window.monaco));
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        async function initEditor() {
            try {
                const monaco = await loadMonaco();
                monacoEditor = monaco.editor.create(editorEl, {
                    value: '', language: 'plaintext', theme: 'vs-dark',
                    fontFamily: "'JetBrains Mono', 'Noto Sans SC', monospace",
                    fontSize: 13, lineHeight: 22,
                    minimap: { enabled: true, scale: 1 },
                    scrollBeyondLastLine: false, renderWhitespace: 'selection',
                    bracketPairColorization: { enabled: true },
                    smoothScrolling: true, cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on', padding: { top: 12 },
                    automaticLayout: true,
                });
                monacoEditor.onDidChangeCursorPosition(e => {
                    cursorPosEl.textContent = `行 ${e.position.lineNumber}, 列 ${e.position.column}`;
                });
                loadTree('');
                panelContent.innerHTML = `<div style="color:var(--accent);display:flex;align-items:center;gap:6px;">${SVG.chevronRight(10, 'var(--accent)')} IDE 已就绪。打开文件开始编辑。</div>`;
            } catch (e) {
                editorEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;">
                    <div style="color:var(--text-secondary);">Monaco Editor 加载中...</div>
                    <div style="font-size:11px;color:var(--text-muted);">${e.message}</div></div>`;
            }
        }

        // ── File tree ──

        async function loadTree(path) {
            try {
                const data = await os.api('GET', `/api/fs/list?path=${encodeURIComponent(path)}`);
                if (data.error) { treeEl.innerHTML = `<div style="padding:8px;color:var(--accent-warm);font-size:11px;">${data.error}</div>`; return; }
                treeEl.innerHTML = '';
                renderTreeItems(treeEl, data.items || [], data.path || '', 0);
            } catch (e) {
                treeEl.innerHTML = `<div style="padding:8px;color:var(--text-muted);font-size:11px;">无法连接后端</div>`;
            }
        }

        function renderTreeItems(parent, items, basePath, depth) {
            items.forEach(item => {
                const el = document.createElement('div');
                el.className = 'ide-tree-item';
                el.style.paddingLeft = (8 + depth * 16) + 'px';
                const icon = item.is_dir ? '📁' : getFileIcon(item.name);
                el.innerHTML = `<span>${icon}</span><span>${escapeHtml(item.name)}</span>`;
                if (item.is_dir) {
                    el.addEventListener('click', async () => {
                        const childContainer = parent.querySelector(`[data-dir="${basePath + '/' + item.name}"]`);
                        if (childContainer) { childContainer.style.display = childContainer.style.display === 'none' ? '' : 'none'; return; }
                        const sub = document.createElement('div');
                        sub.dataset.dir = basePath + '/' + item.name;
                        try {
                            const data = await os.api('GET', `/api/fs/list?path=${encodeURIComponent(basePath + '/' + item.name)}`);
                            if (data.items) renderTreeItems(sub, data.items, basePath + '/' + item.name, depth + 1);
                        } catch (e) { /* ignore */ }
                        el.after(sub);
                    });
                } else {
                    el.addEventListener('click', () => openFile(basePath + '/' + item.name));
                }
                parent.appendChild(el);
            });
        }

        // ── Tabs & file editing ──

        async function openFile(path) {
            if (!window.monaco || !monacoEditor) return;
            const existing = openTabs.find(t => t.path === path);
            if (existing) { activateTab(existing); return; }
            try {
                const data = await os.api('GET', `/api/fs/read?path=${encodeURIComponent(path)}`);
                if (data.error) { panelContent.innerHTML = `<div style="color:var(--accent-warm);">错误: ${data.error}</div>`; return; }
                const name = path.split('/').pop();
                const lang = getLang(name);
                const model = window.monaco.editor.createModel(data.content || '', lang);
                const tabEl = document.createElement('div');
                tabEl.className = 'ide-tab';
                tabEl.innerHTML = `<span>${getFileIcon(name)}</span><span>${escapeHtml(name)}</span><span class="tab-close"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></span>`;
                const tab = { path, name, model, tabEl };
                openTabs.push(tab);
                tabEl.querySelector('.tab-close').addEventListener('click', e => { e.stopPropagation(); closeTab(tab); });
                tabEl.addEventListener('click', () => activateTab(tab));
                tabsEl.appendChild(tabEl);
                activateTab(tab);
                langEl.textContent = lang;
            } catch (e) {
                panelContent.innerHTML = `<div style="color:var(--accent-warm);">读取失败: ${e.message}</div>`;
            }
        }

        function activateTab(tab) {
            openTabs.forEach(t => t.tabEl.classList.remove('active'));
            tab.tabEl.classList.add('active');
            monacoEditor.setModel(tab.model);
            activeTab = tab;
            langEl.textContent = getLang(tab.name);
            tab.model.onDidChangeContent(() => {
                clearTimeout(tab._saveTimer);
                tab._saveTimer = setTimeout(() => {
                    os.api('PUT', '/api/fs/write', { path: tab.path, content: tab.model.getValue() });
                }, 1000);
            });
        }

        function closeTab(tab) {
            const idx = openTabs.indexOf(tab);
            if (idx === -1) return;
            openTabs.splice(idx, 1);
            tab.tabEl.remove();
            tab.model.dispose();
            if (activeTab === tab) {
                if (openTabs.length > 0) activateTab(openTabs[Math.min(idx, openTabs.length - 1)]);
                else { monacoEditor.setModel(null); activeTab = null; }
            }
        }

        function getLang(name) {
            const ext = name.split('.').pop().toLowerCase();
            const map = { py:'python',js:'javascript',ts:'typescript',tsx:'typescript',jsx:'javascript',html:'html',css:'css',json:'json',md:'markdown',yaml:'yaml',yml:'yaml',sh:'shell',rs:'rust',go:'go',java:'java',c:'c',cpp:'cpp',h:'c',hpp:'cpp',sql:'sql',xml:'xml',toml:'toml' };
            return map[ext] || 'plaintext';
        }

        function getFileIcon(name) {
            const ext = name.split('.').pop().toLowerCase();
            const icons = { py:'🐍',js:'📜',ts:'📘',html:'🌐',css:'🎨',json:'📋',md:'📝',txt:'📄',yaml:'⚙️',yml:'⚙️',sh:'🔧',rs:'🦀' };
            return icons[ext] || '📄';
        }

        function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

        // Panel tabs
        container.querySelectorAll('.ide-panel-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('.ide-panel-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const panel = tab.dataset.panel;
                if (panel === 'problems') panelContent.innerHTML = '<div style="color:var(--text-muted);">暂无问题</div>';
                else if (panel === 'output') panelContent.innerHTML = '<div style="color:var(--text-muted);">暂无输出</div>';
                else if (panel === 'terminal') panelContent.innerHTML = '<div style="color:var(--text-muted);">终端面板（集成终端模块）</div>';
                else if (panel === 'debug') panelContent.innerHTML = '<div style="color:var(--text-muted);">调试面板</div>';
            });
        });

        initEditor();
    }
});
