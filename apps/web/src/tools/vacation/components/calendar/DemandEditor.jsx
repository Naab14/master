import { useState } from 'react';
import { PROCESSES } from '../../data';
import { Button } from '../../../../ui';
import { Select } from '../../../../workforce/ui';
import { CELL_W, CELL_H, LABEL_W } from './constants';
import { useI18n } from '../../../../i18n';

export default function DemandEditor({ demand, weeks, updateDemand, onCopyDemand, processes = PROCESSES.map(p => ({ key: p, name: p })) }) {
  const { t } = useI18n();
  // Saved demand of the older process list (never matched by name: copied only when asked)
  const [into, setInto] = useState('');
  const [from, setFrom] = useState('');
  const oldKeys = Object.keys(demand || {}).filter(k => !k.startsWith('wf:'));
  return (
    <div style={{ borderTop: '2px solid var(--border)' }}>
      <div className="flex items-center justify-between px-2 py-1" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{t('Demand')}</span>
      </div>
      {onCopyDemand && oldKeys.length > 0 && (
        <div className="wf-toolbar bg-ground" role="group" aria-label={t('Copy old demand')}>
          <span className="text-xs font-semibold text-ink-3">{t('Copy old demand')}</span>
          <Select value={from} onChange={e => setFrom(e.target.value)} aria-label={t('Copy from…')}>
            <option value="">{t('Copy from…')}</option>
            {oldKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </Select>
          <span className="text-xs text-ink-3">→</span>
          <Select value={into} onChange={e => setInto(e.target.value)} aria-label={t('Into process…')}>
            <option value="">{t('Into process…')}</option>
            {processes.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
          </Select>
          <Button disabled={!from || !into} onClick={() => onCopyDemand(into, from)}>{t('Copy')}</Button>
        </div>
      )}
      <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="sticky left-0 z-10 flex items-center px-2 text-xs font-semibold"
          style={{ width: LABEL_W, minWidth: LABEL_W, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderRight: '1px solid var(--border)' }}>
          {t('Process')}
        </div>
        {weeks.map(w => (
          <div key={w} className="flex items-center justify-center text-xs font-medium"
            style={{ width: CELL_W, minWidth: CELL_W, color: 'var(--text-secondary)', borderRight: '1px solid var(--border)' }}>
            {t('w.{n}', { n: w })}
          </div>
        ))}
      </div>
      {processes.map(({ key: proc, name }) => (
        <div key={proc} className="flex" style={{ height: CELL_H, borderBottom: '1px solid var(--border)' }}>
          <div className="sticky left-0 z-10 flex items-center px-2 text-xs"
            style={{ width: LABEL_W, minWidth: LABEL_W, background: 'var(--bg-primary)', borderRight: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <span className="truncate" title={name}>{name}</span>
          </div>
          {weeks.map(w => (
            <div key={w} className="flex items-center justify-center"
              style={{ width: CELL_W, minWidth: CELL_W, borderRight: '1px solid var(--border)' }}>
              <input type="number" min={0} max={20} aria-label={`${name} ${t('w.{n}', { n: w })}`}
                value={demand[proc]?.[w] ?? 2}
                onChange={e => updateDemand(proc, w, Math.max(0, parseInt(e.target.value) || 0))}
                className="w-8 text-center text-xs py-0.5"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)', color: 'var(--text-primary)' }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
