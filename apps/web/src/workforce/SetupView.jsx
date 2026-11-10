/* Setup: everything the planning is built from. Each block can be folded
 * away; what is open is remembered. */
import { useState } from 'react';
import { Button, Checkbox } from '../ui';
import { useI18n } from '../i18n';
import { useWorkforce } from './store-context';
import { Collapsible, Confirm, Empty, Field, Input, PageHeader, Select } from './ui';
import EntityTable from './EntityTable';
import ObRules from './ObRules';
import { buildSample } from './logic/sample';
import { DEFAULT_LEVELS, DEFAULT_REASONS, levelsOf, list, reasonsOf, settingsOf, uid, WORKFORCE_COLLECTIONS } from './logic/model';
import { assignPatternOps, editPatternFromOps } from './logic/schedule';
import { addDays, startOfWeek, todayIn } from './logic/time';
import { SHORTCUT_ACTIONS, loadShortcuts, saveShortcuts } from './shortcuts';

const WD = [1, 2, 3, 4, 5, 6, 7];

export default function SetupView() {
  const { t, fmt } = useI18n();
  const { wf, can, commit, phase } = useWorkforce();
  const settings = settingsOf(wf);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const isEmpty = !list(wf.people).length && !list(wf.shiftTypes).length;
  const canSettings = can('settings.edit');
  const wdOptions = WD.map(d => ({ value: d, label: fmt.date(addDays('2026-11-01', d), 'weekday') })); // 2026-11-02 is a Monday
  const shiftOptions = list(wf.shiftTypes).map(s => ({ value: s.id, label: s.name }));
  const levelOptions = levelsOf(wf).map(l => ({ value: l.id, label: l.name }));
  const [template, setTemplate] = useState(null);
  const templates = list(wf.templates);
  const templateId = template && wf.templates[template] ? template : (templates.find(x => x.isDefault) || templates[0])?.id;

  const setSetting = patch => commit([{ op: 'put', col: 'settings', id: 'main', value: { ...settings, ...patch } }]);
  const loadDemo = () => {
    const sample = buildSample();
    const ops = WORKFORCE_COLLECTIONS.flatMap(c => list(sample[c]).map(v => ({ op: 'put', col: c, id: v.id, value: v })));
    commit(ops, t('Demo plant loaded'));
    setConfirmDemo(false);
  };
  const ensureDefaults = () => {
    const ops = [];
    if (!list(wf.levels).length) for (const l of DEFAULT_LEVELS) ops.push({ op: 'put', col: 'levels', id: l.id, value: l });
    if (!list(wf.reasons).length) for (const r of DEFAULT_REASONS) ops.push({ op: 'put', col: 'reasons', id: r.id, value: r });
    if (ops.length) commit(ops);
  };

  if (phase !== 'ready') return null;
  return (
    <div className="wf-page">
      <PageHeader title={t('Setup')} />
      <div className="wf-scroll"><div className="wf-body">
        {isEmpty && (
          <Empty title={t('Start here')} action={canSettings && <Button variant="primary" onClick={() => setConfirmDemo(true)}>{t('Load the demo plant')}</Button>}>
            {t('Nothing is set up yet. Add your shifts, patterns, teams and processes below, or load a made-up plant (40 operators, 3 shifts, 4 processes) to try things out.')}
          </Empty>
        )}

        <Collapsible id="shifts" title={t('Shifts')}>
          <p className="mb-2 text-xs text-ink-3">{t('An end time earlier than the start means the shift ends the next day.')}</p>
          <EntityTable col="shiftTypes" permission="schedule.edit" addLabel={t('Add shift')}
            make={id => ({ id, name: t('New shift'), code: '?', start: '06:00', end: '14:00', breakMin: 30, color: '#3B6FD4', order: list(wf.shiftTypes).length + 1 })}
            columns={[
              { key: 'name', label: t('Name') }, { key: 'code', label: t('Code'), width: 56 },
              { key: 'start', label: t('Start'), type: 'time', width: 110 }, { key: 'end', label: t('End'), type: 'time', width: 110 },
              { key: 'breakMin', label: t('Unpaid break (min)'), type: 'number', min: 0 }, { key: 'color', label: t('Colour'), type: 'color' },
              { key: 'order', label: t('Order'), type: 'number' },
            ]} />
        </Collapsible>

        <Collapsible id="patterns" title={t('Shift patterns')}>
          <Patterns />
        </Collapsible>

        <Collapsible id="teams" title={t('Teams')}>
          <EntityTable col="teams" permission="people.edit" addLabel={t('Add team')} make={id => ({ id, name: t('New team'), color: '#3B6FD4' })}
            columns={[{ key: 'name', label: t('Name') }, { key: 'color', label: t('Colour'), type: 'color' }]} />
          <TeamPatterns />
          <div className="mt-3 flex flex-col gap-1">
            <Checkbox checked={settings.requireMoveConfirmation} disabled={!canSettings} onChange={e => setSetting({ requireMoveConfirmation: e.target.checked })}>
              {t('A manager must confirm when a team lead moves someone to another team')}
            </Checkbox>
          </div>
        </Collapsible>

        <Collapsible id="processes" title={t('Processes and competencies')} defaultOpen={false}>
          <h4 className="mb-1 text-xs font-semibold text-ink-3">{t('Processes (lines)')}</h4>
          <EntityTable col="processes" permission="settings.edit" addLabel={t('Add process')}
            make={id => ({ id, name: t('New process'), color: '#2F8A55' })}
            columns={[{ key: 'name', label: t('Name') }, { key: 'color', label: t('Colour'), type: 'color' },
              ...levelsOf(wf).filter(l => l.counts !== 'full').map(l => ({
                key: `trainee_${l.id}`, label: t('“{level}” counts as', { level: fmt.name(l.name) }), type: 'select',
                get: r => r.trainee?.[l.id] || '', options: [{ value: 'none', label: t('Not counted') }, { value: 'supervised', label: t('Counted with a supervisor') }, { value: 'full', label: t('Counted fully') }],
                empty: t('Default for the level'),
                set: (row, v) => { const trainee = { ...(row.trainee || {}) }; if (v) trainee[l.id] = v; else delete trainee[l.id]; return { ...row, trainee }; },
              }))]}
          />
          <h4 className="mb-1 mt-4 text-xs font-semibold text-ink-3">{t('Competencies')}</h4>
          <EntityTable col="skills" permission="settings.edit" addLabel={t('Add competency')} make={id => ({ id, name: t('New competency'), processId: null })}
            columns={[{ key: 'name', label: t('Name') }, { key: 'processId', label: t('Belongs to process'), type: 'select', empty: t('None (e.g. a task)'), options: list(wf.processes).map(p => ({ value: p.id, label: p.name })) }]} />
          <h4 className="mb-1 mt-4 text-xs font-semibold text-ink-3">{t('Competency levels')}</h4>
          {!list(wf.levels).length && canSettings && <Button onClick={ensureDefaults}>{t('Use the standard levels and reasons')}</Button>}
          <EntityTable col="levels" permission="settings.edit" addLabel={t('Add level')} sort={(a, b) => a.rank - b.rank}
            make={id => ({ id, name: { en: 'New level', sv: 'Ny nivå' }, rank: levelsOf(wf).length + 1, counts: 'full', canSupervise: false })}
            columns={[
              { key: 'name_en', label: t('Name (English)'), get: r => r.name?.en ?? r.name, set: (r, v) => ({ ...r, name: { ...(typeof r.name === 'object' ? r.name : {}), en: v } }) },
              { key: 'name_sv', label: t('Name (Swedish)'), get: r => r.name?.sv ?? '', set: (r, v) => ({ ...r, name: { ...(typeof r.name === 'object' ? r.name : { en: r.name }), sv: v } }) },
              { key: 'rank', label: t('Rank'), type: 'number' },
              { key: 'counts', label: t('Counts toward staffing'), type: 'select', options: [{ value: 'none', label: t('Not counted') }, { value: 'supervised', label: t('Counted with a supervisor') }, { value: 'full', label: t('Counted fully') }] },
              { key: 'canSupervise', label: t('Can supervise trainees'), type: 'check' },
            ]} />
          <Field label={t('Trainees per supervisor')} className="mt-3">
            <Input type="number" min="1" className="w-24" disabled={!canSettings} value={settings.maxTraineesPerSupervisor} onChange={e => setSetting({ maxTraineesPerSupervisor: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
          <h4 className="mb-1 mt-4 text-xs font-semibold text-ink-3">{t('Certificates')}</h4>
          <EntityTable col="certs" permission="settings.edit" addLabel={t('Add certificate')} make={id => ({ id, name: t('New certificate'), expires: true })}
            columns={[{ key: 'name', label: t('Name') }, { key: 'expires', label: t('Has an expiry date'), type: 'check' }]} />
          <p className="mt-2 text-xs text-ink-3">{t('An overview for planning. The official training and certification record stays in the company system.')}</p>
        </Collapsible>

        <Collapsible id="requirements" title={t('Staffing requirements')}>
          <p className="mb-2 text-xs text-ink-3">{t('A process runs on a shift when it has a requirement there. Give each process its own shifts and days.')}</p>
          <h4 className="mb-1 text-xs font-semibold text-ink-3">{t('Templates (e.g. normal and low season)')}</h4>
          <EntityTable col="templates" permission="requirements.edit" addLabel={t('Add template')} make={id => ({ id, name: t('New template'), isDefault: !templates.length })}
            columns={[{ key: 'name', label: t('Name') }, { key: 'isDefault', label: t('Used when no period applies'), type: 'check' }]} />
          <h4 className="mb-1 mt-4 text-xs font-semibold text-ink-3">{t('Periods that use another template')}</h4>
          <EntityTable col="templateRanges" permission="requirements.edit" addLabel={t('Add period')} sort={(a, b) => a.from.localeCompare(b.from)}
            make={id => ({ id, templateId: templates[0]?.id, from: todayIn(), to: addDays(todayIn(), 13) })}
            empty={t('No periods: the default template applies all year.')}
            columns={[{ key: 'templateId', label: t('Template'), type: 'select', options: templates.map(x => ({ value: x.id, label: x.name })) },
              { key: 'from', label: t('From'), type: 'date', width: 150 }, { key: 'to', label: t('To'), type: 'date', width: 150 }]} />
          <div className="mb-1 mt-4 flex flex-wrap items-center gap-2">
            <h4 className="text-xs font-semibold text-ink-3">{t('Requirements in')}</h4>
            <Select value={templateId || ''} onChange={e => setTemplate(e.target.value)} aria-label={t('Template')}>
              {templates.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </div>
          {templateId ? (
            <EntityTable col="requirements" permission="requirements.edit" addLabel={t('Add requirement')} filter={r => r.templateId === templateId}
              sort={(a, b) => String(a.processId).localeCompare(String(b.processId)) || String(a.shiftTypeId).localeCompare(String(b.shiftTypeId))}
              make={id => ({ id, templateId, processId: list(wf.processes)[0]?.id || null, shiftTypeId: shiftOptions[0]?.value || null, weekdays: [1, 2, 3, 4, 5], kind: 'dedicated', count: 1, skillId: list(wf.processes)[0]?.id || null, minLevelId: null, certIds: [], window: null, hours: null, label: '' })}
              columns={[
                { key: 'processId', label: t('Process'), type: 'select', empty: t('None'), options: list(wf.processes).map(p => ({ value: p.id, label: p.name })) },
                { key: 'shiftTypeId', label: t('Shift'), type: 'select', options: shiftOptions },
                { key: 'weekdays', label: t('Days'), type: 'multi', options: wdOptions },
                { key: 'kind', label: t('Kind'), type: 'select', options: [{ value: 'dedicated', label: t('Line position') }, { value: 'shared', label: t('Shared role') }, { value: 'task', label: t('Task') }] },
                { key: 'count', label: t('People'), type: 'number', min: 0 },
                { key: 'skillId', label: t('Competency'), type: 'select', empty: t('None'), options: list(wf.skills).map(s => ({ value: s.id, label: s.name })) },
                { key: 'minLevelId', label: t('Lowest level'), type: 'select', empty: t('Any counted level'), options: levelOptions },
                { key: 'certIds', label: t('Certificates'), type: 'multi', options: list(wf.certs).map(c => ({ value: c.id, label: c.name })) },
                { key: 'hours', label: t('Task hours'), type: 'number', step: '0.25', min: 0 },
                { key: 'winStart', label: t('Fixed from'), type: 'time', width: 110, get: r => r.window?.start || '', set: (r, v) => ({ ...r, window: v ? { start: v, end: r.window?.end || v } : null }) },
                { key: 'winEnd', label: t('Fixed to'), type: 'time', width: 110, get: r => r.window?.end || '', set: (r, v) => ({ ...r, window: v ? { start: r.window?.start || v, end: v } : null }) },
                { key: 'label', label: t('Label') },
              ]} />
          ) : <p className="text-sm text-ink-3">{t('Add a template first.')}</p>}
          <p className="mt-2 text-xs text-ink-3">{t('A task with hours and no fixed time is “flexible”: it takes capacity, and the plan shows that its timing is not known.')}</p>
        </Collapsible>

        <Collapsible id="events" title={t('Calendar activities')} defaultOpen={false}>
          <p className="mb-2 text-xs text-ink-3">{t('Recurring meetings and reminders, shown on the dashboard and in the calendar. They never reduce staffing.')}</p>
          <EntityTable col="events" permission="events.edit" addLabel={t('Add activity')} sort={(a, b) => a.date.localeCompare(b.date)}
            make={id => ({ id, title: t('New activity'), date: todayIn(), time: '09:00', repeat: 'weekly', until: '' })}
            columns={[
              { key: 'title', label: t('Title'), width: 220 }, { key: 'date', label: t('First date'), type: 'date', width: 150 }, { key: 'time', label: t('Time'), type: 'time', width: 110 },
              { key: 'repeat', label: t('Repeats'), type: 'select', options: [{ value: 'none', label: t('Once') }, { value: 'weekly', label: t('Every week') }, { value: 'monthly', label: t('Every month') }] },
              { key: 'until', label: t('Until (optional)'), type: 'date', width: 150 },
            ]} />
        </Collapsible>

        <Collapsible id="ob" title={t('OB rules')} defaultOpen={false}><ObRules /></Collapsible>

        <Collapsible id="reasons" title={t('Attendance statuses and absence reasons')} defaultOpen={false}>
          {!list(wf.reasons).length && canSettings && <Button onClick={ensureDefaults}>{t('Use the standard levels and reasons')}</Button>}
          <EntityTable col="reasons" permission="settings.edit" addLabel={t('Add reason')}
            make={id => ({ id, name: { en: 'New reason', sv: 'Ny orsak' }, category: 'absence', order: reasonsOf(wf).length + 1 })}
            canDelete={r => !['present'].includes(r.id)}
            columns={[
              { key: 'name_en', label: t('Name (English)'), get: r => r.name?.en ?? r.name, set: (r, v) => ({ ...r, name: { ...(typeof r.name === 'object' ? r.name : {}), en: v } }) },
              { key: 'name_sv', label: t('Name (Swedish)'), get: r => r.name?.sv ?? '', set: (r, v) => ({ ...r, name: { ...(typeof r.name === 'object' ? r.name : { en: r.name }), sv: v } }) },
              { key: 'category', label: t('Counts as'), type: 'select', options: [['present', t('Present')], ['late', t('Late')], ['sick', t('Sick')], ['vacation', t('Vacation')], ['absence', t('Other absence')], ['overtime', t('Overtime')]].map(([value, label]) => ({ value, label })) },
              { key: 'order', label: t('Order'), type: 'number' },
            ]} />
        </Collapsible>

        <Collapsible id="display" title={t('Names and employment type')} defaultOpen={false}>
          <div className="flex flex-col gap-3">
            <Field label={t('Show consultant / permanent as')}>
              <Select value={settings.employmentIndicator} disabled={!canSettings} onChange={e => setSetting({ employmentIndicator: e.target.value })}>
                <option value="dot">{t('A small dot')}</option><option value="tag">{t('A small label')}</option><option value="none">{t('Hidden')}</option>
              </Select>
            </Field>
            <fieldset>
              <legend className="mb-1 text-xs font-semibold text-ink-3">{t('Use nicknames in')}</legend>
              {[['schedule', t('Schedule')], ['coverage', t('Coverage details')], ['people', t('People list')], ['reports', t('Reports and printouts')]].map(([k, label]) => (
                <Checkbox key={k} checked={!!settings.nicknameIn[k]} disabled={!canSettings} onChange={e => setSetting({ nicknameIn: { ...settings.nicknameIn, [k]: e.target.checked } })}>{label}</Checkbox>
              ))}
              <p className="text-xs text-ink-3">{t('The real name always shows in the profile, and next to the nickname in reports.')}</p>
            </fieldset>
          </div>
        </Collapsible>

        <Collapsible id="keys" title={t('Keyboard shortcuts')} defaultOpen={false}><Shortcuts /></Collapsible>
      </div></div>
      {confirmDemo && (
        <Confirm title={t('Load the demo plant?')} body={t('This adds 40 made-up operators with shifts, teams, processes and requirements. Use it to explore; start a clean setup for real planning.')}
          confirmLabel={t('Load demo')} onCancel={() => setConfirmDemo(false)} onConfirm={loadDemo} />
      )}
    </div>
  );
}

/* Pattern editor: one row per week of the cycle. Saving asks whether the
 * change applies from a date (history kept) or everywhere. */
function Patterns() {
  const { t, fmt } = useI18n();
  const { wf, can, commit } = useWorkforce();
  const editable = can('schedule.edit');
  const current = list(wf.patterns).filter(p => !list(wf.patterns).some(q => q.supersedes === p.id));
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [from, setFrom] = useState(startOfWeek(addDays(todayIn(), 7)));
  const shifts = list(wf.shiftTypes).sort((a, b) => (a.order || 0) - (b.order || 0));
  const open = p => { setOpenId(p.id); setDraft({ name: p.name, anchor: p.anchor, cycle: [...p.cycle] }); };
  const inUse = id => list(wf.patternAssignments).some(a => a.patternId === id);
  const add = () => {
    const p = { id: uid('pt_'), name: t('New pattern'), anchor: startOfWeek(todayIn()), cycle: [null, null, null, null, null, null, null] };
    commit([{ op: 'put', col: 'patterns', id: p.id, value: p }]);
    open(p);
  };
  return (
    <div className="flex flex-col gap-2">
      {current.length === 0 && <p className="text-sm text-ink-3">{t('No patterns yet. A pattern is a repeating cycle of shifts: one week for fixed shifts, several weeks for a rotation.')}</p>}
      {current.map(p => (
        <div key={p.id} className="rounded-control border border-line">
          <button type="button" className="ui-focus flex w-full items-center gap-2 px-3 py-2 text-left text-sm" aria-expanded={openId === p.id} onClick={() => (openId === p.id ? setOpenId(null) : open(p))}>
            <span className="wf-chevron" data-open={openId === p.id} aria-hidden="true">▸</span>
            <strong>{p.name}</strong>
            <span className="text-xs text-ink-3">{t('{n}-week cycle', { n: Math.ceil(p.cycle.length / 7) })} · {p.cycle.slice(0, 21).map(s => wf.shiftTypes[s]?.code || '·').join('')}</span>
          </button>
          {openId === p.id && draft && (
            <div className="border-t border-line p-3">
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <Field label={t('Name')}><Input value={draft.name} disabled={!editable} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
                <Field label={t('Week 1 starts on (a Monday)')}><Input type="date" value={draft.anchor} disabled={!editable} onChange={e => e.target.value && setDraft({ ...draft, anchor: startOfWeek(e.target.value) })} /></Field>
              </div>
              <div className="overflow-x-auto">
                <table className="wf-table">
                  <thead><tr><th>{t('Week')}</th>{WD.map(d => <th key={d}>{fmt.date(addDays('2026-11-01', d), 'weekday')}</th>)}</tr></thead>
                  <tbody>
                    {Array.from({ length: Math.ceil(draft.cycle.length / 7) }, (_, w) => (
                      <tr key={w}>
                        <td>{w + 1}</td>
                        {WD.map(d => {
                          const i = w * 7 + d - 1;
                          return (
                            <td key={d}>
                              <select className="ui-input" style={{ minWidth: 64 }} value={draft.cycle[i] || ''} disabled={!editable} aria-label={`${t('Week')} ${w + 1} ${fmt.date(addDays('2026-11-01', d), 'weekdayLong')}`}
                                onChange={e => { const cycle = [...draft.cycle]; cycle[i] = e.target.value || null; setDraft({ ...draft, cycle }); }}>
                                <option value="">–</option>
                                {shifts.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {editable && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Button onClick={() => setDraft({ ...draft, cycle: [...draft.cycle, ...draft.cycle.slice(-7)] })}>+ {t('Week')}</Button>
                  <Button disabled={draft.cycle.length <= 7} onClick={() => setDraft({ ...draft, cycle: draft.cycle.slice(0, -7) })}>− {t('Week')}</Button>
                  <span className="flex-1" />
                  {inUse(p.id) ? (
                    <>
                      <Field label={t('Change applies from')}><Input type="date" value={from} onChange={e => e.target.value && setFrom(e.target.value)} /></Field>
                      <Button variant="primary" onClick={() => { commit(editPatternFromOps(wf, p.id, draft, from), t('Pattern changed from {date}; earlier dates keep the old one', { date: fmt.date(from) })); setOpenId(null); }}>{t('Save from that date')}</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="danger" onClick={() => { commit([{ op: 'del', col: 'patterns', id: p.id }], t('Removed')); setOpenId(null); }}>{t('Remove')}</Button>
                      <Button variant="primary" onClick={() => { commit([{ op: 'put', col: 'patterns', id: p.id, value: { ...p, ...draft } }], t('Pattern saved')); setOpenId(null); }}>{t('Save')}</Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {editable && <div><Button onClick={add}>+ {t('Add pattern')}</Button></div>}
    </div>
  );
}

function TeamPatterns() {
  const { t, fmt } = useI18n();
  const { wf, can, commit } = useWorkforce();
  const [form, setForm] = useState({ teamId: '', patternId: '', from: startOfWeek(addDays(todayIn(), 7)), week: 1 });
  const [confirm, setConfirm] = useState(false);
  const patterns = list(wf.patterns).filter(p => !list(wf.patterns).some(q => q.supersedes === p.id));
  const today = todayIn();
  const rows = list(wf.teams).map(team => {
    const all = list(wf.patternAssignments).filter(a => a.target === 'team' && a.targetId === team.id).sort((a, b) => a.from.localeCompare(b.from));
    return { team, now: all.filter(a => a.from <= today && (!a.to || a.to >= today)).pop(), next: all.find(a => a.from > today) };
  });
  if (!rows.length) return null;
  const pattern = wf.patterns[form.patternId];
  const apply = () => {
    // Offset so the chosen cycle week is the week of the start date.
    const n = pattern.cycle.length;
    const dayIndex = Math.round((Date.parse(startOfWeek(form.from)) - Date.parse(pattern.anchor)) / 86400000);
    const offset = ((((form.week - 1) * 7 - dayIndex) % n) + n) % n;
    commit(assignPatternOps(wf, 'team', form.teamId, form.patternId, form.from, offset), t('{team}: new pattern from {date}', { team: wf.teams[form.teamId].name, date: fmt.date(form.from) }));
    setConfirm(false);
  };
  return (
    <div className="mt-4">
      <h4 className="mb-1 text-xs font-semibold text-ink-3">{t('Which pattern each team follows')}</h4>
      <ul className="mb-3 text-sm">
        {rows.map(r => (
          <li key={r.team.id}>
            <strong>{r.team.name}</strong>: {r.now ? wf.patterns[r.now.patternId]?.name : t('no pattern')}
            {r.next && <span className="text-ink-3"> · {t('from {date}: {name}', { date: fmt.date(r.next.from), name: wf.patterns[r.next.patternId]?.name })}</span>}
          </li>
        ))}
      </ul>
      {can('schedule.edit') && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t('Team')}><Select value={form.teamId} onChange={e => setForm({ ...form, teamId: e.target.value })}><option value="">{t('Choose…')}</option>{rows.map(r => <option key={r.team.id} value={r.team.id}>{r.team.name}</option>)}</Select></Field>
          <Field label={t('Pattern')}><Select value={form.patternId} onChange={e => setForm({ ...form, patternId: e.target.value, week: 1 })}><option value="">{t('Choose…')}</option>{patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label={t('From')}><Input type="date" value={form.from} onChange={e => e.target.value && setForm({ ...form, from: e.target.value })} /></Field>
          {pattern && pattern.cycle.length > 7 && (
            <Field label={t('Starting in cycle week')}><Select value={form.week} onChange={e => setForm({ ...form, week: Number(e.target.value) })}>{Array.from({ length: Math.ceil(pattern.cycle.length / 7) }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</Select></Field>
          )}
          <Button disabled={!form.teamId || !form.patternId} onClick={() => setConfirm(true)}>{t('Change pattern')}</Button>
        </div>
      )}
      {confirm && (
        <Confirm title={t('Change the team’s pattern?')} confirmLabel={t('Change from this date')} onCancel={() => setConfirm(false)} onConfirm={apply}
          body={t('Everyone in {team} follows “{pattern}” from {date}. Earlier dates keep the schedule they had.', { team: wf.teams[form.teamId]?.name, pattern: pattern?.name, date: fmt.date(form.from) })} />
      )}
    </div>
  );
}

function Shortcuts() {
  const { t } = useI18n();
  const [map, setMap] = useState(loadShortcuts);
  const set = (id, key) => { const next = { ...map, [id]: key.slice(-1).toLowerCase() }; setMap(next); saveShortcuts(next); };
  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {SHORTCUT_ACTIONS.map(a => (
          <label key={a.id} className="flex items-center justify-between gap-2 text-sm">
            {t(a.label)}
            <input className="ui-input w-12 text-center" value={map[a.id]} maxLength={2} onChange={e => set(a.id, e.target.value)} aria-label={t(a.label)} />
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-3">{t('Also: arrow keys move between shifts, Enter opens one, a shift’s code letter sets it, Ctrl+Z undoes, Ctrl+Shift+Z redoes. Saved in this browser; reload the page after changing.')}</p>
    </div>
  );
}
