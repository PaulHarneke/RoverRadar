import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const WARN_THRESHOLD = Number(import.meta.env.VITE_SPEED_WARN_MM_PER_S ?? '300');
const DANGER_THRESHOLD = Number(import.meta.env.VITE_SPEED_DANGER_MM_PER_S ?? '450');
function classifySpeed(value) {
    if (!Number.isFinite(value)) {
        return 'ok';
    }
    if (Math.abs(value ?? 0) >= DANGER_THRESHOLD) {
        return 'danger';
    }
    if (Math.abs(value ?? 0) >= WARN_THRESHOLD) {
        return 'warn';
    }
    return 'ok';
}
export function TelemetryPanel({ telemetry }) {
    const leftSpeed = telemetry?.drivetrain.front_left_axis_mm_per_s;
    const rightSpeed = telemetry?.drivetrain.front_right_axis_mm_per_s;
    const distance = telemetry?.tag.distance_mm;
    const angle = telemetry?.tag.angle_deg;
    const timestamp = telemetry?.timestamp ?? null;
    return (_jsxs("aside", { className: "panel telemetry-panel", "aria-label": "Live telemetry", children: [_jsx("h2", { children: "Telemetry" }), _jsxs("dl", { children: [_jsxs("div", { children: [_jsx("dt", { children: "Distance" }), _jsx("dd", { children: typeof distance === 'number' && Number.isFinite(distance)
                                    ? `${distance.toFixed(0)} mm`
                                    : '—' })] }), _jsxs("div", { children: [_jsx("dt", { children: "Angle" }), _jsx("dd", { children: typeof angle === 'number' && Number.isFinite(angle) ? `${angle.toFixed(1)}°` : '—' })] }), _jsxs("div", { className: `metric metric-${classifySpeed(leftSpeed)}`, children: [_jsx("dt", { children: "Front left speed" }), _jsx("dd", { children: typeof leftSpeed === 'number' && Number.isFinite(leftSpeed)
                                    ? `${leftSpeed.toFixed(0)} mm/s`
                                    : '—' })] }), _jsxs("div", { className: `metric metric-${classifySpeed(rightSpeed)}`, children: [_jsx("dt", { children: "Front right speed" }), _jsx("dd", { children: typeof rightSpeed === 'number' && Number.isFinite(rightSpeed)
                                    ? `${rightSpeed.toFixed(0)} mm/s`
                                    : '—' })] }), _jsxs("div", { children: [_jsx("dt", { children: "Timestamp" }), _jsx("dd", { children: timestamp ? new Date(timestamp).toLocaleTimeString() : '—' })] })] })] }));
}
