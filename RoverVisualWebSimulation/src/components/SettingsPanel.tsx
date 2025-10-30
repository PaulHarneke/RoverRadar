import { HttpSettings, MqttSettings, NoiseSettings } from '../core/types';
import { useState } from 'react';

interface SettingsPanelProps {
  noise: NoiseSettings;
  snapToGrid: boolean;
  autoSendEnabled: boolean;
  autoSendIntervalMs: number;
  http: HttpSettings;
  mqtt: MqttSettings;
  onNoiseChange: (settings: NoiseSettings) => void;
  onSnapToGridChange: (value: boolean) => void;
  onAutoSendEnabledChange: (value: boolean) => void;
  onAutoSendIntervalChange: (value: number) => void;
  onHttpSettingsChange: (settings: Partial<HttpSettings>) => void;
  onMqttSettingsChange: (settings: Partial<MqttSettings>) => void;
  onSendSingle: () => void;
  readOnly?: boolean;
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }): JSX.Element {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

export function SettingsPanel({
  noise,
  snapToGrid,
  autoSendEnabled,
  autoSendIntervalMs,
  http,
  mqtt,
  onNoiseChange,
  onSnapToGridChange,
  onAutoSendEnabledChange,
  onAutoSendIntervalChange,
  onHttpSettingsChange,
  onMqttSettingsChange,
  onSendSingle,
  readOnly,
}: SettingsPanelProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className={`panel-section ${collapsed ? 'collapsed' : ''}`}>
      <header>
        <div>
          <h2>Settings</h2>
          <p>Noise, Rasterung und Node-RED Export</p>
        </div>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Panel ausklappen' : 'Panel einklappen'}
          onClick={() => setCollapsed((s) => !s)}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      </header>

      <div className={`panel-body ${collapsed ? 'collapsed' : ''}`}>
        <div className="settings-group">
          <Toggle label="Snap-to-Grid (10 mm)" checked={snapToGrid} onChange={onSnapToGridChange} disabled={readOnly} />
          <Toggle
            label={`Rauschsimulation ${noise.enabled ? `(σ=${noise.sigma.toFixed(1)} mm)` : ''}`}
            checked={noise.enabled}
            onChange={(value) => onNoiseChange({ ...noise, enabled: value })}
            disabled={readOnly}
          />
          <div className="field">
            <span>σ (mm)</span>
            <input
              type="range"
              min={0}
              max={500}
              step={1}
              value={noise.sigma}
              onChange={(event) => {
                const sigma = Number.parseFloat(event.target.value);
                if (Number.isFinite(sigma)) {
                  onNoiseChange({ ...noise, sigma });
                }
              }}
              disabled={readOnly || !noise.enabled}
            />
            <output>{noise.sigma.toFixed(1)} mm</output>
          </div>
          <div className="field">
            <span>Auto-Send Intervall</span>
            <select
              value={autoSendIntervalMs}
              onChange={(event) => onAutoSendIntervalChange(Number.parseInt(event.target.value, 10))}
              disabled={readOnly || !autoSendEnabled}
            >
              {[100, 500, 1000].map((value) => (
                <option key={value} value={value}>
                  {value} ms
                </option>
              ))}
            </select>
          </div>
          <Toggle
            label="Automatisches Senden"
            checked={autoSendEnabled}
            onChange={onAutoSendEnabledChange}
            disabled={readOnly}
          />
          <button type="button" onClick={onSendSingle} disabled={readOnly} className="primary">
            Frame sofort senden
          </button>
        </div>
        <div className="settings-group">
          <h4>HTTP (Node-RED)</h4>
          <Toggle
            label="HTTP Versand aktiv"
            checked={http.enabled}
            onChange={(enabled) => onHttpSettingsChange({ enabled })}
            disabled={readOnly}
          />
          <label className="field">
            <span>URL</span>
            <input
              type="url"
              value={http.url}
              onChange={(event) => onHttpSettingsChange({ url: event.target.value })}
              placeholder="http://localhost:1880/sim"
              readOnly={readOnly}
            />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>Timeout (ms)</span>
              <input
                type="number"
                min={100}
                step={100}
                value={http.timeoutMs}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  if (Number.isFinite(next)) {
                    onHttpSettingsChange({ timeoutMs: next });
                  }
                }}
                readOnly={readOnly}
              />
            </label>
            <label className="field">
              <span>Retries</span>
              <input
                type="number"
                min={0}
                max={5}
                value={http.retryCount}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  if (Number.isFinite(next)) {
                    onHttpSettingsChange({ retryCount: next });
                  }
                }}
                readOnly={readOnly}
              />
            </label>
            <label className="field">
              <span>Retry Delay (ms)</span>
              <input
                type="number"
                min={100}
                step={100}
                value={http.retryDelayMs}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  if (Number.isFinite(next)) {
                    onHttpSettingsChange({ retryDelayMs: next });
                  }
                }}
                readOnly={readOnly}
              />
            </label>
          </div>
        </div>
        <div className="settings-group">
          <h4>MQTT (WebSocket)</h4>
          <Toggle
            label="MQTT Versand aktiv"
            checked={mqtt.enabled}
            onChange={(enabled) => onMqttSettingsChange({ enabled })}
            disabled={readOnly}
          />
          <label className="field">
            <span>Broker URL</span>
            <input
              type="url"
              value={mqtt.brokerUrl}
              onChange={(event) => onMqttSettingsChange({ brokerUrl: event.target.value })}
              placeholder="ws://localhost:9001"
              readOnly={readOnly}
            />
          </label>
          <label className="field">
            <span>Topic Prefix</span>
            <input
              type="text"
              value={mqtt.topicPrefix}
              onChange={(event) => onMqttSettingsChange({ topicPrefix: event.target.value })}
              placeholder="uwb/sim"
              readOnly={readOnly}
            />
          </label>
          <Toggle
            label="Retained Messages"
            checked={mqtt.retain}
            onChange={(retain) => onMqttSettingsChange({ retain })}
            disabled={readOnly}
          />
        </div>
      </div>
    </section>
  );
}

export default SettingsPanel;
