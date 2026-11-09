/* Preferences remembered in this browser, and shared display constants. */
import { useCallback, useState } from 'react';

/** A preference remembered in this browser (view, zoom, filters …). */
export function usePref(key, initial) {
  const full = `master-pref-${key}`;
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(full);
      return raw === null ? initial : { ...(typeof initial === 'object' && !Array.isArray(initial) ? initial : {}), ...JSON.parse(raw) };
    } catch { return initial; }
  });
  const set = useCallback(patch => setValue(prev => {
    const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
    try { localStorage.setItem(full, JSON.stringify(next)); } catch { /* not saved */ }
    return next;
  }), [full]);
  return [value, set];
}


export const STATUS_TONE = { met: 'ok', risk: 'warn', short: 'bad', none: 'idle' };
