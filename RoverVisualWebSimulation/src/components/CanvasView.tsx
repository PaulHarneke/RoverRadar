import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import {
  GRID_MAJOR_STEP_MM,
  GRID_MINOR_STEP_MM,
  ROVER_HEIGHT_MM,
  ROVER_WIDTH_MM,
  formatMillimetres,
} from '../core/geometry';
import { AnchorId, DistanceRecord, PointMM } from '../core/types';

export interface ViewportState {
  zoom: number;
  pan: PointMM;
}

interface CanvasViewProps {
  anchors: Record<AnchorId, { x: number; y: number; color: string }>;
  tag: PointMM;
  distances: DistanceRecord;
  simulatedDistances: DistanceRecord | null;
  snapToGrid: boolean;
  gridVisible: boolean;
  subGridVisible: boolean;
  onTagChange: (point: PointMM) => void;
  viewport: ViewportState;
  onViewportChange: (next: ViewportState) => void;
  readOnly?: boolean;
}

const BASE_VIEW_SIZE_MM = 4000;
const TAG_RADIUS_MM = 20;

function midpoint(a: PointMM, b: PointMM): PointMM {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function length(point: PointMM): number {
  return Math.sqrt(point.x * point.x + point.y * point.y);
}

export function CanvasView(props: CanvasViewProps): JSX.Element {
  const {
    anchors,
    tag,
    distances,
    simulatedDistances,
    snapToGrid,
    gridVisible,
    subGridVisible,
    onTagChange,
    viewport,
    onViewportChange,
    readOnly,
  } = props;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDraggingTag, setIsDraggingTag] = useState(false);

  const viewBox = useMemo(() => {
    const width = BASE_VIEW_SIZE_MM / viewport.zoom;
    const height = BASE_VIEW_SIZE_MM / viewport.zoom;
    const minX = viewport.pan.x - width / 2;
    const minY = -viewport.pan.y - height / 2;
    return { minX, minY, width, height };
  }, [viewport]);

  const convertClientToPoint = useCallback(
    (clientX: number, clientY: number): PointMM | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      // Robust mapping from client (mouse) coordinates to SVG user coordinates
      // using the current screen CTM. This handles preserveAspectRatio and scaling.
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const svgP = pt.matrixTransform(ctm.inverse());
      // SVG y grows downward; our model uses y-up -> invert Y
      return { x: svgP.x, y: -svgP.y };
    },
    []
  );

  const startDrag = useCallback(
    (event: ReactPointerEvent<SVGCircleElement>) => {
      if (readOnly) {
        return;
      }
      if (!convertClientToPoint(event.clientX, event.clientY)) {
        return;
      }
      setIsDraggingTag(true);
      // Capture the pointer on the element that received the pointerdown
      try {
        (event.currentTarget as Element).setPointerCapture(event.pointerId);
      } catch {
        // ignore if not supported
      }
    },
    [convertClientToPoint, readOnly]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!isDraggingTag) {
        return;
      }
      const point = convertClientToPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      let nextPoint = point;
      if (snapToGrid) {
        nextPoint = {
          x: Math.round(point.x / GRID_MINOR_STEP_MM) * GRID_MINOR_STEP_MM,
          y: Math.round(point.y / GRID_MINOR_STEP_MM) * GRID_MINOR_STEP_MM,
        };
      }
      onTagChange(nextPoint);
    },
    [convertClientToPoint, isDraggingTag, onTagChange, snapToGrid]
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<SVGSVGElement | SVGCircleElement>) => {
      if (isDraggingTag) {
        try {
          // release capture from the element that has it
          (event.currentTarget as Element).releasePointerCapture(event.pointerId);
        } catch {
          // fallback: try svgRef
          try {
            svgRef.current?.releasePointerCapture(event.pointerId);
          } catch {
            /* ignore */
          }
        }
      }
      setIsDraggingTag(false);
    },
    [isDraggingTag]
  );

  const onWheel = useCallback(
    (event: ReactWheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      const nextZoom = Math.max(0.2, Math.min(4, viewport.zoom + delta));
      onViewportChange({
        zoom: nextZoom,
        pan: { x: 0, y: 0 },
      });
    },
    [onViewportChange, viewport.zoom]
  );

  const gridLines = useMemo(() => {
    if (!gridVisible && !subGridVisible) {
      return null;
    }
    const { minX, minY, width, height } = viewBox;
    const lines: JSX.Element[] = [];

    // extend range by one step to avoid visual gaps at the edges
    const step = GRID_MINOR_STEP_MM;
    const xStart = Math.floor((minX - step) / step) * step;
    const xEnd = Math.ceil((minX + width + step) / step) * step;
    const yTop = -(minY + height);
    const yBottom = -minY;

    for (let x = xStart; x <= xEnd; x += step) {
      const isMajor = x % GRID_MAJOR_STEP_MM === 0;
      if (!subGridVisible && !isMajor) continue;
      lines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={-yTop}
          x2={x}
          y2={-yBottom}
          stroke={isMajor ? '#cbd5f5' : '#e2e8f0'}
          strokeWidth={isMajor ? 1 : 0.5}
        />
      );
    }

    const yStart = Math.floor((yTop - step) / step) * step;
    const yEnd = Math.ceil((yBottom + step) / step) * step;
    for (let y = yStart; y <= yEnd; y += step) {
      const isMajor = y % GRID_MAJOR_STEP_MM === 0;
      if (!subGridVisible && !isMajor) continue;
      lines.push(
        <line
          key={`h-${y}`}
          x1={minX}
          y1={-y}
          x2={minX + width}
          y2={-y}
          stroke={isMajor ? '#cbd5f5' : '#e2e8f0'}
          strokeWidth={isMajor ? 1 : 0.5}
        />
      );
    }

    return <g className="grid-lines">{lines}</g>;
  }, [gridVisible, subGridVisible, viewBox]);

  const axisLines = useMemo(() => {
    const { minX, minY, width, height } = viewBox;
    const yTop = -(minY + height);
    const yBottom = -minY;
    return (
      <g className="axes">
        <line x1={0} y1={-yTop} x2={0} y2={-yBottom} stroke="#1e3a8a" strokeWidth={1.4} />
        <line x1={minX} y1={0} x2={minX + width} y2={0} stroke="#1e3a8a" strokeWidth={1.4} />
      </g>
    );
  }, [viewBox]);

  const roverOutline = useMemo(() => {
    return (
      <g className="rover" stroke="#1f2937">
        <rect
          x={-ROVER_WIDTH_MM / 2}
          y={-ROVER_HEIGHT_MM / 2}
          width={ROVER_WIDTH_MM}
          height={ROVER_HEIGHT_MM}
          fill="rgba(148, 163, 184, 0.15)"
          strokeWidth={2}
          rx={20}
          ry={20}
        />
        <line
          x1={0}
          y1={-ROVER_HEIGHT_MM / 2}
          x2={0}
          y2={ROVER_HEIGHT_MM / 2}
          stroke="#0f172a"
          strokeDasharray="12 8"
          strokeWidth={1.5}
        />
      </g>
    );
  }, []);

  const anchorElements = useMemo(() => {
    const anchorLabelFontSize = 80 / viewport.zoom;
    const distanceLabelFontSize = 50 / viewport.zoom;
    const anchorLabelStrokeWidth = 2 / viewport.zoom;
    const distanceLabelStrokeWidth = 3 / viewport.zoom;
    return Object.entries(anchors).map(([id, anchor]) => {
      const anchorPoint = { x: anchor.x, y: anchor.y };
      const dist = distances[id as AnchorId];
      const simulated = simulatedDistances?.[id as AnchorId];
      const label = simulated
        ? `${formatMillimetres(dist)} mm (sim ${formatMillimetres(simulated)})`
        : `${formatMillimetres(dist)} mm`;
      const mid = midpoint(tag, anchorPoint);
      const direction = { x: tag.x - anchorPoint.x, y: tag.y - anchorPoint.y };
      const magnitude = Math.max(length(direction), 1);
      const normalized = { x: direction.x / magnitude, y: direction.y / magnitude };
      const labelOffset = Math.min(120, Math.max(40, magnitude * 0.15));
      const labelPoint: PointMM = {
        x: mid.x + normalized.x * labelOffset,
        y: mid.y + normalized.y * labelOffset,
      };
      return (
        <g key={id} className="anchor-group">
          <line
            x1={anchor.x}
            y1={-anchor.y}
            x2={tag.x}
            y2={-tag.y}
            stroke={anchor.color}
            strokeWidth={2}
            strokeDasharray="6 4"
            opacity={0.9}
          />
          <circle cx={anchor.x} cy={-anchor.y} r={24} fill={anchor.color} opacity={0.9} />
          <text
            x={anchor.x}
            y={-anchor.y - 36}
            textAnchor="middle"
            fontSize={anchorLabelFontSize}
            fill="#0f172a"
            fontWeight={600}
            style={{
              paintOrder: 'stroke',
              stroke: 'rgba(255,255,255,0.8)',
              strokeWidth: anchorLabelStrokeWidth,
            }}
            pointerEvents="none"
          >
            {id}
          </text>
          <text
            x={labelPoint.x}
            y={-labelPoint.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={distanceLabelFontSize}
            fill="#0f172a"
            fontWeight={500}
            style={{
              paintOrder: 'stroke',
              stroke: 'rgba(255,255,255,0.85)',
              strokeWidth: distanceLabelStrokeWidth,
            }}
            pointerEvents="none"
          >
            {label}
          </text>
        </g>
      );
    });
  }, [anchors, distances, simulatedDistances, tag, viewport.zoom]);

  const tagLabelFontSize = 80 / viewport.zoom;
  const tagLabelStrokeWidth = 4 / viewport.zoom;

  return (
    <svg
      ref={svgRef}
      className="canvas-view"
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onWheel={onWheel}
      role="presentation"
    >
      <rect x={viewBox.minX} y={viewBox.minY} width={viewBox.width} height={viewBox.height} fill="#ffffff" opacity={0} />
      {gridLines}
      {axisLines}
      {roverOutline}
      <g className="tag">
        <circle
          cx={tag.x}
          cy={-tag.y}
          r={TAG_RADIUS_MM}
          fill="#f97316"
          stroke="#9a3412"
          strokeWidth={3}
          onPointerDown={startDrag}
          onPointerUp={endDrag}
        />
        <text
          x={tag.x}
          y={-tag.y - TAG_RADIUS_MM - 30}
          textAnchor="middle"
          fontSize={tagLabelFontSize}
          fill="#0f172a"
          fontWeight={600}
          style={{
            paintOrder: 'stroke',
            stroke: 'rgba(255,255,255,0.85)',
            strokeWidth: tagLabelStrokeWidth,
          }}
          pointerEvents="none"
        >
          Tag
        </text>
      </g>
      {anchorElements}
    </svg>
  );
}

export default CanvasView;
