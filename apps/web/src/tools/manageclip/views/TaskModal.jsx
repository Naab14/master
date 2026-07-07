import { useState } from 'react';
import { todayStr, TASK_CATEGORIES } from '../store';

export default function TaskModal({ task, onSave, onDelete, onClose }) {
  const isNew = !task.id;
  const [form, setForm] = useState({
    title: task.title || '',
    description: task.description || '',
    due_date: task.due_date || todayStr(),
    category: task.category || 'Gemba Walk',
    status: task.status === 'finished' ? 'finished' : 'current',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = e => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({ ...task, ...form, title: form.title.trim(), description: form.description.trim() });
  };

  const field = 'w-full rounded-lg px-3 py-2 text-sm';
  const fieldStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' };
  const label = 'flex flex-col gap-1 text-xs font-bold';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-3 p-5"
        style={{ background: 'var(--bg-panel)', borderRadius: 'var(--border-radius)', boxShadow: 'var(--shadow-xl)', color: 'var(--text-primary)' }}
      >
        <h3 className="text-lg font-extrabold" style={{ fontFamily: 'var(--font-heading)' }}>
          {isNew ? 'New Task' : 'Edit Task'}
        </h3>

        <label className={label}>Title
          <input className={field} style={fieldStyle} value={form.title} autoFocus required
            placeholder="e.g. Gemba walk – Line 2" onChange={e => set('title', e.target.value)} />
        </label>

        <label className={label}>Description
          <textarea className={field} style={fieldStyle} rows={2} value={form.description}
            placeholder="Optional details" onChange={e => set('description', e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Due Date
            <input type="date" className={field} style={fieldStyle} value={form.due_date} required
              onChange={e => set('due_date', e.target.value)} />
          </label>
          <label className={label}>Category
            <select className={field} style={fieldStyle} value={form.category} onChange={e => set('category', e.target.value)}>
              {TASK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <label className={label}>Status
          <select className={field} style={fieldStyle} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="current">In Progress</option>
            <option value="finished">Completed</option>
          </select>
        </label>

        <div className="mt-1 flex items-center gap-2">
          {!isNew && (
            <button type="button" className="rounded-lg px-3 py-2 text-xs font-bold text-white"
              style={{ background: 'var(--coverage-red)' }}
              onClick={() => { if (confirm('Delete this task?')) onDelete(task.id); }}>
              Delete
            </button>
          )}
          <span className="flex-1" />
          <button type="button" className="rounded-lg px-3 py-2 text-xs font-bold"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="rounded-lg px-4 py-2 text-xs font-bold text-white" style={{ background: 'var(--accent)' }}>
            Save Task
          </button>
        </div>
      </form>
    </div>
  );
}
