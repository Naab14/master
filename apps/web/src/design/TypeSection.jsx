import { useState } from 'react';
import { TextField } from '../ui';

const STEPS = [
  { cls: 't-title', name: '.t-title', spec: 'Display face · 36px (28px on phones)' },
  { cls: 't-section', name: '.t-section', spec: 'UI face · 18px / 600' },
  { cls: 't-body', name: '.t-body', spec: 'UI face · 14px / 1.5' },
  { cls: 't-label', name: '.t-label', spec: 'UI face · 12px / 600 · ink-3' },
];

/* The four type steps, with your own sample text. */
export default function TypeSection() {
  const [sample, setSample] = useState('Line 2 back on plan after changeover');
  return (
    <div className="flex flex-col gap-4">
      <TextField label="Try your own text" value={sample} onChange={e => setSample(e.target.value)} className="dw-wide" />
      <div className="ui-panel" style={{ gap: 0 }}>
        {STEPS.map(s => (
          <div key={s.cls} className="dw-typerow">
            <div className="dw-typerow__meta">
              <code>{s.name}</code>
              <span className="t-label">{s.spec}</span>
            </div>
            <p className={s.cls}>{sample || ' '}</p>
          </div>
        ))}
        <div className="dw-typerow">
          <div className="dw-typerow__meta"><code>.t-num</code><span className="t-label">Numbers that line up</span></div>
          <p className="t-body t-num font-semibold">0/2 · 1/2 · 2/2 · 11/20 · 06:00–14:00</p>
        </div>
      </div>
    </div>
  );
}
