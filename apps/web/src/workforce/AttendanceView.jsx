/* Attendance: a daily register for team leaders, and a monthly review of
 * deviations from the schedule before time is approved in the other system.
 * Nothing is approved or locked here; every change is logged. */
import { useEffect, useMemo, useState } from 'react';
import { Button, Pill, Segmented } from '../ui';
import { useI18n } from '../i18n';
import { useWorkforce } from './store-context';
import { useReasons } from './derive';
import { Avatar, EmploymentMark, Empty, Input, PageHeader, Select, Sheet } from './ui';
import { usePref } from './prefs';
import { PrintPreview, PrintPage } from './print';
import { chunk } from './print-util';
import EntryForm from './EntryForm';
import { addDays, addMonths, endOfMonth, todayIn, utcToZoned } from './logic/time';
import { displayName, list, settingsOf, uid } from './logic/model';
import { resolveShift, teamOf } from './logic/schedule';
import { personMonth } from './logic/attendance';

const utcToDate = ms => utcToZoned(ms).date;

/** Swedish public holidays for the OB rules that ask for them. */
function useHolidays(month, needed) {
  const [set, setSet] = useState(() => new Set());
  const year = Number(month.slice(0, 4));
  useEffect(() => {
    if (!needed) return undefined;
    let live = true;
    import('date-holidays').then(({ default: Holidays }) => {
      const hd = new Holidays('SE');
      const out = new Set();
      for (const y of [year - 1, year, year + 1]) for (const h of hd.getHolidays(y)) if (h.type === 'public') out.add(h.date.slice(0, 10));
      if (live) setSet(out);
    }).catch(() => {});
    return () => { live = false; };
  }, [year, needed]);
  return set;
}

export default function AttendanceView() {
  const { t, fmt } = useI18n();
  const { wf, idx, att, entries, can, phase } = useWorkforce();
  const today = todayIn();
  const [pref, setPref] = usePref('attendance', { tab: 'day', team: 'all', month: today.slice(0, 7), group: false, emp: 'all' });
  const [date, setDate] = useState(today);
  const [receipt, setReceipt] = useState(null);
  const [printing, setPrinting] = useState(null); // 'team' | 'receipts'
  const settings = settingsOf(wf);
  const rules = list(wf.obRules).filter(r => r.active !== false).sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const holidays = useHolidays(pref.month, rules.some(r => r.holidays || r.notOnHolidays));
  const monthFrom = `${pref.month}-01`;

  const people = useMemo(() => list(wf.people)
    .map(p => ({ ...p, teamId: teamOf(idx, p.id, pref.tab === 'day' ? date : monthFrom) }))
    .filter(p => pref.team === 'all' || p.teamId === pref.team)
    .filter(p => pref.emp === 'all' || p.employment === pref.emp)
    .sort((a, b) => (pref.group ? String(a.employment).localeCompare(String(b.employment)) : 0) || a.name.localeCompare(b.name, fmt.locale)),
  [wf, idx, pref, date, monthFrom, fmt.locale]);

  const months = useMemo(() => (pref.tab === 'month' || printing || receipt
    ? people.map(p => ({ person: p, m: personMonth(wf, idx, entries, p.id, pref.month, { holidays, utcToDate }) })).filter(x => x.m.totals.scheduledShifts || x.m.days.length)
    : []), [people, wf, idx, entries, pref.month, pref.tab, holidays, printing, receipt]);

  if (phase !== 'ready') return null;
  if (!list(wf.people).length) return <div className="wf-page"><PageHeader title={t('Attendance')} /><Empty title={t('No people yet')}>{t('Add people and shift patterns in Setup, or load the demo plant there to look around.')}</Empty></div>;

  const totalsRow = ms => ms.reduce((a, { m }) => {
    a.scheduledHours += m.totals.scheduledHours; a.workedHours += m.totals.workedHours; a.overtimeHours += m.totals.overtimeHours;
    a.sick += m.totals.sick.hours; a.vacation += m.totals.vacation.hours; a.absence += m.totals.absence.hours; a.late += m.totals.lateHours;
    for (const r of rules) a.ob[r.id] = (a.ob[r.id] || 0) + (m.ob[r.id] || 0);
    return a;
  }, { scheduledHours: 0, workedHours: 0, overtimeHours: 0, sick: 0, vacation: 0, absence: 0, late: 0, ob: {} });
  const h = n => (n ? fmt.num(Math.round(n * 100) / 100) : '–');
  const groupsOf = ms => (pref.group
    ? [['permanent', t('Permanent employees')], ['consultant', t('Consultants')]].map(([k, label]) => ({ label, rows: ms.filter(x => (x.person.employment || 'permanent') === k) })).filter(g => g.rows.length)
    : [{ label: null, rows: ms }]);
  const monthLabel = fmt.date(monthFrom, 'month');
  const teamLabel = pref.team === 'all' ? t('All teams') : wf.teams[pref.team]?.name;

  return (
    <div className="wf-page">
      <PageHeader title={t('Attendance')}>
        <Segmented label={t('View')} value={pref.tab} onChange={tab => setPref({ tab })}
          options={[{ value: 'day', label: t('Day register') }, { value: 'month', label: t('Month review') }, { value: 'log', label: t('Change log') }]} />
      </PageHeader>
      <div className="wf-toolbar">
        {pref.tab === 'day' ? (
          <>
            <Button icon aria-label={t('Previous day')} onClick={() => setDate(addDays(date, -1))}>‹</Button>
            <Input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} aria-label={t('Date')} />
            <Button icon aria-label={t('Next day')} onClick={() => setDate(addDays(date, 1))}>›</Button>
            <Button onClick={() => setDate(today)}>{t('Today')}</Button>
          </>
        ) : (
          <>
            <Button icon aria-label={t('Previous month')} onClick={() => setPref({ month: addMonths(monthFrom, -1).slice(0, 7) })}>‹</Button>
            <Input type="month" value={pref.month} onChange={e => e.target.value && setPref({ month: e.target.value })} aria-label={t('Month')} />
            <Button icon aria-label={t('Next month')} onClick={() => setPref({ month: addMonths(monthFrom, 1).slice(0, 7) })}>›</Button>
          </>
        )}
        <Select value={pref.team} onChange={e => setPref({ team: e.target.value })} aria-label={t('Team')}>
          <option value="all">{t('All teams')}</option>{list(wf.teams).map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
        </Select>
        <Select value={pref.emp} onChange={e => setPref({ emp: e.target.value })} aria-label={t('Employment')}>
          <option value="all">{t('All employment types')}</option><option value="permanent">{t('Permanent')}</option><option value="consultant">{t('Consultant')}</option>
        </Select>
        {pref.tab === 'month' && <button type="button" className="wf-chip" aria-pressed={pref.group} onClick={() => setPref({ group: !pref.group })}>{t('Group by employment')}</button>}
        <span className="flex-1" />
        {pref.tab === 'month' && can('reports.view') && <><Button onClick={() => setPrinting('team')}>{t('Print team summary')}</Button><Button onClick={() => setPrinting('receipts')}>{t('Print all receipts')}</Button></>}
      </div>

      <div className="wf-scroll">
        {pref.tab === 'day' && <DayRegister date={date} people={people} />}
        {pref.tab === 'month' && (
          !can('reports.view') ? <Empty title={t('Reports are not available for your role')} /> : (
            <>
              <p className="px-4 pt-3 text-xs text-ink-3">{t('Deviations from the regular schedule. A planning aid for your review: time is approved in the other system, and nothing here is locked.')}{!rules.length ? ` ${t('No OB rules are set up, so OB is not shown.')}` : ''}</p>
              <table className="wf-table">
                <thead><tr>
                  <th>{t('Name')}</th><th className="num">{t('Scheduled h')}</th><th className="num">{t('Worked h')}</th><th className="num">{t('Overtime h')}</th>
                  <th className="num">{t('Sick h')}</th><th className="num">{t('Vacation h')}</th><th className="num">{t('Other absence h')}</th><th className="num">{t('Late')}</th>
                  {rules.map(r => <th key={r.id} className="num">OB {r.name}</th>)}<th>{t('To check')}</th>
                </tr></thead>
                <tbody>
                  {groupsOf(months).map(g => (
                    <GroupRows key={g.label || 'all'} label={g.label} span={9 + rules.length}>
                      {g.rows.map(({ person, m }) => (
                        <tr key={person.id} className="wf-rowbtn" tabIndex={0} onClick={() => setReceipt(person.id)} onKeyDown={e => { if (e.key === 'Enter') setReceipt(person.id); }}>
                          <td><span className="flex items-center gap-2"><Avatar person={person} size={22} />{displayName(person, settings.nicknameIn.reports)}{settings.nicknameIn.reports && person.nickname ? <span className="text-xs text-ink-3">({person.name})</span> : null}<EmploymentMark person={person} mode={settings.employmentIndicator} /></span></td>
                          <td className="num">{h(m.totals.scheduledHours)}</td><td className="num">{h(m.totals.workedHours)}</td><td className="num">{h(m.totals.overtimeHours)}</td>
                          <td className="num">{h(m.totals.sick.hours)}</td><td className="num">{h(m.totals.vacation.hours)}</td><td className="num">{h(m.totals.absence.hours)}</td>
                          <td className="num">{m.totals.lateCount ? `${m.totals.lateCount} × · ${h(m.totals.lateHours)}` : '–'}</td>
                          {rules.map(r => <td key={r.id} className="num">{h(m.ob[r.id])}{m.obUncertain ? ' ?' : ''}</td>)}
                          <td>{m.flags.length ? <Pill tone="bad">{t('{n} to check', { n: m.flags.length })}</Pill> : m.deviations ? <Pill tone="idle">{t('Deviations: {n}', { n: m.deviations })}</Pill> : ''}</td>
                        </tr>
                      ))}
                      {g.rows.length > 1 && (() => { const s = totalsRow(g.rows); return (
                        <tr><th style={{ position: 'static' }}>{t('Total')}</th><th className="num" style={{ position: 'static' }}>{h(s.scheduledHours)}</th><th className="num" style={{ position: 'static' }}>{h(s.workedHours)}</th><th className="num" style={{ position: 'static' }}>{h(s.overtimeHours)}</th><th className="num" style={{ position: 'static' }}>{h(s.sick)}</th><th className="num" style={{ position: 'static' }}>{h(s.vacation)}</th><th className="num" style={{ position: 'static' }}>{h(s.absence)}</th><th className="num" style={{ position: 'static' }}>{h(s.late)}</th>{rules.map(r => <th key={r.id} className="num" style={{ position: 'static' }}>{h(s.ob[r.id])}</th>)}<th style={{ position: 'static' }} /></tr>
                      ); })()}
                    </GroupRows>
                  ))}
                </tbody>
              </table>
            </>
          )
        )}
        {pref.tab === 'log' && <ChangeLog log={att.log || []} month={pref.month} />}
      </div>

      {receipt && months.find(x => x.person.id === receipt) && (
        <Sheet wide title={wf.people[receipt]?.name} subtitle={monthLabel} onClose={() => setReceipt(null)}
          footer={<Button variant="primary" onClick={() => setPrinting(`one:${receipt}`)}>{t('Print / Save as PDF')}</Button>}>
          <div className="flex justify-center"><Receipt data={months.find(x => x.person.id === receipt)} rules={rules} month={monthFrom} /></div>
        </Sheet>
      )}
      {printing === 'team' && (
        <PrintPreview id="att-team" onClose={() => setPrinting(null)}>
          {({ height }) => {
            const flat = groupsOf(months).flatMap(g => [...(g.label ? [{ label: g.label }] : []), ...g.rows, ...(g.rows.length > 1 ? [{ total: totalsRow(g.rows) }] : [])]);
            const pages = chunk(flat, Math.max(10, Math.floor((height - 55) / 5.4)));
            return pages.map((rows, i) => (
              <PrintPage key={i} page={i + 1} pages={pages.length} title={t('Attendance: month review')} range={`${monthLabel} · ${teamLabel}`}
                legend={<><span><b>?</b>{t('OB uncertain: an entry has hours but no times')}</span><span><b>ᶜ</b>{t('Consultant')}</span></>}>
                <table>
                  <colgroup><col style={{ width: '46mm' }} /></colgroup>
                  <thead><tr><th className="l">{t('Name')}</th><th className="r">{t('Scheduled h')}</th><th className="r">{t('Worked h')}</th><th className="r">{t('Overtime h')}</th><th className="r">{t('Sick h')}</th><th className="r">{t('Vacation h')}</th><th className="r">{t('Other absence h')}</th><th className="r">{t('Late')}</th>{rules.map(r => <th key={r.id} className="r">OB {r.name}</th>)}<th>{t('To check')}</th></tr></thead>
                  <tbody>{rows.map((x, k) => x.label ? <tr key={k}><th className="l" colSpan={9 + rules.length}>{x.label}</th></tr> : x.total ? (
                    <tr key={k}><th className="l">{t('Total')}</th><th className="r">{h(x.total.scheduledHours)}</th><th className="r">{h(x.total.workedHours)}</th><th className="r">{h(x.total.overtimeHours)}</th><th className="r">{h(x.total.sick)}</th><th className="r">{h(x.total.vacation)}</th><th className="r">{h(x.total.absence)}</th><th className="r">{h(x.total.late)}</th>{rules.map(r => <th key={r.id} className="r">{h(x.total.ob[r.id])}</th>)}<th /></tr>
                  ) : (
                    <tr key={x.person.id}><td className="l">{x.person.name}{x.person.employment === 'consultant' ? ' ᶜ' : ''}</td><td className="r">{h(x.m.totals.scheduledHours)}</td><td className="r">{h(x.m.totals.workedHours)}</td><td className="r">{h(x.m.totals.overtimeHours)}</td><td className="r">{h(x.m.totals.sick.hours)}</td><td className="r">{h(x.m.totals.vacation.hours)}</td><td className="r">{h(x.m.totals.absence.hours)}</td><td className="r">{x.m.totals.lateCount ? `${x.m.totals.lateCount}× ${h(x.m.totals.lateHours)}` : '–'}</td>{rules.map(r => <td key={r.id} className="r">{h(x.m.ob[r.id])}{x.m.obUncertain ? ' ?' : ''}</td>)}<td>{x.m.flags.length || ''}</td></tr>
                  ))}</tbody>
                </table>
              </PrintPage>
            ));
          }}
        </PrintPreview>
      )}
      {printing && printing !== 'team' && (
        <PrintPreview id="att-receipt" defaultOrientation="portrait" onClose={() => setPrinting(null)}>
          {() => months.filter(x => printing === 'receipts' || printing === `one:${x.person.id}`).map((x, i, arr) => (
            <PrintPage key={x.person.id} page={i + 1} pages={arr.length} title={t('Attendance summary')} range={`${x.person.name} · ${monthLabel}`}>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4mm' }}><Receipt data={x} rules={rules} month={monthFrom} /></div>
            </PrintPage>
          ))}
        </PrintPreview>
      )}
    </div>
  );
}

function GroupRows({ label, span, children }) {
  return <>{label && <tr><th colSpan={span} style={{ position: 'static' }}>{label}</th></tr>}{children}</>;
}

/* Receipt-style summary for one person and month. */
function Receipt({ data, rules, month }) {
  const { t, fmt } = useI18n();
  const { wf } = useWorkforce();
  const reasons = useReasons();
  const { person, m } = data;
  const T = m.totals;
  const row = (label, value, cls = '') => <div className={`row ${cls}`}><span>{label}</span><span>{value}</span></div>;
  const problem = { incomplete: t('needs hours or times'), obNeedsTimes: t('OB can’t be placed without times'), notScheduled: t('absence on a day off') };
  return (
    <div className="receipt">
      <h3>{person.name}</h3>
      <div className="sub" style={{ textAlign: 'center' }}>
        {person.nickname ? `“${person.nickname}” · ` : ''}{person.employment === 'consultant' ? t('Consultant') : t('Permanent')}{wf.teams[person.teamId] ? ` · ${wf.teams[person.teamId].name}` : ''}
        <br />{fmt.date(month, 'month')} · {fmt.date(month, 'full')} – {fmt.date(endOfMonth(month), 'full')}
      </div>
      <hr />
      {row(t('Scheduled shifts'), T.scheduledShifts)}
      {row(t('Scheduled hours'), fmt.hours(T.scheduledHours))}
      <hr />
      {m.days.filter(d => d.deviation).length === 0 && <div className="sub">{t('No deviations from the schedule.')}</div>}
      {m.days.filter(d => d.deviation).map(d => d.lines.filter(l => l.category !== 'present').map(l => (
        <div key={l.entry.id}>
          {row(`${fmt.date(d.date)} ${fmt.name(l.reason?.name) || l.entry.reasonId}`,
            l.time.kind === 'incomplete' ? '??' : `${l.category === 'overtime' ? '+' : '−'}${fmt.hours(Math.round(l.time.hours * 100) / 100)}`, l.time.kind === 'incomplete' ? 'flag' : '')}
          <div className="sub">
            {l.time.kind === 'full' ? t('Whole shift') : l.entry.start && l.entry.end ? `${l.entry.start}–${l.entry.end}` : l.time.kind === 'incomplete' ? t('needs hours or times') : ''}
            {l.entry.comment ? ` “${l.entry.comment}”` : ''}
          </div>
        </div>
      )))}
      <hr />
      {row(t('Sick'), `${T.sick.days} ${t('d')} · ${fmt.hours(T.sick.hours)}`)}
      {row(t('Vacation'), `${T.vacation.days} ${t('d')} · ${fmt.hours(T.vacation.hours)}`)}
      {row(t('Other absence'), `${T.absence.days} ${t('d')} · ${fmt.hours(T.absence.hours)}`)}
      {reasons.filter(r => r.category === 'absence' && T.byReason[r.id]).map(r => <div key={r.id} className="row sub"><span>&nbsp;&nbsp;{fmt.name(r.name)}</span><span>{fmt.hours(T.byReason[r.id].hours)}</span></div>)}
      {row(t('Late'), `${T.lateCount} × · ${fmt.hours(T.lateHours)}`)}
      {row(t('Overtime'), fmt.hours(T.overtimeHours))}
      <hr />
      {rules.length === 0 ? <div className="sub">{t('No OB rules are set up, so OB is not shown.')}</div> : rules.map(r => <div key={r.id}>{row(`OB ${r.name}${r.rate ? ` (${r.rate})` : ''}`, fmt.hours(m.ob[r.id] || 0))}</div>)}
      {m.obUncertain && <div className="sub flag">{t('OB uncertain: an entry has hours but no times')}</div>}
      <hr />
      {row(t('Worked hours (schedule ± deviations)'), fmt.hours(T.workedHours))}
      {m.flags.length > 0 && <><hr />{m.flags.map(f => <div key={f.entryId + f.problem} className="row flag"><span>! {fmt.date(f.date)}</span><span>{problem[f.problem]}</span></div>)}</>}
      <hr />
      <div className="sub" style={{ textAlign: 'center' }}>{t('For review only. Not a pay or time-approval document.')}</div>
    </div>
  );
}

/* Everyone scheduled on a date, with one-tap statuses. */
function DayRegister({ date, people }) {
  const { t, fmt } = useI18n();
  const { wf, idx, entries, can, commit } = useWorkforce();
  const reasons = useReasons();
  const settings = settingsOf(wf);
  const [form, setForm] = useState(null); // { personId, entry? }
  const canEdit = can('attendance.edit');
  const shiftTypes = list(wf.shiftTypes).sort((a, b) => (a.order || 0) - (b.order || 0));
  const byPerson = new Map();
  for (const e of entries) if (e.date === date) byPerson.set(e.personId, [...(byPerson.get(e.personId) || []), e]);
  const rows = people.map(p => ({ p, r: resolveShift(wf, idx, p.id, date), es: byPerson.get(p.id) || [] })).filter(x => x.r.shiftTypeId || x.es.length);
  const quick = (personId, reasonId, fullDay) => {
    const id = uid('en_');
    commit([{ op: 'put', col: 'entries', id, value: { id, personId, date, reasonId, fullDay, hours: null, start: null, end: null, comment: '', tentative: false } }],
      t('{name}: {status}', { name: wf.people[personId].name, status: fmt.name(reasons.find(r => r.id === reasonId)?.name) }));
  };
  const save = (base, _until, id) => { commit([{ op: 'put', col: 'entries', id, value: { ...base, id, date } }], t('Attendance saved for {name}', { name: wf.people[base.personId].name })); setForm(null); };
  if (!rows.length) return <Empty title={t('Nobody is scheduled on {date}', { date: fmt.date(date, 'long') })} />;
  const has = id => reasons.some(r => r.id === id);
  return (
    <div className="wf-body">
      <p className="text-xs text-ink-3">{fmt.date(date, 'long')} · {t('Nothing recorded means the schedule counts as worked. Record only what differs.')}</p>
      {[...shiftTypes, null].map(st => {
        const group = rows.filter(x => (x.r.shiftTypeId || null) === (st?.id || null));
        if (!group.length) return null;
        return (
          <section key={st?.id || 'off'} className="rounded-panel border border-line bg-panel">
            <header className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm font-semibold">
              {st && <span className="cal__dot" style={{ background: st.color }} />}{st ? `${st.name} · ${st.start}–${st.end}` : t('Not scheduled')} <span className="font-normal text-ink-3">{group.length}</span>
            </header>
            <ul>
              {group.map(({ p, es }) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 last:border-b-0">
                  <Avatar person={p} size={26} />
                  <span className="min-w-[9rem] flex-1 text-sm">{displayName(p, settings.nicknameIn.schedule)} <EmploymentMark person={p} mode={settings.employmentIndicator} /></span>
                  {es.map(e => {
                    const reason = reasons.find(r => r.id === e.reasonId);
                    const incomplete = reason?.category !== 'present' && !e.fullDay && !e.hours && !(e.start && e.end);
                    const tone = incomplete ? 'bad' : reason?.category === 'present' ? 'ok' : reason?.category === 'vacation' ? 'approved' : 'warn';
                    return (
                      <button type="button" key={e.id} className="ui-focus" onClick={() => canEdit && setForm({ personId: p.id, entry: e })} title={e.comment || undefined}>
                        <Pill tone={tone}>{fmt.name(reason?.name)}{e.start && e.end ? ` ${e.start}–${e.end}` : e.hours ? ` ${fmt.hours(e.hours)}` : ''}{incomplete ? ` · ${t('Incomplete')}` : ''}{e.comment ? ' ✎' : ''}</Pill>
                      </button>
                    );
                  })}
                  {canEdit && (
                    <span className="flex flex-wrap gap-1">
                      {es.length === 0 && has('present') && <Button onClick={() => quick(p.id, 'present', false)}>{t('Present')}</Button>}
                      {es.length === 0 && has('sick') && <Button onClick={() => quick(p.id, 'sick', true)}>{t('Sick')}</Button>}
                      {has('late') && <Button onClick={() => setForm({ personId: p.id, entry: null, reasonId: 'late' })}>{t('Late')}</Button>}
                      <Button onClick={() => setForm({ personId: p.id, entry: null })}>{t('Other…')}</Button>
                      {es.length > 0 && <Button variant="ghost" onClick={() => commit(es.map(e => ({ op: 'del', col: 'entries', id: e.id })), t('Attendance cleared for {name}', { name: p.name }))}>{t('Clear')}</Button>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {form && (
        <Sheet title={wf.people[form.personId].name} subtitle={fmt.date(date, 'long')} onClose={() => setForm(null)}>
          <EntryForm personId={form.personId} date={date} entry={form.entry || (form.reasonId ? { reasonId: form.reasonId, fullDay: false, hours: '', start: '', end: '', comment: '' } : null)}
            onSave={(base, until, id) => save(base, until, form.entry?.id || id)} onCancel={() => setForm(null)} />
          {form.entry && <Button variant="danger" className="mt-4" onClick={() => { commit([{ op: 'del', col: 'entries', id: form.entry.id }], t('Attendance entry removed')); setForm(null); }}>{t('Remove this entry')}</Button>}
        </Sheet>
      )}
    </div>
  );
}

function ChangeLog({ log, month }) {
  const { t, fmt } = useI18n();
  const { wf } = useWorkforce();
  const reasons = useReasons();
  const rows = log.filter(l => (l.after || l.before)?.date?.startsWith(month)).slice().reverse();
  const show = e => {
    if (!e) return '—';
    const reason = fmt.name(reasons.find(r => r.id === e.reasonId)?.name) || e.reasonId;
    const time = e.fullDay ? t('Whole shift') : e.start && e.end ? `${e.start}–${e.end}` : e.hours ? fmt.hours(e.hours) : '';
    return [reason, time, e.tentative ? t('requested') : '', e.comment ? `“${e.comment}”` : ''].filter(Boolean).join(' · ');
  };
  if (!rows.length) return <Empty title={t('No changes recorded for this month')} />;
  return (
    <table className="wf-table">
      <thead><tr><th>{t('When')}</th><th>{t('Who')}</th><th>{t('Person')}</th><th>{t('Date')}</th><th>{t('Before')}</th><th>{t('After')}</th></tr></thead>
      <tbody>
        {rows.map((l, i) => {
          const e = l.after || l.before;
          return <tr key={i}><td>{fmt.stamp(Date.parse(l.at))}</td><td>{l.by}</td><td>{wf.people[e.personId]?.name || e.personId}</td><td>{fmt.date(e.date, 'full')}</td><td>{show(l.before)}</td><td>{l.after ? show(l.after) : t('Removed')}</td></tr>;
        })}
      </tbody>
    </table>
  );
}
