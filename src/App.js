import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { AppStateProvider, useAppState } from './context/AppState';
import { RoverView } from './components/RoverView';
import { TelemetryPanel } from './components/TelemetryPanel';
import { StatusBar } from './components/StatusBar';
import { clampScale } from './utils/telemetryMath';
import './App.css';
const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
function AppContent() {
    const { telemetry, connectionStatus, scale, setScale, theme, setTheme, embed } = useAppState();
    const safeScale = useMemo(() => clampScale(scale, MIN_SCALE, MAX_SCALE), [scale]);
    return (_jsxs("div", { className: `app-shell theme-${theme} ${embed ? 'embed-mode' : ''}`, children: [_jsx("main", { className: "main", children: _jsx(RoverView, { telemetry: telemetry, scale: safeScale }) }), !embed ? (_jsxs("div", { className: "controls", children: [_jsxs("section", { className: "panel settings-panel", children: [_jsx("h2", { children: "Display settings" }), _jsxs("label", { children: [_jsx("span", { children: "Scale (mm per px)" }), _jsx("input", { type: "range", min: MIN_SCALE, max: MAX_SCALE, step: 0.1, value: safeScale, onChange: (event) => setScale(Number(event.target.value)) }), _jsx("span", { className: "value", children: safeScale.toFixed(2) })] }), _jsxs("label", { className: "theme-toggle", children: [_jsx("span", { children: "Theme" }), _jsxs("select", { value: theme, onChange: (event) => setTheme(event.target.value), children: [_jsx("option", { value: "light", children: "Light" }), _jsx("option", { value: "dark", children: "Dark" })] })] })] }), _jsx(TelemetryPanel, { telemetry: telemetry })] })) : (_jsx(TelemetryPanel, { telemetry: telemetry })), _jsx(StatusBar, { status: connectionStatus, timestamp: telemetry?.timestamp ?? null })] }));
}
export default function App() {
    return (_jsx(AppStateProvider, { children: _jsx(AppContent, {}) }));
}
