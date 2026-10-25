/* Access code for the Master API. When the server sets APP_ACCESS_CODE (always
 * on Vercel), every /api request must carry it. The code is kept in this
 * browser's localStorage; a 401 announces itself so the app can ask for it.
 */

const KEY = 'master-access-code';
export const ACCESS_REQUIRED_EVENT = 'master:access-required';

export function getAccessCode() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function setAccessCode(code) {
  try { localStorage.setItem(KEY, code); } catch { /* ignore */ }
}

/** fetch() for /api routes: adds the access code, reports a 401. */
export function apiFetch(path, options = {}) {
  const code = getAccessCode();
  const headers = { ...(options.headers || {}) };
  if (code) headers['X-Access-Code'] = code;
  return fetch(path, { ...options, headers }).then(r => {
    if (r.status === 401) window.dispatchEvent(new Event(ACCESS_REQUIRED_EVENT));
    return r;
  });
}
