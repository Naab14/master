import { useState, useEffect, useRef } from 'react';
import { themes } from '../data';

export default function TopBar({
  shiftMode, onShiftModeChange, theme, onThemeChange,
  onImportCSV, onExportCSV, onSave, onExportJSON, onImportJSON, onReset, onShare,
  onUndo, onRedo, canUndo, canRedo,
}) {
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
    { value: 'separate', label: 'Separate' },
    { value: 'combined', label: 'Combined' },
    { value: 'summer', label: 'Summer' },
  ];

  return (
    <div className="flex items-center gap-3 px-5 py-2 flex-wrap shadow-md z-30 relative" style={{ background: 'var(--topbar-bg)', color: 'var(--topbar-text)' }}>
      <h1 className="impact-heading text-base mr-3 whitespace-nowrap">Semester Planner</h1>

      {/* Undo / Redo — history controls */}
      <div className="flex items-center gap-1 mr-1">
        <button onClick={onUndo} disabled={!canUndo}
          title="Undo (Ctrl+Z)" aria-label="Undo"
          className="px-2 py-1 text-base font-bold rounded-lg transition-all duration-200 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: 'var(--topbar-text)' }}>
          ↶
        </button>
        <button onClick={onRedo} disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)" aria-label="Redo"
          className="px-2 py-1 text-base font-bold rounded-lg transition-all duration-200 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: 'var(--topbar-text)' }}>
          ↷
        </button>
      </div>

      {/* Shift mode pill toggle — Neo-Kinetic indigo */}
      <div className="flex items-center gap-0.5 p-1 rounded-full border border-white/10" style={{ background: 'rgba(0,0,0,0.25)' }}>
        {modes.map(m => (
          <button key={m.value} onClick={() => onShiftModeChange(m.value)}
            className="px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200"
            style={shiftMode === m.value
              ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 0 12px rgba(79,70,229,0.5)' }
              : { background: 'transparent', color: 'rgba(255,255,255,0.7)' }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Theme select */}
      <div className="flex items-center gap-2 ml-2">
        <span className="text-xs uppercase tracking-wider font-semibold opacity-60">Theme</span>
        <div className="relative">
          <select value={theme} onChange={e => onThemeChange(e.target.value)}
            className="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg font-medium outline-none cursor-pointer shadow-sm border"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
            {themes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 opacity-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2.5 ml-auto">
        {/* Share — prominent indigo button */}
        <button onClick={onShare}
          className="px-4 py-1 text-xs font-bold rounded-full transition-all duration-200 hover:scale-[1.03] active:scale-95"
          style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 0 16px rgba(79,70,229,0.4)' }}>
          Share
        </button>

        {/* Overflow menu */}
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(o => !o)}
            className="px-2 py-1 text-base font-bold rounded-lg transition-all duration-200 hover:bg-white/10"
            style={{ color: 'var(--topbar-text)' }}>
            ⋮
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 py-1 min-w-[160px] rounded-lg shadow-xl z-50"
              style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
              {[
                { label: 'Import CSV', action: onImportCSV },
                { label: 'Export CSV', action: onExportCSV },
                { label: 'Export', action: onExportJSON },
                { label: 'Import JSON', action: onImportJSON },
                { label: 'Save', action: onSave },
              ].filter(item => item.action).map(item => (
                <button key={item.label} onClick={() => { item.action(); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--text-primary)', background: 'transparent' }}>
                  {item.label}
                </button>
              ))}
              <hr style={{ borderColor: 'var(--border)' }} className="my-1" />
              <button onClick={() => { onReset(); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
                Reset
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
