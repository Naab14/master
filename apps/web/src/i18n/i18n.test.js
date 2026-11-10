import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sv from './sv';
import { translate } from './core';

const here = path.dirname(fileURLToPath(import.meta.url));

/* Every text passed to t('…') in the planning screens needs Swedish. */
function usedTexts() {
  const files = [];
  const walk = dir => {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.jsx?$/.test(f) && !/\.test\./.test(f)) files.push(p);
    }
  };
  walk(path.resolve(here, '../workforce'));
  files.push(path.resolve(here, '../App.jsx'), path.resolve(here, '../shell/SignIn.jsx'), path.resolve(here, '../dashboard/Dashboard.jsx'), path.resolve(here, '../theme/ThemeSwitcher.jsx'));
  const out = new Set();
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'((?:\\'|[^'])*)'/g)) out.add(m[1].replace(/\\'/g, "'"));
  }
  for (const f of ['../workforce/shortcuts.js', '../App.jsx']) {
    for (const m of fs.readFileSync(path.resolve(here, f), 'utf8').matchAll(/label: '([^']+)'/g)) out.add(m[1]);
  }
  return [...out];
}

describe('i18n', () => {
  it('has Swedish for every text in the planning screens', () => {
    const missing = usedTexts().filter(k => !(k in sv));
    expect(missing).toEqual([]);
  });
  it('keeps the placeholders of each text', () => {
    const broken = Object.entries(sv).filter(([en, s]) => {
      const vars = t => (t.match(/\{\w+\}/g) || []).sort().join();
      return vars(en) !== vars(s);
    }).map(([en]) => en);
    expect(broken).toEqual([]);
  });
  it('fills placeholders and falls back to English', () => {
    expect(translate('sv', '{n} people', { n: 3 })).toBe('3 personer');
    expect(translate('en', '{n} people', { n: 3 })).toBe('3 people');
    expect(translate('sv', 'Not translated yet')).toBe('Not translated yet');
  });
});
