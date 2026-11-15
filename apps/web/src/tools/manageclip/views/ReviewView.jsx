import { useMemo, useState } from 'react';
import { reviewData, todayStr } from '../store';
import { useI18n } from '../../../i18n';
import { Button, useToast } from '../../../ui';
import { Field, Input } from '../../../workforce/ui';
import { isoWeek } from '../../../workforce/logic/time';
import * as MiniPDF from '../pdf';

export default function ReviewView({ state, saveSettings }) {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const [anchor, setAnchor] = useState(() => new Date());
  const d = useMemo(() => reviewData(state, anchor), [state, anchor]);
  const pct = d.tasks.length ? Math.round(d.completed.length / d.tasks.length * 100) : 0;
  const ratio = Math.min(d.completed.length / d.target, 1);
  const met = d.completed.length >= d.target;

  const shiftWeek = days => setAnchor(a => { const n = new Date(a); n.setDate(n.getDate() + days); return n; });

  const tiles = [
    [t('Tasks planned'), d.tasks.length, ''],
    [t('Tasks completed'), d.completed.length, 'text-ok-fg'],
    [t('Share completed'), pct + '%', ''],
    [t('Overdue, still open'), d.overdue.length, d.overdue.length ? 'text-bad-fg' : ''],
    [t('Log entries'), d.logs.length, ''],
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <Button icon aria-label={t('Earlier')} title={t('Earlier')} onClick={() => shiftWeek(-7)}>‹</Button>
        <Button onClick={() => setAnchor(new Date())}>{t('This week')}</Button>
        <Button icon aria-label={t('Later')} title={t('Later')} onClick={() => shiftWeek(7)}>›</Button>
        <span className="t-section self-center">
          {fmt.date(d.startStr)} – {fmt.date(d.endStr)} · {t('week')} {isoWeek(d.startStr)}
        </span>
        <Field label={t('Weekly target')} className="ml-auto">
          <Input
            type="number" min={1} max={999} value={d.target} className="w-20"
            onChange={e => saveSettings({ weeklyTarget: Math.max(1, parseInt(e.target.value, 10) || 20) })}
          />
        </Field>
        <Button onClick={() => { exportReviewPdf(d, t, fmt); toast(t('PDF downloaded')); }}>{t('Download as PDF')}</Button>
      </div>

      {/* Stat tiles */}
      <div key={d.startStr} className="wf-stagger grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map(([label, val, tone]) => (
          <div key={label} className="tl-panel tl-tile">
            <span className={`tl-tile__value ${tone}`}>{val}</span>
            <span className="t-label text-center">{label}</span>
          </div>
        ))}
      </div>

      {/* Target progress */}
      <div className="tl-panel flex flex-col gap-2 p-4">
        <div className="flex justify-between text-xs font-semibold">
          <span>{t('Completed against the target')}</span>
          <span className="t-num">{d.completed.length} / {d.target}{met ? ` · ${t('Target met')}` : ''}</span>
        </div>
        <div className="tl-bar" data-met={met} role="progressbar" aria-valuemin={0} aria-valuemax={d.target} aria-valuenow={Math.min(d.completed.length, d.target)}>
          <div style={{ width: `${ratio * 100}%` }} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Category breakdown */}
        <div className="tl-panel p-4">
          <h3 className="tl-heading mb-2">{t('By category')}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="t-label text-left">
                <th className="pb-1 font-semibold">{t('Category')}</th><th className="pb-1 font-semibold">{t('Done')}</th><th className="pb-1 font-semibold">{t('Scheduled')}</th><th className="pb-1 font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(d.cats).sort((a, b) => b[1].scheduled - a[1].scheduled).map(([cat, c]) => (
                <tr key={cat} className="border-t border-line">
                  <td className="py-1.5">{t(cat)}</td>
                  <td className="t-num">{c.completed}</td>
                  <td className="t-num">{c.scheduled}</td>
                  <td className="t-num">{c.scheduled ? Math.round(c.completed / c.scheduled * 100) : 0}%</td>
                </tr>
              ))}
              {Object.keys(d.cats).length === 0 && (
                <tr><td colSpan={4} className="py-2 text-xs text-ink-3">{t('No tasks planned this week.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Week's log */}
        <div className="tl-panel p-4">
          <h3 className="tl-heading mb-2">{t('Log entries')}</h3>
          {d.logs.length === 0 && (
            <p className="text-xs text-ink-3">{t('No log entries this week.')}</p>
          )}
          <div className="flex flex-col gap-1.5">
            {d.logs.map(log => (
              <div key={log.id} className="flex items-start gap-2 text-xs">
                <span className="t-num shrink-0 text-ink-3">{fmt.date(log.entry_date)}</span>
                <span className="shrink-0 font-semibold">{t(log.category)}</span>
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
function exportReviewPdf(d, t, fmt) {
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
  pdf.rect(0, 0, MiniPDF.W, 86, '#2C2B28');
  pdf.text(M, 40, `${t('Shift HQ')} - ${t('Weekly review')}`, { size: 18, bold: true, color: '#FFFFFF' });
  pdf.text(M, 62, `${t('Week')} ${isoWeek(d.startStr)}: ${d.startStr} - ${d.endStr}`, { size: 11, color: '#E4E3DF' });
  pdf.text(MiniPDF.W - M - 150, 62, t('Created {date}', { date: todayStr() }), { size: 9, color: '#B5B4AF' });
  y = 120;

  // Stat summary
  const pct = d.tasks.length ? Math.round(d.completed.length / d.tasks.length * 100) : 0;
  const stats = [
    [t('Tasks planned'), d.tasks.length],
    [t('Tasks completed'), d.completed.length],
    [t('Share completed'), pct + '%'],
    [t('Weekly target'), d.target],
    [t('Completed against the target'), `${d.completed.length} / ${d.target}`],
    [t('Overdue, still open'), d.overdue.length],
    [t('Log entries'), d.logs.length],
  ];
  pdf.text(M, y, t('Summary').toUpperCase(), { size: 12, bold: true }); y += 18;
  stats.forEach(([label, val]) => {
    pdf.text(M, y, label + ':', { size: 10 });
    pdf.text(M + 190, y, String(val), { size: 10, bold: true });
    y += 15;
  });
  y += 10;

  // Category breakdown
  pdf.text(M, y, t('By category').toUpperCase(), { size: 12, bold: true }); y += 18;
  pdf.text(M, y, t('Category'), { size: 9, bold: true });
  pdf.text(M + 180, y, t('Done'), { size: 9, bold: true });
  pdf.text(M + 240, y, t('Scheduled'), { size: 9, bold: true });
  pdf.text(M + 310, y, '%', { size: 9, bold: true });
  y += 6; pdf.line(M, y, MiniPDF.W - M, y, '#8E8D88', 0.8); y += 14;
  const cats = Object.entries(d.cats);
  if (!cats.length) { pdf.text(M, y, t('No tasks planned this week.'), { size: 10 }); y += 15; }
  cats.forEach(([cat, c]) => {
    ensureRoom(15);
    pdf.text(M, y, t(cat), { size: 10 });
    pdf.text(M + 180, y, String(c.completed), { size: 10 });
    pdf.text(M + 240, y, String(c.scheduled), { size: 10 });
    pdf.text(M + 310, y, (c.scheduled ? Math.round(c.completed / c.scheduled * 100) : 0) + '%', { size: 10 });
    y += 15;
  });
  y += 10;

  // Completed tasks
  ensureRoom(40);
  pdf.text(M, y, t('Tasks completed').toUpperCase(), { size: 12, bold: true }); y += 18;
  if (!d.completed.length) { pdf.text(M, y, t('None completed this week.'), { size: 10 }); y += 15; }
  d.completed.forEach(task => {
    ensureRoom(15);
    pdf.text(M, y, `[x] ${task.due_date}  ${task.title} (${t(task.category)})`, { size: 10 });
    y += 15;
  });
  y += 10;

  // Shift log
  ensureRoom(40);
  pdf.text(M, y, t('Log entries').toUpperCase(), { size: 12, bold: true }); y += 18;
  if (!d.logs.length) { pdf.text(M, y, t('No log entries this week.'), { size: 10 }); y += 15; }
  d.logs.forEach(log => {
    const line = `${log.entry_date} [${t(log.category)}] ${log.content}`;
    // naive wrap at ~95 chars
    for (let i = 0; i < line.length; i += 95) {
      ensureRoom(13);
      pdf.text(M + (i ? 14 : 0), y, line.slice(i, i + 95), { size: 9 });
      y += 13;
    }
    y += 3;
  });

  pdf.download(`${fmt.locale === 'sv-SE' ? 'veckooversikt' : 'weekly-review'}-${d.startStr}.pdf`);
}
