/* Dashboard strip for planning: today's possible coverage, who is away,
 * what needs a decision, upcoming activities and coverage warnings. */
import { useMemo } from 'react';
import { Pill } from '../ui';
import { useI18n } from '../i18n';
import { useWorkforce } from './store-context';
import { useAbsences } from './derive';
import { STATUS_TONE } from './prefs';
import { addDays, dateRange, todayIn } from './logic/time';
import { displayName, list, settingsOf } from './logic/model';
import { computeCoverage } from './logic/coverage';
import { upcomingEvents } from './logic/events';
import { expiringCerts } from './logic/training';
import { reqLabel } from './labels';

export default function PlanningCards({ onNavigate }) {
  const { t, fmt } = useI18n();
  const ctx = useWorkforce();
  const absences = useAbsences();
  const { wf, idx, phase, me, entries } = ctx;
  const today = todayIn();
  const data = useMemo(() => {
    if (phase !== 'ready' || !list(wf.people).length) return null;
    const shiftTypes = list(wf.shiftTypes).sort((a, b) => (a.order || 0) - (b.order || 0));
    const now = shiftTypes.map(st => ({ st, c: computeCoverage(wf, idx, today, st.id, absences.all) })).filter(x => x.c.results.length || x.c.scheduled.length);
    const warnings = [];
    for (const d of dateRange(addDays(today, 1), addDays(today, 14))) {
      for (const st of shiftTypes) {
        const c = computeCoverage(wf, idx, d, st.id, absences.all);
        if (c.level === 'short') warnings.push({ d, st, reqs: c.results.filter(r => r.status === 'short') });
      }
    }
    const away = [...new Set(absences.all.filter(a => a.date === today && a.fullDay && !a.tentative).map(a => a.personId))];
    const pendingMoves = list(wf.memberships).filter(m => m.status === 'pending');
    const requested = entries.filter(e => e.tentative && e.date >= today);
    return { now, warnings, away, pendingMoves, requested, events: upcomingEvents(wf, today), certs: expiringCerts(wf, today, 30) };
  }, [wf, idx, phase, today, absences.all, entries]);

  if (!me?.permissions.includes('workforce.view') || !data) return null;
  const nick = settingsOf(wf).nicknameIn.coverage;
  const name = id => displayName(wf.people[id], nick);
  const levelText = { met: t('Covered'), risk: t('Possible, with risks'), short: t('Short'), none: t('Not running') };
  const needs = data.pendingMoves.length + new Set(data.requested.map(e => e.personId)).size;
  const card = 'flex flex-col gap-2 rounded-panel border border-line bg-panel p-4';

  return (
    <div className="wf-stagger mb-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
      <section className={card}>
        <header className="flex items-center justify-between gap-2">
          <h2 className="t-section">{t('Coverage today')}</h2>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={() => onNavigate('schedule')}>{t('Schedule')} →</button>
        </header>
        {data.now.length === 0 && <p className="text-sm text-ink-3">{t('Nothing is scheduled or required on this date.')}</p>}
        {data.now.map(({ st, c }) => (
          <div key={st.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="cal__dot" style={{ background: st.color }} /><strong>{st.name}</strong>
            <span className="text-ink-3">{t('{a} of {s} scheduled people available', { a: c.available.length, s: c.scheduled.length })}</span>
            <span className="flex-1" /><Pill tone={STATUS_TONE[c.level]}>{levelText[c.level]}</Pill>
            {c.results.filter(r => r.status === 'short').map(r => <span key={r.req.id} className="w-full text-xs font-semibold text-bad-fg">{reqLabel(wf, r.req)}: {r.filled}/{r.required}</span>)}
          </div>
        ))}
        <p className="text-xs text-ink-3">{data.away.length ? `${t('Away')}: ${data.away.map(name).join(', ')}` : t('Nobody is recorded as away today.')}</p>
      </section>

      <section className={card}>
        <h2 className="t-section">{t('Coming up')}</h2>
        {data.events.length === 0 && <p className="text-sm text-ink-3">{t('No activities in the next two weeks. Add them in Setup.')}</p>}
        <ul className="flex flex-col gap-1 text-sm">
          {data.events.map(e => <li key={e.id + e.on} className="flex gap-2"><span className="w-24 shrink-0 text-ink-3">{e.on === today ? t('Today') : fmt.date(e.on)} {e.time}</span><span className="font-semibold">{e.title}</span></li>)}
        </ul>
        <p className="mt-auto text-xs text-ink-3">{t('reminders, no effect on staffing')}</p>
      </section>

      <section className={card}>
        <h2 className="t-section">{t('Needs attention')}</h2>
        {data.warnings.length === 0 && needs === 0 && data.certs.length === 0 && <p className="text-sm text-ink-3">{t('Nothing right now.')}</p>}
        <ul className="flex flex-col gap-1 text-sm">
          {data.warnings.slice(0, 5).map(w => (
            <li key={w.d + w.st.id}><Pill tone="bad" className="mr-2">{fmt.date(w.d)} {w.st.code}</Pill>{w.reqs.map(r => `${reqLabel(wf, r.req)} ${r.filled}/${r.required}`).join(', ')}</li>
          ))}
          {data.warnings.length > 5 && <li className="text-xs text-ink-3">{t('…and {n} more short shifts in the next two weeks', { n: data.warnings.length - 5 })}</li>}
          {data.pendingMoves.length > 0 && <li><Pill tone="warn" className="mr-2">{data.pendingMoves.length}</Pill>{t('team moves waiting for a manager')}</li>}
          {data.requested.length > 0 && <li><Pill tone="pending" className="mr-2">{new Set(data.requested.map(e => e.personId)).size}</Pill>{t('people with requested leave to decide')}</li>}
          {data.certs.slice(0, 3).map(c => <li key={c.personId + c.certId}><Pill tone={c.expired ? 'bad' : 'warn'} className="mr-2">{fmt.date(c.expires)}</Pill>{name(c.personId)} · {wf.certs[c.certId].name}</li>)}
        </ul>
      </section>
    </div>
  );
}
