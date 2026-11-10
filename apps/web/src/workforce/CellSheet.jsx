/* One person on one date: the shift, changes to it, and attendance. */
import { useMemo, useState } from 'react';
import { Button, Pill } from '../ui';
import { useI18n } from '../i18n';
import { useWorkforce } from './store-context';
import { useAbsences, useReasons } from './derive';
import { Confirm, Field, Input, Select, Sheet } from './ui';
import EntryForm from './EntryForm';
import { dateRange } from './logic/time';
import { list } from './logic/model';
import { assignPatternOps, clearOverrideOps, overrideOps, resolveShift, shiftTimes } from './logic/schedule';
import { absenceImpact } from './logic/coverage';

export default function CellSheet({ personId, date, onClose }) {
  const { t, fmt } = useI18n();
  const { wf, idx, can, commit, entries } = useWorkforce();
  const reasons = useReasons();
  const absences = useAbsences();
  const person = wf.people[personId];
  const r = resolveShift(wf, idx, personId, date);
  const times = r.shiftTypeId ? shiftTimes(wf, r, date) : null;
  const canEdit = can('schedule.edit');
  const canAttend = can('attendance.edit');
  const [onward, setOnward] = useState(null); // { patternId, offset }
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmOnward, setConfirmOnward] = useState(false);
  const mine = entries.filter(e => e.personId === personId && e.date === date);
  const shiftTypes = list(wf.shiftTypes).sort((a, b) => (a.order || 0) - (b.order || 0));
  const impact = useMemo(() => absenceImpact(wf, idx, personId, [date], absences.all.filter(a => a.personId !== personId || a.date !== date)), [wf, idx, personId, date, absences.all]);
  if (!person) return null;

  const source = { override: t('Changed for this day'), person: t('Own pattern'), team: t('Team pattern') }[r.source] || t('Not scheduled');
  const saveEntry = (base, until, id) => {
    const days = until && until > date ? dateRange(date, until).filter(d => resolveShift(wf, idx, personId, d).shiftTypeId) : [date];
    const ops = days.map((d, i) => ({ op: 'put', col: 'entries', id: i === 0 ? id : `${id}_${d}`, value: { ...base, id: i === 0 ? id : `${id}_${d}`, date: d } }));
    commit(ops, t('Attendance saved for {name}', { name: person.name }));
    setAdding(false); setEditing(null);
  };

  return (
    <Sheet title={person.name} subtitle={fmt.date(date, 'long')} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <section>
          <div className="mb-2 flex items-center gap-2">
            <strong className="text-sm">{times ? `${times.type.name} · ${r.start || times.type.start}–${r.end || times.type.end}` : t('Day off')}</strong>
            <Pill tone="idle">{source}</Pill>
          </div>
          {times && <p className="text-xs text-ink-3">{t('{h} paid hours', { h: fmt.num(times.paidHours) })}{times.overnight ? ` · ${t('ends the next day')}` : ''}</p>}
          {canEdit && (
            <>
              <p className="mb-1 mt-3 text-xs font-semibold text-ink-3">{t('Change this day only')}</p>
              <div className="flex flex-wrap gap-2">
                {shiftTypes.map(st => (
                  <Button key={st.id} variant={r.shiftTypeId === st.id ? 'primary' : 'secondary'} onClick={() => commit(overrideOps(personId, date, st.id), t('{name}: {shift} on {date}', { name: person.name, shift: st.name, date: fmt.date(date) }))}>
                    {st.code} · {st.name}
                  </Button>
                ))}
                <Button variant={!r.shiftTypeId ? 'primary' : 'secondary'} onClick={() => commit(overrideOps(personId, date, null), t('{name}: {shift} on {date}', { name: person.name, shift: t('Day off'), date: fmt.date(date) }))}>{t('Day off')}</Button>
                {r.source === 'override' && <Button variant="ghost" onClick={() => commit(clearOverrideOps(personId, date), t('{name}: back to pattern on {date}', { name: person.name, date: fmt.date(date) }))}>{t('Back to pattern')}</Button>}
              </div>
              <p className="mb-1 mt-4 text-xs font-semibold text-ink-3">{t('Change from this date onward')}</p>
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t('Pattern')}>
                  <Select value={onward?.patternId || ''} onChange={e => setOnward({ patternId: e.target.value, offset: 0 })}>
                    <option value="">{t('Choose…')}</option>
                    {list(wf.patterns).filter(p => !list(wf.patterns).some(q => q.supersedes === p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    <option value="__team">{t('Follow the team again')}</option>
                  </Select>
                </Field>
                {onward?.patternId && onward.patternId !== '__team' && (
                  <Field label={t('Start at cycle day')}>
                    <Input type="number" className="w-24" min="1" max={wf.patterns[onward.patternId]?.cycle.length || 1} value={(onward.offset || 0) + 1}
                      onChange={e => setOnward({ ...onward, offset: Math.max(0, Number(e.target.value) - 1) })} />
                  </Field>
                )}
                <Button disabled={!onward?.patternId} onClick={() => setConfirmOnward(true)}>{t('Apply from {date}', { date: fmt.date(date) })}</Button>
              </div>
            </>
          )}
        </section>

        {times && impact.days[0]?.gaps.length > 0 && (
          <section className="rounded-control bg-warn-bg px-3 py-2 text-sm text-warn-fg">
            <strong>{t('If {name} is away this day:', { name: person.name })}</strong>
            <ul className="mt-1 list-disc pl-5">
              {impact.days[0].gaps.map(g => (
                <li key={g.reqId}>
                  {g.req.label || wf.processes[g.req.processId]?.name || wf.skills[g.req.skillId]?.name}: {g.filled}/{g.required}
                  {' · '}{g.replacements.length ? t('{n} possible replacements ({m} without a new gap)', { n: g.replacements.length, m: g.replacements.filter(x => !x.opensGap).length }) : t('no qualified replacement')}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold">{t('Attendance')}</h3>
          {mine.length === 0 && !adding && <p className="text-sm text-ink-3">{t('Nothing recorded. The schedule counts as worked.')}</p>}
          <ul className="flex flex-col gap-2">
            {mine.map(e => {
              const reason = reasons.find(x => x.id === e.reasonId);
              const what = e.fullDay ? t('Whole shift') : e.start && e.end ? `${e.start}–${e.end}` : e.hours ? fmt.hours(e.hours) : null;
              return editing === e.id ? (
                <li key={e.id} className="rounded-control border border-line p-3"><EntryForm personId={personId} date={date} entry={e} onSave={saveEntry} onCancel={() => setEditing(null)} /></li>
              ) : (
                <li key={e.id} className="flex items-center gap-2 rounded-control border border-line px-3 py-2 text-sm">
                  <span className="flex-1">
                    <strong>{fmt.name(reason?.name) || e.reasonId}</strong>{what ? ` · ${what}` : ''}{e.tentative ? ` · ${t('requested')}` : ''}
                    {!what && reason?.category !== 'present' && <Pill tone="bad" className="ml-2">{t('Incomplete')}</Pill>}
                    {e.comment && <span className="block text-xs text-ink-3">“{e.comment}”</span>}
                    {e._by && <span className="block text-[11px] text-ink-3">{t('Last changed by {who}, {when}', { who: e._by, when: fmt.stamp(Date.parse(e._at)) })}</span>}
                  </span>
                  {canAttend && <Button variant="ghost" onClick={() => setEditing(e.id)}>{t('Edit')}</Button>}
                  {canAttend && <Button variant="ghost" aria-label={t('Remove')} onClick={() => commit([{ op: 'del', col: 'entries', id: e.id }], t('Attendance entry removed'))}>✕</Button>}
                </li>
              );
            })}
          </ul>
          {canAttend && (adding
            ? <div className="mt-2 rounded-control border border-line p-3"><EntryForm personId={personId} date={date} allowRange onSave={saveEntry} onCancel={() => setAdding(false)} /></div>
            : <Button className="mt-2" onClick={() => setAdding(true)}>+ {t('Record attendance or absence')}</Button>)}
        </section>

        <Button variant="ghost" onClick={() => { onClose(); window.location.hash = `#/people/${personId}`; }}>{t('Open profile')} →</Button>
      </div>

      {confirmOnward && (
        <Confirm
          title={t('Change the schedule from {date}?', { date: fmt.date(date) })}
          body={t('{name} follows the new pattern on every day from {date} ({weekday}). Earlier dates keep the schedule they had.', { name: person.name, date: fmt.date(date), weekday: fmt.date(date, 'weekdayLong') })}
          confirmLabel={t('Change from this date')}
          onCancel={() => setConfirmOnward(false)}
          onConfirm={() => {
            const patternId = onward.patternId === '__team' ? null : onward.patternId;
            // Offset so the chosen cycle day lands on this date.
            const p = patternId && wf.patterns[patternId];
            let offset = 0;
            if (p) {
              const n = p.cycle.length;
              const dayIndex = Math.round((Date.parse(date) - Date.parse(p.anchor)) / 86400000);
              offset = ((((onward.offset || 0) - dayIndex) % n) + n) % n;
            }
            commit(assignPatternOps(wf, 'person', personId, patternId, date, offset), t('{name}: new pattern from {date}', { name: person.name, date: fmt.date(date) }));
            setConfirmOnward(false); setOnward(null);
          }}
        />
      )}
    </Sheet>
  );
}

