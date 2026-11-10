/* People: one shared profile per operator (no login needed), the competency
 * matrix, skill-based groups and import from Excel/CSV. */
import { useMemo, useState } from 'react';
import { Button, Pill, Segmented } from '../ui';
import { useI18n } from '../i18n';
import { useWorkforce } from './store-context';
import { Avatar, Confirm, EmploymentMark, Empty, Field, Input, PageHeader, Select, Sheet } from './ui';
import { usePref } from './prefs';
import { addDays, dateRange, todayIn } from './logic/time';
import { displayName, levelsOf, list, settingsOf, uid } from './logic/model';
import { confirmMoveOps, moveTeamOps, resolveShift, teamOf } from './logic/schedule';
import { matchPeople } from './logic/coverage';
import { parseCsv } from './logic/csv';
import { importOps, previewPeopleImport } from './logic/importPeople';

const personFromHash = () => (window.location.hash.match(/^#\/people\/(.+)$/) || [])[1] || null;

export default function PeopleView() {
  const { t, fmt } = useI18n();
  const { wf, idx, can, commit, phase } = useWorkforce();
  const today = todayIn();
  const settings = settingsOf(wf);
  const [pref, setPref] = usePref('people', { tab: 'list', team: 'all', emp: 'all', group: false, need: [], needCerts: [] });
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(personFromHash);
  const [importing, setImporting] = useState(false);
  const levels = levelsOf(wf);
  const skills = list(wf.skills);
  const certs = list(wf.certs);
  const open = id => { setOpenId(id); window.history.replaceState(null, '', id ? `#/people/${id}` : '#/people'); };

  const people = useMemo(() => {
    const matching = (pref.need.length || pref.needCerts.length) ? new Set(matchPeople(wf, { skills: pref.need.map(skillId => ({ skillId, minLevelId: levels.find(l => l.counts === 'full')?.id })), certs: pref.needCerts, date: today })) : null;
    return list(wf.people)
      .map(p => ({ ...p, teamId: teamOf(idx, p.id, today) }))
      .filter(p => pref.team === 'all' || p.teamId === pref.team)
      .filter(p => pref.emp === 'all' || p.employment === pref.emp)
      .filter(p => !matching || matching.has(p.id))
      .filter(p => !q || `${p.name} ${p.nickname || ''}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (pref.group ? String(a.employment).localeCompare(String(b.employment)) : 0) || a.name.localeCompare(b.name, fmt.locale));
  }, [wf, idx, pref, q, today, levels, fmt.locale]);

  const add = () => {
    const id = uid('p_');
    commit([{ op: 'put', col: 'people', id, value: { id, name: t('New person'), nickname: '', employment: 'permanent', notes: '' } }]);
    open(id);
  };
  const toggleNeed = (key, id) => setPref(p => ({ ...p, [key]: p[key].includes(id) ? p[key].filter(x => x !== id) : [...p[key], id] }));
  const certState = (personId, cert) => {
    const c = wf.qualifications[personId]?.certs?.[cert.id];
    if (!c) return null;
    if (c.expires && c.expires < today) return { tone: 'bad', text: fmt.date(c.expires, 'full') };
    if (c.expires && c.expires <= addDays(today, 60)) return { tone: 'warn', text: fmt.date(c.expires, 'full') };
    return { tone: 'ok', text: c.expires ? fmt.date(c.expires, 'full') : '✓' };
  };

  if (phase !== 'ready') return null;
  return (
    <div className="wf-page">
      <PageHeader title={t('People')}>
        <Segmented label={t('View')} value={pref.tab} onChange={tab => setPref({ tab })} options={[{ value: 'list', label: t('List') }, { value: 'matrix', label: t('Competency matrix') }]} />
        {can('people.edit') && <Button onClick={() => setImporting(true)}>{t('Import…')}</Button>}
        {can('people.edit') && <Button variant="primary" onClick={add}>+ {t('Add person')}</Button>}
      </PageHeader>
      <div className="wf-toolbar">
        <Input placeholder={t('Search name…')} value={q} onChange={e => setQ(e.target.value)} aria-label={t('Search name…')} />
        <Select value={pref.team} onChange={e => setPref({ team: e.target.value })} aria-label={t('Team')}>
          <option value="all">{t('All teams')}</option>{list(wf.teams).map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
        </Select>
        <Select value={pref.emp} onChange={e => setPref({ emp: e.target.value })} aria-label={t('Employment')}>
          <option value="all">{t('All employment types')}</option><option value="permanent">{t('Permanent')}</option><option value="consultant">{t('Consultant')}</option>
        </Select>
        <button type="button" className="wf-chip" aria-pressed={pref.group} onClick={() => setPref({ group: !pref.group })}>{t('Group by employment')}</button>
        <span className="text-xs text-ink-3">{t('{n} people', { n: people.length })}</span>
      </div>
      {(skills.length > 0 || certs.length > 0) && (
        <div className="wf-toolbar" aria-label={t('Find people who have all of')}>
          <span className="text-xs font-semibold text-ink-3">{t('Find people who have all of')}:</span>
          {skills.map(s => <button type="button" key={s.id} className="wf-chip" aria-pressed={pref.need.includes(s.id)} onClick={() => toggleNeed('need', s.id)}>{s.name}</button>)}
          {certs.map(c => <button type="button" key={c.id} className="wf-chip" aria-pressed={pref.needCerts.includes(c.id)} onClick={() => toggleNeed('needCerts', c.id)}>◇ {c.name}</button>)}
          {(pref.need.length > 0 || pref.needCerts.length > 0) && <Button variant="ghost" onClick={() => setPref({ need: [], needCerts: [] })}>{t('Clear')}</Button>}
        </div>
      )}

      <div key={pref.tab} className="wf-scroll wf-view">
        {list(wf.people).length === 0 ? (
          <Empty title={t('No people yet')} action={can('people.edit') && <><Button variant="primary" onClick={add}>+ {t('Add person')}</Button><Button onClick={() => setImporting(true)}>{t('Import…')}</Button></>}>
            {t('Add operators one by one, or import them from Excel or CSV. They don’t need a login.')}
          </Empty>
        ) : pref.tab === 'list' ? (
          <table className="wf-table">
            <thead><tr><th>{t('Name')}</th><th>{t('Team')}</th><th>{t('Employment')}</th><th>{t('Competencies')}</th><th>{t('Certificates')}</th></tr></thead>
            <tbody>
              {people.map((p, i) => (
                <FragmentRow key={p.id} header={pref.group && (i === 0 || people[i - 1].employment !== p.employment) ? (p.employment === 'consultant' ? t('Consultants') : t('Permanent employees')) : null} span={5}>
                  <tr className="wf-rowbtn" onClick={() => open(p.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') open(p.id); }}>
                    <td><span className="flex items-center gap-2"><Avatar person={p} /><span><strong>{displayName(p, settings.nicknameIn.people)}</strong>{p.nickname && <span className="block text-xs text-ink-3">{settings.nicknameIn.people ? p.name : `“${p.nickname}”`}</span>}</span></span></td>
                    <td>{wf.teams[p.teamId]?.name || '—'}</td>
                    <td><span className="flex items-center gap-2"><EmploymentMark person={p} mode="dot" />{p.employment === 'consultant' ? t('Consultant') : t('Permanent')}</span></td>
                    <td>{skills.filter(s => wf.qualifications[p.id]?.skills?.[s.id]).map(s => s.name).join(', ') || '—'}</td>
                    <td>{certs.map(c => { const st = certState(p.id, c); return st ? <Pill key={c.id} tone={st.tone} className="mr-1">{c.name}{st.tone !== 'ok' ? ` · ${st.text}` : ''}</Pill> : null; })}</td>
                  </tr>
                </FragmentRow>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="wf-table mx">
            <thead>
              <tr><th>{t('Name')}</th>{skills.map(s => <th key={s.id}>{s.name}</th>)}{certs.map(c => <th key={c.id}>◇ {c.name}</th>)}</tr>
            </thead>
            <tbody>
              {people.map((p, i) => (
                <FragmentRow key={p.id} header={pref.group && (i === 0 || people[i - 1].employment !== p.employment) ? (p.employment === 'consultant' ? t('Consultants') : t('Permanent employees')) : null} span={1 + skills.length + certs.length}>
                  <tr>
                    <td><button type="button" className="ui-focus flex items-center gap-2 text-left" onClick={() => open(p.id)}><Avatar person={p} size={22} />{p.name}<EmploymentMark person={p} mode={settings.employmentIndicator} /></button></td>
                    {skills.map(s => <td key={s.id}><LevelCell personId={p.id} skill={s} /></td>)}
                    {certs.map(c => { const st = certState(p.id, c); return <td key={c.id}>{st ? <Pill tone={st.tone}>{st.text}</Pill> : <span className="text-ink-3">–</span>}</td>; })}
                  </tr>
                </FragmentRow>
              ))}
            </tbody>
          </table>
        )}
        {pref.tab === 'matrix' && <p className="px-4 py-3 text-xs text-ink-3">{levels.map(l => `${l.rank} = ${fmt.name(l.name)}`).join(' · ')} — {t('An overview for planning. The official training and certification record stays in the company system.')}</p>}
      </div>

      {openId && wf.people[openId] && <Profile personId={openId} onClose={() => open(null)} />}
      {importing && <ImportSheet onClose={() => setImporting(false)} />}
    </div>
  );
}

function FragmentRow({ header, span, children }) {
  return <>{header && <tr><th colSpan={span} style={{ position: 'static' }}>{header}</th></tr>}{children}</>;
}

function LevelCell({ personId, skill }) {
  const { t, fmt } = useI18n();
  const { wf, can, commit } = useWorkforce();
  const levels = levelsOf(wf);
  const q = wf.qualifications[personId] || { id: personId, skills: {}, certs: {} };
  const level = levels.find(l => l.id === q.skills?.[skill.id]);
  const set = levelId => {
    const next = { ...(q.skills || {}) };
    if (levelId) next[skill.id] = levelId; else delete next[skill.id];
    commit([{ op: 'put', col: 'qualifications', id: personId, value: { ...q, id: personId, skills: next } }], t('{name}: {skill} → {level}', { name: wf.people[personId]?.name, skill: skill.name, level: levelId ? fmt.name(levels.find(l => l.id === levelId).name) : '–' }));
  };
  if (!can('competencies.edit')) return <span className="mx__lvl" data-rank={level?.rank || 0} title={fmt.name(level?.name)}>{level?.rank || '–'}</span>;
  return (
    <select className="mx__lvl" data-rank={level?.rank || 0} value={level?.id || ''} onChange={e => set(e.target.value)} aria-label={`${wf.people[personId]?.name}: ${skill.name}`} title={fmt.name(level?.name)}>
      <option value="">–</option>
      {levels.map(l => <option key={l.id} value={l.id}>{l.rank} {fmt.name(l.name)}</option>)}
    </select>
  );
}

function Profile({ personId, onClose }) {
  const { t, fmt } = useI18n();
  const { wf, idx, can, commit } = useWorkforce();
  const p = wf.people[personId];
  const today = todayIn();
  const editable = can('people.edit');
  const canComp = can('competencies.edit');
  const levels = levelsOf(wf);
  const [move, setMove] = useState({ teamId: '', from: today });
  const [removing, setRemoving] = useState(false);
  const save = patch => commit([{ op: 'put', col: 'people', id: personId, value: { ...p, ...patch } }]);
  const q = wf.qualifications[personId] || { id: personId, skills: {}, certs: {} };
  const saveQ = next => commit([{ op: 'put', col: 'qualifications', id: personId, value: { ...q, ...next, id: personId } }]);
  const teamId = teamOf(idx, personId, today);
  const pending = list(wf.memberships).filter(m => m.personId === personId && m.status === 'pending');
  const history = list(wf.memberships).filter(m => m.personId === personId && m.status !== 'pending').sort((a, b) => b.from.localeCompare(a.from));
  const next14 = dateRange(today, addDays(today, 13)).map(d => ({ d, r: resolveShift(wf, idx, personId, d) }));
  const onAvatar = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Shrink to a small square so profiles stay light.
    const img = await createImageBitmap(file);
    const c = document.createElement('canvas'); c.width = 96; c.height = 96;
    const s = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96);
    save({ avatar: c.toDataURL('image/jpeg', 0.8) });
  };
  const text = (k, label, type = 'text') => (
    <Field label={label}>
      <Input type={type} defaultValue={p[k] || ''} key={`${k}-${p._rev}`} disabled={!editable} onBlur={e => { if ((e.target.value || '') !== (p[k] || '')) save({ [k]: e.target.value }); }} />
    </Field>
  );

  return (
    <Sheet wide title={p.name} subtitle={[wf.teams[teamId]?.name, p.employment === 'consultant' ? t('Consultant') : t('Permanent')].filter(Boolean).join(' · ')} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-wrap items-start gap-4">
          <div className="flex flex-col items-center gap-2">
            <Avatar person={p} size={72} />
            {editable && <label className="ui-btn ui-btn--ghost cursor-pointer text-xs">{t('Change photo')}<input type="file" accept="image/*" className="sr-only" onChange={onAvatar} /></label>}
            {editable && p.avatar && <Button variant="ghost" onClick={() => save({ avatar: null })}>{t('Remove photo')}</Button>}
          </div>
          <div className="grid flex-1 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {text('name', t('Real name'))}
            {text('nickname', t('Nickname (optional)'))}
            <Field label={t('Employment')}>
              <Select value={p.employment || 'permanent'} disabled={!editable} onChange={e => save({ employment: e.target.value })}>
                <option value="permanent">{t('Permanent')}</option><option value="consultant">{t('Consultant')}</option>
              </Select>
            </Field>
            <Field label={t('Colour')}><Input type="color" value={p.color || '#888888'} disabled={!editable} onChange={e => save({ color: e.target.value })} /></Field>
            {text('startDate', t('First day'), 'date')}
            {text('endDate', t('Last day'), 'date')}
            {text('notes', t('Planning notes'))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{t('Team')}</h3>
          <p className="text-sm">{t('Now')}: <strong>{wf.teams[teamId]?.name || t('No team')}</strong></p>
          {history.length > 1 && <p className="text-xs text-ink-3">{t('History')}: {history.map(m => `${wf.teams[m.teamId]?.name || '?'} ${fmt.date(m.from, 'full')}${m.to ? `–${fmt.date(m.to, 'full')}` : '–'}`).join(' · ')}</p>}
          {pending.map(m => (
            <div key={m.id} className="mt-2 flex flex-wrap items-center gap-2 rounded-control bg-warn-bg px-3 py-2 text-sm text-warn-fg">
              {t('Move to {team} from {date} is waiting for a manager.', { team: wf.teams[m.teamId]?.name, date: fmt.date(m.from, 'full') })}
              <span className="flex-1" />
              {can('teams.confirm') && <Button onClick={() => commit(confirmMoveOps(wf, m.id), t('Team move confirmed'))}>{t('Confirm')}</Button>}
              {can('schedule.edit') && <Button variant="ghost" onClick={() => commit([{ op: 'del', col: 'memberships', id: m.id }], t('Team move withdrawn'))}>{t('Withdraw')}</Button>}
            </div>
          ))}
          {can('schedule.edit') && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Field label={t('Move to team')}><Select value={move.teamId} onChange={e => setMove({ ...move, teamId: e.target.value })}><option value="">{t('Choose…')}</option>{list(wf.teams).filter(tm => tm.id !== teamId).map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}</Select></Field>
              <Field label={t('From')}><Input type="date" value={move.from} onChange={e => e.target.value && setMove({ ...move, from: e.target.value })} /></Field>
              <Button disabled={!move.teamId} onClick={() => { commit(moveTeamOps(wf, personId, move.teamId, move.from, can('teams.confirm')), can('teams.confirm') || !settingsOf(wf).requireMoveConfirmation ? t('{name} moves to {team} from {date}', { name: p.name, team: wf.teams[move.teamId].name, date: fmt.date(move.from) }) : t('Move sent to a manager to confirm')); setMove({ ...move, teamId: '' }); }}>{t('Move')}</Button>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{t('Competencies')}</h3>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {list(wf.skills).map(s => (
              <Field key={s.id} label={s.name}>
                <Select value={q.skills?.[s.id] || ''} disabled={!canComp} onChange={e => { const skills = { ...(q.skills || {}) }; if (e.target.value) skills[s.id] = e.target.value; else delete skills[s.id]; saveQ({ skills }); }}>
                  <option value="">–</option>{levels.map(l => <option key={l.id} value={l.id}>{fmt.name(l.name)}</option>)}
                </Select>
              </Field>
            ))}
          </div>
          <h3 className="mb-2 mt-4 text-sm font-semibold">{t('Certificates')}</h3>
          <ul className="flex flex-col gap-2">
            {list(wf.certs).map(c => {
              const held = q.certs?.[c.id];
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="ui-check"><input type="checkbox" checked={!!held} disabled={!canComp} onChange={e => { const certsNext = { ...(q.certs || {}) }; if (e.target.checked) certsNext[c.id] = { expires: null }; else delete certsNext[c.id]; saveQ({ certs: certsNext }); }} />{c.name}</label>
                  {held && c.expires && <Field label={t('Valid until')}><Input type="date" value={held.expires || ''} disabled={!canComp} onChange={e => saveQ({ certs: { ...q.certs, [c.id]: { expires: e.target.value || null } } })} /></Field>}
                  {held?.expires && held.expires < today && <Pill tone="bad">{t('Expired')}</Pill>}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-ink-3">{t('An overview for planning. The official training and certification record stays in the company system.')}</p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{t('Next 14 days')}</h3>
          <div className="flex flex-wrap gap-1">
            {next14.map(({ d, r }) => {
              const st = wf.shiftTypes[r.shiftTypeId];
              return <span key={d} className="flex w-11 flex-col items-center rounded-control border border-line py-1 text-[11px]" title={fmt.date(d, 'long')}><span className="text-ink-3">{fmt.date(d, 'weekday')}</span><span>{fmt.date(d, 'day')}</span><strong style={{ color: st?.color }}>{st?.code || '·'}</strong></span>;
            })}
          </div>
        </section>

        {editable && <div><Button variant="danger" onClick={() => setRemoving(true)}>{t('Remove this person')}</Button></div>}
      </div>
      {removing && (
        <Confirm danger title={t('Remove {name}?', { name: p.name })} body={t('The profile, competencies and team membership are removed. Attendance records stay. To keep history, set a last day instead. You can undo this.')}
          confirmLabel={t('Remove')} onCancel={() => setRemoving(false)}
          onConfirm={() => {
            commit([{ op: 'del', col: 'people', id: personId }, ...(wf.qualifications[personId] ? [{ op: 'del', col: 'qualifications', id: personId }] : []), ...list(wf.memberships).filter(m => m.personId === personId).map(m => ({ op: 'del', col: 'memberships', id: m.id }))], t('{name} removed', { name: p.name }));
            onClose();
          }} />
      )}
    </Sheet>
  );
}

function ImportSheet({ onClose }) {
  const { t } = useI18n();
  const { wf, commit } = useWorkforce();
  const [text, setText] = useState('');
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState(null);
  const read = src => {
    const pv = previewPeopleImport(wf, levelsOf(wf), parseCsv(src));
    setRows(pv.rows); setMeta(pv);
  };
  const onFile = async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) read(await f.text()); };
  const problems = { noNameColumn: t('no “name” column'), noName: t('no name'), duplicateInFile: t('same name twice in the file') };
  const count = rows ? rows.filter(r => r.action !== 'skip').length : 0;
  return (
    <Sheet wide title={t('Import people')} onClose={onClose}
      footer={rows && <><Button onClick={() => setRows(null)}>{t('Back')}</Button><Button variant="primary" disabled={!count} onClick={() => { commit(importOps(wf, rows, todayIn()), t('{n} people imported', { n: count })); onClose(); }}>{t('Import {n} people', { n: count })}</Button></>}>
      {!rows ? (
        <div className="flex flex-col gap-3 text-sm">
          <p>{t('Use a sheet with a header row. Columns: name (required), nickname, employment (consultant / permanent), team, then one column per competency (a level) and per certificate (yes, or an expiry date like 2027-06-30).')}</p>
          <label className="ui-btn w-fit cursor-pointer">{t('Choose a CSV file…')}<input type="file" accept=".csv,.txt,text/csv" className="sr-only" onChange={onFile} /></label>
          <p className="text-xs text-ink-3">{t('From Excel: save as CSV, or copy the cells and paste them below.')}</p>
          <textarea className="ui-input" style={{ height: 160, padding: 8 }} value={text} onChange={e => setText(e.target.value)} placeholder={t('Paste cells here…')} aria-label={t('Paste cells here…')} />
          <Button className="w-fit" disabled={!text.trim()} onClick={() => read(text)}>{t('Preview')}</Button>
        </div>
      ) : (
        <div className="text-sm">
          <p className="mb-2">{t('Nothing is saved yet. Check each row, then import.')}</p>
          {meta.ignored.length > 0 && <p className="mb-2 text-xs text-warn-fg">{t('Columns not recognised and ignored: {cols}', { cols: meta.ignored.join(', ') })}</p>}
          <div className="overflow-x-auto">
            <table className="wf-table">
              <thead><tr><th>{t('Row')}</th><th>{t('Name')}</th><th>{t('Found')}</th><th>{t('Problems')}</th><th>{t('Do')}</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.row}>
                    <td>{r.row}</td><td>{r.name || '—'}</td>
                    <td className="text-xs">{[r.employment && t(r.employment === 'consultant' ? 'Consultant' : 'Permanent'), wf.teams[r.teamId]?.name, Object.keys(r.skills).length && t('{n} competencies', { n: Object.keys(r.skills).length }), Object.keys(r.certs).length && t('{n} certificates', { n: Object.keys(r.certs).length })].filter(Boolean).join(' · ')}</td>
                    <td className="text-xs">{r.errors.map(e => <span key={e} className="block font-semibold text-bad-fg">{problems[e]}</span>)}{r.warnings.map(w => <span key={w} className="block text-warn-fg">{t('not understood, left out')}: {w}</span>)}{r.match && <span className="block text-ink-3">{t('already exists')}</span>}</td>
                    <td>
                      {r.errors.length ? t('Skip') : (
                        <Select value={r.action} onChange={e => setRows(rows.map((x, k) => (k === i ? { ...x, action: e.target.value } : x)))} aria-label={t('Do')}>
                          {r.match ? <option value="update">{t('Update existing')}</option> : <option value="add">{t('Add')}</option>}
                          {r.match && <option value="add">{t('Add as a new person')}</option>}
                          <option value="skip">{t('Skip')}</option>
                        </Select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Sheet>
  );
}
