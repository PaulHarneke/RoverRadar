interface ImportMetaEnv {
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly VITE_MQTT_WS_URL?: string;
  readonly VITE_MQTT_TOPIC?: string;
  readonly VITE_NODE_RED_BASE_URL?: string; // Base URL for Node-RED (e.g. https://169.254.75.59:1880)
  readonly VITE_HTTP_POLL_URL?: string;
  readonly VITE_HTTP_POLL_INTERVAL_MS?: string;
  readonly VITE_DEFAULT_SCALE_MM_PER_PX?: string;
  readonly VITE_MIN_SCALE_MM_PER_PX?: string;
  readonly VITE_MAX_SCALE_MM_PER_PX?: string;
  readonly VITE_IFRAME_ALLOWED_ORIGINS?: string;
  readonly VITE_SPEED_WARN_MM_PER_S?: string;
  readonly VITE_SPEED_DANGER_MM_PER_S?: string;
  readonly VITE_MQTT_BACKOFF_INITIAL_MS?: string;
  readonly VITE_MQTT_BACKOFF_MAX_MS?: string;
  readonly VITE_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
