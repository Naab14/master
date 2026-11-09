/* Editable table over one collection. Text saves when you leave the field,
 * choices save at once. Every change goes through the store (Undo works). */
import { useState } from 'react';
import { Button } from '../ui';
import { useI18n } from '../i18n';
import { useWorkforce } from './store';
import { Confirm } from './ui';
import { list, uid } from './logic/model';

function Cell({ col, value, onChange, disabled, row }) {
  const { fmt } = useI18n();
  const [draft, setDraft] = useState(null);
  value = col.get ? col.get(row) : value;
  const shown = draft ?? value ?? '';
  const commit = () => { if (draft !== null && draft !== (value ?? '')) onChange(col.type === 'number' ? (draft === '' ? null : Number(draft)) : draft); setDraft(null); };
  if (col.type === 'select') {
    return (
      <select className="ui-input" style={{ minWidth: col.width || 110 }} value={value ?? ''} disabled={disabled} aria-label={col.label} onChange={e => onChange(e.target.value || null)}>
        {col.empty !== undefined && <option value="">{col.empty}</option>}
        {col.options.map(o => <option key={o.value} value={o.value}>{fmt.name(o.label)}</option>)}
      </select>
    );
  }
  if (col.type === 'check') return <input type="checkbox" checked={!!value} disabled={disabled} aria-label={col.label} onChange={e => onChange(e.target.checked)} />;
  if (col.type === 'multi') {
    const set = new Set(value || []);
    return (
      <span className="flex flex-wrap gap-1">
        {col.options.map(o => (
          <button type="button" key={o.value} className="wf-chip" aria-pressed={set.has(o.value)} disabled={disabled}
            onClick={() => { const next = new Set(set); if (next.has(o.value)) next.delete(o.value); else next.add(o.value); onChange(col.options.map(x => x.value).filter(v => next.has(v))); }}>
            {fmt.name(o.label)}
          </button>
        ))}
      </span>
    );
  }
  return (
    <input className="ui-input" type={col.type || 'text'} style={{ width: col.width || (col.type === 'number' ? 76 : col.type === 'color' ? 48 : 150) }}
      value={shown} disabled={disabled} aria-label={col.label} step={col.step} min={col.min}
      onChange={e => (col.type === 'color' || col.type === 'time' || col.type === 'date' ? onChange(e.target.value) : setDraft(e.target.value))}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
  );
}

export default function EntityTable({ col: collection, columns, filter, make, permission, addLabel, sort, canDelete = () => true, empty }) {
  const { t } = useI18n();
  const { wf, can, commit } = useWorkforce();
  const [removing, setRemoving] = useState(null);
  const editable = can(permission);
  let rows = list(wf[collection]);
  if (filter) rows = rows.filter(filter);
  rows.sort(sort || ((a, b) => (a.order || 0) - (b.order || 0) || String(a.name?.en || a.name || '').localeCompare(String(b.name?.en || b.name || ''))));
  const save = (row, key, value, c) => {
    const next = c.set ? c.set(row, value) : { ...row, [key]: value };
    commit([{ op: 'put', col: collection, id: row.id, value: next }]);
  };
  return (
    <div className="overflow-x-auto">
      {rows.length === 0 && empty && <p className="mb-2 text-sm text-ink-3">{empty}</p>}
      {rows.length > 0 && (
        <table className="wf-table">
          <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}<th /></tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                {columns.map(c => <td key={c.key}><Cell col={c} row={row} value={row[c.key]} disabled={!editable} onChange={v => save(row, c.key, v, c)} /></td>)}
                <td>{editable && canDelete(row) && <Button variant="ghost" icon aria-label={t('Remove')} onClick={() => setRemoving(row)}>✕</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editable && make && <Button className="mt-2" onClick={() => { const v = make(uid()); commit([{ op: 'put', col: collection, id: v.id, value: v }]); }}>+ {addLabel || t('Add')}</Button>}
      {removing && (
        <Confirm danger title={t('Remove?')} body={t('“{name}” is removed. You can undo this.', { name: removing.name?.en || removing.name || removing.label || removing.id })}
          confirmLabel={t('Remove')} onCancel={() => setRemoving(null)}
          onConfirm={() => { commit([{ op: 'del', col: collection, id: removing.id }], t('Removed')); setRemoving(null); }} />
      )}
    </div>
  );
}
