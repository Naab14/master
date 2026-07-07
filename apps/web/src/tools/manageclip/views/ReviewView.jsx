import { useMemo, useState } from 'react';
import { reviewData, niceDate, todayStr } from '../store';
import * as MiniPDF from '../pdf';

export default function ReviewView({ state, saveSettings, flash }) {
  const [anchor, setAnchor] = useState(() => new Date());
  const d = useMemo(() => reviewData(state, anchor), [state, anchor]);
  const pct = d.tasks.length ? Math.round(d.completed.length / d.tasks.length * 100) : 0;
  const ratio = Math.min(d.completed.length / d.target, 1);
  const met = d.completed.length >= d.target;

  const shiftWeek = days => setAnchor(a => { const n = new Date(a); n.setDate(n.getDate() + days); return n; });

  const tiles = [
    ['Scheduled', d.tasks.length, null],
    ['Completed', d.completed.length, 'var(--coverage-green)'],
    ['Completion', pct + '%', 'var(--accent)'],
    ['Overdue Open', d.overdue.length, d.overdue.length ? 'var(--coverage-red)' : null],
    ['Log Entries', d.logs.length, null],
  ];

  const btn = 'rounded-lg px-2.5 py-1 text-xs font-bold';
  const btnStyle = { background: 'var(--bg-panel)', border: '1px solid var(--border)' };
  const panel = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)' };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} style={btnStyle} onClick={() => shiftWeek(-7)}>◀</button>
        <button className={btn} style={btnStyle} onClick={() => setAnchor(new Date())}>This Week</button>
        <button className={btn} style={btnStyle} onClick={() => shiftWeek(7)}>▶</button>
        <span className="text-sm font-extrabold" style={{ fontFamily: 'var(--font-heading)' }}>
          {niceDate(d.startStr)} – {niceDate(d.endStr)}
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs font-bold">
          Weekly target
          <input
            type="number" min={1} max={999} value={d.target}
            className="w-16 rounded-lg px-2 py-1 text-sm"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            onChange={e => saveSettings({ weeklyTarget: Math.max(1, parseInt(e.target.value, 10) || 20) })}
          />
        </span>
        <button className="rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{ background: 'var(--accent)' }}
          onClick={() => { exportReviewPdf(d); flash('PDF exported'); }}>
          Export to PDF
        </button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map(([label, val, tone]) => (
          <div key={label} className="flex flex-col items-center px-3 py-3" style={panel}>
            <span className="text-2xl font-black" style={tone ? { color: tone } : undefined}>{val}</span>
            <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Target progress */}
      <div className="flex flex-col gap-2 p-4" style={panel}>
        <div className="flex justify-between text-xs font-bold">
          <span>Completed vs Target</span>
          <span>{d.completed.length} / {d.target}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-secondary)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${ratio * 100}%`, background: met ? 'var(--coverage-green)' : 'var(--accent)' }} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Category breakdown */}
        <div className="p-4" style={panel}>
          <h3 className="mb-2 text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Category Breakdown</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                <th className="pb-1">Category</th><th className="pb-1">Done</th><th className="pb-1">Planned</th><th className="pb-1">%</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(d.cats).sort((a, b) => b[1].scheduled - a[1].scheduled).map(([cat, c]) => (
                <tr key={cat} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-1.5">{cat}</td>
                  <td>{c.completed}</td>
                  <td>{c.scheduled}</td>
                  <td>{c.scheduled ? Math.round(c.completed / c.scheduled * 100) : 0}%</td>
                </tr>
              ))}
              {Object.keys(d.cats).length === 0 && (
                <tr><td colSpan={4} className="py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  No tasks scheduled this week.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Week's log */}
        <div className="p-4" style={panel}>
          <h3 className="mb-2 text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Shift Log Entries</h3>
          {d.logs.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No log entries this week.</p>
          )}
          <div className="flex flex-col gap-1.5">
            {d.logs.map(log => (
              <div key={log.id} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 font-mono" style={{ color: 'var(--text-secondary)' }}>{log.entry_date}</span>
                <span className="shrink-0 font-bold">{log.category}</span>
                <span className="min-w-0 flex-1">{log.content}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── PDF export — the same MiniPDF report the standalone tool produced ──── */
function exportReviewPdf(d) {
  const pdf = MiniPDF.doc();
  const M = 48; // page margin
  let y = 0;

  function ensureRoom(needed) {
    if (y + needed > MiniPDF.H - M) {
      pdf.addPage();
      y = M;
    }
  }

  // Header band
  pdf.rect(0, 0, MiniPDF.W, 86, '#0d1512');
  pdf.rect(0, 86, MiniPDF.W, 3, '#00FFB4');
  pdf.text(M, 40, 'SHIFT_HQ // WEEKLY REVIEW', { size: 18, bold: true, color: '#00FFB4' });
  pdf.text(M, 62, `Week of ${d.startStr} to ${d.endStr}`, { size: 11, color: '#d7e6df' });
  pdf.text(MiniPDF.W - M - 150, 62, `Generated ${todayStr()}`, { size: 9, color: '#7d948a' });
  y = 120;

  // Stat summary
  const pct = d.tasks.length ? Math.round(d.completed.length / d.tasks.length * 100) : 0;
  const stats = [
    ['Tasks scheduled', d.tasks.length],
    ['Tasks completed', d.completed.length],
    ['Completion rate', pct + '%'],
    ['Weekly target', d.target],
    ['Target progress', `${d.completed.length} / ${d.target}`],
    ['Overdue open', d.overdue.length],
    ['Log entries', d.logs.length],
  ];
  pdf.text(M, y, 'SUMMARY', { size: 12, bold: true }); y += 18;
  stats.forEach(([label, val]) => {
    pdf.text(M, y, label + ':', { size: 10 });
    pdf.text(M + 140, y, String(val), { size: 10, bold: true });
    y += 15;
  });
  y += 10;

  // Category breakdown
  pdf.text(M, y, 'CATEGORY BREAKDOWN', { size: 12, bold: true }); y += 18;
  pdf.text(M, y, 'Category', { size: 9, bold: true });
  pdf.text(M + 180, y, 'Done', { size: 9, bold: true });
  pdf.text(M + 240, y, 'Planned', { size: 9, bold: true });
  pdf.text(M + 310, y, 'Rate', { size: 9, bold: true });
  y += 6; pdf.line(M, y, MiniPDF.W - M, y, '#00FFB4', 0.8); y += 14;
  const cats = Object.entries(d.cats);
  if (!cats.length) { pdf.text(M, y, 'No tasks scheduled this week.', { size: 10 }); y += 15; }
  cats.forEach(([cat, c]) => {
    ensureRoom(15);
    pdf.text(M, y, cat, { size: 10 });
    pdf.text(M + 180, y, String(c.completed), { size: 10 });
    pdf.text(M + 240, y, String(c.scheduled), { size: 10 });
    pdf.text(M + 310, y, (c.scheduled ? Math.round(c.completed / c.scheduled * 100) : 0) + '%', { size: 10 });
    y += 15;
  });
  y += 10;

  // Completed tasks
  ensureRoom(40);
  pdf.text(M, y, 'COMPLETED TASKS', { size: 12, bold: true }); y += 18;
  if (!d.completed.length) { pdf.text(M, y, 'None completed this week.', { size: 10 }); y += 15; }
  d.completed.forEach(t => {
    ensureRoom(15);
    pdf.text(M, y, `[x] ${t.due_date}  ${t.title} (${t.category})`, { size: 10 });
    y += 15;
  });
  y += 10;

  // Shift log
  ensureRoom(40);
  pdf.text(M, y, 'SHIFT LOG', { size: 12, bold: true }); y += 18;
  if (!d.logs.length) { pdf.text(M, y, 'No log entries this week.', { size: 10 }); y += 15; }
  d.logs.forEach(log => {
    const line = `${log.entry_date} [${log.category}] ${log.content}`;
    // naive wrap at ~95 chars
    for (let i = 0; i < line.length; i += 95) {
      ensureRoom(13);
      pdf.text(M + (i ? 14 : 0), y, line.slice(i, i + 95), { size: 9 });
      y += 13;
    }
    y += 3;
  });

  pdf.download(`weekly-review-${d.startStr}.pdf`);
}
