export function createHttpPoller(options) {
    return new HttpPoller(options);
}
class HttpPoller {
    constructor(options) {
        Object.defineProperty(this, "url", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "intervalMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onData", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "timer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "aborted", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "httpsFallbackAttempted", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.url = options.url;
        this.intervalMs = options.intervalMs;
        this.onData = options.onData;
    }
    start() {
        this.aborted = false;
        void this.pollOnce();
        this.schedule();
    }
    stop() {
        this.aborted = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    schedule() {
        this.timer = setTimeout(async () => {
            if (this.aborted) {
                return;
            }
            await this.pollOnce();
            if (!this.aborted) {
                this.schedule();
            }
        }, this.intervalMs);
    }
    async pollOnce() {
        try {
            const body = await this.fetchTelemetry(this.url);
            this.onData(body);
        }
        catch (error) {
            if (await this.tryDowngradeToHttp(error)) {
                return;
            }
            console.warn('HTTP poll error', error);
        }
    }
    async fetchTelemetry(url) {
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`HTTP poll failed: ${response.status}`);
        }
        return (await response.json());
    }
    async tryDowngradeToHttp(error) {
        if (this.httpsFallbackAttempted) {
            return false;
        }
        if (!(error instanceof TypeError)) {
            return false;
        }
        if (!this.url.startsWith('https://')) {
            return false;
        }
        this.httpsFallbackAttempted = true;
        const fallbackUrl = `http://${this.url.slice('https://'.length)}`;
        console.warn('HTTPS poll failed, retrying over HTTP. Configure VITE_NODE_RED_BASE_URL with http:// if your Node-RED server does not use TLS.', error);
        try {
            const body = await this.fetchTelemetry(fallbackUrl);
            this.url = fallbackUrl;
            this.onData(body);
            return true;
        }
        catch (fallbackError) {
            console.warn('HTTP poll error after HTTPS fallback', fallbackError);
        }
        return false;
    }
}
