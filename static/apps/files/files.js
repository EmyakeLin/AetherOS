/* ═══════════════════════════════════════════════════════
   N.O.V.A AETHER OS — File Manager App
   List/Icon view toggle, hidden files filter, SVG icons
   ═══════════════════════════════════════════════════════ */

registerApp('files', {
    title: '文件管理器',
    icon: '📁',
    factory: (container, win, os) => {
        let currentPath = '';
        let viewMode = 'list'; // 'list' | 'icon'
        let showHidden = false;
        let allItems = []; // cached raw items from API

        const SVG_ICONS = {
            back: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 2L4 6L8 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            up: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 8L6 4L10 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            refresh: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 7A4.5 4.5 0 1 1 7 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M7 0.5L9.5 2.5L7 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            list: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 3.5H12M4 7H12M4 10.5H12M1.5 3.5H1.51M1.5 7H1.51M1.5 10.5H1.51" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
            grid: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="1.5" width="4" height="4" rx="0.8" stroke="currentColor" stroke-width="1.1"/><rect x="8.5" y="1.5" width="4" height="4" rx="0.8" stroke="currentColor" stroke-width="1.1"/><rect x="1.5" y="8.5" width="4" height="4" rx="0.8" stroke="currentColor" stroke-width="1.1"/><rect x="8.5" y="8.5" width="4" height="4" rx="0.8" stroke="currentColor" stroke-width="1.1"/></svg>`,
            eyeOff: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L13 13" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><path d="M5.2 5.2C4.8 5.7 4.5 6.3 4.5 7C4.5 8.9 6.1 10.5 8 10.5C8.4 10.5 8.7 10.4 9 10.3M11.5 11C10.4 11.8 9.2 12.2 8 12.2C4.7 12.2 2 9.5 2 7C2 5.8 2.6 4.6 3.5 3.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`,
            eye: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 7C1 7 3 3 7 3C11 3 13 7 13 7C13 7 11 11 7 11C3 11 1 7 1 7Z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.1"/></svg>`,
            folder: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4C2 3.45 2.45 3 3 3H6L7.5 5H13C13.55 5 14 5.45 14 6V12C14 12.55 13.55 13 13 13H3C2.45 13 2 12.55 2 12V4Z" fill="var(--accent)" opacity="0.7"/></svg>`,
            file: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2H10L13 5V14H4V2Z" stroke="var(--text-muted)" stroke-width="1" fill="none"/><path d="M10 2V5H13" stroke="var(--text-muted)" stroke-width="1"/></svg>`,
            folderOpen: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 5C2 4.45 2.45 4 3 4H6L7.5 6H13C13.55 6 14 6.45 14 7L13 13H3C2.45 13 2 12.55 2 12V5Z" fill="var(--accent)" opacity="0.5"/><path d="M1 13L3 7H13L13 13H1Z" fill="var(--accent)" opacity="0.7"/></svg>`,
            search: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.2"/><path d="M9.5 9.5L12.5 12.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
            newFolder: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 3.5C1.5 2.95 1.95 2.5 2.5 2.5H5L6.5 4.5H11.5C12.05 4.5 12.5 4.95 12.5 5.5V10.5C12.5 11.05 12.05 11.5 11.5 11.5H2.5C1.95 11.5 1.5 11.05 1.5 10.5V3.5Z" stroke="currentColor" stroke-width="1"/><path d="M7 7V10M5.5 8.5H8.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
        };

        const fileIcons = {
            py: '🐍', js: '📜', ts: '📘', html: '🌐', css: '🎨',
            json: '📋', md: '📝', txt: '📄', yaml: '⚙️', yml: '⚙️',
            sh: '🔧', rs: '🦀', go: '🔵', java: '☕', c: '©️',
            cpp: '➕', h: '📎', jpg: '🖼', png: '🖼', svg: '🖼',
            pdf: '📕', zip: '📦', tar: '📦',
        };

        container.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;background:var(--bg-surface);">
                <!-- Toolbar -->
                <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--border);flex-shrink:0;">
                    <button class="fm-btn" id="fm-back" title="返回">${SVG_ICONS.back}</button>
                    <button class="fm-btn" id="fm-up" title="上级目录">${SVG_ICONS.up}</button>
                    <button class="fm-btn" id="fm-refresh" title="刷新">${SVG_ICONS.refresh}</button>
                    <div class="fm-breadcrumb" id="fm-breadcrumb" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);padding:4px 8px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border);"></div>
                    <button class="fm-btn" id="fm-new-folder" title="新建文件夹">${SVG_ICONS.newFolder}</button>
                    <button class="fm-btn" id="fm-search" title="搜索">${SVG_ICONS.search}</button>
                    <div class="fm-separator"></div>
                    <button class="fm-btn fm-view-btn active" id="fm-view-list" title="列表视图">${SVG_ICONS.list}</button>
                    <button class="fm-btn fm-view-btn" id="fm-view-grid" title="图标视图">${SVG_ICONS.grid}</button>
                    <button class="fm-btn" id="fm-toggle-hidden" title="显示/隐藏隐藏文件">${SVG_ICONS.eyeOff}</button>
                </div>
                <!-- Content -->
                <div style="display:flex;flex:1;overflow:hidden;">
                    <!-- Tree sidebar -->
                    <div id="fm-tree" style="width:200px;border-right:1px solid var(--border);overflow-y:auto;padding:8px;font-size:12px;flex-shrink:0;"></div>
                    <!-- File list -->
                    <div id="fm-list" style="flex:1;overflow-y:auto;padding:4px;"></div>
                </div>
                <!-- Status bar -->
                <div id="fm-status" style="padding:4px 12px;border-top:1px solid var(--border);font-size:10.5px;color:var(--text-muted);font-family:var(--font-mono);display:flex;justify-content:space-between;flex-shrink:0;"></div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .fm-btn{background:none;border:1px solid var(--border);color:var(--text-secondary);padding:4px 10px;border-radius:var(--radius-sm);cursor:pointer;font-size:12px;transition:all 0.15s;display:flex;align-items:center;justify-content:center;}
            .fm-btn:hover{color:var(--accent);border-color:var(--accent-dim);background:var(--accent-glow);}
            .fm-btn.active{color:var(--accent);background:var(--accent-glow);border-color:var(--accent-dim);}
            .fm-separator{width:1px;height:20px;background:var(--border);margin:0 4px;}
            .fm-item{display:flex;align-items:center;gap:10px;padding:6px 12px;border-radius:var(--radius-sm);cursor:pointer;transition:all 0.1s;font-size:12px;}
            .fm-item:hover{background:var(--bg-hover);}
            .fm-item.selected{background:var(--accent-glow);border:1px solid var(--accent-dim);}
            .fm-item-icon{width:20px;text-align:center;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
            .fm-item-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-primary);}
            .fm-item-meta{font-size:10px;color:var(--text-muted);font-family:var(--font-mono);white-space:nowrap;}
            .fm-tree-item{padding:3px 8px;cursor:pointer;border-radius:var(--radius-sm);font-size:11px;color:var(--text-secondary);transition:all 0.1s;display:flex;align-items:center;gap:6px;}
            .fm-tree-item:hover{background:var(--bg-hover);color:var(--text-primary);}
            .fm-tree-item.active{color:var(--accent);background:var(--accent-glow);}
            /* Icon view */
            .fm-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(90px, 1fr));gap:8px;padding:8px;}
            .fm-grid-item{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;border-radius:var(--radius-md);cursor:pointer;transition:all 0.15s;text-align:center;}
            .fm-grid-item:hover{background:var(--bg-hover);}
            .fm-grid-item.selected{background:var(--accent-glow);border:1px solid var(--accent-dim);}
            .fm-grid-item-icon{width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:28px;}
            .fm-grid-item-name{font-size:11px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;max-width:80px;}
            [data-theme="light"] .fm-grid-item-icon svg path[stroke="var(--text-muted)"]{stroke:#8a7e72;}
        `;
        container.appendChild(style);

        const list = container.querySelector('#fm-list');
        const tree = container.querySelector('#fm-tree');
        const breadcrumb = container.querySelector('#fm-breadcrumb');
        const status = container.querySelector('#fm-status');
        const viewListBtn = container.querySelector('#fm-view-list');
        const viewGridBtn = container.querySelector('#fm-view-grid');
        const hiddenBtn = container.querySelector('#fm-toggle-hidden');

        // ── View mode toggle ──
        viewListBtn.addEventListener('click', () => {
            viewMode = 'list';
            viewListBtn.classList.add('active');
            viewGridBtn.classList.remove('active');
            renderItems();
        });
        viewGridBtn.addEventListener('click', () => {
            viewMode = 'icon';
            viewGridBtn.classList.add('active');
            viewListBtn.classList.remove('active');
            renderItems();
        });

        // ── Hidden files toggle ──
        hiddenBtn.addEventListener('click', () => {
            showHidden = !showHidden;
            hiddenBtn.innerHTML = showHidden ? SVG_ICONS.eye : SVG_ICONS.eyeOff;
            hiddenBtn.classList.toggle('active', showHidden);
            renderItems();
        });

        // ── Filter items ──
        function getFilteredItems() {
            if (showHidden) return allItems;
            return allItems.filter(item => !item.name.startsWith('.'));
        }

        // ── Render items based on view mode ──
        function renderItems() {
            const items = getFilteredItems();
            list.innerHTML = '';
            if (items.length === 0) {
                list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">空文件夹</div>';
                updateStatus(items.length);
                return;
            }

            if (viewMode === 'icon') {
                renderGridView(items);
            } else {
                renderListView(items);
            }
            updateStatus(items.length);
        }

        function renderListView(items) {
            items.forEach(item => {
                const el = document.createElement('div');
                el.className = 'fm-item';
                const icon = item.is_dir ? SVG_ICONS.folder : SVG_ICONS.file;
                const size = item.is_dir ? '—' : formatSize(item.size);
                const time = item.mtime ? new Date(item.mtime * 1000).toLocaleString() : '';
                el.innerHTML = `
                    <span class="fm-item-icon">${icon}</span>
                    <span class="fm-item-name">${escapeHtml(item.name)}</span>
                    <span class="fm-item-meta">${size}</span>
                    <span class="fm-item-meta">${time}</span>
                `;
                el.addEventListener('click', () => {
                    list.querySelectorAll('.fm-item, .fm-grid-item').forEach(i => i.classList.remove('selected'));
                    el.classList.add('selected');
                });
                el.addEventListener('dblclick', () => {
                    if (item.is_dir) loadDir(currentPath + '/' + item.name);
                    else openFile(currentPath + '/' + item.name);
                });
                list.appendChild(el);
            });
        }

        function renderGridView(items) {
            const grid = document.createElement('div');
            grid.className = 'fm-grid';
            items.forEach(item => {
                const el = document.createElement('div');
                el.className = 'fm-grid-item';
                const icon = item.is_dir ? `<svg width="40" height="40" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4C2 3.45 2.45 3 3 3H6L7.5 5H13C13.55 5 14 5.45 14 6V12C14 12.55 13.55 13 13 13H3C2.45 13 2 12.55 2 12V4Z" fill="var(--accent)" opacity="0.7"/></svg>` : `<svg width="40" height="40" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2H10L13 5V14H4V2Z" stroke="var(--text-muted)" stroke-width="0.8" fill="none"/><path d="M10 2V5H13" stroke="var(--text-muted)" stroke-width="0.8"/></svg>`;
                el.innerHTML = `
                    <div class="fm-grid-item-icon">${icon}</div>
                    <div class="fm-grid-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                `;
                el.addEventListener('click', () => {
                    grid.querySelectorAll('.fm-grid-item').forEach(i => i.classList.remove('selected'));
                    el.classList.add('selected');
                });
                el.addEventListener('dblclick', () => {
                    if (item.is_dir) loadDir(currentPath + '/' + item.name);
                    else openFile(currentPath + '/' + item.name);
                });
                grid.appendChild(el);
            });
            list.appendChild(grid);
        }

        function updateStatus(filteredCount) {
            const hiddenCount = allItems.length - filteredCount;
            let text = `${filteredCount} 项`;
            if (hiddenCount > 0) text += ` (${hiddenCount} 个隐藏文件)`;
            status.innerHTML = `<span>${text}</span><span>${currentPath}</span>`;
        }

        async function loadDir(path) {
            try {
                const data = await os.api('GET', `/api/fs/list?path=${encodeURIComponent(path)}`);
                if (data.error) {
                    list.innerHTML = `<div style="padding:20px;color:var(--accent-warm);">错误: ${data.error}</div>`;
                    return;
                }
                currentPath = data.path || path;
                breadcrumb.textContent = currentPath;
                allItems = data.items || [];
                renderItems();
                loadTree(currentPath);
            } catch (e) {
                list.innerHTML = `<div style="padding:20px;color:var(--accent-warm);">连接失败: ${e.message}</div>`;
            }
        }

        async function loadTree(path) {
            try {
                const data = await os.api('GET', `/api/fs/list?path=${encodeURIComponent(path)}`);
                if (data.error) return;
                tree.innerHTML = '';
                const dirs = (data.items || []).filter(i => i.is_dir);
                const rootItem = document.createElement('div');
                rootItem.className = 'fm-tree-item active';
                rootItem.innerHTML = `${SVG_ICONS.folderOpen} <span>${(data.path || '/').split('/').pop() || '/'}</span>`;
                rootItem.addEventListener('click', () => loadDir(data.path));
                tree.appendChild(rootItem);

                dirs.forEach(d => {
                    const el = document.createElement('div');
                    el.className = 'fm-tree-item';
                    el.style.paddingLeft = '20px';
                    el.innerHTML = `${SVG_ICONS.folder} <span>${escapeHtml(d.name)}</span>`;
                    el.addEventListener('click', () => loadDir(data.path + '/' + d.name));
                    tree.appendChild(el);
                });
            } catch (e) { /* ignore */ }
        }

        function openFile(path) {
            if (AppRegistry.ide) {
                const ideWin = os.openApp('ide');
                if (ideWin) ideWin.emit('open-file', { path });
            }
        }

        function formatSize(bytes) {
            if (!bytes) return '—';
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1024 / 1024).toFixed(1) + ' MB';
        }

        function escapeHtml(s) {
            const d = document.createElement('div');
            d.textContent = s;
            return d.innerHTML;
        }

        // Buttons
        container.querySelector('#fm-back').addEventListener('click', () => {
            const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
            loadDir(parent);
        });
        container.querySelector('#fm-up').addEventListener('click', () => {
            const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
            loadDir(parent);
        });
        container.querySelector('#fm-refresh').addEventListener('click', () => {
            loadDir(currentPath);
        });
        container.querySelector('#fm-new-folder').addEventListener('click', async () => {
            const name = prompt('新文件夹名称:');
            if (name) {
                await os.api('POST', '/api/fs/mkdir', { path: currentPath + '/' + name });
                loadDir(currentPath);
            }
        });

        // Init
        loadDir('');
    }
});
