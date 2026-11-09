/* global process */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

/* The Vercel function (api/index.js) against a stand-in for Supabase's REST
 * API, so the production path is exercised without touching real data. */
const require = createRequire(import.meta.url);

function fakeSupabase({ allowNewKeys }) {
  const rows = new Map([['boards', { key: 'boards', data: null, version: 0 }], ['manageclip', { key: 'manageclip', data: null, version: 0 }], ['vacation', { key: 'vacation', data: null, version: 0 }]]);
  const json = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
  const fetchMock = async (url, options = {}) => {
    const u = new URL(url);
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
  return { rows, fetchMock };
}

async function call(handler, method, path, body) {
  let status; let payload;
  const res = { writeHead: s => { status = s; }, end: d => { payload = JSON.parse(d); } };
  await handler({ method, url: `/api?path=${path}`, headers: {}, body }, res);
  return { status, body: payload };
}

describe('Vercel adapter', () => {
  let handler;
  const load = () => {
    vi.resetModules();
    delete require.cache[require.resolve('../../../../api/index.js')];
    handler = require('../../../../api/index.js');
  };
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test';
    delete process.env.ADMIN_EMAIL; delete process.env.ALLOWED_EMAILS; delete process.env.APP_ACCESS_CODE;
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
});
