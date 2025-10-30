export interface HttpClientOptions {
  timeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export class HttpClient {
  constructor(private readonly options: HttpClientOptions) {}

  async post<T>(url: string, payload: T): Promise<Response> {
    const body = JSON.stringify(payload);
    let attempt = 0;
    let lastError: unknown;
    const maxAttempts = this.options.retryCount + 1;

    while (attempt < maxAttempts) {
      try {
        const response = await fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body,
          },
          this.options.timeoutMs
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        return response;
      } catch (error) {
        lastError = error;
        attempt += 1;
        if (attempt >= maxAttempts) {
          break;
        }
        const jitter = Math.random() * 0.25 + 0.75;
        await delay(this.options.retryDelayMs * jitter);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('HTTP request failed');
  }
}
