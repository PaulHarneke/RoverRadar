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

### Node-RED Kommunikation konfigurieren

Setze/verändere in `.env.development` (Dev) bzw. `.env.production` (Build):

```bash
VITE_MQTT_WS_URL=wss://localhost:9001          # Secure WebSocket Endpoint des Brokers (Node-RED/Mosquitto)
VITE_MQTT_TOPIC=uwb/rover/telemetry           # Telemetrie-Topic
VITE_MQTT_BACKOFF_INITIAL_MS=500              # Erster Reconnect-Delay
VITE_MQTT_BACKOFF_MAX_MS=8000                 # Max. Reconnect-Delay
VITE_HTTP_POLL_URL=https://localhost:1880/uwb/rover/telemetry   # (Optional) HTTPS Fallback
VITE_HTTP_POLL_INTERVAL_MS=250                # Poll-Intervall in ms
VITE_IFRAME_ALLOWED_ORIGINS=http://localhost:1880
```

Wechsel der Modi:
- Dev: `npm run dev` (lädt `.env.development`)
- Prod Preview: `npm run build && npm run preview` (nutzt `.env.production`)
- Gemeinsame Defaults: `.env`
- Zugriff im Code: `import.meta.env.VITE_MQTT_WS_URL` etc.

### Development Server

```bash
npm run dev
```

Open http://localhost:5000/ to view the UI. The development server automatically reloads when files change.

### HTTPS im Development

Für eingebettete iframes in einer HTTPS-Seite muss auch der Dev-Server per HTTPS erreichbar sein (sonst Mixed-Content Block). Dieses Projekt unterstützt optional selbst-signierte Zertifikate.

Schnellstart (Zertifikat erzeugen falls fehlend und HTTPS starten):

```bash
npm run dev:https
```

Das Skript `scripts/ensure-dev-cert.mjs` erzeugt bei Bedarf `cert/dev.key` und `cert/dev.crt` (self-signed) und startet Vite mit HTTPS (`VITE_HTTPS=1`). Browser zeigt einmalig eine Warnung – bestätige sie.

Manuell erzeugen:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -keyout cert/dev.key -out cert/dev.crt -days 365 -subj "/CN=localhost"
export VITE_HTTPS=1
export VITE_SSL_KEY=cert/dev.key
export VITE_SSL_CERT=cert/dev.crt
npm run dev
```

Hinweise:
- Self-signed Zertifikat nur für lokale Entwicklung.
- In Produktion echte Zertifikate (z.B. Let's Encrypt) via Reverse Proxy (Caddy, Traefik, Nginx) verwenden.
- Mixed Content vermeiden: Verwende `wss://` für `VITE_MQTT_WS_URL` und HTTPS für alle eingebetteten Ressourcen.
- Windows Hinweis: Falls `openssl` nicht verfügbar ist, erzeugt das Script automatisch ein Fallback über das npm Paket `selfsigned`. Alternativ kannst du `mkcert` installieren.
- mkcert Installation (Linux Beispiel):
  ```bash
  sudo apt install -y libnss3-tools
  curl -L https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v1.4.4-linux-amd64 -o mkcert
  chmod +x mkcert
  sudo mv mkcert /usr/local/bin/
  mkcert -install
  mkcert -key-file cert/dev.key -cert-file cert/dev.crt localhost
  ```

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

Importiere den Flow (Menü > Import > Clipboard). Er generiert Test-Telemetrie alle 500 ms, publiziert per MQTT und stellt einen HTTP Fallback unter `/uwb/rover/telemetry` bereit.

```json
[
  {
    "id": "f_tab01",
    "type": "tab",
    "label": "Rover Telemetry Demo",
    "disabled": false,
    "info": ""
  },
  {
    "id": "inj_500ms",
    "type": "inject",
    "z": "f_tab01",
    "name": "Tick 500ms",
    "props": [{ "p": "payload" }],
    "repeat": "0.5",
    "once": true,
    "onceDelay": "0.1",
    "topic": "",
    "x": 150,
    "y": 120,
    "wires": [["fn_build"]]
  },
  {
    "id": "fn_build",
    "type": "function",
    "z": "f_tab01",
    "name": "Build Telemetry",
    "func": "// Zufallswerte erzeugen\nconst distance = 1500 + Math.random() * 1000;   // 1500..2500 mm\nconst angle = -90 + Math.random() * 180;         // -90..+90°\nconst fl = 180 + Math.random() * 200;            // 180..380 mm/s\nconst fr = 180 + Math.random() * 200;\n\nconst telemetry = {\n  timestamp: new Date().toISOString(),\n  tag: {\n    distance_mm: Number(distance.toFixed(1)),\n    angle_deg: Number(angle.toFixed(1))\n  },\n  drivetrain: {\n    front_left_axis_mm_per_s: Math.round(fl),\n    front_right_axis_mm_per_s: Math.round(fr)\n  }\n};\n\nflow.set('latestTelemetry', telemetry);\nmsg.payload = telemetry;\nreturn msg;",
    "outputs": 1,
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 370,
    "y": 120,
    "wires": [["mqtt_out", "dbg_out"]]
  },
  {
    "id": "mqtt_out",
    "type": "mqtt out",
    "z": "f_tab01",
    "name": "Publish Telemetry",
    "topic": "uwb/rover/telemetry",
    "qos": "0",
    "retain": "false",
    "respTopic": "",
    "contentType": "",
    "userProps": "",
    "correlationData": "",
    "expiry": "",
    "broker": "broker_local",
    "x": 640,
    "y": 100,
    "wires": []
  },
  {
    "id": "dbg_out",
    "type": "debug",
    "z": "f_tab01",
    "name": "Debug Telemetry",
    "active": true,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "payload",
    "statusVal": "",
    "statusType": "auto",
    "x": 640,
    "y": 140,
    "wires": []
  },
  {
    "id": "http_in",
    "type": "http in",
    "z": "f_tab01",
    "name": "HTTP GET /uwb/rover/telemetry",
    "url": "/uwb/rover/telemetry",
    "method": "get",
    "upload": false,
    "swaggerDoc": "",
    "x": 190,
    "y": 220,
    "wires": [["fn_latest"]]
  },
  {
    "id": "fn_latest",
    "type": "function",
    "z": "f_tab01",
    "name": "Read Latest",
    "func": "const latest = flow.get('latestTelemetry');\nif (!latest) {\n  msg.statusCode = 204; // No Content\n  msg.payload = null;\n  return msg;\n}\nmsg.payload = latest;\nmsg.headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };\nreturn msg;",
    "outputs": 1,
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 410,
    "y": 220,
    "wires": [["http_resp"]]
  },
  {
    "id": "http_resp",
    "type": "http response",
    "z": "f_tab01",
    "name": "Respond JSON",
    "statusCode": "",
    "headers": {},
    "x": 640,
    "y": 220,
    "wires": []
  },
  {
    "id": "broker_local",
    "type": "mqtt-broker",
    "name": "Local Mosquitto",
    "broker": "localhost",
    "port": "1883",
    "clientid": "node-red-rover-demo",
    "usetls": false,
    "protocolVersion": "4",
    "keepalive": "30",
    "cleansession": true,
    "birthTopic": "",
    "birthQos": "0",
    "birthPayload": "",
    "closeTopic": "",
    "closeQos": "0",




    