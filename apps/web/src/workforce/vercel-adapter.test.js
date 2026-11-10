/* global process */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';

/* The Vercel function (api/index.js) against a stand-in for Supabase's REST
 * API, so the production path is exercised without touching real data. */
const require = createRequire(import.meta.url);

function fakeSupabase({ allowNewKeys, authUsers = {}, googleOn = true, seed = {} }) {
  const rows = new Map([['boards', { key: 'boards', data: null, version: 0 }], ['manageclip', { key: 'manageclip', data: null, version: 0 }], ['vacation', { key: 'vacation', data: null, version: 0 }]]);
  for (const [k, data] of Object.entries(seed)) rows.set(k, { key: k, data, version: 1 });
  const json = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
  const calls = [];
  const fetchMock = async (url, options = {}) => {
    const u = new URL(url);
    calls.push(u.pathname);
    // Supabase Auth: who does this token belong to?
    if (u.pathname === '/auth/v1/user') {
      const user = authUsers[String(options.headers.Authorization).replace('Bearer ', '')];
      return user ? json(200, user) : json(401, { message: 'invalid token' });
    }
    if (u.pathname === '/auth/v1/settings') return json(200, { external: { google: googleOn } });
    const method = options.method || 'GET';
    if (method === 'GET') {
      const keys = /in\.\((.*)\)/.exec(u.searchParams.get('key'))[1].split(',');
      return json(200, keys.filter(k => rows.has(k)).map(k => rows.get(k)));
    }
    const body = JSON.parse(options.body);
    if (method === 'POST') {
      if (!allowNewKeys && !['boards', 'manageclip', 'vacation'].includes(body.key)) return json(400, { message: 'new row violates check constraint "app_state_key_check"' });
      if (rows.has(body.key)) return json(201, []);
      rows.set(body.key, body);
      return json(201, [body]);
    }
    const key = u.searchParams.get('key').replace('eq.', '');
    const version = Number(u.searchParams.get('version').replace('eq.', ''));
    const row = rows.get(key);
    if (!row || row.version !== version) return json(200, []);
    Object.assign(row, body);
    return json(200, [row]);
  };
  return { rows, fetchMock, calls };
}

async function call(handler, method, path, body, token) {
  let status; let payload;
  const res = { writeHead: s => { status = s; }, end: d => { payload = JSON.parse(d); } };
  await handler({ method, url: `/api?path=${path}`, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
  return { status, body: payload };
}

describe('Vercel adapter', () => {
  let handler;
  const load = () => {
    vi.resetModules();
    for (const f of ['../../../../api/index.js', '../../../../backend/auth.js']) delete require.cache[require.resolve(f)];
    handler = require('../../../../api/index.js');
  };
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test';
    delete process.env.ADMIN_EMAIL; delete process.env.ALLOWED_EMAILS; delete process.env.APP_ACCESS_CODE;
    delete process.env.VERCEL_ENV; delete process.env.AUTH_PROVIDERS;
  });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; });

  it('saves planning data in new rows and keeps the old tools working', async () => {
    const sb = fakeSupabase({ allowNewKeys: true });
    vi.stubGlobal('fetch', sb.fetchMock);
    load();
    expect((await call(handler, 'GET', 'me')).body.role).toBe('admin'); // open mode, as today
    expect(sb.rows.has('admin')).toBe(false);                           // reading creates nothing
    const put = await call(handler, 'POST', 'workforce/ops', { ops: [{ op: 'put', col: 'people', id: 'p1', value: { id: 'p1', name: 'Test' } }] });
    expect(put.status).toBe(200);
    expect(sb.rows.get('workforce').data.people.p1.name).toBe('Test');
    expect((await call(handler, 'GET', 'workforce/state')).body.people.p1._rev).toBe(1);
    expect((await call(handler, 'GET', 'state')).body.boards.length).toBe(1);
    expect(sb.rows.get('boards').data).not.toBe(null);                  // seeded once, as before
  });

  it('says so clearly when the database migration has not been run', async () => {
    const sb = fakeSupabase({ allowNewKeys: false });
    vi.stubGlobal('fetch', sb.fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    load();
    expect((await call(handler, 'GET', 'state')).status).toBe(200);     // existing tools unaffected
    const put = await call(handler, 'POST', 'workforce/ops', { ops: [{ op: 'put', col: 'people', id: 'p1', value: { id: 'p1', name: 'Test' } }] });
    expect(put.status).toBe(503);
    expect(put.body.error).toMatch(/002_more_sections/);
  });

  it('locks the production site until an admin is configured: no anonymous access', async () => {
    process.env.VERCEL_ENV = 'production';
    const sb = fakeSupabase({ allowNewKeys: true });
    vi.stubGlobal('fetch', sb.fetchMock);
    load();
    expect((await call(handler, 'GET', 'config')).body).toMatchObject({ auth: null, locked: true });
    for (const path of ['me', 'state', 'workforce/state', 'admin/state', 'sketches']) {
      const r = await call(handler, 'GET', path);
      expect([path, r.status, r.body.code]).toEqual([path, 503, 'locked']);
    }
    expect((await call(handler, 'POST', 'workforce/ops', { ops: [] })).status).toBe(503);
  });

  it('with Google sign-in on: admin from the database, uninvited refused, password accounts refused', async () => {
    process.env.VERCEL_ENV = 'production';
    const google = email => ({ email, email_confirmed_at: '2026-11-10T00:00:00Z', app_metadata: { provider: 'google', providers: ['google'] } });
    // Tokens shaped like Supabase's: the middle part says how the session began.
    const jwt = (name, method) => `h.${Buffer.from(JSON.stringify({ sub: name, amr: [{ method }] })).toString('base64url')}.sig`;
    const T = { owner: jwt('owner', 'oauth'), lead: jwt('lead', 'oauth'), stranger: jwt('stranger', 'oauth'), password: jwt('password', 'password'), unconfirmed: jwt('unconfirmed', 'oauth'), linked: jwt('linked', 'password') };
    const sb = fakeSupabase({
      allowNewKeys: true,
      seed: { admin: { owners: ['Owner@Example.com'], authConfig: { publishableKey: 'sb_publishable_test' }, users: { 'lead@example.com': { email: 'lead@example.com', role: 'teamlead', teams: [] } }, requests: {}, permissions: {}, settings: {} } },
      authUsers: {
        [T.owner]: google('owner@example.com'), [T.lead]: google('lead@example.com'), [T.stranger]: google('stranger@example.com'),
        [T.password]: { email: 'owner@example.com', email_confirmed_at: '2026-11-10T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] } },
        [T.unconfirmed]: { email: 'owner@example.com', email_confirmed_at: null, app_metadata: { provider: 'google', providers: ['google'] } },
        // The owner's account with a password added later, used through a password login.
        [T.linked]: { email: 'owner@example.com', email_confirmed_at: '2026-11-10T00:00:00Z', app_metadata: { provider: 'google', providers: ['google', 'email'] } },
      },
    });
    vi.stubGlobal('fetch', sb.fetchMock);
    load();
    const cfg = (await call(handler, 'GET', 'config')).body;
    expect(cfg).toMatchObject({ locked: false, auth: { provider: 'google', publishableKey: 'sb_publishable_test', providerEnabled: true } });
    expect((await call(handler, 'GET', 'me')).status).toBe(401);                          // no token
    expect((await call(handler, 'GET', 'state', undefined, 'forged')).status).toBe(401);  // made-up token
    expect((await call(handler, 'GET', 'me', undefined, T.owner)).body).toMatchObject({ role: 'admin', email: 'owner@example.com' });
    const stranger = await call(handler, 'GET', 'me', undefined, T.stranger);
    expect([stranger.status, stranger.body.code]).toEqual([403, 'not-invited']);
    expect(sb.rows.get('admin').data.requests['stranger@example.com']).toBeTruthy();       // queued for approval
    expect(sb.rows.get('admin').data.owners).toEqual(['Owner@Example.com']);               // untouched by the API
    const pw = await call(handler, 'GET', 'me', undefined, T.password);
    expect([pw.status, pw.body.code]).toEqual([403, 'wrong-provider']);                    // same address, not Google
    expect((await call(handler, 'GET', 'me', undefined, T.unconfirmed)).status).toBe(401);
    const linked = await call(handler, 'GET', 'me', undefined, T.linked);
    expect([linked.status, linked.body.code]).toEqual([403, 'wrong-provider']);              // Google account, password session
    // Team lead: may record attendance, may not edit people or open Access.
    expect((await call(handler, 'GET', 'me', undefined, T.lead)).body.role).toBe('teamlead');
    expect((await call(handler, 'POST', 'workforce/ops', { ops: [{ op: 'put', col: 'people', id: 'p1', value: { id: 'p1', name: 'X' } }] }, T.lead)).status).toBe(403);
    expect((await call(handler, 'GET', 'admin/state', undefined, T.lead)).status).toBe(403);
    expect((await call(handler, 'POST', 'admin/users', { email: 'lead@example.com', role: 'manager' }, T.lead)).status).toBe(403);
    expect((await call(handler, 'POST', 'workforce/ops', { ops: [{ op: 'put', col: 'people', id: 'p1', value: { id: 'p1', name: 'X' } }] }, T.owner)).status).toBe(200);
  });

  it('keeps preview deployments on their own table', async () => {
    process.env.VERCEL_ENV = 'preview';
    const sb = fakeSupabase({ allowNewKeys: true });
    const seen = [];
    vi.stubGlobal('fetch', (url, o) => { seen.push(new URL(url).pathname); return sb.fetchMock(url, o); });
    load();
    await call(handler, 'GET', 'state');
    expect(seen.every(p => p === '/rest/v1/app_state_preview')).toBe(true);
    expect(seen.length).toBeGreaterThan(0);
  });
});
