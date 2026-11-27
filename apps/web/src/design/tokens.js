/* Reads the theme tokens straight from src/theme/tokens.css, so the workshop
 * always shows the values the app uses, and works out WCAG contrast. */
import css from '../theme/tokens.css?raw';

export const THEME_IDS = ['calm', 'arcade', 'night'];

export function parseThemes(text) {
  const themes = {};
  for (const id of THEME_IDS) {
    const m = new RegExp(`\\[data-theme='${id}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`).exec(text);
    const body = (m ? m[1] : '').replace(/\/\*[\s\S]*?\*\//g, '');
    themes[id] = Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
  }
  return themes;
}

export const THEMES = parseThemes(css);

/* '#abc', '#aabbcc', 'rgb(...)', 'rgba(...)', 'transparent' → [r, g, b, a] or null */
export function parseColor(value) {
  const v = String(value).trim().toLowerCase();
  if (v === 'transparent') return [0, 0, 0, 0];
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (m) {
    const hex = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1];
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).concat(1);
  }
  m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (m) {
    const p = m[1].split(',').map(s => parseFloat(s));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
}

/* Paint a see-through colour over an opaque one. */
export function over(top, bottom) {
  const a = top[3];
  return [0, 1, 2].map(i => Math.round(top[i] * a + bottom[i] * (1 - a))).concat(1);
}

function luminance([r, g, b]) {
  const lin = c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/* Contrast of fg on bg; both may be see-through, painted over `ground`. */
export function contrast(fg, bg, ground = '#ffffff') {
  const g = parseColor(ground);
  const b = over(parseColor(bg), g);
  const f = over(parseColor(fg), b);
  const [l1, l2] = [luminance(f), luminance(b)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}

/* WCAG level for normal text: AA at 4.5, AAA at 7; 3 is enough for large text and UI edges. */
export function grade(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'Large';
  return 'Fail';
}

export const COLOR_GROUPS = [
  { title: 'Surfaces', names: ['surface-ground', 'surface-sidebar', 'surface-panel', 'surface-soft', 'line', 'line-strong'] },
  { title: 'Text and action', names: ['ink', 'ink-2', 'ink-3', 'primary', 'on-primary', 'focus'] },
  { title: 'Coverage and work', names: ['ok-bg', 'ok-fg', 'ok-solid', 'warn-bg', 'warn-fg', 'warn-solid', 'bad-bg', 'bad-fg', 'bad-solid', 'idle-bg', 'idle-fg'] },
  { title: 'Leave', names: ['leave-approved-bg', 'leave-approved-fg', 'leave-pending-bg', 'leave-pending-fg', 'leave-pending-edge', 'leave-draft-bg', 'leave-draft-fg', 'leave-requested-edge'] },
  { title: 'Shift HQ categories', names: ['cat-safety', 'cat-quality', 'cat-delivery', 'cat-cost', 'cat-people'] },
];

/* Text pairs the app relies on; the workshop checks each in every theme. */
export const TEXT_PAIRS = [
  ['ink', 'surface-ground'], ['ink-2', 'surface-ground'], ['ink-3', 'surface-ground'], ['ink-3', 'surface-panel'],
  ['on-primary', 'primary'], ['ok-fg', 'ok-bg'], ['warn-fg', 'warn-bg'], ['bad-fg', 'bad-bg'], ['idle-fg', 'idle-bg'],
  ['leave-approved-fg', 'leave-approved-bg'], ['leave-pending-fg', 'leave-pending-bg'], ['leave-draft-fg', 'leave-draft-bg'],
];
