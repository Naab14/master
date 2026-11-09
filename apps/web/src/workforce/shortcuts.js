/* Keyboard shortcuts, changeable per browser (Settings → Keyboard). */
import { useEffect, useRef } from 'react';

export const SHORTCUT_ACTIONS = [
  { id: 'today', label: 'Go to today', key: 't' },
  { id: 'week', label: 'Week view', key: 'w' },
  { id: 'month', label: 'Month view', key: 'm' },
  { id: 'zoomIn', label: 'Zoom in', key: '+' },
  { id: 'zoomOut', label: 'Zoom out', key: '-' },
  { id: 'prev', label: 'Earlier', key: '[' },
  { id: 'next', label: 'Later', key: ']' },
  { id: 'print', label: 'Print', key: 'p' },
  { id: 'off', label: 'Selected shift: day off', key: 'o' },
  { id: 'reset', label: 'Selected shift: back to pattern', key: 'r' },
];
const KEY = 'master-shortcuts';

export function loadShortcuts() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* defaults */ }
  return Object.fromEntries(SHORTCUT_ACTIONS.map(a => [a.id, typeof saved[a.id] === 'string' ? saved[a.id] : a.key]));
}
export function saveShortcuts(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* not saved */ }
}
export const isTyping = el => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** Run handlers[actionId]() on its key, unless the user is typing or a dialog is open. */
export function useShortcuts(handlers) {
  const ref = useRef(handlers);
  useEffect(() => { ref.current = handlers; });
  useEffect(() => {
    const map = loadShortcuts();
    const onKey = e => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(document.activeElement)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const key = e.key.toLowerCase();
      for (const [id, k] of Object.entries(map)) {
        if (k && k.toLowerCase() === key && ref.current[id]) { e.preventDefault(); ref.current[id](e); return; }
      }
      ref.current.other?.(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
