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

  it('falls back to http when https polling fails with a network TypeError', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const telemetry = {
      timestamp: new Date().toISOString(),
      tag: { distance_mm: 2000, angle_deg: 0 },
      drivetrain: { front_left_axis_mm_per_s: 200, front_right_axis_mm_per_s: 200 }
    };

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(telemetry)
    });

    const onData = vi.fn();
    const poller = createHttpPoller({
      url: 'https://169.254.75.59:1880/uwb/rover/telemetry',
      intervalMs: 1000,
      onData
    }) as unknown as { pollOnce: () => Promise<void> };

    await poller.pollOnce();

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://169.254.75.59:1880/uwb/rover/telemetry', {
      cache: 'no-store'
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://169.254.75.59:1880/uwb/rover/telemetry', {
      cache: 'no-store'
    });
    expect(onData).toHaveBeenCalledWith(telemetry);
  });
});
