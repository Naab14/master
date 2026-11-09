/* Printed schedule: people × days on real pages, split by weeks and rows so
 * nothing is clipped, with the date range and a legend on every page. */
import { useI18n } from '../i18n';
import { PrintPreview, PrintPage } from './print';
import { chunk } from './print-util';
import { displayName } from './logic/model';
import { weekday, isoWeek } from './logic/time';
import { useWorkforce } from './store-context';

export default function SchedulePrint({ groups, days, grid, coverage, shiftTypes, absences, nick, onClose }) {
  const { t, fmt } = useI18n();
  const { wf } = useWorkforce();
  return (
    <PrintPreview id="schedule" onClose={onClose}>
      {({ width, height }) => {
        const daysPerPage = Math.max(7, Math.floor((width - 20 - 42) / 6.2 / 7) * 7);
        const rowsPerPage = Math.max(10, Math.floor((height - 20 - 34 - shiftTypes.length * 4.6) / 4.6));
        const rows = groups.flatMap(g => [{ group: g.team }, ...g.people.map(p => ({ person: p }))]);
        const dayChunks = chunk(days, daysPerPage);
        const rowChunks = chunk(rows, rowsPerPage);
        const pages = dayChunks.flatMap(dc => rowChunks.map(rc => ({ dc, rc })));
        return pages.map(({ dc, rc }, i) => (
          <PrintPage key={i} page={i + 1} pages={pages.length} title={t('Schedule')}
            range={`${fmt.date(dc[0], 'full')} – ${fmt.date(dc[dc.length - 1], 'full')} · ${t('week')} ${isoWeek(dc[0])}–${isoWeek(dc[dc.length - 1])}`}
            legend={<>
              {shiftTypes.map(s => <span key={s.id}><b>{s.code}</b>{s.name} {s.start}–{s.end}</span>)}
              <span><b>×</b>{t('Away')}</span><span><b>~</b>{t('Partly away / requested')}</span><span><b>*</b>{t('Changed for this day')}</span>
              <span><b className="gap">−</b>{t('Short')}</span><span><b className="risk">!</b>{t('Possible, with risks')}</span>
            </>}>
            <table>
              <colgroup><col style={{ width: '42mm' }} />{dc.map(d => <col key={d} />)}</colgroup>
              <thead>
                <tr><th className="l">{t('Name')}</th>{dc.map(d => <th key={d} className={weekday(d) > 5 ? 'wkend' : ''}>{fmt.date(d, 'weekday').slice(0, 2)}<br />{fmt.date(d, 'day')}</th>)}</tr>
              </thead>
              <tbody>
                {rc.map((row, k) => row.group ? (
                  <tr key={`g${k}`}><th className="l" colSpan={dc.length + 1}>{row.group.name}</th></tr>
                ) : (
                  <tr key={row.person.id}>
                    <td className="l">{displayName(row.person, nick)}{nick && row.person.nickname ? ` (${row.person.name})` : ''}{row.person.employment === 'consultant' ? ' ᶜ' : ''}</td>
                    {dc.map(d => {
                      const r = grid.get(row.person.id)[days.indexOf(d)];
                      const away = absences.get(`${row.person.id}_${d}`);
                      const code = wf.shiftTypes[r.shiftTypeId]?.code || '';
                      const mark = away ? (away.mark === 'full' || away.mark === 'vacation' ? '×' : '~') : r.source === 'override' ? '*' : '';
                      return <td key={d} className={weekday(d) > 5 ? 'wkend' : ''}>{away && (away.mark === 'full' || away.mark === 'vacation') ? '×' : code}{mark && mark !== '×' ? mark : ''}</td>;
                    })}
                  </tr>
                ))}
                {rc === rowChunks[rowChunks.length - 1] && shiftTypes.map(s => (
                  <tr key={s.id}>
                    <th className="l">{t('Coverage')} · {s.name}</th>
                    {dc.map(d => {
                      const c = coverage[s.id][days.indexOf(d)];
                      return <td key={d} className={c.level === 'short' ? 'gap' : c.level === 'risk' ? 'risk' : ''}>{c.level === 'short' ? '−' : c.level === 'risk' ? '!' : c.level === 'met' ? '✓' : ''}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintPage>
        ));
      }}
    </PrintPreview>
  );
}
