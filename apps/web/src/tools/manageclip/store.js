/* Shift HQ (ManageClip) state — the same Tasks / Logs / Links / Settings
 * models the standalone tool kept in localStorage, now synced to the Master
 * backend at /api/manageclip/state. localStorage stays as an offline cache.
 */
import { apiFetch } from '../../access';
import { useCallback, useEffect, useRef, useState } from 'react';

/* ── Date helpers (all local time, YYYY-MM-DD strings) ─────────────────── */
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function fmtDate(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDaysStr(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
export function todayStr() { return fmtDate(new Date()); }
export function startOfWeek(d) { // Monday
  const out = new Date(d);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  out.setHours(0, 0, 0, 0);
  return out;
}
export function niceDate(s) {
  const d = parseDate(s);
  return `${DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/* Effective status: 'finished' sticks; anything unfinished past due is overdue. */
export function effStatus(task) {
  if (task.status === 'finished') return 'finished';
  return task.due_date < todayStr() ? 'overdue' : 'current';
}

export const TASK_CATEGORIES = ['Gemba Walk', 'Safety Audit', 'Coaching', 'Meeting', 'Reporting', 'Other'];
export const LOG_CATEGORIES = ['Safety', 'Quality', 'Delivery', 'Cost', 'People', 'Other'];

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ── Seed (same demo data as the standalone tool's first run) ──────────── */
export function seedState() {
  const today = todayStr();
  const task = (offset, title, category, status) =>
    ({ id: uid(), title, description: '', category, status, due_date: addDaysStr(today, offset) });
  const link = (url, display_name, icon_reference, display_mode) =>
    ({ id: uid(), url, display_name, icon_reference, display_mode });
  return {
    tasks: [
      task(-2, 'Safety cross review', 'Safety Audit', 'finished'),
      task(-1, 'Gemba walk – Line 1', 'Gemba Walk', 'current'),
      task(0, 'Shift handover meeting', 'Meeting', 'current'),
      task(0, 'Coach team lead on 5S', 'Coaching', 'current'),
      task(1, 'Gemba walk – Line 2', 'Gemba Walk', 'current'),
      task(2, 'Weekly KPI report', 'Reporting', 'current'),
    ],
    logs: [
      { id: uid(), entry_date: today, category: 'Safety', content: 'Near-miss reported at packing station; area taped off and ticket raised.' },
      { id: uid(), entry_date: today, category: 'Delivery', content: 'Line 2 output back on plan after morning changeover delay.' },
    ],
    links: [
      link('https://example.com/andon', 'Andon Board', '🚨', 'thumbnail'),
      link('https://example.com/kpi', 'KPI Tracker', '📈', 'symbol'),
      link('https://example.com/handbook', 'Shift Handbook', '📘', 'name'),
    ],
    settings: { weeklyTarget: 20 },
  };
}

/* ── Persistence ───────────────────────────────────────────────────────── */
const CACHE_KEY = 'master-manageclip';

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCache(state) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/* Resolves { ok: true, state } or { ok: false } when the server can't be reached. */
function fetchServer() {
  try {
    return apiFetch('/api/manageclip/state')
      .then(r => (r.ok ? r.json().then(state => ({ ok: true, state })) : { ok: false }))
      .catch(() => ({ ok: false }));
  } catch { return Promise.resolve({ ok: false }); }
}

function pushServer(state) {
  try {
    return apiFetch('/api/manageclip/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    }).catch(() => {});
  } catch { return Promise.resolve(); }
}

const isEmpty = s => !s || (!(s.tasks || []).length && !(s.logs || []).length && !(s.links || []).length);

/* ── The state hook ────────────────────────────────────────────────────── */
export function useManageclip() {
  const [state, setState] = useState(() => loadCache() || seedState());
  const loaded = useRef(false);   // server copy adopted — saves may reach the server
  const saveTimer = useRef(null);
  const pending = useRef(null);   // state waiting on the debounce, if any
  const latest = useRef(state);

  // Adopt the server copy on mount; seed the server if it's still empty. If
  // the server can't be reached, stay local-only rather than treat it as empty.
  useEffect(() => {
    let cancelled = false;
    fetchServer().then(({ ok, state: server }) => {
      if (cancelled || !ok) return;
      if (!isEmpty(server)) {
        setState({ settings: { weeklyTarget: 20 }, ...server });
      } else {
        pushServer(latest.current);
      }
      loaded.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  // Cache + debounced server push on every change.
  useEffect(() => {
    latest.current = state;
    saveCache(state);
    if (!loaded.current) return;
    pending.current = state;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      pending.current = null;
      pushServer(state);
    }, 500);
  }, [state]);

  // Switching sections unmounts this tool — send a save still waiting on the
  // debounce instead of dropping it.
  useEffect(() => () => {
    clearTimeout(saveTimer.current);
    if (pending.current) pushServer(pending.current);
  }, []);

  /* ── Mutators (immutable versions of the old Store API) ─────────────── */
  const saveTask = useCallback(task => setState(s => {
    if (!task.id) return { ...s, tasks: [...s.tasks, { ...task, id: uid() }] };
    const exists = s.tasks.some(t => t.id === task.id);
    return { ...s, tasks: exists ? s.tasks.map(t => (t.id === task.id ? task : t)) : [...s.tasks, task] };
  }), []);

  const deleteTask = useCallback(id =>
    setState(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) })), []);

  const addLog = useCallback(log =>
    setState(s => ({ ...s, logs: [{ ...log, id: uid() }, ...s.logs] })), []);

  const deleteLog = useCallback(id =>
    setState(s => ({ ...s, logs: s.logs.filter(l => l.id !== id) })), []);

  const saveLink = useCallback(link => setState(s => {
    if (!link.id) return { ...s, links: [...s.links, { ...link, id: uid() }] };
    const exists = s.links.some(l => l.id === link.id);
    return { ...s, links: exists ? s.links.map(l => (l.id === link.id ? link : l)) : [...s.links, link] };
  }), []);

  const deleteLink = useCallback(id =>
    setState(s => ({ ...s, links: s.links.filter(l => l.id !== id) })), []);

  const moveLink = useCallback((id, dir) => setState(s => {
    const links = [...s.links];
    const i = links.findIndex(l => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= links.length) return s;
    [links[i], links[j]] = [links[j], links[i]];
    return { ...s, links };
  }), []);

  const reorderLink = useCallback((id, beforeId) => setState(s => {
    const links = [...s.links];
    const i = links.findIndex(l => l.id === id);
    if (i < 0) return s;
    const [moved] = links.splice(i, 1);
    const j = beforeId ? links.findIndex(l => l.id === beforeId) : -1;
    if (j < 0) links.push(moved); else links.splice(j, 0, moved);
    return { ...s, links };
  }), []);

  const saveSettings = useCallback(patch =>
    setState(s => ({ ...s, settings: { ...s.settings, ...patch } })), []);

  return {
    state,
    saveTask, deleteTask,
    addLog, deleteLog,
    saveLink, deleteLink, moveLink, reorderLink,
    saveSettings,
  };
}

/* ── Weekly review aggregation (pure, shared with the PDF export) ─────── */
export function reviewData(state, reviewAnchor) {
  const start = startOfWeek(reviewAnchor);
  const startStr = fmtDate(start);
  const endStr = addDaysStr(startStr, 6);
  const inWeek = s => s >= startStr && s <= endStr;
  const tasks = state.tasks.filter(t => inWeek(t.due_date));
  const completed = tasks.filter(t => t.status === 'finished');
  const overdue = tasks.filter(t => effStatus(t) === 'overdue');
  const logs = state.logs.filter(l => inWeek(l.entry_date))
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const target = state.settings.weeklyTarget || 20;

  const cats = {};
  tasks.forEach(t => {
    const c = cats[t.category] = cats[t.category] || { scheduled: 0, completed: 0 };
    c.scheduled++;
    if (t.status === 'finished') c.completed++;
  });
  return { startStr, endStr, tasks, completed, overdue, logs, target, cats };
}
