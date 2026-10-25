/**
 * Master API on Vercel — the same routes as backend/server.js (backend/core.js),
 * with data stored in Supabase instead of data/db.json.
 *
 * vercel.json rewrites /api/<path> to /api?path=<path>, so this one function
 * serves every API route.
 *
 * Environment (Vercel project settings):
 *   SUPABASE_URL               https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  secret key (or SUPABASE_SECRET_KEY) — server only
 *   APP_ACCESS_CODE            optional: code every client must send
 */

const { route, sectionsFor, normalizeSection, checkAccess } = require('../backend/core');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const MAX_ATTEMPTS = 12;

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

// ---------------------------------------------------------------------------
// Supabase (PostgREST) — table app_state(key, data jsonb, version)
// ---------------------------------------------------------------------------

function sbHeaders(extra) {
  const h = { apikey: SB_KEY, 'Content-Type': 'application/json', ...extra };
  // Legacy service_role keys are JWTs and also go in Authorization; new
  // sb_secret_ keys are sent as apikey only.
  if (SB_KEY.startsWith('eyJ')) h.Authorization = `Bearer ${SB_KEY}`;
  return h;
}

async function sbFetch(path, options) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, options);
  if (!r.ok) throw new Error(`Supabase ${options?.method || 'GET'} failed: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

async function loadRows(keys) {
  const rows = await sbFetch(`app_state?select=key,data,version&key=in.(${keys.join(',')})`, { headers: sbHeaders() });
  return Object.fromEntries(rows.map((row) => [row.key, row]));
}

/** Write a section only if nobody else wrote it since we read `version`. */
async function saveRow(key, data, version) {
  const body = JSON.stringify({ data, version: version + 1, updated_at: new Date().toISOString() });
  if (version < 0) {
    // Row missing (never created): insert unless someone beat us to it.
    const rows = await sbFetch('app_state', {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=ignore-duplicates,return=representation' }),
      body: JSON.stringify({ key, data, version: 1 }),
    });
    return rows.length === 1;
  }
  const rows = await sbFetch(`app_state?key=eq.${key}&version=eq.${version}`, {
    method: 'PATCH',
    headers: sbHeaders({ Prefer: 'return=representation' }),
    body,
  });
  return rows.length === 1;
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
    return req.body || {};
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function apiPath(req) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.searchParams.get('path');
  if (p !== null) return '/api/' + p.replace(/^\/+/, '');
  return url.pathname;
}

module.exports = async function handler(req, res) {
  const denied = checkAccess(req.headers);
  if (denied) return send(res, denied.status, denied.body);
  if (!SB_URL || !SB_KEY) {
    return send(res, 503, { error: 'Server not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
  }

  try {
    const pathname = apiPath(req);
    const body = await readBody(req);
    const keys = sectionsFor(pathname);

    // Optimistic concurrency: read, apply, write back with a version check;
    // if another request wrote in between, start over on the fresh data.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const rows = await loadRows(keys);
      const sections = {};
      const versions = {};
      const toSave = new Set();
      for (const key of keys) {
        const row = rows[key];
        versions[key] = row ? Number(row.version) : -1;
        sections[key] = normalizeSection(key, row ? row.data : null);
        // First use: store the seeded boards/shift data so ids stay stable.
        if ((!row || row.data === null) && sections[key] !== null) toSave.add(key);
      }

      const result = route(req.method, pathname, body, sections);
      for (const key of result.dirty) toSave.add(key);

      let saved = true;
      for (const key of toSave) {
        if (!(await saveRow(key, sections[key], versions[key]))) { saved = false; break; }
      }
      if (saved) return send(res, result.status, result.body);
      // Exponential backoff with full jitter so colliding requests spread out.
      const cap = Math.min(800, 40 * 2 ** attempt);
      await new Promise((r) => setTimeout(r, Math.random() * cap));
    }
    return send(res, 409, { error: 'too many concurrent edits — please try again' });
  } catch (err) {
    console.error(err);
    const status = err instanceof SyntaxError ? 400 : 500;
    return send(res, status, { error: status === 400 ? 'invalid JSON' : 'server error' });
  }
};
