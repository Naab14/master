/* One date in detail: each shift's hours, what must be covered, what is
 * possible, competing demands and who is away. Says "possible", never
 * "assigned": positions are decided at the whiteboard. */
import { useMemo } from 'react';
import { Button, Pill } from '../ui';
import { useI18n } from '../i18n';
import { useWorkforce } from './store';
import { useAbsences } from './derive';
import { Sheet, STATUS_TONE } from './ui';
import { addDays, dateRange, startOfWeek } from './logic/time';
import { displayName, list, settingsOf } from './logic/model';
import { computeCoverage } from './logic/coverage';
import { shiftTimes } from './logic/schedule';
import { eventsOn } from './logic/events';

export const reqLabel = (wf, req) => req.label || wf.processes[req.processId]?.name || wf.skills[req.skillId]?.name || '—';

export function noteText(t, fmt, wf, r) {
  const out = [];
  const hours = r.req.hours ? fmt.hours(r.req.hours) : '';
  for (const n of r.notes) {
    if (n === 'shared') out.push(t('Shared role: can be combined with a line position.'));
    if (n === 'supervised') out.push(t('Includes a trainee working under supervision.'));
    if (n === 'needsSupervisor') out.push(t('A trainee is available but there is no free supervisor on this process.'));
    if (n === 'partlyAway') out.push(t('Someone counted here is away part of the shift.'));
    if (n === 'competingFlexible') out.push(t('Only possible by taking someone off a line for {hours}. When is not known.', { hours }));
    if (n === 'competingFixed') out.push(t('Only possible by taking someone off a line {from}–{to}.', { from: r.req.window?.start, to: r.req.window?.end }));
    if (n === 'certIssue') out.push(t('{n} people would qualify but have a missing or expired certificate on this date.', { n: r.certBlocked.length }));
  }
  return out;
}

export default function DaySheet({ date, onClose, onDate }) {
  const { t, fmt } = useI18n();
  const { wf, idx, can, commit } = useWorkforce();
  const absences = useAbsences();
  const settings = settingsOf(wf);
  const shiftTypes = list(wf.shiftTypes).sort((a, b) => (a.order || 0) - (b.order || 0));
  const cov = useMemo(() => shiftTypes.map(st => ({ st, c: computeCoverage(wf, idx, date, st.id, absences.all) })), [wf, idx, date, absences.all]); // eslint-disable-line react-hooks/exhaustive-deps
  const events = eventsOn(wf, date);
  const name = id => displayName(wf.people[id], settings.nicknameIn.coverage);
  const names = ids => ids.map(name).join(', ');
  const canAdjust = can('requirements.edit');

  const adjust = (r, delta, wholeWeek) => {
    const dates = wholeWeek ? dateRange(startOfWeek(date), addDays(startOfWeek(date), 6)) : [date];
    const count = Math.max(0, r.required + delta);
    commit(dates.map(d => ({ op: 'put', col: 'adjustments', id: `${r.req.id}_${d}`, value: { id: `${r.req.id}_${d}`, requirementId: r.req.id, date: d, count } })),
      wholeWeek ? t('Requirement changed for the week') : t('Requirement changed for {date}', { date: fmt.date(date) }));
  };

  return (
    <Sheet wide title={fmt.date(date, 'long')} subtitle={t('Possible coverage. Line positions are decided at the whiteboard.')} onClose={onClose}
      footer={<><Button onClick={() => onDate(addDays(date, -1))}>‹ {t('Previous day')}</Button><Button onClick={() => onDate(addDays(date, 1))}>{t('Next day')} ›</Button></>}>
      <div className="flex flex-col gap-5">
        {events.length > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-semibold">{t('Activities')} <span className="font-normal text-ink-3">· {t('reminders, no effect on staffing')}</span></h3>
            <ul className="text-sm">{events.map(e => <li key={e.id}>◆ {e.time} {e.title}</li>)}</ul>
          </section>
        )}

        <Timeline cov={cov} wf={wf} date={date} />

        {cov.every(x => !x.c.scheduled.length && !x.c.results.length) && <p className="text-sm text-ink-3">{t('Nothing is scheduled or required on this date.')}</p>}

        {cov.filter(x => x.c.scheduled.length || x.c.results.length).map(({ st, c }) => {
          const times = shiftTimes(wf, { shiftTypeId: st.id }, date);
          return (
            <section key={st.id} className="rounded-panel border border-line">
              <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                <span className="cal__dot" style={{ background: st.color }} />
                <strong className="text-sm">{st.name}</strong>
                <span className="text-xs text-ink-3">{st.start}–{st.end} · {fmt.hours(times.grossHours)}{times.grossHours !== 8 && times.overnight ? ` (${t('clock change')})` : ''}</span>
                <span className="flex-1" />
                <Pill tone={STATUS_TONE[c.level]}>{t(c.level === 'met' ? 'Covered' : c.level === 'risk' ? 'Possible, with risks' : c.level === 'short' ? 'Short' : 'Not running')}</Pill>
              </header>
              <div className="p-3">
                <p className="mb-2 text-xs text-ink-3">
                  {t('{a} of {s} scheduled people available', { a: c.available.length, s: c.scheduled.length })}
                  {c.absent.length > 0 && <> · {t('Away')}: {names(c.absent)}</>}
                </p>
                {c.results.length === 0 && <p className="text-sm text-ink-3">{t('No requirements: this shift is not running for any process.')}</p>}
                <ul className="flex flex-col gap-2">
                  {c.results.map(r => (
                    <li key={r.req.id} className="rounded-control border border-line px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm">{reqLabel(wf, r.req)}</strong>
                        <span className="text-xs text-ink-3">
                          {r.req.kind === 'task' ? t('Task') : r.req.kind === 'shared' ? t('Shared role') : t('Line position')}
                          {r.req.kind === 'task' && r.req.hours ? ` · ${fmt.hours(r.req.hours)} ${r.req.window ? `${r.req.window.start}–${r.req.window.end}` : t('any time in the shift')}` : ''}
                          {r.req.adjusted ? ` · ${t('adjusted for this day (normally {n})', { n: r.req.baseCount })}` : ''}
                        </span>
                        <span className="flex-1" />
                        {canAdjust && (
                          <span className="flex items-center gap-1">
                            <Button icon variant="ghost" aria-label={t('Need one fewer this day')} onClick={e => adjust(r, -1, e.shiftKey)}>−</Button>
                            <Button icon variant="ghost" aria-label={t('Need one more this day')} title={t('Shift-click: whole week')} onClick={e => adjust(r, 1, e.shiftKey)}>+</Button>
                          </span>
                        )}
                        <Pill tone={STATUS_TONE[r.status]}>{r.filled}{r.competing ? `+${r.competing}?` : ''} / {r.required}</Pill>
                      </div>
                      {(r.people.length > 0 || r.supervised.length > 0) && (
                        <p className="mt-1 text-xs text-ink-2">{t('Possible')}: {names(r.people)}{r.supervised.length ? ` · ${t('trainee')}: ${names(r.supervised)}` : ''}</p>
                      )}
                      <p className="text-xs text-ink-3">{t('{n} qualified and available in total', { n: r.qualified.length })}</p>
                      {noteText(t, fmt, wf, r).map(n => <p key={n} className="mt-1 text-xs font-semibold text-warn-fg">⚠ {n}</p>)}
                    </li>
                  ))}
                </ul>
                {c.spare.length > 0 && <p className="mt-2 text-xs text-ink-3">{t('Not needed for any position')}: {names(c.spare)}</p>}
              </div>
            </section>
          );
        })}
      </div>
    </Sheet>
  );
}

/* A 30-hour strip from 00:00 to 06:00 the next day, so night shifts and
 * fixed task windows are visible in clock time. */
function Timeline({ cov, wf, date }) {
  const { t } = useI18n();
  const total = 30 * 60;
  const rows = cov.filter(x => x.c.scheduled.length || x.c.results.length);
  if (!rows.length) return null;
  return (
    <section aria-label={t('Day timeline')}>
      <div className="relative h-4 text-[10px] text-ink-3">
        {[0, 6, 12, 18, 24, 30].map(h => <span key={h} className="absolute -translate-x-1/2" style={{ left: `${(h / 30) * 100}%` }}>{String(h % 24).padStart(2, '0')}</span>)}
      </div>
      <div className="flex flex-col gap-1 rounded-control bg-soft p-1">
        {rows.map(({ st, c }) => {
          const tm = shiftTimes(wf, { shiftTypeId: st.id }, date);
          return (
            <div key={st.id} className="relative h-6">
              <div className="absolute inset-y-0 flex items-center overflow-hidden rounded px-2 text-[11px] font-bold" style={{ left: `${(tm.startMin / total) * 100}%`, width: `${((tm.endMin - tm.startMin) / total) * 100}%`, background: `color-mix(in srgb, ${st.color} 30%, var(--surface-panel))`, borderLeft: `3px solid ${st.color}` }}>
                {st.name} · {c.available.length}
              </div>
              {c.results.filter(r => r.req.window).map(r => {
                const [sh, sm] = r.req.window.start.split(':').map(Number);
                const [eh, em] = r.req.window.end.split(':').map(Number);
                return <div key={r.req.id} title={reqLabel(wf, r.req)} className="absolute inset-y-1 rounded-sm" style={{ left: `${((sh * 60 + sm) / total) * 100}%`, width: `${((eh * 60 + em - sh * 60 - sm) / total) * 100}%`, background: 'var(--warn-solid)', opacity: 0.7 }} />;
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
