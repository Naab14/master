import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../../api';
import { useI18n } from '../../i18n';
import { Button, Segmented, useToast } from '../../ui';
import { Confirm, Empty, Input, PageHeader } from '../../workforce/ui';
import { PopoverCtx } from './popover-context';
import TableView from './TableView';
import KanbanView from './KanbanView';
import '../tools.css';

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
        role="dialog"
        className="tl-pop fixed z-50 flex max-h-[70vh] min-w-[180px] flex-col gap-1 overflow-y-auto p-2"
        style={{ left: 0, top: 0, visibility: 'hidden' }}
      >
        {popover.content}
      </div>
    </>
  );
}

/* ── Boards tool ────────────────────────────────────────────────────────── */
export default function BoardsTool() {
  const { t } = useI18n();
  const toast = useToast();
  const [data, setData] = useState(null); // { boards, members }
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [boardId, setBoardId] = useState(null);
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [popover, setPopover] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getFullState()
      .then(s => {
        if (cancelled) return;
        setError(null);
        setData({ boards: s.boards || [], members: s.members || [] });
        setBoardId(id => id || s.boards?.[0]?.id || null);
      })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [attempt]);

  const openPopover = useCallback((e, content) => {
    setPopover({ anchorRect: e.currentTarget.getBoundingClientRect(), content });
  }, []);
  const closePopover = useCallback(() => setPopover(null), []);

  /* A change the server refused is said out loud instead of failing silently. */
  const failed = useCallback(e => { toast(t('That could not be saved: {why}', { why: e.message })); }, [toast, t]);

  /* Immutable local updates mirroring the optimistic mutations the original
   * frontend applied before each API call. */
  const updateBoard = useCallback((bid, fn) => {
    setData(d => ({ ...d, boards: d.boards.map(b => (b.id === bid ? fn(b) : b)) }));
  }, []);

  const board = data?.boards.find(b => b.id === boardId) || null;

  const addBoard = async name => {
    closePopover();
    try {
      const created = await api.createBoard(name);
      setData(d => ({ ...d, boards: [...d.boards, created] }));
      setBoardId(created.id);
      setSearch('');
    } catch (e) { failed(e); }
  };

  const removeBoard = async () => {
    setConfirmDelete(false);
    try {
      await api.deleteBoard(board.id);
      const boards = data.boards.filter(b => b.id !== board.id);
      setData(d => ({ ...d, boards: d.boards.filter(b => b.id !== board.id) }));
      setBoardId(boards[0]?.id || null);
      toast(t('Board deleted'));
    } catch (e) { failed(e); }
  };

  const addGroup = async () => {
    try {
      const group = await api.createGroup(board.id, t('New group'));
      updateBoard(board.id, b => ({ ...b, groups: [...b.groups, group] }));
    } catch (e) { failed(e); }
  };

  const newBoard = e => openPopover(e, <NewBoardForm onCreate={addBoard} />);

  if (error && !data) {
    return (
      <div className="wf-page">
        <PageHeader title={t('Boards')} />
        <Empty title={t('Boards can’t be loaded right now')} action={<Button onClick={() => { setError(null); setAttempt(n => n + 1); }}>{t('Try again')}</Button>}>
          {error}
        </Empty>
      </div>
    );
  }
  if (!data) {
    return <div className="wf-page items-center justify-center text-sm text-ink-3">{t('Loading…')}</div>;
  }

  return (
    <PopoverCtx.Provider value={{ openPopover, closePopover, members: data.members, setData, failed }}>
      <div className="wf-page overflow-hidden">
        <PageHeader title={t('Boards')}>
          {board && (
            <>
              <Segmented label={t('View')} value={view} onChange={setView}
                options={[{ value: 'table', label: t('Table') }, { value: 'kanban', label: t('Kanban') }]} />
              <Input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('Search items…')}
                aria-label={t('Search items…')}
                className="w-40"
              />
              <Button onClick={addGroup}>{t('Add group')}</Button>
            </>
          )}
          <span className="sm:hidden"><Button variant="primary" onClick={newBoard}>{t('New board')}</Button></span>
        </PageHeader>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* ── Board list ───────────────────────────────────────────────── */}
          <aside className="tl-side hidden w-52 shrink-0 flex-col gap-1 overflow-y-auto p-3 sm:flex">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="tl-heading">{t('Boards')}</h2>
              <button type="button" className="tl-icon" title={t('New board')} aria-label={t('New board')} onClick={newBoard}>+</button>
            </div>
            {data.boards.map(b => (
              <button
                key={b.id}
                type="button"
                className="tl-nav-item"
                aria-current={b.id === boardId || undefined}
                onClick={() => { setBoardId(b.id); setSearch(''); }}
              >
                <span aria-hidden="true">▦</span>
                <span className="truncate">{b.name}</span>
              </button>
            ))}
          </aside>

          {/* ── Board view ───────────────────────────────────────────────── */}
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {!board ? (
              <Empty title={t('No boards yet')} action={<Button variant="primary" onClick={newBoard}>{t('Create your first board')}</Button>}>
                {t('A board is a list of work items in groups, with the columns you choose.')}
              </Empty>
            ) : (
              <>
                <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
                  {/* Phones: the board list is hidden, so pick boards here */}
                  <select
                    value={board.id}
                    onChange={e => { setBoardId(e.target.value); setSearch(''); }}
                    className="ui-input min-w-0 flex-1 sm:hidden"
                    aria-label={t('Board')}
                  >
                    {data.boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <div className="min-w-0 flex-1 basis-full sm:basis-0">
                    <input
                      key={board.id + ':name'}
                      defaultValue={board.name}
                      aria-label={t('Board name')}
                      className="tl-inline t-section w-full px-1"
                      onBlur={e => {
                        const v = e.target.value.trim();
                        if (v && v !== board.name) {
                          updateBoard(board.id, b => ({ ...b, name: v }));
                          api.patchBoard(board.id, { name: v }).catch(failed);
                        } else e.target.value = board.name;
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    />
                    <input
                      key={board.id + ':desc'}
                      defaultValue={board.description || ''}
                      placeholder={t('Add a description…')}
                      aria-label={t('Description')}
                      className="tl-inline w-full px-1 text-xs text-ink-3"
                      onBlur={e => {
                        const v = e.target.value.trim();
                        if (v !== (board.description || '')) {
                          updateBoard(board.id, b => ({ ...b, description: v }));
                          api.patchBoard(board.id, { description: v }).catch(failed);
                        }
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    />
                  </div>
                  <button type="button" className="tl-icon tl-icon--danger" title={t('Delete board')} aria-label={t('Delete board')}
                    onClick={() => setConfirmDelete(true)}>
                    🗑
                  </button>
                </header>

                <div key={`${board.id}:${view}`} className="wf-view min-h-0 flex-1 overflow-auto p-4">
                  {view === 'table'
                    ? <TableView board={board} search={search} updateBoard={updateBoard} />
                    : <KanbanView board={board} search={search} updateBoard={updateBoard} />}
                </div>
              </>
            )}
          </main>
        </div>
        <PopoverHost popover={popover} onClose={closePopover} />
      </div>
      {confirmDelete && board && (
        <Confirm danger title={t('Delete board?')} confirmLabel={t('Delete')}
          body={t('“{name}” and all its items are deleted. This cannot be undone.', { name: board.name })}
          onConfirm={removeBoard} onCancel={() => setConfirmDelete(false)} />
      )}
    </PopoverCtx.Provider>
  );
}

function NewBoardForm({ onCreate }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  return (
    <>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onCreate(name.trim()); }}
        placeholder={t('Board name')}
        aria-label={t('Board name')}
        className="ui-input"
      />
      <Button variant="primary" disabled={!name.trim()} onClick={() => onCreate(name.trim())}>{t('Create board')}</Button>
    </>
  );
}
