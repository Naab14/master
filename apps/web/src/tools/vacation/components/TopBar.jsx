import { useState, useEffect, useRef } from 'react';

export default function TopBar({
  shiftMode, onShiftModeChange,
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
      <h1 className="text-base font-bold mr-3 whitespace-nowrap" style={{ fontFamily: 'var(--font-heading)', color: 'var(--topbar-text)' }}>Semester Planner</h1>

      {/* Undo / Redo — history controls */}
      <div className="flex items-center gap-1 mr-1">
        <button onClick={onUndo} disabled={!canUndo}
          title="Undo (Ctrl+Z)" aria-label="Undo"
          className="px-2 py-1 text-base font-bold rounded-lg transition-all duration-200 hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: 'var(--topbar-text)' }}>
          ↶
        </button>
        <button onClick={onRedo} disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)" aria-label="Redo"
          className="px-2 py-1 text-base font-bold rounded-lg transition-all duration-200 hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: 'var(--topbar-text)' }}>
          ↷
        </button>
      </div>

      {/* Shift mode pill toggle — Neo-Kinetic indigo */}
      <div className="flex items-center gap-0.5 p-1 rounded-full border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        {modes.map(m => (
          <button key={m.value} onClick={() => onShiftModeChange(m.value)}
            className="px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200"
            style={shiftMode === m.value
              ? { background: 'var(--accent)', color: '#fff' }
              : { background: 'transparent', color: 'var(--text-primary)', opacity: 0.8 }}>
            {m.label}
          </button>
        ))}
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
            className="px-2 py-1 text-base font-bold rounded-lg transition-all duration-200 hover:bg-[var(--bg-secondary)]"
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
