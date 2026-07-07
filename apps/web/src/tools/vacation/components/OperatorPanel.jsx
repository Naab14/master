import { useState } from 'react';
import { PROCESSES } from '../data';

export default function OperatorPanel({ operators, onUpdateOperator, showMgmt, onToggleMgmt, onAddOperator, onRemoveOperator, onDownloadTemplate, collapsed, onToggleCollapse }) {
  const [editId, setEditId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newShift, setNewShift] = useState('S1');
  const [search, setSearch] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddOperator(newName.trim(), newShift);
    setNewName('');
  };

  const q = search.trim().toLowerCase();
  const filteredOperators = q
    ? operators.filter(op => op.name.toLowerCase().includes(q))
    : operators;

  return (
    <div className={`w-[240px] min-w-[240px] overflow-y-auto h-full flex flex-col shadow-[4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20 relative transition-all duration-200 ${collapsed ? 'sidebar-collapsed' : ''}`}
      style={{ background: 'var(--bg-panel)', borderRight: '1px solid var(--border)' }}>

      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between px-3 py-3" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onToggleCollapse}
          className="flex items-center justify-center w-7 h-7 rounded-md text-sm font-bold transition-all duration-200 hover:scale-110"
          style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 0 8px rgba(79,70,229,0.3)' }}>
          {collapsed ? '▶' : '◀'}
        </button>
        <span className="sidebar-full-only font-bold text-sm tracking-widest uppercase italic" style={{ color: 'var(--accent)' }}>Operators</span>
        <div className="sidebar-full-only flex gap-2">
          <button onClick={onDownloadTemplate} className="px-2 py-1 text-xs font-semibold rounded shadow-sm hover:scale-105 active:scale-95 transition-all"
            style={{ color: 'var(--accent)', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>CSV</button>
          {!showMgmt && (
            <button onClick={onToggleMgmt} className="px-2 py-1 text-xs font-semibold rounded shadow-sm hover:scale-105 active:scale-95 transition-all"
              style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 0 8px rgba(79,70,229,0.3)' }}>+ Add</button>
          )}
        </div>
      </div>

      {/* Add/Remove Operator Panel */}
      {showMgmt && (
        <div className="sidebar-full-only p-4 mb-2 shadow-inner" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Add Operator</div>
          <input type="text" placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="w-full px-3 py-2 text-sm mb-2 shadow-sm transition-shadow outline-none"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)', color: 'var(--text-primary)' }}
            onFocus={e => { e.target.style.boxShadow = '0 0 0 2px var(--accent)'; }}
            onBlur={e => { e.target.style.boxShadow = 'none'; }} />
          <div className="flex gap-2 mb-2">
            <select value={newShift} onChange={e => setNewShift(e.target.value)}
              className="flex-1 px-3 py-2 text-sm shadow-sm outline-none"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)', color: 'var(--text-primary)' }}
              onFocus={e => { e.target.style.boxShadow = '0 0 0 2px var(--accent)'; }}
              onBlur={e => { e.target.style.boxShadow = 'none'; }}>
              <option value="S1">S1</option><option value="S2">S2</option>
            </select>
            <button onClick={handleAdd} className="px-4 py-2 text-sm font-semibold rounded shadow-sm transition-all hover:scale-105"
              style={{ background: 'var(--accent)', color: '#fff' }}>Add</button>
          </div>
          <button onClick={onDownloadTemplate} className="w-full px-3 py-2 text-xs mt-2 font-medium hover:opacity-80 transition-opacity"
            style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border)', borderRadius: 'var(--border-radius)', color: 'var(--text-secondary)' }}>
            ↓ Download CSV Template
          </button>
          <button onClick={onToggleMgmt} className="w-full px-3 py-2 text-xs mt-2 font-semibold rounded transition-all hover:opacity-80"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)', color: 'var(--text-secondary)' }}>
            Done
          </button>
        </div>
      )}

      {/* Search */}
      <div className="sidebar-full-only px-3 pt-2 pb-1">
        <div className="relative">
          <input type="text" placeholder="Search operators" value={search}
            aria-label="Search operators"
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-3 pr-8 py-1.5 text-sm shadow-sm outline-none"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)', color: 'var(--text-primary)' }}
            onFocus={e => { e.target.style.boxShadow = '0 0 0 2px var(--accent)'; }}
            onBlur={e => { e.target.style.boxShadow = 'none'; }} />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-xs rounded hover:bg-black/5"
              style={{ color: 'var(--text-secondary)' }}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Operator List */}
      <div className="sidebar-full-only flex-1 overflow-y-auto p-2 space-y-1">
        {filteredOperators.length === 0 && (
          <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
            No matches
          </div>
        )}
        {filteredOperators.map(op => (
          <div key={op.id} className="rounded-lg transition-colors" style={{ background: editId === op.id ? 'var(--bg-secondary)' : 'transparent' }}>
            <div className="px-3 py-2.5 flex items-center gap-3 cursor-pointer rounded-md text-sm transition-all duration-200"
              style={{ opacity: op.active ? 1 : 0.4, color: 'var(--text-primary)' }}
              onClick={() => setEditId(editId === op.id ? null : op.id)}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.background = 'rgba(79,70,229,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'transparent'; }}>
              <span className="flex-1 truncate font-medium">{op.name}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold"
                style={op.shift === 'S1'
                  ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 0 10px rgba(79,70,229,0.4)' }
                  : { background: 'var(--accent-secondary)', color: '#fff', boxShadow: '0 0 10px rgba(59,130,246,0.4)' }}>
                {op.shift}
              </span>
            </div>

            {editId === op.id && (
              <div className="px-3 pb-4 pt-1 space-y-3">
                <div>
                  <label className="text-xs block mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>Name</label>
                  <input type="text" value={op.name} onChange={e => onUpdateOperator(op.id, { name: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm shadow-sm outline-none"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)', color: 'var(--text-primary)' }}
                    onFocus={e => { e.target.style.boxShadow = '0 0 0 2px var(--accent)'; }}
                    onBlur={e => { e.target.style.boxShadow = 'none'; }} />
                </div>
                <div>
                  <label className="text-xs block mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>Shift</label>
                  <select value={op.shift} onChange={e => onUpdateOperator(op.id, { shift: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm shadow-sm outline-none"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)', color: 'var(--text-primary)' }}
                    onFocus={e => { e.target.style.boxShadow = '0 0 0 2px var(--accent)'; }}
                    onBlur={e => { e.target.style.boxShadow = 'none'; }}>
                    <option value="S1">S1</option><option value="S2">S2</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" checked={op.active} onChange={e => onUpdateOperator(op.id, { active: e.target.checked })} id={`active-${op.id}`}
                    className="w-4 h-4 rounded" style={{ accentColor: 'var(--accent)' }} />
                  <label htmlFor={`active-${op.id}`} className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Active</label>
                </div>
                <div className="pt-1">
                  <label className="text-xs block mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Certifications</label>
                  <div className="space-y-1.5">
                    {PROCESSES.map(p => (
                      <label key={p} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                        <input type="checkbox" checked={op.certifications.includes(p)}
                          className="w-3.5 h-3.5 rounded" style={{ accentColor: 'var(--accent)' }}
                          onChange={e => {
                            const certs = e.target.checked ? [...op.certifications, p] : op.certifications.filter(c => c !== p);
                            onUpdateOperator(op.id, { certifications: certs });
                          }} />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>
                {showMgmt && (
                  <button onClick={() => { if (confirm(`Remove ${op.name}?`)) { onRemoveOperator(op.id); setEditId(null); } }}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-md transition-colors mt-2"
                    style={{ color: 'var(--accent-alert)', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    Remove Operator
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
