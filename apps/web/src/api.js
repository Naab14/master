/* Tiny client for the Master backend (backend/server.js).
 * Every helper fails soft — the tools keep working offline with their
 * localStorage caches, and the dashboard shows what it can.
 */

async function req(path, options) {
  const r = await fetch(path, options);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  return r.json();
}

const jsonBody = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/* ── Full state (dashboard) ────────────────────────────────────────────── */
export const getFullState = () => req('/api/state');

/* ── ManageClip (shift dashboard) ──────────────────────────────────────── */
export const getManageclipState = () => req('/api/manageclip/state');
export const putManageclipState = (state) => req('/api/manageclip/state', jsonBody('PUT', state));

/* ── Boards (Frieday) ──────────────────────────────────────────────────── */
export const createBoard = (name) => req('/api/boards', jsonBody('POST', { name }));
export const patchBoard = (bid, patch) => req(`/api/boards/${bid}`, jsonBody('PATCH', patch));
export const deleteBoard = (bid) => req(`/api/boards/${bid}`, { method: 'DELETE' });
export const createGroup = (bid, title) => req(`/api/boards/${bid}/groups`, jsonBody('POST', { title }));
export const patchGroup = (bid, gid, patch) => req(`/api/boards/${bid}/groups/${gid}`, jsonBody('PATCH', patch));
export const deleteGroup = (bid, gid) => req(`/api/boards/${bid}/groups/${gid}`, { method: 'DELETE' });
export const createItem = (bid, gid, name) => req(`/api/boards/${bid}/groups/${gid}/items`, jsonBody('POST', { name }));
export const patchItem = (bid, iid, patch) => req(`/api/boards/${bid}/items/${iid}`, jsonBody('PATCH', patch));
export const deleteItem = (bid, iid) => req(`/api/boards/${bid}/items/${iid}`, { method: 'DELETE' });
export const createColumn = (bid, title, type) => req(`/api/boards/${bid}/columns`, jsonBody('POST', { title, type }));
export const deleteColumn = (bid, cid) => req(`/api/boards/${bid}/columns/${cid}`, { method: 'DELETE' });
export const addMember = (name) => req('/api/members', jsonBody('POST', { name }));
