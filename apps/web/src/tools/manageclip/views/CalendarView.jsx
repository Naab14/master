import { useMemo, useState } from 'react';
import { fmtDate, parseDate, startOfWeek, todayStr, niceDate, effStatus, MONTHS, DOW } from '../store';

const STATUS_STYLE = {
  overdue: { dot: 'var(--coverage-red)', bg: 'color-mix(in srgb, var(--coverage-red) 12%, var(--bg-panel))' },
  current: { dot: 'var(--accent-secondary)', bg: 'color-mix(in srgb, var(--accent-secondary) 10%, var(--bg-panel))' },
  finished: { dot: 'var(--coverage-green)', bg: 'color-mix(in srgb, var(--coverage-green) 12%, var(--bg-panel))' },
};

export default function CalendarView({ state, saveTask, onEdit, flash }) {
  const [mode, setMode] = useState('month'); // 'month' | 'week'
  const [anchor, setAnchor] = useState(() => new Date());
  const [dragOver, setDragOver] = useState(null); // dateStr being hovered

  const byDate = useMemo(() => {
    const map = {};
    state.tasks.forEach(t => { (map[t.due_date] = map[t.due_date] || []).push(t); });
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
    ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
    : (() => {
        const start = startOfWeek(anchor);
        const end = new Date(start); end.setDate(end.getDate() + 6);
        return `${niceDate(fmtDate(start))} – ${niceDate(fmtDate(end))} ${end.getFullYear()}`;
      })();

  const shift = dir => {
    if (mode === 'month') setAnchor(a => new Date(a.getFullYear(), a.getMonth() + dir, 1));
    else setAnchor(a => { const d = new Date(a); d.setDate(d.getDate() + dir * 7); return d; });
  };

  const drop = (e, dateStr) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/plain');
    const task = state.tasks.find(t => t.id === id);
    if (task && task.due_date !== dateStr) {
      saveTask({ ...task, due_date: dateStr });
      flash(`Rescheduled to ${niceDate(dateStr)}`);
    }
  };

  const toggleDone = task => {
    const finished = task.status !== 'finished';
    saveTask({ ...task, status: finished ? 'finished' : 'current' });
    flash(finished ? 'Task completed ✔' : 'Task reopened');
  };

  const btn = 'rounded-lg px-2.5 py-1 text-xs font-bold';
  const btnStyle = { background: 'var(--bg-panel)', border: '1px solid var(--border)' };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} style={btnStyle} onClick={() => shift(-1)}>◀</button>
        <button className={btn} style={btnStyle} onClick={() => setAnchor(new Date())}>Today</button>
        <button className={btn} style={btnStyle} onClick={() => shift(1)}>▶</button>
        <span className="text-sm font-extrabold" style={{ fontFamily: 'var(--font-heading)' }}>{title}</span>
        <div className="ml-auto flex overflow-hidden rounded-lg" style={{ border: '1px solid var(--border)' }}>
          {['month', 'week'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-xs font-bold capitalize ${mode === m ? 'text-white' : ''}`}
              style={mode === m ? { background: 'var(--accent)' } : { background: 'var(--bg-panel)' }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {[['overdue', 'Overdue'], ['current', 'In Progress'], ['finished', 'Completed']].map(([st, label]) => (
          <span key={st} className="flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_STYLE[st].dot }} />
            {label}
          </span>
        ))}
        <span className="hidden md:inline">Drag tasks between days to reschedule · Click a task to edit</span>
      </div>

      {/* Grid */}
      <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-px overflow-y-auto rounded-xl p-px" style={{ background: 'var(--border)' }}>
        {DOW.map(d => (
          <div key={d} className="px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            {d}
          </div>
        ))}
        {days.map(({ dateStr, otherMonth }) => {
          const isToday = dateStr === todayStr();
          return (
            <div
              key={dateStr}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(dateStr); }}
              onDragLeave={() => setDragOver(d => (d === dateStr ? null : d))}
              onDrop={e => drop(e, dateStr)}
              className={`group flex min-h-[92px] flex-col gap-1 p-1.5 ${otherMonth ? 'opacity-45' : ''}`}
              style={{
                background: dragOver === dateStr ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-panel))' : 'var(--bg-panel)',
                outline: isToday ? '2px solid var(--accent)' : 'none',
                outlineOffset: '-2px',
              }}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isToday ? 'font-black' : 'font-semibold'}`}
                  style={isToday ? { color: 'var(--accent)' } : { color: 'var(--text-secondary)' }}>
                  {parseDate(dateStr).getDate()}
                </span>
                <button
                  onClick={() => onEdit({ due_date: dateStr })}
                  className="rounded px-1 text-xs opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
                  title={`Add task on ${dateStr}`}
                >
                  +
                </button>
              </div>
              {(byDate[dateStr] || []).map(task => {
                const st = effStatus(task);
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onClick={() => onEdit(task)}
                    title={`${task.title}${task.description ? ' — ' + task.description : ''} [${task.category}]`}
                    className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold leading-tight"
                    style={{ background: STATUS_STYLE[st].bg, border: '1px solid var(--border)', textDecoration: st === 'finished' ? 'line-through' : 'none' }}
                  >
                    <i className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_STYLE[st].dot }} />
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    <button
                      onClick={e => { e.stopPropagation(); toggleDone(task); }}
                      className="shrink-0 opacity-40 hover:opacity-100"
                      title={st === 'finished' ? 'Reopen' : 'Mark completed'}
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
