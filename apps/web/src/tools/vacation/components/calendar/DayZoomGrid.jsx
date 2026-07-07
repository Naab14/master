import CoverageRows from './CoverageRows';
import { CELL_H, LABEL_W, STATUS_COLORS, STATUS_LABELS, SWEDISH_DAYS } from './constants';
import { isoWeekDates, formatDateStr } from './dateUtils';

const DAY_ZOOM_WEEKS = 8;
const DAY_COL_W = 38;
const BOLD_RULE_EVERY = 5;

function getDayStatus(block, dateStr) {
  if (!block) return null;
  return block.dayStatuses?.[dateStr] || block.status;
}

export default function DayZoomGrid({
  operators, vacationBlocks, demand, settings, weeks, holidayMap, groups,
  showDayCoverage, onToggleDayCoverage, setPopover,
  onAddBlock,
}) {
  const year = new Date().getFullYear();
  const visibleWeeks = weeks.slice(0, DAY_ZOOM_WEEKS);

  const cells = [];
  visibleWeeks.forEach(w => {
    const weekDates = isoWeekDates(year, w);
    weekDates.forEach((d, i) => {
      cells.push({ week: w, date: d, dayIndex: i, dateStr: formatDateStr(d) });
    });
  });

  const holidaysByDate = {};
  if (holidayMap) {
    Object.values(holidayMap).forEach(wk => {
      wk.holidays.forEach(h => { holidaysByDate[h.dateStr] = h; });
    });
  }

  const weekCellW = DAY_COL_W * 7;

  const handleDayClick = (e, op, block, dateStr, week) => {
    if (block) {
      setPopover({ x: e.clientX, y: e.clientY, block, dateStr });
    } else if (onAddBlock) {
      onAddBlock(op.id, week, week);
    }
  };

  const totalWidth = LABEL_W + cells.length * DAY_COL_W;

  return (
    <div className="flex-1 overflow-auto select-none">
      <div style={{ minWidth: totalWidth }}>
        {/* Week header row */}
        <div className="flex sticky top-0 z-30" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          <div className="sticky left-0 z-10 flex items-center px-2 text-xs font-semibold"
            style={{ width: LABEL_W, minWidth: LABEL_W, height: 22, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderRight: '1px solid var(--border)' }}>
            Operator
          </div>
          {visibleWeeks.map(w => {
            const isHolWeek = !!holidayMap?.[w]?.isHoliday;
            const holidayTitle = isHolWeek
              ? holidayMap[w].holidays.map(h => `${h.name} — ${h.dateStr}`).join(', ')
              : undefined;
            return (
              <div key={w}
                className="flex items-center justify-center text-xs font-semibold"
                title={holidayTitle}
                style={{
                  width: weekCellW, minWidth: weekCellW, height: 22,
                  borderRight: '2px solid var(--border)',
                  color: isHolWeek ? 'var(--holiday-text)' : 'var(--text-primary)',
                  background: isHolWeek ? 'var(--holiday-pattern)' : 'transparent',
                }}>
                v.{w}
              </div>
            );
          })}
        </div>

        {/* Day header row */}
        <div className="flex sticky top-[22px] z-20" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          <div className="sticky left-0 z-10 flex items-center px-2 text-xs font-semibold"
            style={{ width: LABEL_W, minWidth: LABEL_W, height: CELL_H, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderRight: '1px solid var(--border)' }}>
            &nbsp;
          </div>
          {cells.map((c, idx) => {
            const isHoliday = !!holidaysByDate[c.dateStr];
            const isWeekend = c.dayIndex >= 5;
            const isWeekBoundary = c.dayIndex === 6;
            const isBoldRule = (idx + 1) % BOLD_RULE_EVERY === 0 && !isWeekBoundary;
            const headerTitle = isHoliday
              ? `${holidaysByDate[c.dateStr].name} — ${c.dateStr}`
              : undefined;
            return (
              <div key={idx} className="flex flex-col items-center justify-center text-[10px] font-medium"
                title={headerTitle}
                style={{
                  width: DAY_COL_W, minWidth: DAY_COL_W, height: CELL_H,
                  borderRight: isWeekBoundary ? '2px solid var(--border)' : isBoldRule ? '2px solid var(--border)' : '1px solid var(--border)',
                  color: isHoliday ? 'var(--holiday-text)' : isWeekend ? 'var(--text-secondary)' : 'var(--text-primary)',
                  background: isHoliday ? 'var(--holiday-pattern)' : 'transparent',
                }}>
                <span className="leading-tight">{SWEDISH_DAYS[c.dayIndex]}</span>
                <span className="leading-tight">{c.date.getDate()}/{c.date.getMonth() + 1}</span>
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
                {cells.map((c, idx) => {
                  const block = vacationBlocks.find(b =>
                    b.operatorId === op.id && c.week >= b.startWeek && c.week <= b.endWeek,
                  );
                  const isHoliday = !!holidaysByDate[c.dateStr];
                  const isWeekend = c.dayIndex >= 5;
                  const isWeekBoundary = c.dayIndex === 6;
                  const isBoldRule = (idx + 1) % BOLD_RULE_EVERY === 0 && !isWeekBoundary;
                  const dayStatus = getDayStatus(block, c.dateStr);
                  const hasOverride = block && block.dayStatuses?.[c.dateStr] && block.dayStatuses[c.dateStr] !== block.status;
                  const isBlockStart = block && c.week === block.startWeek && c.dayIndex === 0;
                  const holidayTitle = !block && isHoliday
                    ? `${holidaysByDate[c.dateStr].name} — ${c.dateStr}`
                    : undefined;

                  let bgClass = isWeekend ? 'day-cell-off' : 'day-cell-working';
                  let cellStyle = {};

                  if (block) {
                    const sc = STATUS_COLORS[dayStatus];
                    if (dayStatus === 'requested') {
                      cellStyle = {
                        background: 'repeating-linear-gradient(45deg, var(--requested-bg), var(--requested-bg) 4px, transparent 4px, transparent 8px)',
                        borderTop: '2px dashed var(--requested-border)', borderBottom: '2px dashed var(--requested-border)',
                        opacity: 0.65, cursor: 'pointer',
                      };
                    } else {
                      cellStyle = {
                        background: sc.bg,
                        borderTop: `2px solid ${sc.border}`, borderBottom: `2px solid ${sc.border}`,
                        cursor: 'pointer',
                      };
                    }
                    bgClass = '';
                  } else if (isHoliday) {
                    cellStyle = { background: 'var(--holiday-pattern)' };
                    bgClass = '';
                  } else {
                    cellStyle.cursor = 'pointer';
                  }

                  const borderRight = isWeekBoundary
                    ? '2px solid var(--border)'
                    : isBoldRule
                      ? '2px solid var(--border)'
                      : '1px solid var(--border)';

                  return (
                    <div key={idx}
                      className={`flex items-center justify-center text-[9px] relative ${bgClass}`}
                      title={holidayTitle}
                      style={{ width: DAY_COL_W, minWidth: DAY_COL_W, height: CELL_H, borderRight, ...cellStyle }}
                      onClick={e => handleDayClick(e, op, block, c.dateStr, c.week)}>
                      {block && (
                        <span className="font-medium truncate pointer-events-none select-none"
                          style={{ color: 'var(--text-primary)', opacity: 0.8 }}>
                          {STATUS_LABELS[dayStatus]?.slice(0, 3)}
                        </span>
                      )}
                      {hasOverride && (
                        <span className="absolute top-0 right-0.5 text-[7px] pointer-events-none"
                          style={{ color: 'var(--accent)' }}>●</span>
                      )}
                      {block?.note && isBlockStart && (
                        <span className="absolute top-0 left-0.5 text-[8px] pointer-events-none"
                          title={block.note} aria-label="Has note">💬</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {showDayCoverage && (
              <CoverageRows operators={operators} vacationBlocks={vacationBlocks} demand={demand}
                weeks={visibleWeeks} shiftMode={settings.shiftMode} shiftFilter={group.shift}
                holidayMap={holidayMap} label={`COVERAGE (${group.label})`}
                cellWidth={weekCellW} />
            )}
          </div>
        ))}

        <div className="flex items-center px-3 py-1.5" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={onToggleDayCoverage} className="text-xs px-2 py-1"
            style={{ background: showDayCoverage ? 'var(--accent)' : 'var(--bg-primary)', color: showDayCoverage ? '#fff' : 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)' }}>
            {showDayCoverage ? 'Hide Coverage' : 'Show Coverage'}
          </button>
        </div>
      </div>
    </div>
  );
}
