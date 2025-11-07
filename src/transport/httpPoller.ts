import type { TelemetryMessage } from '../context/AppState';

interface HttpPollerOptions {
  url: string;
  intervalMs: number;
  onData: (message: TelemetryMessage | null) => void;
}

export function createHttpPoller(options: HttpPollerOptions) {
  return new HttpPoller(options);
}

class HttpPoller {
  private readonly url: string;
  private readonly intervalMs: number;
  private readonly onData: (message: TelemetryMessage | null) => void;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private aborted = false;

  constructor(options: HttpPollerOptions) {
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

  private schedule() {
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

  private async pollOnce() {
    try {
      const body = await this.fetchTelemetry(this.url);
      this.onData(body);
    } catch (error) {
      console.warn('HTTP poll error', error);
    }
  }

  private async fetchTelemetry(url: string) {
    const response = await fetch(url, {
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error(`HTTP poll failed: ${response.status}`);
    }
    return (await response.json()) as TelemetryMessage;
  }
}
