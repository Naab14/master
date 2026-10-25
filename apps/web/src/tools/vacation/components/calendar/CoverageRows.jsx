import { useState, useMemo } from 'react';
import { PROCESSES } from '../../data';
import { getAllCoverageForWeek } from '../../coverage';
import { CELL_W, CELL_H, LABEL_W } from './constants';

function CoverageTooltip({ coverageData, week, process, holidayMap, style }) {
  if (!coverageData) return null;
  const { covered, required, operatorsIn, operatorsOut, isHoliday } = coverageData;
  const holidayNames = holidayMap?.[week]?.holidays?.map(h => h.name) || [];
  return (
    <div className="coverage-tooltip" style={style} role="tooltip">
      <div className="font-semibold mb-1">{process} — v.{week}</div>
      {isHoliday && <div style={{ color: 'var(--holiday-text)' }} className="text-xs mb-1">🔴 {holidayNames.join(', ')}</div>}
      <div className="mb-1">{covered} av {required} tillgängliga</div>
      {operatorsIn.length > 0 && (
        <div className="mb-1">
          <span className="font-medium" style={{ color: 'var(--coverage-green)' }}>Inne:</span>
          {operatorsIn.map(o => <div key={o.id} className="ml-2">{o.name}</div>)}
        </div>
      )}
      {operatorsOut.length > 0 && (
        <div>
          <span className="font-medium" style={{ color: 'var(--coverage-red)' }}>Borta:</span>
          {operatorsOut.map(o => <div key={o.id} className="ml-2">{o.name}</div>)}
        </div>
      )}
    </div>
  );
}

const colorMap = { green: 'var(--coverage-green)', yellow: 'var(--coverage-yellow)', red: 'var(--coverage-red)' };

export default function CoverageRows({ operators, vacationBlocks, demand, weeks, shiftMode, shiftFilter, holidayMap, label, cellWidth }) {
  const [tooltip, setTooltip] = useState(null);
  const w = cellWidth ?? CELL_W;

  const coverageByWeek = useMemo(() => {
    const map = {};
    for (const w of weeks) {
      map[w] = getAllCoverageForWeek(operators, vacationBlocks, demand, w, shiftMode, shiftFilter, holidayMap);
    }
    return map;
  }, [operators, vacationBlocks, demand, weeks, shiftMode, shiftFilter, holidayMap]);

  return (
    <>
      <div className="flex items-center text-xs font-semibold uppercase tracking-wider px-2"
        style={{ height: 24, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: LABEL_W, minWidth: LABEL_W }}>{label}</div>
      </div>
      {PROCESSES.map(proc => (
        <div key={proc} className="flex" style={{ height: CELL_H, borderBottom: '1px solid var(--border)' }}>
          <div className="sticky left-0 z-10 flex items-center px-2 text-xs truncate"
            style={{ width: LABEL_W, minWidth: LABEL_W, background: 'var(--bg-primary)', borderRight: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {proc}
          </div>
          {weeks.map(wk => {
            const cov = coverageByWeek[wk]?.[proc];
            if (!cov) return null;
            return (
              <div key={wk}
                className="flex items-center justify-center text-xs font-medium relative"
                style={{ width: w, minWidth: w, height: CELL_H, borderRight: '1px solid var(--border)', color: colorMap[cov.level], cursor: 'help' }}
                tabIndex={0} role="button"
                aria-label={`${proc} v.${wk}: ${cov.covered}/${cov.required}`}
                onPointerEnter={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = rect.right + 4 > window.innerWidth ? rect.left - 220 : rect.right + 4;
                  const y = Math.min(rect.top, window.innerHeight - 200);
                  setTooltip({ proc, week: wk, cov, x, y });
                }}
                onPointerLeave={() => setTooltip(null)}
                onFocus={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({ proc, week: wk, cov, x: rect.right + 4, y: rect.top });
                }}
                onBlur={() => setTooltip(null)}>
                {cov.covered}/{cov.required}
                {cov.isHoliday && <span className="absolute top-0 right-0.5 text-[8px]" style={{ color: 'var(--holiday-text)' }}>★</span>}
              </div>
            );
          })}
        </div>
      ))}
      {tooltip && (
        <CoverageTooltip coverageData={tooltip.cov} week={tooltip.week} process={tooltip.proc}
          holidayMap={holidayMap} style={{ position: 'fixed', left: tooltip.x, top: tooltip.y }} />
      )}
    </>
  );
}
