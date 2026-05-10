/* ═══════════════════════════════════════════════════════
   N.O.V.A AETHER OS — Browser Application
   Opens pages in external browser tab
   ═══════════════════════════════════════════════════════ */

registerApp('browser', {
    title: '浏览器',
    icon: '🌐',
    getState: (win) => win._browserState || null,
    setState: async (state, win, os) => { win._browserState = state; },
    factory: (container, win, os) => {
        const history = [];
        let historyIdx = -1;

        container.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;background:var(--bg-surface);">
                <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-elevated);">
                    <button class="br-btn" id="br-back" title="后退" disabled><svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 2L4 6L8 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                    <button class="br-btn" id="br-forward" title="前进" disabled><svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2L8 6L4 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                    <button class="br-btn" id="br-home" title="主页"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 7L7 2.5L11.5 7M4 6V11H10V6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                    <div style="flex:1;">
                        <input id="br-url" type="text" value=""
                            placeholder="输入网址或搜索..."
                            style="width:100%;background:var(--bg-deep);border:1px solid var(--border);border-radius:var(--radius-sm);padding:5px 10px;color:var(--text-primary);font-family:var(--font-mono);font-size:11.5px;outline:none;transition:border-color 0.15s;"
                            spellcheck="false" autocomplete="off">
                    </div>
                    <button class="br-btn" id="br-go" title="前往"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 2L7 5L3.5 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                </div>
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:var(--bg-deep);">
                    <div style="filter:drop-shadow(0 0 16px rgba(0,229,255,0.3));"><svg width="48" height="48" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1L13 11H1L7 1Z" fill="var(--accent)" stroke="var(--accent)" stroke-width="0.8" stroke-linejoin="round"/></svg></div>
                    <div style="font-size:12px;letter-spacing:6px;color:var(--text-muted);text-transform:uppercase;">N.O.V.A Browser</div>
                    <div style="color:var(--text-secondary);font-size:12px;margin-top:8px;">输入网址并回车，将在外部浏览器中打开</div>
                    <div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;justify-content:center;">
                        <div class="br-shortcut" data-url="https://www.bing.com">🔍 Bing</div>
                        <div class="br-shortcut" data-url="https://www.google.com">🔍 Google</div>
                        <div class="br-shortcut" data-url="https://github.com">🐙 GitHub</div>
                        <div class="br-shortcut" data-url="https://stackoverflow.com">📚 StackOverflow</div>
                        <div class="br-shortcut" data-url="https://developer.mozilla.org">📖 MDN</div>
                    </div>
                    <div id="br-last-opened" style="margin-top:20px;font-size:10px;color:var(--text-muted);font-family:var(--font-mono);"></div>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .br-btn{background:none;border:1px solid var(--border);color:var(--text-secondary);padding:4px 10px;border-radius:var(--radius-sm);cursor:pointer;font-size:12px;transition:all 0.15s;flex-shrink:0;}
            .br-btn:hover:not(:disabled){color:var(--accent);border-color:var(--accent-dim);background:var(--accent-glow);}
            .br-btn:disabled{opacity:0.3;cursor:default;}
            #br-url:focus{border-color:var(--accent-dim)!important;box-shadow:0 0 0 1px var(--accent-glow);}
            .br-shortcut{padding:8px 16px;border-radius:8px;cursor:pointer;background:rgba(160,220,255,0.04);border:1px solid rgba(160,220,255,0.08);font-size:11.5px;color:var(--text-secondary);transition:all 0.15s;user-select:none;}
            .br-shortcut:hover{background:rgba(160,220,255,0.10);border-color:rgba(160,220,255,0.18);color:var(--text-primary);}
            .br-shortcut:active{transform:scale(0.96);}
        `;
        container.appendChild(style);

        const urlInput = container.querySelector('#br-url');
        const backBtn = container.querySelector('#br-back');
        const fwdBtn = container.querySelector('#br-forward');
        const lastOpened = container.querySelector('#br-last-opened');

        function openExternal(url) {
            if (!url) return;
            if (!/^https?:\/\//i.test(url)) {
                if (/^[\w-]+(\.[\w-]+)+/.test(url)) url = 'https://' + url;
                else url = 'https://www.bing.com/search?q=' + encodeURIComponent(url);
            }
            window.open(url, '_blank');
            // Track history
            history.splice(historyIdx + 1);
            history.push(url);
            historyIdx = history.length - 1;
            updateNav();
            lastOpened.textContent = '已打开: ' + url;
            urlInput.value = url;
            win._browserState = { history: [...history], historyIdx };
        }

        function updateNav() {
            backBtn.disabled = historyIdx <= 0;
            fwdBtn.disabled = historyIdx >= history.length - 1;
        }

        backBtn.addEventListener('click', () => {
            if (historyIdx > 0) { historyIdx--; openExternal(history[historyIdx]); }
        });
        fwdBtn.addEventListener('click', () => {
            if (historyIdx < history.length - 1) { historyIdx++; openExternal(history[historyIdx]); }
        });
        container.querySelector('#br-home').addEventListener('click', () => {
            urlInput.value = '';
            lastOpened.textContent = '';
        });
        container.querySelector('#br-go').addEventListener('click', () => openExternal(urlInput.value.trim()));
        urlInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); openExternal(urlInput.value.trim()); }
        });
        urlInput.addEventListener('focus', () => urlInput.select());

        container.querySelectorAll('.br-shortcut').forEach(el => {
            el.addEventListener('click', () => openExternal(el.dataset.url));
        });

        // Restore saved state
        if (win._browserState) {
            history.push(...(win._browserState.history || []));
            historyIdx = win._browserState.historyIdx ?? -1;
            if (historyIdx >= 0 && history[historyIdx]) {
                urlInput.value = history[historyIdx];
                lastOpened.textContent = '已打开: ' + history[historyIdx];
            }
            updateNav();
        }
    }
});
