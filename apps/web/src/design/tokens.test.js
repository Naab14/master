import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parseThemes, THEME_IDS, parseColor, contrast, grade, TEXT_PAIRS, COLOR_GROUPS } from './tokens.js';

// Vitest blanks CSS imports, so read the file itself.
const THEMES = parseThemes(fs.readFileSync('src/theme/tokens.css', 'utf8'));

describe('design tokens', () => {
  it('reads every theme from tokens.css', () => {
    for (const id of THEME_IDS) expect(THEMES[id].ink).toMatch(/^#/);
    expect(THEMES.calm['surface-ground']).toBe('#FBFBFA');
  });

  it('knows every colour the workshop shows', () => {
    for (const id of THEME_IDS) for (const g of COLOR_GROUPS) for (const n of g.names) expect(parseColor(THEMES[id][n]), `${id} ${n}`).not.toBeNull();
  });

  it('measures contrast like WCAG', () => {
    expect(contrast('#000000', '#ffffff')).toBe(21);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(grade(4.5)).toBe('AA');
    expect(grade(3.2)).toBe('Large');
  });

  it('keeps every text pair readable (4.5:1) in all three themes', () => {
    for (const id of THEME_IDS) {
      const t = THEMES[id];
      for (const [fg, bg] of TEXT_PAIRS) {
        expect(contrast(t[fg], t[bg], t['surface-ground']), `${id}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
