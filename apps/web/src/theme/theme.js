/* App-wide theme: Calm (default), Arcade or Night shift. Saved per browser
 * and applied as <html data-theme>, which switches every token in
 * src/theme/tokens.css. */

export const THEMES = [
  { id: 'calm', label: 'Calm' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'night', label: 'Night' },
];
export const DEFAULT_THEME = 'calm';

const KEY = 'master-theme';
const OLD_VACATION_KEY = 'vacation-planner-theme';

export function loadTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    return THEMES.some(t => t.id === saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(id) {
  const theme = THEMES.some(t => t.id === id) ? id : DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
    localStorage.removeItem(OLD_VACATION_KEY); // the Vacations-only themes are gone
  } catch { /* private mode: the theme still applies for this visit */ }
  return theme;
}
