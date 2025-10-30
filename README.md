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

Open http://localhost:5000/ to view the UI. The development server automatically reloads when files change.

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

### Wechsel zwischen Development und Production

- Development-Modus: `npm run dev` (lädt `.env.development`)
- Production-Build: `npm run build` (verwendet `.env.production`)
- Produktion lokal testen: `npm run preview`
- Port festlegen: `VITE_PORT` in jeweiliger `.env.*` Datei (hier 5000)
- Gemeinsame Basiswerte optional in `.env` (niedrigste Priorität)
- Unterschied im Code erkennbar über `import.meta.env.DEV` / `import.meta.env.PROD`

Für tatsächliches Deployment: Inhalte aus `dist/` mit einem beliebigen Static File Server oder Reverse Proxy ausliefern.

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

### Beispiel Node-RED Testflow (MQTT + HTTP)

Importiere den folgenden Flow (Menü > Import > Clipboard). Er erzeugt alle 500 ms Test-Telemetrie, publiziert sie per MQTT und stellt gleichzeitig einen HTTP Fallback bereit.

```json
[
  {
    "id": "flow_main",
    "type": "tab",
    "label": "Rover Telemetry Demo",
    "disabled": false,
    "info": ""
  },
  {
    "id": "inj_tick",
    "type": "inject",
    "z": "flow_main",
    "name": "Tick 500ms",
    "props": [{ "p": "payload" }],
    "repeat": "0.5",
    "once": true,
    "onceDelay": 0.1,
    "topic": "",
    "x": 140,
    "y": 120,
    "wires": [["fn_build"]]
  },
  {
    "id": "fn_build",
    "type": "function",
    "z": "flow_main",
    "name": "Build Telemetry",
    "func": "// Zufallswerte generieren\nconst distance = 1500 + Math.random() * 1000; // 1500 - 2500 mm\nconst angle = -90 + Math.random() * 180;      // -90 bis +90°\nconst fl = 200 + Math.random() * 150;          // 200 - 350 mm/s\nconst fr = 200 + Math.random() * 150;          // 200 - 350 mm/s\n\nconst telemetry = {\n  timestamp: new Date().toISOString(),\n  tag: {\n    distance_mm: Number(distance.toFixed(1)),\n    angle_deg: Number(angle.toFixed(1))\n  },\n  drivetrain: {\n    front_left_axis_mm_per_s: Math.round(fl),\n    front_right_axis_mm_per_s: Math.round(fr)\n  }\n};\n\nflow.set('latestTelemetry', telemetry);\nmsg.payload = telemetry;\nreturn msg;",
    "outputs": 1,
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 360,
    "y": 120,
    "wires": [["mqtt_out"]]
  },
  {
    "id": "mqtt_out",
    "type": "mqtt out",
    "z": "flow_main",
    "name": "Publish Telemetry",
    "topic": "uwb/rover/telemetry",
    "qos": "",
    "retain": "",
    "respTopic": "",
    "contentType": "",
    "userProps": "",
    "correlationData": "",
    "expiry": "",
    "broker": "broker_local",
    "x": 600,
    "y": 120,
    "wires": []
  },
  {
    "id": "http_in",
    "type": "http in",
    "z": "flow_main",
    "name": "HTTP GET /uwb/rover/telemetry",
    "url": "/uwb/rover/telemetry",
    "method": "get",
    "upload": false,
    "swaggerDoc": "",
    "x": 180,
    "y": 220,
    "wires": [["fn_latest"]]
  },
  {
    "id": "fn_latest",
    "type": "function",
    "z": "flow_main",
    "name": "Read Latest",
    "func": "msg.payload = flow.get('latestTelemetry') || null;\nreturn msg;",
    "outputs": 1,
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 390,
    "y": 220,
    "wires": [["http_resp"]]
  },
  {
    "id": "http_resp",
    "type": "http response",
    "z": "flow_main",
    "name": "Respond JSON",
    "statusCode": "",
    "headers": {},
    "x": 600,
    "y": 220,
    "wires": []
  },
  {
    "id": "broker_local",
    "type": "mqtt-broker",
    "name": "Local Broker",
    "broker": "localhost",
    "port": "1883",
    "clientid": "node-red-rover",
    "usetls": false,
    "protocolVersion": "5",
    "keepalive": "60",
    "cleansession": true,
    "birthTopic": "",
    "birthQos": "0",
    "birthPayload": "",
    "closeTopic": "",
    "closeQos": "0",
    "closePayload": "",