import { describe, it, expect } from 'vitest';
import { vacationAbsences } from '../../../workforce/derive';
import { isoWeekMonday, isoYearOf } from '../planningModel';
import { isoWeekDates, formatDateStr } from '../components/calendar/dateUtils';

describe('one ISO week rule everywhere', () => {
  const people = { p1: { id: 'p1' } };
  const vacation = {
    operators: [{ id: 'o1', personId: 'p1' }, { id: 'o2' }],
    vacationBlocks: [{ id: 'b', operatorId: 'o1', startWeek: 1, endWeek: 1, status: 'approved' }],
  };

  it('puts week 1 leave on 2025-12-29 .. 2026-01-04 when today is 2025-12-29 (as the Vacations grid does)', () => {
    const dates = vacationAbsences(vacation, people, '2025-12-29').map(a => a.date);
    expect(dates[0]).toBe('2025-12-29');
    expect(dates).toHaveLength(7);
    expect(dates[6]).toBe('2026-01-04');
    expect(isoWeekMonday(isoYearOf('2025-12-29'), 1)).toBe('2025-12-29');
  });

  it('leaves mid-year leave where it was, and ignores unlinked operators', () => {
    const v = { ...vacation, vacationBlocks: [{ id: 'b', operatorId: 'o1', startWeek: 20, endWeek: 20, status: 'approved' }, { id: 'c', operatorId: 'o2', startWeek: 20, endWeek: 20, status: 'approved' }] };
    const out = vacationAbsences(v, people, '2026-05-01');
    expect(out[0].date).toBe('2026-05-11');
    expect(out).toHaveLength(7);
  });

  it('the Day view, coverage and Schedule agree on every week of several years', () => {
    for (const year of [2024, 2025, 2026, 2027]) {
      for (let w = 1; w <= 52; w++) expect(formatDateStr(isoWeekDates(year, w)[0])).toBe(isoWeekMonday(year, w));
    }
  });
});
