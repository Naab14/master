import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../../i18n';
import { Button, Segmented } from '../../../ui';

export default function TopBar({
  shiftMode, onShiftModeChange, byTeam = false,
  onImportCSV, onExportCSV, onSave, onExportJSON, onImportJSON, onReset, onShare,
  onUndo, onRedo, canUndo, canRedo,
}) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const handleKey = e => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [menuOpen]);

  const modes = [
    { value: 'separate', label: t('Separate') },
    { value: 'combined', label: t('Combined') },
    { value: 'summer', label: t('Summer') },
  ];

  const menu = [
    { label: t('Import people (CSV)'), action: onImportCSV },
    { label: t('Export people (CSV)'), action: onExportCSV },
    { label: t('Export a backup file'), action: onExportJSON },
    { label: t('Import a backup file'), action: onImportJSON },
    { label: t('Save'), action: onSave },
  ].filter(item => item.action);

  return (
    <div className="wf-pagehead relative z-30">
      <h1 className="wf-pagehead__title">{t('Vacations')}</h1>

      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        {/* History */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" icon onClick={onUndo} disabled={!canUndo} title={`${t('Undo')} (Ctrl+Z)`} aria-label={t('Undo')}>↶</Button>
          <Button variant="ghost" icon onClick={onRedo} disabled={!canRedo} title={`${t('Redo')} (Ctrl+Shift+Z)`} aria-label={t('Redo')}>↷</Button>
        </div>

        {/* How the shifts are shown */}
        <Segmented label={byTeam ? t('Teams') : t('Shifts')} options={modes} value={shiftMode} onChange={onShiftModeChange} />

        <Button variant="primary" onClick={onShare} title={t('Copy a link to this plan')}>{t('Share')}</Button>
      </div>

      {/* More: a span, so the phone layout doesn't clip the menu */}
      <span className="relative" ref={menuRef}>
        <Button variant="ghost" icon aria-label={t('More')} title={t('More')} aria-haspopup="menu" aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}>
          ⋮
        </Button>
        {menuOpen && (
          <div role="menu" className="tl-pop tl-pop--right absolute right-0 top-full z-50 mt-1 flex min-w-[220px] flex-col p-1">
            {menu.map(item => (
              <button key={item.label} type="button" role="menuitem" className="tl-menu-item"
                onClick={() => { item.action(); setMenuOpen(false); }}>
                {item.label}
              </button>
            ))}
            <hr className="tl-menu-rule" />
            <button type="button" role="menuitem" className="tl-menu-item tl-menu-item--danger"
              onClick={() => { onReset(); setMenuOpen(false); }}>
              {t('Reset…')}
            </button>
          </div>
        )}
      </span>
    </div>
  );
}
