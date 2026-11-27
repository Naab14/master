import { useState } from 'react';
import { Pill, useToast } from '../ui';
import { THEMES, COLOR_GROUPS, TEXT_PAIRS, contrast, grade } from './tokens.js';

const TONE = { AAA: 'ok', AA: 'ok', Large: 'warn', Fail: 'bad' };

/* Every colour token of the active theme, plus a pair checker. Click a
 * swatch to copy its CSS variable. */
export default function ColorSection({ theme }) {
  const toast = useToast();
  const t = THEMES[theme];
  const ground = t['surface-ground'];
  const [fg, setFg] = useState('ink-3');
  const [bg, setBg] = useState('surface-panel');
  const ratio = contrast(t[fg], t[bg], ground);
  const all = COLOR_GROUPS.flatMap(g => g.names);

  const copy = name => {
    const text = `var(--${name})`;
    navigator.clipboard?.writeText(text).then(() => toast(`Copied ${text}`), () => toast(text));
  };

  return (
    <div className="flex flex-col gap-6">
      {COLOR_GROUPS.map(g => (
        <div key={g.title} className="flex flex-col gap-2">
          <h3 className="t-label">{g.title}</h3>
          <div className="dw-swatches">
            {g.names.map(n => (
              <button key={n} type="button" className="dw-swatch ui-focus" onClick={() => copy(n)} title={`Copy var(--${n})`}>
                <span className="dw-swatch__chip" style={{ background: `var(--${n})` }} />
                <span className="dw-swatch__name">{n}</span>
                <span className="dw-swatch__value t-num">{t[n]}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="ui-panel">
        <h3 className="t-section">Contrast checker</h3>
        <p className="t-body" style={{ color: 'var(--ink-2)' }}>Pick a text colour and a background. Body text needs 4.5:1; large text and control edges need 3:1.</p>
        <div className="flex flex-wrap items-end gap-4">
          <label className="ui-field">
            <span className="t-label">Text</span>
            <select className="ui-input" value={fg} onChange={e => setFg(e.target.value)}>{all.map(n => <option key={n}>{n}</option>)}</select>
          </label>
          <label className="ui-field">
            <span className="t-label">Background</span>
            <select className="ui-input" value={bg} onChange={e => setBg(e.target.value)}>{all.map(n => <option key={n}>{n}</option>)}</select>
          </label>
          <div className="dw-sample" style={{ background: `var(--${bg})`, color: `var(--${fg})` }}>Gap on Inspection 0/2</div>
          <div className="flex flex-col gap-1">
            <span className="ui-stat__value t-num">{ratio.toFixed(2)}:1</span>
            <Pill tone={TONE[grade(ratio)]}>{grade(ratio) === 'Fail' ? 'Fails' : `Passes ${grade(ratio)}`}</Pill>
          </div>
        </div>
        <h3 className="t-label" style={{ marginTop: 'var(--space-3)' }}>Pairs the app relies on</h3>
        <div className="dw-pairs">
          {TEXT_PAIRS.map(([f, b]) => {
            const r = contrast(t[f], t[b], ground);
            return (
              <div key={f + b} className="dw-pair" style={{ background: `var(--${b})`, color: `var(--${f})` }}>
                <span>{f} on {b}</span>
                <strong className="t-num">{r.toFixed(1)}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
