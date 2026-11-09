/* Credentials for the Master API.
 *
 * - Google login: the signed-in user's Supabase session token (see auth.js).
 * - Access code: when the server sets APP_ACCESS_CODE and Google login is
 *   off, every request carries the code kept in this browser's localStorage.
 *
 * A 401 or 403 announces itself so the app can ask the user to sign in (or
 * for the code) or explain that the account has no access.
 */
import { getAccessToken } from './auth';

const KEY = 'master-access-code';
export const AUTH_PROBLEM_EVENT = 'master:auth-problem';

export function getAccessCode() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function setAccessCode(code) {
  try { localStorage.setItem(KEY, code); } catch { /* ignore */ }
}

/* Requests still on the wire, so sign-out can let pending saves finish
 * (while the session is still valid) before clearing anything. */
const inflight = new Set();

export function waitForPendingRequests() {
  return Promise.allSettled([...inflight]);
}

/** fetch() for /api routes: adds the credentials, reports 401/403. */
export function apiFetch(path, options = {}) {
  const p = send(path, options);
  inflight.add(p);
  p.finally(() => inflight.delete(p)).catch(() => {});
  return p;
}

async function send(path, options) {
  const headers = { ...(options.headers || {}) };
  const code = getAccessCode();
  if (code) headers['X-Access-Code'] = code;
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(path, { ...options, headers });
  if (r.status === 401 || r.status === 403) {
    const body = await r.clone().json().catch(() => ({}));
    // A 403 for one action ("no permission: …") is not an access problem for
    // the whole app; only "not invited" (or the older allow-list refusal) is.
    if (r.status === 401 || body.code === 'not-invited' || !body.permission && !/outside your teams|admin only/.test(body.error || '')) {
      window.dispatchEvent(new CustomEvent(AUTH_PROBLEM_EVENT, { detail: { status: r.status, error: body.error || '' } }));
    }
  }
  return r;
}
