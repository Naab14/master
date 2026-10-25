import { useState } from 'react';
import { Segmented } from '../ui';
import { THEMES, loadTheme, applyTheme } from './theme';

/* Theme picker for the nav rail. Wide: Calm | Arcade | Night. Narrow rail:
 * one button that steps to the next theme and says which one is on. */
export default function ThemeSwitcher({ compact = false }) {
  const [theme, setTheme] = useState(loadTheme);
  const pick = id => setTheme(applyTheme(id));

  if (compact) {
    const i = THEMES.findIndex(t => t.id === theme);
    const next = THEMES[(i + 1) % THEMES.length];
    return (
      <button
        type="button"
        onClick={() => pick(next.id)}
        className="ui-focus flex h-11 w-11 items-center justify-center rounded-control hover:bg-soft"
        aria-label={`Theme: ${THEMES[i].label}. Switch to ${next.label}`}
        title={`Theme: ${THEMES[i].label}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="t-label">Theme</span>
      <Segmented label="Theme" value={theme} onChange={pick} options={THEMES.map(t => ({ value: t.id, label: t.label }))} className="ui-seg--small" />
    </div>
  );
}
