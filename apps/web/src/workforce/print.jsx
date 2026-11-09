/* Print layouts: real pages, not the interactive screen.
 *
 * <PrintPreview> shows the pages at paper proportions with paper size and
 * orientation choices, then prints only those pages (the app is hidden in
 * print). "Save as PDF" in the browser's print dialog gives the PDF export.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Segmented } from '../ui';
import { useI18n } from '../i18n';
import { usePref } from './prefs';
import { PAPER } from './print-util';


export function PrintPreview({ id, onClose, children, allowed = ['A4', 'A3'], defaultOrientation = 'landscape' }) {
  const { t } = useI18n();
  const [pref, setPref] = usePref(`print-${id}`, { paper: 'A4', orientation: defaultOrientation });
  const [w, h] = PAPER[pref.paper] || PAPER.A4;
  const width = pref.orientation === 'landscape' ? h : w;
  const height = pref.orientation === 'landscape' ? w : h;

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `@page { size: ${pref.paper} ${pref.orientation}; margin: 10mm; }`;
    document.head.appendChild(style);
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { style.remove(); document.removeEventListener('keydown', onKey); };
  }, [pref.paper, pref.orientation, onClose]);

  return createPortal(
    <div className="print-preview" role="dialog" aria-modal="true" aria-label={t('Print preview')}>
      <div className="print-preview__bar">
        <strong>{t('Print preview')}</strong>
        <Segmented label={t('Paper size')} value={pref.paper} onChange={paper => setPref({ paper })} options={allowed.map(p => ({ value: p, label: p }))} />
        <Segmented label={t('Orientation')} value={pref.orientation} onChange={orientation => setPref({ orientation })}
          options={[{ value: 'portrait', label: t('Portrait') }, { value: 'landscape', label: t('Landscape') }]} />
        <span className="flex-1" />
        <Button onClick={onClose}>{t('Close')}</Button>
        <Button variant="primary" onClick={() => window.print()}>{t('Print / Save as PDF')}</Button>
      </div>
      <div className="print-preview__pages" style={{ '--pw': `${width}mm`, '--ph': `${height}mm` }}>
        {typeof children === 'function' ? children({ paper: pref.paper, orientation: pref.orientation, width, height }) : children}
      </div>
    </div>,
    document.body,
  );
}

/** One sheet of paper. Children decide how much fits; see chunk(). */
export function PrintPage({ title, range, legend, children, page, pages, note }) {
  const { t, fmt } = useI18n();
  const [now] = useState(() => Date.now());
  return (
    <div className="print-page" style={{ width: 'var(--pw)', minHeight: 'var(--ph)' }}>
      <h1>{title}</h1>
      <div className="meta"><span>{range}</span><span>{t('Printed {when}', { when: fmt.stamp(now) })}</span></div>
      {children}
      {legend && <div className="legend">{legend}</div>}
      <div className="foot"><span>{note || t('Planning aid. Not the official time, payroll or training record.')}</span>{pages > 1 && <span>{page} / {pages}</span>}</div>
    </div>
  );
}
