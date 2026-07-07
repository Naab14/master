import CoverageRows from './CoverageRows';
import DemandEditor from './DemandEditor';
import { CELL_W, CELL_H, LABEL_W, STATUS_COLORS, HOLIDAY_ABBREV } from './constants';

export default function WeekZoomGrid({
  ref, operators, vacationBlocks, demand, settings, weeks, holidayMap,
  groups, drag, showDemand, updateDemand,
  onCellPointerDown, onCellPointerUp, onResizePointerDown,
}) {
  return (
    <div ref={ref} className={`flex-1 overflow-auto select-none ${drag ? 'grid-dragging' : ''}`}>
      <div style={{ minWidth: LABEL_W + weeks.length * CELL_W }}>
        {/* Header */}
        <div className="flex sticky top-0 z-20" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          <div className="sticky left-0 z-10 flex items-center px-2 text-xs font-semibold"
            style={{ width: LABEL_W, minWidth: LABEL_W, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderRight: '1px solid var(--border)' }}>
            Operator
          </div>
          {weeks.map(w => {
            const isHoliday = holidayMap[w]?.holidays?.length > 0;
            const holidayAbbrevs = isHoliday ? holidayMap[w].holidays.map(h => HOLIDAY_ABBREV[h.name] || h.name.slice(0, 7)) : [];
            const holidayTitle = isHoliday ? holidayMap[w].holidays.map(h => `${h.name} — ${h.dateStr}`).join(', ') : undefined;
            return (
              <div key={w} className="flex flex-col items-center justify-center text-xs font-medium"
                style={{ width: CELL_W, minWidth: CELL_W, height: isHoliday ? CELL_H + 12 : CELL_H, color: isHoliday ? 'var(--holiday-text)' : 'var(--text-secondary)', background: isHoliday ? 'var(--holiday-pattern)' : 'transparent', borderRight: '1px solid var(--border)', lineHeight: 1.1 }}
                title={holidayTitle}>
                <span>v.{w}</span>
                {isHoliday && <span className="text-[9px] italic opacity-80 truncate w-full text-center" style={{ color: 'var(--holiday-text)' }}>{holidayAbbrevs[0]}</span>}
              </div>
            );
          })}
        </div>

        {/* Row groups */}
        {groups.map(group => (
          <div key={group.label}>
            {groups.length > 1 && (
              <div className="flex items-center text-xs font-semibold uppercase tracking-wider px-2"
                style={{ height: 24, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                {group.label}
              </div>
            )}

            {group.ops.map(op => (
              <div key={op.id} className="flex relative" style={{ height: CELL_H, borderBottom: '1px solid var(--border)', opacity: op.active ? 1 : 0.4 }}>
                <div className="sticky left-0 z-10 flex items-center px-2 text-xs truncate"
                  style={{ width: LABEL_W, minWidth: LABEL_W, background: 'var(--bg-primary)', borderRight: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  {op.name}
                </div>
                {weeks.map(w => {
                  const block = vacationBlocks.find(b => b.operatorId === op.id && w >= b.startWeek && w <= b.endWeek);
                  const hasDayOverrides = block && block.dayStatuses && Object.keys(block.dayStatuses).length > 0;
                  const isDrawing = drag?.type === 'drawing' && drag.opId === op.id && w >= Math.min(drag.startWeek, drag.endWeek) && w <= Math.max(drag.startWeek, drag.endWeek);
                  const isStart = block && w === block.startWeek;
                  const isEnd = block && w === block.endWeek;
                  const isDrag = drag && (drag.type === 'moving' && drag.blockId === block?.id || drag.type === 'resizing' && drag.blockId === block?.id);
                  const isHoliday = holidayMap[w]?.holidays?.length > 0;

                  let cellStyle = {};
                  if (block) {
                    if (block.status === 'requested') {
                      cellStyle = {
                        background: 'repeating-linear-gradient(45deg, var(--requested-bg), var(--requested-bg) 4px, transparent 4px, transparent 8px)',
                        borderTop: '2px dashed var(--requested-border)', borderBottom: '2px dashed var(--requested-border)',
                        opacity: 0.65, zIndex: 1,
                      };
                      if (isStart) { cellStyle.borderLeft = '2px dashed var(--requested-border)'; cellStyle.borderTopLeftRadius = '6px'; cellStyle.borderBottomLeftRadius = '6px'; }
                      if (isEnd) { cellStyle.borderRight = '2px dashed var(--requested-border)'; cellStyle.borderTopRightRadius = '6px'; cellStyle.borderBottomRightRadius = '6px'; }
                    } else {
                      const bgVar = `var(--${block.status}-bg)`;
                      const borderVar = `var(--${block.status}-border)`;
                      cellStyle = {
                        background: bgVar, borderTop: `2px solid ${borderVar}`, borderBottom: `2px solid ${borderVar}`,
                        zIndex: block.status === 'approved' ? 3 : 2,
                      };
                      if (isStart) { cellStyle.borderLeft = `2px solid ${borderVar}`; cellStyle.borderTopLeftRadius = '6px'; cellStyle.borderBottomLeftRadius = '6px'; }
                      if (isEnd) { cellStyle.borderRight = `2px solid ${borderVar}`; cellStyle.borderTopRightRadius = '6px'; cellStyle.borderBottomRightRadius = '6px'; }
                    }
                    cellStyle.boxShadow = isDrag ? '0 10px 15px -3px rgba(0,0,0,0.1)' : '0 2px 4px -1px rgba(0,0,0,0.06)';
                    if (isDrag) { cellStyle.transform = 'scale(1.02)'; cellStyle.outline = '2px solid var(--accent)'; }
                  } else if (isDrawing) {
                    cellStyle = { background: 'var(--draft-bg)', opacity: 0.5 };
                  } else if (isHoliday) {
                    cellStyle = { background: 'var(--holiday-pattern)' };
                  }

                  const cellTitle = !block && isHoliday
                    ? holidayMap[w].holidays.map(h => `${h.name} — ${h.dateStr}`).join(', ')
                    : undefined;

                  return (
                    <div key={w}
                      data-week={w} data-op={op.id}
                      className={`flex items-center justify-center text-xs relative ${isDrag ? 'block-dragging' : ''}`}
                      style={{ width: CELL_W, minWidth: CELL_W, height: CELL_H, borderRight: '1px solid var(--border)', cursor: block ? 'grab' : 'crosshair', touchAction: 'none', ...cellStyle }}
                      title={cellTitle}
                      onPointerDown={e => onCellPointerDown(e, op.id, w)}
                      onPointerUp={e => onCellPointerUp(e, op.id, w)}>
                      {block && isStart && (
                        <div className="resize-handle" style={{ left: 0, cursor: 'w-resize' }}
                          onPointerDown={e => onResizePointerDown(e, block.id, 'left', block)} />
                      )}
                      {block && isEnd && (
                        <div className="resize-handle" style={{ right: 0, cursor: 'e-resize' }}
                          onPointerDown={e => onResizePointerDown(e, block.id, 'right', block)} />
                      )}
                      {block && isStart && (
                        <span className="absolute inset-[2px] flex items-center justify-center text-xs font-medium truncate pointer-events-none select-none"
                          style={{ color: 'var(--text-primary)' }}>
                          {block.startWeek === block.endWeek ? `v.${block.startWeek}` : `v.${block.startWeek}-${block.endWeek}`}
                        </span>
                      )}
                      {hasDayOverrides && isEnd && (
                        <span className="absolute top-0 right-0.5 text-[8px] pointer-events-none"
                          style={{ color: 'var(--accent)' }} title="Per-day overrides">●</span>
                      )}
                      {block?.note && isStart && (
                        <span className="absolute top-0 left-0.5 text-[9px] pointer-events-none"
                          title={block.note} aria-label="Has note">💬</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <CoverageRows operators={operators} vacationBlocks={vacationBlocks} demand={demand}
              weeks={weeks} shiftMode={settings.shiftMode} shiftFilter={group.shift} holidayMap={holidayMap} label={`COVERAGE (${group.label})`} />
          </div>
        ))}

        {showDemand && <DemandEditor demand={demand} weeks={weeks} updateDemand={updateDemand} />}
      </div>
    </div>
  );
}
