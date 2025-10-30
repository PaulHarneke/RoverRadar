import { ConnectionStatus, DistanceRecord, PointMM } from '../core/types';
import { formatMillimetres } from '../core/geometry';

interface StatusBarProps {
  tag: PointMM;
  distances: DistanceRecord;
  simulatedDistances: DistanceRecord | null;
  connectionStatus: ConnectionStatus;
  autoSendEnabled: boolean;
  sendCounter: number;
  lastSentAt?: string;
}

function renderDistance(label: string, value: number, simulated?: number): string {
  const formatted = formatMillimetres(value);
  if (simulated !== undefined) {
    return `${label}: ${formatted} mm (sim ${formatMillimetres(simulated)} mm)`;
  }
  return `${label}: ${formatted} mm`;
}

export function StatusBar({
  tag,
  distances,
  simulatedDistances,
  connectionStatus,
  autoSendEnabled,
  sendCounter,
  lastSentAt,
}: StatusBarProps): JSX.Element {
  const httpStatus = connectionStatus.http;
  const mqttStatus = connectionStatus.mqtt;

  return (
    <footer className="status-bar">
      <div>
        <strong>Koordinaten:</strong> x = {formatMillimetres(tag.x, 1)} mm, y = {formatMillimetres(tag.y, 1)} mm
      </div>
      <div className="distance-group">
        {renderDistance('rₐ', distances.A, simulatedDistances?.A)} ·{' '}
        {renderDistance('rᵦ', distances.B, simulatedDistances?.B)} ·{' '}
        {renderDistance('r𝚌', distances.C, simulatedDistances?.C)}
      </div>
      <div className="status-group">
        <span>
          HTTP: {httpStatus.state}
          {httpStatus.message ? ` (${httpStatus.message})` : ''}
        </span>
        <span>
          MQTT: {mqttStatus.state}
          {mqttStatus.message ? ` (${mqttStatus.message})` : ''}
        </span>
        <span>Auto-Send: {autoSendEnabled ? 'aktiv' : 'aus'}</span>
        <span>Sendungen: {sendCounter}</span>
        {lastSentAt ? <span>Letzter Frame: {new Date(lastSentAt).toLocaleTimeString()}</span> : null}
        <span>Version: {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</span>
      </div>
    </footer>
  );
}

export default StatusBar;
