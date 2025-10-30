import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoSendController, applyNoise, gaussianNoise, shouldAutoSend } from './sim';

const mockRandomSequence = (values: number[]): (() => number) => {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
};

describe('sim', () => {
  it('generates gaussian noise with deterministic random', () => {
    const random = mockRandomSequence([0.5, 0.25]);
    const value = gaussianNoise(10, random);
    expect(value).toBeCloseTo(6.532); // deterministic output
  });

  it('applies noise when enabled', () => {
    const distances = { A: 1000, B: 1100, C: 1200 };
    const random = mockRandomSequence([0.1, 0.7, 0.2, 0.9]);
    const noise = applyNoise(distances, { enabled: true, sigma: 50 }, random);
    expect(noise).not.toBeNull();
    if (noise) {
      expect(noise.A).not.toBe(distances.A);
    }
  });

  it('skips noise when disabled', () => {
    const distances = { A: 1000, B: 1100, C: 1200 };
    const noise = applyNoise(distances, { enabled: false, sigma: 50 });
    expect(noise).toBeNull();
  });

  describe('AutoSendController', () => {
    let callback: ReturnType<typeof vi.fn>;
    let timer: AutoSendController;

    beforeEach(() => {
      vi.useFakeTimers();
      callback = vi.fn();
      timer = new AutoSendController(callback, 100);
    });

    it('starts and triggers callback repeatedly', () => {
      timer.start();
      vi.advanceTimersByTime(350);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('updates interval dynamically', () => {
      timer.start();
      vi.advanceTimersByTime(200);
      timer.updateInterval(50);
      vi.advanceTimersByTime(200);
      expect(callback).toHaveBeenCalledTimes(5);
    });

    it('stops without calling callback further', () => {
      timer.start();
      timer.stop();
      vi.advanceTimersByTime(500);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  it('validates auto send parameters', () => {
    expect(shouldAutoSend(true, 100)).toBe(true);
    expect(shouldAutoSend(false, 100)).toBe(false);
    expect(shouldAutoSend(true, 0)).toBe(false);
  });
});
