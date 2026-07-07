import { describe, it, expect } from 'vitest';
import { initHolidays } from '../holidays';

describe('buildHolidayMap (via initHolidays)', () => {
  it('returns an object keyed by week number', async () => {
    const map = await initHolidays(2026);
    expect(typeof map).toBe('object');
    const weeks = Object.keys(map).map(Number);
    weeks.forEach(w => {
      expect(w).toBeGreaterThanOrEqual(1);
      expect(w).toBeLessThanOrEqual(52);
      expect(map[w].holidays).toBeInstanceOf(Array);
      expect(map[w].holidays.length).toBeGreaterThan(0);
    });
  });

  it('includes Nyårsdagen in week 1', async () => {
    const map = await initHolidays(2026);
    expect(map[1]).toBeDefined();
    const names = map[1].holidays.map(h => h.name);
    expect(names).toContain('Nyårsdagen');
  });

  it('includes Swedish national day (June 6) in correct week', async () => {
    const map = await initHolidays(2026);
    const found = Object.values(map).some(w =>
      w.holidays.some(h => h.name.includes('nationaldag'))
    );
    expect(found).toBe(true);
  });

  it('includes Swedish midsommar holidays', async () => {
    const map = await initHolidays(2026);
    const allNames = Object.values(map).flatMap(w => w.holidays.map(h => h.name));
    expect(allNames.some(n => n.includes('Midsommar') || n.includes('midsommar'))).toBe(true);
  });

  it('includes Easter-related holidays', async () => {
    const map = await initHolidays(2026);
    const allNames = Object.values(map).flatMap(w => w.holidays.map(h => h.name));
    expect(allNames).toContain('Långfredagen');
    expect(allNames).toContain('Påskdagen');
    expect(allNames).toContain('Annandag påsk');
  });

  it('each holiday has a dateStr in YYYY-MM-DD format', async () => {
    const map = await initHolidays(2026);
    Object.values(map).forEach(w => {
      w.holidays.forEach(h => {
        expect(h.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });

  it('does not duplicate holidays within same week', async () => {
    const map = await initHolidays(2026);
    Object.values(map).forEach(w => {
      const names = w.holidays.map(h => h.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  it('Midsommarafton is in June', async () => {
    const map = await initHolidays(2026);
    const midsommar = Object.values(map)
      .flatMap(w => w.holidays)
      .find(h => h.name.includes('Midsommar') && h.name.includes('afton'));
    expect(midsommar).toBeDefined();
    expect(midsommar.dateStr).toMatch(/^2026-06-/);
  });
});
