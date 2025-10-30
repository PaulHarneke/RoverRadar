import mqtt, { MqttClient as Client } from 'mqtt';
import type { IClientOptions, IClientPublishOptions } from 'mqtt';
import { SimulationFrame } from '../core/types';

export type MqttStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MqttClientConfig {
  brokerUrl: string;
  topicPrefix: string;
  retain: boolean;
  clientId?: string;
  username?: string;
  password?: string;
}

export type StatusListener = (status: MqttStatus, error?: Error) => void;

const DEFAULT_OPTIONS: IClientOptions = {
  reconnectPeriod: 2000,
  connectTimeout: 4000,
  keepalive: 30,
  clean: true,
};

function buildTopic(prefix: string, suffix: string): string {
  return `${prefix.replace(/\/$/, '')}/${suffix}`;
}

function publishAsync(client: Client, topic: string, payload: string, options: IClientPublishOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, options, (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export class SimulationMqttClient {
  private client: Client | null = null;
  private config: MqttClientConfig | null = null;
  private readonly listeners = new Set<StatusListener>();

  constructor(initialListener?: StatusListener) {
    if (initialListener) {
      this.listeners.add(initialListener);
    }
  }

  addStatusListener(listener: StatusListener): void {
    this.listeners.add(listener);
  }

  removeStatusListener(listener: StatusListener): void {
    this.listeners.delete(listener);
  }

  private notify(status: MqttStatus, error?: Error): void {
    this.listeners.forEach((listener) => listener(status, error));
  }

  connect(config: MqttClientConfig): void {
    if (!config.brokerUrl) {
      this.disconnect();
      this.notify('disconnected');
      return;
    }

    const mergedOptions: IClientOptions = {
      ...DEFAULT_OPTIONS,
      clientId: config.clientId ?? `uwb-sim-${Math.random().toString(16).slice(2)}`,
      username: config.username,
      password: config.password,
    };

    if (this.client) {
      this.client.end(true);
      this.client = null;
    }

    this.notify('connecting');
    this.config = config;
    const client = mqtt.connect(config.brokerUrl, mergedOptions);
    this.client = client;

    client.on('connect', () => {
      this.notify('connected');
    });

    client.on('reconnect', () => {
      this.notify('connecting');
    });

    client.on('error', (error) => {
      this.notify('error', error instanceof Error ? error : new Error('MQTT error'));
    });

    client.on('close', () => {
      this.notify('disconnected');
    });
  }

  disconnect(): void {
    if (this.client) {
      this.client.end(true);
      this.client.removeAllListeners();
      this.client = null;
    }
    this.notify('disconnected');
  }

  async publishFrame(frame: SimulationFrame): Promise<void> {
    if (!this.client || !this.config) {
      throw new Error('MQTT client is not connected');
    }

    const { topicPrefix, retain } = this.config;
    const publishOptions: IClientPublishOptions = {
      retain,
      qos: 0,
    };

    const frameTopic = buildTopic(topicPrefix, 'frame');
    const payload = JSON.stringify(frame);

    await publishAsync(this.client, frameTopic, payload, publishOptions);

    const entries = Object.entries(frame.distances_mm) as [keyof SimulationFrame['distances_mm'], number][];

    await Promise.all([
      ...entries.map(([anchorId, distance]) =>
        publishAsync(
          this.client!,
          buildTopic(topicPrefix, `${anchorId}/distance_mm`),
          distance.toString(),
          publishOptions
        )
      ),
      publishAsync(
        this.client!,
        buildTopic(topicPrefix, 'tag'),
        JSON.stringify(frame.tag),
        publishOptions
      ),
    ]);
  }
}
