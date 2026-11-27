import { useState } from 'react';
import { Button, Pill, Segmented, TextField, Checkbox, Toggle, StatTile, useToast } from '../ui';

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'].map(v => ({ value: v, label: v }));
const TONES = ['ok', 'warn', 'bad', 'idle', 'approved', 'pending', 'draft', 'requested'];
const PILL_TEXT = { ok: 'Covered 2/2', warn: 'One short 1/2', bad: 'Gap 0/2', idle: 'Not started', approved: 'Approved', pending: 'Pending', draft: 'Draft', requested: 'Requested' };

function stat(value, total) {
  if (value >= total) return { tone: 'ok', note: 'Covered' };
  if (value === total - 1) return { tone: 'warn', note: 'One short' };
  return { tone: 'bad', note: 'Gap' };
}

/* Knobs for each component, with the JSX that produces what you see. */
export default function Playground() {
  const toast = useToast();
  const [variant, setVariant] = useState('primary');
  const [size, setSize] = useState('md');
  const [disabled, setDisabled] = useState(false);
  const [label, setLabel] = useState('New task');
  const [tone, setTone] = useState('ok');
  const [possible, setPossible] = useState(3);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(true);

  const props = [variant !== 'secondary' && `variant="${variant}"`, size === 'lg' && 'size="lg"', disabled && 'disabled'].filter(Boolean).join(' ');
  const s = stat(possible, 4);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="ui-panel">
        <h3 className="t-section">Button</h3>
        <Segmented label="Variant" value={variant} onChange={setVariant} options={VARIANTS} />
        <div className="flex flex-wrap items-end gap-4">
          <Segmented label="Size" value={size} onChange={setSize} options={[{ value: 'md', label: 'md' }, { value: 'lg', label: 'lg' }]} />
          <Toggle label="Disabled" checked={disabled} onChange={setDisabled} />
        </div>
        <TextField label="Label" value={label} onChange={e => setLabel(e.target.value)} />
        <div className="dw-stage">
          <Button variant={variant} size={size} disabled={disabled} onClick={() => toast(`Clicked “${label}”`)}>{label || 'Button'}</Button>
        </div>
        <pre className="dw-code">{`<Button${props ? ` ${props}` : ''}>${label}</Button>`}</pre>
      </div>

      <div className="ui-panel">
        <h3 className="t-section">Pill</h3>
        <div className="flex flex-wrap gap-2">
          {TONES.map(t => (
            <button key={t} type="button" className="dw-chip ui-focus" aria-pressed={tone === t} onClick={() => setTone(t)}>{t}</button>
          ))}
        </div>
        <div className="dw-stage"><Pill tone={tone}>{PILL_TEXT[tone]}</Pill></div>
        <pre className="dw-code">{`<Pill tone="${tone}">${PILL_TEXT[tone]}</Pill>`}</pre>
        <p className="t-label">Green, amber and red mean coverage only. Leave is always blue.</p>
      </div>

      <div className="ui-panel">
        <h3 className="t-section">Stat tile</h3>
        <label className="ui-field">
          <span className="t-label">Possible operators: {possible} of 4</span>
          <input type="range" min="0" max="4" value={possible} onChange={e => setPossible(Number(e.target.value))} />
        </label>
        <StatTile label="Possible on Packing" value={possible} total={4} tone={s.tone} note={s.note} />
        <pre className="dw-code">{`<StatTile label="Possible on Packing" value={${possible}} total={4} tone="${s.tone}" note="${s.note}" />`}</pre>
      </div>

      <div className="ui-panel">
        <h3 className="t-section">Fields and switches</h3>
        <Toggle label="Show the error state" checked={invalid} onChange={setInvalid} />
        <TextField label="Operators needed" type="number" defaultValue="0" hint="Per shift" error={invalid ? 'Must be at least 1' : undefined} />
        <Checkbox label="Line clearance signed" checked={done} onChange={e => setDone(e.target.checked)} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => toast('Log entry deleted', { action: { label: 'Undo', onClick: () => toast('Log entry restored') } })}>Delete with Undo</Button>
        </div>
      </div>
    </div>
  );
}
