import { useState } from 'react';
import { todayStr, TASK_CATEGORIES } from '../store';
import { useI18n } from '../../../i18n';
import { Button } from '../../../ui';
import { Field, Input, Select, Sheet } from '../../../workforce/ui';

/* A task opens in the same side panel as the planning screens (a full-screen
 * sheet on phones). Deleting can be undone from the message that follows. */
export default function TaskModal({ task, onSave, onDelete, onClose }) {
  const { t } = useI18n();
  const isNew = !task.id;
  const [form, setForm] = useState({
    title: task.title || '',
    description: task.description || '',
    due_date: task.due_date || todayStr(),
    category: task.category || 'Gemba Walk',
    status: task.status === 'finished' ? 'finished' : 'current',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = !!form.title.trim() && !!form.due_date;

  const submit = e => {
    e?.preventDefault();
    if (!valid) return;
    onSave({ ...task, ...form, title: form.title.trim(), description: form.description.trim() });
  };

  return (
    <Sheet title={isNew ? t('New task') : t('Change task')} onClose={onClose}
      footer={<>
        {!isNew && <Button variant="danger" className="mr-auto" onClick={() => onDelete(task)}>{t('Delete')}</Button>}
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button variant="primary" disabled={!valid} onClick={submit}>{t('Save')}</Button>
      </>}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label={t('Title')}>
          <Input value={form.title} autoFocus required
            placeholder={t('e.g. Gemba walk, line 2')} onChange={e => set('title', e.target.value)} />
        </Field>

        <Field label={t('Description')}>
          <textarea className="ui-input tl-textarea" rows={2} value={form.description}
            placeholder={t('Optional details')} onChange={e => set('description', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('Due date')}>
            <Input type="date" value={form.due_date} required onChange={e => set('due_date', e.target.value)} />
          </Field>
          <Field label={t('Category')}>
            <Select value={form.category} onChange={e => set('category', e.target.value)}>
              {TASK_CATEGORIES.map(c => <option key={c} value={c}>{t(c)}</option>)}
            </Select>
          </Field>
        </div>

        <Field label={t('Status')}>
          <Select value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="current">{t('In progress')}</option>
            <option value="finished">{t('Completed')}</option>
          </Select>
        </Field>
        {/* Enter in a field saves, like the Save button */}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
