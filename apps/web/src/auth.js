/* Google login via Supabase Auth.
 *
 * The server says at /api/config whether login is on (ALLOWED_EMAILS set) and
 * which Supabase project to use. Only then is supabase-js loaded, so local
 * development and tests run without it. Sign-in uses the PKCE flow: Google
 * returns to ?code=…, which doesn't collide with the app's #/section routing.
 */

let config = { auth: null, accessCode: false };
let client = null;

export async function loadAuth() {
  try {
    const r = await fetch('/api/config');
    if (r.ok) config = await r.json();
  } catch { /* no backend: offline mode, no login */ }

  if (config.auth) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(config.auth.supabaseUrl, config.auth.publishableKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data } = await client.auth.getSession(); // finishes a ?code= sign-in return, if any
    const url = new URL(window.location.href);
    if (url.searchParams.has('code')) url.searchParams.delete('code');
    // Back from Google: restore where the user was heading (e.g. a
    // #share=… vacation link), which the OAuth redirect drops.
    const returnHash = takeReturnHash();
    if (data.session && returnHash && !url.hash) url.hash = returnHash;
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  return config;
}

export const googleLoginEnabled = () => !!client;

export async function getSession() {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session || null;
}

export async function getAccessToken() {
  const session = await getSession();
  return session ? session.access_token : null;
}

export function onSessionChange(cb) {
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

const RETURN_HASH_KEY = 'master-return-hash';

function takeReturnHash() {
  try {
    const h = sessionStorage.getItem(RETURN_HASH_KEY);
    sessionStorage.removeItem(RETURN_HASH_KEY);
    return h || '';
  } catch { return ''; }
}

export function signInWithGoogle() {
  try {
    if (window.location.hash) sessionStorage.setItem(RETURN_HASH_KEY, window.location.hash);
  } catch { /* ignore */ }
  return client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

/* Data the tools cache in this browser for offline use. */
const CACHED_DATA_KEYS = ['master-manageclip', 'vacation-planner-state'];

export async function signOut() {
  try { CACHED_DATA_KEYS.forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
  if (client) await client.auth.signOut();
}
