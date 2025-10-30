import { useMemo } from 'react';
import type { ChangeEvent } from 'react';
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

  return (
    <div className={`app-shell theme-${theme} ${embed ? 'embed-mode' : ''}`}>
      <main className="main">
        <RoverView telemetry={telemetry} scale={safeScale} />
      </main>
      {!embed ? (
        <div className="controls">
          <section className="panel settings-panel">
            <h2>Display settings</h2>
            <label>
              <span>Scale (mm per px)</span>
              <input
                type="range"
                min={MIN_SCALE}
                max={MAX_SCALE}
                step={0.1}
                value={safeScale}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setScale(Number(event.target.value))
                }
              />
              <span className="value">{safeScale.toFixed(2)}</span>
            </label>
            <label className="theme-toggle">
              <span>Theme</span>
              <select
                value={theme}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setTheme(event.target.value as 'light' | 'dark')
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </section>
          <TelemetryPanel telemetry={telemetry} />
        </div>
      ) : (
        <TelemetryPanel telemetry={telemetry} />
      )}
      <StatusBar status={connectionStatus} timestamp={telemetry?.timestamp ?? null} />
    </div>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}
