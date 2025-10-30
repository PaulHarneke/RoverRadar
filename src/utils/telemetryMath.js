export function polarToCartesian(distanceMm, angleDeg, mmPerPx) {
    const radians = (angleDeg * Math.PI) / 180;
    const radiusPx = distanceMm / mmPerPx;
    return {
        x: Math.cos(radians) * radiusPx,
        y: Math.sin(radians) * radiusPx
    };
}
export function clampScale(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
export function calculateDistanceLabel(distanceMm) {
    if (!Number.isFinite(distanceMm)) {
        return '—';
    }
    if (distanceMm >= 1000) {
        return `${(distanceMm / 1000).toFixed(2)} m`;
    }
    return `${distanceMm.toFixed(0)} mm`;
}
export function calculateAngleLabel(angleDeg) {
    if (!Number.isFinite(angleDeg)) {
        return '—';
    }
    return `${angleDeg.toFixed(1)}°`;
}
export function normalizeAngle(angleDeg) {
    let normalized = angleDeg % 360;
    if (normalized > 180) {
        normalized -= 360;
    }
    else if (normalized <= -180) {
        normalized += 360;
    }
    return normalized;
}
