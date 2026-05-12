/**
 * AetherOS 统一 LLM 客户端
 * 所有应用通过 os.llm 调用模型，自动追踪调用状态。
 */
class LLMClient {
    constructor(os) {
        this.os = os;
        this._providersCache = null;
        this._modelsCache = null;
    }

    /**
     * 流式对话
     * @param {Object} options
     * @param {Array}    options.messages   - 消息数组 [{role, content}]
     * @param {string}   options.model      - 模型引用 (provider_id/model_id) 或模型名
     * @param {string}   [options.apiKey]   - 内联 API key（自管配置应用使用）
     * @param {string}   [options.apiBase]  - 内联 API base URL
     * @param {string}   [options.appId]    - 调用来源应用 ID
     * @param {Function} [options.onText]     - 流式文本回调 (content) => void
     * @param {Function} [options.onThinking] - 思维链回调 (content) => void
     * @param {Function} [options.onDone]     - 完成回调 (data) => void
     * @param {Function} [options.onError]    - 错误回调 (message) => void
     * @param {number}   [options.maxTokens] - 最大 token 数
     * @param {string}   [options.system]   - 系统提示词
     * @returns {string} 调用 ID
     */
    async chat(options) {
        const callId = 'llm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        const startTime = Date.now();

        this.os.registerModelCall({
            id: callId,
            model: options.model,
            type: 'chat',
            status: 'streaming',
            app: options.appId || 'unknown',
            startTime: startTime,
        });

        try {
            const body = {
                messages: options.messages || [],
                model: options.model,
                max_tokens: options.maxTokens || 4096,
            };
            if (options.system) body.system = options.system;
            if (options.apiKey) body.api_key = options.apiKey;
            if (options.apiBase) body.api_base = options.apiBase;

            const resp = await fetch('/api/llm/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!resp.ok) {
                let errMsg = '请求失败';
                try {
                    const err = await resp.json();
                    errMsg = err.error || err.detail || errMsg;
                } catch {}
                throw new Error(errMsg);
            }

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const d = JSON.parse(line.slice(6));
                        switch (d.type) {
                            case 'text':
                                if (options.onText) options.onText(d.content);
                                break;
                            case 'thinking':
                                if (options.onThinking) options.onThinking(d.content);
                                break;
                            case 'done':
                                this.os.updateModelCall(callId, {
                                    status: 'done',
                                    endTime: Date.now(),
                                    tokens: d.tokens || (d.usage ? d.usage.total_tokens : 0),
                                });
                                if (options.onDone) options.onDone(d);
                                break;
                            case 'error':
                                this.os.updateModelCall(callId, {
                                    status: 'error',
                                    endTime: Date.now(),
                                    error: d.message,
                                });
                                if (options.onError) options.onError(d.message);
                                break;
                        }
                    } catch {}
                }
            }
        } catch (e) {
            this.os.updateModelCall(callId, {
                status: 'error',
                endTime: Date.now(),
                error: e.message,
            });
            if (options.onError) options.onError(e.message);
        }

        return callId;
    }

    /**
     * 图像生成
     * @param {Object} options
     * @param {string}  options.prompt    - 提示词
     * @param {string}  options.model     - 模型引用或模型名
     * @param {string}  [options.apiKey]  - 内联 API key
     * @param {string}  [options.apiBase] - 内联 API base URL
     * @param {string}  [options.appId]   - 调用来源应用 ID
     * @returns {Object} {ok, filename, revised_prompt} 或 {error}
     */
    async generateImage(options) {
        const callId = 'llm-img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

        this.os.registerModelCall({
            id: callId,
            model: options.model,
            type: 'image',
            status: 'generating',
            app: options.appId || 'unknown',
            startTime: Date.now(),
        });

        try {
            const body = {
                prompt: options.prompt,
                model: options.model,
            };
            if (options.apiKey) body.api_key = options.apiKey;
            if (options.apiBase) body.api_base = options.apiBase;

            const resp = await fetch('/api/llm/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await resp.json();
            this.os.updateModelCall(callId, { status: 'done', endTime: Date.now() });
            return data;
        } catch (e) {
            this.os.updateModelCall(callId, {
                status: 'error',
                endTime: Date.now(),
                error: e.message,
            });
            return { error: e.message };
        }
    }

    /**
     * 获取已配置的 provider 列表（脱敏）
     */
    async getProviders() {
        if (!this._providersCache) {
            this._providersCache = await this.os.api('GET', '/api/llm/providers');
        }
        return this._providersCache;
    }

    /**
     * 获取扁平模型列表
     */
    async getModels() {
        if (!this._modelsCache) {
            this._modelsCache = await this.os.api('GET', '/api/llm/models');
        }
        return this._modelsCache;
    }

    /**
     * 获取 LLM 配置（key 脱敏）
     */
    async getConfig() {
        return await this.os.api('GET', '/api/llm/config');
    }

    /**
     * 更新 LLM 配置
     */
    async updateConfig(config) {
        const result = await this.os.api('PUT', '/api/llm/config', config);
        this._providersCache = null;
        this._modelsCache = null;
        return result;
    }

    /**
     * 清除缓存
     */
    invalidateCache() {
        this._providersCache = null;
        this._modelsCache = null;
    }
}
