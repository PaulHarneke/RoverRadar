import { ChangeEvent } from 'react';
import { PointMM } from '../core/types';

interface TagEditorProps {
  tag: PointMM;
  onChange: (point: PointMM) => void;
  readOnly?: boolean;
}

const DECIMALS = 1;
const STEP = Number((1).toFixed(DECIMALS)) / Math.pow(10, 0); // -> 1, kept for clarity

export function TagEditor({ tag, onChange, readOnly }: TagEditorProps): JSX.Element {
  const handleChange = (field: keyof PointMM) => (event: ChangeEvent<HTMLInputElement>) => {
    // normalize comma -> dot for locales that display comma
    const raw = event.target.value.replace(',', '.');
    const next = Number.parseFloat(raw);
    if (!Number.isFinite(next)) {
      return;
    }
    onChange({
      ...tag,
      [field]: next,
    });
  };

  return (
    <section className="panel-section">
      <header>
        <h2>Tag</h2>
        <p>Position des beweglichen Tags in mm</p>
      </header>
      <div className="tag-editor">
        <label className="field">
          <span>x (mm)</span>
          <input
            type="number"
            inputMode="decimal"
            step={Number((1 / Math.pow(10, DECIMALS)).toFixed(DECIMALS))}
            value={tag.x.toFixed(DECIMALS)}
            onChange={handleChange('x')}
            readOnly={readOnly}
          />
        </label>
        <label className="field">
          <span>y (mm)</span>
          <input
            type="number"
            inputMode="decimal"
            step={Number((1 / Math.pow(10, DECIMALS)).toFixed(DECIMALS))}
            value={tag.y.toFixed(DECIMALS)}
            onChange={handleChange('y')}
            readOnly={readOnly}
          />
        </label>
      </div>
      <p className="hint">Drag &amp; Drop im Canvas aktualisiert die Werte live.</p>
    </section>
  );
}

export default TagEditor;
