import { PROCESSES } from '../../data';
import { CELL_W, CELL_H, LABEL_W } from './constants';
import { useI18n } from '../../../../i18n';

export default function DemandEditor({ demand, weeks, updateDemand, processes = PROCESSES.map(p => ({ key: p, name: p })) }) {
  const { t } = useI18n();
  return (
    <div style={{ borderTop: '2px solid var(--border)' }}>
      <div className="flex items-center justify-between px-2 py-1" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{t('Demand')}</span>
      </div>
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
            {name}
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
