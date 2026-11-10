/* OB rules: entered by hand, or prepared from a spreadsheet (CSV) and
 * reviewed before saving. The app ships with no rules and no rates. */
import { useState } from 'react';
import { Button } from '../ui';
import { useI18n } from '../i18n';
import { useWorkforce } from './store-context';
import EntityTable from './EntityTable';
import { list, uid } from './logic/model';
import { parseObRows } from './logic/attendance';
import { parseCsv } from './logic/csv';
import { addDays } from './logic/time';

export default function ObRules() {
  const { t, fmt } = useI18n();
  const { wf, can, commit } = useWorkforce();
  const [preview, setPreview] = useState(null);
  const wd = [1, 2, 3, 4, 5, 6, 7].map(d => ({ value: d, label: fmt.date(addDays('2026-11-01', d), 'weekday') }));
  const onFile = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setPreview(parseObRows(parseCsv(await file.text()).rows));
  };
  return (
    <div>
      <p className="mb-2 text-xs text-ink-3">
        {t('OB (unsocial-hours pay) is counted from these rules, on scheduled shifts and on overtime with known times. Enter your workplace’s own rules: none are built in. Where rules overlap, the highest priority takes the time.')}
      </p>
      <EntityTable col="obRules" permission="settings.edit" addLabel={t('Add OB rule')} sort={(a, b) => (b.priority || 0) - (a.priority || 0)}
        empty={t('No OB rules yet, so reports show no OB.')}
        make={id => ({ id, name: t('New rule'), days: [1, 2, 3, 4, 5], holidays: false, start: '18:00', end: '22:00', rate: '', priority: list(wf.obRules).length + 1, active: true })}
        columns={[
          { key: 'name', label: t('Name') }, { key: 'days', label: t('Days'), type: 'multi', options: wd },
          { key: 'holidays', label: t('Public holidays'), type: 'check' },
          { key: 'start', label: t('From'), type: 'time', width: 110 }, { key: 'end', label: t('To'), type: 'time', width: 110 },
          { key: 'rate', label: t('Rate (your note)'), width: 110 }, { key: 'priority', label: t('Priority'), type: 'number' },
        ]} />
      {can('settings.edit') && (
        <div className="mt-3">
          <label className="ui-btn cursor-pointer">
            {t('Prepare rules from a CSV file…')}
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
          </label>
          <p className="mt-1 text-xs text-ink-3">{t('Columns: name, days (e.g. mon-fri, sat, holiday), start, end, rate, priority. Save your Excel sheet as CSV. Nothing is saved until you approve the preview.')}</p>
        </div>
      )}
      {preview && (
        <div className="mt-3 rounded-control border border-line p-3">
          <h4 className="mb-2 text-sm font-semibold">{t('Review before saving')}</h4>
          <table className="wf-table">
            <thead><tr><th>{t('Row')}</th><th>{t('Name')}</th><th>{t('Days')}</th><th>{t('From')}</th><th>{t('To')}</th><th>{t('Rate (your note)')}</th><th>{t('Problems')}</th></tr></thead>
            <tbody>
              {preview.map(p => (
                <tr key={p.row}>
                  <td>{p.row}</td><td>{p.rule.name}</td>
                  <td>{p.rule.days.map(d => wd[d - 1].label).join(' ')}{p.rule.holidays ? ` + ${t('Public holidays')}` : ''}</td>
                  <td>{p.rule.start}</td><td>{p.rule.end}</td><td>{p.rule.rate}</td>
                  <td className={p.errors.length ? 'font-semibold text-bad-fg' : 'text-ok-fg'}>{p.errors.length ? p.errors.join(', ') : '✓'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex justify-end gap-2">
            <Button onClick={() => setPreview(null)}>{t('Cancel')}</Button>
            <Button variant="primary" disabled={!preview.some(p => !p.errors.length)}
              onClick={() => { commit(preview.filter(p => !p.errors.length).map(p => { const id = uid('ob_'); return { op: 'put', col: 'obRules', id, value: { ...p.rule, id, active: true } }; }), t('OB rules saved')); setPreview(null); }}>
              {t('Save {n} valid rules', { n: preview.filter(p => !p.errors.length).length })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
