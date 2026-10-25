import { useState } from 'react';
import { useManageclip, todayStr } from './store';
import CalendarView from './views/CalendarView';
import LoggerView from './views/LoggerView';
import LinksView from './views/LinksView';
import ReviewView from './views/ReviewView';
import TaskModal from './views/TaskModal';

const VIEWS = [
  { id: 'center', label: 'Command Center' },
  { id: 'logger', label: 'Activity Logger' },
  { id: 'links', label: 'Link Hub' },
  { id: 'review', label: 'Weekly Review' },
];

export default function ManageClipTool() {
  const mc = useManageclip();
  const { state } = mc;
  const [view, setView] = useState('center');
  const [modalTask, setModalTask] = useState(null); // {..task} | {due_date} | null
  const [toast, setToast] = useState(null);

  const flash = msg => {
    setToast(msg);
    clearTimeout(flash._t);
    flash._t = setTimeout(() => setToast(null), 2200);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Tool header ──────────────────────────────────────────────────── */}
      <header
        className="flex flex-wrap items-center gap-2 px-4 py-2"
        style={{ background: 'var(--topbar-bg)', color: 'var(--topbar-text)' }}
      >
        <h1 className="mr-4 text-base font-black tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          SHIFT<span style={{ color: 'var(--accent)' }}>_</span>HQ
        </h1>
        <nav className="flex flex-wrap gap-1">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-opacity ${view === v.id ? 'text-white' : 'opacity-70 hover:opacity-100'}`}
              style={view === v.id ? { background: 'var(--accent)' } : undefined}
            >
              {v.label}
            </button>
          ))}
        </nav>
        <button
          onClick={() => setModalTask({ due_date: todayStr() })}
          className="ml-auto rounded-full px-3 py-1 text-xs font-bold text-white"
          style={{ background: 'var(--accent)' }}
        >
          + New Task
        </button>
      </header>

      {/* ── Body: quick-action clipboard + active view ───────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <aside
          className="hidden w-52 shrink-0 flex-col gap-2 overflow-y-auto p-3 md:flex"
          style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Quick Actions
            </h2>
            <button
              onClick={() => setView('links')}
              className="text-xs opacity-60 hover:opacity-100"
              title="Configure links"
            >
              ⚙
            </button>
          </div>
          {state.links.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              No links configured yet. Add some in the Link Hub.
            </p>
          )}
          {state.links.map(link => <ClipLink key={link.id} link={link} />)}
        </aside>

        <main className="flex-1 overflow-y-auto p-4">
          {view === 'center' && (
            <CalendarView state={state} saveTask={mc.saveTask} onEdit={setModalTask} flash={flash} />
          )}
          {view === 'logger' && (
            <LoggerView state={state} addLog={mc.addLog} deleteLog={mc.deleteLog} flash={flash} />
          )}
          {view === 'links' && (
            <LinksView
              state={state}
              saveLink={mc.saveLink} deleteLink={mc.deleteLink}
              moveLink={mc.moveLink} reorderLink={mc.reorderLink}
              flash={flash}
            />
          )}
          {view === 'review' && (
            <ReviewView state={state} saveSettings={mc.saveSettings} flash={flash} />
          )}
        </main>
      </div>

      {modalTask && (
        <TaskModal
          task={modalTask}
          onSave={t => { mc.saveTask(t); setModalTask(null); flash('Task saved'); }}
          onDelete={id => { mc.deleteTask(id); setModalTask(null); flash('Task deleted'); }}
          onClose={() => setModalTask(null)}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-5 right-5 z-50 rounded-full px-5 py-3 text-sm font-bold text-white"
          style={{ background: 'var(--accent)', boxShadow: 'var(--shadow-xl)' }}
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Quick Action Clipboard entries ─────────────────────────────────────── */
function ClipLink({ link }) {
  const icon = link.icon_reference || link.display_name.charAt(0).toUpperCase();
  const base = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)' };

  if (link.display_mode === 'thumbnail') {
    return (
      <a href={link.url} target="_blank" rel="noopener noreferrer"
        className="flex flex-col items-center gap-1 p-3 text-center text-xs font-bold hover:opacity-80" style={base}>
        <span className="text-2xl">{icon}</span>
        <span className="truncate w-full">{link.display_name}</span>
      </a>
    );
  }
  if (link.display_mode === 'symbol') {
    return (
      <a href={link.url} target="_blank" rel="noopener noreferrer" title={link.display_name}
        className="flex items-center justify-center p-2 text-xl hover:opacity-80" style={base}>
        {icon}
      </a>
    );
  }
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 text-sm font-semibold hover:opacity-80" style={base}>
      <span style={{ color: 'var(--accent)' }}>›</span>
      <span className="truncate">{link.display_name}</span>
    </a>
  );
}
