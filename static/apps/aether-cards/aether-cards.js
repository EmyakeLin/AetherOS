/* ═══════════════════════════════════════════════════════
   N.O.V.A AETHER OS — Aether Cards 应用 v2
   无限画布 + 2:3卡片 + 封面图 + 8点缩放 + 窗口化 + LLM配置
   ═══════════════════════════════════════════════════════ */

const CardsData = { cards: [], canvas: { offsetX: 0, offsetY: 0, zoom: 1 } };
const CardsWSMap = {};
const CardsRefs = {};     // cardId → { container, win, os } (窗口化)
const CardsLLMConfig = { textModels: [], imageModels: [] };

const GRID_SIZE = 20;
const DEFAULT_RATIO = [2, 3];
const DEFAULT_W = 200;
const DEFAULT_H = 300; // 2:3

// ═══════════════════════════════════════════════════════
// 主应用注册
// ═══════════════════════════════════════════════════════

registerApp('aether-cards', {
    title: 'Aether Cards',
    icon: '🃏',
    options: { w: 1000, h: 700 },
    factory: (container, win, os) => {

        // ── 状态 ──
        let cards = [];
        let canvasOffset = { x: 0, y: 0 };
        let canvasZoom = 1;
        let selectedCardId = null;
        let detailCardId = null;
        let saveTimer = null;
        let configSaveTimer = null;

        let currentBoardId = localStorage.getItem('cards-current-board') || 'board-default';
        let _dbAvailable = true;

        // DB 工具
        async function dbQuery(sql, params) { return await os.api('POST', '/api/db/cards/query', { sql, params: params || [] }); }
        async function dbExec(sql, params) { return await os.api('POST', '/api/db/cards/execute', { sql, params: params || [] }); }

        async function initDB() {
            try {
                await dbExec(`CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '默认工作板', canvas_data TEXT DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
                await dbExec(`CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, board_id TEXT NOT NULL, title TEXT DEFAULT '', content TEXT DEFAULT '', cover_image TEXT DEFAULT '', images TEXT DEFAULT '[]', ratio TEXT DEFAULT '[2,3]', position TEXT DEFAULT '{"x":0,"y":0}', size TEXT DEFAULT '{"w":200,"h":300}', windowed INTEGER DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
                await dbExec(`CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, board_id TEXT NOT NULL, title TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
                await dbExec(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, files TEXT DEFAULT '[]', timestamp INTEGER NOT NULL)`);
                await dbExec(`CREATE TABLE IF NOT EXISTS card_chat_map (card_id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, board_id TEXT NOT NULL)`);
                await dbExec(`INSERT OR IGNORE INTO boards (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`, ['board-default', '默认工作板', Date.now(), Date.now()]);
                await migrateFromJSON();
            } catch (e) {
                console.error('[Cards] initDB failed, falling back to JSON mode:', e);
                _dbAvailable = false;
            }
        }

        async function migrateFromJSON() {
            try {
                const existing = await dbQuery(`SELECT COUNT(*) as cnt FROM cards WHERE board_id = 'board-default'`);
                if (existing.rows && existing.rows[0] && existing.rows[0].cnt > 0) return; // 已有数据，跳过
                // 尝试读取旧 JSON
                const old = await os.api('GET', '/api/aether-cards/load');
                if (!old.cards || old.cards.length === 0) return;
                const now = Date.now();
                // 插入卡片
                for (const c of old.cards) {
                    await dbExec(`INSERT OR IGNORE INTO cards (id, board_id, title, content, cover_image, images, ratio, position, size, windowed, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                        [c.id, 'board-default', c.title || '', c.content || '', c.coverImage || '', JSON.stringify(c.images || []), JSON.stringify(c.ratio || [2,3]), JSON.stringify(c.position || {x:0,y:0}), JSON.stringify(c.size || {w:200,h:300}), 0, c.created || now, c.updated || now]);
                }
                // 迁移对话历史
                try {
                    const hist = await os.api('GET', '/api/aether-cards/chat-history');
                    if (hist.conversations) {
                        for (const [id, conv] of Object.entries(hist.conversations)) {
                            await dbExec(`INSERT OR IGNORE INTO conversations (id, board_id, title, created_at, updated_at) VALUES (?,?,?,?,?)`, [id, 'board-default', conv.title || '', conv.created || now, conv.updated || now]);
                            for (const msg of (conv.messages || [])) {
                                await dbExec(`INSERT INTO messages (conversation_id, role, content, files, timestamp) VALUES (?,?,?,?,?)`, [id, msg.role, msg.content, JSON.stringify(msg.files || []), msg.timestamp || now]);
                            }
                        }
                    }
                    if (hist.cardChatMap) {
                        for (const [cardId, convId] of Object.entries(hist.cardChatMap)) {
                            await dbExec(`INSERT OR IGNORE INTO card_chat_map (card_id, conversation_id, board_id) VALUES (?,?,?)`, [cardId, convId, 'board-default']);
                        }
                    }
                } catch {}
                // 更新 board canvas 数据
                if (old.canvas) {
                    await dbExec(`UPDATE boards SET canvas_data = ? WHERE id = 'board-default'`, [JSON.stringify(old.canvas)]);
                }
                console.log('[Cards] Migrated from JSON to SQLite');
            } catch (e) { console.warn('[Cards] Migration skipped:', e.message); }
        }

        // 拖拽
        let isPanning = false, isDragging = false;
        let panStart = { x: 0, y: 0 };
        let dragCard = null, dragStart = { x: 0, y: 0 }, dragCardStart = { x: 0, y: 0 };

        // 缩放
        let isResizing = false, resizeHandle = '', resizeCard = null;
        let resizeStart = { x: 0, y: 0 }, resizeOrig = { x: 0, y: 0, w: 0, h: 0 };

        // ── SVG 图标 ──
        const ICO = {
            back: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7L9 11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            plus: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3V11M3 7H11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
            popout: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7 5L13 1M7 1H13V7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 7V11H5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            restore: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 1H2C1.45 1 1 1.45 1 2V4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><path d="M8 11H10C10.55 11 11 10.55 11 10V8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><path d="M1 4L4 1M11 8L8 11" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`,
            trash: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4H11M5 4V3C5 2.45 5.45 2 6 2H8C8.55 2 9 2.45 9 3V4M4 4L5 12H9L10 4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            image: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.1"/><circle cx="5" cy="5" r="1.2" stroke="currentColor" stroke-width="1"/><path d="M1.5 10L4.5 7L6.5 9L8.5 6.5L12.5 10.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            send: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 1.5L10.5 6L1.5 10.5V7L7.5 6L1.5 4.5V1.5Z" fill="currentColor"/></svg>`,
            folder: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5C2 2.95 2.45 2.5 3 2.5H5.5L7 4.5H11C11.55 4.5 12 4.95 12 5.5V10.5C12 11.05 11.55 11.5 11 11.5H3C2.45 11.5 2 11.05 2 10.5V3.5Z" stroke="currentColor" stroke-width="1.1" fill="none"/></svg>`,
            zoomIn: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.1"/><path d="M9.5 9.5L12.5 12.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><path d="M6 4V8M4 6H8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
            zoomOut: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.1"/><path d="M9.5 9.5L12.5 12.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><path d="M4 6H8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
            zoomReset: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.1"/><text x="7" y="9" text-anchor="middle" fill="currentColor" font-size="7" font-family="var(--font-mono)">1:1</text></svg>`,
            settings: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.1"/><path d="M7 1V3M7 11V13M1 7H3M11 7H13M2.8 2.8L4.2 4.2M9.8 9.8L11.2 11.2M11.2 2.8L9.8 4.2M4.2 9.8L2.8 11.2" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
            toText: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2H10M2 5H8M2 8H10" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`,
            toCard: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1"/><path d="M4 6H8M6 4V8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
            toIDE: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 3L1 6L4 9" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 3L11 6L8 9" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            cover: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1"/><path d="M1 9L4 6L6 8L8 5L11 8" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            close: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
            chat: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2H12V10H5L2 13V2Z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 5H9M5 7.5H8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
            newChat: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3V11M3 7H11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M2 2H12V10H5L2 13V2Z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            history: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.1"/><path d="M7 4V7.5L9.5 9" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            attach: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7.5 3L3.5 7C2.67 7.83 2.67 9.17 3.5 10C4.33 10.83 5.67 10.83 6.5 10L11 5.5C11.55 4.95 11.55 4.05 11 3.5C10.45 2.95 9.55 2.95 9 3.5L5 7.5C4.72 7.78 4.72 8.22 5 8.5C5.28 8.78 5.72 8.78 6 8.5L9.5 5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
            draw: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12L3.5 8.5L10 2L12 4L5.5 10.5L2 12Z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 3.5L10.5 5.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
            pin: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 1.5L12.5 5.5L9 9L10 13L7 10L4 13L5 9L1.5 5.5L5.5 1.5L8.5 1.5Z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            spinner: `<span class="cards-thinking-dots"><span></span><span></span><span></span></span>`,
        };

        const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);

        // 智能滚动：只在用户已在底部时自动滚动
        function smartScroll(el) {
            if (!el) return;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            if (atBottom) el.scrollTop = el.scrollHeight;
        }

        // ═══════════════════════════════════════
        // DOM 结构
        // ═══════════════════════════════════════

        container.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;background:var(--bg-base);">
                <div class="cards-toolbar" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-surface);">
                    <button class="cards-tb-btn" id="cards-add" title="新建卡片">${ICO.plus} 新建</button>
                    <button class="cards-tb-btn" id="cards-draw-board" title="新建手绘板">${ICO.draw} 手绘板</button>
                    <button class="cards-tb-btn" id="cards-chat-toggle" title="显示对话框">${ICO.chat} 对话</button>
                    <button class="cards-tb-btn" id="cards-board-mgr" title="管理工作板">${ICO.folder} <span id="cards-board-name">默认工作板</span></button>
                    <div style="flex:1;"></div>
                    <button class="cards-tb-btn" id="cards-llm-settings" title="LLM 设置">${ICO.settings} LLM</button>
                    <div style="width:1px;height:16px;background:var(--border);margin:0 4px;"></div>
                    <span id="cards-zoom-label" style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);min-width:42px;text-align:center;">100%</span>
                    <button class="cards-tb-btn" id="cards-zoom-out" title="缩小">${ICO.zoomOut}</button>
                    <button class="cards-tb-btn" id="cards-zoom-in" title="放大">${ICO.zoomIn}</button>
                    <button class="cards-tb-btn" id="cards-zoom-reset" title="重置缩放">${ICO.zoomReset}</button>
                    <span style="font-size:11px;color:var(--text-muted);margin-left:8px;" id="cards-count">0 张卡片</span>
                </div>
                <div class="cards-canvas" id="cards-canvas" style="flex:1;overflow:hidden;position:relative;cursor:grab;">
                    <div class="cards-world" id="cards-world" style="position:absolute;top:0;left:0;transform-origin:0 0;"></div>
                    <!-- 选择框层（画布坐标系外，独立于 world） -->
                    <div id="cards-selection-frame" style="display:none;position:absolute;pointer-events:none;z-index:10;">
                        <div class="sel-border" style="position:absolute;border:1.5px solid var(--accent);border-radius:2px;"></div>
                    </div>
                </div>
            </div>

            <!-- 详情 overlay -->
            <div id="cards-detail-overlay" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;z-index:50;background:rgba(0,0,0,0.5);">
                <div id="cards-detail-modal" style="width:80%;height:80%;max-width:960px;max-height:640px;margin:auto;display:flex;flex-direction:column;background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.4);overflow:hidden;">
                    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-elevated);">
                        <button class="cards-tb-btn" id="cards-detail-back">${ICO.back} 画布</button>
                        <input id="cards-detail-title" type="text" placeholder="卡片标题..." style="flex:1;background:transparent;border:1px solid transparent;color:var(--text-primary);font-family:var(--font-body);font-size:14px;padding:4px 8px;border-radius:var(--radius-sm);outline:none;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='transparent'">
                    </div>
                    <div style="display:flex;flex:1;overflow:hidden;">
                        <!-- 左侧 2/3 -->
                        <div style="width:67%;display:flex;flex-direction:column;border-right:1px solid var(--border);overflow:hidden;">
                            <!-- 富文本编辑区 -->
                            <div style="flex:9;display:flex;flex-direction:column;overflow:hidden;">
                                <div class="rich-toolbar" style="display:flex;align-items:center;gap:2px;padding:4px 8px;border-bottom:1px solid var(--border);background:var(--bg-surface);flex-shrink:0;flex-wrap:wrap;">
                                    <button class="cards-tb-btn rich-btn" data-cmd="bold" title="加粗"><b>B</b></button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="italic" title="斜体"><i>I</i></button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="strikeThrough" title="删除线"><s>S</s></button>
                                    <div style="width:1px;height:14px;background:var(--border);margin:0 2px;"></div>
                                    <button class="cards-tb-btn rich-btn" data-cmd="formatBlock" data-val="h2" title="标题">H2</button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="formatBlock" data-val="h3" title="子标题">H3</button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="formatBlock" data-val="p" title="正文">P</button>
                                    <div style="width:1px;height:14px;background:var(--border);margin:0 2px;"></div>
                                    <button class="cards-tb-btn rich-btn" data-cmd="insertUnorderedList" title="无序列表">&#8226; 列表</button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="insertOrderedList" title="有序列表">1. 列表</button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="formatBlock" data-val="blockquote" title="引用">&ldquo;</button>
                                    <div style="width:1px;height:14px;background:var(--border);margin:0 2px;"></div>
                                    <button class="cards-tb-btn rich-btn" data-cmd="createLink" title="插入链接">🔗</button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="removeFormat" title="清除格式">✕</button>
                                </div>
                                <div id="cards-detail-editor" contenteditable="true" style="flex:1;overflow-y:auto;padding:12px;font-family:var(--font-body);font-size:14px;line-height:1.7;color:var(--text-primary);outline:none;" data-placeholder="在此写下你的灵感..."></div>
                            </div>
                            <!-- 图片条 -->
                            <div style="flex:1;display:flex;align-items:center;gap:6px;padding:4px 8px;border-top:1px solid var(--border);background:var(--bg-surface);overflow-x:auto;min-height:48px;flex-shrink:0;">
                                <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${ICO.image} 图片</span>
                                <div id="cards-detail-images" style="display:flex;gap:4px;flex:1;overflow-x:auto;"></div>
                                <button class="cards-tb-btn" id="cards-detail-add-image">${ICO.plus}</button>
                            </div>
                        </div>
                        <!-- 右侧 1/3 LLM 对话 -->
                        <div style="width:33%;display:flex;flex-direction:column;overflow:hidden;">
                            <div style="padding:4px 10px;font-size:11px;color:var(--text-muted);border-bottom:1px solid var(--border);background:var(--bg-surface);display:flex;align-items:center;gap:6px;flex-shrink:0;">
                                <span style="white-space:nowrap;flex-shrink:0;">LLM 对话</span>
                                <select id="cards-model-select" style="margin-left:auto;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-primary);padding:2px 6px;border-radius:var(--radius-sm);font-size:11px;font-family:var(--font-body);outline:none;"></select>
                            </div>
                            <div id="cards-chat-messages" style="flex:1;overflow-y:auto;padding:10px;"></div>
                            <div style="border-top:1px solid var(--border);padding:8px;display:flex;gap:6px;background:var(--bg-surface);flex-shrink:0;">
                                <input id="cards-chat-input" type="text" placeholder="发送消息... (@ 引用图片)" style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-primary);padding:6px 10px;border-radius:var(--radius-sm);font-family:var(--font-body);font-size:12px;outline:none;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
                                <button class="cards-tb-btn" id="cards-chat-send">${ICO.send}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- @ 引用弹出 -->
            <div id="cards-at-popup" style="display:none;position:absolute;z-index:100;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:0 4px 16px rgba(0,0,0,0.4);max-height:200px;overflow-y:auto;min-width:160px;"></div>

            <!-- 图片选择 modal -->
            <div id="cards-image-modal" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;z-index:200;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;">
                <div style="width:500px;max-height:70vh;display:flex;flex-direction:column;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);">
                    <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);"><span style="font-size:13px;color:var(--text-primary);">${ICO.folder} 选择图片</span><div style="flex:1;"></div><button class="cards-tb-btn" id="cards-img-modal-close">${ICO.close}</button></div>
                    <div id="cards-img-modal-bc" style="padding:4px 14px;font-size:11px;color:var(--text-muted);font-family:var(--font-mono);border-bottom:1px solid var(--border);"></div>
                    <div id="cards-img-modal-list" style="flex:1;overflow-y:auto;padding:8px;"></div>
                    <div style="padding:8px 14px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;">
                        <span style="font-size:11px;color:var(--text-muted);">上传：</span>
                        <input type="file" id="cards-img-upload" accept="image/*" style="display:none;">
                        <button class="cards-tb-btn" id="cards-img-upload-btn">选择文件</button>
                    </div>
                </div>
            </div>

            <!-- LLM 配置面板 -->
            <div id="cards-llm-panel" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;z-index:300;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;">
                <div style="width:620px;max-height:80vh;display:flex;flex-direction:column;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);">
                    <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);">
                        <span style="font-size:13px;color:var(--text-primary);">${ICO.settings} LLM 模型配置</span>
                        <div style="flex:1;"></div>
                        <button class="cards-tb-btn" id="cards-llm-close">${ICO.close}</button>
                    </div>
                    <div style="display:flex;flex:1;overflow:hidden;">
                        <!-- 左侧导航 -->
                        <div style="width:140px;border-right:1px solid var(--border);padding:8px;display:flex;flex-direction:column;gap:4px;">
                            <button class="cards-llm-nav active" data-panel="text" style="text-align:left;">文本模型</button>
                            <button class="cards-llm-nav" data-panel="image" style="text-align:left;">文生图模型</button>
                        </div>
                        <!-- 右侧内容 -->
                        <div style="flex:1;overflow-y:auto;padding:12px;">
                            <div id="cards-llm-text-panel" class="cards-llm-section"></div>
                            <div id="cards-llm-image-panel" class="cards-llm-section" style="display:none;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 对话框面板 -->
            <div id="cards-chat-panel" style="display:none;position:absolute;z-index:400;">
                <!-- 对话展示区（持续对话状态显示） -->
                <div id="cards-chat-display" style="display:none;position:absolute;bottom:100%;left:0;right:0;margin-bottom:8px;max-height:60vh;overflow-y:auto;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:0 -4px 20px rgba(0,0,0,0.3);">
                    <div id="cards-chat-messages-float" style="padding:12px;"></div>
                </div>
                <!-- 输入框容器 -->
                <div id="cards-chat-input-wrap" style="display:flex;align-items:flex-end;gap:6px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
                    <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
                        <!-- 工具栏行 -->
                        <div style="display:flex;align-items:center;gap:4px;">
                            <select id="cards-chat-model-float" style="background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-primary);padding:2px 6px;border-radius:var(--radius-sm);font-size:11px;font-family:var(--font-body);outline:none;max-width:180px;"></select>
                            <button class="cards-tb-btn" id="cards-chat-attach" title="上传文件">${ICO.attach}</button>
                            <button class="cards-tb-btn" id="cards-chat-new" title="新建对话">${ICO.newChat}</button>
                            <button class="cards-tb-btn" id="cards-chat-history-btn" title="历史对话">${ICO.history}</button>
                            <div style="flex:1;"></div>
                            <button class="cards-tb-btn" id="cards-chat-close" title="关闭对话框">${ICO.close}</button>
                        </div>
                        <!-- 输入行 -->
                        <div style="display:flex;align-items:flex-end;gap:6px;">
                            <textarea id="cards-chat-input-float" placeholder="发送消息... (Shift+Enter 换行)" style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-primary);padding:8px 10px;border-radius:var(--radius-sm);font-family:var(--font-body);font-size:13px;outline:none;resize:none;min-height:36px;max-height:120px;line-height:1.4;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></textarea>
                            <button class="cards-tb-btn" id="cards-chat-send-float" style="align-self:flex-end;">${ICO.send}</button>
                        </div>
                    </div>
                </div>
                <!-- 历史对话列表 -->
                <div id="cards-chat-history-panel" style="display:none;position:absolute;bottom:100%;left:0;right:0;margin-bottom:8px;max-height:70vh;overflow-y:auto;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:0 -4px 20px rgba(0,0,0,0.3);">
                    <div style="padding:8px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
                        <span style="font-size:12px;color:var(--text-primary);font-weight:500;">历史对话</span>
                        <button class="cards-tb-btn" id="cards-chat-history-close">${ICO.close}</button>
                    </div>
                    <div id="cards-chat-history-list" style="padding:4px;max-height:calc(70vh - 40px);overflow-y:auto;"></div>
                </div>
            </div>
            <!-- 工作板管理面板 -->
            <div id="cards-board-panel" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;z-index:350;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;">
                <div style="width:480px;max-height:70vh;display:flex;flex-direction:column;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);">
                    <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);">
                        <span style="font-size:13px;color:var(--text-primary);">${ICO.folder} 工作板管理</span>
                        <div style="flex:1;"></div>
                        <button class="cards-tb-btn" id="cards-board-close">${ICO.close}</button>
                    </div>
                    <div id="cards-board-list" style="flex:1;overflow-y:auto;padding:8px;"></div>
                    <div style="padding:8px 14px;border-top:1px solid var(--border);display:flex;gap:8px;">
                        <button class="cards-tb-btn" id="cards-board-new">${ICO.plus} 新建工作板</button>
                    </div>
                </div>
            </div>

            <input type="file" id="cards-chat-file-input" accept="image/*,.pdf,.txt,.md,.json,.csv" style="display:none;">
        `;

        // ── DOM 引用 ──
        const canvasEl = container.querySelector('#cards-canvas');
        const worldEl = container.querySelector('#cards-world');
        const zoomLabel = container.querySelector('#cards-zoom-label');
        const countLabel = container.querySelector('#cards-count');
        const selFrame = container.querySelector('#cards-selection-frame');
        const detailOverlay = container.querySelector('#cards-detail-overlay');
        const detailTitle = container.querySelector('#cards-detail-title');
        const detailEditor = container.querySelector('#cards-detail-editor');
        const chatMessages = container.querySelector('#cards-chat-messages');
        const chatInput = container.querySelector('#cards-chat-input');
        const chatSendBtn = container.querySelector('#cards-chat-send');
        const detailImages = container.querySelector('#cards-detail-images');
        const atPopup = container.querySelector('#cards-at-popup');
        const imageModal = container.querySelector('#cards-image-modal');
        const imgModalList = container.querySelector('#cards-img-modal-list');
        const imgModalBc = container.querySelector('#cards-img-modal-bc');
        const imgUploadInput = container.querySelector('#cards-img-upload');
        const llmPanel = container.querySelector('#cards-llm-panel');
        const llmTextPanel = container.querySelector('#cards-llm-text-panel');
        const llmImagePanel = container.querySelector('#cards-llm-image-panel');
        const modelSelect = container.querySelector('#cards-model-select');

        // 对话框相关
        const chatPanel = container.querySelector('#cards-chat-panel');
        const chatDisplay = container.querySelector('#cards-chat-display');
        const chatMessagesFloat = container.querySelector('#cards-chat-messages-float');
        const chatInputWrap = container.querySelector('#cards-chat-input-wrap');
        const chatModelSelectFloat = container.querySelector('#cards-chat-model-float');
        const chatInputFloat = container.querySelector('#cards-chat-input-float');
        const chatSendFloat = container.querySelector('#cards-chat-send-float');
        const chatHistoryPanel = container.querySelector('#cards-chat-history-panel');
        const chatHistoryList = container.querySelector('#cards-chat-history-list');
        const chatFileInput = container.querySelector('#cards-chat-file-input');

        // ── 样式 ──
        if (!document.getElementById('cards-app-styles-v2')) {
            const s = document.createElement('style');
            s.id = 'cards-app-styles-v2';
            s.textContent = `
                .cards-tb-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;font-size:11px;font-family:var(--font-body);background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;white-space:nowrap;}
                .cards-tb-btn:hover{background:var(--bg-hover);color:var(--text-primary);border-color:var(--accent-dim);}
                .cards-tb-btn:active{background:var(--accent-dim);}
                .card-el{position:absolute;border-radius:var(--radius-md);background:var(--bg-surface);border:1px solid var(--border);box-shadow:0 2px 8px rgba(0,0,0,0.2);cursor:grab;display:flex;flex-direction:column;overflow:hidden;transition:box-shadow 0.15s,border-color 0.15s;}
                .card-el:hover{border-color:var(--accent-dim);box-shadow:0 4px 16px rgba(0,0,0,0.3);}
                .card-el.dragging{opacity:0.85;cursor:grabbing;z-index:9999!important;}
                .card-title-bar{display:flex;align-items:center;padding:6px 8px;border-bottom:1px solid var(--border);background:var(--bg-elevated);gap:4px;flex-shrink:0;min-height:28px;}
                .card-title-text{flex:1;font-size:12px;font-family:var(--font-body);color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:text;border:1px solid transparent;padding:1px 4px;border-radius:3px;background:transparent;outline:none;}
                .card-title-text:focus{border-color:var(--accent);background:var(--bg-base);}
                .card-act-btn{display:flex;align-items:center;justify-content:center;width:20px;height:20px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;border-radius:3px;}
                .card-act-btn:hover{color:var(--accent);background:var(--bg-hover);}
                .card-body{flex:1;padding:8px;overflow:hidden;font-size:11px;font-family:var(--font-mono);color:var(--text-secondary);line-height:1.5;word-break:break-word;}
                .card-body h2,.card-body h3{font-size:12px;font-weight:600;margin:4px 0 2px;color:var(--text-primary);}
                .card-body p{margin:2px 0;}
                .card-body strong{font-weight:600;color:var(--text-primary);}
                .card-body em{font-style:italic;}
                .card-body code{font-size:10px;background:var(--bg-elevated);padding:1px 3px;border-radius:2px;}
                .card-body ul,.card-body ol{padding-left:14px;margin:2px 0;}
                .card-cover{width:100%;object-fit:cover;flex-shrink:0;}
                .card-images-strip{display:flex;gap:2px;padding:2px 6px 4px;border-top:1px solid var(--border);overflow-x:auto;flex-shrink:0;}
                .card-images-strip img{width:24px;height:24px;object-fit:cover;border-radius:3px;border:1px solid var(--border);}
                .card-windowed-ph{position:absolute;border-radius:var(--radius-md);background:var(--bg-elevated);border:2px dashed var(--text-muted);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;opacity:0.6;}
                .card-windowed-ph span{font-size:12px;color:var(--text-muted);font-family:var(--font-body);}
                .sel-handle{position:absolute;width:10px;height:10px;border:1.5px solid var(--accent);border-radius:50%;background:var(--bg-base);pointer-events:all;cursor:pointer;z-index:11;}
                .sel-handle:hover{background:var(--accent);border-color:var(--accent);}
                .chat-msg{margin-bottom:10px;}
                .chat-msg-role{font-size:10px;color:var(--text-muted);margin-bottom:2px;font-family:var(--font-body);}
                .chat-msg-content{font-size:12px;color:var(--text-primary);line-height:1.5;font-family:var(--font-body);word-break:break-word;}
                .chat-msg-content pre{background:var(--bg-deep);padding:6px 8px;border-radius:var(--radius-sm);overflow-x:auto;margin:4px 0;font-family:var(--font-mono);font-size:11px;}
                .chat-msg-content code{font-family:var(--font-mono);font-size:11px;background:var(--bg-elevated);padding:1px 4px;border-radius:3px;}
                .chat-msg-actions{display:flex;gap:4px;margin-top:4px;}
                .chat-msg-thinking{font-size:11px;color:var(--text-muted);font-style:italic;padding:4px 0;}
                .chat-msg-error{font-size:11px;color:var(--accent-warm);padding:4px 0;}
                .at-item{padding:6px 10px;cursor:pointer;font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;}
                .at-item:hover{background:var(--bg-hover);color:var(--text-primary);}
                .at-item img{width:20px;height:20px;object-fit:cover;border-radius:3px;}
                .img-modal-item{display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;border-radius:var(--radius-sm);font-size:12px;color:var(--text-secondary);}
                .img-modal-item:hover{background:var(--bg-hover);color:var(--text-primary);}
                .img-modal-item.is-dir{color:var(--accent);}
                .img-modal-item img{width:28px;height:28px;object-fit:cover;border-radius:3px;border:1px solid var(--border);}
                .detail-img-thumb{width:40px;height:40px;object-fit:cover;border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer;flex-shrink:0;position:relative;}
                .detail-img-thumb:hover{border-color:var(--accent);}
                .detail-img-cover{position:absolute;top:-4px;right:-4px;width:14px;height:14px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;color:var(--bg-base);}
                .cards-grid-dots{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:0;}
                .cards-llm-nav{text-align:left;padding:6px 10px;font-size:12px;font-family:var(--font-body);background:transparent;border:1px solid transparent;border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;}
                .cards-llm-nav:hover{background:var(--bg-hover);color:var(--text-primary);}
                .cards-llm-nav.active{background:var(--accent-dim);color:var(--accent);border-color:var(--accent);}
                .llm-provider{background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;margin-bottom:8px;}
                .llm-provider-header{display:flex;align-items:center;gap:6px;margin-bottom:8px;}
                .llm-provider input,.llm-provider select{background:var(--bg-base);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:var(--radius-sm);font-size:12px;font-family:var(--font-body);outline:none;}
                .llm-provider input:focus,.llm-provider select:focus{border-color:var(--accent);}
                .llm-model-row{display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;}
                .llm-model-row label{color:var(--text-secondary);display:flex;align-items:center;gap:4px;cursor:pointer;}
                .llm-model-row input[type=checkbox]{accent-color:var(--accent);}
                .cards-chat-float-enter{animation:cardsChatFloatIn 0.3s ease forwards;}
                .cards-chat-display-enter{animation:cardsChatDisplayIn 0.3s ease forwards;}
                @keyframes cardsChatFloatIn{from{transform:translateY(20px);opacity:0;}to{transform:translateY(0);opacity:1;}}
                @keyframes cardsChatDisplayIn{from{transform:translateX(100%);opacity:0;}to{transform:translateX(0);opacity:1;}}
                .chat-history-item{padding:8px 10px;cursor:pointer;border-radius:var(--radius-sm);font-size:12px;color:var(--text-secondary);border-bottom:1px solid var(--border);}
                .chat-history-item:hover{background:var(--bg-hover);color:var(--text-primary);}
                .chat-history-item:last-child{border-bottom:none;}
                .chat-history-title{font-weight:500;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
                .chat-history-preview{font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
                .chat-history-time{font-size:10px;color:var(--text-muted);float:right;}
                .chat-attached-file{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:11px;color:var(--text-secondary);margin:4px 0;}
                .chat-attached-file img{width:20px;height:20px;object-fit:cover;border-radius:2px;}
                .chat-attached-file button{background:none;border:none;color:var(--text-muted);cursor:pointer;padding:0 2px;}
                .windowed-chat-panel{position:absolute;top:0;right:0;width:150px;height:100%;background:var(--bg-surface);border-left:1px solid var(--border);border-radius:0 8px 8px 0;display:flex;flex-direction:column;z-index:10;transform:translateX(100%);transition:transform 0.3s ease;box-shadow:-4px 0 12px rgba(0,0,0,0.2);}
                .windowed-chat-panel.left{right:auto;left:0;border-left:none;border-right:1px solid var(--border);border-radius:8px 0 0 8px;transform:translateX(-100%);box-shadow:4px 0 12px rgba(0,0,0,0.2);}
                .windowed-chat-panel.show{transform:translateX(0);}
                .chat-thinking-chain{margin-bottom:6px;font-size:11px;line-height:1.5;}
                .chat-thinking-chain:empty{display:none;}
                .chat-thinking-label{display:flex;align-items:center;gap:4px;cursor:pointer;padding:2px 0;color:var(--text-muted);font-size:10px;user-select:none;}
                .chat-thinking-label:hover{color:var(--accent);}
                .chat-thinking-label .scan-line{position:relative;overflow:hidden;}
                .chat-thinking-label .scan-line::after{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,var(--accent),transparent);animation:thinking-scan 2s ease-in-out infinite;}
                @keyframes thinking-scan{0%{left:-100%;}100%{left:100%;}}
                .chat-thinking-label.done .scan-line::after{animation:none;}
                .chat-thinking-body{padding-left:10px;border-left:2px solid var(--accent-dim);color:var(--text-muted);font-style:italic;max-height:200px;overflow-y:auto;opacity:0.7;display:none;}
                .chat-thinking-body.expanded{display:block;}
                .rich-toolbar .cards-tb-btn{padding:3px 6px;font-size:11px;}
                .rich-toolbar .cards-tb-btn.active{background:var(--accent-dim);color:var(--accent);border-color:var(--accent);}
                #cards-detail-editor h2{font-size:18px;font-weight:600;margin:12px 0 6px;color:var(--text-primary);}
                #cards-detail-editor h3{font-size:15px;font-weight:600;margin:10px 0 4px;color:var(--text-primary);}
                #cards-detail-editor blockquote{border-left:3px solid var(--accent);padding-left:10px;margin:8px 0;color:var(--text-secondary);}
                #cards-detail-editor ul,#cards-detail-editor ol{padding-left:20px;margin:6px 0;}
                #cards-detail-editor a{color:var(--accent);text-decoration:underline;}
                #cards-detail-editor pre{background:var(--bg-deep);padding:8px;border-radius:var(--radius-sm);font-family:var(--font-mono);font-size:12px;overflow-x:auto;margin:8px 0;}
                #cards-detail-editor code{font-family:var(--font-mono);font-size:12px;background:var(--bg-elevated);padding:1px 4px;border-radius:3px;}
                #cards-detail-editor pre code{background:none;padding:0;}
                .chat-msg-content h2{font-size:15px;font-weight:600;margin:8px 0 4px;}
                .chat-msg-content h3{font-size:13px;font-weight:600;margin:6px 0 3px;}
                .chat-msg-content blockquote{border-left:3px solid var(--accent);padding-left:8px;margin:6px 0;color:var(--text-secondary);}
                .chat-msg-content ul,.chat-msg-content ol{padding-left:18px;margin:4px 0;}
                .chat-msg-content a{color:var(--accent);}
                .chat-msg-content table{border-collapse:collapse;margin:6px 0;font-size:11px;}
                .chat-msg-content th,.chat-msg-content td{border:1px solid var(--border);padding:4px 8px;text-align:left;}
                .chat-msg-content th{background:var(--bg-elevated);font-weight:500;}
                .katex-display{margin:8px 0;overflow-x:auto;}
                .cards-thinking-dots{display:inline-flex;align-items:center;gap:3px;vertical-align:middle;padding:2px 0;}
                .cards-thinking-dots span{width:4px;height:4px;border-radius:50%;background:var(--accent);display:inline-block;animation:cards-dot-bounce 1.2s ease-in-out infinite;}
                .cards-thinking-dots span:nth-child(2){animation-delay:0.15s;}
                .cards-thinking-dots span:nth-child(3){animation-delay:0.3s;}
                @keyframes cards-dot-bounce{0%,60%,100%{transform:translateY(0);opacity:0.4;}30%{transform:translateY(-4px);opacity:1;}}
                .board-mgr-item{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;border-radius:var(--radius-sm);font-size:12px;color:var(--text-secondary);}
                .board-mgr-item:hover{background:var(--bg-hover);color:var(--text-primary);}
                .board-mgr-item.active{background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent);}
                .board-mgr-item .board-count{font-size:10px;color:var(--text-muted);margin-left:auto;}
                .board-mgr-item .board-actions{display:flex;gap:2px;opacity:0;transition:opacity 0.15s;}
                .board-mgr-item:hover .board-actions{opacity:1;}
                :root{--bg-surface-rgb:30,30,30;}
                [data-theme="light"]{--bg-surface-rgb:255,255,255;}
            `;
            document.head.appendChild(s);
        }

        // ═══════════════════════════════════════
        // 工具栏事件
        // ═══════════════════════════════════════

        container.querySelector('#cards-add').onclick = () => createCard();
        container.querySelector('#cards-zoom-in').onclick = () => setZoom(canvasZoom * 1.2);
        container.querySelector('#cards-zoom-out').onclick = () => setZoom(canvasZoom / 1.2);
        container.querySelector('#cards-zoom-reset').onclick = () => { setZoom(1); canvasOffset = { x: 0, y: 0 }; applyTransform(); scheduleSave(); };
        container.querySelector('#cards-detail-back').onclick = () => closeDetail();
        container.querySelector('#cards-detail-add-image').onclick = () => openImageModal();
        container.querySelector('#cards-img-modal-close').onclick = () => closeImageModal();
        container.querySelector('#cards-img-upload-btn').onclick = () => imgUploadInput.click();
        imgUploadInput.onchange = (e) => handleImageUpload(e);
        chatSendBtn.onclick = () => sendChatMessage();
        chatInput.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } };
        // 模型选择器变化时保存偏好
        modelSelect.onchange = () => { localStorage.setItem('cards-model-pref', modelSelect.value); };
        detailTitle.onchange = () => { const c = gc(detailCardId); if (c) { c.title = detailTitle.value; c.updated = Date.now(); renderCards(); scheduleSave(); } };
        detailEditor.addEventListener('input', () => { const c = gc(detailCardId); if (c) { c.content = htmlToMarkdown(detailEditor.innerHTML); c.updated = Date.now(); scheduleSave(); renderCards(); } });
        container.querySelector('#cards-llm-settings').onclick = () => openLLMPanel();
        container.querySelector('#cards-llm-close').onclick = () => closeLLMPanel();

        // 富文本工具栏
        container.querySelectorAll('.rich-btn').forEach(btn => {
            btn.addEventListener('mousedown', (e) => { e.preventDefault(); }); // 防止失去焦点
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                const val = btn.dataset.val || null;
                if (cmd === 'createLink') {
                    const url = prompt('输入链接地址:', 'https://');
                    if (url) document.execCommand(cmd, false, url);
                } else {
                    document.execCommand(cmd, false, val);
                }
                detailEditor.focus();
            });
        });

        // contentEditable placeholder
        detailEditor.addEventListener('focus', () => {
            if (detailEditor.textContent.trim() === '' && detailEditor.innerHTML === '') {
                detailEditor.innerHTML = '';
            }
        });
        detailEditor.addEventListener('blur', () => {
            if (detailEditor.textContent.trim() === '') {
                detailEditor.innerHTML = '';
            }
        });

        // @ 引用
        chatInput.oninput = () => {
            const v = chatInput.value, p = chatInput.selectionStart, b = v.slice(0, p), ai = b.lastIndexOf('@');
            if (ai >= 0 && (ai === 0 || b[ai - 1] === ' ' || b[ai - 1] === '\n')) {
                const q = b.slice(ai + 1).toLowerCase(), c = gc(detailCardId);
                if (c && c.images.length > 0) { const m = c.images.filter(i => i.toLowerCase().includes(q)); m.length > 0 ? showAtPopup(m, ai, p) : hideAtPopup(); }
                else hideAtPopup();
            } else hideAtPopup();
        };

        // LLM 面板导航
        container.querySelectorAll('.cards-llm-nav').forEach(btn => {
            btn.onclick = () => {
                container.querySelectorAll('.cards-llm-nav').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                llmTextPanel.style.display = btn.dataset.panel === 'text' ? '' : 'none';
                llmImagePanel.style.display = btn.dataset.panel === 'image' ? '' : 'none';
            };
        });

        // ═══════════════════════════════════════
        // 对话框功能
        // ═══════════════════════════════════════

        // 对话状态
        let chatState = 'hidden'; // hidden, new, active
        let currentChatId = null;
        let chatConversations = {}; // { id: { title, messages: [{role, content, files?, timestamp}], created, updated } }
        let attachedFiles = []; // 当前附加的文件
        let cardChatMap = {}; // { cardId: conversationId } 卡片与对话的映射

        // 加载对话历史
        async function loadChatHistory() {
            if (!_dbAvailable) return loadChatHistoryJSON();
            try {
                chatConversations = {};
                cardChatMap = {};
                const convRes = await dbQuery(`SELECT * FROM conversations WHERE board_id = ?`, [currentBoardId]);
                for (const conv of (convRes.rows || [])) {
                    const msgRes = await dbQuery(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp`, [conv.id]);
                    chatConversations[conv.id] = {
                        title: conv.title || '',
                        messages: (msgRes.rows || []).map(m => ({ role: m.role, content: m.content, files: JSON.parse(m.files || '[]'), timestamp: m.timestamp })),
                        created: conv.created_at, updated: conv.updated_at
                    };
                }
                const mapRes = await dbQuery(`SELECT * FROM card_chat_map WHERE board_id = ?`, [currentBoardId]);
                for (const row of (mapRes.rows || [])) {
                    cardChatMap[row.card_id] = row.conversation_id;
                }
            } catch (e) { console.warn('Load chat history failed, trying JSON:', e); await loadChatHistoryJSON(); }
        }
        async function loadChatHistoryJSON() {
            try {
                const d = await os.api('GET', '/api/aether-cards/chat-history');
                if (d.conversations) chatConversations = d.conversations;
                if (d.cardChatMap) cardChatMap = d.cardChatMap;
            } catch (e) { console.warn('JSON load chat history failed:', e); }
        }

        // 保存对话历史
        async function saveChatHistory() {
            if (!_dbAvailable) return saveChatHistoryJSON();
            try {
                for (const [id, conv] of Object.entries(chatConversations)) {
                    await dbExec(`INSERT OR REPLACE INTO conversations (id, board_id, title, created_at, updated_at) VALUES (?,?,?,?,?)`, [id, currentBoardId, conv.title || '', conv.created || Date.now(), conv.updated || Date.now()]);
                    await dbExec(`DELETE FROM messages WHERE conversation_id = ?`, [id]);
                    for (const msg of (conv.messages || [])) {
                        await dbExec(`INSERT INTO messages (conversation_id, role, content, files, timestamp) VALUES (?,?,?,?,?)`, [id, msg.role, msg.content, JSON.stringify(msg.files || []), msg.timestamp || Date.now()]);
                    }
                }
                await dbExec(`DELETE FROM card_chat_map WHERE board_id = ?`, [currentBoardId]);
                for (const [cardId, convId] of Object.entries(cardChatMap)) {
                    await dbExec(`INSERT OR REPLACE INTO card_chat_map (card_id, conversation_id, board_id) VALUES (?,?,?)`, [cardId, convId, currentBoardId]);
                }
            } catch (e) { console.warn('Save chat history failed:', e); }
        }
        function saveChatHistoryJSON() {
            os.api('PUT', '/api/aether-cards/chat-history', { conversations: chatConversations, cardChatMap }).catch(e => console.warn('JSON save chat history failed:', e));
        }

        // 恢复卡片关联的对话到 chatHistory
        function restoreCardChat(cardId) {
            const convId = cardChatMap[cardId];
            if (convId && chatConversations[convId]) {
                chatHistory[cardId] = chatConversations[convId].messages.map(m => ({ role: m.role, content: m.content }));
            }
        }

        // 保存卡片的 chatHistory 到 conversations
        function saveCardChat(cardId) {
            const msgs = chatHistory[cardId];
            if (!msgs || msgs.length === 0) return;
            let convId = cardChatMap[cardId];
            if (!convId) {
                convId = 'card-chat-' + Date.now();
                cardChatMap[cardId] = convId;
            }
            const firstUser = msgs.find(m => m.role === 'user');
            chatConversations[convId] = {
                title: firstUser ? firstUser.content.slice(0, 50) : '卡片对话',
                messages: msgs.map(m => ({ role: m.role, content: m.content, timestamp: Date.now() })),
                created: chatConversations[convId]?.created || Date.now(),
                updated: Date.now()
            };
            saveChatHistory();
        }

        // 切换对话框显示
        function toggleChatPanel() {
            if (chatState === 'hidden') {
                showChatPanel('new');
            } else {
                hideChatPanel();
            }
        }

        // 显示对话框
        function showChatPanel(state) {
            chatPanel.style.display = '';
            chatState = state;

            if (state === 'new') {
                // 新对话状态：居中下方
                chatPanel.style.left = '50%';
                chatPanel.style.bottom = '20px';
                chatPanel.style.transform = 'translateX(-50%)';
                chatPanel.style.width = '500px';
                chatDisplay.style.display = 'none';
                chatHistoryPanel.style.display = 'none';
                attachedFiles = [];
                renderAttachedFiles();
            } else if (state === 'active') {
                // 持续对话状态：右侧
                chatPanel.style.left = '';
                chatPanel.style.right = '20px';
                chatPanel.style.bottom = '20px';
                chatPanel.style.transform = '';
                chatPanel.style.width = '420px';
                chatDisplay.style.display = '';
                chatDisplay.classList.add('cards-chat-display-enter');
                chatHistoryPanel.style.display = 'none';
            }

            renderModelSelector(chatModelSelectFloat);
            const pref = localStorage.getItem('cards-model-pref');
            if (pref) {
                for (const opt of chatModelSelectFloat.options) {
                    if (opt.value === pref) { chatModelSelectFloat.value = pref; break; }
                }
            }

            chatInputFloat.focus();
        }

        // 隐藏对话框
        function hideChatPanel() {
            chatPanel.style.display = 'none';
            chatState = 'hidden';
            chatHistoryPanel.style.display = 'none';
        }

        // 新建对话
        function newChat() {
            currentChatId = null;
            attachedFiles = [];
            renderAttachedFiles();
            chatMessagesFloat.innerHTML = '';
            chatInputFloat.value = '';

            if (chatState === 'active') {
                // 切换回新对话状态
                chatPanel.style.transition = 'all 0.3s ease';
                chatPanel.style.left = '50%';
                chatPanel.style.right = '';
                chatPanel.style.transform = 'translateX(-50%)';
                chatPanel.style.width = '500px';
                chatDisplay.style.display = 'none';
                setTimeout(() => { chatPanel.style.transition = ''; }, 300);
            }
            chatState = 'new';
            chatInputFloat.focus();
        }

        // 渲染对话消息（浮动面板）
        function renderChatMessagesFloat(conversationId) {
            const conv = chatConversations[conversationId];
            if (!conv) return;

            chatMessagesFloat.innerHTML = '';
            conv.messages.forEach((msg, idx) => {
                const d = document.createElement('div');
                d.className = 'chat-msg';
                let content = msg.content;
                if (msg.files && msg.files.length > 0) {
                    content += '<div style="margin-top:4px;">' + msg.files.map(f =>
                        f.type?.startsWith('image/') ?
                            `<img src="/aether-cards-images/${esc(f.name)}" style="max-width:100px;max-height:80px;border-radius:4px;border:1px solid var(--border);">` :
                            `<span class="chat-attached-file">${esc(f.name)}</span>`
                    ).join('') + '</div>';
                }
                d.innerHTML = `<div class="chat-msg-role">${msg.role === 'user' ? '👤 You' : '🤖 Assistant'}</div><div class="chat-msg-content">${fmtChat(content)}</div>`;
                if (msg.role === 'assistant' && msg.thinking) {
                    const t = document.createElement('div');
                    t.className = 'chat-thinking-chain';
                    t.innerHTML = `<div class="chat-thinking-label done"><span class="scan-line">Thinking ></span></div><div class="chat-thinking-body">${esc(msg.thinking)}</div>`;
                    t.querySelector('.chat-thinking-label').addEventListener('click', () => {
                        t.querySelector('.chat-thinking-body').classList.toggle('expanded');
                    });
                    d.insertBefore(t, d.querySelector('.chat-msg-content'));
                }

                // AI回复添加操作按钮
                if (msg.role === 'assistant') {
                    const act = document.createElement('div');
                    act.className = 'chat-msg-actions';
                    act.innerHTML = `<button class="cards-tb-btn" data-action="to-card">${ICO.toCard} 新卡片</button><button class="cards-tb-btn" data-action="to-selected">添加到选中卡片</button>`;
                    act.querySelector('[data-action="to-card"]').onclick = () => addReplyToCard(conversationId, idx, true);
                    act.querySelector('[data-action="to-selected"]').onclick = () => addReplyToCard(conversationId, idx, false);
                    d.appendChild(act);
                }

                chatMessagesFloat.appendChild(d);
            });
            smartScroll(chatMessagesFloat);
        }

        // 发送消息（浮动面板）
        async function sendChatMessageFloat() {
            const text = chatInputFloat.value.trim();
            if (!text && attachedFiles.length === 0) return;

            const model = getSelectedModel(chatModelSelectFloat);
            if (!model || !model.model) {
                appendChatErrorFloat('请先选择模型');
                return;
            }

            // 创建或获取对话
            if (!currentChatId) {
                currentChatId = 'chat-' + Date.now();
                chatConversations[currentChatId] = {
                    title: text.slice(0, 50) || '新对话',
                    messages: [],
                    created: Date.now(),
                    updated: Date.now()
                };
            }

            const conv = chatConversations[currentChatId];
            const userMsg = {
                role: 'user',
                content: text,
                files: [...attachedFiles],
                timestamp: Date.now()
            };
            conv.messages.push(userMsg);
            conv.updated = Date.now();

            // 切换到持续对话状态
            if (chatState === 'new') {
                chatState = 'active';
                chatPanel.style.transition = 'all 0.3s ease';
                chatPanel.style.left = '';
                chatPanel.style.right = '20px';
                chatPanel.style.transform = '';
                chatPanel.style.width = '420px';
                chatDisplay.style.display = '';
                chatDisplay.classList.add('cards-chat-display-enter');
                setTimeout(() => { chatPanel.style.transition = ''; }, 300);
            }

            // 渲染消息
            renderChatMessagesFloat(currentChatId);

            // 清空输入
            chatInputFloat.value = '';
            attachedFiles = [];
            renderAttachedFiles();

            // 调用模型
            await callModelAPIFloat(currentChatId, model, text);

            await saveChatHistory();
        }

        // 调用模型API（浮动面板）
        async function callModelAPIFloat(chatId, model, userText) {
            // 构建消息体
            const conv = chatConversations[chatId];
            const messages = [];

            // 处理历史消息（包括多模态）
            for (const m of conv.messages) {
                if (m.role === 'user' && m.files && m.files.length > 0 && model.multimodal) {
                    // 多模态消息
                    const content = await buildMultimodalFloat(m.content, m.files);
                    messages.push({ role: m.role, content });
                } else {
                    messages.push({ role: m.role, content: m.content });
                }
            }

            // 添加AI消息占位
            const aiMsg = { role: 'assistant', content: '', timestamp: Date.now() };
            conv.messages.push(aiMsg);

            // 渲染AI消息
            const aiMsgEl = document.createElement('div');
            aiMsgEl.className = 'chat-msg';
            aiMsgEl.innerHTML = `<div class="chat-msg-role">🤖 Assistant</div><div class="chat-msg-content">${ICO.spinner} 思考中...</div>`;
            chatMessagesFloat.appendChild(aiMsgEl);
            const aiContentEl = aiMsgEl.querySelector('.chat-msg-content');

            let streamDone = false;
            let floatThinkingEl = null;
            let floatThinkingText = '';
            await os.llm.chat({
                messages,
                model: model.model,
                apiKey: model.key,
                apiBase: model.base,
                appId: 'cards-chat',
                maxTokens: 4096,
                onText: (content) => {
                    aiMsg.content += content;
                    aiContentEl.innerHTML = fmtChat(aiMsg.content);
                    smartScroll(chatMessagesFloat);
                },
                onThinking: (content) => {
                    if (!floatThinkingEl) {
                        floatThinkingEl = document.createElement('div');
                        floatThinkingEl.className = 'chat-thinking-chain';
                        floatThinkingEl.innerHTML = `<div class="chat-thinking-label"><span class="scan-line">Thinking ></span></div><div class="chat-thinking-body"></div>`;
                        floatThinkingEl.querySelector('.chat-thinking-label').addEventListener('click', () => {
                            floatThinkingEl.querySelector('.chat-thinking-body').classList.toggle('expanded');
                        });
                        aiMsgEl.insertBefore(floatThinkingEl, aiContentEl.parentElement);
                    }
                    floatThinkingText += content;
                    floatThinkingEl.querySelector('.chat-thinking-body').textContent = floatThinkingText;
                    floatThinkingEl.querySelector('.chat-thinking-body').classList.add('expanded');
                    smartScroll(chatMessagesFloat);
                },
                onDone: () => {
                    streamDone = true;
                    conv.updated = Date.now();
                    aiMsg.thinking = floatThinkingText;
                    if (floatThinkingEl) floatThinkingEl.querySelector('.chat-thinking-label')?.classList.add('done');
                    addChatActionsFloat(chatId, conv.messages.length - 1, aiMsgEl);
                },
                onError: (msg) => {
                    aiContentEl.innerHTML = `<span style="color:var(--accent-warm);">错误: ${esc(msg)}</span>`;
                },
            });

            if (!streamDone && aiMsg.content) {
                conv.updated = Date.now();
                addChatActionsFloat(chatId, conv.messages.length - 1, aiMsgEl);
            }
        }

        // 构建多模态消息（浮动面板）
        async function buildMultimodalFloat(text, files) {
            const blocks = [{ type: 'text', text }];
            for (const f of files) {
                if (f.type?.startsWith('image/')) {
                    try {
                        const resp = await fetch('/aether-cards-images/' + f.name);
                        const blob = await resp.blob();
                        const b64 = await blobToB64(blob);
                        blocks.push({ type: 'image', source: { type: 'base64', media_type: blob.type || 'image/png', data: b64 } });
                    } catch {}
                }
            }
            return blocks;
        }

        // 添加对话消息操作按钮
        function addChatActionsFloat(chatId, msgIndex, msgEl) {
            const act = document.createElement('div');
            act.className = 'chat-msg-actions';
            act.innerHTML = `<button class="cards-tb-btn" data-action="to-card">${ICO.toCard} 新卡片</button><button class="cards-tb-btn" data-action="to-selected">添加到选中卡片</button>`;
            act.querySelector('[data-action="to-card"]').onclick = () => addReplyToCard(chatId, msgIndex, true);
            act.querySelector('[data-action="to-selected"]').onclick = () => addReplyToCard(chatId, msgIndex, false);
            msgEl.appendChild(act);
        }

        // 渲染附加文件
        function renderAttachedFiles() {
            const wrap = chatInputWrap.querySelector('.chat-attached-files');
            if (wrap) wrap.remove();

            if (attachedFiles.length === 0) return;

            const el = document.createElement('div');
            el.className = 'chat-attached-files';
            el.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px;';
            attachedFiles.forEach((f, idx) => {
                const item = document.createElement('span');
                item.className = 'chat-attached-file';
                if (f.type?.startsWith('image/')) {
                    item.innerHTML = `<img src="/aether-cards-images/${esc(f.name)}"> ${esc(f.name)} <button data-idx="${idx}">×</button>`;
                } else {
                    item.innerHTML = `${esc(f.name)} <button data-idx="${idx}">×</button>`;
                }
                item.querySelector('button').onclick = () => {
                    attachedFiles.splice(idx, 1);
                    renderAttachedFiles();
                };
                el.appendChild(item);
            });
            chatInputWrap.querySelector('div').insertBefore(el, chatInputWrap.querySelector('div').firstChild);
        }

        // 附加文件
        function attachFile() {
            chatFileInput.click();
        }

        chatFileInput.onchange = async (e) => {
            const files = Array.from(e.target.files);
            for (const f of files) {
                const fd = new FormData();
                fd.append('file', f);
                try {
                    const r = await fetch('/api/aether-cards/upload', { method: 'POST', body: fd });
                    const d = await r.json();
                    if (d.ok && d.filename) {
                        attachedFiles.push({ name: d.filename, type: f.type, size: f.size });
                    }
                } catch (err) {
                    console.warn('Upload failed:', err);
                }
            }
            renderAttachedFiles();
            chatFileInput.value = '';
        };

        // 渲染历史对话列表
        function renderChatHistory() {
            chatHistoryList.innerHTML = '';
            const cardConvIds = new Set(Object.values(cardChatMap));
            const sorted = Object.entries(chatConversations).filter(([id]) => !cardConvIds.has(id)).sort((a, b) => b[1].updated - a[1].updated);

            if (sorted.length === 0) {
                chatHistoryList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">暂无历史对话</div>';
                return;
            }

            sorted.forEach(([id, conv]) => {
                const item = document.createElement('div');
                item.className = 'chat-history-item';
                const time = new Date(conv.updated).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const lastMsg = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].content : '';
                item.innerHTML = `
                    <div class="chat-history-title">
                        <span class="chat-history-time">${time}</span>
                        ${esc(conv.title || '无标题')}
                    </div>
                    <div class="chat-history-preview">${esc(lastMsg.slice(0, 60))}</div>
                `;
                item.onclick = () => loadChat(id);
                chatHistoryList.appendChild(item);
            });
        }

        // 加载对话
        function loadChat(chatId) {
            currentChatId = chatId;
            chatHistoryPanel.style.display = 'none';

            // 切换到持续对话状态
            if (chatState !== 'active') {
                chatState = 'active';
                chatPanel.style.transition = 'all 0.3s ease';
                chatPanel.style.left = '';
                chatPanel.style.right = '20px';
                chatPanel.style.transform = '';
                chatPanel.style.width = '420px';
                chatDisplay.style.display = '';
                chatDisplay.classList.add('cards-chat-display-enter');
                setTimeout(() => { chatPanel.style.transition = ''; }, 300);
            }

            renderChatMessagesFloat(chatId);
        }

        // 显示/隐藏历史面板
        function toggleHistoryPanel() {
            if (chatHistoryPanel.style.display === 'none') {
                renderChatHistory();
                chatHistoryPanel.style.display = '';
            } else {
                chatHistoryPanel.style.display = 'none';
            }
        }

        // 添加错误消息
        function appendChatErrorFloat(msg) {
            // 在输入框上方显示临时错误提示
            const toast = document.createElement('div');
            toast.style.cssText = 'position:absolute;bottom:100%;left:0;right:0;margin-bottom:4px;padding:6px 10px;background:var(--accent-warm);color:#fff;font-size:11px;border-radius:var(--radius-sm);text-align:center;opacity:0;transition:opacity 0.2s;z-index:1;';
            toast.textContent = msg;
            chatInputWrap.style.position = 'relative';
            chatInputWrap.appendChild(toast);
            requestAnimationFrame(() => { toast.style.opacity = '1'; });
            setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 200); }, 3000);
        }

        // 添加AI回复到卡片
        function addReplyToCard(chatId, msgIndex, asNewCard) {
            const conv = chatConversations[chatId];
            if (!conv || !conv.messages[msgIndex]) return;

            const msg = conv.messages[msgIndex];
            if (msg.role !== 'assistant') return;

            if (asNewCard) {
                const nc = createCard();
                nc.content = msg.content;
                nc.title = msg.content.slice(0, 30).replace(/\n/g, ' ') || '新卡片';
                nc.updated = Date.now();
                renderCards();
                scheduleSave();
            } else {
                // 添加到当前选中的卡片
                const card = gc(selectedCardId) || gc(detailCardId);
                if (card) {
                    card.content += '\n\n' + msg.content;
                    card.updated = Date.now();
                    if (detailCardId === card.id) detailEditor.innerHTML = markdownToHtml(card.content);
                    renderCards();
                    scheduleSave();
                }
            }
        }

        // 对话框事件绑定
        container.querySelector('#cards-chat-toggle').onclick = () => toggleChatPanel();
        container.querySelector('#cards-chat-close').onclick = () => hideChatPanel();
        container.querySelector('#cards-chat-new').onclick = () => newChat();
        container.querySelector('#cards-chat-history-btn').onclick = () => toggleHistoryPanel();
        container.querySelector('#cards-chat-history-close').onclick = () => { chatHistoryPanel.style.display = 'none'; };
        container.querySelector('#cards-chat-attach').onclick = () => attachFile();
        chatSendFloat.onclick = () => sendChatMessageFloat();
        chatInputFloat.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessageFloat();
            }
        };
        chatModelSelectFloat.onchange = () => { localStorage.setItem('cards-model-pref', chatModelSelectFloat.value); };

        // 自动调整输入框高度
        chatInputFloat.oninput = () => {
            chatInputFloat.style.height = 'auto';
            chatInputFloat.style.height = Math.min(chatInputFloat.scrollHeight, 120) + 'px';
        };

        // ═══════════════════════════════════════
        // 画布平移 & 缩放
        // ═══════════════════════════════════════

        function applyTransform() {
            worldEl.style.transform = `translate(${canvasOffset.x}px,${canvasOffset.y}px) scale(${canvasZoom})`;
            zoomLabel.textContent = Math.round(canvasZoom * 100) + '%';
            updateGridDots();
            updateSelFrame();
        }

        function setZoom(z) {
            const r = canvasEl.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2, oz = canvasZoom;
            canvasZoom = Math.max(0.15, Math.min(4, z));
            canvasOffset.x = cx - (cx - canvasOffset.x) * (canvasZoom / oz);
            canvasOffset.y = cy - (cy - canvasOffset.y) * (canvasZoom / oz);
            applyTransform(); scheduleSave();
        }

        let gridDotsEl = null;
        function updateGridDots() {
            if (!gridDotsEl) { gridDotsEl = document.createElement('div'); gridDotsEl.className = 'cards-grid-dots'; canvasEl.insertBefore(gridDotsEl, worldEl); }
            const sp = Math.max(10, Math.round(GRID_SIZE * canvasZoom));
            gridDotsEl.style.backgroundImage = `radial-gradient(circle,var(--text-muted) 0.8px,transparent 0.8px)`;
            gridDotsEl.style.backgroundSize = `${sp}px ${sp}px`;
            gridDotsEl.style.backgroundPosition = `${canvasOffset.x % sp}px ${canvasOffset.y % sp}px`;
        }

        // 鼠标：平移
        canvasEl.addEventListener('mousedown', (e) => {
            if (e.target !== canvasEl && e.target !== worldEl && !e.target.classList.contains('cards-grid-dots') && e.target !== selFrame) return;
            if (e.button === 0 || e.button === 1) { isPanning = true; panStart = { x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y }; canvasEl.style.cursor = 'grabbing'; e.preventDefault(); }
        });
        canvasEl.addEventListener('wheel', (e) => {
            e.preventDefault();
            const r = canvasEl.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, oz = canvasZoom;
            canvasZoom = Math.max(0.15, Math.min(4, canvasZoom * (e.deltaY < 0 ? 1.1 : 0.9)));
            canvasOffset.x = mx - (mx - canvasOffset.x) * (canvasZoom / oz);
            canvasOffset.y = my - (my - canvasOffset.y) * (canvasZoom / oz);
            applyTransform(); scheduleSave();
        }, { passive: false });

        // 双击创建
        canvasEl.addEventListener('dblclick', (e) => {
            if (e.target !== canvasEl && e.target !== worldEl && !e.target.classList.contains('cards-grid-dots')) return;
            const r = canvasEl.getBoundingClientRect();
            createCard((e.clientX - r.left - canvasOffset.x) / canvasZoom, (e.clientY - r.top - canvasOffset.y) / canvasZoom);
        });
        canvasEl.addEventListener('click', (e) => {
            if (e.target === canvasEl || e.target === worldEl || e.target.classList.contains('cards-grid-dots')) selectCard(null);
        });

        // 全局 mousemove / mouseup
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        function onMouseMove(e) {
            if (isPanning) { canvasOffset.x = e.clientX - panStart.x; canvasOffset.y = e.clientY - panStart.y; applyTransform(); }
            if (isDragging && dragCard) {
                const dx = (e.clientX - dragStart.x) / canvasZoom, dy = (e.clientY - dragStart.y) / canvasZoom;
                dragCard.position.x = snap(dragCardStart.x + dx);
                dragCard.position.y = snap(dragCardStart.y + dy);
                const el = worldEl.querySelector(`[data-cid="${dragCard.id}"]`);
                if (el) { el.style.left = dragCard.position.x + 'px'; el.style.top = dragCard.position.y + 'px'; }
                updateSelFrame();
            }
            if (isResizing && resizeCard) handleResize(e);
        }

        function onMouseUp(e) {
            if (isPanning) { isPanning = false; canvasEl.style.cursor = 'grab'; scheduleSave(); }
            if (isDragging && dragCard) { isDragging = false; const el = worldEl.querySelector(`[data-cid="${dragCard.id}"]`); if (el) el.classList.remove('dragging'); dragCard = null; scheduleSave(); }
            if (isResizing) { isResizing = false; resizeCard = null; canvasEl.style.cursor = 'grab'; scheduleSave(); }
        }

        function snap(v) { return Math.round(v / GRID_SIZE) * GRID_SIZE; }

        // ═══════════════════════════════════════
        // 卡片 CRUD
        // ═══════════════════════════════════════

        function genId() { return 'card-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6); }
        function gc(id) { return cards.find(c => c.id === id); }

        function createCard(x, y) {
            const r = canvasEl.getBoundingClientRect();
            const card = {
                id: genId(), title: '', content: '', images: [], coverImage: '',
                ratio: [...DEFAULT_RATIO],
                position: { x: snap(x ?? (r.width / 2 - canvasOffset.x) / canvasZoom - DEFAULT_W / 2), y: snap(y ?? (r.height / 2 - canvasOffset.y) / canvasZoom - DEFAULT_H / 2) },
                size: { w: DEFAULT_W, h: DEFAULT_H },
                windowed: false, created: Date.now(), updated: Date.now(),
            };
            cards.push(card); renderCard(card); selectCard(card.id); scheduleSave(); updateCount();
            setTimeout(() => { const el = worldEl.querySelector(`[data-cid="${card.id}"] .card-title-text`); if (el) el.focus(); }, 50);
            return card;
        }

        function deleteCard(id) {
            const i = cards.findIndex(c => c.id === id); if (i < 0) return;
            if (CardsRefs[id]) { CardsRefs[id].win.close(); delete CardsRefs[id]; }
            if (CardsWSMap[id]) { CardsWSMap[id].close(); delete CardsWSMap[id]; }
            cards.splice(i, 1);
            worldEl.querySelector(`[data-cid="${id}"]`)?.remove();
            worldEl.querySelector(`[data-ph="${id}"]`)?.remove();
            if (selectedCardId === id) selectCard(null);
            if (detailCardId === id) closeDetail();
            scheduleSave(); updateCount();
        }

        function selectCard(id) {
            if (selectedCardId) worldEl.querySelector(`[data-cid="${selectedCardId}"]`)?.classList.remove('selected');
            selectedCardId = id;
            if (id) worldEl.querySelector(`[data-cid="${id}"]`)?.classList.add('selected');
            updateSelFrame();
        }

        function updateCount() { countLabel.textContent = cards.length + ' 张卡片'; }

        // ═══════════════════════════════════════
        // 卡片渲染
        // ═══════════════════════════════════════

        function renderCards() {
            worldEl.innerHTML = '';
            cards.forEach(c => c.windowed ? renderPlaceholder(c) : renderCard(c));
            updateCount(); updateSelFrame();
        }

        function renderCard(card) {
            worldEl.querySelector(`[data-cid="${card.id}"]`)?.remove();
            const el = document.createElement('div');
            el.className = 'card-el' + (card.id === selectedCardId ? ' selected' : '');
            el.dataset.cid = card.id;
            el.style.left = card.position.x + 'px';
            el.style.top = card.position.y + 'px';
            el.style.width = card.size.w + 'px';
            el.style.height = card.size.h + 'px';

            let inner = '<div class="card-title-bar">';
            inner += `<input class="card-title-text" type="text" value="${esc(card.title)}" placeholder="无标题" data-nd>`;
            inner += `<button class="card-act-btn" title="窗口化" data-nd>${ICO.popout}</button>`;
            inner += `<button class="card-act-btn" title="删除" data-nd>${ICO.trash}</button>`;
            inner += '</div>';

            // 封面图
            if (card.coverImage) {
                inner += `<img class="card-cover" src="/aether-cards-images/${esc(card.coverImage)}" alt="" style="height:${Math.round(card.size.h * 0.45)}px;" loading="lazy">`;
            }

            const preview = card.content ? card.content.slice(0, 500) : '';
            if (preview || !card.coverImage) {
                inner += `<div class="card-body">${markdownToHtml(preview) || '<span style="color:var(--text-muted)">(空卡片)</span>'}</div>`;
            }

            const otherImgs = card.images.filter(i => i !== card.coverImage);
            if (otherImgs.length > 0) {
                inner += `<div class="card-images-strip">${otherImgs.slice(0, 5).map(i => `<img src="/aether-cards-images/${esc(i)}" alt="" loading="lazy">`).join('')}${otherImgs.length > 5 ? `<span style="font-size:10px;color:var(--text-muted);padding:0 2px;">+${otherImgs.length - 5}</span>` : ''}</div>`;
            }
            el.innerHTML = inner;

            // 拖拽
            el.addEventListener('mousedown', (e) => {
                if (e.target.dataset.nd !== undefined) return; if (e.button !== 0) return;
                isDragging = true; dragCard = card; dragStart = { x: e.clientX, y: e.clientY }; dragCardStart = { x: card.position.x, y: card.position.y };
                el.classList.add('dragging'); selectCard(card.id); e.stopPropagation();
            });
            // 双击→详情
            el.addEventListener('dblclick', (e) => { if (e.target.dataset.nd !== undefined) return; openDetail(card.id); e.stopPropagation(); });
            // 标题
            const ti = el.querySelector('.card-title-text');
            ti.addEventListener('change', () => { card.title = ti.value; card.updated = Date.now(); scheduleSave(); });
            ti.addEventListener('mousedown', (e) => e.stopPropagation());
            ti.addEventListener('dblclick', (e) => e.stopPropagation());
            // 弹出/删除
            el.querySelectorAll('.card-act-btn')[0].onclick = (e) => { e.stopPropagation(); popoutCard(card.id); };
            el.querySelectorAll('.card-act-btn')[1].onclick = (e) => { e.stopPropagation(); deleteCard(card.id); };
            el.addEventListener('click', (e) => { if (e.target.dataset.nd !== undefined) return; selectCard(card.id); e.stopPropagation(); });

            worldEl.appendChild(el);
        }

        function renderPlaceholder(card) {
            worldEl.querySelector(`[data-ph="${card.id}"]`)?.remove();
            const el = document.createElement('div');
            el.className = 'card-windowed-ph'; el.dataset.ph = card.id;
            el.style.left = card.position.x + 'px'; el.style.top = card.position.y + 'px';
            el.style.width = card.size.w + 'px'; el.style.height = card.size.h + 'px';
            el.innerHTML = `<span>窗口化</span><button class="cards-tb-btn" data-nd>${ICO.restore} 恢复</button>`;
            el.querySelector('button').onclick = (e) => { e.stopPropagation(); restoreCard(card.id); };
            worldEl.appendChild(el);
        }

        // ═══════════════════════════════════════
        // 选择框 & 8 点缩放
        // ═══════════════════════════════════════

        function updateSelFrame() {
            if (!selectedCardId || detailCardId) { selFrame.style.display = 'none'; return; }
            const card = gc(selectedCardId); if (!card || card.windowed) { selFrame.style.display = 'none'; return; }

            // 卡片在屏幕上的位置
            const sx = card.position.x * canvasZoom + canvasOffset.x;
            const sy = card.position.y * canvasZoom + canvasOffset.y;
            const sw = card.size.w * canvasZoom;
            const sh = card.size.h * canvasZoom;
            const cr = canvasEl.getBoundingClientRect();

            selFrame.style.display = '';
            selFrame.style.left = sx + 'px'; selFrame.style.top = sy + 'px';
            selFrame.style.width = sw + 'px'; selFrame.style.height = sh + 'px';

            // 边框
            const border = selFrame.querySelector('.sel-border');
            border.style.left = '0'; border.style.top = '0'; border.style.width = '100%'; border.style.height = '100%';

            // 8 个手柄
            selFrame.querySelectorAll('.sel-handle').forEach(h => h.remove());
            const handles = [
                { n: 'nw', x: -5, y: -5, c: 'nw-resize' }, { n: 'n', x: sw / 2 - 5, y: -5, c: 'n-resize' },
                { n: 'ne', x: sw - 5, y: -5, c: 'ne-resize' }, { n: 'e', x: sw - 5, y: sh / 2 - 5, c: 'e-resize' },
                { n: 'se', x: sw - 5, y: sh - 5, c: 'se-resize' }, { n: 's', x: sw / 2 - 5, y: sh - 5, c: 's-resize' },
                { n: 'sw', x: -5, y: sh - 5, c: 'sw-resize' }, { n: 'w', x: -5, y: sh / 2 - 5, c: 'w-resize' },
            ];
            handles.forEach(h => {
                const d = document.createElement('div');
                d.className = 'sel-handle'; d.dataset.handle = h.n;
                d.style.left = h.x + 'px'; d.style.top = h.y + 'px'; d.style.cursor = h.c;
                d.addEventListener('mousedown', (e) => {
                    e.stopPropagation(); e.preventDefault();
                    isResizing = true; resizeHandle = h.n; resizeCard = card;
                    resizeStart = { x: e.clientX, y: e.clientY };
                    resizeOrig = { x: card.position.x, y: card.position.y, w: card.size.w, h: card.size.h };
                });
                selFrame.appendChild(d);
            });
        }

        function handleResize(e) {
            const dx = (e.clientX - resizeStart.x) / canvasZoom;
            const dy = (e.clientY - resizeStart.y) / canvasZoom;
            let { x, y, w, h } = resizeOrig;
            const ratio = resizeCard.ratio[0] / resizeCard.ratio[1];
            const minW = 80, minH = 80 * ratio;

            if (resizeHandle.includes('e')) { w = snap(Math.max(minW, w + dx)); h = w / ratio; }
            if (resizeHandle.includes('w')) { const nw = snap(Math.max(minW, w - dx)); x = x + (w - nw); w = nw; h = w / ratio; }
            if (resizeHandle.includes('s')) { h = snap(Math.max(minH, h + dy)); w = h * ratio; }
            if (resizeHandle.includes('n')) { const nh = snap(Math.max(minH, h - dy)); y = y + (h - nh); h = nh; w = h * ratio; }

            // 保证比例：取较大的维度
            if (['nw', 'ne', 'sw', 'se'].includes(resizeHandle)) {
                // 角落拖拽：以宽为主，高跟随
                if (Math.abs(dx) > Math.abs(dy)) { w = snap(Math.max(minW, resizeHandle.includes('w') ? w : resizeOrig.w + dx)); h = w / ratio; }
                else { h = snap(Math.max(minH, resizeHandle.includes('n') ? h : resizeOrig.h + dy)); w = h * ratio; }
                if (resizeHandle.includes('w')) x = resizeOrig.x + resizeOrig.w - w;
                if (resizeHandle.includes('n')) y = resizeOrig.y + resizeOrig.h - h;
            }

            resizeCard.position.x = snap(x); resizeCard.position.y = snap(y);
            resizeCard.size.w = Math.round(w); resizeCard.size.h = Math.round(h);
            resizeCard.updated = Date.now();

            const el = worldEl.querySelector(`[data-cid="${resizeCard.id}"]`);
            if (el) { el.style.left = resizeCard.position.x + 'px'; el.style.top = resizeCard.position.y + 'px'; el.style.width = resizeCard.size.w + 'px'; el.style.height = resizeCard.size.h + 'px'; }
            updateSelFrame();
        }

        // ═══════════════════════════════════════
        // 详情视图
        // ═══════════════════════════════════════

        function openDetail(cardId) {
            const c = gc(cardId); if (!c) return;
            detailCardId = cardId; selFrame.style.display = 'none';
            detailTitle.value = c.title;
            detailEditor.innerHTML = markdownToHtml(c.content);
            renderDetailImages(c);
            restoreCardChat(cardId);
            renderChatMessages(cardId);
            renderModelSelector(modelSelect);
            const pref = localStorage.getItem('cards-model-pref');
            if (pref) { for (const opt of modelSelect.options) { if (opt.value === pref) { modelSelect.value = pref; break; } } }
            detailOverlay.style.display = 'flex';
        }

        function closeDetail() {
            if (detailCardId) saveCardChat(detailCardId);
            detailCardId = null; detailOverlay.style.display = 'none'; hideAtPopup(); updateSelFrame();
        }

        function renderDetailImages(card) {
            detailImages.innerHTML = '';
            card.images.forEach((fn, idx) => {
                const wrap = document.createElement('div'); wrap.style.cssText = 'position:relative;display:inline-block;flex-shrink:0;';
                const img = document.createElement('img'); img.className = 'detail-img-thumb'; img.src = '/aether-cards-images/' + fn; img.title = fn;
                img.onclick = () => { chatInput.value += '@' + fn + ' '; chatInput.focus(); };
                img.oncontextmenu = (e) => { e.preventDefault(); card.images.splice(idx, 1); if (card.coverImage === fn) card.coverImage = ''; card.updated = Date.now(); renderDetailImages(card); renderCards(); scheduleSave(); };
                wrap.appendChild(img);
                // 封面标记
                if (card.coverImage === fn) { const badge = document.createElement('div'); badge.className = 'detail-img-cover'; badge.textContent = '封'; wrap.appendChild(badge); }
                // 设为封面按钮
                const setCover = document.createElement('div');
                setCover.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:var(--accent);font-size:9px;text-align:center;cursor:pointer;padding:1px;display:none;';
                setCover.textContent = '设为封面';
                setCover.onclick = (e) => { e.stopPropagation(); card.coverImage = fn; card.updated = Date.now(); renderDetailImages(card); renderCards(); scheduleSave(); };
                wrap.appendChild(setCover);
                wrap.onmouseenter = () => setCover.style.display = '';
                wrap.onmouseleave = () => setCover.style.display = 'none';
                detailImages.appendChild(wrap);
            });
        }

        // ═══════════════════════════════════════
        // LLM 对话（独立 HTTP 调用 + 文生图 + OS 追踪）
        // ═══════════════════════════════════════

        const chatHistory = {};
        let isStreaming = false;
        let _currentChatEl = null;
        let _currentModelCallId = null;

        // ── 模型选择器 ──
        function renderModelSelector(selectEl) {
            if (!selectEl) return;
            const textModels = CardsLLMConfig.textModels || [];
            const imageModels = CardsLLMConfig.imageModels || [];
            let html = '';
            textModels.forEach(prov => {
                (prov.models || []).forEach(m => {
                    if (!m.name) return;
                    const mm = m.multimodal ? ' [多模态]' : '';
                    html += `<option value="text:${prov.name}:${m.name}" data-type="text" data-prov="${esc(prov.name)}" data-model="${esc(m.name)}" data-key="${esc(prov.apiKey)}" data-base="${esc(prov.apiBase)}" data-mm="${m.multimodal ? '1' : '0'}">${esc(prov.name)}/${esc(m.name)}${mm}</option>`;
                });
            });
            if (imageModels.length > 0 && imageModels.some(p => (p.models || []).length > 0)) {
                html += `<option disabled>── 文生图 ──</option>`;
                imageModels.forEach(prov => {
                    (prov.models || []).forEach(m => {
                        if (!m.name) return;
                        html += `<option value="img:${prov.name}:${m.name}" data-type="img" data-prov="${esc(prov.name)}" data-model="${esc(m.name)}" data-key="${esc(prov.apiKey)}" data-base="${esc(prov.apiBase)}">🎨 ${esc(prov.name)}/${esc(m.name)}</option>`;
                    });
                });
            }
            selectEl.innerHTML = html || '<option value="">请先配置 LLM 模型</option>';
        }

        function getSelectedModel(selectEl) {
            if (!selectEl || !selectEl.selectedOptions[0]) return null;
            const opt = selectEl.selectedOptions[0];
            return {
                type: opt.dataset.type || 'text',
                prov: opt.dataset.prov || '',
                model: opt.dataset.model || '',
                key: opt.dataset.key || '',
                base: opt.dataset.base || '',
                multimodal: opt.dataset.mm === '1',
            };
        }

        // ── 聊天元素定位 ──
        function getMsgsEl(cardId) {
            if (detailCardId === cardId) return chatMessages;
            return CardsRefs[cardId]?.container?.querySelector('.cr-chat-msgs');
        }
        function getWinChatEls(cardId) {
            const con = CardsRefs[cardId]?.container;
            if (!con) return null;
            return { input: con.querySelector('.cr-chat-input'), send: con.querySelector('.cr-chat-send'), select: con.querySelector('.cr-model-select') };
        }
        function getActiveChatInput(cardId) {
            if (detailCardId === cardId) return chatInput;
            return CardsRefs[cardId]?.container?.querySelector('.cr-chat-input');
        }
        function getActiveModelSelect(cardId) {
            if (detailCardId === cardId) return modelSelect;
            return CardsRefs[cardId]?.container?.querySelector('.cr-model-select');
        }

        // ── 追踪：启用/禁用输入 ──
        function setChatEnabled(cardId, enabled) {
            isStreaming = !enabled;
            // 主 overlay
            chatSendBtn.disabled = !enabled; chatInput.disabled = !enabled;
            if (enabled) chatInput.focus();
            // 窗口化卡片
            const w = getWinChatEls(cardId);
            if (w) { w.send.disabled = !enabled; w.input.disabled = !enabled; if (enabled) w.input.focus(); }
        }

        // ── 流式渲染状态 ──
        let _streamRawText = '';
        let _streamThinkingEl = null;
        let _streamThinkingText = '';

        // ── 消息渲染（流式） ──
        function appendChatText(cardId, text) {
            const el = getMsgsEl(cardId); if (!el) return;
            if (!_currentChatEl) {
                _currentChatEl = document.createElement('div'); _currentChatEl.className = 'chat-msg';
                _currentChatEl.innerHTML = `<div class="chat-msg-role">🤖 Assistant</div><div class="chat-msg-content">${ICO.spinner} 思考中...</div>`;
                el.appendChild(_currentChatEl);
                _streamRawText = '';
                _streamThinkingEl = null;
                _streamThinkingText = '';
            }
            _streamRawText += text;
            _currentChatEl.querySelector('.chat-msg-content').innerHTML = fmtChat(_streamRawText);
            smartScroll(el);
        }

        function appendChatThinking(cardId, content) {
            const el = getMsgsEl(cardId); if (!el) return;
            if (!_streamThinkingEl) {
                _streamThinkingEl = document.createElement('div');
                _streamThinkingEl.className = 'chat-thinking-chain';
                _streamThinkingEl.innerHTML = `<div class="chat-thinking-label"><span class="scan-line">Thinking ></span></div><div class="chat-thinking-body"></div>`;
                _streamThinkingEl.querySelector('.chat-thinking-label').addEventListener('click', () => {
                    _streamThinkingEl.querySelector('.chat-thinking-body').classList.toggle('expanded');
                });
                el.appendChild(_streamThinkingEl);
                _streamThinkingText = '';
            }
            _streamThinkingText += content;
            _streamThinkingEl.querySelector('.chat-thinking-body').textContent = _streamThinkingText;
            _streamThinkingEl.querySelector('.chat-thinking-body').classList.add('expanded');
            smartScroll(el);
        }

        function appendChatError(cardId, m) { const el = getMsgsEl(cardId); if (!el) return; const d = document.createElement('div'); d.className = 'chat-msg-error'; d.textContent = '错误: ' + m; el.appendChild(d); }

        function appendChatImage(cardId, filename, revisedPrompt) {
            const el = getMsgsEl(cardId); if (!el) return;
            const msg = document.createElement('div'); msg.className = 'chat-msg';
            let html = `<div class="chat-msg-role">🎨 生成图片</div>`;
            html += `<div class="chat-msg-content"><img src="/aether-cards-images/${esc(filename)}" style="max-width:100%;border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer;" title="点击添加到卡片图片"></div>`;
            if (revisedPrompt) html += `<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">${esc(revisedPrompt)}</div>`;
            html += `<div class="chat-msg-actions"><button class="cards-tb-btn">${ICO.plus} 添加到卡片</button></div>`;
            msg.innerHTML = html;
            msg.querySelector('img').onclick = () => window.open('/aether-cards-images/' + filename, '_blank');
            msg.querySelector('.chat-msg-actions button').onclick = () => {
                const card = gc(cardId);
                if (card && !card.images.includes(filename)) { card.images.push(filename); card.updated = Date.now(); if (detailCardId === cardId) renderDetailImages(card); renderCards(); scheduleSave(); }
            };
            el.appendChild(msg); smartScroll(el);
        }

        // ── 完成消息（添加操作按钮） ──
        function finalizeChat(cardId) {
            if (!_currentChatEl) return;
            const txt = _streamRawText || _currentChatEl.querySelector('.chat-msg-content').textContent;
            const thinking = _streamThinkingText || '';
            // 停止扫描动画
            if (_streamThinkingEl) _streamThinkingEl.querySelector('.chat-thinking-label')?.classList.add('done');
            addChatActionButtons(cardId, txt, _currentChatEl);
            if (!chatHistory[cardId]) chatHistory[cardId] = [];
            chatHistory[cardId].push({ role: 'assistant', content: txt, thinking });
            _currentChatEl = null; _streamRawText = ''; _streamThinkingEl = null; _streamThinkingText = '';
            saveCardChat(cardId);
        }

        function addChatActionButtons(cardId, txt, msgEl) {
            const act = document.createElement('div'); act.className = 'chat-msg-actions';
            act.innerHTML = `<button class="cards-tb-btn">${ICO.toText} 文本区</button><button class="cards-tb-btn">${ICO.toCard} 新卡片</button><button class="cards-tb-btn">${ICO.toIDE} IDE</button>`;
            act.children[0].onclick = () => {
                const c = gc(cardId); if (c) {
                    c.content += '\n\n' + txt; c.updated = Date.now();
                    if (detailCardId === cardId) detailEditor.innerHTML = markdownToHtml(c.content);
                    const wTxt = CardsRefs[cardId]?.container?.querySelector('.cr-det-editor');
                    if (wTxt) wTxt.innerHTML = markdownToHtml(c.content);
                    renderCards(); scheduleSave();
                }
            };
            act.children[1].onclick = () => { const nc = createCard(); nc.content = txt; nc.title = txt.slice(0, 30).replace(/\n/g, ' ') || '新卡片'; nc.updated = Date.now(); renderCards(); scheduleSave(); };
            act.children[2].onclick = () => { if (AppRegistry.ide) { const iw = os.openApp('ide'); if (iw) iw.emit('insert-text', { text: txt }); } };
            msgEl.appendChild(act);
        }

        function renderChatMessages(cardId, msgsEl) {
            const el = msgsEl || getMsgsEl(cardId); if (!el) return;
            el.innerHTML = '';
            (chatHistory[cardId] || []).forEach((m, idx) => {
                const d = document.createElement('div'); d.className = 'chat-msg';
                d.innerHTML = `<div class="chat-msg-role">${m.role === 'user' ? '👤 You' : '🤖 Assistant'}</div><div class="chat-msg-content">${fmtChat(m.content)}</div>`;
                if (m.role === 'assistant' && m.thinking) {
                    const t = document.createElement('div');
                    t.className = 'chat-thinking-chain';
                    t.innerHTML = `<div class="chat-thinking-label done"><span class="scan-line">Thinking ></span></div><div class="chat-thinking-body">${esc(m.thinking)}</div>`;
                    t.querySelector('.chat-thinking-label').addEventListener('click', () => {
                        t.querySelector('.chat-thinking-body').classList.toggle('expanded');
                    });
                    d.insertBefore(t, d.querySelector('.chat-msg-content'));
                }
                if (m.role === 'assistant') addChatActionButtons(cardId, m.content, d);
                el.appendChild(d);
            });
            smartScroll(el);
        }

        // ── 发送消息（HTTP 流式 / 文生图） ──
        function sendChatMessage(cardId, inputEl, selectEl) {
            cardId = cardId || detailCardId;
            inputEl = inputEl || chatInput;
            selectEl = selectEl || modelSelect;
            const text = inputEl.value.trim();
            if (!text || isStreaming || !cardId) return;

            const card = gc(cardId); if (!card) return;
            const model = getSelectedModel(selectEl);
            if (!model || !model.model) { appendChatError(cardId, '请先选择模型'); return; }

            const msgsEl = getMsgsEl(cardId);
            if (!chatHistory[cardId]) chatHistory[cardId] = [];
            chatHistory[cardId].push({ role: 'user', content: text });

            // 显示用户消息
            const uEl = document.createElement('div'); uEl.className = 'chat-msg';
            uEl.innerHTML = `<div class="chat-msg-role">👤 You</div><div class="chat-msg-content">${fmtChat(text)}</div>`;
            if (msgsEl) { msgsEl.appendChild(uEl); smartScroll(msgsEl); }

            if (model.type === 'img') {
                // 文生图
                sendImageGen(cardId, text, model, msgsEl);
            } else {
                // 文本 LLM
                sendTextChat(cardId, card, text, model, msgsEl);
            }

            inputEl.value = ''; hideAtPopup();
        }

        // ── 文本 LLM 流式调用（通过统一 LLM 接口）──
        async function sendTextChat(cardId, card, text, model, msgsEl) {
            setChatEnabled(cardId, false);
            _currentChatEl = null;

            const ctx = card.content ? `[卡片内容]\n标题: ${card.title || '无标题'}\n内容:\n${card.content}\n\n` : '';
            const full = ctx + text;

            // 构建消息体
            let messages = [{ role: 'user', content: full }];
            const atRefs = parseAt(text, card);
            if (atRefs.length > 0 && model.multimodal) {
                const content = await buildMultimodal(full, atRefs);
                messages = [{ role: 'user', content }];
            }

            // 历史消息
            const history = (chatHistory[cardId] || []).slice(0, -1).map(m => ({ role: m.role, content: m.content }));
            messages = [...history, ...messages];

            let streamDone = false;
            await os.llm.chat({
                messages,
                model: model.model,
                apiKey: model.key,
                apiBase: model.base,
                appId: 'cards',
                maxTokens: 4096,
                onText: (content) => { appendChatText(cardId, content); },
                onThinking: (content) => { appendChatThinking(cardId, content); },
                onDone: () => { streamDone = true; finalizeChat(cardId); },
                onError: (msg) => { appendChatError(cardId, msg); },
            });

            if (!streamDone && _currentChatEl) finalizeChat(cardId);
            setChatEnabled(cardId, true);
        }

        // ── 文生图调用（通过统一 LLM 接口）──
        async function sendImageGen(cardId, prompt, model, msgsEl) {
            setChatEnabled(cardId, false);

            // 显示生成中提示
            const thinking = document.createElement('div'); thinking.className = 'chat-msg-thinking'; thinking.textContent = '正在生成图片...';
            if (msgsEl) { msgsEl.appendChild(thinking); smartScroll(msgsEl); }

            try {
                const data = await os.llm.generateImage({
                    prompt,
                    model: model.model,
                    apiKey: model.key,
                    apiBase: model.base,
                    appId: 'cards',
                });

                if (data.error) throw new Error(data.error);

                if (thinking.parentNode) thinking.remove();
                appendChatImage(cardId, data.filename, data.revised_prompt);

                // 自动添加到卡片图片
                const card = gc(cardId);
                if (card && !card.images.includes(data.filename)) {
                    card.images.push(data.filename); card.updated = Date.now();
                    if (detailCardId === cardId) renderDetailImages(card); renderCards(); scheduleSave();
                }
            } catch (e) {
                if (thinking.parentNode) thinking.remove();
                appendChatError(cardId, e.message);
            }

            setChatEnabled(cardId, true);
        }

        // ── 工具函数 ──
        function parseAt(text, card) { const r = []; const re = /@([^\s@]+)/g; let m; while ((m = re.exec(text)) !== null) { if (card.images.includes(m[1])) r.push(m[1]); } return r; }
        async function buildMultimodal(text, refs) {
            const blocks = [{ type: 'text', text }];
            for (const fn of refs) { try { const resp = await fetch('/aether-cards-images/' + fn); const blob = await resp.blob(); const b64 = await blobToB64(blob); blocks.push({ type: 'image', source: { type: 'base64', media_type: blob.type || 'image/png', data: b64 } }); } catch {} }
            return blocks;
        }
        function blobToB64(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(b); }); }
        function fmtChat(t) {
            if (!t) return '';
            let h = t;
            if (window.katex) {
                h = h.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => { try { return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false }); } catch { return '<pre>' + esc(tex) + '</pre>'; } });
                h = h.replace(/\$([^\$\n`]+?)\$/g, (_, tex) => { try { return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false }); } catch { return esc('$' + tex + '$'); } });
            }
            if (window.marked) {
                marked.setOptions({ breaks: true, gfm: true });
                h = marked.parse(h);
            } else {
                h = esc(h);
                h = h.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
                h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
                h = h.replace(/\n/g, '<br>');
            }
            return h;
        }

        // ── 渲染库加载 ──
        async function loadRenderLibs() {
            if (window.marked) return;
            try {
                await new Promise((res, rej) => {
                    const s = document.createElement('script');
                    s.src = 'https://cdn.jsdelivr.net/npm/marked@15/marked.min.js';
                    s.onload = res; s.onerror = rej;
                    document.head.appendChild(s);
                });
            } catch (e) { console.warn('Failed to load marked.js:', e); }
            try {
                await Promise.all([
                    new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }),
                    new Promise((res, rej) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css'; l.onload = res; l.onerror = rej; document.head.appendChild(l); })
                ]);
            } catch (e) { console.warn('Failed to load KaTeX:', e); }
        }

        // ── HTML ↔ Markdown 转换 ──
        function htmlToMarkdown(html) {
            if (!html || html.trim() === '') return '';
            let md = html;
            md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
            md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
            md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
            md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n');
            md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
            md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
            md = md.replace(/<i>(.*?)<\/i>/gi, '*$1*');
            md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
            md = md.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
            md = md.replace(/<del>(.*?)<\/del>/gi, '~~$1~~');
            md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) => c.replace(/<[^>]+>/g, '').split('\n').map(l => '> ' + l).join('\n') + '\n');
            md = md.replace(/<li>(.*?)<\/li>/gi, '- $1\n');
            md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
            md = md.replace(/<br\s*\/?>/gi, '\n');
            md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
            md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n');
            md = md.replace(/<[^>]+>/g, '');
            md = md.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
            md = md.replace(/\n{3,}/g, '\n\n');
            return md.trim();
        }

        function markdownToHtml(md) {
            if (!md || md.trim() === '') return '';
            if (window.marked) {
                marked.setOptions({ breaks: true, gfm: true });
                return marked.parse(md);
            }
            // fallback: 纯文本
            return esc(md).replace(/\n/g, '<br>');
        }

        // ═══════════════════════════════════════
        // @ 引用弹出
        // ═══════════════════════════════════════

        function showAtPopup(imgs, atPos, curPos) {
            atPopup.innerHTML = '';
            imgs.forEach(fn => { const it = document.createElement('div'); it.className = 'at-item'; it.innerHTML = `<img src="/aether-cards-images/${esc(fn)}" alt="">${esc(fn)}`; it.onclick = () => { chatInput.value = chatInput.value.slice(0, atPos) + '@' + fn + ' ' + chatInput.value.slice(curPos); chatInput.focus(); hideAtPopup(); }; atPopup.appendChild(it); });
            const ir = chatInput.getBoundingClientRect(), cr = container.getBoundingClientRect();
            atPopup.style.left = (ir.left - cr.left) + 'px'; atPopup.style.bottom = (cr.bottom - ir.top + 4) + 'px'; atPopup.style.display = '';
        }
        function hideAtPopup() { atPopup.style.display = 'none'; }
        document.addEventListener('click', (e) => { if (!atPopup.contains(e.target) && e.target !== chatInput) hideAtPopup(); });

        // ═══════════════════════════════════════
        // 图片选择 modal
        // ═══════════════════════════════════════

        let imgModalPath = '';
        function openImageModal() { imageModal.style.display = 'flex'; imgModalPath = ''; browseDir(''); }
        function closeImageModal() { imageModal.style.display = 'none'; }

        async function browseDir(path) {
            imgModalPath = path; imgModalBc.textContent = path || '/';
            imgModalList.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:12px;">加载中...</div>';
            try {
                const d = await os.api('GET', '/api/fs/list?path=' + encodeURIComponent(path));
                if (d.error) { imgModalList.innerHTML = `<div style="padding:12px;color:var(--accent-warm);font-size:12px;">${esc(d.error)}</div>`; return; }
                const items = (d.items || []).sort((a, b) => a.is_dir !== b.is_dir ? (a.is_dir ? -1 : 1) : a.name.localeCompare(b.name));
                imgModalList.innerHTML = '';
                if (path) { const up = document.createElement('div'); up.className = 'img-modal-item'; up.innerHTML = `${ICO.back} <span>..</span>`; up.onclick = () => browseDir(path.split('/').slice(0, -1).join('/') || ''); imgModalList.appendChild(up); }
                items.forEach(it => {
                    if (!it.is_dir && !IMAGE_EXTS.has('.' + it.name.split('.').pop().toLowerCase())) return;
                    const row = document.createElement('div'); row.className = 'img-modal-item' + (it.is_dir ? ' is-dir' : '');
                    if (it.is_dir) { row.innerHTML = `${ICO.folder} <span>${esc(it.name)}</span>`; row.onclick = () => browseDir(d.path + '/' + it.name); }
                    else { row.innerHTML = `<img src="/aether-cards-images/${encodeURIComponent(it.name)}" alt="" onerror="this.style.display='none'"> <span>${esc(it.name)}</span>`; row.onclick = () => selectFromModal(d.path + '/' + it.name, it.name); }
                    imgModalList.appendChild(row);
                });
                if (imgModalList.children.length === 0 || (!items.some(i => i.is_dir || IMAGE_EXTS.has('.' + i.name.split('.').pop().toLowerCase())))) { if (!path) imgModalList.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:12px;">无图片文件</div>'; }
            } catch (e) { imgModalList.innerHTML = `<div style="padding:12px;color:var(--accent-warm);font-size:12px;">${esc(e.message)}</div>`; }
        }

        async function selectFromModal(fullPath, filename) {
            const card = gc(detailCardId); if (!card) return;
            // 确保图片在卡片存储中
            try { const r = await fetch('/aether-cards-images/' + encodeURIComponent(filename)); if (!r.ok) await os.api('POST', '/api/exec', { command: `cp "${fullPath}" ~/.aetheros/aether-cards/images/` }); } catch {}
            if (!card.images.includes(filename)) card.images.push(filename);
            card.updated = Date.now(); renderDetailImages(card); renderCards(); scheduleSave(); closeImageModal();
        }

        async function handleImageUpload(e) {
            const f = e.target.files[0]; if (!f) return;
            const card = gc(detailCardId); if (!card) return;
            const fd = new FormData(); fd.append('file', f);
            try { const r = await fetch('/api/aether-cards/upload', { method: 'POST', body: fd }); const d = await r.json(); if (d.ok && d.filename) { card.images.push(d.filename); card.updated = Date.now(); renderDetailImages(card); renderCards(); scheduleSave(); } } catch {}
            imgUploadInput.value = '';
        }

        // ═══════════════════════════════════════
        // 窗口化（卡片本身弹出，固定 2:3 比例窗口）
        // ═══════════════════════════════════════

        function popoutCard(cardId) {
            const card = gc(cardId); if (!card || card.windowed) return;
            card.windowed = true; card.updated = Date.now();
            if (detailCardId === cardId) closeDetail();

            // 使用card.ratio来计算正确的宽高比
            // card.ratio现在应该与card.size一致（在load时已修正）
            const ratio = card.ratio[0] / card.ratio[1];
            const winW = card.size.w;
            const winH = Math.round(winW / ratio);

            const appId = 'cards-win-' + cardId;
            if (!AppRegistry[appId]) {
                registerApp(appId, {
                    title: card.title || 'Aether Cards',
                    icon: '🃏',
                    options: { w: winW, h: winH },
                    factory: (cCon, cWin, cOs) => {
                        CardsRefs[cardId] = { container: cCon, win: cWin, os: cOs };
                        renderWindowedCard(cardId, cCon, cWin);

                        // 锁定窗口大小（禁用调整大小手柄）
                        cWin.element.querySelectorAll('.resize-handle').forEach(h => { h.style.display = 'none'; });
                        // 禁用最大化按钮
                        const maxBtn = cWin.element.querySelector('.win-ctrl-maximize');
                        if (maxBtn) maxBtn.style.display = 'none';

                        cWin.on('close', () => {
                            // 清理悬浮对话面板
                            const floatingPanel = document.querySelector('.windowed-chat-floating');
                            if (floatingPanel) {
                                if (floatingPanel._moveObserver) floatingPanel._moveObserver.disconnect();
                                floatingPanel.remove();
                            }
                            delete CardsRefs[cardId]; delete AppRegistry[appId];
                            const c = gc(cardId); if (c) { c.windowed = false; renderCards(); scheduleSave(); }
                        });
                    }
                });
            }
            os.openApp(appId); renderCards(); scheduleSave();
        }

        function restoreCard(cardId) {
            const card = gc(cardId); if (!card) return;
            card.windowed = false; card.updated = Date.now();
            if (CardsRefs[cardId]) { CardsRefs[cardId].win.close(); delete CardsRefs[cardId]; }
            delete AppRegistry['cards-win-' + cardId];
            renderCards(); scheduleSave();
        }

        // pin功能（保持在最上层）
        function togglePin(cardId, cWin) {
            const ref = CardsRefs[cardId]; if (!ref) return;
            const isPinned = cWin.element.classList.toggle('pinned');
            if (isPinned) {
                cWin.element.style.zIndex = 9999;
                cWin.element.querySelector('.card-act-btn[title="固定在最上层"]').style.color = 'var(--accent)';
            } else {
                cWin.element.style.zIndex = '';
                cWin.element.querySelector('.card-act-btn[title="固定在最上层"]').style.color = '';
            }
        }

        // 渲染窗口化卡片（卡片直接填充窗口，固定比例）
        function renderWindowedCard(cardId, cCon, cWin) {
            const card = gc(cardId); if (!card) return;
            cWin.setTitle(card.title || 'Aether Cards');

            const otherImgs = card.images.filter(i => i !== card.coverImage);
            const preview = card.content ? card.content.slice(0, 500) : '';

            let inner = `<div class="card-el" style="position:relative;cursor:default;width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;border:none;border-radius:0;">`;
            inner += `<div class="card-title-bar">`;
            inner += `<input class="card-title-text" type="text" value="${esc(card.title)}" placeholder="无标题" data-nd>`;
            inner += `<button class="card-act-btn" title="展开详情" data-nd>${ICO.popout}</button>`;
            inner += `<button class="card-act-btn" title="固定在最上层" data-nd>${ICO.pin}</button>`;
            inner += `</div>`;
            if (card.coverImage) {
                inner += `<img class="card-cover" src="/aether-cards-images/${esc(card.coverImage)}" alt="" style="flex:0 0 auto;max-height:45%;object-fit:cover;" loading="lazy">`;
            }
            if (preview || !card.coverImage) {
                inner += `<div class="card-body">${markdownToHtml(preview) || '<span style="color:var(--text-muted)">(空卡片)</span>'}</div>`;
            }
            if (otherImgs.length > 0) {
                inner += `<div class="card-images-strip">${otherImgs.slice(0, 5).map(i => `<img src="/aether-cards-images/${esc(i)}" alt="" loading="lazy">`).join('')}${otherImgs.length > 5 ? `<span style="font-size:10px;color:var(--text-muted);padding:0 2px;">+${otherImgs.length - 5}</span>` : ''}</div>`;
            }
            inner += `</div>`;
            cCon.innerHTML = inner;

            // 标题同步
            const ti = cCon.querySelector('.card-title-text');
            ti.addEventListener('change', () => { card.title = ti.value; cWin.setTitle(card.title || 'Aether Cards'); card.updated = Date.now(); renderCards(); scheduleSave(); });
            // 展开详情按钮
            cCon.querySelectorAll('.card-act-btn')[0].onclick = () => openDetailInWindow(cardId);
            // pin按钮
            cCon.querySelectorAll('.card-act-btn')[1].onclick = () => togglePin(cardId, cWin);
            // 双击→直接编辑卡片内容 + 滑出LLM对话面板
            cCon.addEventListener('dblclick', (e) => {
                if (e.target.dataset.nd !== undefined) return;
                // 直接进入文本编辑模式（点击卡片body区域）
                const cardBody = cCon.querySelector('.card-body');
                if (cardBody) {
                    cardBody.contentEditable = true;
                    cardBody.style.outline = '2px solid var(--accent)';
                    cardBody.style.outlineOffset = '-2px';
                    cardBody.style.borderRadius = 'var(--radius-sm)';
                    cardBody.focus();
                    // 失去焦点时保存
                    cardBody.onblur = () => {
                        cardBody.contentEditable = false;
                        cardBody.style.outline = '';
                        cardBody.style.outlineOffset = '';
                        card.content = cardBody.textContent;
                        card.updated = Date.now();
                        renderCards();
                        scheduleSave();
                    };
                }
                // 滑出LLM对话面板
                toggleChatPanelWindowed(cardId, cCon, cWin);
            });
        }

        // 窗口化卡片的LLM对话面板（悬浮UI，磨砂玻璃效果）
        function toggleChatPanelWindowed(cardId, cCon, cWin) {
            // 检查是否已经有对话面板
            let existingPanel = document.querySelector('.windowed-chat-floating');
            if (existingPanel) {
                // 如果已经有面板，则关闭
                existingPanel.style.opacity = '0';
                existingPanel.style.transform = 'translateX(20px)';
                setTimeout(() => existingPanel.remove(), 300);
                return;
            }

            const card = gc(cardId); if (!card) return;

            // 获取主题色的RGB值
            const computedStyle = getComputedStyle(document.documentElement);
            const bgColor = computedStyle.getPropertyValue('--bg-surface').trim();
            // 将十六进制转换为RGB
            function hexToRgb(hex) {
                hex = hex.replace('#', '');
                if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
                const r = parseInt(hex.substring(0,2), 16);
                const g = parseInt(hex.substring(2,4), 16);
                const b = parseInt(hex.substring(4,6), 16);
                return `${r}, ${g}, ${b}`;
            }
            const bgRgb = hexToRgb(bgColor);

            // 创建悬浮对话面板
            const chatPanel = document.createElement('div');
            chatPanel.className = 'windowed-chat-floating';
            chatPanel.dataset.cardId = cardId;

            chatPanel.style.cssText = `
                position: fixed;
                width: 180px;
                height: ${cWin.element.offsetHeight}px;
                background: rgba(${bgRgb}, 0.5);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                border: 1px solid var(--border);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                z-index: ${parseInt(cWin.element.style.zIndex) || 100};
                opacity: 0;
                transform: translateX(20px);
                transition: opacity 0.3s ease, transform 0.3s ease;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                overflow: hidden;
            `;

            // 计算位置（在窗口右侧外部）
            let slideDir = 1;
            function updatePosition() {
                const winRect = cWin.element.getBoundingClientRect();
                const desktopRect = document.getElementById('desktop').getBoundingClientRect();
                let leftPos = winRect.right + 8;
                slideDir = 1; // 1=向右滑出, -1=向左滑出

                // 判断是否紧贴右侧
                if (leftPos + 188 > desktopRect.right) {
                    leftPos = winRect.left - 188;
                    slideDir = -1;
                }

                chatPanel.style.left = leftPos + 'px';
                chatPanel.style.top = winRect.top + 'px';
                chatPanel.style.height = winRect.height + 'px';
            }
            updatePosition();

            chatPanel.innerHTML = `
                <div style="padding:6px 8px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:var(--bg-elevated);">
                    <span style="font-size:10px;color:var(--text-secondary);font-weight:500;white-space:nowrap;">LLM 对话</span>
                    <button class="cards-tb-btn windowed-chat-close" style="padding:2px 4px;font-size:10px;">${ICO.close}</button>
                </div>
                <div class="windowed-chat-model" style="padding:4px 6px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-surface);">
                    <select class="windowed-model-select" style="width:100%;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-primary);padding:3px 4px;border-radius:var(--radius-sm);font-size:10px;font-family:var(--font-body);outline:none;"></select>
                </div>
                <div class="windowed-chat-msgs" style="flex:1;overflow-y:auto;padding:6px;font-size:11px;"></div>
                <div style="border-top:1px solid var(--border);padding:6px;display:flex;gap:4px;flex-shrink:0;background:var(--bg-surface);">
                    <input class="windowed-chat-input" type="text" placeholder="消息..." style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-primary);padding:5px 6px;border-radius:var(--radius-sm);font-family:var(--font-body);font-size:11px;outline:none;min-width:0;">
                    <button class="cards-tb-btn windowed-chat-send" style="padding:5px 6px;flex-shrink:0;">${ICO.send}</button>
                </div>
            `;

            (document.getElementById('window-stack') || document.getElementById('desktop') || document.body).appendChild(chatPanel);

            // 动画显示
            requestAnimationFrame(() => {
                chatPanel.style.opacity = '1';
                chatPanel.style.transform = 'translateX(0)';
            });

            // 监听窗口移动和层级变化，保持面板同步
            const moveObserver = new MutationObserver(() => {
                updatePosition();
                chatPanel.style.zIndex = parseInt(cWin.element.style.zIndex) || 100;
            });
            moveObserver.observe(cWin.element, { attributes: true, attributeFilter: ['style'] });
            chatPanel._moveObserver = moveObserver;

            // 点击面板时聚焦所属窗口，同步提升层级
            chatPanel.addEventListener('mousedown', () => {
                cWin.focus();
                chatPanel.style.zIndex = parseInt(cWin.element.style.zIndex) || 100;
            });

            // 关闭按钮
            chatPanel.querySelector('.windowed-chat-close').onclick = () => {
                chatPanel.style.opacity = '0';
                chatPanel.style.transform = `translateX(${slideDir * 20}px)`;
                if (chatPanel._moveObserver) chatPanel._moveObserver.disconnect();
                setTimeout(() => chatPanel.remove(), 300);
            };

            // 渲染模型选择器
            const modelSelect = chatPanel.querySelector('.windowed-model-select');
            renderModelSelector(modelSelect);
            const pref = localStorage.getItem('cards-model-pref');
            if (pref) {
                for (const opt of modelSelect.options) {
                    if (opt.value === pref) { modelSelect.value = pref; break; }
                }
            }
            modelSelect.onchange = () => { localStorage.setItem('cards-model-pref', modelSelect.value); };

            // 发送消息
            const chatInput = chatPanel.querySelector('.windowed-chat-input');
            const chatSend = chatPanel.querySelector('.windowed-chat-send');
            const msgsEl = chatPanel.querySelector('.windowed-chat-msgs');

            // 恢复已有对话历史
            restoreCardChat(cardId);
            if (chatHistory[cardId]) {
                chatHistory[cardId].forEach(m => {
                    const d = document.createElement('div');
                    d.style.cssText = 'margin-bottom:6px;';
                    d.innerHTML = `<div style="font-size:9px;color:var(--text-muted);">${m.role === 'user' ? '👤 You' : '🤖 Assistant'}</div><div style="color:var(--text-primary);">${fmtChat(m.content)}</div>`;
                    if (m.role === 'assistant') {
                        const actDiv = document.createElement('div');
                        actDiv.style.cssText = 'display:flex;gap:2px;margin-top:4px;flex-wrap:wrap;';
                        actDiv.innerHTML = `<button class="cards-tb-btn" style="font-size:9px;padding:2px 4px;">${ICO.toCard} 新卡片</button><button class="cards-tb-btn" style="font-size:9px;padding:2px 4px;">加入卡片</button><button class="cards-tb-btn" style="font-size:9px;padding:2px 4px;">加入对话</button>`;
                        actDiv.children[0].onclick = () => { const nc = createCard(); nc.content = m.content; nc.title = m.content.slice(0, 30).replace(/\n/g, ' ') || '新卡片'; nc.updated = Date.now(); renderCards(); scheduleSave(); };
                        actDiv.children[1].onclick = () => { const c = gc(cardId); if (c) { c.content += '\n\n' + m.content; c.updated = Date.now(); renderCards(); scheduleSave(); } };
                        actDiv.children[2].onclick = () => { if (chatState !== 'hidden') { if (!currentChatId) { currentChatId = 'chat-' + Date.now(); chatConversations[currentChatId] = { title: m.content.slice(0, 50), messages: [], created: Date.now(), updated: Date.now() }; } chatConversations[currentChatId].messages.push({ role: 'assistant', content: m.content, timestamp: Date.now() }); renderChatMessagesFloat(currentChatId); saveChatHistory(); } };
                        d.appendChild(actDiv);
                    }
                    msgsEl.appendChild(d);
                });
                smartScroll(msgsEl);
            }

            function sendMsg() {
                const text = chatInput.value.trim();
                if (!text) return;
                chatInput.value = '';

                // 保存用户消息到 chatHistory
                if (!chatHistory[cardId]) chatHistory[cardId] = [];
                chatHistory[cardId].push({ role: 'user', content: text });

                const userDiv = document.createElement('div');
                userDiv.style.cssText = 'margin-bottom:6px;';
                userDiv.innerHTML = `<div style="font-size:9px;color:var(--text-muted);">👤 You</div><div style="color:var(--text-primary);">${fmtChat(text)}</div>`;
                msgsEl.appendChild(userDiv);
                smartScroll(msgsEl);

                const model = getSelectedModel(modelSelect);
                if (!model || !model.model) {
                    const errDiv = document.createElement('div');
                    errDiv.style.cssText = 'margin-bottom:6px;color:var(--accent-warm);font-size:10px;';
                    errDiv.textContent = '请先选择模型';
                    msgsEl.appendChild(errDiv);
                    return;
                }

                const aiDiv = document.createElement('div');
                aiDiv.style.cssText = 'margin-bottom:6px;';
                aiDiv.innerHTML = `<div style="font-size:9px;color:var(--text-muted);">🤖 Assistant</div><div style="color:var(--text-primary);">${ICO.spinner} 思考中...</div>`;
                msgsEl.appendChild(aiDiv);
                const aiContent = aiDiv.querySelector('div:last-child');
                let rawText = '';
                let thinkingEl = null;
                let thinkingText = '';

                const ctx = card.content ? `[卡片内容]\n标题: ${card.title || '无标题'}\n内容:\n${card.content}\n\n` : '';
                const messages = [{ role: 'user', content: ctx + text }];

                os.llm.chat({
                    messages,
                    model: model.model,
                    apiKey: model.key,
                    apiBase: model.base,
                    appId: 'cards-windowed',
                    maxTokens: 2048,
                    onText: (content) => {
                        rawText += content;
                        aiContent.innerHTML = fmtChat(rawText);
                        smartScroll(msgsEl);
                    },
                    onThinking: (content) => {
                        if (!thinkingEl) {
                            thinkingEl = document.createElement('div');
                            thinkingEl.className = 'chat-thinking-chain';
                            thinkingEl.innerHTML = `<div class="chat-thinking-label"><span class="scan-line">Thinking ></span></div><div class="chat-thinking-body"></div>`;
                            thinkingEl.querySelector('.chat-thinking-label').addEventListener('click', () => {
                                thinkingEl.querySelector('.chat-thinking-body').classList.toggle('expanded');
                            });
                            aiDiv.insertBefore(thinkingEl, aiContent);
                        }
                        thinkingText += content;
                        thinkingEl.querySelector('.chat-thinking-body').textContent = thinkingText;
                        thinkingEl.querySelector('.chat-thinking-body').classList.add('expanded');
                        smartScroll(msgsEl);
                    },
                    onDone: () => {
                        chatHistory[cardId].push({ role: 'assistant', content: rawText, thinking: thinkingText || '' });
                        if (thinkingEl) thinkingEl.querySelector('.chat-thinking-label')?.classList.add('done');
                        saveCardChat(cardId);
                        const actDiv = document.createElement('div');
                        actDiv.style.cssText = 'display:flex;gap:2px;margin-top:4px;flex-wrap:wrap;';
                        actDiv.innerHTML = `<button class="cards-tb-btn" style="font-size:9px;padding:2px 4px;">${ICO.toCard} 新卡片</button><button class="cards-tb-btn" style="font-size:9px;padding:2px 4px;">加入卡片</button><button class="cards-tb-btn" style="font-size:9px;padding:2px 4px;">加入对话</button>`;
                        actDiv.children[0].onclick = () => { const nc = createCard(); nc.content = rawText; nc.title = rawText.slice(0, 30).replace(/\n/g, ' ') || '新卡片'; nc.updated = Date.now(); renderCards(); scheduleSave(); };
                        actDiv.children[1].onclick = () => { const c = gc(cardId); if (c) { c.content += '\n\n' + rawText; c.updated = Date.now(); renderCards(); scheduleSave(); } };
                        actDiv.children[2].onclick = () => { if (chatState !== 'hidden') { if (!currentChatId) { currentChatId = 'chat-' + Date.now(); chatConversations[currentChatId] = { title: rawText.slice(0, 50), messages: [], created: Date.now(), updated: Date.now() }; } chatConversations[currentChatId].messages.push({ role: 'assistant', content: rawText, timestamp: Date.now() }); renderChatMessagesFloat(currentChatId); saveChatHistory(); } };
                        aiDiv.appendChild(actDiv);
                    },
                    onError: (msg) => {
                        aiContent.innerHTML = `<span style="color:var(--accent-warm);">错误: ${esc(msg)}</span>`;
                    },
                });
            }

            chatSend.onclick = sendMsg;
            chatInput.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };
        }

        // 窗口化卡片展开详情（与主应用详情 overlay 完全相同的布局）
        function openDetailInWindow(cardId) {
            const ref = CardsRefs[cardId]; if (!ref) return;
            const card = gc(cardId); if (!card) return;
            const { container: cCon, win: cWin } = ref;

            // 展开详情时启用调整大小
            cWin.element.querySelectorAll('.resize-handle').forEach(h => { h.style.display = ''; });
            const maxBtn = cWin.element.querySelector('.win-ctrl-maximize');
            if (maxBtn) maxBtn.style.display = '';

            // 扩大窗口
            const desktop = document.getElementById('desktop');
            const dw = desktop?.clientWidth || 1000, dh = desktop?.clientHeight || 700;
            cWin.element.style.transition = 'all 0.25s ease';
            const newW = Math.min(960, dw * 0.7), newH = Math.min(640, dh * 0.75);
            const curX = parseInt(cWin.element.style.left) || 100, curY = parseInt(cWin.element.style.top) || 100;
            cWin.w = newW; cWin.h = newH;
            cWin.x = Math.max(0, curX - (newW - cWin._normalGeom.w) / 2);
            cWin.y = Math.max(0, curY - (newH - cWin._normalGeom.h) / 2);
            cWin._normalGeom = { x: cWin.x, y: cWin.y, w: newW, h: newH };
            cWin._applyGeom();
            setTimeout(() => { cWin.element.style.transition = ''; }, 300);

            cWin.setTitle(card.title || 'Aether Cards — 编辑');

            // 与主应用 detail overlay 相同的新布局
            cCon.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;background:var(--bg-base);">
                    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-surface);">
                        <button class="cards-tb-btn cr-back">${ICO.back} 返回</button>
                        <input class="cr-det-title" type="text" value="${esc(card.title)}" placeholder="卡片标题..." style="flex:1;background:transparent;border:1px solid transparent;color:var(--text-primary);font-family:var(--font-body);font-size:14px;padding:4px 8px;border-radius:var(--radius-sm);outline:none;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='transparent'">
                    </div>
                    <div style="display:flex;flex:1;overflow:hidden;">
                        <!-- 左侧 2/3 -->
                        <div style="width:67%;display:flex;flex-direction:column;border-right:1px solid var(--border);overflow:hidden;">
                            <div style="flex:9;display:flex;flex-direction:column;overflow:hidden;">
                                <div class="rich-toolbar" style="display:flex;align-items:center;gap:2px;padding:4px 8px;border-bottom:1px solid var(--border);background:var(--bg-surface);flex-shrink:0;flex-wrap:wrap;">
                                    <button class="cards-tb-btn rich-btn" data-cmd="bold" title="加粗"><b>B</b></button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="italic" title="斜体"><i>I</i></button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="strikeThrough" title="删除线"><s>S</s></button>
                                    <div style="width:1px;height:14px;background:var(--border);margin:0 2px;"></div>
                                    <button class="cards-tb-btn rich-btn" data-cmd="formatBlock" data-val="h2" title="标题">H2</button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="formatBlock" data-val="h3" title="子标题">H3</button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="formatBlock" data-val="p" title="正文">P</button>
                                    <div style="width:1px;height:14px;background:var(--border);margin:0 2px;"></div>
                                    <button class="cards-tb-btn rich-btn" data-cmd="insertUnorderedList" title="无序列表">&#8226; 列表</button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="insertOrderedList" title="有序列表">1. 列表</button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="formatBlock" data-val="blockquote" title="引用">&ldquo;</button>
                                    <div style="width:1px;height:14px;background:var(--border);margin:0 2px;"></div>
                                    <button class="cards-tb-btn rich-btn" data-cmd="createLink" title="链接">🔗</button>
                                    <button class="cards-tb-btn rich-btn" data-cmd="removeFormat" title="清除格式">✕</button>
                                </div>
                                <div class="cr-det-editor" contenteditable="true" style="flex:1;overflow-y:auto;padding:12px;font-family:var(--font-body);font-size:14px;line-height:1.7;color:var(--text-primary);outline:none;"></div>
                            </div>
                            <div style="flex:1;display:flex;align-items:center;gap:6px;padding:4px 8px;border-top:1px solid var(--border);background:var(--bg-surface);overflow-x:auto;min-height:48px;flex-shrink:0;">
                                <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${ICO.image} 图片</span>
                                <div class="cr-images" style="display:flex;gap:4px;flex:1;overflow-x:auto;"></div>
                                <button class="cards-tb-btn cr-add-img">${ICO.plus}</button>
                            </div>
                        </div>
                        <!-- 右侧 1/3 LLM -->
                        <div style="width:33%;display:flex;flex-direction:column;overflow:hidden;">
                            <div style="padding:4px 10px;font-size:11px;color:var(--text-muted);border-bottom:1px solid var(--border);background:var(--bg-surface);display:flex;align-items:center;gap:6px;flex-shrink:0;">
                                <span style="white-space:nowrap;flex-shrink:0;">LLM 对话</span>
                                <select class="cr-model-select" style="margin-left:auto;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-primary);padding:2px 6px;border-radius:var(--radius-sm);font-size:11px;font-family:var(--font-body);outline:none;"></select>
                            </div>
                            <div class="cr-chat-msgs" style="flex:1;overflow-y:auto;padding:10px;"></div>
                            <div style="border-top:1px solid var(--border);padding:8px;display:flex;gap:6px;background:var(--bg-surface);flex-shrink:0;">
                                <input class="cr-chat-input" type="text" placeholder="发送消息... (@ 引用图片)" style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-primary);padding:6px 10px;border-radius:var(--radius-sm);font-family:var(--font-body);font-size:12px;outline:none;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
                                <button class="cards-tb-btn cr-chat-send">${ICO.send}</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // 富文本编辑器
            const editorEl = cCon.querySelector('.cr-det-editor');
            editorEl.innerHTML = markdownToHtml(card.content);
            editorEl.addEventListener('input', () => { card.content = htmlToMarkdown(editorEl.innerHTML); card.updated = Date.now(); renderCards(); scheduleSave(); });
            // 工具栏事件
            cCon.querySelectorAll('.rich-btn').forEach(btn => {
                btn.addEventListener('mousedown', (e) => { e.preventDefault(); });
                btn.addEventListener('click', () => {
                    const cmd = btn.dataset.cmd; const val = btn.dataset.val || null;
                    if (cmd === 'createLink') { const url = prompt('输入链接地址:', 'https://'); if (url) document.execCommand(cmd, false, url); }
                    else document.execCommand(cmd, false, val);
                    editorEl.focus();
                });
            });

            // 图片渲染
            const imgsEl = cCon.querySelector('.cr-images');
            const chatInEl = cCon.querySelector('.cr-chat-input');
            function renderWinImgs() {
                imgsEl.innerHTML = '';
                card.images.forEach((fn, idx) => {
                    const wrap = document.createElement('div'); wrap.style.cssText = 'position:relative;display:inline-block;flex-shrink:0;';
                    const img = document.createElement('img'); img.className = 'detail-img-thumb'; img.src = '/aether-cards-images/' + fn; img.title = fn;
                    img.onclick = () => { chatInEl.value += '@' + fn + ' '; chatInEl.focus(); };
                    img.oncontextmenu = (e) => { e.preventDefault(); card.images.splice(idx, 1); if (card.coverImage === fn) card.coverImage = ''; card.updated = Date.now(); renderWinImgs(); renderCards(); scheduleSave(); };
                    wrap.appendChild(img);
                    if (card.coverImage === fn) { const badge = document.createElement('div'); badge.className = 'detail-img-cover'; badge.textContent = '封'; wrap.appendChild(badge); }
                    const setCover = document.createElement('div');
                    setCover.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:var(--accent);font-size:9px;text-align:center;cursor:pointer;padding:1px;display:none;';
                    setCover.textContent = '设为封面';
                    setCover.onclick = (ev) => { ev.stopPropagation(); card.coverImage = fn; card.updated = Date.now(); renderWinImgs(); renderCards(); scheduleSave(); };
                    wrap.appendChild(setCover);
                    wrap.onmouseenter = () => setCover.style.display = '';
                    wrap.onmouseleave = () => setCover.style.display = 'none';
                    imgsEl.appendChild(wrap);
                });
            }
            renderWinImgs();

            // 模型选择器
            const winModelSel = cCon.querySelector('.cr-model-select');
            renderModelSelector(winModelSel);
            const pref = localStorage.getItem('cards-model-pref');
            if (pref) { for (const opt of winModelSel.options) { if (opt.value === pref) { winModelSel.value = pref; break; } } }
            winModelSel.onchange = () => { localStorage.setItem('cards-model-pref', winModelSel.value); };

            // 聊天历史
            restoreCardChat(cardId);
            renderChatMessages(cardId, cCon.querySelector('.cr-chat-msgs'));

            // 事件：返回卡片视图
            cCon.querySelector('.cr-back').onclick = () => {
                saveCardChat(cardId);
                // 返回时重新锁定窗口大小
                cWin.element.querySelectorAll('.resize-handle').forEach(h => { h.style.display = 'none'; });
                const maxBtn2 = cWin.element.querySelector('.win-ctrl-maximize');
                if (maxBtn2) maxBtn2.style.display = 'none';

                cWin.element.style.transition = 'all 0.25s ease';
                const card2 = gc(cardId);
                cWin.w = card2.size.w; cWin.h = card2.size.h;
                cWin._normalGeom = { x: cWin.x, y: cWin.y, w: cWin.w, h: cWin.h };
                cWin._applyGeom();
                setTimeout(() => { cWin.element.style.transition = ''; }, 300);
                renderWindowedCard(cardId, cCon, cWin);
            };

            // 事件：标题/文本/图片
            cCon.querySelector('.cr-det-title').onchange = (e) => { card.title = e.target.value; cWin.setTitle(card.title || 'Aether Cards'); card.updated = Date.now(); renderCards(); scheduleSave(); };
            // (editor input handler already set up above)
            cCon.querySelector('.cr-add-img').onclick = () => openImageModal();

            // 事件：聊天发送
            const sendBtn = cCon.querySelector('.cr-chat-send');
            sendBtn.onclick = () => sendChatMessage(cardId, chatInEl, winModelSel);
            chatInEl.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(cardId, chatInEl, winModelSel); } };
        }

        // ═══════════════════════════════════════
        // LLM 配置面板
        // ═══════════════════════════════════════

        function openLLMPanel() { llmPanel.style.display = 'flex'; renderLLMConfig(); }
        function closeLLMPanel() { llmPanel.style.display = 'none'; }

        function renderLLMConfig() {
            renderLLMSection('text', llmTextPanel, '文本模型', true);
            renderLLMSection('image', llmImagePanel, '文生图模型', false);
        }

        function renderLLMSection(type, panelEl, title, showMultimodal) {
            const providers = type === 'text' ? CardsLLMConfig.textModels : CardsLLMConfig.imageModels;
            let h = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span style="font-size:13px;color:var(--text-primary);font-weight:500;">${title}</span>
                <button class="cards-tb-btn llm-add-provider" data-type="${type}">${ICO.plus} 添加 Provider</button>
            </div>`;

            providers.forEach((prov, pi) => {
                h += `<div class="llm-provider" data-type="${type}" data-pi="${pi}">`;
                h += `<div class="llm-provider-header">`;
                h += `<input class="llm-prov-name" value="${esc(prov.name || '')}" placeholder="Provider 名称 (如 OpenAI)" style="width:120px;">`;
                h += `<input class="llm-prov-key" value="${esc(prov.apiKey || '')}" placeholder="API Key" type="password" style="flex:1;">`;
                h += `<input class="llm-prov-base" value="${esc(prov.apiBase || '')}" placeholder="API Base URL (可选)" style="width:160px;">`;
                h += `<button class="cards-tb-btn llm-del-provider" title="删除" style="color:var(--accent-warm);">${ICO.close}</button>`;
                h += `</div>`;

                h += `<div style="margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;">`;
                h += `<span style="font-size:11px;color:var(--text-muted);">模型列表</span>`;
                h += `<button class="cards-tb-btn llm-add-model" data-type="${type}" data-pi="${pi}" style="font-size:10px;padding:2px 6px;">${ICO.plus} 添加模型</button>`;
                h += `</div>`;

                (prov.models || []).forEach((model, mi) => {
                    h += `<div class="llm-model-row" data-type="${type}" data-pi="${pi}" data-mi="${mi}">`;
                    h += `<input class="llm-model-name" value="${esc(model.name || '')}" placeholder="模型名称" style="flex:1;">`;
                    if (showMultimodal) { h += `<label><input type="checkbox" class="llm-model-mm" ${model.multimodal ? 'checked' : ''}> 多模态</label>`; }
                    h += `<button class="cards-tb-btn llm-del-model" style="padding:2px 4px;">${ICO.close}</button>`;
                    h += `</div>`;
                });
                h += `</div>`;
            });

            if (providers.length === 0) h += `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">暂无配置，点击上方按钮添加</div>`;

            panelEl.innerHTML = h;

            // 事件绑定
            panelEl.querySelector('.llm-add-provider')?.addEventListener('click', () => {
                providers.push({ name: '', apiKey: '', apiBase: '', models: [] });
                renderLLMSection(type, panelEl, title, showMultimodal); scheduleConfigSave();
            });
            panelEl.querySelectorAll('.llm-del-provider').forEach(btn => {
                btn.addEventListener('click', () => {
                    const pi = +btn.closest('.llm-provider').dataset.pi;
                    providers.splice(pi, 1); renderLLMSection(type, panelEl, title, showMultimodal); scheduleConfigSave();
                });
            });
            panelEl.querySelectorAll('.llm-prov-name, .llm-prov-key, .llm-prov-base').forEach(inp => {
                inp.addEventListener('change', () => {
                    const pi = +inp.closest('.llm-provider').dataset.pi;
                    const p = providers[pi];
                    p.name = inp.closest('.llm-provider-header').querySelector('.llm-prov-name').value;
                    p.apiKey = inp.closest('.llm-provider-header').querySelector('.llm-prov-key').value;
                    p.apiBase = inp.closest('.llm-provider-header').querySelector('.llm-prov-base').value;
                    scheduleConfigSave();
                });
            });
            panelEl.querySelectorAll('.llm-add-model').forEach(btn => {
                btn.addEventListener('click', () => {
                    const pi = +btn.dataset.pi;
                    if (!providers[pi].models) providers[pi].models = [];
                    providers[pi].models.push({ name: '', multimodal: false });
                    renderLLMSection(type, panelEl, title, showMultimodal); scheduleConfigSave();
                });
            });
            panelEl.querySelectorAll('.llm-del-model').forEach(btn => {
                btn.addEventListener('click', () => {
                    const row = btn.closest('.llm-model-row');
                    const pi = +row.dataset.pi, mi = +row.dataset.mi;
                    providers[pi].models.splice(mi, 1); renderLLMSection(type, panelEl, title, showMultimodal); scheduleConfigSave();
                });
            });
            panelEl.querySelectorAll('.llm-model-name').forEach(inp => {
                inp.addEventListener('change', () => {
                    const row = inp.closest('.llm-model-row');
                    const pi = +row.dataset.pi, mi = +row.dataset.mi;
                    providers[pi].models[mi].name = inp.value; scheduleConfigSave();
                });
            });
            panelEl.querySelectorAll('.llm-model-mm').forEach(cb => {
                cb.addEventListener('change', () => {
                    const row = cb.closest('.llm-model-row');
                    const pi = +row.dataset.pi, mi = +row.dataset.mi;
                    providers[pi].models[mi].multimodal = cb.checked; scheduleConfigSave();
                });
            });
        }

        function scheduleConfigSave() { clearTimeout(configSaveTimer); configSaveTimer = setTimeout(saveConfig, 500); }
        async function saveConfig() { try { await os.api('PUT', '/api/aether-cards/config', CardsLLMConfig); } catch (e) { console.warn('Config save failed:', e); } }
        async function loadConfig() { try { const d = await os.api('GET', '/api/aether-cards/config'); if (d.textModels) CardsLLMConfig.textModels = d.textModels; if (d.imageModels) CardsLLMConfig.imageModels = d.imageModels; } catch (e) { console.warn('Config load failed:', e); } }

        // ═══════════════════════════════════════
        // 手绘板功能
        // ═══════════════════════════════════════

        container.querySelector('#cards-draw-board').onclick = () => openDrawBoard();

        // 加载drawboard.js的Promise（只加载一次）
        let drawboardLoaded = null;
        function ensureDrawboardLoaded() {
            if (!drawboardLoaded) {
                drawboardLoaded = new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = '/apps/cards/drawboard.js';
                    script.onload = () => {
                        // 等待一小段时间确保registerApp被执行
                        setTimeout(() => {
                            if (AppRegistry['drawboard']) {
                                resolve();
                            } else {
                                reject(new Error('drawboard app failed to register'));
                            }
                        }, 50);
                    };
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            return drawboardLoaded;
        }

        // 存储所有打开的手绘板窗口引用
        const drawBoardRefs = new Map();

        async function openDrawBoard() {
            await ensureDrawboardLoaded();

            // 确保drawboard已注册
            if (!AppRegistry['drawboard']) {
                console.error('drawboard app not registered after loading script');
                return;
            }

            // 为每个手绘板创建唯一的appId
            const drawId = 'drawboard-' + Date.now();
            const drawFactory = AppRegistry['drawboard'].factory;

            registerApp(drawId, {
                title: '手绘板',
                icon: '🎨',
                options: { w: 400, h: 600 },
                factory: (dCon, dWin, dOs) => {
                    // 调用原始drawboard的factory
                    drawFactory(dCon, dWin, dOs);

                    // 存储引用
                    drawBoardRefs.set(drawId, { win: dWin, container: dCon });

                    // 监听导出事件
                    dWin.on('export-to-card', ({ filename }) => {
                        const card = gc(selectedCardId) || gc(detailCardId);
                        if (card) {
                            if (!card.images.includes(filename)) {
                                card.images.push(filename);
                                card.updated = Date.now();
                                if (detailCardId === card.id) renderDetailImages(card);
                                renderCards();
                                scheduleSave();
                            }
                        }
                    });

                    dWin.on('export-new-card', ({ filename }) => {
                        const nc = createCard();
                        nc.images.push(filename);
                        nc.coverImage = filename;
                        nc.title = '手绘 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                        nc.updated = Date.now();
                        renderCards();
                        scheduleSave();
                    });

                    dWin.on('export-to-chat', ({ filename }) => {
                        // 添加到对话框的附加文件
                        if (chatState !== 'hidden') {
                            attachedFiles.push({ name: filename, type: 'image/png', size: 0 });
                            renderAttachedFiles();
                        } else {
                            // 如果对话框未打开，打开并添加
                            showChatPanel('new');
                            attachedFiles.push({ name: filename, type: 'image/png', size: 0 });
                            renderAttachedFiles();
                        }
                    });

                    // 窗口关闭时清理引用
                    dWin.on('close', () => {
                        drawBoardRefs.delete(drawId);
                        delete AppRegistry[drawId];
                    });
                }
            });
            await os.openApp(drawId);
        }

        // ═══════════════════════════════════════
        // 持久化
        // ═══════════════════════════════════════

        function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 500); }
        async function save() {
            if (!_dbAvailable) return saveJSON();
            try {
                const canvasData = JSON.stringify({ offsetX: canvasOffset.x, offsetY: canvasOffset.y, zoom: canvasZoom });
                await dbExec(`UPDATE boards SET canvas_data = ?, updated_at = ? WHERE id = ?`, [canvasData, Date.now(), currentBoardId]);
                for (const card of cards) {
                    await dbExec(`INSERT OR REPLACE INTO cards (id, board_id, title, content, cover_image, images, ratio, position, size, windowed, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                        [card.id, currentBoardId, card.title || '', card.content || '', card.coverImage || '', JSON.stringify(card.images || []), JSON.stringify(card.ratio || [2,3]), JSON.stringify(card.position), JSON.stringify(card.size), card.windowed ? 1 : 0, card.created || Date.now(), card.updated || Date.now()]);
                }
                const ids = cards.map(c => c.id);
                if (ids.length > 0) {
                    const placeholders = ids.map(() => '?').join(',');
                    await dbExec(`DELETE FROM cards WHERE board_id = ? AND id NOT IN (${placeholders})`, [currentBoardId, ...ids]);
                } else {
                    await dbExec(`DELETE FROM cards WHERE board_id = ?`, [currentBoardId]);
                }
                CardsData.cards = cards;
                CardsData.canvas = { offsetX: canvasOffset.x, offsetY: canvasOffset.y, zoom: canvasZoom };
            } catch (e) { console.warn('Save failed:', e); }
        }
        function saveJSON() {
            const data = { version: 2, canvas: { offsetX: canvasOffset.x, offsetY: canvasOffset.y, zoom: canvasZoom }, cards };
            CardsData.cards = cards; CardsData.canvas = data.canvas;
            os.api('PUT', '/api/aether-cards/save', data).catch(e => console.warn('JSON save failed:', e));
        }
        async function load() {
            if (!_dbAvailable) return loadJSON();
            try {
                const boardRes = await dbQuery(`SELECT canvas_data FROM boards WHERE id = ?`, [currentBoardId]);
                if (boardRes.rows && boardRes.rows[0]) {
                    const cd = JSON.parse(boardRes.rows[0].canvas_data || '{}');
                    canvasOffset.x = cd.offsetX || 0; canvasOffset.y = cd.offsetY || 0; canvasZoom = cd.zoom || 1;
                    CardsData.canvas = cd;
                }
                const cardsRes = await dbQuery(`SELECT * FROM cards WHERE board_id = ?`, [currentBoardId]);
                cards = (cardsRes.rows || []).map(row => {
                    let ratio = JSON.parse(row.ratio || '[2,3]');
                    const size = JSON.parse(row.size || '{"w":200,"h":300}');
                    if (size.w && size.h) {
                        const actualRatio = size.w / size.h;
                        if (Math.abs(ratio[0] / ratio[1] - actualRatio) > 0.01) {
                            ratio = [size.w, size.h];
                            const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
                            const g = gcd(ratio[0], ratio[1]);
                            ratio = [ratio[0] / g, ratio[1] / g];
                        }
                    }
                    return { id: row.id, title: row.title || '', content: row.content || '', coverImage: row.cover_image || '', images: JSON.parse(row.images || '[]'), ratio, position: JSON.parse(row.position || '{"x":0,"y":0}'), size, windowed: !!row.windowed, created: row.created_at, updated: row.updated_at };
                });
                CardsData.cards = cards;
            } catch (e) { console.warn('Load failed, trying JSON:', e); await loadJSON(); }
        }
        async function loadJSON() {
            try {
                const d = await os.api('GET', '/api/aether-cards/load');
                if (d.cards) {
                    cards = d.cards.map(c => {
                        let ratio = c.ratio || [...DEFAULT_RATIO];
                        if (c.size && c.size.w && c.size.h) {
                            const actualRatio = c.size.w / c.size.h;
                            if (Math.abs(ratio[0] / ratio[1] - actualRatio) > 0.01) {
                                ratio = [c.size.w, c.size.h];
                                const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
                                const g = gcd(ratio[0], ratio[1]);
                                ratio = [ratio[0] / g, ratio[1] / g];
                            }
                        }
                        return { ratio, coverImage: '', ...c };
                    });
                    CardsData.cards = cards;
                }
                if (d.canvas) { canvasOffset.x = d.canvas.offsetX || 0; canvasOffset.y = d.canvas.offsetY || 0; canvasZoom = d.canvas.zoom || 1; CardsData.canvas = d.canvas; }
            } catch (e) { console.warn('JSON load failed:', e); }
        }

        // ═══════════════════════════════════════
        // 键盘 & 清理
        // ═══════════════════════════════════════

        container.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { if (imageModal.style.display !== 'none') { closeImageModal(); return; } if (llmPanel.style.display !== 'none') { closeLLMPanel(); return; } if (atPopup.style.display !== 'none') { hideAtPopup(); return; } if (detailCardId) { closeDetail(); return; } }
            if (e.key === 'Delete' && selectedCardId && !detailCardId) deleteCard(selectedCardId);
        });

        win.on('close', () => {
            for (const [id, ws] of Object.entries(CardsWSMap)) { try { ws.close(); } catch {} delete CardsWSMap[id]; }
            for (const [id, ref] of Object.entries(CardsRefs)) { try { ref.win.close(); } catch {} delete CardsRefs[id]; delete AppRegistry['cards-win-' + id]; }
            clearTimeout(saveTimer); clearTimeout(configSaveTimer);
        });

        // ═══════════════════════════════════════
        // 工作板管理
        // ═══════════════════════════════════════

        const boardPanel = container.querySelector('#cards-board-panel');
        const boardList = container.querySelector('#cards-board-list');
        const boardNameEl = container.querySelector('#cards-board-name');

        container.querySelector('#cards-board-mgr').onclick = () => openBoardPanel();
        container.querySelector('#cards-board-close').onclick = () => { boardPanel.style.display = 'none'; };
        container.querySelector('#cards-board-new').onclick = () => createBoard();

        async function openBoardPanel() {
            boardPanel.style.display = 'flex';
            await renderBoardList();
        }

        async function renderBoardList() {
            const res = await dbQuery(`SELECT b.id, b.title, b.created_at, (SELECT COUNT(*) FROM cards WHERE board_id = b.id) as card_count FROM boards b ORDER BY b.created_at`);
            boardList.innerHTML = '';
            (res.rows || []).forEach(b => {
                const item = document.createElement('div');
                item.className = 'board-mgr-item' + (b.id === currentBoardId ? ' active' : '');
                const time = new Date(b.created_at).toLocaleDateString('zh-CN');
                item.innerHTML = `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(b.title)}</span><span class="board-count">${b.card_count} 张</span><div class="board-actions"><button class="cards-tb-btn" data-action="rename" style="padding:2px 4px;font-size:10px;">重命名</button><button class="cards-tb-btn" data-action="delete" style="padding:2px 4px;font-size:10px;color:var(--accent-warm);">删除</button></div>`;
                item.addEventListener('click', (e) => {
                    if (e.target.dataset.action === 'rename') { renameBoard(b.id); e.stopPropagation(); return; }
                    if (e.target.dataset.action === 'delete') { deleteBoard(b.id, b.title); e.stopPropagation(); return; }
                    if (b.id !== currentBoardId) switchBoard(b.id);
                    boardPanel.style.display = 'none';
                });
                boardList.appendChild(item);
            });
        }

        async function createBoard() {
            const title = prompt('工作板名称：', '新工作板 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
            if (!title) return;
            const id = 'board-' + Date.now();
            await dbExec(`INSERT INTO boards (id, title, created_at, updated_at) VALUES (?,?,?,?)`, [id, title, Date.now(), Date.now()]);
            await switchBoard(id);
            boardPanel.style.display = 'none';
        }

        async function renameBoard(boardId) {
            const res = await dbQuery(`SELECT title FROM boards WHERE id = ?`, [boardId]);
            const old = res.rows?.[0]?.title || '';
            const title = prompt('新名称：', old);
            if (!title || title === old) return;
            await dbExec(`UPDATE boards SET title = ?, updated_at = ? WHERE id = ?`, [title, Date.now(), boardId]);
            if (boardId === currentBoardId) boardNameEl.textContent = title;
            await renderBoardList();
        }

        async function deleteBoard(boardId, title) {
            if (!confirm(`确定删除工作板「${title}」？\n其中的所有卡片和对话将被永久删除。`)) return;
            await dbExec(`DELETE FROM cards WHERE board_id = ?`, [boardId]);
            await dbExec(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE board_id = ?)`, [boardId]);
            await dbExec(`DELETE FROM conversations WHERE board_id = ?`, [boardId]);
            await dbExec(`DELETE FROM card_chat_map WHERE board_id = ?`, [boardId]);
            await dbExec(`DELETE FROM boards WHERE id = ?`, [boardId]);
            if (boardId === currentBoardId) {
                await switchBoard('board-default');
            }
            await renderBoardList();
        }

        async function switchBoard(boardId) {
            // 关闭所有窗口化卡片
            for (const [id, ref] of Object.entries(CardsRefs)) { try { ref.win.close(); } catch {} delete CardsRefs[id]; delete AppRegistry['cards-win-' + id]; }
            await save();
            await saveChatHistory();
            currentBoardId = boardId;
            localStorage.setItem('cards-current-board', boardId);
            // 更新名称
            const res = await dbQuery(`SELECT title FROM boards WHERE id = ?`, [boardId]);
            boardNameEl.textContent = res.rows?.[0]?.title || '工作板';
            await load();
            await loadChatHistory();
            canvasOffset = { x: 0, y: 0 }; canvasZoom = 1;
            applyTransform(); renderCards();
        }

        async function updateBoardName() {
            try {
                const res = await dbQuery(`SELECT title FROM boards WHERE id = ?`, [currentBoardId]);
                boardNameEl.textContent = res.rows?.[0]?.title || '工作板';
            } catch (e) { boardNameEl.textContent = '默认工作板'; }
        }

        // ═══════════════════════════════════════
        // 初始化
        // ═══════════════════════════════════════

        (async () => {
            try {
                await initDB();
                await Promise.allSettled([load(), loadConfig(), loadChatHistory(), loadRenderLibs()]);
                await updateBoardName();
                // 恢复重启后丢失窗口的卡片
                let restored = false;
                cards.forEach(c => { if (c.windowed) { c.windowed = false; restored = true; } });
                applyTransform(); renderCards();
                if (restored) scheduleSave();
            } catch (e) { console.error('[Cards] Init failed:', e); }
        })();
    }
});

function esc(s) { if (!s) return ''; return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
