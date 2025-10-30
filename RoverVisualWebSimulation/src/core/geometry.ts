import { AnchorId, AnchorRecord, DistanceRecord, PointMM, SimulationFrame } from './types';

export const ROVER_WIDTH_MM = 1210;
export const ROVER_HEIGHT_MM = 810;
export const GRID_MAJOR_STEP_MM = 100;
export const GRID_MINOR_STEP_MM = 10;

export const DEFAULT_ANCHOR_POSITIONS: AnchorRecord = {
  A: { id: 'A', position: { x: 600, y: 400 }, color: '#ef4444' },
  B: { id: 'B', position: { x: 600, y: -400 }, color: '#22c55e' },
  C: { id: 'C', position: { x: -600, y: 0 }, color: '#3b82f6' },
};

export function distanceMm(a: PointMM, b: PointMM): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function computeDistances(tag: PointMM, anchors: AnchorRecord): DistanceRecord {
  return {
    A: distanceMm(tag, anchors.A.position),
    B: distanceMm(tag, anchors.B.position),
    C: distanceMm(tag, anchors.C.position),
  };
}

export function formatMillimetres(value: number, digits = 1): string {
  return value.toFixed(digits);
}

export function snapToGrid(point: PointMM, step = GRID_MINOR_STEP_MM): PointMM {
  return {
    x: Math.round(point.x / step) * step,
    y: Math.round(point.y / step) * step,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function toSimulationFrame(
  tag: PointMM,
  anchors: AnchorRecord,
  distances: DistanceRecord,
  simulatedDistances: DistanceRecord | null
): SimulationFrame {
  const timestamp = new Date().toISOString();
  const anchorEntries = Object.values(anchors).reduce<SimulationFrame['anchors']>((acc, anchor) => {
    acc[anchor.id as AnchorId] = {
      x_mm: anchor.position.x,
      y_mm: anchor.position.y,
    };
    return acc;
  }, {} as SimulationFrame['anchors']);

  const frame: SimulationFrame = {
    timestamp,
    tag: { x_mm: tag.x, y_mm: tag.y },
    anchors: anchorEntries,
    distances_mm: {
      A: Number(distances.A.toFixed(1)),
      B: Number(distances.B.toFixed(1)),
      C: Number(distances.C.toFixed(1)),
    },
  };

  if (simulatedDistances) {
    frame.distances_simulated_mm = {
      A: Number(simulatedDistances.A.toFixed(1)),
      B: Number(simulatedDistances.B.toFixed(1)),
      C: Number(simulatedDistances.C.toFixed(1)),
    };
  }

  return frame;
}

export function isPointEqual(a: PointMM, b: PointMM, tolerance = 1e-3): boolean {
  return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance;
}

export function rotatePoint(point: PointMM, angleRad: number): PointMM {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

export function translatePoint(point: PointMM, delta: PointMM): PointMM {
  return {
    x: point.x + delta.x,
    y: point.y + delta.y,
  };
}

export function ensureNumeric(value: string | number, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
