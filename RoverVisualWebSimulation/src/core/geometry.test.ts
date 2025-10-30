import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANCHOR_POSITIONS,
  GRID_MINOR_STEP_MM,
  ROVER_HEIGHT_MM,
  ROVER_WIDTH_MM,
  computeDistances,
  distanceMm,
  snapToGrid,
  toSimulationFrame,
} from './geometry';

const TAG_AT_ORIGIN = { x: 0, y: 0 };

describe('geometry', () => {
  it('computes euclidean distance in millimetres', () => {
    expect(distanceMm({ x: 0, y: 0 }, { x: 300, y: 400 })).toBeCloseTo(500);
  });

  it('computes anchor distances for default setup', () => {
    const distances = computeDistances(TAG_AT_ORIGIN, DEFAULT_ANCHOR_POSITIONS);
    expect(distances.A).toBeCloseTo(0);
    expect(distances.B).toBeCloseTo(800);
    expect(distances.C).toBeCloseTo(1200, 1);
  });

  it('snaps points to grid increments', () => {
    const snapped = snapToGrid({ x: 23, y: -47 }, GRID_MINOR_STEP_MM);
    expect(snapped).toEqual({ x: 20, y: -50 });
  });

  it('creates simulation frame with rounded distances', () => {
    const distances = computeDistances({ x: 100, y: 200 }, DEFAULT_ANCHOR_POSITIONS);
    const frame = toSimulationFrame({ x: 100, y: 200 }, DEFAULT_ANCHOR_POSITIONS, distances, null);
    expect(frame.tag).toEqual({ x_mm: 100, y_mm: 200 });
    expect(frame.distances_mm.A).toBe(223.6);
  });

  it('exports rover constants', () => {
    expect(ROVER_WIDTH_MM).toBeGreaterThan(ROVER_HEIGHT_MM);
  });
});
