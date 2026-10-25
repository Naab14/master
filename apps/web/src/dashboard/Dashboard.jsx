import { useEffect, useMemo, useState } from 'react';
import { getFullState } from '../api';
import { getAllCoverageForWeek } from '../tools/vacation/coverage';
import { PROCESSES } from '../tools/vacation/data';

/* ── Date helpers ─────────────────────────────────────────────────────────── */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/* Effective ManageClip task status — same rule as the Shift HQ tool. */
function effStatus(task, today) {
  if (task.status === 'finished') return 'finished';
  return task.due_date < today ? 'overdue' : 'current';
}

const LEVEL_COLORS = {
  green: 'var(--coverage-green)',
  yellow: 'var(--coverage-yellow)',
  red: 'var(--coverage-red)',
};

/* ── Card chrome ──────────────────────────────────────────────────────────── */
function Card({ title, subtitle, onOpen, children }) {
  return (
    <section
      className="flex flex-col gap-3 p-5"
      style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)', boxShadow: 'var(--shadow-lg)' }}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2>
          {subtitle && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
        </div>
        <button
          onClick={onOpen}
          className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Open →
        </button>
      </header>
      {children}
    </section>
  );
}

function Stat({ value, label, tone }) {
  return (
    <div className="flex flex-col items-center rounded-lg px-3 py-2" style={{ background: 'var(--bg-secondary)' }}>
      <span className="text-2xl font-black leading-tight" style={tone ? { color: tone } : undefined}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

/* ── Dashboard ────────────────────────────────────────────────────────────── */
export default function Dashboard({ onNavigate }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const today = todayStr();
  const week = isoWeek();

  useEffect(() => {
    let cancelled = false;
    getFullState()
      .then(s => { if (!cancelled) setState(s); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const mc = state?.manageclip;
  const shiftStats = useMemo(() => {
    if (!mc) return null;
    const tasks = mc.tasks || [];
    const dueToday = tasks.filter(t => t.due_date === today && t.status !== 'finished');
    const overdue = tasks.filter(t => effStatus(t, today) === 'overdue');
    const doneToday = tasks.filter(t => t.due_date === today && t.status === 'finished');
    return { dueToday, overdue, doneToday };
  }, [mc, today]);

  const vac = state?.vacation;
  const vacStats = useMemo(() => {
    if (!vac || !Array.isArray(vac.operators)) return null;
    const { operators, vacationBlocks = [], demand = {}, settings = {} } = vac;
    const shiftMode = settings.shiftMode || 'combined';
    const shifts = shiftMode === 'separate' ? ['S1', 'S2'] : [null];
    const rank = { green: 0, yellow: 1, red: 2 };
    let worst = 'green';
    const perProcess = {};
    for (const shift of shifts) {
      const cov = getAllCoverageForWeek(operators, vacationBlocks, demand, week, shiftMode, shift, null);
      for (const proc of PROCESSES) {
        const level = cov[proc]?.level || 'green';
        if (rank[level] > rank[worst]) worst = level;
        if (!perProcess[proc] || rank[level] > rank[perProcess[proc]]) perProcess[proc] = level;
      }
    }
    const out = operators.filter(op =>
      vacationBlocks.some(b => b.operatorId === op.id && b.status === 'approved' && week >= b.startWeek && week <= b.endWeek));
    return { worst, perProcess, out };
  }, [vac, week]);

  const boardStats = useMemo(() => {
    if (!state?.boards) return null;
    const counts = {};
    let total = 0;
    for (const board of state.boards) {
      const statusCol = (board.columns || []).find(c => c.type === 'status' && /status/i.test(c.title)) ||
        (board.columns || []).find(c => c.type === 'status');
      for (const g of board.groups || []) {
        for (const item of g.items || []) {
          total++;
          const label = (statusCol && item.values?.[statusCol.id]) || 'No status';
          counts[label] = (counts[label] || 0) + 1;
        }
      }
    }
    return { counts, total, boards: state.boards.length };
  }, [state]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-3xl font-black tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}.
        </h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · week {week}
        </p>

        {error && (
          <div className="mb-6 rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--pending-bg)', border: '1px solid var(--pending-border)' }}>
            Can't reach the backend ({error}). Start it with <code className="font-mono">node backend/server.js</code> — the tools still work offline.
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {/* ── Shift HQ ────────────────────────────────────────────────── */}
          <Card title="Shift HQ" subtitle="Today on shift" onOpen={() => onNavigate('shifts')}>
            {shiftStats ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Stat value={shiftStats.dueToday.length} label="Due today" />
                  <Stat value={shiftStats.doneToday.length} label="Done today" tone="var(--coverage-green)" />
                  <Stat value={shiftStats.overdue.length} label="Overdue" tone={shiftStats.overdue.length ? 'var(--coverage-red)' : undefined} />
                </div>
                <ul className="flex flex-col gap-1 text-sm">
                  {shiftStats.dueToday.slice(0, 4).map(t => (
                    <li key={t.id} className="truncate">
                      <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: 'var(--accent-secondary)' }} />
                      {t.title}
                    </li>
                  ))}
                  {shiftStats.dueToday.length === 0 && (
                    <li style={{ color: 'var(--text-secondary)' }}>Nothing due today 🎉</li>
                  )}
                </ul>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No shift data yet.</p>
            )}
          </Card>

          {/* ── Vacations / coverage ────────────────────────────────────── */}
          <Card title="Vacations" subtitle={`Coverage · week ${week}`} onOpen={() => onNavigate('vacation')}>
            {vacStats ? (
              <>
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: LEVEL_COLORS[vacStats.worst] }} />
                  {vacStats.worst === 'green' ? 'All processes covered' : vacStats.worst === 'yellow' ? 'Coverage tight' : 'Coverage gap!'}
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(vacStats.perProcess).map(([proc, level]) => (
                    <span key={proc} className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: LEVEL_COLORS[level] }}>
                      {proc}
                    </span>
                  ))}
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {vacStats.out.length
                    ? `Out this week: ${vacStats.out.map(o => o.name.split(' ')[0]).join(', ')}`
                    : 'Nobody on vacation this week.'}
                </p>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Open the vacation planner once to set up the workspace.
              </p>
            )}
          </Card>

          {/* ── Boards ──────────────────────────────────────────────────── */}
          <Card title="Boards" subtitle="Work items" onOpen={() => onNavigate('boards')}>
            {boardStats ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Stat value={boardStats.total} label={`item${boardStats.total === 1 ? '' : 's'}`} />
                  <Stat value={boardStats.boards} label={`board${boardStats.boards === 1 ? '' : 's'}`} />
                </div>
                <ul className="flex flex-col gap-1 text-sm">
                  {Object.entries(boardStats.counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, n]) => (
                    <li key={label} className="flex justify-between">
                      <span className="truncate">{label}</span>
                      <span className="font-bold">{n}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No boards yet.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
