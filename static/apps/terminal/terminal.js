/* ═══════════════════════════════════════════════════════
   N.O.V.A AETHER OS — Terminal App
   xterm.js + WebSocket PTY
   ═══════════════════════════════════════════════════════ */

registerApp('terminal', {
    title: '终端',
    icon: '⬛',
    factory: (container, win, os) => {
        container.style.background = '#0a0e1a';

        // Load xterm.js dynamically if not loaded
        function loadScript(src) {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }

        function loadCSS(href) {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`link[href="${href}"]`)) { resolve(); return; }
                const l = document.createElement('link');
                l.rel = 'stylesheet';
                l.href = href;
                l.onload = resolve;
                l.onerror = reject;
                document.head.appendChild(l);
            });
        }

        async function initTerminal() {
            // Try to load xterm from CDN
            try {
                await loadCSS('https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css');
                await loadScript('https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.min.js');
                await loadScript('https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js');
                await loadScript('https://cdn.jsdelivr.net/npm/@xterm/addon-web-links@0.11.0/lib/addon-web-links.min.js');
            } catch (e) {
                console.warn('Failed to load xterm from CDN, using fallback');
            }

            if (typeof Terminal === 'undefined') {
                container.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;">
                        <div style="font-size:36px;">⬛</div>
                        <div style="color:var(--text-secondary);font-size:13px;">终端模拟器</div>
                        <div style="color:var(--text-muted);font-size:11px;">xterm.js 加载中...请检查网络连接</div>
                        <div style="font-family:var(--font-mono);font-size:11px;color:var(--accent);padding:12px 20px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);">
                            连接后端: ws://${location.host}/ws/terminal/default
                        </div>
                    </div>
                `;
                // Still try to connect via WebSocket fallback
                return;
            }

            const term = new Terminal({
                fontFamily: "'JetBrains Mono', 'Noto Sans SC', monospace",
                fontSize: 13,
                lineHeight: 1.3,
                theme: {
                    background: '#0a0e1a',
                    foreground: '#e8eaf6',
                    cursor: '#00e5ff',
                    cursorAccent: '#0a0e1a',
                    selectionBackground: 'rgba(0, 229, 255, 0.2)',
                    black: '#1a1e2e',
                    red: '#ff6b6b',
                    green: '#40c060',
                    yellow: '#f0c040',
                    blue: '#4a5fff',
                    magenta: '#c060ff',
                    cyan: '#00e5ff',
                    white: '#e8eaf6',
                    brightBlack: '#4a5270',
                    brightRed: '#ff8080',
                    brightGreen: '#60e080',
                    brightYellow: '#ffe060',
                    brightBlue: '#7080ff',
                    brightMagenta: '#d080ff',
                    brightCyan: '#40f0ff',
                    brightWhite: '#ffffff',
                },
                cursorBlink: true,
                cursorStyle: 'bar',
                scrollback: 5000,
                allowProposedApi: true,
            });

            // Addons
            try {
                const fitAddon = new FitAddon.FitAddon();
                term.loadAddon(fitAddon);
                term.open(container);

                const doFit = () => {
                    try { fitAddon.fit(); } catch (e) {}
                };

                // Observe resize
                const ro = new ResizeObserver(() => doFit());
                ro.observe(container);
                doFit();

                // WebSocket connection
                const sessionId = 'term-' + Date.now();
                const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
                const ws = new WebSocket(`${proto}//${location.host}/ws/terminal/${sessionId}`);
                ws.binaryType = 'arraybuffer';

                ws.onopen = () => {
                    term.write('\r\n\x1b[36m▸ Connected to N.O.V.A Terminal\x1b[0m\r\n');
                    // Send initial size
                    const dims = { cols: term.cols, rows: term.rows };
                    ws.send(JSON.stringify({ type: 'resize', ...dims }));
                };

                ws.onmessage = (e) => {
                    if (e.data instanceof ArrayBuffer) {
                        term.write(new Uint8Array(e.data));
                    } else {
                        term.write(e.data);
                    }
                };

                ws.onclose = () => {
                    term.write('\r\n\x1b[31m▸ Connection closed\x1b[0m\r\n');
                };

                ws.onerror = () => {
                    term.write('\r\n\x1b[31m▸ Connection error\x1b[0m\r\n');
                };

                term.onData(data => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'input', data }));
                    }
                });

                term.onResize(({ cols, rows }) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
                    }
                });

                // Cleanup on window close
                win.on('close', () => {
                    ws.close();
                    ro.disconnect();
                    term.dispose();
                });

            } catch (e) {
                container.innerHTML = `<div style="padding:20px;color:var(--accent-warm);">终端初始化失败: ${e.message}</div>`;
            }
        }

        initTerminal();
    }
});
