/* ═══════════════════════════════════════════════════════
   N.O.V.A AETHER OS — Window Manager
   ═══════════════════════════════════════════════════════ */

class WindowStack {
    static _zIndex = 100;
    static next() { return ++this._zIndex; }
}

class OSWindow {
    // 最小窗口创建尺寸（只需显示标题栏图标和控制按钮）
    static MIN_CREATE_W = 104;
    static MIN_CREATE_H = 40;
    // 最小窗口缩放尺寸（拖拽缩放下限）
    static MIN_RESIZE_W = 320;
    static MIN_RESIZE_H = 200;

    constructor(appId, title, contentEl, options = {}) {
        this.id = 'win-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        this.appId = appId;
        this.title = title;
        this.contentEl = contentEl;
        this.state = 'normal'; // normal | minimized | maximized
        this.zIndex = WindowStack.next();
        this.snapSide = null; // 'left' | 'right' | null

        // Position & size
        const desktop = document.getElementById('desktop');
        const dw = desktop.clientWidth;
        const dh = desktop.clientHeight;
        this.x = options.x ?? Math.floor(dw * 0.1 + Math.random() * dw * 0.15);
        this.y = options.y ?? Math.floor(dh * 0.08 + Math.random() * dh * 0.1);
        this.w = Math.max(OSWindow.MIN_CREATE_W, options.w ?? Math.min(900, dw * 0.55));
        this.h = Math.max(OSWindow.MIN_CREATE_H, options.h ?? Math.min(600, dh * 0.65));

        // Save normal geometry for restore
        this._normalGeom = { x: this.x, y: this.y, w: this.w, h: this.h };

        // DOM
        this.element = this._createDOM();
        this._applyGeom();
        this._bindDrag();
        this._bindResize();
        this._bindControls();
    }

    // ── DOM creation ──

    _createDOM() {
        const win = document.createElement('div');
        win.className = 'os-window opening';
        win.id = this.id;
        win.style.zIndex = this.zIndex;

        // Title bar
        const titlebar = document.createElement('div');
        titlebar.className = 'window-titlebar';

        const titleEl = document.createElement('div');
        titleEl.className = 'window-title';
        titleEl.innerHTML = `<span class="window-title-icon"></span><span>${this._esc(this.title)}</span>`;

        const controls = document.createElement('div');
        controls.className = 'window-controls';
        controls.innerHTML = `
            <button class="win-ctrl win-ctrl-minimize" data-action="minimize" title="最小化"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 5H8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
            <button class="win-ctrl win-ctrl-maximize" data-action="maximize" title="全屏"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="1.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/></svg></button>
            <button class="win-ctrl win-ctrl-close" data-action="close" title="关闭"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
        `;

        titlebar.appendChild(titleEl);
        titlebar.appendChild(controls);

        // Body
        const body = document.createElement('div');
        body.className = 'window-body';
        if (this.contentEl) body.appendChild(this.contentEl);

        // Resize handles
        const handles = ['n','s','e','w','ne','nw','se','sw'];
        handles.forEach(dir => {
            const h = document.createElement('div');
            h.className = `resize-handle resize-${dir}`;
            h.dataset.dir = dir;
            win.appendChild(h);
        });

        win.appendChild(titlebar);
        win.appendChild(body);

        // Remove opening class after animation
        win.addEventListener('animationend', () => {
            win.classList.remove('opening', 'restoring', 'closing', 'minimizing');
        }, { once: true });

        return win;
    }

    _esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // ── Geometry ──

    _applyGeom() {
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
        this.element.style.width = this.w + 'px';
        this.element.style.height = this.h + 'px';
    }

    mount(container) {
        container.appendChild(this.element);
    }

    // ── Controls ──

    _bindControls() {
        this.element.querySelector('.window-controls').addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            switch (btn.dataset.action) {
                case 'minimize': this.minimize(); break;
                case 'maximize': this.toggleMaximize(); break;
                case 'close':    this.close(); break;
            }
        });

        // Focus on mousedown
        this.element.addEventListener('mousedown', () => {
            if (typeof windowOS !== 'undefined') windowOS.focusWindow(this.id);
        });
    }

    // ── Drag ──

    _bindDrag() {
        const titlebar = this.element.querySelector('.window-titlebar');
        let dragging = false, startX, startY, origX, origY;

        titlebar.addEventListener('mousedown', e => {
            if (e.target.closest('.window-controls')) return;
            if (this.state === 'maximized') return;
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            origX = this.x;
            origY = this.y;
            document.body.style.cursor = 'grabbing';
            this.element.classList.add('dragging');
            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            this.x = origX + dx;
            this.y = origY + dy;
            this._applyGeom();
            this._checkSnapPreview(e.clientX, e.clientY);
        });

        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            document.body.style.cursor = '';
            this.element.classList.remove('dragging');
            this._removeSnapPreview();
            if (this._pendingSnap) {
                this.snap(this._pendingSnap);
                this._pendingSnap = null;
            }
            if (typeof windowOS !== 'undefined') windowOS._saveLayoutDebounced();
        });
    }

    _checkSnapPreview(mx, my) {
        const desktop = document.getElementById('desktop');
        const rect = desktop.getBoundingClientRect();
        const threshold = 20;
        this._pendingSnap = null;

        let preview = document.querySelector('.snap-preview');
        if (!preview) {
            preview = document.createElement('div');
            preview.className = 'snap-preview';
            document.body.appendChild(preview);
        }

        if (mx <= rect.left + threshold) {
            this._pendingSnap = 'left';
            preview.style.display = 'block';
            preview.style.left = rect.left + 'px';
            preview.style.top = rect.top + 'px';
            preview.style.width = (rect.width / 2) + 'px';
            preview.style.height = rect.height + 'px';
        } else if (mx >= rect.right - threshold) {
            this._pendingSnap = 'right';
            preview.style.display = 'block';
            preview.style.left = (rect.left + rect.width / 2) + 'px';
            preview.style.top = rect.top + 'px';
            preview.style.width = (rect.width / 2) + 'px';
            preview.style.height = rect.height + 'px';
        } else {
            preview.style.display = 'none';
            this._pendingSnap = null;
        }
    }

    _removeSnapPreview() {
        const p = document.querySelector('.snap-preview');
        if (p) p.remove();
    }

    // ── Resize ──

    _bindResize() {
        let resizing = false, dir, startX, startY, origGeom;

        this.element.querySelectorAll('.resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', e => {
                if (this.state === 'maximized') return;
                resizing = true;
                dir = handle.dataset.dir;
                startX = e.clientX;
                startY = e.clientY;
                origGeom = { x: this.x, y: this.y, w: this.w, h: this.h };
                this.element.classList.add('resizing');
                e.preventDefault();
                e.stopPropagation();
            });
        });

        document.addEventListener('mousemove', e => {
            if (!resizing) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const minW = OSWindow.MIN_RESIZE_W;
            const minH = OSWindow.MIN_RESIZE_H;

            if (dir.includes('e')) this.w = Math.max(minW, origGeom.w + dx);
            if (dir.includes('w')) {
                const nw = Math.max(minW, origGeom.w - dx);
                this.x = origGeom.x + origGeom.w - nw;
                this.w = nw;
            }
            if (dir.includes('s')) this.h = Math.max(minH, origGeom.h + dy);
            if (dir.includes('n')) {
                const nh = Math.max(minH, origGeom.h - dy);
                this.y = origGeom.y + origGeom.h - nh;
                this.h = nh;
            }
            this._applyGeom();
        });

        document.addEventListener('mouseup', () => {
            if (resizing) {
                resizing = false;
                this.element.classList.remove('resizing');
                this._normalGeom = { x: this.x, y: this.y, w: this.w, h: this.h };
                if (typeof windowOS !== 'undefined') windowOS._saveLayoutDebounced();
            }
        });
    }

    // ── Window actions ──

    focus() {
        this.zIndex = WindowStack.next();
        this.element.style.zIndex = this.zIndex;
        this.element.classList.add('focused');
        if (typeof windowOS !== 'undefined') windowOS._saveLayoutDebounced();
    }

    unfocus() {
        this.element.classList.remove('focused');
    }

    minimize() {
        if (this.state === 'minimized') return;
        this._normalGeom = { x: this.x, y: this.y, w: this.w, h: this.h };
        this.state = 'minimized';
        this.element.classList.add('minimizing');
        setTimeout(() => {
            this.element.style.display = 'none';
        }, 340);
        if (typeof windowOS !== 'undefined') windowOS._saveLayoutDebounced();
    }

    restore() {
        if (this.state !== 'minimized') return;
        this.state = 'normal';
        this.element.style.display = '';
        this.element.classList.add('restoring');
        this.x = this._normalGeom.x;
        this.y = this._normalGeom.y;
        this.w = this._normalGeom.w;
        this.h = this._normalGeom.h;
        this._applyGeom();
        if (typeof windowOS !== 'undefined') {
            windowOS._updateDockCollapsed();
            windowOS._saveLayoutDebounced();
        }
    }

    toggleMaximize() {
        const desktop = document.getElementById('desktop');
        const rect = desktop.getBoundingClientRect();

        if (this.state === 'maximized') {
            // Restore: animate from full screen → normal geometry
            this.state = 'normal';
            this.element.classList.remove('snap-to-full');

            // Set current visual as starting point
            this.x = 0; this.y = 0;
            this.w = rect.width; this.h = rect.height;
            this._applyGeom();
            this.element.classList.add('maximized');

            // Force layout, then animate to normal
            this.element.getBoundingClientRect();
            this.x = this._normalGeom.x;
            this.y = this._normalGeom.y;
            this.w = this._normalGeom.w;
            this.h = this._normalGeom.h;
            this._applyGeom();

            // Remove class after transition
            const onEnd = () => {
                this.element.classList.remove('maximized', 'snap-to-full');
                this.element.removeEventListener('transitionend', onEnd);
            };
            this.element.addEventListener('transitionend', onEnd);
        } else {
            // Maximize: animate from current → full screen
            this._normalGeom = { x: this.x, y: this.y, w: this.w, h: this.h };
            this.state = 'maximized';

            // Ensure no snap class, force layout
            this.element.classList.remove('snap-to-full');
            this.element.getBoundingClientRect();

            // Set target
            this.x = 0; this.y = 0;
            this.w = rect.width; this.h = rect.height;
            this._applyGeom();

            // After transition, snap to CSS
            const onEnd = () => {
                this.element.classList.add('snap-to-full');
                this.element.removeEventListener('transitionend', onEnd);
            };
            this.element.addEventListener('transitionend', onEnd);
        }
        if (typeof windowOS !== 'undefined') {
            windowOS._updateDockCollapsed();
            windowOS._saveLayoutDebounced();
        }
    }

    snap(side) {
        const desktop = document.getElementById('desktop');
        const dw = desktop.clientWidth;
        const dh = desktop.clientHeight;

        this._normalGeom = { x: this.x, y: this.y, w: this.w, h: this.h };
        this.snapSide = side;

        if (side === 'left') {
            this.x = 0; this.y = 0;
            this.w = dw / 2; this.h = dh;
        } else {
            this.x = dw / 2; this.y = 0;
            this.w = dw / 2; this.h = dh;
        }
        this._applyGeom();
        if (typeof windowOS !== 'undefined') windowOS._saveLayoutDebounced();
    }

    close() {
        this.element.classList.add('closing');
        this.emit('close');
        setTimeout(() => {
            this.element.remove();
            if (typeof windowOS !== 'undefined') {
                windowOS._removeWindow(this.id);
            }
        }, 200);
    }

    setTitle(title) {
        this.title = title;
        const el = this.element.querySelector('.window-title span:last-child');
        if (el) el.textContent = title;
    }

    // Emit event for app integration
    emit(event, data) {
        this.element.dispatchEvent(new CustomEvent(event, { detail: data }));
    }

    on(event, handler) {
        this.element.addEventListener(event, e => handler(e.detail));
    }

    // Set custom context menu handler: handler(x, y, target)
    setContextMenu(handler) {
        this._contextMenuHandler = handler;
    }
}
