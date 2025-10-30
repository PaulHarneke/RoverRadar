import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import CanvasView, { ViewportState } from './components/CanvasView';
import AnchorEditor from './components/AnchorEditor';
import TagEditor from './components/TagEditor';
import SettingsPanel from './components/SettingsPanel';
import StatusBar from './components/StatusBar';
import { useAppState } from './context/AppState';
import { applyNoise, shouldAutoSend } from './core/sim';
import { DEFAULT_ANCHOR_POSITIONS, GRID_MINOR_STEP_MM, snapToGrid, toSimulationFrame } from './core/geometry';
import { AnchorId, NoiseSettings, PointMM } from './core/types';
import { HttpClient } from './transport/httpClient';
import { SimulationMqttClient } from './transport/mqttClient';

const DEFAULT_VIEWPORT: ViewportState = { zoom: 1, pan: { x: 0, y: 0 } };
const HTTP_ERROR_COOLDOWN_MS = 5000;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unbekannter Fehler';
}

function parseAllowedOrigins(): string[] {
  const value = import.meta.env.VITE_IFRAME_ALLOWED_ORIGINS ?? '';
  return value
    .split(',')
    .map((origin: string) => origin.trim())
    .filter((origin: string) => origin.length > 0);
}

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (!allowedOrigins.length) {
    return false;
  }
  if (allowedOrigins.includes('*')) {
    return true;
  }
  return allowedOrigins.includes(origin);
}

export function App(): JSX.Element {
  const { state, dispatch } = useAppState();
  const { simulation, http, mqtt, connectionStatus } = state;
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const allowedOrigins = useMemo(parseAllowedOrigins, []);
  const httpClientRef = useRef<HttpClient | null>(null);
  const mqttClientRef = useRef<SimulationMqttClient | null>(null);
  const httpErrorCooldownRef = useRef<number | null>(null);

  useEffect(() => {
    httpClientRef.current = new HttpClient({
      timeoutMs: http.timeoutMs,
      retryCount: http.retryCount,
      retryDelayMs: http.retryDelayMs,
    });
  }, [http.retryCount, http.retryDelayMs, http.timeoutMs]);

  if (!mqttClientRef.current) {
    mqttClientRef.current = new SimulationMqttClient((status, error) => {
      dispatch({
        type: 'SET_CONNECTION_STATUS',
        value: { mqtt: { state: status, message: error?.message } },
      });
    });
  }

  const mqttClient = mqttClientRef.current;

  useEffect(() => {
    if (!mqttClient) {
      return;
    }
    if (mqtt.enabled && mqtt.brokerUrl) {
      mqttClient.connect({
        brokerUrl: mqtt.brokerUrl,
        topicPrefix: mqtt.topicPrefix,
        retain: mqtt.retain,
        clientId: mqtt.clientId,
        username: mqtt.username,
        password: mqtt.password,
      });
    } else {
      mqttClient.disconnect();
    }
    return () => {
      mqttClient.disconnect();
    };
  }, [mqttClient, mqtt.brokerUrl, mqtt.clientId, mqtt.enabled, mqtt.password, mqtt.retain, mqtt.topicPrefix, mqtt.username]);

  useEffect(() => {
    const simulated = applyNoise(simulation.distances, simulation.noise);
    dispatch({ type: 'SET_DISTANCES', distances: simulation.distances, simulated });
  }, [dispatch, simulation.distances, simulation.noise.enabled, simulation.noise.sigma]);

  const sendFrame = useCallback(
    async (mode: 'auto' | 'manual') => {
      const frame = toSimulationFrame(simulation.tag, simulation.anchors, simulation.distances, simulation.simulatedDistances);
      const tasks: Promise<void>[] = [];

      if (http.enabled && http.url) {
        const now = Date.now();
        const isCoolingDown =
          mode === 'auto' && httpErrorCooldownRef.current !== null && now < httpErrorCooldownRef.current;

        if (!isCoolingDown) {
          dispatch({
            type: 'SET_CONNECTION_STATUS',
            value: { http: { state: 'sending', message: undefined } },
          });
          const client = httpClientRef.current;
          if (client) {
            tasks.push(
              client
                .post(http.url, frame)
                .then(() => {
                  httpErrorCooldownRef.current = null;
                  dispatch({
                    type: 'SET_CONNECTION_STATUS',
                    value: { http: { state: 'success', message: undefined } },
                  });
                })
                .catch((error) => {
                  console.error('HTTP send failed', error);
                  const message = getErrorMessage(error);
                  if (mode === 'auto') {
                    httpErrorCooldownRef.current = Date.now() + HTTP_ERROR_COOLDOWN_MS;
                    dispatch({
                      type: 'SET_CONNECTION_STATUS',
                      value: {
                        http: {
                          state: 'error',
                          message: `${message} – erneuter Versuch in ${HTTP_ERROR_COOLDOWN_MS / 1000} s`,
                        },
                      },
                    });
                  } else {
                    dispatch({
                      type: 'SET_CONNECTION_STATUS',
                      value: { http: { state: 'error', message } },
                    });
                  }
                })
            );
          }
        }
      }

      if (mqtt.enabled && mqtt.brokerUrl && mqttClient) {
        tasks.push(
          mqttClient
            .publishFrame(frame)
            .then(() =>
              dispatch({
                type: 'SET_CONNECTION_STATUS',
                value: { mqtt: { state: 'connected', message: undefined } },
              })
            )
            .catch((error) => {
              console.error('MQTT publish failed', error);
              const message = getErrorMessage(error);
              dispatch({
                type: 'SET_CONNECTION_STATUS',
                value: { mqtt: { state: 'error', message } },
              });
            })
        );
      }

      if (!tasks.length) {
        return;
      }

      const results = await Promise.allSettled(tasks);
      if (results.some((result) => result.status === 'fulfilled')) {
        dispatch({ type: 'INCREMENT_SEND_COUNTER', timestamp: new Date().toISOString() });
      }
    },
    [dispatch, http.enabled, http.url, mqtt.brokerUrl, mqtt.enabled, mqttClient, simulation.anchors, simulation.distances, simulation.simulatedDistances, simulation.tag]
  );

  const sendFrameManual = useCallback(() => {
    void sendFrame('manual');
  }, [sendFrame]);

  const sendFrameAuto = useCallback(() => {
    void sendFrame('auto');
  }, [sendFrame]);

  useEffect(() => {
    httpErrorCooldownRef.current = null;
  }, [http.enabled, http.url]);

  useEffect(() => {
    if (!shouldAutoSend(simulation.autoSendEnabled, simulation.autoSendIntervalMs)) {
      return;
    }
    const interval = setInterval(() => {
      sendFrameAuto();
    }, simulation.autoSendIntervalMs);
    return () => clearInterval(interval);
  }, [sendFrameAuto, simulation.autoSendEnabled, simulation.autoSendIntervalMs]);

  const handleAnchorChange = useCallback(
    (id: AnchorId, position: PointMM) => {
      dispatch({ type: 'SET_ANCHOR', anchorId: id, position });
    },
    [dispatch]
  );

  const handleTagChange = useCallback(
    (point: PointMM) => {
      const nextPoint = simulation.snapToGrid
        ? snapToGrid(point, GRID_MINOR_STEP_MM)
        : point;
      dispatch({ type: 'SET_TAG', position: nextPoint });
    },
    [dispatch, simulation.snapToGrid]
  );

  const handleCopyFrame = useCallback(async () => {
    try {
      const frame = toSimulationFrame(
        simulation.tag,
        simulation.anchors,
        simulation.distances,
        simulation.simulatedDistances
      );
      await navigator.clipboard.writeText(JSON.stringify(frame, null, 2));
      setCopyState('success');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch (error) {
      console.error('Copy failed', error);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 1500);
    }
  }, [simulation.anchors, simulation.distances, simulation.simulatedDistances, simulation.tag]);

  const handleResetAnchors = useCallback(() => {
    dispatch({ type: 'RESET_ANCHORS', anchors: DEFAULT_ANCHOR_POSITIONS });
  }, [dispatch]);

  const handleResetTag = useCallback(() => {
    dispatch({ type: 'RESET_TAG', position: { x: 0, y: 0 } });
  }, [dispatch]);

  const handleNoiseChange = useCallback(
    (settings: NoiseSettings) => {
      dispatch({ type: 'SET_NOISE_SIGMA', sigma: settings.sigma });
      dispatch({ type: 'SET_NOISE_ENABLED', enabled: settings.enabled });
    },
    [dispatch]
  );

  const handleViewportChange = useCallback((next: ViewportState) => {
    setViewport({
      zoom: next.zoom,
      pan: { x: 0, y: 0 },
    });
  }, []);

  const adjustZoom = useCallback((delta: number) => {
    setViewport((prev) => ({
      zoom: Math.max(0.2, Math.min(4, prev.zoom + delta)),
      pan: { x: 0, y: 0 },
    }));
  }, []);

  const handleResetView = useCallback(() => {
    setViewport(DEFAULT_VIEWPORT);
  }, []);

  useEffect(() => {
    if (simulation.embed) {
      setViewport(DEFAULT_VIEWPORT);
    }
  }, [simulation.embed]);

  useEffect(() => {
    function handleMessage(event: MessageEvent<unknown>) {
      if (!isOriginAllowed(event.origin, allowedOrigins) && event.origin !== window.location.origin) {
        return;
      }
      const data = event.data;
      if (typeof data !== 'object' || data === null) {
        return;
      }
      const payload = data as Record<string, unknown>;
      const messageType = typeof payload.type === 'string' ? payload.type : undefined;
      switch (messageType) {
        case 'setAnchors': {
          const anchors = payload.anchors as Partial<Record<AnchorId, PointMM>> | undefined;
          if (anchors) {
            (Object.keys(anchors) as AnchorId[]).forEach((anchorId) => {
              const position = anchors[anchorId];
              if (
                position &&
                typeof position.x === 'number' &&
                Number.isFinite(position.x) &&
                typeof position.y === 'number' &&
                Number.isFinite(position.y)
              ) {
                dispatch({ type: 'SET_ANCHOR', anchorId, position });
              }
            });
          }
          break;
        }
        case 'setTag': {
          const tagPosition = payload.tag as PointMM | undefined;
          if (
            tagPosition &&
            typeof tagPosition.x === 'number' &&
            Number.isFinite(tagPosition.x) &&
            typeof tagPosition.y === 'number' &&
            Number.isFinite(tagPosition.y)
          ) {
            dispatch({ type: 'SET_TAG', position: tagPosition });
          }
          break;
        }
        case 'setAutoSend': {
          const value = payload.autoSend as { enabled?: boolean; interval_ms?: number } | undefined;
          if (typeof value?.enabled === 'boolean') {
            dispatch({ type: 'SET_AUTO_SEND_ENABLED', value: value.enabled });
          }
          if (value?.interval_ms !== undefined) {
            const interval = Number(value.interval_ms);
            if (Number.isFinite(interval) && interval > 0) {
              dispatch({ type: 'SET_AUTO_SEND_INTERVAL', value: interval });
            }
          }
          break;
        }
        case 'setNoise': {
          const noise = payload.noise as { sigma_mm?: number } | undefined;
          if (noise?.sigma_mm !== undefined && Number.isFinite(Number(noise.sigma_mm))) {
            const sigma = Math.max(0, Number(noise.sigma_mm));
            dispatch({ type: 'SET_NOISE_SIGMA', sigma });
            dispatch({ type: 'SET_NOISE_ENABLED', enabled: sigma > 0 });
          }
          break;
        }
        default:
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [allowedOrigins, dispatch]);

  useEffect(() => {
    if (!simulation.embed) {
      return;
    }
    const frame = toSimulationFrame(
      simulation.tag,
      simulation.anchors,
      simulation.distances,
      simulation.simulatedDistances
    );
    const payload = {
      type: 'state',
      frame,
      autoSend: {
        enabled: simulation.autoSendEnabled,
        intervalMs: simulation.autoSendIntervalMs,
      },
      noise: simulation.noise,
      http,
      mqtt,
    };
    if (allowedOrigins.includes('*')) {
      window.parent.postMessage(payload, '*');
    } else {
      allowedOrigins.forEach((origin) => {
        window.parent.postMessage(payload, origin);
      });
    }
  }, [allowedOrigins, http, mqtt, simulation.autoSendEnabled, simulation.autoSendIntervalMs, simulation.anchors, simulation.distances, simulation.embed, simulation.noise, simulation.simulatedDistances, simulation.tag]);

  const canvasAnchors = useMemo(() => {
    const result: Record<AnchorId, { x: number; y: number; color: string }> = {
      A: { x: simulation.anchors.A.position.x, y: simulation.anchors.A.position.y, color: simulation.anchors.A.color },
      B: { x: simulation.anchors.B.position.x, y: simulation.anchors.B.position.y, color: simulation.anchors.B.color },
      C: { x: simulation.anchors.C.position.x, y: simulation.anchors.C.position.y, color: simulation.anchors.C.color },
    };
    return result;
  }, [simulation.anchors]);

  const content = (
    <div className="main">
      {!simulation.embed && (
        <header className="toolbar">
          <div className="left-controls">
            <button type="button" onClick={() => dispatch({ type: 'SET_GRID_VISIBLE', value: !simulation.gridVisible })}>
              Grid {simulation.gridVisible ? 'aus' : 'an'}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'SET_SUBGRID_VISIBLE', value: !simulation.subGridVisible })}>
              Subgrid {simulation.subGridVisible ? 'aus' : 'an'}
            </button>
            <button type="button" onClick={handleResetAnchors}>Anker Reset</button>
            <button type="button" onClick={handleResetTag}>Tag Reset</button>
          </div>
          <div className="right-controls">
            <button type="button" onClick={() => adjustZoom(0.2)}>
              Zoom +
            </button>
            <button type="button" onClick={() => adjustZoom(-0.2)}>
              Zoom -
            </button>
            <button type="button" onClick={handleResetView}>View Reset</button>
            <button type="button" onClick={handleCopyFrame}>
              {copyState === 'success' ? 'Kopiert!' : copyState === 'error' ? 'Fehler' : 'Frame kopieren'}
            </button>
          </div>
        </header>
      )}
      <section className={`canvas-container ${simulation.embed ? 'embed' : ''}`}>
        <CanvasView
          anchors={canvasAnchors}
          tag={simulation.tag}
          distances={simulation.distances}
          simulatedDistances={simulation.simulatedDistances}
          snapToGrid={simulation.snapToGrid}
          gridVisible={simulation.gridVisible}
          subGridVisible={simulation.subGridVisible}
          onTagChange={handleTagChange}
          viewport={viewport}
          onViewportChange={handleViewportChange}
          readOnly={simulation.readOnly}
        />
      </section>
      <StatusBar
        tag={simulation.tag}
        distances={simulation.distances}
        simulatedDistances={simulation.simulatedDistances}
        connectionStatus={connectionStatus}
        autoSendEnabled={simulation.autoSendEnabled}
        sendCounter={simulation.sendCounter}
        lastSentAt={simulation.lastSentAt}
      />
    </div>
  );

  if (simulation.embed) {
    return <div className="app embed">{content}</div>;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        {simulation.readOnly ? (
          <section className="panel-section notice">
            <header>
              <h2>Geschützter Modus</h2>
              <p>Anker-Konfiguration und Exportoptionen sind ausgeblendet.</p>
            </header>
            <p>
              Die aktuelle Ansicht zeigt ausschließlich die Rover-Position. Änderungen an Ankern oder das Senden von
              Simulationsdaten sind in diesem Modus deaktiviert.
            </p>
          </section>
        ) : (
          <AnchorEditor anchors={simulation.anchors} onAnchorChange={handleAnchorChange} readOnly={simulation.readOnly} />
        )}
        <TagEditor tag={simulation.tag} onChange={handleTagChange} readOnly={simulation.readOnly} />
        {!simulation.readOnly ? (
          <SettingsPanel
            noise={simulation.noise}
            snapToGrid={simulation.snapToGrid}
            autoSendEnabled={simulation.autoSendEnabled}
            autoSendIntervalMs={simulation.autoSendIntervalMs}
            http={http}
            mqtt={mqtt}
            onNoiseChange={handleNoiseChange}
            onSnapToGridChange={(value) => dispatch({ type: 'SET_SNAP_TO_GRID', value })}
            onAutoSendEnabledChange={(value) => dispatch({ type: 'SET_AUTO_SEND_ENABLED', value })}
            onAutoSendIntervalChange={(value) => dispatch({ type: 'SET_AUTO_SEND_INTERVAL', value })}
            onHttpSettingsChange={(settings) => dispatch({ type: 'SET_HTTP_SETTINGS', value: settings })}
            onMqttSettingsChange={(settings) => dispatch({ type: 'SET_MQTT_SETTINGS', value: settings })}
            onSendSingle={sendFrameManual}
            readOnly={simulation.readOnly}
          />
        ) : null}
      </aside>
      {content}
    </div>
  );
}

export default App;
