import {
  createContext,
  Dispatch,
  PropsWithChildren,
  useContext,
  useMemo,
  useReducer,
} from 'react';
import {
  AnchorId,
  AnchorRecord,
  AppContextState,
  ConnectionStatus,
  ConnectionStatusPatch,
  DistanceRecord,
  HttpSettings,
  MqttSettings,
  PointMM,
  SimulationState,
} from '../core/types';
import { DEFAULT_ANCHOR_POSITIONS, computeDistances } from '../core/geometry';

export type AppStateAction =
  | { type: 'SET_ANCHOR'; anchorId: AnchorId; position: PointMM }
  | { type: 'SET_TAG'; position: PointMM }
  | { type: 'SET_DISTANCES'; distances: DistanceRecord; simulated: DistanceRecord | null }
  | { type: 'SET_NOISE_ENABLED'; enabled: boolean }
  | { type: 'SET_NOISE_SIGMA'; sigma: number }
  | { type: 'SET_SNAP_TO_GRID'; value: boolean }
  | { type: 'SET_GRID_VISIBLE'; value: boolean }
  | { type: 'SET_SUBGRID_VISIBLE'; value: boolean }
  | { type: 'SET_SCALE'; value: number }
  | { type: 'SET_AUTO_SEND_ENABLED'; value: boolean }
  | { type: 'SET_AUTO_SEND_INTERVAL'; value: number }
  | { type: 'INCREMENT_SEND_COUNTER'; timestamp: string }
  | { type: 'SET_HTTP_SETTINGS'; value: Partial<HttpSettings> }
  | { type: 'SET_MQTT_SETTINGS'; value: Partial<MqttSettings> }
  | { type: 'SET_CONNECTION_STATUS'; value: ConnectionStatusPatch }
  | { type: 'SET_READ_ONLY'; value: boolean }
  | { type: 'RESET_ANCHORS'; anchors: AnchorRecord }
  | { type: 'RESET_TAG'; position: PointMM };

function cloneAnchors(anchors: AnchorRecord): AnchorRecord {
  return {
    A: { ...anchors.A, position: { ...anchors.A.position } },
    B: { ...anchors.B, position: { ...anchors.B.position } },
    C: { ...anchors.C, position: { ...anchors.C.position } },
  };
}

function resolveInitialFlags(): { embed: boolean; readOnly: boolean } {
  if (typeof window === 'undefined') {
    return { embed: false, readOnly: false };
  }
  const params = new URLSearchParams(window.location.search);
  const embed = params.get('embed') === '1';
  const readOnlyQuery = params.get('readonly');
  const envReadOnly = (import.meta.env.VITE_IFRAME_READONLY ?? '').toLowerCase() === 'true';
  const readOnly = readOnlyQuery === '1' || envReadOnly;
  return { embed, readOnly };
}

function buildInitialState(): AppContextState {
  const anchors = cloneAnchors(DEFAULT_ANCHOR_POSITIONS);
  const tag: PointMM = { x: 0, y: 0 };
  const distances = computeDistances(tag, anchors);

  const defaultScale = Number.parseFloat(import.meta.env.VITE_DEFAULT_SCALE_MM_PER_PX ?? '2');
  const httpUrl = import.meta.env.VITE_NODE_RED_HTTP_URL ?? '';
  const mqttUrl = import.meta.env.VITE_MQTT_WS_URL ?? '';
  const topicPrefix = import.meta.env.VITE_MQTT_TOPIC_PREFIX ?? 'uwb/sim';
  const { embed, readOnly } = resolveInitialFlags();

  const simulation: SimulationState = {
    anchors,
    tag,
    distances,
    simulatedDistances: null,
    noise: { sigma: 0, enabled: false },
    snapToGrid: false,
    gridVisible: true,
    subGridVisible: false,
    scaleMmPerPx: Number.isFinite(defaultScale) && defaultScale > 0 ? defaultScale : 2,
    embed,
    readOnly,
    autoSendEnabled: false,
    autoSendIntervalMs: 500,
    sendCounter: 0,
  };

  const http: HttpSettings = {
    url: httpUrl,
    timeoutMs: 2000,
    retryCount: 2,
    retryDelayMs: 500,
    enabled: Boolean(httpUrl),
  };

  const mqtt: MqttSettings = {
    brokerUrl: mqttUrl,
    topicPrefix,
    retain: false,
    enabled: Boolean(mqttUrl),
  };

  const connectionStatus: ConnectionStatus = {
    http: { state: 'idle' },
    mqtt: { state: 'disconnected' },
  };

  return { simulation, http, mqtt, connectionStatus };
}

function reducer(state: AppContextState, action: AppStateAction): AppContextState {
  switch (action.type) {
    case 'SET_ANCHOR': {
      const anchors = cloneAnchors(state.simulation.anchors);
      anchors[action.anchorId] = {
        ...anchors[action.anchorId],
        position: { ...action.position },
      };
      const distances = computeDistances(state.simulation.tag, anchors);
      return {
        ...state,
        simulation: {
          ...state.simulation,
          anchors,
          distances,
        },
      };
    }
    case 'SET_TAG': {
      const tag = { ...action.position };
      const distances = computeDistances(tag, state.simulation.anchors);
      return {
        ...state,
        simulation: {
          ...state.simulation,
          tag,
          distances,
        },
      };
    }
    case 'SET_DISTANCES': {
      return {
        ...state,
        simulation: {
          ...state.simulation,
          distances: action.distances,
          simulatedDistances: action.simulated,
        },
      };
    }
    case 'SET_NOISE_ENABLED': {
      return {
        ...state,
        simulation: {
          ...state.simulation,
          noise: {
            ...state.simulation.noise,
            enabled: action.enabled,
          },
        },
      };
    }
    case 'SET_NOISE_SIGMA': {
      return {
        ...state,
        simulation: {
          ...state.simulation,
          noise: {
            ...state.simulation.noise,
            sigma: Math.max(0, action.sigma),
          },
        },
      };
    }
    case 'SET_SNAP_TO_GRID': {
      return {
        ...state,
        simulation: {
          ...state.simulation,
          snapToGrid: action.value,
        },
      };
    }
    case 'SET_GRID_VISIBLE': {
      return {
        ...state,
        simulation: {
          ...state.simulation,
          gridVisible: action.value,
        },
      };
    }
    case 'SET_SUBGRID_VISIBLE': {
      return {
        ...state,
        simulation: {
          ...state.simulation,
          subGridVisible: action.value,
        },
      };
    }
    case 'SET_SCALE': {
      return {
        ...state,
        simulation: {
          ...state.simulation,
          scaleMmPerPx: action.value,
        },
      };
    }
    case 'SET_AUTO_SEND_ENABLED': {
      return {
        ...state,
        simulation: {
          ...state.simulation,
          autoSendEnabled: action.value,
        },
      };
    }
    case 'SET_AUTO_SEND_INTERVAL': {
      return {
        ...state,
        simulation: {
          ...state.simulation,
          autoSendIntervalMs: Math.max(50, action.value),
        },
      };
    }
    case 'INCREMENT_SEND_COUNTER': {
      return {
        ...state,
        simulation: {
          ...state.simulation,
          sendCounter: state.simulation.sendCounter + 1,
          lastSentAt: action.timestamp,
        },
      };
    }
    case 'SET_HTTP_SETTINGS': {
      return {
        ...state,
        http: {
          ...state.http,
          ...action.value,
        },
      };
    }
    case 'SET_MQTT_SETTINGS': {
      return {
        ...state,
        mqtt: {
          ...state.mqtt,
          ...action.value,
        },
      };
    }
    case 'SET_CONNECTION_STATUS': {
      const nextHttp = action.value.http
        ? { ...state.connectionStatus.http, ...action.value.http }
        : state.connectionStatus.http;
      const nextMqtt = action.value.mqtt
        ? { ...state.connectionStatus.mqtt, ...action.value.mqtt }
        : state.connectionStatus.mqtt;
      return {
        ...state,
        connectionStatus: {
          http: nextHttp,
          mqtt: nextMqtt,
        },
      };
    }
    case 'SET_READ_ONLY': {
      return {
        ...state,
        simulation: {
          ...state.simulation,
          readOnly: action.value,
        },
      };
    }
    case 'RESET_ANCHORS': {
      const anchors = cloneAnchors(action.anchors);
      const distances = computeDistances(state.simulation.tag, anchors);
      return {
        ...state,
        simulation: {
          ...state.simulation,
          anchors,
          distances,
        },
      };
    }
    case 'RESET_TAG': {
      const tag = { ...action.position };
      const distances = computeDistances(tag, state.simulation.anchors);
      return {
        ...state,
        simulation: {
          ...state.simulation,
          tag,
          distances,
        },
      };
    }
    default:
      return state;
  }
}

interface AppStateContextValue {
  state: AppContextState;
  dispatch: Dispatch<AppStateAction>;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: PropsWithChildren): JSX.Element {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);

  const value = useMemo<AppStateContextValue>(() => ({ state, dispatch }), [state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
}
