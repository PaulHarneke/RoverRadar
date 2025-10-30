import type { TelemetryMessage } from '../context/AppState';
import { calculateAngleLabel, calculateDistanceLabel, polarToCartesian } from '../utils/telemetryMath';

const FIELD_DIAMETER_MM = 10_000;
const FIELD_RADIUS_MM = FIELD_DIAMETER_MM / 2;
const TAG_MARKER_RADIUS = Number(import.meta.env.VITE_TAG_MARKER_RADIUS ?? '100');
const RANGE_RING_STEPS = [0.25, 0.5, 0.75];
const ANGLE_MARKERS = [0, 90, 180, 270];

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
  const normalizedAngle = ((telemetry?.tag.angle_deg ?? 0) % 360 + 360) % 360;
  const bearingPosition = `${(normalizedAngle / 360) * 100}%`;
  const statusLabel = telemetry ? 'LOCKED' : 'SCANNING';

  return (
    <div className="rover-view">
      <div className="bearing-strip" aria-hidden="true">
        <div className="bearing-strip__label">BEARING</div>
        <div className="bearing-strip__scale">
          <div className="bearing-strip__pointer" style={{ left: bearingPosition }} />
          <div className="bearing-strip__ticks" />
        </div>
        <div className={`status-pill status-pill--${telemetry ? 'connected' : 'searching'}`}>{statusLabel}</div>
      </div>
      <div className="radar-canvas-wrapper">
        <svg
          className="rover-canvas"
          viewBox={`${-halfWidth} ${-halfHeight} ${canvasWidthPx} ${canvasHeightPx}`}
          role="img"
          aria-label="Rover position visualization"
        >
          <circle
            cx={0}
            cy={0}
            r={FIELD_RADIUS_MM / scale}
            strokeWidth={2 / scale}
            className="field-boundary"
          />
          <g className="range-rings">
            {RANGE_RING_STEPS.map((step) => {
              const ringRadius = (FIELD_RADIUS_MM * step) / scale;
              const distanceLabel = calculateDistanceLabel(FIELD_RADIUS_MM * step);
              return (
                <g key={step}>
                  <circle cx={0} cy={0} r={ringRadius} className="range-ring" />
                  <text
                    x={0}
                    y={-ringRadius}
                    className="range-label"
                    textAnchor="middle"
                    dominantBaseline="text-after-edge"
                  >
                    {distanceLabel}
                  </text>
                </g>
              );
            })}
          </g>
          <g className="angle-guides">
            {ANGLE_MARKERS.map((angle) => {
              const lineEnd = polarToCartesian(FIELD_RADIUS_MM, angle, scale);
              const labelPoint = polarToCartesian(FIELD_RADIUS_MM + 350, angle, scale);
              const angleLabel = angle === 0 ? '0° / 360°' : `${angle}°`;
              return (
                <g key={angle}>
                  <line x1={0} y1={0} x2={lineEnd.x} y2={lineEnd.y} className="axis-line" />
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y}
                    className="angle-label"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {angleLabel}
                  </text>
                </g>
              );
            })}
          </g>
          {tagPoint ? (
            <>
              <line x1={0} y1={0} x2={tagPoint.x} y2={tagPoint.y} className="tag-line" />
              <circle cx={tagPoint.x} cy={tagPoint.y} r={TAG_MARKER_RADIUS / scale} className="tag-point" />
              <text
                x={tagPoint.x}
                y={tagPoint.y - 220 / scale}
                className="tag-readout"
                textAnchor="middle"
                dominantBaseline="text-after-edge"
              >
                {`${labelDistance} • ${labelAngle}`}
              </text>
            </>
          ) : null}
        </svg>
      </div>
      <div className="hud-readouts" role="presentation">
        <div className="readout-group">
          <span className="readout-label">RANGE</span>
          <span className="readout-value">{labelDistance}</span>
        </div>
        <div className="readout-group">
          <span className="readout-label">BEARING</span>
          <span className="readout-value">{labelAngle}</span>
        </div>
        <div className="readout-group">
          <span className="readout-label">CONTACT</span>
          <span className="readout-value">{telemetry ? 'TRACK-01' : '—'}</span>
        </div>
      </div>
    </div>
  );
}
