import { jsx as _jsx } from "react/jsx-runtime";
import { useMemo } from 'react';
import { AppStateProvider, useAppState } from './context/AppState';
import { RoverView } from './components/RoverView';
import { clampScale } from './utils/telemetryMath';
import './App.css';
const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
function AppContent() {
    const { telemetry, scale, theme } = useAppState();
    const safeScale = useMemo(() => clampScale(scale, MIN_SCALE, MAX_SCALE), [scale]);
    return (_jsx("div", { className: `app-shell theme-${theme}`, children: _jsx("main", { className: "main", children: _jsx(RoverView, { telemetry: telemetry, scale: safeScale }) }) }));
}
export default function App() {
    return (_jsx(AppStateProvider, { children: _jsx(AppContent, {}) }));
}
