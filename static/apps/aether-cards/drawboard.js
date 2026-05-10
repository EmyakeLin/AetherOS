/* ═══════════════════════════════════════════════════════
   手绘板应用 - Aether Cards 子应用
   2:3 比例画布 + 绘图工具 + 导出功能
   ═══════════════════════════════════════════════════════ */

registerApp('drawboard', {
    title: '手绘板',
    icon: '🎨',
    options: { w: 400, h: 600 },
    factory: (container, win, os) => {

        // ── 状态 ──
        let canvas, ctx;
        let isDrawing = false;
        let lastX = 0, lastY = 0;
        let tool = 'pen'; // pen, eraser
        let penColor = '#00e5ff';
        let penSize = 3;
        let eraserSize = 20;

        // 历史记录（用于撤销）
        let history = [];
        let historyIndex = -1;
        const MAX_HISTORY = 50;

        // ── SVG 图标 ──
        const ICO = {
            pen: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12L3.5 8.5L10 2L12 4L5.5 10.5L2 12Z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            eraser: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 12H12M3 8L7 12L11 8L7 4L3 8Z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            undo: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5H9C10.66 5 12 6.34 12 8C12 9.66 10.66 11 9 11H7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 3L3 5L6 7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            clear: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4H11M5 4V3C5 2.45 5.45 2 6 2H8C8.55 2 9 2.45 9 3V4M4 4L5 12H9L10 4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            save: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11 13H3C2.45 13 2 12.55 2 12V2C2 1.45 2.45 1 3 1H9L12 4V12C12 12.55 11.55 13 11 13Z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 13V8H4V13M4 1V4H9" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            export: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1V9M4 6L7 9L10 6M2 11V12H12V11" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            close: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
        };

        // ── DOM 结构 ──
        container.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;background:var(--bg-base);">
                <!-- 工具栏 -->
                <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-surface);">
                    <button class="draw-tb-btn active" id="draw-pen" title="画笔">${ICO.pen}</button>
                    <button class="draw-tb-btn" id="draw-eraser" title="橡皮擦">${ICO.eraser}</button>
                    <div style="width:1px;height:16px;background:var(--border);margin:0 4px;"></div>
                    <input type="color" id="draw-color" value="${penColor}" style="width:28px;height:24px;border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;padding:0;">
                    <div style="display:flex;align-items:center;gap:4px;">
                        <span style="font-size:10px;color:var(--text-muted);">粗细:</span>
                        <input type="range" id="draw-size" min="1" max="20" value="${penSize}" style="width:60px;">
                        <span id="draw-size-label" style="font-size:10px;color:var(--text-muted);min-width:20px;">${penSize}</span>
                    </div>
                    <div style="width:1px;height:16px;background:var(--border);margin:0 4px;"></div>
                    <button class="draw-tb-btn" id="draw-undo" title="撤销">${ICO.undo}</button>
                    <button class="draw-tb-btn" id="draw-clear" title="清空">${ICO.clear}</button>
                    <div style="flex:1;"></div>
                    <button class="draw-tb-btn" id="draw-export-card" title="导出到卡片">${ICO.export} 到卡片</button>
                    <button class="draw-tb-btn" id="draw-export-new" title="新建卡片">${ICO.save} 新卡片</button>
                    <button class="draw-tb-btn" id="draw-export-chat" title="发送到对话">${ICO.export} 到对话</button>
                </div>
                <!-- 画布 -->
                <div style="flex:1;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;background:var(--bg-deep);">
                    <canvas id="draw-canvas" style="background:white;cursor:crosshair;touch-action:none;"></canvas>
                </div>
            </div>
        `;

        // ── 样式 ──
        if (!document.getElementById('drawboard-styles')) {
            const s = document.createElement('style');
            s.id = 'drawboard-styles';
            s.textContent = `
                .draw-tb-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:4px 8px;font-size:11px;font-family:var(--font-body);background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;white-space:nowrap;min-width:28px;min-height:28px;}
                .draw-tb-btn:hover{background:var(--bg-hover);color:var(--text-primary);border-color:var(--accent-dim);}
                .draw-tb-btn.active{background:var(--accent-dim);color:var(--accent);border-color:var(--accent);}
                .draw-tb-btn:active{background:var(--accent-dim);}
            `;
            document.head.appendChild(s);
        }

        // ── DOM 引用 ──
        const penBtn = container.querySelector('#draw-pen');
        const eraserBtn = container.querySelector('#draw-eraser');
        const colorInput = container.querySelector('#draw-color');
        const sizeInput = container.querySelector('#draw-size');
        const sizeLabel = container.querySelector('#draw-size-label');
        const undoBtn = container.querySelector('#draw-undo');
        const clearBtn = container.querySelector('#draw-clear');
        const exportCardBtn = container.querySelector('#draw-export-card');
        const exportNewBtn = container.querySelector('#draw-export-new');
        const exportChatBtn = container.querySelector('#draw-export-chat');
        canvas = container.querySelector('#draw-canvas');
        ctx = canvas.getContext('2d');

        // ── 初始化画布 ──
        function initCanvas() {
            const containerRect = canvas.parentElement.getBoundingClientRect();
            const containerW = containerRect.width;
            const containerH = containerRect.height;

            // 2:3 比例
            let w, h;
            if (containerW / containerH < 2 / 3) {
                w = containerW - 20;
                h = w * 1.5;
            } else {
                h = containerH - 20;
                w = h / 1.5;
            }

            canvas.width = w;
            canvas.height = h;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';

            // 初始白色背景
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, w, h);

            // 保存初始状态
            saveState();
        }

        // ── 历史记录 ──
        function saveState() {
            if (historyIndex < history.length - 1) {
                history = history.slice(0, historyIndex + 1);
            }
            history.push(canvas.toDataURL());
            if (history.length > MAX_HISTORY) {
                history.shift();
            }
            historyIndex = history.length - 1;
        }

        function undo() {
            if (historyIndex > 0) {
                historyIndex--;
                const img = new Image();
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                };
                img.src = history[historyIndex];
            }
        }

        // ── 绘图事件 ──
        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX || e.touches[0].clientX) - rect.left;
            const y = (e.clientY || e.touches[0].clientY) - rect.top;
            return { x, y };
        }

        function startDraw(e) {
            isDrawing = true;
            const pos = getPos(e);
            lastX = pos.x;
            lastY = pos.y;

            // 橡皮擦模式
            if (tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = eraserSize;
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.lineWidth = penSize;
                ctx.strokeStyle = penColor;
            }

            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // 画一个点
            ctx.beginPath();
            ctx.arc(lastX, lastY, ctx.lineWidth / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        function draw(e) {
            if (!isDrawing) return;
            e.preventDefault();

            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();

            lastX = pos.x;
            lastY = pos.y;
        }

        function endDraw() {
            if (isDrawing) {
                isDrawing = false;
                ctx.globalCompositeOperation = 'source-over';
                saveState();
            }
        }

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDraw);
        canvas.addEventListener('mouseleave', endDraw);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
        canvas.addEventListener('touchend', endDraw);

        // ── 工具切换 ──
        function setTool(t) {
            tool = t;
            penBtn.classList.toggle('active', t === 'pen');
            eraserBtn.classList.toggle('active', t === 'eraser');
        }

        penBtn.onclick = () => setTool('pen');
        eraserBtn.onclick = () => setTool('eraser');

        // ── 颜色和粗细 ──
        colorInput.onchange = (e) => { penColor = e.target.value; };
        sizeInput.oninput = (e) => {
            penSize = parseInt(e.target.value);
            sizeLabel.textContent = penSize;
        };

        // ── 操作按钮 ──
        undoBtn.onclick = () => undo();
        clearBtn.onclick = () => {
            if (confirm('确定清空画布？')) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                saveState();
            }
        };

        // ── 导出功能 ──
        function getBlob() {
            return new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });
        }

        async function uploadDrawing() {
            const blob = await getBlob();
            const fd = new FormData();
            fd.append('file', blob, 'drawing.png');
            const r = await fetch('/api/aether-cards/upload', { method: 'POST', body: fd });
            const d = await r.json();
            if (d.ok && d.filename) return d.filename;
            throw new Error('上传失败');
        }

        // 导出到选中的卡片
        exportCardBtn.onclick = async () => {
            try {
                const filename = await uploadDrawing();
                // 通过事件通知cards应用
                win.emit('export-to-card', { filename });
                // 不关闭窗口
            } catch (e) {
                alert('导出失败: ' + e.message);
            }
        };

        // 新建卡片并导出
        exportNewBtn.onclick = async () => {
            try {
                const filename = await uploadDrawing();
                win.emit('export-new-card', { filename });
                // 不关闭窗口
            } catch (e) {
                alert('导出失败: ' + e.message);
            }
        };

        // 发送到对话
        exportChatBtn.onclick = async () => {
            try {
                const filename = await uploadDrawing();
                win.emit('export-to-chat', { filename });
                // 不关闭窗口
            } catch (e) {
                alert('导出失败: ' + e.message);
            }
        };

        // ── 快捷键 ──
        container.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                undo();
            }
            if (e.key === 'p') setTool('pen');
            if (e.key === 'e') setTool('eraser');
        });

        // ── 窗口大小变化时重新调整画布 ──
        const resizeObserver = new ResizeObserver(() => {
            // 保存当前画布内容
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

            // 重新计算尺寸
            const containerRect = canvas.parentElement.getBoundingClientRect();
            const containerW = containerRect.width;
            const containerH = containerRect.height;

            let w, h;
            if (containerW / containerH < 2 / 3) {
                w = containerW - 20;
                h = w * 1.5;
            } else {
                h = containerH - 20;
                w = h / 1.5;
            }

            canvas.width = w;
            canvas.height = h;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';

            // 恢复画布内容
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(tempCanvas, 0, 0, w, h);
        });
        resizeObserver.observe(canvas.parentElement);

        // ── 初始化 ──
        setTimeout(initCanvas, 100);

        // ── 清理 ──
        win.on('close', () => {
            resizeObserver.disconnect();
        });
    }
});
