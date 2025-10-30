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

  return (
    <div className={`app-shell theme-${theme}`}>
      <main className="main">
        <RoverView telemetry={telemetry} scale={safeScale} />
      </main>
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
