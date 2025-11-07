import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createTelemetryMqttClient } from '../transport/mqttClient';
import { createHttpPoller } from '../transport/httpPoller';
import { clampScale } from '../utils/telemetryMath';
const AppStateContext = createContext(undefined);
const DEFAULT_SCALE = Number(import.meta.env.VITE_DEFAULT_SCALE_MM_PER_PX ?? '2');
const MIN_SCALE = Number(import.meta.env.VITE_MIN_SCALE_MM_PER_PX ?? '0.5');
const MAX_SCALE = Number(import.meta.env.VITE_MAX_SCALE_MM_PER_PX ?? '5');
const MQTT_URL = import.meta.env.VITE_MQTT_WS_URL;
const MQTT_TOPIC = import.meta.env.VITE_MQTT_TOPIC;
const TELEMETRY_API_URL = import.meta.env.VITE_TELEMETRY_API_URL ?? '/api/telemetry';
// If explicit poll URL not provided, derive from API override, then Node-RED base + default path
const NODE_RED_BASE = import.meta.env.VITE_NODE_RED_BASE_URL;
const HTTP_POLL_URL = import.meta.env.VITE_HTTP_POLL_URL ??
    TELEMETRY_API_URL ??
    (NODE_RED_BASE ? `${NODE_RED_BASE.replace(/\/$/, '')}/uwb/rover/telemetry` : undefined);
const HTTP_POLL_INTERVAL_MS = Number(import.meta.env.VITE_HTTP_POLL_INTERVAL_MS ?? '250');
const ALLOWED_ORIGINS = import.meta.env.VITE_IFRAME_ALLOWED_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const CONNECTION_STATUS_VALUES = [
    'disconnected',
    'connecting',
    'connected',
    'reconnecting',
    'failed'
];
function toFiniteNumber(value) {
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
function normalizeTimestamp(value) {
    if (typeof value === 'string' && value.trim() !== '') {
        return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value).toISOString();
    }
    return null;
}
function normalizeTelemetry(candidate) {
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }
    const value = candidate;
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
export function AppStateProvider({ children }) {
    const [telemetry, setTelemetry] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [theme, setTheme] = useState('light');
    const [scale, setScaleState] = useState(DEFAULT_SCALE);
    const [embed] = useState(() => new URLSearchParams(window.location.search).get('embed') === '1');
    const [, setRefreshTick] = useState(0);
    useEffect(() => {
        if (!embed) {
            return;
        }
        const targetOrigins = ALLOWED_ORIGINS && ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : ['*'];
        const message = { type: 'rover-radar:ready' };
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
            console.log('[DEV] Node-RED Base:', NODE_RED_BASE);
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
        const handler = (event) => {
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
                setRefreshTick((tick) => tick + 1);
            }
            if ('telemetry' in event.data) {
                const nextTelemetry = normalizeTelemetry(event.data.telemetry);
                if (nextTelemetry) {
                    setTelemetry(nextTelemetry);
                }
            }
            if ('connectionStatus' in event.data) {
                const nextStatus = event.data.connectionStatus;
                if (typeof nextStatus === 'string' &&
                    CONNECTION_STATUS_VALUES.includes(nextStatus)) {
                    setConnectionStatus(nextStatus);
                }
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);
    const setScale = useCallback((next) => {
        if (Number.isFinite(next) && next > 0) {
            setScaleState(clampScale(next, MIN_SCALE, MAX_SCALE));
        }
    }, []);
    const forceRedraw = useCallback(() => {
        setRefreshTick((tick) => tick + 1);
    }, []);
    const value = useMemo(() => ({ telemetry, connectionStatus, theme, scale, embed, setTheme, setScale, forceRedraw }), [telemetry, connectionStatus, theme, scale, embed, setScale, forceRedraw]);
    return _jsx(AppStateContext.Provider, { value: value, children: children });
}
export function useAppState() {
    const ctx = useContext(AppStateContext);
    if (!ctx) {
        throw new Error('useAppState must be used inside <AppStateProvider>');
    }
    return ctx;
}
