import { apiFetch } from '../../access';

const STATE_KEY = 'vacation-planner-state';
const UI_KEY = 'vacation-planner-ui';
let debounceTimer = null;

export function saveState(state) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('Failed to save state:', e); }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { console.warn('Failed to load state:', e); return null; }
}

export function clearState() { localStorage.removeItem(STATE_KEY); }

export function saveUI(ui) {
  try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* ignore */ }
}
export function loadUI() {
  try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; } catch { return {}; }
}

export function exportJSON(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vacation-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = ev => {
        try { resolve(JSON.parse(ev.target.result)); }
        catch { resolve(null); }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

/* ── Server sync ───────────────────────────────────────────────────────────
 * The Master backend stores the whole workspace at /api/vacation/state.
 * localStorage stays as an offline cache; the server copy wins on load.
 * Saves only reach the server once the App has adopted (or seeded) the
 * server copy — otherwise a slow first load could push the local cache or
 * demo data over the shared plan. All calls fail silently so the tool still
 * works with no backend (tests, offline, static hosting).
 */
let serverSync = false;
let pendingState = null;

export function setServerSync(on) { serverSync = on; }

export function debouncedSave(state, delay = 500) {
  pendingState = state;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushSave, delay);
}

/* Write any pending save now — called when the planner unmounts so a
 * section switch inside the debounce window doesn't drop the edit. */
export function flushSave() {
  clearTimeout(debounceTimer);
  if (pendingState === null) return;
  const state = pendingState;
  pendingState = null;
  saveState(state);
  if (serverSync) pushServerState(state);
}

/* Drop a pending save without writing it (used when the server copy replaces
 * the local one, so the stale local edit can't be pushed over it). */
export function discardPendingSave() {
  clearTimeout(debounceTimer);
  pendingState = null;
}

/* Resolves { ok: true, state } — state is null for a workspace the server has
 * never stored — or { ok: false } when the server can't be reached. */
export function fetchServerState() {
  try {
    return apiFetch('/api/vacation/state')
      .then(r => (r.ok ? r.json().then(state => ({ ok: true, state })) : { ok: false }))
      .catch(() => ({ ok: false }));
  } catch {
    return Promise.resolve({ ok: false });
  }
}

export function pushServerState(state) {
  try {
    return apiFetch('/api/vacation/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    }).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

/* ── Share via URL ─────────────────────────────────────────────────────────
 * Encode the workspace as a compressed base64 string in the URL hash so
 * users can share a snapshot with a colleague by sending the link.
 */
function utf8ToBase64(str) {
  // Safely handle Unicode (names with å/ä/ö).
  return btoa(unescape(encodeURIComponent(str)));
}
function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

export function buildShareLink(state) {
  const payload = utf8ToBase64(JSON.stringify(state));
  const base = window.location.origin + window.location.pathname;
  return `${base}#share=${payload}`;
}

export function loadStateFromUrl() {
  const hash = window.location.hash || '';
  const m = hash.match(/#share=([^&]+)/);
  if (!m) return null;
  try {
    return JSON.parse(base64ToUtf8(m[1]));
  } catch (e) {
    console.warn('Failed to parse shared state:', e);
    return null;
  }
}

export function clearShareHash() {
  if (window.location.hash.includes('#share=')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    console.warn('Copy failed:', e);
    return false;
  }
}
