import { connect, type MqttClient } from 'mqtt';
import type { TelemetryMessage } from '../context/AppState';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

interface TelemetryMqttClientOptions {
  url: string;
  topic: string;
  onMessage: (message: TelemetryMessage | null) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
}

interface BackoffState {
  attempt: number;
  delay: number;
}

const INITIAL_DELAY = Number(import.meta.env.VITE_MQTT_BACKOFF_INITIAL_MS ?? '500');
const MAX_DELAY = Number(import.meta.env.VITE_MQTT_BACKOFF_MAX_MS ?? '8000');

export function createTelemetryMqttClient(options: TelemetryMqttClientOptions) {
  return new TelemetryMqttClient(options);
}

export class TelemetryMqttClient {
  private client: MqttClient | null = null;
  private readonly url: string;
  private readonly topic: string;
  private readonly onMessage: (message: TelemetryMessage | null) => void;
  private readonly onStatusChange?: (status: ConnectionStatus) => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff: BackoffState = { attempt: 0, delay: INITIAL_DELAY };
  private status: ConnectionStatus = 'disconnected';
  private hasEverConnected = false;
  private readonly decoder = new TextDecoder();

  constructor(options: TelemetryMqttClientOptions) {
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
    this.client = connect(this.url, {
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
        const decoded = this.decoder.decode(payload as Uint8Array);
        const parsed = JSON.parse(decoded) as TelemetryMessage;
        this.onMessage(parsed);
      } catch (error) {
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

  private scheduleReconnect() {
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
    } else {
      this.updateStatus('reconnecting');
    }

    this.clearTimer();
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private updateStatus(status: ConnectionStatus) {
    if (this.status === status) {
      return;
    }
    this.status = status;
    this.onStatusChange?.(status);
  }

  private clearTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
