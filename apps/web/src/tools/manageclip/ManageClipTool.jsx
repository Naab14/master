import { useState } from 'react';
import { useManageclip, todayStr } from './store';
import { useI18n } from '../../i18n';
import { Button, Segmented, useToast } from '../../ui';
import { PageHeader } from '../../workforce/ui';
import CalendarView from './views/CalendarView';
import LoggerView from './views/LoggerView';
import LinksView from './views/LinksView';
import ReviewView from './views/ReviewView';
import TaskModal from './views/TaskModal';
import '../tools.css';

export default function ManageClipTool() {
  const { t } = useI18n();
  const toast = useToast();
  const mc = useManageclip();
  const { state } = mc;
  const [view, setView] = useState('tasks');
  const [sheetTask, setSheetTask] = useState(null); // {..task} | {due_date} | null

  const views = [
    { value: 'tasks', label: t('Tasks') },
    { value: 'log', label: t('Activity log') },
    { value: 'links', label: t('Links') },
    { value: 'review', label: t('Weekly review') },
  ];

  /* Deleting is immediate and can be undone from the message. */
  const remove = (kind, item, message, del) => {
    const index = state[kind].findIndex(x => x.id === item.id);
    del(item.id);
    toast(message, { action: { label: t('Undo'), onClick: () => mc.restore(kind, item, index) } });
  };
  const removeTask = task => remove('tasks', task, t('Task deleted'), mc.deleteTask);
  const removeLog = log => remove('logs', log, t('Entry deleted'), mc.deleteLog);
  const removeLink = link => remove('links', link, t('Link deleted'), mc.deleteLink);

  return (
    <div className="wf-page overflow-hidden">
      <PageHeader title={t('Shift HQ')}>
        <Segmented label={t('View')} options={views} value={view} onChange={setView} />
        <Button variant="primary" onClick={() => setSheetTask({ due_date: todayStr() })}>{t('New task')}</Button>
      </PageHeader>

      {/* Quick links beside the active view */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="tl-side hidden w-52 shrink-0 flex-col gap-2 overflow-y-auto p-3 md:flex">
          <div className="flex items-center justify-between">
            <h2 className="tl-heading">{t('Quick links')}</h2>
            <button type="button" className="tl-icon" title={t('Set up links')} aria-label={t('Set up links')} onClick={() => setView('links')}>⚙</button>
          </div>
          {state.links.length === 0 && (
            <p className="text-xs text-ink-3">{t('No links yet. Add some under Links.')}</p>
          )}
          {state.links.map(link => <ClipLink key={link.id} link={link} />)}
        </aside>

        <main key={view} className="wf-view min-w-0 flex-1 overflow-y-auto p-4">
          {view === 'tasks' && (
            <CalendarView state={state} saveTask={mc.saveTask} onEdit={setSheetTask} />
          )}
          {view === 'log' && (
            <LoggerView state={state} addLog={mc.addLog} onDelete={removeLog} />
          )}
          {view === 'links' && (
            <LinksView
              state={state}
              saveLink={mc.saveLink} onDelete={removeLink}
              moveLink={mc.moveLink} reorderLink={mc.reorderLink}
            />
          )}
          {view === 'review' && (
            <ReviewView state={state} saveSettings={mc.saveSettings} />
          )}
        </main>
      </div>

      {sheetTask && (
        <TaskModal
          task={sheetTask}
          onSave={task => { mc.saveTask(task); setSheetTask(null); toast(t('Task saved')); }}
          onDelete={task => { setSheetTask(null); removeTask(task); }}
          onClose={() => setSheetTask(null)}
        />
      )}
    </div>
  );
}

/* ── Quick links ────────────────────────────────────────────────────────── */
function ClipLink({ link }) {
  const icon = link.icon_reference || link.display_name.charAt(0).toUpperCase();
  const base = 'tl-panel tl-lift ui-focus';

  if (link.display_mode === 'thumbnail') {
    return (
      <a href={link.url} target="_blank" rel="noopener noreferrer"
        className={`${base} flex flex-col items-center gap-1 p-3 text-center text-xs font-semibold`}>
        <span className="text-2xl" aria-hidden="true">{icon}</span>
        <span className="w-full truncate">{link.display_name}</span>
      </a>
    );
  }
  if (link.display_mode === 'symbol') {
    return (
      <a href={link.url} target="_blank" rel="noopener noreferrer" title={link.display_name} aria-label={link.display_name}
        className={`${base} flex items-center justify-center p-2 text-xl`}>
        {icon}
      </a>
    );
  }
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer"
      className={`${base} flex items-center gap-2 px-3 py-2 text-sm font-semibold`}>
      <span className="text-ink-3" aria-hidden="true">›</span>
      <span className="truncate">{link.display_name}</span>
    </a>
  );
}
