import { useState } from 'react';
import { todayStr, LOG_CATEGORIES } from '../store';
import { useI18n } from '../../../i18n';
import { Button, Pill } from '../../../ui';
import { Field, Input, Select } from '../../../workforce/ui';

export default function LoggerView({ state, addLog, onDelete }) {
  const { t, fmt } = useI18n();
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
      <h2 className="t-section">{t('Activity log')}</h2>

      <form onSubmit={submit} className="tl-panel grid grid-cols-2 gap-3 p-4">
        <Field label={t('Date')}>
          <Input type="date" value={form.entry_date} required
            onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
        </Field>
        <Field label={t('Category')}>
          <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {LOG_CATEGORIES.map(c => <option key={c} value={c}>{t(c)}</option>)}
          </Select>
        </Field>
        <Field label={t('Entry')} className="col-span-2">
          <textarea className="ui-input tl-textarea" rows={3} value={form.content} required
            placeholder={t('What happened on the shift?')}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
        </Field>
        <div className="col-span-2 flex items-center gap-3">
          <Button type="submit" variant="primary">{t('Add entry')}</Button>
          {feedback && <span className="wf-view !h-auto text-xs font-semibold text-ok-fg" role="status">✓ {t('Entry added')}</span>}
        </div>
      </form>

      <h3 className="tl-heading">{t('Latest entries')}</h3>
      {state.logs.length === 0 && (
        <p className="text-sm text-ink-3">{t('No entries yet. Add the first one above.')}</p>
      )}
      <div className="flex flex-col gap-2">
        {state.logs.slice(0, 30).map(log => (
          <div key={log.id} className="tl-panel tl-row tl-reveal-host flex items-start gap-3 px-3 py-2 text-sm">
            <span className="t-num shrink-0 text-xs text-ink-3">{fmt.date(log.entry_date, 'full')}</span>
            <Pill className="shrink-0">{t(log.category)}</Pill>
            <span className="min-w-0 flex-1">{log.content}</span>
            <button type="button" className="tl-icon tl-icon--danger shrink-0" title={t('Delete entry')} aria-label={t('Delete entry')}
              onClick={() => onDelete(log)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
