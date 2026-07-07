import { useState } from 'react';
import { todayStr, LOG_CATEGORIES } from '../store';

const field = 'rounded-lg px-3 py-2 text-sm';
const fieldStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

export default function LoggerView({ state, addLog, deleteLog, flash }) {
  const [form, setForm] = useState({ entry_date: todayStr(), category: 'Safety', content: '' });
  const [feedback, setFeedback] = useState(false);

  const submit = e => {
    e.preventDefault();
    if (!form.content.trim()) return;
    addLog({ ...form, content: form.content.trim() });
    setForm(f => ({ ...f, content: '' }));
    setFeedback(true);
    setTimeout(() => setFeedback(false), 2000);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h2 className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-heading)' }}>Activity Logger</h2>

      <form onSubmit={submit} className="grid grid-cols-2 gap-3 p-4"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)' }}>
        <label className="flex flex-col gap-1 text-xs font-bold">Date
          <input type="date" className={field} style={fieldStyle} value={form.entry_date} required
            onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold">Category
          <select className={field} style={fieldStyle} value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {LOG_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs font-bold">Entry
          <textarea className={field} style={fieldStyle} rows={3} value={form.content} required
            placeholder="What happened on shift?"
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
        </label>
        <div className="col-span-2 flex items-center gap-3">
          <button type="submit" className="rounded-lg px-4 py-2 text-xs font-bold text-white" style={{ background: 'var(--accent)' }}>
            Log Entry
          </button>
          {feedback && <span className="text-xs font-bold" style={{ color: 'var(--coverage-green)' }} role="status">✔ Entry logged</span>}
        </div>
      </form>

      <h3 className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Recent Entries</h3>
      {state.logs.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          No entries yet — log your first shift event above.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {state.logs.slice(0, 30).map(log => (
          <div key={log.id} className="flex items-start gap-3 px-3 py-2 text-sm"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)' }}>
            <span className="shrink-0 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{log.entry_date}</span>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--accent-secondary)' }}>
              {log.category}
            </span>
            <span className="min-w-0 flex-1">{log.content}</span>
            <button className="shrink-0 opacity-40 hover:opacity-100" title="Delete entry"
              onClick={() => { deleteLog(log.id); flash('Entry deleted'); }}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
