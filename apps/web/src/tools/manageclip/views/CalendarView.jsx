import { useMemo, useState } from 'react';
import { fmtDate, parseDate, startOfWeek, todayStr, effStatus } from '../store';
import { useI18n } from '../../../i18n';
import { Button, Segmented, useToast } from '../../../ui';
import { isoWeek } from '../../../workforce/logic/time';
import { pulse } from '../../../workforce/motion';

/* Status is always said in words (legend, tooltip); color only supports it. */
const STATUS_CLASS = {
  overdue: { chip: 'bg-bad-bg text-bad-fg', dot: 'bg-bad-solid' },
  current: { chip: 'bg-soft text-ink', dot: 'bg-warn-solid' },
  finished: { chip: 'bg-ok-bg text-ok-fg line-through', dot: 'bg-ok-solid' },
};

export default function CalendarView({ state, patchTask, onEdit }) {
  const { t, fmt } = useI18n();
  const toast = useToast();
  // Phones start in the week view, where each day is a full-width row.
  const [mode, setMode] = useState(() => (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches ? 'week' : 'month')); // 'month' | 'week'
  const [anchor, setAnchor] = useState(() => new Date());
  const [dragOver, setDragOver] = useState(null); // dateStr being hovered
  const [dragId, setDragId] = useState(null);
  const today = todayStr();
  const statusLabel = { overdue: t('Overdue'), current: t('In progress'), finished: t('Completed') };

  const byDate = useMemo(() => {
    const map = {};
    state.tasks.forEach(task => { (map[task.due_date] = map[task.due_date] || []).push(task); });
    Object.values(map).forEach(list => list.sort((a, b) => a.title.localeCompare(b.title)));
    return map;
  }, [state.tasks]);

  const days = useMemo(() => {
    const out = [];
    if (mode === 'month') {
      const y = anchor.getFullYear();
      const m = anchor.getMonth();
      const first = startOfWeek(new Date(y, m, 1));
      for (let i = 0; i < 42; i++) {
        const d = new Date(first);
        d.setDate(d.getDate() + i);
        if (i === 35 && d.getMonth() !== m) break; // skip an all-overflow last row
        out.push({ dateStr: fmtDate(d), otherMonth: d.getMonth() !== m });
      }
    } else {
      const start = startOfWeek(anchor);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        out.push({ dateStr: fmtDate(d), otherMonth: false });
      }
    }
    return out;
  }, [mode, anchor]);

  const title = mode === 'month'
    ? fmt.date(fmtDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1)), 'month')
    : `${fmt.date(days[0].dateStr)} – ${fmt.date(days[6].dateStr)} · ${t('week')} ${isoWeek(days[0].dateStr)}`;

  const shift = dir => {
    if (mode === 'month') setAnchor(a => new Date(a.getFullYear(), a.getMonth() + dir, 1));
    else setAnchor(a => { const d = new Date(a); d.setDate(d.getDate() + dir * 7); return d; });
  };

  /* Show where a task landed with a short pulse, once it has been drawn there. */
  const landed = id => requestAnimationFrame(() => pulse(document.querySelector(`[data-task="${id}"]`)));

  const drop = (e, dateStr) => {
    e.preventDefault();
    setDragOver(null);
    setDragId(null);
    const id = e.dataTransfer.getData('text/plain');
    const task = state.tasks.find(x => x.id === id);
    if (task && task.due_date !== dateStr) {
      const from = task.due_date;
      patchTask(id, { due_date: dateStr });
      landed(id);
      toast(t('Moved to {date}', { date: `${fmt.date(dateStr, 'weekday')} ${fmt.date(dateStr)}` }), {
        // Only the date goes back: anything done to the task since stays.
        action: { label: t('Undo'), onClick: () => { patchTask(id, { due_date: from }); landed(id); } },
      });
    }
  };

  const toggleDone = task => {
    const finished = task.status !== 'finished';
    patchTask(task.id, { status: finished ? 'finished' : 'current' });
    landed(task.id);
    toast(finished ? t('Task completed') : t('Task reopened'));
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button icon aria-label={t('Earlier')} title={t('Earlier')} onClick={() => shift(-1)}>‹</Button>
        <Button onClick={() => setAnchor(new Date())}>{t('Today')}</Button>
        <Button icon aria-label={t('Later')} title={t('Later')} onClick={() => shift(1)}>›</Button>
        <span className="t-section">{title}</span>
        <Segmented className="ml-auto" label={t('View')} value={mode} onChange={setMode}
          options={[{ value: 'month', label: t('Month') }, { value: 'week', label: t('Week') }]} />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-ink-3">
        {Object.keys(STATUS_CLASS).map(st => (
          <span key={st} className="flex items-center gap-1.5">
            <i className={`inline-block h-2 w-2 rounded-full ${STATUS_CLASS[st].dot}`} />
            {statusLabel[st]}
          </span>
        ))}
        <span className="hidden md:inline">{t('Drag a task to another day to move it. Click a task to change it.')}</span>
      </div>

      {/* Grid */}
      <div key={mode} className={`wf-view tl-cal grid min-h-0 flex-1 gap-px overflow-y-auto rounded-panel border border-line bg-line ${mode === 'week' ? 'tl-cal--week grid-cols-1 sm:grid-cols-7' : 'grid-cols-7'}`}>
        {days.slice(0, 7).map(({ dateStr }) => (
          <div key={`h${dateStr}`} className={`bg-ground px-2 py-1 text-center text-[11px] font-semibold text-ink-3 ${mode === 'week' ? 'hidden sm:block' : ''}`}>
            {fmt.date(dateStr, 'weekday')}
          </div>
        ))}
        {days.map(({ dateStr, otherMonth }) => {
          const isToday = dateStr === today;
          return (
            <div
              key={dateStr}
              data-drop={dragOver === dateStr || undefined}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(dateStr); }}
              onDragLeave={() => setDragOver(d => (d === dateStr ? null : d))}
              onDrop={e => drop(e, dateStr)}
              className={`tl-drop tl-reveal-host flex flex-col gap-1 bg-panel p-1.5 ${mode === 'week' ? 'min-h-[64px] sm:min-h-[92px]' : 'min-h-[72px] sm:min-h-[92px]'} ${otherMonth ? 'opacity-50' : ''}`}
              style={isToday ? { boxShadow: 'inset 0 0 0 2px var(--focus)' } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className={`t-num text-xs ${isToday ? 'font-bold text-ink' : 'font-semibold text-ink-3'}`}>
                  {mode === 'week' && <span className="sm:hidden">{fmt.date(dateStr, 'weekdayLong')} </span>}
                  {parseDate(dateStr).getDate()}
                </span>
                <button
                  type="button"
                  onClick={() => onEdit({ due_date: dateStr })}
                  className="tl-icon tl-reveal"
                  title={t('Add a task on {date}', { date: fmt.date(dateStr) })}
                  aria-label={t('Add a task on {date}', { date: fmt.date(dateStr) })}
                >
                  +
                </button>
              </div>
              {(byDate[dateStr] || []).map(task => {
                const st = effStatus(task);
                return (
                  <div
                    key={task.id}
                    data-task={task.id}
                    data-dragging={dragId === task.id || undefined}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; setDragId(task.id); }}
                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                    onClick={() => onEdit(task)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onEdit(task); }}
                    role="button"
                    tabIndex={0}
                    title={`${task.title}${task.description ? ' — ' + task.description : ''} · ${t(task.category)} · ${statusLabel[st]}`}
                    className={`tl-lift ui-focus flex cursor-pointer items-center gap-1 rounded-control px-1.5 py-1 text-[11px] font-semibold leading-tight ${STATUS_CLASS[st].chip}`}
                  >
                    <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_CLASS[st].dot}`} />
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); toggleDone(task); }}
                      className={`tl-icon !min-h-0 !min-w-0 shrink-0 !p-0 text-inherit ${mode === 'month' ? 'tl-hide-sm' : ''}`}
                      title={st === 'finished' ? t('Reopen') : t('Mark as completed')}
                      aria-label={st === 'finished' ? t('Reopen') : t('Mark as completed')}
                    >
                      ✓
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
