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
const TELEMETRY_API_URL = (import.meta.env.VITE_TELEMETRY_API_URL as string | undefined) ?? '/api/telemetry';
const HTTP_POLL_URL = (import.meta.env.VITE_HTTP_POLL_URL as string | undefined) ?? TELEMETRY_API_URL;
const HTTP_POLL_INTERVAL_MS = Number(import.meta.env.VITE_HTTP_POLL_INTERVAL_MS ?? '250');
const ALLOWED_ORIGINS = (import.meta.env.VITE_IFRAME_ALLOWED_ORIGINS as string | undefined)
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

interface ProviderProps {
  children: ReactNode;
}

const CONNECTION_STATUS_VALUES: readonly ConnectionStatus[] = [
  'disconnected',
  'connecting',
  'connected',
  'reconnecting',
  'failed'
];

type TelemetryLike = {
  timestamp?: unknown;
  tag?: {
    distance_mm?: unknown;
    angle_deg?: unknown;
  } | null;
  drivetrain?: {
    front_left_axis_mm_per_s?: unknown;
    front_right_axis_mm_per_s?: unknown;
  } | null;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return null;
}

function normalizeTelemetry(candidate: unknown): TelemetryMessage | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const value = candidate as TelemetryLike;
  const timestamp = normalizeTimestamp(value.timestamp) ?? new Date().toISOString();
  const distance = toFiniteNumber(value.tag?.distance_mm);
  const angle = toFiniteNumber(value.tag?.angle_deg);
  const frontLeft = toFiniteNumber(value.drivetrain?.front_left_axis_mm_per_s);
  const frontRight = toFiniteNumber(value.drivetrain?.front_right_axis_mm_per_s);

  if (distance === null || angle === null || frontLeft === null || frontRight === null) {
    return null;
  }

  return {
    timestamp,
    tag: {
      distance_mm: distance,
      angle_deg: angle
    },
    drivetrain: {
      front_left_axis_mm_per_s: frontLeft,
      front_right_axis_mm_per_s: frontRight
    }
  };
}

export function AppStateProvider({ children }: ProviderProps) {
  const [telemetry, setTelemetry] = useState<TelemetryMessage | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [scale, setScaleState] = useState<number>(DEFAULT_SCALE);
  const [embed] = useState(() => new URLSearchParams(window.location.search).get('embed') === '1');
  const [, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!embed) {
      return;
    }

    const targetOrigins = ALLOWED_ORIGINS && ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : ['*'];
    const message = { type: 'rover-radar:ready' as const };

    for (const origin of targetOrigins) {
      window.parent.postMessage(message, origin);
    }
  }, [embed]);

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[DEV] MQTT URL:', MQTT_URL);
      console.log('[DEV] MQTT Topic:', MQTT_TOPIC);
      console.log('[DEV] HTTP Fallback:', HTTP_POLL_URL);
      console.log('[DEV] Telemetry API:', TELEMETRY_API_URL);
    }

    if (!MQTT_URL || !MQTT_TOPIC) {
      if (!embed) {
        setConnectionStatus('failed');
      }
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
  }, [embed]);

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

      if ('telemetry' in event.data) {
        const nextTelemetry = normalizeTelemetry(event.data.telemetry);
        if (nextTelemetry) {
          setTelemetry(nextTelemetry);
        }
      }

      if ('connectionStatus' in event.data) {
        const nextStatus = event.data.connectionStatus;
        if (
          typeof nextStatus === 'string' &&
          (CONNECTION_STATUS_VALUES as readonly string[]).includes(nextStatus)
        ) {
          setConnectionStatus(nextStatus as ConnectionStatus);
        }
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
