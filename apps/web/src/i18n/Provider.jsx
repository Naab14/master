import { useCallback, useEffect, useMemo, useState } from 'react';
import { I18nContext, KEY, loadLang, makeFormat, translate } from './core';

export default function I18nProvider({ children, initial }) {
  const [lang, setLangState] = useState(initial || loadLang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback(l => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* still applies for this visit */ }
  }, []);
  const value = useMemo(() => ({ lang, setLang, t: (text, vars) => translate(lang, text, vars), fmt: makeFormat(lang) }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
