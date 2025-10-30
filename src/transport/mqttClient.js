import mqtt from 'mqtt';
const INITIAL_DELAY = Number(import.meta.env.VITE_MQTT_BACKOFF_INITIAL_MS ?? '500');
const MAX_DELAY = Number(import.meta.env.VITE_MQTT_BACKOFF_MAX_MS ?? '8000');
export function createTelemetryMqttClient(options) {
    return new TelemetryMqttClient(options);
}
export class TelemetryMqttClient {
    constructor(options) {
        Object.defineProperty(this, "client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "url", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "topic", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onMessage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onStatusChange", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "reconnectTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "backoff", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { attempt: 0, delay: INITIAL_DELAY }
        });
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'disconnected'
        });
        Object.defineProperty(this, "hasEverConnected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "decoder", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new TextDecoder()
        });
        this.url = options.url;
        this.topic = options.topic;
        this.onMessage = options.onMessage;
        this.onStatusChange = options.onStatusChange;
    }
    connect() {
        this.clearTimer();
        this.updateStatus(this.hasEverConnected ? 'reconnecting' : 'connecting');
        this.client?.removeAllListeners();
        this.client?.end(true);
        this.client = mqtt.connect(this.url, {
            reconnectPeriod: 0,
            keepalive: 10,
            clean: true,
            resubscribe: false
        });
        this.client.on('connect', () => {
            this.hasEverConnected = true;
            this.backoff = { attempt: 0, delay: INITIAL_DELAY };
            this.updateStatus('connected');
            this.client?.subscribe(this.topic, { qos: 0 });
        });
        this.client.on('message', (_, payload) => {
            try {
                const decoded = this.decoder.decode(payload);
                const parsed = JSON.parse(decoded);
                this.onMessage(parsed);
            }
            catch (error) {
                console.warn('Failed to parse telemetry payload', error);
            }
        });
        this.client.on('close', () => {
            if (this.status === 'disconnected') {
                return;
            }
            this.scheduleReconnect();
        });
        this.client.on('error', (error) => {
            console.error('MQTT connection error', error);
            if (!this.hasEverConnected) {
                this.updateStatus('failed');
            }
            this.client?.end(true);
        });
    }
    disconnect() {
        this.updateStatus('disconnected');
        this.clearTimer();
        this.client?.removeAllListeners();
        this.client?.end(true);
        this.client = null;
    }
    scheduleReconnect() {
        if (this.status === 'disconnected') {
            return;
        }
        this.backoff = {
            attempt: this.backoff.attempt + 1,
            delay: Math.min(MAX_DELAY, this.backoff.delay * (this.backoff.attempt > 1 ? 2 : 1))
        };
        const delay = this.backoff.delay;
        if (!this.hasEverConnected && delay >= MAX_DELAY) {
            this.updateStatus('failed');
        }
        else {
            this.updateStatus('reconnecting');
        }
        this.clearTimer();
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }
    updateStatus(status) {
        if (this.status === status) {
            return;
        }
        this.status = status;
        this.onStatusChange?.(status);
    }
    clearTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
