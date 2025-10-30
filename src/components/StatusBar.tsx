import type { ConnectionStatus } from '../transport/mqttClient';

interface StatusBarProps {
  status: ConnectionStatus;
  timestamp: string | null;
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  failed: 'Connection failed',
  disconnected: 'Disconnected'
};

function StatusIcon({ status }: { status: ConnectionStatus }) {
  switch (status) {
    case 'connected':
      return <span className="status-icon status-connected" aria-hidden="true" />;
    case 'reconnecting':
    case 'connecting':
      return <span className="status-icon status-reconnecting" aria-hidden="true" />;
    case 'failed':
      return <span className="status-icon status-failed" aria-hidden="true" />;
    default:
      return <span className="status-icon status-disconnected" aria-hidden="true" />;
  }
}

export function StatusBar({ status, timestamp }: StatusBarProps) {
  return (
    <footer className="status-bar" aria-live="polite">
      <div className="status-group">
        <StatusIcon status={status} />
        <span>{STATUS_LABELS[status]}</span>
      </div>
      <div className="status-group">
        <span className="status-label">Last update</span>
        <time dateTime={timestamp ?? undefined}>
          {timestamp ? new Date(timestamp).toLocaleTimeString() : '—'}
        </time>
      </div>
    </footer>
  );
}
