import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { calculateAngleLabel, calculateDistanceLabel, polarToCartesian } from '../utils/telemetryMath';
const ROVER_WIDTH_MM = 1210;
const ROVER_HEIGHT_MM = 810;
const TAG_MARKER_RADIUS = 8;
export function RoverView({ telemetry, scale }) {
    const widthPx = ROVER_WIDTH_MM / scale;
    const heightPx = ROVER_HEIGHT_MM / scale;
    const halfWidth = widthPx / 2;
    const halfHeight = heightPx / 2;
    const tagPoint = telemetry
        ? polarToCartesian(telemetry.tag.distance_mm, telemetry.tag.angle_deg, scale)
        : null;
    const labelDistance = telemetry ? calculateDistanceLabel(telemetry.tag.distance_mm) : '—';
    const labelAngle = telemetry ? calculateAngleLabel(telemetry.tag.angle_deg) : '—';
    return (_jsxs("div", { className: "rover-view", children: [_jsx("div", { className: "radar-canvas-wrapper", children: _jsxs("svg", { className: "rover-canvas", viewBox: `${-halfWidth} ${-halfHeight} ${widthPx} ${heightPx}`, role: "img", "aria-label": "Rover position visualization", children: [_jsx("defs", { children: _jsx("marker", { id: "arrow", viewBox: "0 0 10 10", refX: "10", refY: "5", markerWidth: "8", markerHeight: "8", orient: "auto", children: _jsx("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "currentColor" }) }) }), _jsx("rect", { x: -halfWidth, y: -halfHeight, width: widthPx, height: heightPx, rx: 12 / scale, className: "rover-body" }), _jsx("line", { x1: -halfWidth, y1: 0, x2: halfWidth, y2: 0, className: "axis-line" }), _jsx("line", { x1: 0, y1: -halfHeight, x2: 0, y2: halfHeight, className: "axis-line" }), tagPoint ? (_jsxs(_Fragment, { children: [_jsx("line", { x1: 0, y1: 0, x2: tagPoint.x, y2: tagPoint.y, className: "tag-line", markerEnd: "url(#arrow)" }), _jsx("circle", { cx: tagPoint.x, cy: tagPoint.y, r: TAG_MARKER_RADIUS / scale, className: "tag-point" })] })) : null] }) }), _jsxs("div", { className: "rover-metrics", children: [_jsxs("div", { children: [_jsx("span", { className: "label", children: "Distance" }), _jsx("span", { className: "value", children: labelDistance })] }), _jsxs("div", { children: [_jsx("span", { className: "label", children: "Angle" }), _jsx("span", { className: "value", children: labelAngle })] })] })] }));
}
