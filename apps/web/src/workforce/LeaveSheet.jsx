/* Plan leave for a date range and see what it does to coverage before
 * deciding: new gaps, who is qualified to step in, and whether moving them
 * opens a gap on their own shift. The manager decides; nothing is blocked. */
import { useMemo, useState } from 'react';
import { Button, Checkbox, Pill } from '../ui';
import { useI18n } from '../i18n';
import { useWorkforce } from './store-context';
import { useAbsences, useReasons } from './derive';
import { Field, Input, Select, Sheet } from './ui';
import { addDays, dateRange, todayIn } from './logic/time';
import { displayName, list, settingsOf, uid } from './logic/model';
import { absenceImpact, certIssues } from './logic/coverage';
import { resolveShift } from './logic/schedule';
import { reqLabel } from './labels';

export default function LeaveSheet({ personId: initialPerson = '', date, onClose }) {
  const { t, fmt } = useI18n();
  const { wf, idx, can, commit } = useWorkforce();
  const reasons = useReasons().filter(r => ['vacation', 'absence', 'sick'].includes(r.category));
  const absences = useAbsences();
  const start = date || todayIn();
  const [f, setF] = useState({ personId: initialPerson, from: start, to: addDays(start, 4), reasonId: reasons.find(r => r.category === 'vacation')?.id || reasons[0]?.id, tentative: false, comment: '' });
  const set = patch => setF(prev => ({ ...prev, ...patch }));
  const nick = settingsOf(wf).nicknameIn.coverage;
  const name = id => displayName(wf.people[id], nick);
  const valid = f.personId && f.from && f.to && f.to >= f.from && dateRange(f.from, f.to).length <= 120;
  const days = useMemo(() => (valid ? dateRange(f.from, f.to) : []), [valid, f.from, f.to]);
  const workDays = useMemo(() => days.filter(d => resolveShift(wf, idx, f.personId, d).shiftTypeId), [days, wf, idx, f.personId]);
  const impact = useMemo(() => (valid ? absenceImpact(wf, idx, f.personId, days, absences.all.filter(a => a.personId !== f.personId)) : null), [valid, wf, idx, f.personId, days, absences.all]);
  const already = absences.all.filter(a => a.personId === f.personId && days.includes(a.date) && a.fullDay);

  const save = () => {
    const base = uid('en_');
    const ops = workDays.map(d => ({ op: 'put', col: 'entries', id: `${base}_${d}`, value: { id: `${base}_${d}`, personId: f.personId, date: d, reasonId: f.reasonId, fullDay: true, hours: null, start: null, end: null, comment: f.comment.trim(), tentative: f.tentative } }));
    commit(ops, t('{name}: leave {from}–{to} ({n} shifts)', { name: wf.people[f.personId].name, from: fmt.date(f.from), to: fmt.date(f.to), n: ops.length }));
    onClose();
  };

  return (
    <Sheet wide title={t('Plan leave')} subtitle={t('See the effect on coverage before you decide')} onClose={onClose}
      footer={can('attendance.edit') && <><Button onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" disabled={!valid || !workDays.length} onClick={save}>{f.tentative ? t('Save as requested') : t('Save leave')}</Button></>}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t('Person')}><Select value={f.personId} onChange={e => set({ personId: e.target.value })}><option value="">{t('Choose…')}</option>{list(wf.people).sort((a, b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label={t('From')}><Input type="date" value={f.from} onChange={e => set({ from: e.target.value })} /></Field>
          <Field label={t('To')}><Input type="date" value={f.to} min={f.from} onChange={e => set({ to: e.target.value })} /></Field>
          <Field label={t('Status')}><Select value={f.reasonId} onChange={e => set({ reasonId: e.target.value })}>{reasons.map(r => <option key={r.id} value={r.id}>{fmt.name(r.name)}</option>)}</Select></Field>
        </div>
        <Checkbox checked={f.tentative} onChange={e => set({ tentative: e.target.checked })}>{t('Requested, not decided (does not reduce coverage)')}</Checkbox>
        <Field label={t('Comment')}><Input value={f.comment} onChange={e => set({ comment: e.target.value })} /></Field>

        {impact && (
          <section>
            <h3 className="mb-1 text-sm font-semibold">{t('Effect on coverage')}</h3>
            <p className="mb-2 text-xs text-ink-3">
              {t('{n} scheduled shifts in the period.', { n: workDays.length })}
              {already.length > 0 && ` ${t('{n} of the days already have an absence recorded.', { n: already.length })}`}
            </p>
            {workDays.length > 0 && impact.gapDays === 0 && <p className="rounded-control bg-ok-bg px-3 py-2 text-sm font-semibold text-ok-fg">{t('No new gaps: every requirement can still be met.')}</p>}
            <ul className="flex flex-col gap-2">
              {impact.days.filter(d => d.gaps.length).map(d => (
                <li key={d.date} className="rounded-control border border-line px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <strong>{fmt.date(d.date, 'weekday')} {fmt.date(d.date)}</strong><span className="text-ink-3">{wf.shiftTypes[d.shiftTypeId]?.name}</span>
                    <span className="flex-1" /><Pill tone={d.after === 'short' ? 'bad' : 'warn'}>{d.after === 'short' ? t('Short') : t('Possible, with risks')}</Pill>
                  </div>
                  {d.gaps.map(g => {
                    const free = g.replacements.filter(r => !r.opensGap);
                    const costly = g.replacements.filter(r => r.opensGap);
                    return (
                      <div key={g.reqId} className="mt-1 text-xs">
                        <span className="font-semibold text-bad-fg">{reqLabel(wf, g.req)}: {g.filled}/{g.required}</span>
                        {g.replacements.length === 0 && <span className="text-ink-2"> · {t('no qualified replacement')}</span>}
                        {free.length > 0 && <p className="text-ink-2">{t('Could step in without opening a gap')}: {free.slice(0, 8).map(r => `${name(r.personId)} (${r.from ? wf.shiftTypes[r.from]?.name : t('day off')})`).join(', ')}{free.length > 8 ? ` +${free.length - 8}` : ''}</p>}
                        {costly.length > 0 && <p className="text-warn-fg">{t('Qualified, but moving them opens a gap on their own shift')}: {costly.slice(0, 6).map(r => `${name(r.personId)} (${wf.shiftTypes[r.from]?.name})`).join(', ')}</p>}
                        {list(wf.people).some(p => certIssues(wf, p.id, g.req.certIds, d.date).some(i => i.problem === 'expired')) && g.req.certIds?.length > 0 && <p className="text-warn-fg">{t('Some people are ruled out by a certificate that has expired by this date.')}</p>}
                      </div>
                    );
                  })}
                </li>
              ))}
            </ul>
            {impact.gapDays > 0 && <p className="mt-2 text-xs text-ink-3">{t('This is information for your decision. You can still save the leave.')}</p>}
          </section>
        )}
      </div>
    </Sheet>
  );
}
