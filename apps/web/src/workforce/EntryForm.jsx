/* Add or edit one attendance entry. Partial-day entries need hours or
 * start/end times; a comment alone is saved but flagged as incomplete. */
import { useState } from 'react';
import { Button, Checkbox } from '../ui';
import { useI18n } from '../i18n';
import { useReasons } from './derive';
import { Field, Input, Select } from './ui';
import { uid } from './logic/model';

const FULL_DAY = ['sick', 'vacation', 'absence'];

export default function EntryForm({ personId, date, entry, onSave, onCancel, allowRange = false }) {
  const { t, fmt } = useI18n();
  const reasons = useReasons();
  const [f, setF] = useState(() => entry || { reasonId: 'sick', fullDay: true, hours: '', start: '', end: '', comment: '', tentative: false, to: date });
  const reason = reasons.find(r => r.id === f.reasonId) || reasons[0];
  const canFull = FULL_DAY.includes(reason.category);
  const full = canFull && f.fullDay;
  const needsTime = reason.category !== 'present' && !full;
  const hasTime = (f.start && f.end) || Number(f.hours) > 0;
  const set = patch => setF(prev => ({ ...prev, ...patch }));

  const save = () => {
    const base = {
      personId, reasonId: reason.id, fullDay: full,
      hours: !full && !(f.start && f.end) && Number(f.hours) > 0 ? Number(f.hours) : null,
      start: !full && f.start && f.end ? f.start : null, end: !full && f.start && f.end ? f.end : null,
      comment: (f.comment || '').trim(), tentative: !!f.tentative,
    };
    onSave(base, entry ? null : (allowRange && full && f.to > date ? f.to : date), entry?.id || uid('en_'));
  };

  return (
    <div className="flex flex-col gap-3">
      <Field label={t('Status')}>
        <Select value={reason.id} onChange={e => set({ reasonId: e.target.value })}>
          {reasons.map(r => <option key={r.id} value={r.id}>{fmt.name(r.name)}</option>)}
        </Select>
      </Field>
      {canFull && <Checkbox checked={!!f.fullDay} onChange={e => set({ fullDay: e.target.checked })}>{t('Whole shift')}</Checkbox>}
      {allowRange && full && !entry && (
        <Field label={t('Until (last day)')}><Input type="date" value={f.to} min={date} onChange={e => set({ to: e.target.value || date })} /></Field>
      )}
      {needsTime && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t('Hours')}><Input type="number" min="0" step="0.25" className="w-24" value={f.hours ?? ''} onChange={e => set({ hours: e.target.value })} /></Field>
          <span className="pb-2 text-xs text-ink-3">{t('or')}</span>
          <Field label={t('From')}><Input type="time" value={f.start || ''} onChange={e => set({ start: e.target.value })} /></Field>
          <Field label={t('To')}><Input type="time" value={f.end || ''} onChange={e => set({ end: e.target.value })} /></Field>
        </div>
      )}
      {needsTime && !hasTime && (
        <p className="rounded-control bg-warn-bg px-3 py-2 text-xs font-semibold text-warn-fg" role="status">
          {t('No hours or times yet. It will be saved and flagged as incomplete; nothing is assumed.')}
        </p>
      )}
      {canFull && <Checkbox checked={!!f.tentative} onChange={e => set({ tentative: e.target.checked })}>{t('Requested, not decided (does not reduce coverage)')}</Checkbox>}
      <Field label={t('Comment')}><Input value={f.comment || ''} onChange={e => set({ comment: e.target.value })} /></Field>
      <div className="flex justify-end gap-2">
        {onCancel && <Button onClick={onCancel}>{t('Cancel')}</Button>}
        <Button variant="primary" onClick={save}>{t('Save')}</Button>
      </div>
    </div>
  );
}
