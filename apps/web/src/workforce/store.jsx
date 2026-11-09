/* Workforce data for the screens: load, save, undo, offline.
 *
 * - Saves are optimistic and per entity. The server refuses a save based on
 *   an outdated version (409); then we reload and tell the user, so nobody's
 *   later change is overwritten, including by Undo.
 * - The last loaded data is cached in this browser. When the server can't be
 *   reached the cache is shown read-only with an "Offline" banner. The cache
 *   is cleared on sign-out (src/auth.js).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ctx, CACHE_KEY } from './store-context';
import { apiFetch } from '../access';
import { WORKFORCE_COLLECTIONS, ATTENDANCE_COLLECTIONS, emptyDoc } from './logic/model';
import { buildIndex } from './logic/schedule';

const POLL_MS = 30000;
const SECTION_OF = col => (ATTENDANCE_COLLECTIONS.includes(col) ? 'attendance' : 'workforce');


async function getJson(path) {
  const r = await apiFetch(path);
  if (!r.ok) {
    const err = new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}
function writeCache(value) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

function applyLocal(doc, ops) {
  const next = { ...doc };
  for (const o of ops) {
    next[o.col] = { ...next[o.col] };
    if (o.op === 'del') delete next[o.col][o.id];
    else next[o.col][o.id] = { ...o.value, _rev: (doc[o.col]?.[o.id]?._rev || 0) };
  }
  return next;
}

export function WorkforceProvider({ children, notify }) {
  const [state, setState] = useState({
    phase: 'loading', me: null, wf: emptyDoc(WORKFORCE_COLLECTIONS), att: emptyDoc(ATTENDANCE_COLLECTIONS),
    offline: false, syncedAt: null, error: null, saving: 0,
  });
  const ref = useRef(state);
  useEffect(() => { ref.current = state; });
  // The newest documents, updated in step with every save (state alone can
  // lag a render behind when saves are queued back to back).
  const docs = useRef({ wf: state.wf, att: state.att });
  const queue = useRef(Promise.resolve());
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [undoCount, setUndoCount] = useState({ undo: 0, redo: 0 });
  const bump = () => setUndoCount({ undo: undoStack.current.length, redo: redoStack.current.length });
  const notifyRef = useRef(notify);
  useEffect(() => { notifyRef.current = notify; });

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      const me = await getJson('/api/me');
      const perms = new Set(me.permissions);
      const canPlan = perms.has('workforce.view') || perms.has('self.view');
      const [wf, att] = await Promise.all([
        canPlan ? getJson('/api/workforce/state').catch(e => { if (e.status === 403) return null; throw e; }) : null,
        perms.has('attendance.view') ? getJson('/api/attendance/state') : null,
      ]);
      const next = {
        phase: 'ready', me, offline: false, error: null, syncedAt: Date.now(),
        wf: { ...emptyDoc(WORKFORCE_COLLECTIONS), ...(wf || {}) },
        att: { ...emptyDoc(ATTENDANCE_COLLECTIONS), ...(att || {}) },
      };
      docs.current = { wf: next.wf, att: next.att };
      setState(s => ({ ...s, ...next }));
      writeCache({ me, wf: next.wf, att: next.att, syncedAt: next.syncedAt });
    } catch (e) {
      if (e.status === 401 || e.status === 403) { setState(s => ({ ...s, phase: 'denied', error: e.message })); return; }
      const cached = readCache();
      if (cached && ref.current.phase !== 'ready') {
        docs.current = { wf: cached.wf, att: cached.att };
        setState(s => ({ ...s, phase: 'ready', offline: true, me: cached.me, wf: cached.wf, att: cached.att, syncedAt: cached.syncedAt }));
      } else if (cached || ref.current.phase === 'ready') setState(s => ({ ...s, offline: true }));
      else if (!quiet) setState(s => ({ ...s, phase: 'error', error: e.message, offline: true }));
      else setState(s => ({ ...s, offline: true }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible' && !ref.current.saving) load({ quiet: true });
    };
    const timer = setInterval(tick, POLL_MS);
    window.addEventListener('online', tick);
    const off = () => setState(s => ({ ...s, offline: true }));
    window.addEventListener('offline', off);
    return () => { clearInterval(timer); window.removeEventListener('online', tick); window.removeEventListener('offline', off); };
  }, [load]);

  const can = useCallback(p => !!state.me?.permissions?.includes(p) && !state.offline, [state.me, state.offline]);

  /** Send operations. Resolves true when saved. `silent` skips the undo stack. */
  const send = useCallback((ops, { label, record = true, isUndo = false } = {}) => {
    if (!ops.length) return Promise.resolve(true);
    if (ref.current.offline) { notifyRef.current?.('offline'); return Promise.resolve(false); }
    const run = async () => {
      const before = docs.current;
      const docKey = col => (SECTION_OF(col) === 'attendance' ? 'att' : 'wf');
      const withBase = ops.map(o => ({ ...o, base: o.base ?? (before[docKey(o.col)][o.col]?.[o.id]?._rev || 0) }));
      const inverse = withBase.map(o => {
        const prev = before[docKey(o.col)][o.col]?.[o.id];
        return prev ? { op: 'put', col: o.col, id: o.id, value: prev } : { op: 'del', col: o.col, id: o.id };
      }).reverse();
      const bySection = { workforce: [], attendance: [] };
      for (const o of withBase) bySection[SECTION_OF(o.col)].push(o);
      // Optimistic: show it now.
      docs.current = { wf: applyLocal(before.wf, bySection.workforce), att: applyLocal(before.att, bySection.attendance) };
      setState(s => ({ ...s, ...docs.current, saving: s.saving + 1 }));
      try {
        const changed = [];
        for (const section of ['workforce', 'attendance']) {
          if (!bySection[section].length) continue;
          const r = await apiFetch(`/api/${section}/ops`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: bySection[section] }) });
          const body = await r.json().catch(() => ({}));
          if (!r.ok) { const err = new Error(body.error || `HTTP ${r.status}`); err.status = r.status; throw err; }
          changed.push(...body.changed);
        }
        const wf = { ...docs.current.wf }; const att = { ...docs.current.att };
        for (const c of changed) {
          const doc = SECTION_OF(c.col) === 'attendance' ? att : wf;
          doc[c.col] = { ...doc[c.col] };
          if (c.value) doc[c.col][c.id] = c.value; else delete doc[c.col][c.id];
        }
        docs.current = { wf, att };
        const syncedAt = Date.now();
        setState(s => ({ ...s, wf, att, saving: s.saving - 1, syncedAt }));
        writeCache({ me: ref.current.me, wf, att, syncedAt });
        if (record) {
          // The inverse must be based on the versions this save produced.
          const revs = new Map(changed.map(c => [`${c.col}/${c.id}`, c.value ? c.value._rev : 0]));
          const inv = inverse.map(o => ({ ...o, base: revs.get(`${o.col}/${o.id}`) }));
          (isUndo ? redoStack : undoStack).current.push({ ops: inv, label });
          if (!isUndo && record !== 'redo') redoStack.current = [];
          if (undoStack.current.length > 50) undoStack.current.shift();
          bump();
        }
        return true;
      } catch (e) {
        docs.current = before;
        setState(s => ({ ...s, wf: before.wf, att: before.att, saving: s.saving - 1 }));
        if (e.status === 409) { notifyRef.current?.(isUndo ? 'undoConflict' : 'conflict'); await load({ quiet: true }); }
        else if (e.status === 403) notifyRef.current?.('forbidden', e.message);
        else if (e.status) notifyRef.current?.('error', e.message);
        else { setState(s => ({ ...s, offline: true })); notifyRef.current?.('offline'); }
        return false;
      }
    };
    const p = queue.current.then(run, run);
    queue.current = p.catch(() => {});
    return p;
  }, [load]);

  const commit = useCallback(async (ops, label) => {
    const ok = await send(ops, { label });
    if (ok && label) notifyRef.current?.('done', label, { undo: () => undoRef.current() });
    return ok;
  }, [send]);
  const undoRef = useRef(() => {});

  const undo = useCallback(async () => {
    const step = undoStack.current.pop();
    bump();
    if (!step) return;
    const ok = await send(step.ops, { label: step.label, isUndo: true });
    if (ok) notifyRef.current?.('undone', step.label);
  }, [send]);
  useEffect(() => { undoRef.current = undo; });
  const redo = useCallback(async () => {
    const step = redoStack.current.pop();
    bump();
    if (!step) return;
    const ok = await send(step.ops, { label: step.label, record: 'redo' });
    if (ok) notifyRef.current?.('redone', step.label);
  }, [send]);

  // Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z, but never while typing: text fields
  // keep their own undo.
  useEffect(() => {
    const onKey = e => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const el = document.activeElement;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const idx = useMemo(() => buildIndex(state.wf), [state.wf]);
  const value = useMemo(() => ({
    ...state, idx, can, commit, undo, redo, reload: load,
    canUndo: undoCount.undo > 0, canRedo: undoCount.redo > 0,
    entries: Object.values(state.att.entries || {}),
  }), [state, idx, can, commit, undo, redo, load, undoCount]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
