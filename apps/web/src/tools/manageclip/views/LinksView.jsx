import { useState } from 'react';

const MODE_LABELS = { thumbnail: 'Thumbnail', symbol: 'Symbol', name: 'Text Label' };
const EMPTY = { id: '', url: '', display_name: '', icon_reference: '', display_mode: 'name' };

const field = 'rounded-lg px-3 py-2 text-sm';
const fieldStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

export default function LinksView({ state, saveLink, deleteLink, moveLink, reorderLink, flash }) {
  const [form, setForm] = useState(EMPTY);
  const [dragId, setDragId] = useState(null);
  const [dropId, setDropId] = useState(null);
  const editing = !!form.id;

  const submit = e => {
    e.preventDefault();
    if (!form.url.trim() || !form.display_name.trim()) return;
    saveLink({ ...form, url: form.url.trim(), display_name: form.display_name.trim(), icon_reference: form.icon_reference.trim() });
    setForm(EMPTY);
    flash('Link saved');
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h2 className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-heading)' }}>Link Configuration Hub</h2>

      <form onSubmit={submit} className="grid grid-cols-2 gap-3 p-4"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)' }}>
        <label className="flex flex-col gap-1 text-xs font-bold">URL
          <input type="url" className={field} style={fieldStyle} value={form.url} required placeholder="https://…"
            onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold">Display Name
          <input className={field} style={fieldStyle} value={form.display_name} required placeholder="e.g. Andon Board"
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold">Icon (emoji or short text)
          <input className={field} style={fieldStyle} value={form.icon_reference} maxLength={4} placeholder="e.g. 📋"
            onChange={e => setForm(f => ({ ...f, icon_reference: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold">Display Style
          <select className={field} style={fieldStyle} value={form.display_mode}
            onChange={e => setForm(f => ({ ...f, display_mode: e.target.value }))}>
            <option value="thumbnail">Thumbnail</option>
            <option value="symbol">Symbol (Icon)</option>
            <option value="name">Text Label</option>
          </select>
        </label>
        <div className="col-span-2 flex gap-2">
          <button type="submit" className="rounded-lg px-4 py-2 text-xs font-bold text-white" style={{ background: 'var(--accent)' }}>
            {editing ? 'Update Link' : 'Add Link'}
          </button>
          {editing && (
            <button type="button" className="rounded-lg px-3 py-2 text-xs font-bold"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
              onClick={() => setForm(EMPTY)}>
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <h3 className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
        Configured Links <span className="font-normal">(drag rows or use ▲▼ to reorder)</span>
      </h3>
      {state.links.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No links yet — add your first shortcut above.</p>
      )}
      <div className="flex flex-col gap-2">
        {state.links.map((link, idx) => (
          <div
            key={link.id}
            draggable
            onDragStart={e => { setDragId(link.id); e.dataTransfer.effectAllowed = 'move'; }}
            onDragEnd={() => { setDragId(null); setDropId(null); }}
            onDragOver={e => { if (dragId && dragId !== link.id) { e.preventDefault(); setDropId(link.id); } }}
            onDragLeave={() => setDropId(d => (d === link.id ? null : d))}
            onDrop={e => {
              e.preventDefault();
              setDropId(null);
              if (dragId && dragId !== link.id) reorderLink(dragId, link.id);
            }}
            className="flex items-center gap-3 px-3 py-2 text-sm"
            style={{
              background: dropId === link.id ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-panel))' : 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--border-radius)',
              opacity: dragId === link.id ? 0.5 : 1,
            }}
          >
            <span className="cursor-grab select-none opacity-40" title="Drag to reorder">⋮⋮</span>
            <span className="w-8 text-center text-lg">{link.icon_reference || link.display_name.charAt(0).toUpperCase()}</span>
            <span className="w-32 truncate font-bold">{link.display_name}</span>
            <span className="min-w-0 flex-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{link.url}</span>
            <span className="hidden shrink-0 text-xs sm:inline" style={{ color: 'var(--text-secondary)' }}>
              {MODE_LABELS[link.display_mode] || link.display_mode}
            </span>
            <span className="flex shrink-0 gap-1">
              <button className="opacity-40 hover:opacity-100 disabled:opacity-10" disabled={idx === 0}
                title="Move up" onClick={() => moveLink(link.id, -1)}>▲</button>
              <button className="opacity-40 hover:opacity-100 disabled:opacity-10" disabled={idx === state.links.length - 1}
                title="Move down" onClick={() => moveLink(link.id, 1)}>▼</button>
              <button className="opacity-40 hover:opacity-100" title="Edit"
                onClick={() => setForm({ ...EMPTY, ...link })}>✎</button>
              <button className="opacity-40 hover:opacity-100" title="Delete"
                onClick={() => {
                  if (confirm(`Delete link "${link.display_name}"?`)) { deleteLink(link.id); flash('Link deleted'); }
                }}>✕</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
