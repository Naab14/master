import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../../api';
import { PopoverCtx } from './popover-context';
import TableView from './TableView';
import KanbanView from './KanbanView';

function PopoverHost({ popover, onClose }) {
  const ref = useRef(null);

  // Position after first paint (once the popover's size is known) by writing
  // straight to the DOM — no state round-trip needed.
  useEffect(() => {
    const el = ref.current;
    if (!el || !popover) return;
    const { anchorRect } = popover;
    let left = anchorRect.left;
    if (left + el.offsetWidth > window.innerWidth - 12) left = window.innerWidth - el.offsetWidth - 12;
    let top = anchorRect.bottom + 6;
    if (top + el.offsetHeight > window.innerHeight - 12) top = anchorRect.top - el.offsetHeight - 6;
    el.style.left = `${Math.max(8, left)}px`;
    el.style.top = `${Math.max(8, top)}px`;
    el.style.visibility = 'visible';
  }, [popover]);

  useEffect(() => {
    if (!popover) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [popover, onClose]);

  if (!popover) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div
        ref={ref}
        className="fixed z-50 flex min-w-[180px] flex-col gap-1 p-2"
        style={{
          left: 0,
          top: 0,
          visibility: 'hidden',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--border-radius)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {popover.content}
      </div>
    </>
  );
}

/* ── Boards tool ────────────────────────────────────────────────────────── */
export default function BoardsTool() {
  const [data, setData] = useState(null); // { boards, members }
  const [error, setError] = useState(null);
  const [boardId, setBoardId] = useState(null);
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [popover, setPopover] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getFullState()
      .then(s => {
        if (cancelled) return;
        setData({ boards: s.boards || [], members: s.members || [] });
        setBoardId(s.boards?.[0]?.id || null);
      })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const openPopover = useCallback((e, content) => {
    setPopover({ anchorRect: e.currentTarget.getBoundingClientRect(), content });
  }, []);
  const closePopover = useCallback(() => setPopover(null), []);

  /* Immutable local updates mirroring the optimistic mutations the original
   * frontend applied before each API call. */
  const updateBoard = useCallback((bid, fn) => {
    setData(d => ({ ...d, boards: d.boards.map(b => (b.id === bid ? fn(b) : b)) }));
  }, []);

  const board = data?.boards.find(b => b.id === boardId) || null;

  const addBoard = async name => {
    const created = await api.createBoard(name);
    setData(d => ({ ...d, boards: [...d.boards, created] }));
    setBoardId(created.id);
    setSearch('');
    closePopover();
  };

  const removeBoard = async () => {
    if (!confirm(`Delete board "${board.name}" and all its items?`)) return;
    await api.deleteBoard(board.id);
    setData(d => {
      const boards = d.boards.filter(b => b.id !== board.id);
      setBoardId(boards[0]?.id || null);
      return { ...d, boards };
    });
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Can't reach the backend ({error}). Boards need the server — start it with <code className="mx-1 font-mono">node backend/server.js</code>.
      </div>
    );
  }
  if (!data) {
    return <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>Loading boards…</div>;
  }

  return (
    <PopoverCtx.Provider value={{ openPopover, closePopover, members: data.members, setData }}>
      <div className="flex h-full overflow-hidden">
        {/* ── Board list ─────────────────────────────────────────────────── */}
        <aside className="hidden w-52 shrink-0 flex-col overflow-y-auto p-3 sm:flex"
          style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Boards</h2>
            <button
              className="rounded px-1.5 text-sm font-bold"
              style={{ color: 'var(--accent)' }}
              title="New board"
              onClick={e => openPopover(e, <NewBoardForm onCreate={addBoard} />)}
            >
              +
            </button>
          </div>
          {data.boards.map(b => (
            <button
              key={b.id}
              onClick={() => { setBoardId(b.id); setSearch(''); }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold"
              style={b.id === boardId ? { background: 'var(--bg-panel)', boxShadow: 'inset 2px 0 0 var(--accent)' } : { opacity: 0.75 }}
            >
              <span aria-hidden>▦</span>
              <span className="truncate">{b.name}</span>
            </button>
          ))}
        </aside>

        {/* ── Board view ────────────────────────────────────────────────── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!board ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <p>No boards yet.</p>
              <button
                className="rounded-full px-4 py-2 text-xs font-bold text-white"
                style={{ background: 'var(--accent)' }}
                onClick={e => openPopover(e, <NewBoardForm onCreate={addBoard} />)}
              >
                + Create your first board
              </button>
            </div>
          ) : (
            <>
              <header className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                {/* Phones: the board list sidebar is hidden, so pick boards here */}
                <div className="flex w-full items-center gap-2 sm:hidden">
                  <select
                    value={board.id}
                    onChange={e => { setBoardId(e.target.value); setSearch(''); }}
                    className="min-w-0 flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    aria-label="Board"
                  >
                    {data.boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <button
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                    style={{ background: 'var(--accent)' }}
                    onClick={e => openPopover(e, <NewBoardForm onCreate={addBoard} />)}
                  >
                    + New
                  </button>
                </div>
                <div className="min-w-0">
                  <input
                    key={board.id + ':name'}
                    defaultValue={board.name}
                    className="w-full bg-transparent text-lg font-extrabold outline-none"
                    style={{ fontFamily: 'var(--font-heading)' }}
                    onBlur={e => {
                      const v = e.target.value.trim();
                      if (v && v !== board.name) {
                        updateBoard(board.id, b => ({ ...b, name: v }));
                        api.patchBoard(board.id, { name: v }).catch(() => {});
                      } else e.target.value = board.name;
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  />
                  <input
                    key={board.id + ':desc'}
                    defaultValue={board.description || ''}
                    placeholder="Add a description…"
                    className="w-full bg-transparent text-xs outline-none"
                    style={{ color: 'var(--text-secondary)' }}
                    onBlur={e => {
                      const v = e.target.value.trim();
                      if (v !== (board.description || '')) {
                        updateBoard(board.id, b => ({ ...b, description: v }));
                        api.patchBoard(board.id, { description: v }).catch(() => {});
                      }
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  />
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <div className="flex overflow-hidden rounded-lg" style={{ border: '1px solid var(--border)' }}>
                    {['table', 'kanban'].map(v => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`px-3 py-1 text-xs font-bold capitalize ${view === v ? 'text-white' : ''}`}
                        style={view === v ? { background: 'var(--accent)' } : { background: 'var(--bg-panel)' }}
                      >
                        {v === 'table' ? 'Main Table' : 'Kanban'}
                      </button>
                    ))}
                  </div>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search items…"
                    className="w-36 rounded-lg px-3 py-1.5 text-xs"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                  <button
                    className="rounded-lg px-3 py-1.5 text-xs font-bold"
                    style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}
                    onClick={async () => {
                      const group = await api.createGroup(board.id, 'New group');
                      updateBoard(board.id, b => ({ ...b, groups: [...b.groups, group] }));
                    }}
                  >
                    + Group
                  </button>
                  <button
                    className="rounded-lg px-2 py-1.5 text-xs opacity-60 hover:opacity-100"
                    title="Delete board"
                    onClick={removeBoard}
                  >
                    🗑
                  </button>
                </div>
              </header>

              <div className="flex-1 overflow-auto p-4">
                {view === 'table'
                  ? <TableView board={board} search={search} updateBoard={updateBoard} />
                  : <KanbanView board={board} search={search} updateBoard={updateBoard} />}
              </div>
            </>
          )}
        </main>
      </div>
      <PopoverHost popover={popover} onClose={closePopover} />
    </PopoverCtx.Provider>
  );
}

function NewBoardForm({ onCreate }) {
  const [name, setName] = useState('');
  return (
    <>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onCreate(name.trim()); }}
        placeholder="Board name"
        className="rounded-lg px-3 py-2 text-sm"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      />
      <span className="px-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>Press Enter to create</span>
    </>
  );
}
