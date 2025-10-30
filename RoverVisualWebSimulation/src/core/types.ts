export type AnchorId = 'A' | 'B' | 'C';

export interface PointMM {
  x: number;
  y: number;
}

export interface AnchorState {
  id: AnchorId;
  position: PointMM;
  color: string;
}

export type AnchorRecord = Record<AnchorId, AnchorState>;

export interface DistanceRecord {
  A: number;
  B: number;
  C: number;
}

export interface NoiseSettings {
  sigma: number;
  enabled: boolean;
}

export interface AutoSendSettings {
  enabled: boolean;
  intervalMs: number;
}

export interface HttpSettings {
  url: string;
  timeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  enabled: boolean;
}

export interface MqttSettings {
  brokerUrl: string;
  topicPrefix: string;
  retain: boolean;
  enabled: boolean;
  clientId?: string;
  username?: string;
  password?: string;
}

export interface HttpConnectionStatus {
  state: 'idle' | 'sending' | 'success' | 'error';
  message?: string;
}

export interface MqttConnectionStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  message?: string;
}

export interface ConnectionStatus {
  http: HttpConnectionStatus;
  mqtt: MqttConnectionStatus;
}

export interface ConnectionStatusPatch {
  http?: Partial<HttpConnectionStatus>;
  mqtt?: Partial<MqttConnectionStatus>;
}

export interface SimulationState {
  anchors: AnchorRecord;
  tag: PointMM;
  distances: DistanceRecord;
  simulatedDistances: DistanceRecord | null;
  noise: NoiseSettings;
  snapToGrid: boolean;
  gridVisible: boolean;
  subGridVisible: boolean;
  scaleMmPerPx: number;
  embed: boolean;
  readOnly: boolean;
  autoSendEnabled: boolean;
  autoSendIntervalMs: number;
  sendCounter: number;
  lastSentAt?: string;
}

export interface AppContextState {
  simulation: SimulationState;
  http: HttpSettings;
  mqtt: MqttSettings;
  connectionStatus: ConnectionStatus;
}

export interface SimulationFrame {
  timestamp: string;
  tag: { x_mm: number; y_mm: number };
  anchors: Record<AnchorId, { x_mm: number; y_mm: number }>;
  distances_mm: Record<AnchorId, number>;
  distances_simulated_mm?: Record<AnchorId, number>;
}
