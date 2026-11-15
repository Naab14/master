import { useState } from 'react';
import { useI18n } from '../../../i18n';
import { Button, useToast } from '../../../ui';
import { Field, Input, Select } from '../../../workforce/ui';

const EMPTY = { id: '', url: '', display_name: '', icon_reference: '', display_mode: 'name' };

export default function LinksView({ state, saveLink, onDelete, moveLink, reorderLink }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [dragId, setDragId] = useState(null);
  const [dropId, setDropId] = useState(null);
  const editing = !!form.id;
  const modes = { thumbnail: t('Large tile'), symbol: t('Icon only'), name: t('Text') };

  const submit = e => {
    e.preventDefault();
    if (!form.url.trim() || !form.display_name.trim()) return;
    saveLink({ ...form, url: form.url.trim(), display_name: form.display_name.trim(), icon_reference: form.icon_reference.trim() });
    setForm(EMPTY);
    toast(t('Link saved'));
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h2 className="t-section">{t('Links')}</h2>

      <form onSubmit={submit} className="tl-panel grid grid-cols-2 gap-3 p-4">
        <Field label={t('Web address')}>
          <Input type="url" value={form.url} required placeholder="https://…"
            onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
        </Field>
        <Field label={t('Name')}>
          <Input value={form.display_name} required placeholder={t('e.g. Andon board')}
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
        </Field>
        <Field label={t('Icon (emoji or short text)')}>
          <Input value={form.icon_reference} maxLength={4} placeholder="📋"
            onChange={e => setForm(f => ({ ...f, icon_reference: e.target.value }))} />
        </Field>
        <Field label={t('Shown as')}>
          <Select value={form.display_mode} onChange={e => setForm(f => ({ ...f, display_mode: e.target.value }))}>
            {Object.keys(modes).map(m => <option key={m} value={m}>{modes[m]}</option>)}
          </Select>
        </Field>
        <div className="col-span-2 flex gap-2">
          <Button type="submit" variant="primary">{editing ? t('Save link') : t('Add link')}</Button>
          {editing && <Button onClick={() => setForm(EMPTY)}>{t('Cancel')}</Button>}
        </div>
      </form>

      <h3 className="tl-heading">
        {t('Your links')} <span className="font-normal">{t('(drag a row, or use the arrows, to change the order)')}</span>
      </h3>
      {state.links.length === 0 && (
        <p className="text-sm text-ink-3">{t('No links yet. Add the first one above.')}</p>
      )}
      <div className="flex flex-col gap-2">
        {state.links.map((link, idx) => (
          <div
            key={link.id}
            draggable
            data-dragging={dragId === link.id || undefined}
            data-drop={dropId === link.id || undefined}
            onDragStart={e => { setDragId(link.id); e.dataTransfer.effectAllowed = 'move'; }}
            onDragEnd={() => { setDragId(null); setDropId(null); }}
            onDragOver={e => { if (dragId && dragId !== link.id) { e.preventDefault(); setDropId(link.id); } }}
            onDragLeave={() => setDropId(d => (d === link.id ? null : d))}
            onDrop={e => {
              e.preventDefault();
              setDropId(null);
              if (dragId && dragId !== link.id) reorderLink(dragId, link.id);
            }}
            className="tl-panel tl-lift tl-drop flex items-center gap-3 px-3 py-2 text-sm"
          >
            <span className="cursor-grab select-none text-ink-3" title={t('Drag to change the order')} aria-hidden="true">⋮⋮</span>
            <span className="w-8 text-center text-lg" aria-hidden="true">{link.icon_reference || link.display_name.charAt(0).toUpperCase()}</span>
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="ui-focus w-32 truncate font-semibold underline-offset-2 hover:underline">{link.display_name}</a>
            <span className="tl-hide-sm min-w-0 flex-1 truncate text-xs text-ink-3">{link.url}</span>
            <span className="hidden shrink-0 text-xs text-ink-3 sm:inline">
              {modes[link.display_mode] || link.display_mode}
            </span>
            <span className="ml-auto flex shrink-0 gap-1">
              <button type="button" className="tl-icon" disabled={idx === 0}
                title={t('Move up')} aria-label={t('Move up')} onClick={() => moveLink(link.id, -1)}>▲</button>
              <button type="button" className="tl-icon" disabled={idx === state.links.length - 1}
                title={t('Move down')} aria-label={t('Move down')} onClick={() => moveLink(link.id, 1)}>▼</button>
              <button type="button" className="tl-icon" title={t('Edit')} aria-label={t('Edit')}
                onClick={() => setForm({ ...EMPTY, ...link })}>✎</button>
              <button type="button" className="tl-icon tl-icon--danger" title={t('Delete')} aria-label={t('Delete')}
                onClick={() => { if (form.id === link.id) setForm(EMPTY); onDelete(link); }}>✕</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
