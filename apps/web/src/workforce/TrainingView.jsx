/* Training planning: where each team is thin, planned training with a
 * trainer and progress, and certificates about to expire. */
import { useMemo, useState } from 'react';
import { Button, Pill } from '../ui';
import { useI18n } from '../i18n';
import { useWorkforce } from './store-context';
import { Collapsible, Empty, Field, Input, PageHeader, Select, Sheet } from './ui';
import { STATUS_TONE } from './prefs';
import { todayIn } from './logic/time';
import { levelsOf, list, uid } from './logic/model';
import { expiringCerts, skillGaps, trainersFor } from './logic/training';

export default function TrainingView() {
  const { t, fmt } = useI18n();
  const { wf, idx, can, phase } = useWorkforce();
  const today = todayIn();
  const [form, setForm] = useState(null);
  const canEdit = can('training.edit');
  const levels = levelsOf(wf);
  const gaps = useMemo(() => skillGaps(wf, idx, today), [wf, idx, today]);
  const expiring = useMemo(() => expiringCerts(wf, today), [wf, today]);
  const trainings = list(wf.trainings).sort((a, b) => (a.status === 'done') - (b.status === 'done') || String(a.from).localeCompare(String(b.from)));
  const name = id => wf.people[id]?.name || '—';
  const blank = (personId = '', skillId = '') => ({ id: uid('tr_'), personId, skillId, targetLevelId: levels.find(l => l.counts === 'full')?.id || '', trainerId: '', from: today, to: '', status: 'planned', progress: 0, note: '' });
  const statusLabel = { planned: t('Planned'), ongoing: t('Ongoing'), done: t('Completed') };

  if (phase !== 'ready') return null;
  if (!list(wf.people).length) return <div className="wf-page"><PageHeader title={t('Training')} /><Empty title={t('No people yet')}>{t('Add people and shift patterns in Setup, or load the demo plant there to look around.')}</Empty></div>;
  return (
    <div className="wf-page">
      <PageHeader title={t('Training')}>{canEdit && <Button variant="primary" onClick={() => setForm(blank())}>+ {t('Plan training')}</Button>}</PageHeader>
      <div className="wf-scroll"><div className="wf-body">
        <p className="text-xs text-ink-3">{t('A visual planning aid. Formal assessment, sign-off and the official GMP training record stay in the company system.')}</p>

        <Collapsible id="tr-plan" title={`${t('Planned training')} · ${trainings.filter(x => x.status !== 'done').length}`}>
          {trainings.length === 0 ? <p className="text-sm text-ink-3">{t('Nothing planned yet. Use the gaps below to pick what helps coverage most.')}</p> : (
            <div className="overflow-x-auto"><table className="wf-table">
              <thead><tr><th>{t('Person')}</th><th>{t('Competency')}</th><th>{t('Target level')}</th><th>{t('Trainer')}</th><th>{t('Period')}</th><th>{t('Progress')}</th><th>{t('Status')}</th></tr></thead>
              <tbody>{trainings.map(x => (
                <tr key={x.id} className="wf-rowbtn" tabIndex={0} onClick={() => setForm(x)} onKeyDown={e => { if (e.key === 'Enter') setForm(x); }}>
                  <td>{name(x.personId)}</td><td>{wf.skills[x.skillId]?.name || '—'}</td><td>{fmt.name(levels.find(l => l.id === x.targetLevelId)?.name)}</td>
                  <td>{x.trainerId ? name(x.trainerId) : <span className="text-warn-fg">{t('No trainer yet')}</span>}</td>
                  <td>{fmt.date(x.from)}{x.to ? ` – ${fmt.date(x.to)}` : ''}</td>
                  <td><progress max="100" value={x.progress || 0} aria-label={t('Progress')} /> {x.progress || 0}%</td>
                  <td><Pill tone={x.status === 'done' ? 'ok' : x.status === 'ongoing' ? 'warn' : 'idle'}>{statusLabel[x.status]}</Pill></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Collapsible>

        <Collapsible id="tr-gaps" title={t('Where teams are thin')}>
          <p className="mb-2 text-xs text-ink-3">{t('People who can fill a position on their own, against the most a team must supply on one shift. “No margin” means one absence opens a gap.')}</p>
          {gaps.length === 0 ? <p className="text-sm text-ink-3">{t('Add staffing requirements in Setup to see gaps.')}</p> : (
            <div className="overflow-x-auto"><table className="wf-table">
              <thead><tr><th>{t('Team')}</th><th>{t('Competency')}</th><th className="num">{t('Qualified')}</th><th className="num">{t('Needed')}</th><th>{t('Margin')}</th><th>{t('Training that would help')}</th></tr></thead>
              <tbody>{gaps.filter(g => g.status !== 'met').concat(gaps.filter(g => g.status === 'met')).slice(0, 40).map(g => (
                <tr key={g.teamId + g.skillId}>
                  <td>{wf.teams[g.teamId]?.name}</td><td>{wf.skills[g.skillId]?.name}</td><td className="num">{g.qualified}</td><td className="num">{g.required}</td>
                  <td><Pill tone={STATUS_TONE[g.status]}>{g.status === 'short' ? t('{n} short', { n: -g.margin }) : g.status === 'risk' ? t('No margin') : `+${g.margin}`}</Pill></td>
                  <td className="text-xs">
                    {g.status === 'met' ? '' : g.planned ? t('{n} planned', { n: g.planned }) + ' · ' : ''}
                    {g.status !== 'met' && g.candidates.slice(0, 3).map(id => (
                      canEdit ? <button type="button" key={id} className="wf-chip mr-1" onClick={() => setForm(blank(id, g.skillId))}>+ {name(id)}{g.inTraining.includes(id) ? ` (${t('started')})` : ''}</button> : <span key={id} className="mr-2">{name(id)}</span>
                    ))}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Collapsible>

        <Collapsible id="tr-certs" title={`${t('Certificates expiring within 90 days')} · ${expiring.length}`}>
          {expiring.length === 0 ? <p className="text-sm text-ink-3">{t('None.')}</p> : (
            <ul className="flex flex-col gap-1 text-sm">{expiring.map(c => (
              <li key={c.personId + c.certId} className="flex flex-wrap items-center gap-2"><Pill tone={c.expired ? 'bad' : 'warn'}>{fmt.date(c.expires, 'full')}</Pill>{name(c.personId)} · {wf.certs[c.certId].name}{c.expired ? ` · ${t('Expired')}` : ''}</li>
            ))}</ul>
          )}
        </Collapsible>
      </div></div>
      {form && <TrainingForm value={form} onClose={() => setForm(null)} exists={!!wf.trainings[form.id]} />}
    </div>
  );

}

function TrainingForm({ value, onClose, exists }) {
  const { t, fmt } = useI18n();
  const { wf, can, commit } = useWorkforce();
  const canEdit = can('training.edit');
  const levels = levelsOf(wf);
  const name = id => wf.people[id]?.name || '—';
  const statusLabel = { planned: t('Planned'), ongoing: t('Ongoing'), done: t('Completed') };
  const [f, setF] = useState(value);
  const set = patch => setF(prev => ({ ...prev, ...patch }));
  const trainers = f.skillId ? trainersFor(wf, f.skillId).filter(id => id !== f.personId) : [];
  const q = wf.qualifications[f.personId] || { id: f.personId, skills: {}, certs: {} };
  const save = extra => { commit([{ op: 'put', col: 'trainings', id: f.id, value: { ...f, ...extra } }], t('Training saved')); onClose(); };
  return (
    <Sheet title={exists ? t('Training') : t('Plan training')} onClose={onClose}
      footer={canEdit && <>{exists && <Button variant="danger" onClick={() => { commit([{ op: 'del', col: 'trainings', id: f.id }], t('Training removed')); onClose(); }}>{t('Remove')}</Button>}<Button variant="primary" disabled={!f.personId || !f.skillId} onClick={() => save()}>{t('Save')}</Button></>}>
      <fieldset disabled={!canEdit} className="flex flex-col gap-3">
        <Field label={t('Person')}><Select value={f.personId} onChange={e => set({ personId: e.target.value })}><option value="">{t('Choose…')}</option>{list(wf.people).sort((a, b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label={t('Competency')}><Select value={f.skillId} onChange={e => set({ skillId: e.target.value, trainerId: '' })}><option value="">{t('Choose…')}</option>{list(wf.skills).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label={t('Target level')}><Select value={f.targetLevelId} onChange={e => set({ targetLevelId: e.target.value })}>{levels.map(l => <option key={l.id} value={l.id}>{fmt.name(l.name)}</option>)}</Select></Field>
        <Field label={t('Trainer')} hint={f.skillId && !trainers.length ? t('Nobody has a level that can supervise this competency.') : undefined}>
          <Select value={f.trainerId} onChange={e => set({ trainerId: e.target.value })}><option value="">{t('Not decided')}</option>{trainers.map(id => <option key={id} value={id}>{name(id)}</option>)}</Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Field label={t('From')}><Input type="date" value={f.from || ''} onChange={e => set({ from: e.target.value })} /></Field>
          <Field label={t('To')}><Input type="date" value={f.to || ''} onChange={e => set({ to: e.target.value })} /></Field>
        </div>
        <Field label={`${t('Progress')}: ${f.progress || 0}%`}><input type="range" min="0" max="100" step="10" value={f.progress || 0} onChange={e => set({ progress: Number(e.target.value), status: Number(e.target.value) >= 100 ? 'done' : Number(e.target.value) > 0 ? 'ongoing' : f.status === 'done' ? 'ongoing' : f.status })} /></Field>
        <Field label={t('Status')}><Select value={f.status} onChange={e => set({ status: e.target.value })}>{Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label={t('Note')}><Input value={f.note || ''} onChange={e => set({ note: e.target.value })} /></Field>
      </fieldset>
      <p className="mt-3 text-xs text-ink-3">{t('Training time is not taken from staffing automatically. How a trainee counts on the line is set per level and process in Setup.')}</p>
      {exists && f.status === 'done' && can('competencies.edit') && q.skills?.[f.skillId] !== f.targetLevelId && (
        <div className="mt-3 rounded-control bg-soft p-3 text-sm">
          {t('Completed here. After the official sign-off, you can update the matrix.')}
          <Button className="mt-2" onClick={() => commit([{ op: 'put', col: 'qualifications', id: f.personId, value: { ...q, id: f.personId, skills: { ...q.skills, [f.skillId]: f.targetLevelId } } }], t('{name}: {skill} → {level}', { name: name(f.personId), skill: wf.skills[f.skillId]?.name, level: fmt.name(levels.find(l => l.id === f.targetLevelId)?.name) }))}>
            {t('Set the matrix to {level}', { level: fmt.name(levels.find(l => l.id === f.targetLevelId)?.name) })}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
