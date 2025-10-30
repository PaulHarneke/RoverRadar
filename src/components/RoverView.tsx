import type { TelemetryMessage } from '../context/AppState';
import { calculateAngleLabel, calculateDistanceLabel, polarToCartesian } from '../utils/telemetryMath';

const FIELD_DIAMETER_MM = 10_000;
const FIELD_RADIUS_MM = FIELD_DIAMETER_MM / 2;
const TAG_MARKER_RADIUS = 8;

interface RoverViewProps {
  telemetry: TelemetryMessage | null;
  scale: number;
}

export function RoverView({ telemetry, scale }: RoverViewProps) {
  const canvasWidthPx = FIELD_DIAMETER_MM / scale;
  const canvasHeightPx = FIELD_DIAMETER_MM / scale;
  const halfWidth = canvasWidthPx / 2;
  const halfHeight = canvasHeightPx / 2;
  const tagPoint = telemetry
    ? polarToCartesian(telemetry.tag.distance_mm, telemetry.tag.angle_deg, scale)
    : null;

  const labelDistance = telemetry ? calculateDistanceLabel(telemetry.tag.distance_mm) : '—';
  const labelAngle = telemetry ? calculateAngleLabel(telemetry.tag.angle_deg) : '—';

  return (
    <div className="rover-view">
      <div className="radar-canvas-wrapper">
        <svg
          className="rover-canvas"
          viewBox={`${-halfWidth} ${-halfHeight} ${canvasWidthPx} ${canvasHeightPx}`}
          role="img"
          aria-label="Rover position visualization"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          <circle
            cx={0}
            cy={0}
            r={FIELD_RADIUS_MM / scale}
            strokeWidth={2 / scale}
            className="field-boundary"
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
      </div>
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
