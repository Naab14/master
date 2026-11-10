import { describe, it, expect } from 'vitest';
import core from '../../../../backend/core.js';
import access from '../../../../backend/access.js';

const { route, normalizeSection } = core;
const env = { adminEmails: ['boss@example.com'], allowedEmails: ['old@example.com'], codeRole: 'manager' };
const fresh = () => ({
  workforce: normalizeSection('workforce', null), attendance: normalizeSection('attendance', null),
  admin: normalizeSection('admin', null), boards: normalizeSection('boards', null),
  manageclip: normalizeSection('manageclip', null), vacation: null, sketches: normalizeSection('sketches', null),
});
const as = email => ({ identity: { via: 'google', email }, env, now: '2026-11-09T10:00:00.000Z' });
const call = (s, ctx, method, path, body = {}) => route(method, path, body, s, ctx);

describe('server permissions', () => {
  it('makes only the configured email admin, never the first signup', () => {
    const s = fresh();
    const stranger = call(s, as('first@example.com'), 'GET', '/api/me');
    expect(stranger.status).toBe(403);
    expect(s.admin.requests['first@example.com']).toBeTruthy(); // waits for approval
    expect(call(s, as('boss@example.com'), 'GET', '/api/me').body.role).toBe('admin');
    expect(call(s, as('old@example.com'), 'GET', '/api/me').body.role).toBe('manager');
  });

  it('lets the admin invite, and enforces the role on the server', () => {
    const s = fresh();
    expect(call(s, as('lead@example.com'), 'POST', '/api/admin/users', { email: 'x@example.com', role: 'manager' }).status).toBe(403);
    expect(call(s, as('boss@example.com'), 'POST', '/api/admin/users', { email: 'x@example.com', role: 'admin' }).status).toBe(400);
    call(s, as('boss@example.com'), 'POST', '/api/admin/users', { email: 'Lead@Example.com', role: 'teamlead', teams: ['red'] });
    const me = call(s, as('lead@example.com'), 'GET', '/api/me').body;
    expect(me).toMatchObject({ role: 'teamlead', teams: ['red'] });
    expect(me.permissions).toContain('attendance.edit');
    expect(me.permissions).not.toContain('competencies.edit');

    const person = { op: 'put', col: 'people', id: 'p1', value: { id: 'p1', name: 'Test Person' } };
    expect(call(s, as('lead@example.com'), 'POST', '/api/workforce/ops', { ops: [person] }).status).toBe(403);
    expect(call(s, as('boss@example.com'), 'POST', '/api/workforce/ops', { ops: [person] }).status).toBe(200);
    const quals = { op: 'put', col: 'qualifications', id: 'p1', value: { id: 'p1', skills: {} } };
    expect(call(s, as('lead@example.com'), 'POST', '/api/workforce/ops', { ops: [quals] }).body.permission).toBe('competencies.edit');

    // The admin can change what a role may do.
    call(s, as('boss@example.com'), 'PUT', '/api/admin/permissions', { teamlead: { 'boards.view': false } });
    expect(call(s, as('lead@example.com'), 'GET', '/api/state').body.boards).toEqual([]);
    expect(call(s, as('lead@example.com'), 'POST', '/api/boards', { name: 'x' }).status).toBe(403);
  });

  it('limits a team lead to their own teams and holds team moves for a manager', () => {
    const s = fresh();
    const boss = as('boss@example.com');
    call(s, boss, 'POST', '/api/admin/users', { email: 'lead@example.com', role: 'teamlead', teams: ['red'] });
    call(s, boss, 'POST', '/api/workforce/ops', { ops: [
      { op: 'put', col: 'memberships', id: 'm1', value: { id: 'm1', personId: 'p1', teamId: 'red', from: '2026-01-01', to: null, status: 'confirmed' } },
      { op: 'put', col: 'memberships', id: 'm2', value: { id: 'm2', personId: 'p2', teamId: 'blue', from: '2026-01-01', to: null, status: 'confirmed' } },
    ] });
    const entry = (id, personId) => ({ op: 'put', col: 'entries', id, value: { id, personId, date: '2026-11-09', reasonId: 'sick', fullDay: true } });
    expect(call(s, as('lead@example.com'), 'POST', '/api/attendance/ops', { ops: [entry('e1', 'p1')] }).status).toBe(200);
    expect(call(s, as('lead@example.com'), 'POST', '/api/attendance/ops', { ops: [entry('e2', 'p2')] }).status).toBe(403);

    const move = status => ({ op: 'put', col: 'memberships', id: 'm3', value: { id: 'm3', personId: 'p1', teamId: 'blue', from: '2026-12-01', to: null, status } });
    expect(call(s, as('lead@example.com'), 'POST', '/api/workforce/ops', { ops: [move('confirmed')] }).status).toBe(403);
    expect(call(s, as('lead@example.com'), 'POST', '/api/workforce/ops', { ops: [move('pending')] }).status).toBe(200);
  });

  it('logs who changed what, with old and new values', () => {
    const s = fresh();
    const boss = as('boss@example.com');
    const put = (value, base) => call(s, boss, 'POST', '/api/attendance/ops', { ops: [{ op: 'put', col: 'entries', id: 'e1', value, base }] });
    put({ id: 'e1', personId: 'p1', date: '2026-11-09', reasonId: 'late', hours: 0.5 });
    put({ id: 'e1', personId: 'p1', date: '2026-11-09', reasonId: 'late', hours: 1 }, 1);
    expect(s.attendance.log).toHaveLength(2);
    expect(s.attendance.log[1]).toMatchObject({ by: 'boss@example.com', before: { hours: 0.5 }, after: { hours: 1 } });
  });

  it('refuses an edit or undo based on an outdated version', () => {
    const s = fresh();
    const boss = as('boss@example.com');
    const put = (ctx, name, base) => call(s, ctx, 'POST', '/api/workforce/ops', { ops: [{ op: 'put', col: 'people', id: 'p1', value: { id: 'p1', name }, base }] });
    expect(put(boss, 'A', 0).body.changed[0].value._rev).toBe(1);
    expect(put(as('old@example.com'), 'B', 1).status).toBe(200);       // a colleague edits
    const undo = put(boss, 'original', 1);                             // my undo is based on rev 1
    expect(undo.status).toBe(409);
    expect(undo.body.conflicts[0].current.name).toBe('B');
    expect(s.workforce.people.p1.name).toBe('B');                      // their change survives
  });

  it('shows an operator only their own profile, and only when switched on', () => {
    const s = fresh();
    const boss = as('boss@example.com');
    call(s, boss, 'POST', '/api/admin/users', { email: 'op@example.com', role: 'operator', personId: 'p1' });
    call(s, boss, 'POST', '/api/workforce/ops', { ops: [
      { op: 'put', col: 'people', id: 'p1', value: { id: 'p1', name: 'Me' } },
      { op: 'put', col: 'people', id: 'p2', value: { id: 'p2', name: 'Other' } },
    ] });
    expect(call(s, as('op@example.com'), 'GET', '/api/workforce/state').status).toBe(403);
    call(s, boss, 'POST', '/api/workforce/ops', { ops: [{ op: 'put', col: 'settings', id: 'main', value: { id: 'main', operatorAccess: true } }] });
    const view = call(s, as('op@example.com'), 'GET', '/api/workforce/state');
    expect(Object.keys(view.body.people)).toEqual(['p1']);
    expect(call(s, as('op@example.com'), 'GET', '/api/attendance/state').status).toBe(403);
  });

  it('keeps the open local mode and the access code working', () => {
    const s = fresh();
    expect(route('GET', '/api/me', {}, s, { identity: { via: 'open', email: null }, env }).body.role).toBe('admin');
    expect(route('GET', '/api/me', {}, s, { identity: { via: 'code', email: null }, env }).body.role).toBe('manager');
    expect(access.can({ role: 'viewer' }, s.admin, 'schedule.edit')).toBe(false);
  });

  it('keeps sketch boards private to their owner, with no admin bypass', () => {
    const s = fresh();
    const boss = as('boss@example.com');
    call(s, boss, 'POST', '/api/admin/users', { email: 'lead@example.com', role: 'teamlead' });
    call(s, boss, 'POST', '/api/admin/users', { email: 'mate@example.com', role: 'teamlead' });
    const lead = as('lead@example.com');
    const id = call(s, lead, 'POST', '/api/sketches', { name: 'Line layout' }).body.id;
    expect(call(s, lead, 'PUT', `/api/sketches/${id}`, { scene: { elements: [{ id: 'a' }] }, baseRev: 1 }).status).toBe(200);
    expect(call(s, boss, 'GET', `/api/sketches/${id}`).status).toBe(404);           // admin can't open it
    expect(call(s, boss, 'GET', '/api/sketches').body.boards).toEqual([]);
    expect(call(s, as('mate@example.com'), 'PUT', `/api/sketches/${id}`, { name: 'x' }).status).toBe(404);

    call(s, lead, 'PUT', `/api/sketches/${id}`, { shared: ['mate@example.com'] });
    const mate = as('mate@example.com');
    expect(call(s, mate, 'GET', `/api/sketches/${id}`).body.scene.elements).toHaveLength(1);
    expect(call(s, mate, 'PUT', `/api/sketches/${id}`, { name: 'Renamed' }).status).toBe(403); // owner only
    expect(call(s, mate, 'DELETE', `/api/sketches/${id}`).status).toBe(403);
    const rev = call(s, mate, 'GET', `/api/sketches/${id}`).body.rev;
    expect(call(s, mate, 'PUT', `/api/sketches/${id}`, { scene: { elements: [] }, baseRev: rev }).status).toBe(200);
    expect(call(s, lead, 'PUT', `/api/sketches/${id}`, { scene: { elements: [{ id: 'old' }] }, baseRev: rev }).status).toBe(409); // stale save refused
  });

  it('lets external guests in only when the admin allows it, and only to shared boards', () => {
    const s = fresh();
    const boss = as('boss@example.com');
    const guest = as('guest@outside.com');
    const id = call(s, boss, 'POST', '/api/sketches', { name: 'Shared plan' }).body.id;
    const other = call(s, boss, 'POST', '/api/sketches', { name: 'Private' }).body.id;
    const refused = call(s, boss, 'PUT', `/api/sketches/${id}`, { shared: ['guest@outside.com'] });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('external-off');
    call(s, boss, 'PUT', '/api/admin/settings', { externalGuests: true });
    expect(call(s, boss, 'PUT', `/api/sketches/${id}`, { shared: ['guest@outside.com'] }).status).toBe(200);
    expect(call(s, guest, 'GET', '/api/me').body).toMatchObject({ role: 'guest', permissions: [] });
    expect(call(s, guest, 'GET', '/api/sketches').body.boards.map(b => b.id)).toEqual([id]);
    expect(call(s, guest, 'GET', `/api/sketches/${other}`).status).toBe(404);
    expect(call(s, guest, 'POST', '/api/sketches', { name: 'Mine' }).status).toBe(403);
    expect(call(s, guest, 'GET', '/api/workforce/state').status).toBe(403);
    expect(call(s, guest, 'GET', '/api/state').status).toBe(403);
    call(s, boss, 'PUT', '/api/admin/settings', { externalGuests: false });         // switched off again
    expect(call(s, guest, 'GET', '/api/me').status).toBe(403);
  });
});
