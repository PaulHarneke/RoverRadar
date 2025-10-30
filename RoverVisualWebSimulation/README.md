# UWB Multi-Anchor Simulation Web

Eine interaktive 2D-Websimulation für Ultra-Wideband (UWB) Abstandsmessungen zwischen drei stationären Ankern (A/B/C) und einem beweglichen Rover-Tag. Die Anwendung visualisiert Entfernungen in Millimetern, simuliert Messrauschen und überträgt die Daten per HTTP oder MQTT (WebSocket) an Node-RED. Sie ist vollständig iframe-tauglich und kann in andere Dashboards eingebettet werden.

## Features

- 🚀 **Top-Down SVG Canvas** mit Rover-Grundriss (1210 × 810 mm), Raster, Achsen und Distanz-Overlays.
- 🖱️ **Drag & Drop** des Rover-Tags; Snap-to-Grid (10 mm) optional.
- 🎚️ **Rauschsimulation** (Gaussian, σ in mm) mit Darstellung idealer und simulierten Distanzen.
- 🔁 **Auto-Send** an Node-RED via HTTP-POST oder MQTT Topics mit Intervallsteuerung.
- 🔌 **Robuste Transporte**: HTTP Timeout/Retry, MQTT Reconnect mit Statusanzeige.
- 🧩 **Iframe-Unterstützung** mit `?embed=1`, Readonly-Modus, `postMessage` API und Origin-Whitelist.
- 🧪 **Vitest** Unit-Tests für Geometrie- und Simulationskernel.

## Projektstruktur

```
/public
  favicon.svg
/src
  /components
    AnchorEditor.tsx
    CanvasView.tsx
    SettingsPanel.tsx
    StatusBar.tsx
    TagEditor.tsx
  /context
    AppState.tsx
  /core
    geometry.ts
    geometry.test.ts
    sim.ts
    sim.test.ts
  /transport
    httpClient.ts
    mqttClient.ts
  App.tsx
  App.css
  index.css
  main.tsx
  vite-env.d.ts
.env.example
```

## Getting Started

1. **Abhängigkeiten installieren**
   ```bash
   npm install
   ```

2. **Entwicklungsserver starten**
   ```bash
   npm run dev
   ```
   Der Vite-Server läuft standardmäßig auf [http://localhost:5173](http://localhost:5173).

3. **Produktion builden**
   ```bash
   npm run build
   npm run preview
   ```

4. **Tests ausführen**
   ```bash
   npm run test
   ```

## Konfiguration (`.env`)

Kopiere `.env.example` nach `.env` und passe die Werte an:

| Variable | Beschreibung | Standard |
| --- | --- | --- |
| `VITE_NODE_RED_HTTP_URL` | HTTP Endpoint von Node-RED | `http://localhost:1880/sim` |
| `VITE_MQTT_WS_URL` | MQTT/WebSocket Broker URL | `ws://localhost:9001` |
| `VITE_MQTT_TOPIC_PREFIX` | Topic-Präfix (z. B. `uwb/sim`) | `uwb/sim` |
| `VITE_IFRAME_READONLY` | `true` aktiviert Readonly-Modus für Embeds | `false` |
| `VITE_DEFAULT_SCALE_MM_PER_PX` | Startskalierung des Canvas | `2` |
| `VITE_IFRAME_ALLOWED_ORIGINS` | Kommagetrennte Origin-Liste für `postMessage` | `http://localhost:1880,http://localhost:3000` |

> **Hinweis:** Query-Parameter überschreiben einzelne Einstellungen. `?embed=1` blendet Sidebar & Toolbar aus, `?readonly=1` erzwingt Readonly.

## Node-RED Integration

### HTTP Flow

1. Node-RED: `http in` (POST) → `json` → gewünschte Verarbeitung → `http response`.
2. Stelle sicher, dass die URL dem Wert aus `VITE_NODE_RED_HTTP_URL` entspricht.
3. Simulation: HTTP aktivieren, URL & Retry-Settings festlegen, optional Auto-Send.

Beispiel-Payload:

```json
{
  "timestamp": "2025-10-23T12:00:00Z",
  "tag": { "x_mm": 0, "y_mm": 0 },
  "anchors": {
    "A": { "x_mm": 0, "y_mm": 0 },
    "B": { "x_mm": 800, "y_mm": 0 },
    "C": { "x_mm": 400, "y_mm": -1200 }
  },
  "distances_mm": { "A": 2236.1, "B": 1563.0, "C": 2730.3 },
  "distances_simulated_mm": { "A": 2236.4, "B": 1562.6, "C": 2730.9 }
}
```

### MQTT Flow

1. Node-RED: `mqtt in` Nodes für Topics `uwb/sim/#` oder `uwb/sim/frame` nutzen.
2. Broker muss WebSocket unterstützen (`ws://...`).
3. In der App Broker-URL, Topic-Präfix und Retain-Flag setzen.
4. Die App publiziert:
   - `${prefix}/frame` → gesamter JSON-Frame
   - `${prefix}/A/distance_mm`, `${prefix}/B/distance_mm`, `${prefix}/C/distance_mm`
   - `${prefix}/tag`

## Iframe Einbettung & `postMessage`

### Einbettung

```html
<iframe
  src="https://example.com/sim?embed=1"
  width="900"
  height="700"
  style="border: 0;"
></iframe>
```

Mit `VITE_IFRAME_ALLOWED_ORIGINS` können vertrauenswürdige Hosts definiert werden. Optional `?readonly=1` für schreibgeschützte Darstellung.

### Eingehende Nachrichten

```ts
window.parent.postMessage({
  type: 'setAnchors',
  anchors: {
    A: { x_mm: 0, y_mm: 0 },
    B: { x_mm: 800, y_mm: 0 },
    C: { x_mm: 400, y_mm: -1200 }
  }
}, 'https://example.com');
```

Unterstützte Typen:

- `setAnchors` – Aktualisiert Anker-Positionen.
- `setTag` – Setzt den Rover-Tag.
- `setAutoSend` – `{ enabled: boolean, interval_ms: number }`.
- `setNoise` – `{ sigma_mm: number }` (aktiviert Noise bei σ > 0).

### Ausgehende Nachrichten

Die Simulation sendet regelmäßig (`type: 'state'`) den aktuellen Frame, Auto-Send-, Noise-, HTTP- und MQTT-Status an `window.parent`. Nur konfigurierte Origins erhalten Nachrichten.

```ts
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://trusted.example') return;
  if (event.data?.type === 'state') {
    console.log(event.data.frame);
  }
});
```

## Tests & Linting

- `npm run test` – Vitest (inkl. Coverage-ready via `@vitest/coverage-v8`).
- `npm run lint` – ESLint + Prettier Regeln.
- `npm run format` – Prettier Code-Formatierung.

## Troubleshooting

- **Keine HTTP-Antwort:** URL prüfen, CORS im Node-RED Flow aktivieren, Timeout/Retry erhöhen.
- **MQTT verbindet nicht:** WebSocket-Port korrekt? Broker unterstützt keine WS? Eventuell TLS (`wss://`) verwenden.
- **Iframe blockiert Nachrichten:** `VITE_IFRAME_ALLOWED_ORIGINS` enthält Zielhost? Query-Param `embed=1` gesetzt?
- **Drag funktioniert nicht:** Im Readonly-Modus sind Interaktionen deaktiviert. `VITE_IFRAME_READONLY=false` oder `?readonly=0` nutzen.

## Lizenz

Veröffentlicht unter der [MIT-Lizenz](LICENSE).
