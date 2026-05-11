/* ═══════════════════════════════════════════════════════
   N.O.V.A AETHER OS — Core OS
   Window manager, Dock, Sidebar, Menus, Boot
   ═══════════════════════════════════════════════════════ */

// ── App Registry ──
const AppRegistry = {};
const AppManifests = {};

// ── Inline SVG icons (replacing Unicode symbols) ──
const SVG = {
    triangleDown: (sz=14,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1L13 11H1L7 1Z" fill="${c}" stroke="${c}" stroke-width="0.8" stroke-linejoin="round"/></svg>`,
    triangleDownSmall: (sz=10,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 7.5L8 3.5" stroke="${c}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    arrowLeft: (sz=12,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 2L4 6L8 10" stroke="${c}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    arrowRight: (sz=12,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2L8 6L4 10" stroke="${c}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    arrowUp: (sz=12,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 8L6 4L10 8" stroke="${c}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    chevronRight: (sz=10,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 2L7 5L3.5 8" stroke="${c}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    refresh: (sz=14,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 7A4.5 4.5 0 1 1 7 2.5" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/><path d="M7 0.5L9.5 2.5L7 4.5" stroke="${c}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    close: (sz=12,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="${c}" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    minimize: (sz=10,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 5H8.5" stroke="${c}" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    maximize: (sz=10,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="1.5" width="7" height="7" rx="1" stroke="${c}" stroke-width="1.2" fill="none"/></svg>`,
    diamond: (sz=12,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 1L11 6L6 11L1 6Z" stroke="${c}" stroke-width="1" fill="none"/></svg>`,
    diamondDot: (sz=12,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 1L11 6L6 11L1 6Z" stroke="${c}" stroke-width="0.8" fill="none"/><circle cx="6" cy="6" r="1.5" fill="${c}"/></svg>`,
    hexagon: (sz=12,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 1L10.33 3.5V8.5L6 11L1.67 8.5V3.5L6 1Z" stroke="${c}" stroke-width="0.8" fill="none"/></svg>`,
    circle: (sz=12,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="4.5" stroke="${c}" stroke-width="0.8" fill="none"/></svg>`,
    home: (sz=14,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 7L7 2.5L11.5 7M4 6V11H10V6" stroke="${c}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    send: (sz=12,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 1.5L10.5 6L1.5 10.5V7L7.5 6L1.5 4.5V1.5Z" fill="${c}"/></svg>`,
    list: (sz=14,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 3.5H12M4 7H12M4 10.5H12M1.5 3.5H1.51M1.5 7H1.51M1.5 10.5H1.51" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/></svg>`,
    grid: (sz=14,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="1.5" width="4" height="4" rx="0.8" stroke="${c}" stroke-width="1.1"/><rect x="8.5" y="1.5" width="4" height="4" rx="0.8" stroke="${c}" stroke-width="1.1"/><rect x="1.5" y="8.5" width="4" height="4" rx="0.8" stroke="${c}" stroke-width="1.1"/><rect x="8.5" y="8.5" width="4" height="4" rx="0.8" stroke="${c}" stroke-width="1.1"/></svg>`,
    eyeOff: (sz=14,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L13 13M5.2 5.2C4.8 5.7 4.5 6.3 4.5 7C4.5 8.9 6.1 10.5 8 10.5C8.4 10.5 8.7 10.4 9 10.3M11.5 11C10.4 11.8 9.2 12.2 8 12.2C4.7 12.2 2 9.5 2 7C2 5.8 2.6 4.6 3.5 3.5" stroke="${c}" stroke-width="1.1" stroke-linecap="round"/><path d="M7 4C8.1 4 9 4.9 9 6C9 6.3 8.9 6.6 8.8 6.8" stroke="${c}" stroke-width="1.1" stroke-linecap="round"/><path d="M12.5 7C12.5 7 11.8 9.5 8 9.5" stroke="${c}" stroke-width="1.1" stroke-linecap="round"/></svg>`,
    eye: (sz=14,c='currentColor') =>
        `<svg width="${sz}" height="${sz}" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 7C1 7 3 3 7 3C11 3 13 7 13 7C13 7 11 11 7 11C3 11 1 7 1 7Z" stroke="${c}" stroke-width="1.1" stroke-linecap="round"/><circle cx="7" cy="7" r="2" stroke="${c}" stroke-width="1.1"/></svg>`,
};

function getAppIcon(appId) {
    const manifest = AppManifests[appId];
    if (manifest && manifest.icon) return `<img src="${manifest.icon}" alt="">`;
    const reg = AppRegistry[appId];
    if (reg && reg.icon && reg.icon.startsWith('/')) return `<img src="${reg.icon}" alt="">`;
    return (manifest && manifest.emoji) || (reg && reg.icon) || '📦';
}

function registerApp(id, config) {
    AppRegistry[id] = config;
}

// ── Main OS Controller ──

class AetherOS {
    constructor() {
        this.windows = new Map();
        this.focusedId = null;
        this.sidebarExpanded = false;
        this.activeDropdown = null;

        // Model call tracking
        this.modelCalls = [];
        this.callHistory = [];

        // Agent panels
        this.agentPanels = new Map();

        // Theme (default: light for better performance)
        this.theme = localStorage.getItem('aether-theme') || 'light';

        // Unified LLM client
        this.llm = new LLMClient(this);

        // Layout persistence
        this._layoutSaveTimer = null;
    }

    // ═══════════════════════════════════════
    // BOOT
    // ═══════════════════════════════════════

    async boot() {
        // Detect performance mode early for faster boot
        const urlParams = new URLSearchParams(window.location.search);
        const isLowPerfFromUrl = urlParams.get('low_perf') === '1';

        const isLowPerf = isLowPerfFromUrl ||
            localStorage.getItem('aether-perf-mode') === 'low' ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);

        if (isLowPerf) {
            document.documentElement.classList.add('low-perf');
            // Save preference if detected from URL or auto-detect
            if (isLowPerfFromUrl) {
                localStorage.setItem('aether-perf-mode', 'low');
            }
        }

        const bar = document.querySelector('.boot-progress-bar');
        const status = document.querySelector('.boot-status');
        const steps = [
            ['Loading kernel modules...', 15],
            ['Initializing window manager...', 35],
            ['Mounting file systems...', 50],
            ['Starting service mesh...', 65],
            ['Loading application manifests...', 80],
            ['Calibrating neural interface...', 92],
            ['System ready.', 100],
        ];

        // Faster boot in low performance mode
        const baseDelay = isLowPerf ? 50 : 200;
        const randomDelay = isLowPerf ? 50 : 200;

        for (const [text, pct] of steps) {
            status.textContent = text;
            bar.style.width = pct + '%';
            await this._sleep(baseDelay + Math.random() * randomDelay);
        }

        await this._sleep(isLowPerf ? 100 : 400);
        document.getElementById('boot-screen').classList.add('fade-out');
        document.getElementById('os-root').style.display = '';
        await this._sleep(isLowPerf ? 200 : 800);
        document.getElementById('boot-screen').remove();

        this._initTheme();
        this._initPerformanceMode();
        this._initClock();
        this._initMenus();
        this._initSidebar();
        await this._loadApps();
        this._initDesktop();
        this._initKeyboard();

        // Restore saved layout (or do nothing if empty)
        await this._restoreLayout();
    }

    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ═══════════════════════════════════════
    // THEME
    // ═══════════════════════════════════════

    _initTheme() {
        this.setTheme(this.theme);
    }

    setTheme(theme) {
        this.theme = theme;
        localStorage.setItem('aether-theme', theme);
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    // ═══════════════════════════════════════
    // PERFORMANCE MODE
    // ═══════════════════════════════════════

    _initPerformanceMode() {
        // Check saved preference
        const savedPref = localStorage.getItem('aether-perf-mode');
        if (savedPref === 'low') {
            document.documentElement.classList.add('low-perf');
            return;
        }

        // Auto-detect: check if user prefers reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.documentElement.classList.add('low-perf');
            localStorage.setItem('aether-perf-mode', 'low');
            return;
        }

        // Auto-detect: simple performance heuristic
        // Check if device likely has low performance (mobile, old hardware)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const hasLowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;

        if (isMobile || hasLowCores) {
            document.documentElement.classList.add('low-perf');
            localStorage.setItem('aether-perf-mode', 'low');
        }
    }

    setPerformanceMode(mode) {
        if (mode === 'low') {
            document.documentElement.classList.add('low-perf');
            localStorage.setItem('aether-perf-mode', 'low');
        } else {
            document.documentElement.classList.remove('low-perf');
            localStorage.setItem('aether-perf-mode', 'normal');
        }
    }

    // ═══════════════════════════════════════
    // CLOCK
    // ═══════════════════════════════════════

    _initClock() {
        const el = document.getElementById('menu-clock');
        const update = () => {
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const y = now.getFullYear();
            const m = pad(now.getMonth() + 1);
            const d = pad(now.getDate());
            const h = pad(now.getHours());
            const mi = pad(now.getMinutes());
            const s = pad(now.getSeconds());
            el.textContent = `${y}/${m}/${d}  ${h}:${mi}:${s}`;
        };
        update();
        setInterval(update, 1000);
    }

    // ═══════════════════════════════════════
    // MENUS
    // ═══════════════════════════════════════

    _menuData = {
        file: [
            { label: '新建文件', shortcut: 'Ctrl+N' },
            { label: '打开文件', shortcut: 'Ctrl+O' },
            { label: '打开文件夹', shortcut: 'Ctrl+K Ctrl+O' },
            { type: 'divider' },
            { label: '保存', shortcut: 'Ctrl+S' },
            { label: '另存为', shortcut: 'Ctrl+Shift+S' },
            { type: 'divider' },
            { label: '首选项', shortcut: 'Ctrl+,' },
        ],
        edit: [
            { label: '撤销', shortcut: 'Ctrl+Z' },
            { label: '重做', shortcut: 'Ctrl+Shift+Z' },
            { type: 'divider' },
            { label: '剪切', shortcut: 'Ctrl+X' },
            { label: '复制', shortcut: 'Ctrl+C' },
            { label: '粘贴', shortcut: 'Ctrl+V' },
            { type: 'divider' },
            { label: '查找', shortcut: 'Ctrl+F' },
            { label: '替换', shortcut: 'Ctrl+H' },
        ],
        view: [
            { label: '文件管理器', action: () => this.openApp('files') },
            { label: 'IDE', action: () => this.openApp('ide') },
            { label: '终端', action: () => this.openApp('terminal') },
            { type: 'divider' },
            { label: '切换侧边栏', action: () => this.toggleSidebar() },
            { label: '切换全屏', shortcut: 'F11' },
        ],
        terminal: [
            { label: '新建终端', action: () => this.openApp('terminal') },
            { label: '拆分终端', shortcut: 'Ctrl+Shift+5' },
            { type: 'divider' },
            { label: '清除终端', shortcut: 'Ctrl+K' },
        ],
        window: [
            { label: '最小化', shortcut: 'Ctrl+M' },
            { label: '最大化', shortcut: 'Ctrl+Shift+M' },
            { type: 'divider' },
            { label: '关闭窗口', shortcut: 'Ctrl+W' },
            { label: '关闭所有窗口' },
        ],
        help: [
            { label: '关于 N.O.V.A Aether OS' },
            { label: '快捷键参考', shortcut: 'Ctrl+K Ctrl+R' },
            { type: 'divider' },
            { label: '文档' },
            { label: '报告问题' },
        ],
    };

    _initMenus() {
        const container = document.getElementById('dropdown-container');
        const menuItems = document.querySelectorAll('.menu-item');

        menuItems.forEach(item => {
            item.addEventListener('click', e => {
                e.stopPropagation();
                const key = item.dataset.menu;
                if (this.activeDropdown === key) {
                    this._closeDropdown();
                } else {
                    this._openDropdown(key, item);
                }
            });

            item.addEventListener('mouseenter', () => {
                if (this.activeDropdown) {
                    const key = item.dataset.menu;
                    this._openDropdown(key, item);
                }
            });
        });

        document.addEventListener('click', () => this._closeDropdown());
    }

    _openDropdown(key, anchor) {
        const container = document.getElementById('dropdown-container');
        container.innerHTML = '';
        this.activeDropdown = key;

        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        anchor.classList.add('active');

        const menu = document.createElement('div');
        menu.className = 'dropdown-menu';
        menu.style.left = anchor.getBoundingClientRect().left + 'px';

        const items = this._menuData[key] || [];
        items.forEach(item => {
            if (item.type === 'divider') {
                const d = document.createElement('div');
                d.className = 'dropdown-divider';
                menu.appendChild(d);
            } else {
                const el = document.createElement('div');
                el.className = 'dropdown-item';
                el.innerHTML = `<span>${item.label}</span>`;
                if (item.shortcut) {
                    el.innerHTML += `<span class="shortcut">${item.shortcut}</span>`;
                }
                el.addEventListener('click', e => {
                    e.stopPropagation();
                    this._closeDropdown();
                    if (item.action) item.action();
                });
                menu.appendChild(el);
            }
        });

        container.appendChild(menu);
    }

    _closeDropdown() {
        this.activeDropdown = null;
        document.getElementById('dropdown-container').innerHTML = '';
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    }

    // ═══════════════════════════════════════
    // SIDEBAR
    // ═══════════════════════════════════════

    _initSidebar() {
        document.getElementById('system-toggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        document.getElementById('view-all-calls').addEventListener('click', () => {
            this._showCallHistory();
        });
    }

    toggleSidebar() {
        this.sidebarExpanded = !this.sidebarExpanded;
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('system-toggle');
        sidebar.classList.toggle('expanded', this.sidebarExpanded);
        sidebar.classList.toggle('collapsed', !this.sidebarExpanded);
        toggle.classList.toggle('active', this.sidebarExpanded);
        if (this.sidebarExpanded) this._renderWindowPreview();
    }

    // ── Model call tracking ──

    registerModelCall(call) {
        // call: { id, model, type, status, app, startTime, ... }
        call.timestamp = call.startTime || Date.now();
        if (!call.status) call.status = 'streaming';
        this.modelCalls.push(call);
        this.callHistory.push(call);
        this._renderModelCalls();
    }

    updateModelCall(id, updates) {
        const call = this.modelCalls.find(c => c.id === id);
        if (call) {
            Object.assign(call, updates);
            // 自动计算延迟
            if (updates.endTime && call.startTime) {
                call.latency = ((updates.endTime - call.startTime) / 1000).toFixed(1);
            }
            this._renderModelCalls();
            // 完成或出错后 5 秒自动移除
            if (updates.status === 'done' || updates.status === 'error') {
                setTimeout(() => this.removeModelCall(id), 5000);
            }
        }
    }

    removeModelCall(id) {
        this.modelCalls = this.modelCalls.filter(c => c.id !== id);
        this._renderModelCalls();
    }

    _renderModelCalls() {
        const list = document.getElementById('model-calls-list');
        if (this.modelCalls.length === 0) {
            list.innerHTML = '<div class="glass-card empty-state">暂无活跃调用</div>';
            return;
        }
        list.innerHTML = '';
        this.modelCalls.forEach(call => {
            const status = call.status || 'streaming';
            const statusMap = {
                streaming: { label: '流式输出', color: 'var(--accent)' },
                generating: { label: '生成中', color: 'var(--accent)' },
                done: { label: '已完成', color: '#4ade80' },
                error: { label: '出错', color: 'var(--accent-warm)' },
            };
            const s = statusMap[status] || statusMap.streaming;

            const card = document.createElement('div');
            card.className = 'glass-card model-call-card';
            card.innerHTML = `
                <div class="call-header">
                    <div class="model-dot" style="background:${s.color};box-shadow:0 0 8px ${s.color};${status === 'done' || status === 'error' ? 'animation:none;opacity:0.7;' : ''}"></div>
                    <span class="model-name">${this._esc(call.model)}</span>
                    <span style="font-size:10px;color:${s.color};font-family:var(--font-mono);">${s.label}</span>
                </div>
                <div class="call-stats">
                    <span>${call.type === 'image' ? '图像生成' : '对话'}</span>
                    <span>${(call.tokens || 0).toLocaleString()} tokens</span>
                    <span>${call.latency || '—'}s</span>
                </div>
                <div class="call-details">
                    <div>来源应用: ${this._esc(call.app || '—')}</div>
                    <div>开始时间: ${new Date(call.timestamp).toLocaleTimeString()}</div>
                    ${call.error ? `<div style="color:var(--accent-warm);">错误: ${this._esc(call.error)}</div>` : ''}
                    ${call.details ? `<div>${this._esc(call.details)}</div>` : ''}
                </div>
            `;
            card.addEventListener('click', () => card.classList.toggle('expanded'));
            list.appendChild(card);
        });
    }

    _showCallHistory() {
        const modal = document.getElementById('call-history-modal');
        const content = document.getElementById('call-history-content');
        modal.style.display = '';

        if (this.callHistory.length === 0) {
            content.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px;">暂无调用记录</div>';
            return;
        }

        let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
        this.callHistory.slice().reverse().forEach(call => {
            html += `
                <div class="glass-card" style="padding:10px 14px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                        <span style="font-family:var(--font-mono);font-weight:600;">${this._esc(call.model)}</span>
                        <span style="font-size:10px;color:var(--text-muted);">${new Date(call.timestamp).toLocaleString()}</span>
                    </div>
                    <div style="display:flex;gap:16px;font-size:11px;color:var(--text-secondary);">
                        <span>${(call.tokens || 0).toLocaleString()} tokens</span>
                        <span>${call.latency || '—'}s</span>
                        <span>${this._esc(call.app || '—')}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        content.innerHTML = html;
    }

    // ── Agent panels ──

    registerAgentPanel(agent) {
        // agent: { id, name, windowId }
        agent.status = 'idle';
        agent.statusIcon = '💤';
        agent.statusText = '空闲';
        agent.toolName = '';
        agent.runTime = 0;
        agent.contextTokens = 0;
        agent._timer = setInterval(() => {
            if (agent.status !== 'idle') agent.runTime++;
            this._renderAgentPanels();
        }, 1000);
        this.agentPanels.set(agent.id, agent);
        this._renderAgentPanels();
    }

    updateAgentPanel(id, updates) {
        const agent = this.agentPanels.get(id);
        if (!agent) return;
        Object.assign(agent, updates);

        const statusMap = {
            thinking: { icon: '💭', text: '思考中' },
            output:   { icon: '📤', text: '输出中' },
            tool:     { icon: '🔧', text: `工具调用: ${agent.toolName || ''}` },
            idle:     { icon: '💤', text: '空闲' },
        };
        const s = statusMap[agent.status] || statusMap.idle;
        agent.statusIcon = s.icon;
        agent.statusText = s.text;

        this._renderAgentPanels();
    }

    removeAgentPanel(id) {
        const agent = this.agentPanels.get(id);
        if (agent && agent._timer) clearInterval(agent._timer);
        this.agentPanels.delete(id);
        this._renderAgentPanels();
    }

    _renderAgentPanels() {
        const list = document.getElementById('agent-panels-list');
        if (this.agentPanels.size === 0) {
            list.innerHTML = '<div class="glass-card empty-state">暂无运行中的 Agent</div>';
            return;
        }
        list.innerHTML = '';
        this.agentPanels.forEach(agent => {
            const card = document.createElement('div');
            card.className = 'glass-card agent-panel-card';
            const mins = Math.floor(agent.runTime / 60);
            const secs = agent.runTime % 60;
            const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            card.innerHTML = `
                <div class="agent-header">
                    <span class="agent-icon">${SVG.diamond(12, 'var(--accent)')}</span>
                    <span class="agent-name">${this._esc(agent.name)}</span>
                </div>
                <div class="agent-status">
                    <span class="agent-status-icon">${agent.statusIcon}</span>
                    <span>${this._esc(agent.statusText)}</span>
                </div>
                <div class="agent-meta">
                    <span>⏱ ${timeStr}</span>
                    <span>📏 ${(agent.contextTokens || 0).toLocaleString()} tokens</span>
                </div>
                <div class="agent-details">
                    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;">
                        <div>Agent ID: ${this._esc(agent.id)}</div>
                        <div>运行时间: ${timeStr}</div>
                        <div>上下文: ${(agent.contextTokens || 0).toLocaleString()} tokens</div>
                    </div>
                    <button class="agent-switch-btn">切换至该 Agent 窗口</button>
                </div>
            `;

            card.addEventListener('click', e => {
                if (!e.target.closest('.agent-switch-btn')) {
                    card.classList.toggle('expanded');
                }
            });

            card.querySelector('.agent-switch-btn').addEventListener('click', e => {
                e.stopPropagation();
                if (agent.windowId) this.focusWindow(agent.windowId);
            });

            list.appendChild(card);
        });
    }

    // ═══════════════════════════════════════
    // APPS & DOCK
    // ═══════════════════════════════════════

    async _loadApps() {
        try {
            const data = await this.api('GET', '/api/apps');
            const apps = data.apps || [];

            // Store manifests and load scripts
            const loadPromises = apps.map(app => {
                AppManifests[app.id] = app;
                return this._loadAppScript(app);
            });
            await Promise.all(loadPromises);

            this._buildDock();
        } catch (e) {
            console.warn('Failed to load apps:', e);
            // Fallback: build dock from whatever is in AppRegistry
            this._buildDock();
        }
    }

    async _loadAppScript(manifest) {
        if (AppRegistry[manifest.id]) return; // already registered
        const entryPath = `/apps/${manifest.id}/${manifest.entry}`;
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = entryPath;
            script.onload = () => resolve();
            script.onerror = () => {
                console.warn(`Failed to load app script: ${entryPath}`);
                resolve(); // don't block other apps
            };
            document.head.appendChild(script);
        });
    }

    _buildDock() {
        const container = document.getElementById('dock-container');
        container.innerHTML = '';

        // Collect dock apps: use manifests order, fallback to registry
        const dockApps = [];
        for (const [id, manifest] of Object.entries(AppManifests)) {
            if (manifest.dock !== false) dockApps.push({ id, title: manifest.title, manifest });
        }
        // Also add any registered apps not in manifests (shouldn't happen, but safety)
        for (const id of Object.keys(AppRegistry)) {
            if (!dockApps.find(a => a.id === id)) {
                dockApps.push({ id, title: AppRegistry[id].title || id, manifest: null });
            }
        }

        dockApps.forEach(app => {
            const item = document.createElement('div');
            item.className = 'dock-item';
            item.dataset.app = app.id;
            item.title = app.title;
            const iconHtml = getAppIcon(app.id);
            const iconContent = iconHtml.startsWith('<img') || iconHtml.startsWith('<svg')
                ? iconHtml
                : `<span style="font-size:24px;">${iconHtml}</span>`;
            item.innerHTML = `
                <div class="dock-icon">${iconContent}</div>
                <div class="dock-label">${this._esc(app.title)}</div>
                <div class="dock-indicator"></div>
            `;
            item.addEventListener('click', () => {
                const existing = [...this.windows.values()].find(w => w.appId === app.id && w.state === 'minimized');
                if (existing) {
                    existing.restore();
                    this.focusWindow(existing.id);
                } else {
                    this.openApp(app.id);
                }
            });
            container.appendChild(item);
        });
    }

    _updateDockIndicators() {
        const runningApps = new Set();
        this.windows.forEach(w => {
            if (w.state !== 'minimized') runningApps.add(w.appId);
        });
        // Also mark minimized ones
        this.windows.forEach(w => runningApps.add(w.appId));

        document.querySelectorAll('.dock-item').forEach(item => {
            const wasRunning = item.classList.contains('running');
            const isRunning = runningApps.has(item.dataset.app);
            item.classList.toggle('running', isRunning);
            if (isRunning && !wasRunning) {
                item.classList.add('bouncing');
                item.addEventListener('animationend', () => {
                    item.classList.remove('bouncing');
                }, { once: true });
            }
        });

        this._renderWindowPreview();
    }

    _renderWindowPreview() {
        const list = document.getElementById('window-preview-list');
        if (!list) return;

        if (this.windows.size === 0) {
            list.innerHTML = '<div class="glass-card empty-state">暂无打开的窗口</div>';
            return;
        }

        list.innerHTML = '';
        this.windows.forEach((win, id) => {
            const icon = getAppIcon(win.appId);
            const stateLabel = win.state === 'minimized' ? '最小化' : win.state === 'maximized' ? '最大化' : '';
            const isFocused = this.focusedId === id;

            const card = document.createElement('div');
            card.className = 'win-preview-card' + (isFocused ? ' focused-card' : '');
            card.innerHTML = `
                <span class="win-preview-icon">${icon}</span>
                <span class="win-preview-name">${this._esc(win.title)}</span>
                ${stateLabel ? `<span class="win-preview-state">${stateLabel}</span>` : ''}
                <span class="win-preview-close" title="关闭">${SVG.close(10, 'currentColor')}</span>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.win-preview-close')) {
                    win.close();
                    return;
                }
                if (win.state === 'minimized') win.restore();
                this.focusWindow(id);
            });

            list.appendChild(card);
        });
    }

    // ═══════════════════════════════════════
    // DESKTOP
    // ═══════════════════════════════════════

    _initDesktop() {
        const desktop = document.getElementById('desktop');
        desktop.addEventListener('mousedown', (e) => {
            // Only unfocus when clicking directly on desktop background (not windows)
            if (e.target === desktop || e.target.id === 'desktop-canvas' || e.target.classList.contains('desktop-grid')) {
                this._unfocusAll();
            }
            this._closeContextMenu();
        });

        this._initDesktopCanvas();
        this._initContextMenu();
    }

    // ═══════════════════════════════════════
    // DESKTOP CANVAS — floating circles
    // ═══════════════════════════════════════

    _initDesktopCanvas() {
        const canvas = document.getElementById('desktop-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const circles = [];
        const CIRCLE_COUNT = 14;

        const colors = [
            'rgba(0, 229, 255,',    // cyan
            'rgba(120, 90, 255,',   // vivid purple
            'rgba(255, 80, 120,',   // hot pink
            'rgba(0, 210, 160,',    // emerald
            'rgba(255, 200, 50,',   // gold
            'rgba(60, 160, 255,',   // sky blue
        ];

        let running = true;

        function isLight() {
            return document.documentElement.getAttribute('data-theme') === 'light';
        }

        function resize() {
            const dpr = devicePixelRatio || 1;
            canvas.width = canvas.offsetWidth * dpr;
            canvas.height = canvas.offsetHeight * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function initCircles() {
            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            circles.length = 0;
            for (let i = 0; i < CIRCLE_COUNT; i++) {
                circles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 60 + Math.random() * 140,
                    dx: (Math.random() - 0.5) * 0.25,
                    dy: (Math.random() - 0.5) * 0.25,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    opacity: 0.06 + Math.random() * 0.12,
                    phase: Math.random() * Math.PI * 2,
                });
            }
        }

        function draw() {
            if (!running) return;

            if (isLight()) {
                ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
                requestAnimationFrame(draw);
                return;
            }

            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            ctx.clearRect(0, 0, w, h);

            const time = Date.now() * 0.0004;
            circles.forEach(c => {
                c.x += c.dx;
                c.y += c.dy;
                if (c.x < -c.r) c.x = w + c.r;
                if (c.x > w + c.r) c.x = -c.r;
                if (c.y < -c.r) c.y = h + c.r;
                if (c.y > h + c.r) c.y = -c.r;

                const breathe = 0.5 + 0.5 * Math.sin(time + c.phase);
                const alpha = c.opacity * breathe;

                const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
                grad.addColorStop(0, c.color + alpha + ')');
                grad.addColorStop(0.4, c.color + (alpha * 0.6) + ')');
                grad.addColorStop(0.7, c.color + (alpha * 0.2) + ')');
                grad.addColorStop(1, c.color + '0)');

                ctx.beginPath();
                ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
            });

            requestAnimationFrame(draw);
        }

        resize();
        initCircles();
        draw();

        window.addEventListener('resize', () => {
            resize();
            initCircles();
        });
    }

    // ═══════════════════════════════════════
    // CONTEXT MENU
    // ═══════════════════════════════════════

    _initContextMenu() {
        document.addEventListener('contextmenu', e => {
            e.preventDefault();
            this._closeContextMenu();

            const target = e.target;

            // Check if right-clicked inside a window — let app handle it
            const winEl = target.closest('.os-window');
            if (winEl) {
                const winId = winEl.id;
                const win = this.windows.get(winId);
                if (win && win._contextMenuHandler) {
                    win._contextMenuHandler(e.clientX, e.clientY, target);
                }
                return;
            }

            // Only show desktop context menu when clicking on the desktop background itself
            const desktop = document.getElementById('desktop');
            if (target === desktop || target.id === 'desktop-canvas' || target.classList.contains('desktop-grid')) {
                this._showDesktopContextMenu(e.clientX, e.clientY);
            }
        });

        document.addEventListener('click', () => this._closeContextMenu());
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') this._closeContextMenu();
        });
    }

    _showDesktopContextMenu(x, y) {
        this._closeContextMenu();

        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.style.cssText = `
            position: fixed; left: ${x}px; top: ${y}px; z-index: 10000;
            min-width: 180px;
            background: rgba(220, 240, 255, 0.10);
            backdrop-filter: blur(28px) saturate(1.5);
            -webkit-backdrop-filter: blur(28px) saturate(1.5);
            border: 1px solid rgba(220, 240, 255, 0.18);
            border-radius: 10px; padding: 6px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
            animation: dropdown-in 0.12s var(--ease-out);
        `;

        const items = [
            { label: '新建文件', icon: '📄', action: () => this._ctxNewFile() },
            { label: '新建文件夹', icon: '📁', action: () => this._ctxNewFolder() },
            { type: 'divider' },
            { label: '打开终端', icon: '⬛', action: () => this.openApp('terminal') },
            { label: '打开 IDE', icon: '📝', action: () => this.openApp('ide') },
            { label: '打开文件管理器', icon: '📁', action: () => this.openApp('files') },
            { type: 'divider' },
            { label: '刷新桌面', icon: SVG.refresh(14, 'currentColor'), action: () => location.reload() },
        ];

        items.forEach(item => {
            if (item.type === 'divider') {
                const d = document.createElement('div');
                d.style.cssText = 'height:1px;background:rgba(220,240,255,0.10);margin:4px 8px;';
                menu.appendChild(d);
            } else {
                const el = document.createElement('div');
                el.style.cssText = `
                    padding: 7px 14px; font-size: 12.5px; color: var(--text-secondary);
                    cursor: pointer; border-radius: 6px; display: flex; align-items: center; gap: 10px;
                    transition: all 0.1s;
                `;
                el.innerHTML = `<span style="font-size:13px;width:18px;text-align:center;">${item.icon}</span><span>${item.label}</span>`;
                el.addEventListener('mouseenter', () => {
                    el.style.background = 'rgba(160,220,255,0.18)';
                    el.style.color = 'var(--text-primary)';
                });
                el.addEventListener('mouseleave', () => {
                    el.style.background = 'none';
                    el.style.color = 'var(--text-secondary)';
                });
                el.addEventListener('click', e => {
                    e.stopPropagation();
                    this._closeContextMenu();
                    item.action();
                });
                menu.appendChild(el);
            }
        });

        document.body.appendChild(menu);

        // Adjust position if off-screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
        if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
    }

    _closeContextMenu() {
        const existing = document.getElementById('context-menu');
        if (existing) existing.remove();
    }

    async _ctxNewFile() {
        const name = prompt('文件名:');
        if (!name) return;
        try {
            await this.api('POST', '/api/fs/write', { path: name, content: '' });
        } catch (e) { /* ignore */ }
    }

    async _ctxNewFolder() {
        const name = prompt('文件夹名:');
        if (!name) return;
        try {
            await this.api('POST', '/api/fs/mkdir', { path: name });
        } catch (e) { /* ignore */ }
    }

    // ═══════════════════════════════════════
    // KEYBOARD
    // ═══════════════════════════════════════

    _initKeyboard() {
        document.addEventListener('keydown', e => {
            // Ctrl+W close focused window
            if (e.ctrlKey && e.key === 'w') {
                e.preventDefault();
                if (this.focusedId) {
                    const win = this.windows.get(this.focusedId);
                    if (win) win.close();
                }
            }
            // Ctrl+M minimize
            if (e.ctrlKey && e.key === 'm') {
                e.preventDefault();
                if (this.focusedId) {
                    const win = this.windows.get(this.focusedId);
                    if (win) win.minimize();
                }
            }
        });
    }

    // ═══════════════════════════════════════
    // WINDOW MANAGEMENT
    // ═══════════════════════════════════════

    async openApp(appId) {
        let reg = AppRegistry[appId];

        // Dynamic load: if not registered but manifest exists, load script
        if (!reg && AppManifests[appId]) {
            await this._loadAppScript(AppManifests[appId]);
            reg = AppRegistry[appId];
        }
        if (!reg) {
            console.warn(`App "${appId}" not registered`);
            return;
        }

        // Check if already open (not minimized)
        for (const [id, win] of this.windows) {
            if (win.appId === appId && win.state !== 'minimized') {
                this.focusWindow(id);
                return win;
            }
        }

        // Create content via factory
        const contentEl = document.createElement('div');
        contentEl.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;';

        const win = new OSWindow(appId, reg.title, contentEl, reg.options || {});
        win.mount(document.getElementById('window-stack'));
        this.windows.set(win.id, win);

        // Set window title icon
        const iconEl = win.element.querySelector('.window-title-icon');
        if (iconEl) {
            const manifest = AppManifests[appId];
            const iconPath = manifest && manifest.icon;
            if (iconPath) iconEl.innerHTML = `<img src="${iconPath}" alt="">`;
            else iconEl.textContent = (manifest && manifest.emoji) || reg.icon || '';
        }

        // Focus
        this.focusWindow(win.id);
        this._updateDockIndicators();

        // Init app
        if (reg.factory) {
            try {
                reg.factory(contentEl, win, this);
            } catch (e) {
                console.error(`Failed to init app "${appId}":`, e);
                contentEl.innerHTML = `<div style="padding:20px;color:var(--accent-warm);">应用加载失败: ${e.message}</div>`;
            }
        }

        this._saveLayoutDebounced();
        return win;
    }

    focusWindow(id) {
        if (this.focusedId === id) return;
        this._unfocusAll();
        const win = this.windows.get(id);
        if (win) {
            win.focus();
            this.focusedId = id;
        }
    }

    _unfocusAll() {
        this.windows.forEach(w => w.unfocus());
        this.focusedId = null;
    }

    _removeWindow(id) {
        const win = this.windows.get(id);
        if (win) {
            this.windows.delete(id);
            // Cleanup agent panel if linked
            this.agentPanels.forEach((panel, pid) => {
                if (panel.windowId === id) this.removeAgentPanel(pid);
            });
            if (this.focusedId === id) this.focusedId = null;
            this._updateDockIndicators();
            this._saveLayoutDebounced();
            // Save app state one final time before close
            const reg = AppRegistry[win.appId];
            if (reg?.getState) this._saveAppState(win);
        }
    }

    // ═══════════════════════════════════════
    // LAYOUT PERSISTENCE
    // ═══════════════════════════════════════

    _LAYOUT_KEY = 'aetheros-layout';
    _APP_STATE_DB = 'app_state';

    _saveLayoutDebounced() {
        clearTimeout(this._layoutSaveTimer);
        this._layoutSaveTimer = setTimeout(() => this._saveLayout(), 500);
    }

    _saveLayout() {
        const layout = {
            version: 1,
            timestamp: Date.now(),
            windows: [],
            focusedAppId: null
        };

        const sorted = [...this.windows.values()].sort((a, b) => a.zIndex - b.zIndex);
        for (const win of sorted) {
            layout.windows.push({
                appId: win.appId,
                x: win.x, y: win.y, w: win.w, h: win.h,
                state: win.state,
                zIndex: win.zIndex,
                snapSide: win.snapSide,
                normalGeom: { ...win._normalGeom }
            });
        }

        if (this.focusedId) {
            const focusedWin = this.windows.get(this.focusedId);
            if (focusedWin) layout.focusedAppId = focusedWin.appId;
        }

        try {
            localStorage.setItem(this._LAYOUT_KEY, JSON.stringify(layout));
        } catch (e) {
            console.warn('Failed to save layout:', e);
        }

        // Also save app states (fire-and-forget)
        for (const [id, win] of this.windows) {
            this._saveAppState(win);
        }
    }

    async _restoreLayout() {
        try {
            const raw = localStorage.getItem(this._LAYOUT_KEY);
            if (!raw) return;
            const layout = JSON.parse(raw);
            if (!layout.version || !layout.windows?.length) return;

            const sorted = layout.windows.sort((a, b) => a.zIndex - b.zIndex);

            for (const entry of sorted) {
                if (!AppRegistry[entry.appId] && !AppManifests[entry.appId]) continue;

                const contentEl = document.createElement('div');
                contentEl.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;';

                const win = new OSWindow(entry.appId, '', contentEl, {
                    x: entry.x, y: entry.y, w: entry.w, h: entry.h
                });

                // Restore state properties
                win.state = entry.state;
                win.zIndex = entry.zIndex;
                win.snapSide = entry.snapSide;
                win._normalGeom = entry.normalGeom;

                // Apply visual state
                win.element.style.zIndex = win.zIndex;
                if (win.state === 'minimized') {
                    win.element.style.display = 'none';
                } else if (win.state === 'maximized') {
                    const desktop = document.getElementById('desktop');
                    win.x = 0; win.y = 0;
                    win.w = desktop.clientWidth; win.h = desktop.clientHeight;
                    win._applyGeom();
                    win.element.classList.add('snap-to-full');
                }

                win.mount(document.getElementById('window-stack'));
                this.windows.set(win.id, win);

                // Load app and restore title/icon
                let reg = AppRegistry[entry.appId];
                if (!reg && AppManifests[entry.appId]) {
                    await this._loadAppScript(AppManifests[entry.appId]);
                    reg = AppRegistry[entry.appId];
                }
                if (reg) {
                    win.setTitle(reg.title);
                    const iconEl = win.element.querySelector('.window-title-icon');
                    if (iconEl) {
                        const manifest = AppManifests[entry.appId];
                        const iconPath = manifest && manifest.icon;
                        if (iconPath) iconEl.innerHTML = `<img src="${iconPath}" alt="">`;
                        else iconEl.textContent = (manifest && manifest.emoji) || reg.icon || '';
                    }

                    if (reg.factory) {
                        try {
                            reg.factory(contentEl, win, this);
                        } catch (e) {
                            console.error(`Failed to restore app "${entry.appId}":`, e);
                        }
                    }
                }

                // Async restore app internal state
                this._restoreAppState(win).catch(e =>
                    console.warn(`Failed to restore state for ${entry.appId}:`, e)
                );
            }

            // Restore focus last
            if (layout.focusedAppId) {
                const focusWin = [...this.windows.values()].find(w => w.appId === layout.focusedAppId);
                if (focusWin) this.focusWindow(focusWin.id);
            }

            this._updateDockIndicators();
        } catch (e) {
            console.warn('Layout restore failed:', e);
        }
    }

    async _saveAppState(win) {
        const reg = AppRegistry[win.appId];
        if (!reg?.getState) return;

        try {
            const state = await reg.getState(win);
            if (state === undefined || state === null) return;

            await this.api('POST', `/api/db/${this._APP_STATE_DB}/execute`, {
                sql: `CREATE TABLE IF NOT EXISTS app_state (
                    app_instance TEXT PRIMARY KEY,
                    app_id TEXT NOT NULL,
                    state_json TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )`,
                params: []
            });

            await this.api('POST', `/api/db/${this._APP_STATE_DB}/execute`, {
                sql: `INSERT OR REPLACE INTO app_state (app_instance, app_id, state_json, updated_at)
                      VALUES (?, ?, ?, ?)`,
                params: [win.appId, win.appId, JSON.stringify(state), Date.now()]
            });
        } catch (e) {
            console.warn(`Save app state failed for ${win.appId}:`, e);
        }
    }

    async _restoreAppState(win) {
        const reg = AppRegistry[win.appId];
        if (!reg?.setState) return;

        try {
            await this.api('POST', `/api/db/${this._APP_STATE_DB}/execute`, {
                sql: `CREATE TABLE IF NOT EXISTS app_state (
                    app_instance TEXT PRIMARY KEY,
                    app_id TEXT NOT NULL,
                    state_json TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )`,
                params: []
            });

            const result = await this.api('POST', `/api/db/${this._APP_STATE_DB}/query`, {
                sql: `SELECT state_json FROM app_state WHERE app_instance = ?`,
                params: [win.appId]
            });

            if (result.rows?.length > 0) {
                const state = JSON.parse(result.rows[0].state_json);
                await reg.setState(state, win, this);
            }
        } catch (e) {
            console.warn(`Restore app state failed for ${win.appId}:`, e);
        }
    }

    // ── Utility ──

    _esc(s) {
        const d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    // API helper
    async api(method, path, body) {
        const opts = { method, headers: {} };
        if (body) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        const res = await fetch(path, opts);
        return res.json();
    }

    // WebSocket helper
    ws(path, handlers = {}) {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${proto}//${location.host}${path}`;
        const socket = new WebSocket(url);
        if (handlers.onMessage) socket.addEventListener('message', handlers.onMessage);
        if (handlers.onOpen) socket.addEventListener('open', handlers.onOpen);
        if (handlers.onClose) socket.addEventListener('close', handlers.onClose);
        if (handlers.onError) socket.addEventListener('error', handlers.onError);
        return socket;
    }
}

// ── Global instance ──
const windowOS = new AetherOS();

// ── Boot on load ──
window.addEventListener('DOMContentLoaded', () => {
    windowOS.boot();
});
