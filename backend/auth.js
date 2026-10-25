/**
 * Who may use the Master API.
 *
 * - Google login (Supabase Auth) is on when ALLOWED_EMAILS is set. A request
 *   then needs `Authorization: Bearer <Supabase access token>` for a
 *   confirmed email on that list. Supabase validates the token, so expired
 *   or revoked sessions are rejected.
 * - APP_ACCESS_CODE, when set, is also accepted (x-access-code header) — the
 *   iOS app uses it until it has Google sign-in of its own.
 * - With neither set, the API is open.
 *
 * Environment: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ALLOWED_EMAILS
 * (comma-separated), APP_ACCESS_CODE.
 */

const crypto = require('crypto');

const TOKEN_CACHE_MS = 60 * 1000;
const TOKEN_CACHE_MAX = 500;
const tokenCache = new Map(); // access token -> { email, expires }

function allowedEmails() {
  return (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function supabaseUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
}

function publishableKey() {
  return process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
}

/** What the web app needs to know to sign in. Safe to serve publicly. */
function publicConfig() {
  const google = allowedEmails().length > 0 && supabaseUrl() && publishableKey();
  return {
    auth: google ? { provider: 'google', supabaseUrl: supabaseUrl(), publishableKey: publishableKey() } : null,
    accessCode: !!process.env.APP_ACCESS_CODE,
  };
}

function sameSecret(given, expected) {
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function bearerToken(header) {
  const m = /^Bearer\s+(.+)$/i.exec(String(header || ''));
  return m ? m[1].trim() : '';
}

/** Ask Supabase who this token belongs to; returns a confirmed email or null. */
async function emailForToken(token) {
  const hit = tokenCache.get(token);
  if (hit && hit.expires > Date.now()) return hit.email;

  const r = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { apikey: publishableKey(), Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const user = await r.json();
  // Only confirmed addresses count (Google sign-ins always are), so nobody
  // can claim an allowed email they don't control.
  const email = user && user.email && user.email_confirmed_at ? String(user.email).toLowerCase() : null;
  if (!email) return null;

  if (tokenCache.size >= TOKEN_CACHE_MAX) tokenCache.delete(tokenCache.keys().next().value);
  tokenCache.set(token, { email, expires: Date.now() + TOKEN_CACHE_MS });
  return email;
}

const deny = (status, error) => ({ status, body: { error } });

/**
 * Decide whether a request may use the API.
 * @returns {Promise<null | { status: number, body: object }>} null = allowed
 */
async function authorize(headers) {
  const code = process.env.APP_ACCESS_CODE || '';
  if (code && headers['x-access-code'] && sameSecret(headers['x-access-code'], code)) return null;

  const emails = allowedEmails();
  if (!emails.length) return code ? deny(401, 'access code required') : null;

  // Google login is configured: never fall open because a setting is missing.
  if (!supabaseUrl() || !publishableKey()) {
    return deny(503, 'Server not configured: Google login needs SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
  }
  const token = bearerToken(headers.authorization);
  if (!token) return deny(401, 'sign in required');
  const email = await emailForToken(token);
  if (!email) return deny(401, 'sign in required');
  if (!emails.includes(email)) return deny(403, `${email} doesn't have access to this workspace`);
  return null;
}

module.exports = { authorize, publicConfig };
