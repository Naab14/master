/* Data the screens share, derived from the documents. */
import { useEffect, useMemo, useState } from 'react';
import { getFullState } from '../api';
import { useWorkforce } from './store-context';
import { absencesFromEntries } from './logic/attendance';
import { reasonsOf } from './logic/model';
import { addDays, dateRange, isoWeekStart, todayIn } from './logic/time';

/**
 * Approved (and pending) leave from the Vacations tool, as dated absences.
 * An operator there carries the id of its People profile (`personId`), so
 * this never matches by name; unlinked operators are left out. Vacation
 * blocks are stored by ISO week, so they are read for the current year.
 */
export function useVacationToolAbsences() {
  const { wf, offline } = useWorkforce();
  const [vacation, setVacation] = useState(null);
  useEffect(() => {
    if (offline) return;
    let live = true;
    getFullState().then(s => { if (live) setVacation(s.vacation || null); }).catch(() => {});
    return () => { live = false; };
  }, [offline]);
  return useMemo(() => {
    if (!vacation?.operators) return [];
    const year = Number(todayIn().slice(0, 4));
    const out = [];
    for (const b of vacation.vacationBlocks || []) {
      const op = vacation.operators.find(o => o.id === b.operatorId);
      const personId = op?.personId;
      if (!personId || !wf.people[personId] || b.status === 'draft') continue;
      const from = isoWeekStart(year, b.startWeek);
      const to = addDays(isoWeekStart(year, b.endWeek), 6);
      for (const date of dateRange(from, to)) {
        const status = b.dayStatuses?.[date] || b.status;
        if (status === 'draft') continue;
        out.push({ personId, date, fullDay: true, hours: null, reasonId: 'vacation', category: 'vacation', tentative: status !== 'approved', source: 'vacations' });
      }
    }
    return out;
  }, [vacation, wf.people]);
}

/** Every absence that affects availability, plus a lookup by person and date. */
export function useAbsences() {
  const { wf, entries } = useWorkforce();
  const fromTool = useVacationToolAbsences();
  return useMemo(() => {
    const all = [...absencesFromEntries(wf, entries), ...fromTool];
    const map = new Map();
    for (const a of all) {
      const k = `${a.personId}_${a.date}`;
      const cur = map.get(k);
      const mark = a.tentative ? 'tentative' : a.fullDay ? (a.category === 'vacation' ? 'vacation' : 'full') : 'partial';
      const weight = { tentative: 1, partial: 2, vacation: 3, full: 3 };
      if (!cur || weight[mark] > weight[cur.mark]) map.set(k, { mark, reasonId: a.reasonId });
    }
    return { all, map };
  }, [wf, entries, fromTool]);
}

export function useReasons() {
  const { wf } = useWorkforce();
  return useMemo(() => reasonsOf(wf), [wf]);
}
