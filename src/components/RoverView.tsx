import type { TelemetryMessage } from '../context/AppState';
import { calculateAngleLabel, calculateDistanceLabel, polarToCartesian } from '../utils/telemetryMath';

const ROVER_WIDTH_MM = 1210;
const ROVER_HEIGHT_MM = 810;
const TAG_MARKER_RADIUS = 8;

interface RoverViewProps {
  telemetry: TelemetryMessage | null;
  scale: number;
}

export function RoverView({ telemetry, scale }: RoverViewProps) {
  const widthPx = ROVER_WIDTH_MM / scale;
  const heightPx = ROVER_HEIGHT_MM / scale;
  const halfWidth = widthPx / 2;
  const halfHeight = heightPx / 2;

  const tagPoint = telemetry
    ? polarToCartesian(telemetry.tag.distance_mm, telemetry.tag.angle_deg, scale)
    : null;

  const labelDistance = telemetry ? calculateDistanceLabel(telemetry.tag.distance_mm) : '—';
  const labelAngle = telemetry ? calculateAngleLabel(telemetry.tag.angle_deg) : '—';

  return (
    <div className="rover-view">
      <svg
        className="rover-canvas"
        viewBox={`${-halfWidth} ${-halfHeight} ${widthPx} ${heightPx}`}
        role="img"
        aria-label="Rover position visualization"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        <rect
          x={-halfWidth}
          y={-halfHeight}
          width={widthPx}
          height={heightPx}
          rx={12 / scale}
          className="rover-body"
        />
        <line x1={-halfWidth} y1={0} x2={halfWidth} y2={0} className="axis-line" />
        <line x1={0} y1={-halfHeight} x2={0} y2={halfHeight} className="axis-line" />
        {tagPoint ? (
          <>
            <line x1={0} y1={0} x2={tagPoint.x} y2={tagPoint.y} className="tag-line" markerEnd="url(#arrow)" />
            <circle cx={tagPoint.x} cy={tagPoint.y} r={TAG_MARKER_RADIUS / scale} className="tag-point" />
          </>
        ) : null}
      </svg>
      <div className="rover-metrics">
        <div>
          <span className="label">Distance</span>
          <span className="value">{labelDistance}</span>
        </div>
        <div>
          <span className="label">Angle</span>
          <span className="value">{labelAngle}</span>
        </div>
      </div>
    </div>
  );
}
