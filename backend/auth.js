/**
 * Who may use the Master API.
 *
 * - Google login (Supabase Auth) is on when an admin account is configured:
 *   ADMIN_EMAIL in the environment, or `owners` in the database's admin
 *   section (or the older ALLOWED_EMAILS). A request then needs `Authorization: Bearer
 *   <Supabase access token>`. Supabase validates the token, so expired or
 *   revoked sessions are rejected. This file only proves who is calling;
 *   roles and permissions live in backend/access.js.
 * - ADMIN_EMAIL is the one configured admin account. Nobody becomes admin by
 *   signing up first. Everyone else needs an invitation from the admin
 *   (stored in the app) or, for older setups, a place on ALLOWED_EMAILS.
 * - APP_ACCESS_CODE, when set, is also accepted (x-access-code header) — the
 *   iOS app uses it until it has Google sign-in of its own.
 * - With neither set, the API is open on a home computer and on preview
 *   deployments, and LOCKED on the production site (VERCEL_ENV=production).
 *
 * Environment: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ADMIN_EMAIL,
 * ALLOWED_EMAILS (comma-separated), APP_ACCESS_CODE, APP_ACCESS_CODE_ROLE.
 */

const crypto = require('crypto');

const TOKEN_CACHE_MS = 60 * 1000;
const TOKEN_CACHE_MAX = 500;
const tokenCache = new Map(); // access token -> { email, providers, expires }

const list = (v) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const emails = (v) => (Array.isArray(v) ? v : []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);

/**
 * Everything sign-in depends on, from the environment and from the `admin`
 * section of the database. The database part (`owners`, `authConfig`) is
 * written only by hand in the database, never through the API, so nobody can
 * make themselves admin from inside the app.
 */
function authSettings(admin) {
  const cfg = (admin && admin.authConfig) || {};
  const adminEmails = [...new Set([...list(process.env.ADMIN_EMAIL || process.env.ADMIN_EMAILS), ...emails(admin && admin.owners)])];
  const allowedEmails = list(process.env.ALLOWED_EMAILS);
  const providers = list(process.env.AUTH_PROVIDERS).length ? list(process.env.AUTH_PROVIDERS)
    : emails(cfg.providers).length ? emails(cfg.providers) : ['google'];
  const accessCode = process.env.APP_ACCESS_CODE || '';
  const loginConfigured = adminEmails.length > 0 || allowedEmails.length > 0;
  return {
    adminEmails,
    allowedEmails,
    providers,
    accessCode,
    loginConfigured,
    codeRole: process.env.APP_ACCESS_CODE_ROLE || 'manager',
    supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || String(cfg.publishableKey || ''),
    // The production site never runs without sign-in. Open access is only
    // for a computer at home (node backend/server.js) and for preview
    // deployments, which sit behind Vercel's own login and use test data.
    locked: !loginConfigured && !accessCode && process.env.VERCEL_ENV === 'production',
  };
}

let providerCache = { at: 0, url: '', google: null };
/** Is Google switched on in Supabase? null when it can't be checked. */
async function googleProviderEnabled(settings) {
  if (providerCache.url === settings.supabaseUrl && Date.now() - providerCache.at < 60000) return providerCache.google;
  let google = null;
  try {
    const r = await fetch(`${settings.supabaseUrl}/auth/v1/settings`, { headers: { apikey: settings.publishableKey } });
    if (r.ok) google = !!((await r.json()).external || {}).google;
  } catch { /* unknown */ }
  providerCache = { at: Date.now(), url: settings.supabaseUrl, google };
  return google;
}

/** What the web app needs to know to sign in. Safe to serve publicly. */
async function publicConfig(settings) {
  const google = settings.loginConfigured && settings.supabaseUrl && settings.publishableKey;
  return {
    auth: google ? { provider: 'google', supabaseUrl: settings.supabaseUrl, publishableKey: settings.publishableKey, providerEnabled: await googleProviderEnabled(settings) } : null,
    accessCode: !!settings.accessCode,
    locked: settings.locked || (settings.loginConfigured && !google),
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

/** Ask Supabase who this token belongs to: a confirmed email and how they signed in. */
async function userForToken(token, settings) {
  const hit = tokenCache.get(token);
  if (hit && hit.expires > Date.now()) return hit;

  const r = await fetch(`${settings.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: settings.publishableKey, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const user = await r.json();
  // Only confirmed addresses count (Google sign-ins always are), so nobody
  // can claim an email they don't control.
  const email = user && user.email && user.email_confirmed_at ? String(user.email).toLowerCase() : null;
  if (!email) return null;
  const meta = user.app_metadata || {};
  const providers = (Array.isArray(meta.providers) ? meta.providers : [meta.provider]).filter(Boolean).map((p) => String(p).toLowerCase());

  if (tokenCache.size >= TOKEN_CACHE_MAX) tokenCache.delete(tokenCache.keys().next().value);
  const entry = { email, providers, expires: Date.now() + TOKEN_CACHE_MS };
  tokenCache.set(token, entry);
  return entry;
}

const deny = (status, error, code) => ({ status, body: code ? { error, code } : { error } });

/**
 * Work out who is calling. This only proves identity; what the caller may
 * do is decided from the roles stored in the app (backend/access.js).
 * @returns {Promise<{ identity?: { via: 'open'|'code'|'google', email: string|null }, denied?: { status: number, body: object } }>}
 */
async function authenticate(headers, settings) {
  const code = settings.accessCode;
  if (code && headers['x-access-code'] && sameSecret(headers['x-access-code'], code)) {
    return { identity: { via: 'code', email: null } };
  }
  if (!settings.loginConfigured) {
    if (settings.locked) return { denied: deny(503, 'Sign-in is not set up for this site yet.', 'locked') };
    return code ? { denied: deny(401, 'access code required') } : { identity: { via: 'open', email: null } };
  }
  // Google login is configured: never fall open because a setting is missing.
  if (!settings.supabaseUrl || !settings.publishableKey) {
    return { denied: deny(503, 'Server not configured: Google login needs SUPABASE_URL and a publishable key.', 'locked') };
  }
  const token = bearerToken(headers.authorization);
  if (!token) return { denied: deny(401, 'sign in required') };
  const user = await userForToken(token, settings);
  if (!user) return { denied: deny(401, 'sign in required') };
  // The account must have signed in with an accepted provider (Google). An
  // email-and-password account with the same address doesn't count.
  if (!user.providers.some((p) => settings.providers.includes(p))) {
    return { denied: deny(403, 'Sign in with Google to use this site.', 'wrong-provider') };
  }
  return { identity: { via: 'google', email: user.email } };
}

/** Settings the role rules need. */
function accessEnv(settings) {
  return { adminEmails: settings.adminEmails, allowedEmails: settings.allowedEmails, codeRole: settings.codeRole };
}

function clearAuthCaches() { tokenCache.clear(); providerCache = { at: 0, url: '', google: null }; }

module.exports = { authSettings, authenticate, accessEnv, publicConfig, clearAuthCaches };
