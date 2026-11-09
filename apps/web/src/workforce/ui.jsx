/* Small shared pieces for the workforce screens. */
import { useEffect, useRef, useState } from 'react';
import { usePref } from './prefs';
import { createPortal } from 'react-dom';
import { Button } from '../ui';
import { useI18n } from '../i18n';
import { initials } from './logic/model';

/**
 * Details panel: a drawer on wide screens, full screen on phones, with a
 * fullscreen switch. The page behind stays as it was, so closing returns to
 * the same view and scroll position. Esc closes; focus returns to the opener.
 */
export function Sheet({ title, subtitle, onClose, children, footer, wide = false }) {
  const { t } = useI18n();
  const [full, setFull] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    ref.current?.focus();
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); opener?.focus?.(); };
  }, [onClose]);
  return createPortal(
    <div className="wf-sheet-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={`wf-sheet ${full ? 'wf-sheet--full' : ''} ${wide ? 'wf-sheet--wide' : ''}`}>
        <header className="flex items-start gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="t-section truncate">{title}</h2>
            {subtitle && <p className="truncate text-xs text-ink-3">{subtitle}</p>}
          </div>
          <Button variant="ghost" icon className="wf-sheet__fullbtn" aria-label={full ? t('Exit full screen') : t('Full screen')} title={full ? t('Exit full screen') : t('Full screen')} onClick={() => setFull(f => !f)}>
            {full ? '⤡' : '⤢'}
          </Button>
          <Button variant="ghost" icon aria-label={t('Close')} title={t('Close')} onClick={onClose}>✕</Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}

export function Confirm({ title, body, confirmLabel, onConfirm, onCancel, danger = false }) {
  const { t } = useI18n();
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = e => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return createPortal(
    <div className="wf-sheet-backdrop wf-sheet-backdrop--center" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-label={title} className="wf-dialog">
        <h2 className="t-section">{title}</h2>
        <div className="mt-2 text-sm text-ink-2">{body}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onCancel}>{t('Cancel')}</Button>
          <Button ref={ref} variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Avatar({ person, size = 28 }) {
  const style = { width: size, height: size, fontSize: size * 0.4, background: person?.color || 'var(--surface-soft)' };
  if (person?.avatar) return <img src={person.avatar} alt="" className="wf-avatar" style={style} />;
  return <span className="wf-avatar" style={style} aria-hidden="true">{initials(person?.name)}</span>;
}

/** Subtle consultant / permanent marker; the admin picks dot, tag or none. */
export function EmploymentMark({ person, mode = 'dot' }) {
  const { t } = useI18n();
  if (mode === 'none' || !person?.employment) return null;
  const label = person.employment === 'consultant' ? t('Consultant') : t('Permanent');
  if (mode === 'tag') return <span className="wf-emp-tag" data-emp={person.employment}>{label}</span>;
  return <span className="wf-emp-dot" data-emp={person.employment} title={label} role="img" aria-label={label} />;
}

export function Empty({ title, children, action }) {
  return (
    <div className="mx-auto my-10 max-w-md rounded-panel border border-dashed border-line-strong p-6 text-center">
      <h3 className="t-section">{title}</h3>
      {children && <p className="mt-2 text-sm text-ink-2">{children}</p>}
      {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, children }) {
  return (
    <div className="wf-pagehead no-print">
      <h1 className="wf-pagehead__title">{title}</h1>
      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

export function Field({ label, children, hint, className = '' }) {
  return (
    <label className={`ui-field ${className}`}>
      <span className="text-xs font-semibold text-ink-3">{label}</span>
      {children}
      {hint && <small className="ui-field__hint">{hint}</small>}
    </label>
  );
}
export const Select = ({ className = '', ...rest }) => <select className={`ui-input ${className}`} {...rest} />;
export const Input = ({ className = '', ...rest }) => <input className={`ui-input ${className}`} {...rest} />;

/** Collapsible section that remembers whether it is open. */
export function Collapsible({ id, title, children, defaultOpen = true, right }) {
  const [pref, setPref] = usePref(`collapse-${id}`, { open: defaultOpen });
  return (
    <section className="rounded-panel border border-line bg-panel">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" className="ui-focus flex flex-1 items-center gap-2 text-left text-sm font-semibold" aria-expanded={pref.open} onClick={() => setPref({ open: !pref.open })}>
          <span aria-hidden="true" className="wf-chevron" data-open={pref.open}>▸</span>{title}
        </button>
        {right}
      </div>
      {pref.open && <div className="border-t border-line p-3">{children}</div>}
    </section>
  );
}
