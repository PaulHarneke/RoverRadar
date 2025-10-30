# UWB Rover Live Telemetry Web UI

A Vite + React TypeScript web application that renders live UWB telemetry for an autonomous rover. The UI is designed to be embedded as an iframe inside the Rover HMI and receives real-time data from Node-RED via MQTT over WebSocket with optional HTTP polling fallback.

## Features

- Real-time SVG visualization of rover position, tag distance, and angle in a rover-centric coordinate system.
- Telemetry panel with live distance, angle, and front axle velocities including configurable traffic-light thresholds.
- Robust MQTT connection handling with exponential backoff, connection state indicators, and offline buffering of the last known values.
- Optional HTTP polling fallback for environments without MQTT/WebSocket support.
- Embed mode (`?embed=1`) for minimal UI and programmatic control via `window.postMessage`.
- Responsive layout optimised for HMI displays without external UI frameworks.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
npm install
```

### Configuration

Vite lädt automatisch `.env.development` im Dev-Modus und `.env.production` beim Build. Du kannst auch `.env` für gemeinsame Werte verwenden.

**Modus-spezifische Dateien:**
- `.env.development` – Wird von `npm run dev` geladen
- `.env.production` – Wird von `npm run build` verwendet
- `.env` – Wird immer geladen (niedrigste Priorität)

**Im Code unterscheiden:**
```typescript
if (import.meta.env.DEV) {
  console.log('Entwicklungsmodus');
}

if (import.meta.env.PROD) {
  console.log('Produktionsmodus');
}

console.log('Aktueller Modus:', import.meta.env.MODE);
```

Update the values to match your Node-RED setup.

| Variable | Description |
| --- | --- |
| `VITE_MQTT_WS_URL` | MQTT broker WebSocket URL exposed by Node-RED |
| `VITE_MQTT_TOPIC` | Topic broadcasting rover telemetry JSON |
| `VITE_DEFAULT_SCALE_MM_PER_PX` | Initial scale for the SVG canvas |
| `VITE_MIN_SCALE_MM_PER_PX` | Minimum scale allowed when adjusting the canvas |
| `VITE_MAX_SCALE_MM_PER_PX` | Maximum scale allowed when adjusting the canvas |
| `VITE_IFRAME_ALLOWED_ORIGINS` | Comma-separated list of origins allowed to control the iframe via `postMessage` (use `*` for any) |
| `VITE_SPEED_WARN_MM_PER_S` | Warning threshold for front axle speeds |
| `VITE_SPEED_DANGER_MM_PER_S` | Danger threshold for front axle speeds |
| `VITE_MQTT_BACKOFF_INITIAL_MS` | Initial reconnect delay for MQTT |
| `VITE_MQTT_BACKOFF_MAX_MS` | Maximum reconnect delay for MQTT |
| `VITE_HTTP_POLL_URL` | (Optional) Node-RED HTTP endpoint for telemetry polling |
| `VITE_HTTP_POLL_INTERVAL_MS` | Polling interval when HTTP fallback is enabled |

### Development Server

```bash
npm run dev
```

Open http://localhost:5173/ to view the UI. The development server automatically reloads when files change.

### Production Build

```bash
npm run build
npm run preview
```

The `build` command compiles TypeScript, bundles the app, and outputs assets to `dist/`. `npm run preview` serves the production build locally for verification.

### Linting & Formatting

```bash
npm run lint
npm run format
```

### Testing

Unit tests are powered by Vitest + Testing Library.

```bash
npm test
```

## Telemetry Contract

Node-RED publishes telemetry in the following JSON structure:

```json
{
  "timestamp": "2025-10-23T12:00:00Z",
  "tag": { "distance_mm": 2530.4, "angle_deg": 37.8 },
  "drivetrain": {
    "front_left_axis_mm_per_s": 220,
    "front_right_axis_mm_per_s": 210
  }
}
```

## Node-RED Flow Snippet

Below is a simplified example flow that emits telemetry via MQTT and HTTP. Import into Node-RED and adapt as needed.

```json
[
  {
    "id": "mqtt-out",
    "type": "mqtt out",
    "z": "flow-id",
    "name": "UWB Rover Telemetry",
    "topic": "uwb/rover/telemetry",
    "qos": "0",
    "retain": "false",
    "broker": "mqtt-broker-id"
  },
  {
    "id": "http-out",
    "type": "http response",
    "z": "flow-id",
    "name": "Telemetry HTTP",
    "statusCode": "200",
    "headers": {},
    "x": 500,
    "y": 240,
    "wires": []
  }
]
```

## Embed Mode & `postMessage`

Append `?embed=1` to the application URL to activate the iframe-friendly layout. When embedded, the host page can control the UI via `window.postMessage`:

```js
iFrameEl.contentWindow.postMessage({ setTheme: 'dark' }, 'https://rover-hmi.example');
iFrameEl.contentWindow.postMessage({ setScale: 1.5 }, 'https://rover-hmi.example');
iFrameEl.contentWindow.postMessage({ forceRedraw: true }, 'https://rover-hmi.example');
```

Ensure the host origin is listed in `VITE_IFRAME_ALLOWED_ORIGINS` or use `*` for development.

### Example iframe Integration

```html
<iframe
  src="https://telemetry.example.com/?embed=1"
  title="Rover UWB Telemetry"
  width="100%"
  height="420"
  style="border:0;"
  allow="clipboard-write"
></iframe>
```

## Troubleshooting

- **No telemetry shown** – Confirm the MQTT broker is reachable via WebSocket and that `VITE_MQTT_TOPIC` is correct. Check browser DevTools for network errors.
- **CORS / origin errors** – When embedding, ensure the iframe origin is listed in `VITE_IFRAME_ALLOWED_ORIGINS`. The HTTP fallback endpoint must also permit cross-origin requests.
- **Connection flapping** – Tune `VITE_MQTT_BACKOFF_INITIAL_MS` and `VITE_MQTT_BACKOFF_MAX_MS` based on network stability. The UI indicates reconnect attempts in the status bar.
- **Slow updates** – Verify Node-RED publish interval and ensure the browser receives MQTT packets. The HTTP fallback interval can be adjusted if necessary.

## License

[MIT](./LICENSE)
