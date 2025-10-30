export interface Point {
  x: number;
  y: number;
}

export function polarToCartesian(distanceMm: number, angleDeg: number, mmPerPx: number): Point {
  const radians = (angleDeg * Math.PI) / 180;
  const radiusPx = distanceMm / mmPerPx;
  return {
    x: Math.cos(radians) * radiusPx,
    y: Math.sin(radians) * radiusPx
  };
}

export function clampScale(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateDistanceLabel(distanceMm: number): string {
  if (!Number.isFinite(distanceMm)) {
    return '—';
  }
  if (distanceMm >= 1000) {
    return `${(distanceMm / 1000).toFixed(2)} m`;
  }
  return `${distanceMm.toFixed(0)} mm`;
}

export function calculateAngleLabel(angleDeg: number): string {
  if (!Number.isFinite(angleDeg)) {
    return '—';
  }
  return `${angleDeg.toFixed(1)}°`;
}

export function normalizeAngle(angleDeg: number): number {
  let normalized = angleDeg % 360;
  if (normalized > 180) {
    normalized -= 360;
  } else if (normalized <= -180) {
    normalized += 360;
  }
  return normalized;
}
