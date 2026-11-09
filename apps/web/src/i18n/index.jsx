/* English and Swedish.
 *
 * t('Save') returns the text in the chosen language; the English text is the
 * key, and sv.js holds the Swedish. {name} placeholders are filled from the
 * second argument. A test (i18n.test.js) fails when a text used in the
 * workforce screens has no Swedish translation.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import sv from './sv';

const KEY = 'master-lang';
export const LANGUAGES = [{ id: 'en', label: 'English' }, { id: 'sv', label: 'Svenska' }];

export function loadLang() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'sv') return saved;
  } catch { /* fall through */ }
  return typeof navigator !== 'undefined' && /^sv/i.test(navigator.language || '') ? 'sv' : 'en';
}

export function translate(lang, text, vars) {
  let out = lang === 'sv' ? (sv[text] ?? text) : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

const LOCALE = { en: 'en-GB', sv: 'sv-SE' };
const utc = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };

function makeFormat(lang) {
  const locale = LOCALE[lang];
  const f = opts => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts });
  const fmts = {
    day: f({ day: 'numeric' }), weekday: f({ weekday: 'short' }), weekdayLong: f({ weekday: 'long' }),
    short: f({ day: 'numeric', month: 'short' }), long: f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    month: f({ month: 'long', year: 'numeric' }), monthShort: f({ month: 'short' }), full: f({ year: 'numeric', month: '2-digit', day: '2-digit' }),
  };
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const stamp = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Stockholm' });
  return {
    locale,
    date: (s, style = 'short') => (s ? fmts[style].format(utc(s)) : ''),
    num: n => num.format(n),
    hours: n => `${num.format(n)} h`,
    stamp: ms => stamp.format(new Date(ms)),
    /** A name stored as { en, sv } or as plain text. */
    name: v => (v && typeof v === 'object' ? v[lang] || v.en || '' : v || ''),
  };
}

const I18nContext = createContext(null);

export function I18nProvider({ children, initial }) {
  const [lang, setLangState] = useState(initial || loadLang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback(l => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* still applies for this visit */ }
  }, []);
  const value = useMemo(() => ({ lang, setLang, t: (text, vars) => translate(lang, text, vars), fmt: makeFormat(lang) }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const FALLBACK = { lang: 'en', setLang: () => {}, t: (text, vars) => translate('en', text, vars), fmt: makeFormat('en') };
export const useI18n = () => useContext(I18nContext) || FALLBACK;
