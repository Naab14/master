import { describe, it, expect } from 'vitest';
import { isoWeekDates, formatDateStr } from '../../components/calendar/dateUtils';

describe('isoWeekDates', () => {
  it('returns 7 dates for a given week', () => {
    const dates = isoWeekDates(2026, 1);
    expect(dates).toHaveLength(7);
  });

  it('starts on Monday (ISO week)', () => {
    const dates = isoWeekDates(2026, 1);
    // 2026-01-01 is a Thursday, so ISO week 1 starts Mon 2025-12-29
    expect(dates[0].getDay()).toBe(1); // Monday
  });

  it('ends on Sunday', () => {
    const dates = isoWeekDates(2026, 1);
    expect(dates[6].getDay()).toBe(0); // Sunday
  });

  it('returns consecutive days', () => {
    const dates = isoWeekDates(2026, 10);
    for (let i = 1; i < dates.length; i++) {
      const diff = dates[i].getTime() - dates[i - 1].getTime();
      expect(diff).toBe(24 * 60 * 60 * 1000);
    }
  });

  it('week 26 of 2026 starts in late June', () => {
    const dates = isoWeekDates(2026, 26);
    expect(dates[0].getMonth()).toBe(5); // June (0-indexed)
  });
});

describe('formatDateStr', () => {
  it('formats as YYYY-MM-DD', () => {
    const d = new Date(2026, 0, 5); // Jan 5
    expect(formatDateStr(d)).toBe('2026-01-05');
  });

  it('zero-pads month', () => {
    const d = new Date(2026, 2, 15); // Mar 15
    expect(formatDateStr(d)).toBe('2026-03-15');
  });

  it('zero-pads day', () => {
    const d = new Date(2026, 11, 1); // Dec 1
    expect(formatDateStr(d)).toBe('2026-12-01');
  });

  it('handles double-digit month and day', () => {
    const d = new Date(2026, 10, 25); // Nov 25
    expect(formatDateStr(d)).toBe('2026-11-25');
  });
});
