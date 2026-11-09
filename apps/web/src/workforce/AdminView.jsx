/* Access: who may sign in and what each role may do. Admin only; the server
 * enforces all of it (backend/access.js). */
import { useCallback, useEffect, useState } from 'react';
import { Button, Checkbox, Pill, useToast } from '../ui';
import { useI18n } from '../i18n';
import { apiFetch } from '../access';
import { useWorkforce } from './store-context';
import { Collapsible, Confirm, Empty, Field, Input, PageHeader, Select } from './ui';
import { list, settingsOf } from './logic/model';

export default function AdminView() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const { wf, me, commit, reload, offline } = useWorkforce();
  const [admin, setAdmin] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'teamlead', teams: [], personId: '' });
  const [removing, setRemoving] = useState(null);
  const settings = settingsOf(wf);

  const call = useCallback(async (method, path, body) => {
    const r = await apiFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { setError(data.error || `HTTP ${r.status}`); return false; }
    setError(null); setAdmin(data); return true;
  }, []);
  const isAdmin = me?.role === 'admin';
  useEffect(() => {
    if (!isAdmin || offline) return undefined;
    let live = true;
    apiFetch('/api/admin/state').then(r => r.json()).then(data => { if (live && data.users) setAdmin(data); }).catch(() => {});
    return () => { live = false; };
  }, [isAdmin, offline]);

  const roleLabel = { admin: t('Admin'), manager: t('Shift manager'), teamlead: t('Team lead'), viewer: t('Viewer'), operator: t('Operator') };
  const permLabel = {
    'workforce.view': t('See schedule, people and coverage'), 'schedule.edit': t('Change shifts and patterns'), 'people.edit': t('Add and edit people and teams'),
    'teams.confirm': t('Confirm team moves'), 'competencies.edit': t('Edit competencies and certificates'), 'requirements.edit': t('Edit staffing requirements'),
    'training.edit': t('Plan training'), 'events.edit': t('Edit calendar activities'), 'settings.edit': t('Change setup (shifts, levels, OB rules)'),
    'attendance.view': t('See attendance'), 'attendance.edit': t('Record attendance'), 'reports.view': t('See monthly reports'),
    'shifthq.view': t('See Shift HQ'), 'shifthq.edit': t('Edit Shift HQ'), 'vacations.view': t('See Vacations'), 'vacations.edit': t('Edit Vacations'),
    'boards.view': t('See Boards'), 'boards.edit': t('Edit Boards'), 'sketches.use': t('Use sketch boards'), 'self.view': t('See own schedule and competencies only'),
  };

  if (me && me.role !== 'admin') return <div className="wf-page"><PageHeader title={t('Access')} /><Empty title={t('Only the admin can manage access')} /></div>;
  if (!admin) return <div className="wf-page"><PageHeader title={t('Access')} />{error && <p className="p-4 text-sm text-bad-fg">{error}</p>}</div>;

  const users = Object.values(admin.users).sort((a, b) => a.email.localeCompare(b.email));
  const requests = Object.values(admin.requests);
  const editableRoles = admin.roles.filter(r => r !== 'admin');
  const has = (role, perm) => admin.permissions?.[role]?.[perm] ?? admin.defaults[perm].includes(role);
  const invite = async (data = form) => {
    if (await call('POST', '/api/admin/users', { ...data, personId: data.personId || null })) {
      toast(t('{email} can now sign in as {role}', { email: data.email, role: roleLabel[data.role] }));
      setForm({ email: '', name: '', role: 'teamlead', teams: [], personId: '' });
    }
  };
  const togglePerm = async (role, perm) => {
    const next = { ...admin.permissions, [role]: { ...(admin.permissions[role] || {}), [perm]: !has(role, perm) } };
    if (await call('PUT', '/api/admin/permissions', next)) reload({ quiet: true });
  };

  return (
    <div className="wf-page">
      <PageHeader title={t('Access')} />
      <div className="wf-scroll"><div className="wf-body">
        {error && <p className="rounded-control bg-bad-bg px-3 py-2 text-sm font-semibold text-bad-fg" role="alert">{error}</p>}
        <p className="text-sm text-ink-2">
          {me.via === 'open'
            ? t('Sign-in is not switched on for this server, so everyone who can reach it is treated as admin. Set ADMIN_EMAIL on the server to turn Google sign-in on.')
            : t('Admin account: {emails}. It is set in the server configuration, not here, so nobody can make themselves admin.', { emails: admin.adminEmails.join(', ') || '—' })}
        </p>

        {requests.length > 0 && (
          <Collapsible id="adm-req" title={`${t('Waiting for approval')} · ${requests.length}`}>
            <ul className="flex flex-col gap-2">{requests.map(r => (
              <li key={r.email} className="flex flex-wrap items-center gap-2 text-sm">
                <strong>{r.email}</strong><span className="text-xs text-ink-3">{fmt.stamp(Date.parse(r.at))}</span><span className="flex-1" />
                {editableRoles.filter(x => x !== 'operator').map(role => <Button key={role} onClick={() => invite({ email: r.email, name: '', role, teams: [], personId: '' })}>{t('Approve as {role}', { role: roleLabel[role] })}</Button>)}
                <Button variant="ghost" onClick={() => call('DELETE', `/api/admin/requests/${encodeURIComponent(r.email)}`)}>{t('Dismiss')}</Button>
              </li>
            ))}</ul>
          </Collapsible>
        )}

        <Collapsible id="adm-users" title={`${t('People with access')} · ${users.length}`}>
          {users.length === 0 && <p className="mb-2 text-sm text-ink-3">{t('Nobody is invited yet. Only the admin account can sign in.')}</p>}
          {users.length > 0 && (
            <div className="overflow-x-auto"><table className="wf-table">
              <thead><tr><th>{t('Google account')}</th><th>{t('Name')}</th><th>{t('Role')}</th><th>{t('Teams')}</th><th /></tr></thead>
              <tbody>{users.map(u => (
                <tr key={u.email}>
                  <td>{u.email}</td><td>{u.name}</td>
                  <td><Select value={u.role} onChange={e => call('POST', '/api/admin/users', { ...u, role: e.target.value })} aria-label={t('Role')}>{editableRoles.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}</Select></td>
                  <td>{u.teams?.length ? u.teams.map(id => wf.teams[id]?.name || id).join(', ') : t('All teams')}{u.role === 'operator' && <span className="block text-xs text-ink-3">{wf.people[u.personId]?.name || t('not linked to a profile')}</span>}</td>
                  <td><Button variant="ghost" onClick={() => setRemoving(u)}>{t('Remove access')}</Button></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          <h4 className="mb-1 mt-4 text-xs font-semibold text-ink-3">{t('Invite someone')}</h4>
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t('Google account (email)')}><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label={t('Name')}><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label={t('Role')}><Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{editableRoles.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}</Select></Field>
            {form.role === 'operator' && <Field label={t('Their profile')}><Select value={form.personId} onChange={e => setForm({ ...form, personId: e.target.value })}><option value="">{t('Choose…')}</option>{list(wf.people).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>}
            <Button variant="primary" disabled={!form.email.includes('@')} onClick={() => invite()}>{t('Give access')}</Button>
          </div>
          {form.role === 'teamlead' && list(wf.teams).length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs"><span className="text-ink-3">{t('Limit to teams (none = all)')}:</span>
              {list(wf.teams).map(tm => <button type="button" key={tm.id} className="wf-chip" aria-pressed={form.teams.includes(tm.id)} onClick={() => setForm({ ...form, teams: form.teams.includes(tm.id) ? form.teams.filter(x => x !== tm.id) : [...form.teams, tm.id] })}>{tm.name}</button>)}
            </div>
          )}
          <p className="mt-2 text-xs text-ink-3">{t('They sign in with Google using that address. No email is sent from here: tell them yourself.')}</p>
        </Collapsible>

        <Collapsible id="adm-perm" title={t('What each role may do')} defaultOpen={false}>
          <div className="overflow-x-auto"><table className="wf-table">
            <thead><tr><th>{t('Permission')}</th>{editableRoles.map(r => <th key={r} style={{ textAlign: 'center' }}>{roleLabel[r]}</th>)}</tr></thead>
            <tbody>{Object.keys(admin.defaults).map(perm => (
              <tr key={perm}><td>{permLabel[perm] || perm}</td>
                {editableRoles.map(role => <td key={role} style={{ textAlign: 'center' }}><input type="checkbox" checked={has(role, perm)} onChange={() => togglePerm(role, perm)} aria-label={`${roleLabel[role]}: ${permLabel[perm] || perm}`} /></td>)}
              </tr>
            ))}</tbody>
          </table></div>
          <div className="mt-2 flex items-center gap-2"><Pill tone="idle">{t('Admin')}</Pill><span className="text-xs text-ink-3">{t('always has every permission.')}</span>
            <span className="flex-1" /><Button variant="ghost" onClick={async () => { if (await call('PUT', '/api/admin/permissions', {})) reload({ quiet: true }); }}>{t('Back to the standard permissions')}</Button></div>
        </Collapsible>

        <Collapsible id="adm-op" title={t('Operator access')} defaultOpen={false}>
          <Checkbox checked={!!settings.operatorAccess} onChange={e => commit([{ op: 'put', col: 'settings', id: 'main', value: { ...settings, operatorAccess: e.target.checked } }], e.target.checked ? t('Operator access switched on') : t('Operator access switched off'))}>
            {t('Let invited operators see their own schedule, training and competencies')}
          </Checkbox>
          <p className="mt-1 text-xs text-ink-3">{t('Off by default. Operators are invited above with the Operator role and linked to their profile. Vacation requests from operators are not built yet.')}</p>
        </Collapsible>
      </div></div>
      {removing && <Confirm danger title={t('Remove access?')} body={t('{email} can no longer sign in.', { email: removing.email })} confirmLabel={t('Remove access')} onCancel={() => setRemoving(null)}
        onConfirm={async () => { await call('DELETE', `/api/admin/users/${encodeURIComponent(removing.email)}`); setRemoving(null); }} />}
    </div>
  );
}
