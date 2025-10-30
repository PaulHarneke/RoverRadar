import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createTelemetryMqttClient, type ConnectionStatus } from '../transport/mqttClient';
import { createHttpPoller } from '../transport/httpPoller';
import { clampScale } from '../utils/telemetryMath';

export interface TelemetryMessage {
  timestamp: string;
  tag: {
    distance_mm: number;
    angle_deg: number;
  };
  drivetrain: {
    front_left_axis_mm_per_s: number;
    front_right_axis_mm_per_s: number;
  };
}

export type ThemeMode = 'light' | 'dark';

interface AppStateValue {
  telemetry: TelemetryMessage | null;
  connectionStatus: ConnectionStatus;
  theme: ThemeMode;
  scale: number;
  embed: boolean;
  setTheme: (next: ThemeMode) => void;
  setScale: (next: number) => void;
  forceRedraw: () => void;
}

const AppStateContext = createContext<AppStateValue | undefined>(undefined);

const DEFAULT_SCALE = Number(import.meta.env.VITE_DEFAULT_SCALE_MM_PER_PX ?? '2');
const MIN_SCALE = Number(import.meta.env.VITE_MIN_SCALE_MM_PER_PX ?? '0.5');
const MAX_SCALE = Number(import.meta.env.VITE_MAX_SCALE_MM_PER_PX ?? '5');
const MQTT_URL = import.meta.env.VITE_MQTT_WS_URL as string | undefined;
const MQTT_TOPIC = import.meta.env.VITE_MQTT_TOPIC as string | undefined;
const HTTP_POLL_URL = import.meta.env.VITE_HTTP_POLL_URL as string | undefined;
const HTTP_POLL_INTERVAL_MS = Number(import.meta.env.VITE_HTTP_POLL_INTERVAL_MS ?? '250');
const ALLOWED_ORIGINS = (import.meta.env.VITE_IFRAME_ALLOWED_ORIGINS as string | undefined)
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

interface ProviderProps {
  children: ReactNode;
}

export function AppStateProvider({ children }: ProviderProps) {
  const [telemetry, setTelemetry] = useState<TelemetryMessage | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [scale, setScaleState] = useState<number>(DEFAULT_SCALE);
  const [embed] = useState(() => new URLSearchParams(window.location.search).get('embed') === '1');
  const [, setRefreshTick] = useState(0);

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (!MQTT_URL || !MQTT_TOPIC) {
      setConnectionStatus('failed');
      return;
    }

    const mqtt = createTelemetryMqttClient({
      url: MQTT_URL,
      topic: MQTT_TOPIC,
      onMessage: (message) => {
        if (message) {
          setTelemetry(message);
        }
      },
      onStatusChange: setConnectionStatus
    });

    mqtt.connect();

    return () => {
      mqtt.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!HTTP_POLL_URL) {
      return;
    }

    const poller = createHttpPoller({
      url: HTTP_POLL_URL,
      intervalMs: HTTP_POLL_INTERVAL_MS,
      onData: (message) => {
        if (message) {
          setTelemetry(message);
        }
      }
    });

    poller.start();

    return () => poller.stop();
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (ALLOWED_ORIGINS && !ALLOWED_ORIGINS.includes('*')) {
        if (!ALLOWED_ORIGINS.includes(event.origin)) {
          return;
        }
      }

      if (typeof event.data !== 'object' || event.data === null) {
        return;
      }

      if ('setTheme' in event.data) {
        const nextTheme = event.data.setTheme;
        if (nextTheme === 'dark' || nextTheme === 'light') {
          setTheme(nextTheme);
        }
      }

      if ('setScale' in event.data) {
        const mmPerPx = Number(event.data.setScale);
        if (Number.isFinite(mmPerPx) && mmPerPx > 0) {
          setScaleState(clampScale(mmPerPx, MIN_SCALE, MAX_SCALE));
        }
      }

      if ('forceRedraw' in event.data) {
        setRefreshTick((tick: number) => tick + 1);
      }
    };

    window.addEventListener('message', handler);

    return () => window.removeEventListener('message', handler);
  }, []);

  const setScale = useCallback((next: number) => {
    if (Number.isFinite(next) && next > 0) {
      setScaleState(clampScale(next, MIN_SCALE, MAX_SCALE));
    }
  }, []);

  const forceRedraw = useCallback(() => {
    setRefreshTick((tick: number) => tick + 1);
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({ telemetry, connectionStatus, theme, scale, embed, setTheme, setScale, forceRedraw }),
    [telemetry, connectionStatus, theme, scale, embed, setScale, forceRedraw]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used inside <AppStateProvider>');
  }
  return ctx;
}
