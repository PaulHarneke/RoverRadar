import { DistanceRecord, NoiseSettings } from './types';

export type RandomSource = () => number;

const DEFAULT_RANDOM_SOURCE: RandomSource = () => Math.random();

export function gaussianNoise(sigma: number, random: RandomSource = DEFAULT_RANDOM_SOURCE): number {
  if (sigma === 0) {
    return 0;
  }

  // Box-Muller transform
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) {
    u1 = random();
  }
  u2 = random();
  const mag = Math.sqrt(-2.0 * Math.log(u1));
  const z0 = mag * Math.cos(2.0 * Math.PI * u2);
  return z0 * sigma;
}

export function applyNoise(
  distances: DistanceRecord,
  noise: NoiseSettings,
  random: RandomSource = DEFAULT_RANDOM_SOURCE
): DistanceRecord | null {
  if (!noise.enabled || noise.sigma <= 0) {
    return null;
  }

  return {
    A: distances.A + gaussianNoise(noise.sigma, random),
    B: distances.B + gaussianNoise(noise.sigma, random),
    C: distances.C + gaussianNoise(noise.sigma, random),
  };
}

export class AutoSendController {
  private timer: ReturnType<typeof setInterval> | null = null;
  private intervalMs: number;
  private readonly callback: () => void;

  constructor(callback: () => void, intervalMs: number) {
    this.callback = callback;
    this.intervalMs = intervalMs;
  }

  start(intervalMs?: number): void {
    if (intervalMs !== undefined) {
      this.intervalMs = intervalMs;
    }
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.callback();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  updateInterval(intervalMs: number): void {
    this.intervalMs = intervalMs;
    if (this.timer) {
      this.stop();
      this.start();
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }
}

export function shouldAutoSend(enabled: boolean, intervalMs: number): boolean {
  return enabled && Number.isFinite(intervalMs) && intervalMs > 0;
}
