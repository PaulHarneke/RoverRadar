import type { TelemetryMessage } from '../context/AppState';

const WARN_THRESHOLD = Number(import.meta.env.VITE_SPEED_WARN_MM_PER_S ?? '300');
const DANGER_THRESHOLD = Number(import.meta.env.VITE_SPEED_DANGER_MM_PER_S ?? '450');

interface TelemetryPanelProps {
  telemetry: TelemetryMessage | null;
}

function classifySpeed(value: number | undefined): 'ok' | 'warn' | 'danger' {
  if (!Number.isFinite(value)) {
    return 'ok';
  }
  if (Math.abs(value ?? 0) >= DANGER_THRESHOLD) {
    return 'danger';
  }
  if (Math.abs(value ?? 0) >= WARN_THRESHOLD) {
    return 'warn';
  }
  return 'ok';
}

export function TelemetryPanel({ telemetry }: TelemetryPanelProps) {
  const leftSpeed = telemetry?.drivetrain.front_left_axis_mm_per_s;
  const rightSpeed = telemetry?.drivetrain.front_right_axis_mm_per_s;
  const distance = telemetry?.tag.distance_mm;
  const angle = telemetry?.tag.angle_deg;
  const timestamp = telemetry?.timestamp ?? null;

  return (
    <aside className="panel telemetry-panel" aria-label="Live telemetry">
      <h2>Telemetry</h2>
      <dl>
        <div>
          <dt>Distance</dt>
          <dd>{Number.isFinite(distance) ? `${distance.toFixed(0)} mm` : '—'}</dd>
        </div>
        <div>
          <dt>Angle</dt>
          <dd>{Number.isFinite(angle) ? `${angle.toFixed(1)}°` : '—'}</dd>
        </div>
        <div className={`metric metric-${classifySpeed(leftSpeed)}`}>
          <dt>Front left speed</dt>
          <dd>
            {typeof leftSpeed === 'number' && Number.isFinite(leftSpeed)
              ? `${leftSpeed.toFixed(0)} mm/s`
              : '—'}
          </dd>
        </div>
        <div className={`metric metric-${classifySpeed(rightSpeed)}`}>
          <dt>Front right speed</dt>
          <dd>
            {typeof rightSpeed === 'number' && Number.isFinite(rightSpeed)
              ? `${rightSpeed.toFixed(0)} mm/s`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Timestamp</dt>
          <dd>{timestamp ? new Date(timestamp).toLocaleTimeString() : '—'}</dd>
        </div>
      </dl>
    </aside>
  );
}
