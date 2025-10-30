import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { calculateAngleLabel, calculateDistanceLabel, polarToCartesian } from '../utils/telemetryMath';
const FIELD_DIAMETER_MM = 10000;
const FIELD_RADIUS_MM = FIELD_DIAMETER_MM / 2;
const TAG_MARKER_RADIUS = Number(import.meta.env.VITE_TAG_MARKER_RADIUS ?? '100');
const RANGE_RING_STEPS = [0.25, 0.5, 0.75];
const ANGLE_MARKERS = [0, 90, 180, 270];
export function RoverView({ telemetry, scale }) {
    const canvasWidthPx = FIELD_DIAMETER_MM / scale;
    const canvasHeightPx = FIELD_DIAMETER_MM / scale;
    const halfWidth = canvasWidthPx / 2;
    const halfHeight = canvasHeightPx / 2;
    const tagPoint = telemetry
        ? polarToCartesian(telemetry.tag.distance_mm, telemetry.tag.angle_deg, scale)
        : null;
    const labelDistance = telemetry ? calculateDistanceLabel(telemetry.tag.distance_mm) : '—';
    const labelAngle = telemetry ? calculateAngleLabel(telemetry.tag.angle_deg) : '—';
    return (_jsx("div", { className: "rover-view", children: _jsx("div", { className: "radar-canvas-wrapper", children: _jsxs("svg", { className: "rover-canvas", viewBox: `${-halfWidth} ${-halfHeight} ${canvasWidthPx} ${canvasHeightPx}`, role: "img", "aria-label": "Rover position visualization", children: [_jsx("circle", { cx: 0, cy: 0, r: FIELD_RADIUS_MM / scale, strokeWidth: 2 / scale, className: "field-boundary" }), _jsx("g", { className: "range-rings", children: RANGE_RING_STEPS.map((step) => {
                            const ringRadius = (FIELD_RADIUS_MM * step) / scale;
                            const distanceLabel = calculateDistanceLabel(FIELD_RADIUS_MM * step);
                            return (_jsxs("g", { children: [_jsx("circle", { cx: 0, cy: 0, r: ringRadius, className: "range-ring" }), _jsx("text", { x: 0, y: -ringRadius, className: "range-label", textAnchor: "middle", dominantBaseline: "text-after-edge", children: distanceLabel })] }, step));
                        }) }), _jsx("g", { className: "angle-guides", children: ANGLE_MARKERS.map((angle) => {
                            const lineEnd = polarToCartesian(FIELD_RADIUS_MM, angle, scale);
                            const labelPoint = polarToCartesian(FIELD_RADIUS_MM + 350, angle, scale);
                            const angleLabel = angle === 0 ? '0° / 360°' : `${angle}°`;
                            return (_jsxs("g", { children: [_jsx("line", { x1: 0, y1: 0, x2: lineEnd.x, y2: lineEnd.y, className: "axis-line" }), _jsx("text", { x: labelPoint.x, y: labelPoint.y, className: "angle-label", textAnchor: "middle", dominantBaseline: "middle", children: angleLabel })] }, angle));
                        }) }), tagPoint ? (_jsxs(_Fragment, { children: [_jsx("line", { x1: 0, y1: 0, x2: tagPoint.x, y2: tagPoint.y, className: "tag-line" }), _jsx("circle", { cx: tagPoint.x, cy: tagPoint.y, r: TAG_MARKER_RADIUS / scale, className: "tag-point" }), _jsx("text", { x: tagPoint.x, y: tagPoint.y - 220 / scale, className: "tag-readout", textAnchor: "middle", dominantBaseline: "text-after-edge", children: `${labelDistance} • ${labelAngle}` })] })) : null] }) }) }));
}
