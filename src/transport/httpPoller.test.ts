import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHttpPoller } from './httpPoller';

describe('HTTP poller', () => {
  const originalFetch = global.fetch;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    warnSpy.mockRestore();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('logs a warning when polling fails', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const onData = vi.fn();
    const poller = createHttpPoller({
      url: 'https://example.test/api/telemetry',
      intervalMs: 1000,
      onData
    }) as unknown as { pollOnce: () => Promise<void> };

    await poller.pollOnce();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/api/telemetry', {
      cache: 'no-store'
    });
    expect(onData).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('HTTP poll error', expect.any(TypeError));
  });
});
