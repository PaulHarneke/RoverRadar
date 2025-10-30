import { ChangeEvent } from 'react';
import { AnchorId, AnchorRecord, PointMM } from '../core/types';

interface AnchorEditorProps {
  anchors: AnchorRecord;
  onAnchorChange: (id: AnchorId, position: PointMM) => void;
  readOnly?: boolean;
}

function AnchorInput({
  id,
  label,
  value,
  onChange,
  readOnly,
}: {
  id: string;
  label: string;
  value: number;
  readOnly?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}): JSX.Element {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={10}
        value={Number.isFinite(value) ? value : 0}
        onChange={onChange}
        readOnly={readOnly}
      />
    </label>
  );
}

export function AnchorEditor({ anchors, onAnchorChange, readOnly }: AnchorEditorProps): JSX.Element {
  const handleChange = (anchorId: AnchorId, field: 'x' | 'y') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = Number.parseFloat(event.target.value);
      if (!Number.isFinite(next)) {
        return;
      }
      const existing = anchors[anchorId];
      const position = {
        ...existing.position,
        [field]: next,
      } as PointMM;
      onAnchorChange(anchorId, position);
    };

  return (
    <section className="panel-section">
      <header>
        <h2>Anker</h2>
        <p>Positionen der stationären Anker in mm</p>
      </header>
      <div className="anchor-editor">
        {(['A', 'B', 'C'] as AnchorId[]).map((anchorId) => {
          const anchor = anchors[anchorId];
          return (
            <fieldset key={anchorId} style={{ borderColor: anchor.color }}>
              <legend style={{ color: anchor.color }}>Anker {anchorId}</legend>
              <AnchorInput
                id={`anchor-${anchorId}-x`}
                label="x (mm)"
                value={anchor.position.x}
                onChange={handleChange(anchorId, 'x')}
                readOnly={readOnly}
              />
              <AnchorInput
                id={`anchor-${anchorId}-y`}
                label="y (mm)"
                value={anchor.position.y}
                onChange={handleChange(anchorId, 'y')}
                readOnly={readOnly}
              />
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}

export default AnchorEditor;
