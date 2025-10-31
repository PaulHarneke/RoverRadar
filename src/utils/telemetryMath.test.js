import { describe, expect, it } from 'vitest';
import { calculateDistanceLabel, polarToCartesian } from './telemetryMath';
describe('telemetry math helpers', () => {
    it('converts polar coordinates to cartesian for SVG rendering', () => {
        const { x, y } = polarToCartesian(1000, 45, 2);
        // radiusPx = 500; sin(45°)=cos(45°)=~0.707106 => x≈353.553, y≈-353.553
        expect(x).toBeCloseTo(353.55, 2);
        expect(y).toBeCloseTo(-353.55, 2);
    });
    it('formats distance labels in meters above one metre', () => {
        expect(calculateDistanceLabel(2530.4)).toBe('2.53 m');
        expect(calculateDistanceLabel(820)).toBe('820 mm');
    });
});
