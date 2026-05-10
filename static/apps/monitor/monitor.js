/* ═══════════════════════════════════════════════════════
   N.O.V.A AETHER OS — Monitor Application
   Model calls, token usage, agent status dashboard
   ═══════════════════════════════════════════════════════ */

registerApp('monitor', {
    title: '监控',
    icon: '📊',
    factory: (container, win, os) => {
        container.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;background:var(--bg-surface);">
                <!-- Header -->
                <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
                    <span style="font-family:var(--font-display);font-size:11px;letter-spacing:2px;color:var(--text-secondary);">系统监控</span>
                    <button id="mon-refresh" style="background:none;border:1px solid var(--border);color:var(--text-secondary);padding:4px 12px;border-radius:var(--radius-sm);cursor:pointer;font-size:11px;display:flex;align-items:center;gap:4px;"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 7A4.5 4.5 0 1 1 7 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M7 0.5L9.5 2.5L7 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg> 刷新</button>
                </div>
                <!-- Content -->
                <div style="flex:1;overflow-y:auto;padding:16px;">
                    <!-- Stats cards -->
                    <div id="mon-stats" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-bottom:20px;"></div>
                    <!-- Model calls table -->
                    <div style="margin-bottom:20px;">
                        <div style="font-family:var(--font-display);font-size:10px;letter-spacing:2px;color:var(--text-muted);margin-bottom:10px;">模型调用历史</div>
                        <div id="mon-calls-table" style="border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;"></div>
                    </div>
                    <!-- Active agents -->
                    <div>
                        <div style="font-family:var(--font-display);font-size:10px;letter-spacing:2px;color:var(--text-muted);margin-bottom:10px;">活跃 Agent</div>
                        <div id="mon-agents" style="display:flex;flex-direction:column;gap:8px;"></div>
                    </div>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .mon-stat-card{background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:var(--radius-lg);padding:16px;backdrop-filter:blur(10px);}
            .mon-stat-label{font-size:10px;font-family:var(--font-display);letter-spacing:1.5px;color:var(--text-muted);margin-bottom:6px;}
            .mon-stat-value{font-family:var(--font-mono);font-size:22px;font-weight:700;color:var(--accent);text-shadow:0 0 10px rgba(0,229,255,0.2);}
            .mon-stat-sub{font-size:10px;color:var(--text-muted);margin-top:4px;}
            .mon-table-row{display:grid;grid-template-columns:1.5fr 1fr 0.8fr 1fr 1.5fr;padding:8px 12px;font-size:11px;border-bottom:1px solid var(--border);transition:background 0.1s;}
            .mon-table-row:hover{background:var(--bg-hover);}
            .mon-table-header{font-family:var(--font-mono);font-weight:600;color:var(--text-muted);background:var(--bg-elevated);}
            .mon-agent-card{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:var(--radius-md);}
        `;
        container.appendChild(style);

        const statsEl = container.querySelector('#mon-stats');
        const callsTable = container.querySelector('#mon-calls-table');
        const agentsEl = container.querySelector('#mon-agents');

        function render() {
            // Stats
            const totalCalls = os.callHistory.length;
            const totalTokens = os.callHistory.reduce((sum, c) => sum + (c.tokens || 0), 0);
            const activeAgents = os.agentPanels.size;
            const activeCalls = os.modelCalls.length;

            statsEl.innerHTML = `
                <div class="mon-stat-card">
                    <div class="mon-stat-label">总调用次数</div>
                    <div class="mon-stat-value">${totalCalls}</div>
                    <div class="mon-stat-sub">本次会话</div>
                </div>
                <div class="mon-stat-card">
                    <div class="mon-stat-label">总 Token 消耗</div>
                    <div class="mon-stat-value">${totalTokens.toLocaleString()}</div>
                    <div class="mon-stat-sub">所有模型合计</div>
                </div>
                <div class="mon-stat-card">
                    <div class="mon-stat-label">活跃调用</div>
                    <div class="mon-stat-value">${activeCalls}</div>
                    <div class="mon-stat-sub">当前进行中</div>
                </div>
                <div class="mon-stat-card">
                    <div class="mon-stat-label">活跃 Agent</div>
                    <div class="mon-stat-value">${activeAgents}</div>
                    <div class="mon-stat-sub">运行中</div>
                </div>
            `;

            // Calls table
            if (os.callHistory.length === 0) {
                callsTable.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">暂无调用记录</div>';
            } else {
                let html = `<div class="mon-table-row mon-table-header"><span>模型</span><span>应用</span><span>Tokens</span><span>延迟</span><span>时间</span></div>`;
                os.callHistory.slice().reverse().slice(0, 50).forEach(call => {
                    html += `<div class="mon-table-row">
                        <span style="font-family:var(--font-mono);color:var(--text-primary);">${escapeHtml(call.model)}</span>
                        <span>${escapeHtml(call.app || '—')}</span>
                        <span style="font-family:var(--font-mono);">${(call.tokens || 0).toLocaleString()}</span>
                        <span style="font-family:var(--font-mono);">${call.latency || '—'}s</span>
                        <span style="color:var(--text-muted);font-size:10px;">${new Date(call.timestamp).toLocaleString()}</span>
                    </div>`;
                });
                callsTable.innerHTML = html;
            }

            // Agents
            if (os.agentPanels.size === 0) {
                agentsEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);">暂无活跃 Agent</div>';
            } else {
                agentsEl.innerHTML = '';
                os.agentPanels.forEach(agent => {
                    const el = document.createElement('div');
                    el.className = 'mon-agent-card';
                    el.innerHTML = `
                        <span style="font-size:18px;">${agent.statusIcon}</span>
                        <div style="flex:1;">
                            <div style="font-weight:600;font-size:12px;">${escapeHtml(agent.name)}</div>
                            <div style="font-size:10.5px;color:var(--text-secondary);">${escapeHtml(agent.statusText)}</div>
                        </div>
                        <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">
                            ${Math.floor(agent.runTime / 60)}:${String(agent.runTime % 60).padStart(2, '0')}
                        </div>
                    `;
                    el.style.cursor = 'pointer';
                    el.addEventListener('click', () => {
                        if (agent.windowId) os.focusWindow(agent.windowId);
                    });
                    agentsEl.appendChild(el);
                });
            }
        }

        function escapeHtml(s) {
            const d = document.createElement('div');
            d.textContent = s || '';
            return d.innerHTML;
        }

        container.querySelector('#mon-refresh').addEventListener('click', render);

        // Auto refresh
        const interval = setInterval(render, 3000);
        win.on('close', () => clearInterval(interval));

        render();
    }
});
