import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

declare module 'mqtt' {
  interface MqttClient extends EventEmitter {}
}

const connectMock = vi.fn();

vi.mock('mqtt', () => ({
  connect: connectMock
}));

class MockMqttClient extends EventEmitter {
  subscribe = vi.fn();
  end = vi.fn();
  removeAllListeners = vi.fn(() => {
    super.removeAllListeners();
    return this;
  });
}

describe('TelemetryMqttClient reconnect logic', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    connectMock.mockReset();
    vi.stubEnv('VITE_MQTT_BACKOFF_INITIAL_MS', '100');
    vi.stubEnv('VITE_MQTT_BACKOFF_MAX_MS', '800');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('retries with exponential backoff when the connection closes', async () => {
    connectMock.mockImplementation(() => new MockMqttClient());
    const { createTelemetryMqttClient } = await import('./mqttClient');

    const statusSpy = vi.fn();
    const client = createTelemetryMqttClient({
      url: 'ws://localhost',
      topic: 'uwb/rover/telemetry',
      onMessage: vi.fn(),
      onStatusChange: statusSpy
    });

    client.connect();
    expect(connectMock).toHaveBeenCalledTimes(1);

    const firstClient = connectMock.mock.results[0]?.value as MockMqttClient;
    firstClient.emit('close');
    vi.advanceTimersByTime(100);
    expect(connectMock).toHaveBeenCalledTimes(2);

    const secondClient = connectMock.mock.results[1]?.value as MockMqttClient;
    secondClient.emit('close');
    vi.advanceTimersByTime(200);
    expect(connectMock).toHaveBeenCalledTimes(3);

    expect(statusSpy).toHaveBeenCalledWith('connecting');
    expect(statusSpy).toHaveBeenCalledWith('reconnecting');
  });
});
