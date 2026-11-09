import { describe, it, expect } from 'vitest';
import { buildSample } from './sample';
import { realHours, shiftMinutes, isoWeek, zonedToUtc, utcToZoned, addDays, weekday } from './time';
import { list } from './model';
import { buildIndex, resolveShift, shiftTimes, assignPatternOps, editPatternFromOps, overrideOps, moveTeamOps, confirmMoveOps } from './schedule';
import { computeCoverage, absenceImpact, requirementsFor, runningShifts, templateFor, matchPeople, qualification } from './coverage';
import { personMonth, obHours, entryTime, parseObRows } from './attendance';
import { levelsOf } from './model';

const apply = (wf, ops) => {
  const next = { ...wf };
  for (const o of ops) {
    next[o.col] = { ...next[o.col] };
    if (o.op === 'del') delete next[o.col][o.id]; else next[o.col][o.id] = o.value;
  }
  return next;
};
const utcToDate = ms => utcToZoned(ms).date;

describe('time', () => {
  it('measures night shifts across daylight-saving changes', () => {
    const { s, e } = shiftMinutes('22:00', '06:00');
    expect(realHours('2026-11-03', s, e)).toBe(8);
    expect(realHours('2026-03-28', s, e)).toBe(7);  // clocks forward 29 March
    expect(realHours('2026-10-24', s, e)).toBe(9);  // clocks back 25 October
  });
  it('knows 2026 has an ISO week 53', () => {
    expect(isoWeek('2026-12-31')).toBe(53);
    expect(isoWeek('2027-01-04')).toBe(1);
    expect(weekday('2026-11-02')).toBe(1);
  });
  it('converts Stockholm wall time both ways', () => {
    const ms = zonedToUtc('2026-07-01', 6 * 60);
    expect(new Date(ms).toISOString()).toBe('2026-07-01T04:00:00.000Z');
    expect(utcToZoned(ms)).toEqual({ date: '2026-07-01', minutes: 360 });
  });
});

describe('schedule', () => {
  const wf = buildSample();
  const idx = buildIndex(wf);
  it('has 40 people on three rotating teams and a day team', () => {
    expect(list(wf.people)).toHaveLength(40);
    expect(resolveShift(wf, idx, 'p01', '2026-11-02').shiftTypeId).toBe('day');   // red
    expect(resolveShift(wf, idx, 'p02', '2026-11-02').shiftTypeId).toBe('eve');   // blue
    expect(resolveShift(wf, idx, 'p03', '2026-11-02').shiftTypeId).toBe('night'); // green
    expect(resolveShift(wf, idx, 'p01', '2026-11-09').shiftTypeId).toBe('eve');   // rotates weekly
    expect(resolveShift(wf, idx, 'p01', '2026-11-07').shiftTypeId).toBe(null);    // Saturday
    expect(resolveShift(wf, idx, 'p37', '2026-11-16').shiftTypeId).toBe('day');   // fixed days
  });
  it('gives overnight shifts real hours minus the break', () => {
    const t = shiftTimes(wf, { shiftTypeId: 'night' }, '2026-10-24');
    expect(t.overnight).toBe(true);
    expect(t.paidHours).toBe(8.5);
  });
  it('keeps history when a pattern is reassigned from a date', () => {
    const next = apply(wf, assignPatternOps(wf, 'team', 'red', 'fixday', '2026-11-09'));
    const i2 = buildIndex(next);
    expect(resolveShift(next, i2, 'p01', '2026-11-03').shiftTypeId).toBe('day');  // before: rotation week 1
    expect(resolveShift(next, i2, 'p01', '2026-10-27').shiftTypeId).toBe('night'); // history untouched
    expect(resolveShift(next, i2, 'p01', '2026-11-10').shiftTypeId).toBe('day');  // after: fixed days, not evening
  });
  it('edits a pattern from a date without rewriting the past', () => {
    const cycle = wf.patterns.rot3.cycle.map(s => (s === 'night' ? 'eve' : s));
    const next = apply(wf, editPatternFromOps(wf, 'rot3', { cycle }, '2026-12-01'));
    const i2 = buildIndex(next);
    expect(resolveShift(next, i2, 'p03', '2026-11-02').shiftTypeId).toBe('night');
    expect(resolveShift(next, i2, 'p03', '2026-12-14').shiftTypeId).toBe('eve'); // was a night week
    expect(next.patterns.rot3.cycle).toEqual(wf.patterns.rot3.cycle);
  });
  it('overrides one occurrence only', () => {
    const next = apply(wf, overrideOps('p01', '2026-11-03', 'night'));
    const i2 = buildIndex(next);
    expect(resolveShift(next, i2, 'p01', '2026-11-03')).toMatchObject({ shiftTypeId: 'night', source: 'override' });
    expect(resolveShift(next, i2, 'p01', '2026-11-04').shiftTypeId).toBe('day');
  });
  it('holds a team move until a manager confirms it', () => {
    const ops = moveTeamOps(wf, 'p01', 'blue', '2026-11-09', false);
    const pending = apply(wf, ops);
    expect(resolveShift(pending, buildIndex(pending), 'p01', '2026-11-09').shiftTypeId).toBe('eve'); // still red
    const done = apply(pending, confirmMoveOps(pending, ops[0].id));
    const i3 = buildIndex(done);
    expect(resolveShift(done, i3, 'p01', '2026-11-09').shiftTypeId).toBe('night'); // blue's week
    expect(resolveShift(done, i3, 'p01', '2026-11-03').teamId).toBe('red');
  });
});

describe('coverage', () => {
  const wf = buildSample();
  const idx = buildIndex(wf);
  const levels = levelsOf(wf);
  it('lets each process run its own shifts, and fewer in low season', () => {
    expect(runningShifts(wf, '2026-11-03', 'insp').sort()).toEqual(['day', 'eve', 'night']);
    expect(runningShifts(wf, '2026-11-03', 'caps').sort()).toEqual(['day', 'eve']);
    expect(runningShifts(wf, '2026-11-03', 'labl')).toEqual(['day']);
    expect(templateFor(wf, '2026-12-28')).toBe('low');
    expect(runningShifts(wf, '2026-12-28', 'insp').sort()).toEqual(['day', 'eve']);
    expect(runningShifts(wf, '2026-11-07', 'insp')).toEqual([]); // Saturday
  });
  it('never counts one multi-skilled person in two dedicated positions', () => {
    const w = buildSample();
    // Leave only two people on red's day shift; both can do inspection and capsuling.
    for (const p of list(w.people)) if (!['p01', 'p04'].includes(p.id)) delete w.memberships[`ms_${p.id}`];
    w.qualifications.p01.skills = { insp: 'independent', caps: 'independent' };
    w.qualifications.p04.skills = { insp: 'independent', caps: 'independent' };
    const c = computeCoverage(w, buildIndex(w), '2026-11-03', 'day');
    const filled = c.results.filter(r => r.req.kind === 'dedicated').reduce((n, r) => n + r.filled, 0);
    expect(filled).toBe(2);
    expect(c.level).toBe('short');
  });
  it('shows a documentation hour as a competing demand when nobody is spare', () => {
    const w = buildSample();
    for (const p of list(w.people)) if (!['p01', 'p04'].includes(p.id)) delete w.memberships[`ms_${p.id}`];
    w.qualifications.p01.skills = { insp: 'independent', docs: 'independent' };
    w.qualifications.p04.skills = { insp: 'independent' };
    const c = computeCoverage(w, buildIndex(w), '2026-11-03', 'day');
    const insp = c.results.find(r => r.req.processId === 'insp');
    const docs = c.results.find(r => r.req.kind === 'task');
    expect(insp.status).toBe('met');
    expect(docs).toMatchObject({ filled: 0, competing: 1, status: 'risk' });
    expect(docs.notes).toContain('competingFlexible'); // timing unknown, shown as such
  });
  it('counts a supervised trainee only next to a trainer', () => {
    const w = buildSample();
    for (const p of list(w.people)) if (!['p01', 'p04'].includes(p.id)) delete w.memberships[`ms_${p.id}`];
    w.qualifications.p01.skills = { insp: 'trainer' };
    w.qualifications.p04.skills = { insp: 'supervised' };
    let c = computeCoverage(w, buildIndex(w), '2026-11-03', 'day');
    let insp = c.results.find(r => r.req.processId === 'insp');
    expect(insp).toMatchObject({ filled: 2, status: 'risk' });
    expect(insp.supervised).toEqual(['p04']);
    w.qualifications.p01.skills = { insp: 'independent' }; // no supervisor now
    c = computeCoverage(w, buildIndex(w), '2026-11-03', 'day');
    insp = c.results.find(r => r.req.processId === 'insp');
    expect(insp.filled).toBe(1);
    expect(insp.notes).toContain('needsSupervisor');
    w.processes.insp.trainee = { supervised: 'none' };     // process says trainees never count
    expect(qualification(w, levels, 'p04', insp.req, '2026-11-03')).toBe(null);
  });
  it('judges certificates on the planned date', () => {
    const req = list(wf.requirements).find(r => r.kind === 'shared' && r.shiftTypeId === 'day' && r.templateId === 'normal');
    expect(qualification(wf, levels, 'p01', req, '2026-11-19')).toBe('full');
    expect(qualification(wf, levels, 'p01', req, '2026-11-23')).toBe(null); // expired 20 Nov
    expect(matchPeople(wf, { certs: ['truck'], date: '2026-11-23' })).not.toContain('p01');
    expect(matchPeople(wf, { skills: [{ skillId: 'insp', minLevelId: 'trainer' }], date: '2026-11-23' }).length).toBeGreaterThan(0);
  });
  it('applies a day adjustment on top of the template', () => {
    const w = buildSample();
    const r = requirementsFor(w, '2026-11-03', 'day').find(x => x.processId === 'labl');
    w.adjustments[`${r.id}_2026-11-03`] = { id: `${r.id}_2026-11-03`, requirementId: r.id, date: '2026-11-03', count: 4 };
    expect(requirementsFor(w, '2026-11-03', 'day').find(x => x.processId === 'labl').count).toBe(4);
    expect(requirementsFor(w, '2026-11-04', 'day').find(x => x.processId === 'labl').count).toBe(2);
  });
  it('covers a normal week for the full sample team', () => {
    const c = computeCoverage(wf, idx, '2026-11-03', 'day');
    expect(c.scheduled.length).toBe(16); // 12 red + 4 day team
    expect(c.results.length).toBeGreaterThan(4);
  });
  it('shows the gap a vacation opens and who could step in', () => {
    const w = buildSample();
    for (const p of list(w.people)) if (!['p01', 'p04', 'p02'].includes(p.id)) delete w.people[p.id];
    w.qualifications.p01.skills = { insp: 'independent' };
    w.qualifications.p04.skills = { insp: 'independent' };
    w.qualifications.p02.skills = { insp: 'independent' }; // blue: on evenings that week
    const impact = absenceImpact(w, buildIndex(w), 'p01', ['2026-11-03', '2026-11-07']);
    expect(impact.days).toHaveLength(1); // Saturday isn't a working day
    const gap = impact.days[0].gaps.find(g => g.req.processId === 'insp');
    expect(gap.replacements).toEqual([{ personId: 'p02', from: 'eve', opensGap: true, gapReqIds: expect.any(Array) }]);
  });
});

describe('attendance and OB', () => {
  const wf = buildSample();
  wf.obRules = {
    eve: { id: 'eve', name: 'Evening', days: [1, 2, 3, 4, 5], start: '18:00', end: '22:00', priority: 1 },
    night: { id: 'night', name: 'Night', days: [1, 2, 3, 4, 5, 6, 7], start: '22:00', end: '06:00', priority: 2 },
    wknd: { id: 'wknd', name: 'Weekend', days: [6, 7], start: '00:00', end: '24:00', priority: 3 },
  };
  const idx = buildIndex(wf);
  const opts = { utcToDate };
  it('earns OB on regular scheduled shifts', () => {
    const m = personMonth(wf, idx, [], 'p01', '2026-11', opts); // red: day, eve, night, day weeks
    expect(m.totals.scheduledShifts).toBe(21);
    expect(m.ob.eve).toBe(24);       // 6 evening shifts × 4 h after 18:00
    // 5 night shifts × 8 h; the last one ends Saturday morning, where the
    // weekend rule outranks the night rule from midnight.
    expect(m.ob.night).toBe(34);
    expect(m.ob.wknd).toBe(6);
  });
  it('does not double count overlapping rules', () => {
    const a = zonedToUtc('2026-11-07', 22 * 60);
    const ob = obHours([{ a, b: a + 8 * 3600000 }], list(wf.obRules), new Set(), utcToDate);
    expect(ob).toEqual({ wknd: 8 });
  });
  it('handles partial absence, overtime and a comment-only entry', () => {
    const entries = [
      { id: 'e1', personId: 'p01', date: '2026-11-03', reasonId: 'vab', start: '10:00', end: '14:00', comment: 'Child ill' },
      { id: 'e2', personId: 'p01', date: '2026-11-04', reasonId: 'overtime', start: '14:00', end: '16:00' },
      { id: 'e3', personId: 'p01', date: '2026-11-05', reasonId: 'leave', comment: 'Left early' },
      { id: 'e4', personId: 'p01', date: '2026-11-06', reasonId: 'sick', fullDay: true },
      { id: 'e5', personId: 'p01', date: '2026-11-02', reasonId: 'late', hours: 0.5 },
    ];
    const m = personMonth(wf, idx, entries, 'p01', '2026-11', opts);
    expect(m.totals.absence.hours).toBe(4);
    expect(m.totals.overtimeHours).toBe(2);
    expect(m.totals.sick).toEqual({ days: 1, hours: 7.5 });
    expect(m.totals.lateCount).toBe(1);
    expect(m.flags).toEqual([{ date: '2026-11-05', entryId: 'e3', problem: 'incomplete' }]);
    expect(m.totals.workedHours).toBe(157.5 - 4 + 2 - 7.5 - 0.5);
    expect(m.comments).toHaveLength(2);
    expect(m.deviations).toBe(5);
  });
  it('never invents a duration from a comment', () => {
    expect(entryTime({ comment: 'went home' }, { category: 'absence' }, null, '2026-11-05').kind).toBe('incomplete');
    expect(entryTime({ comment: 'x' }, { category: 'present' }, null, '2026-11-05').kind).toBe('none');
  });
  it('removes OB for time not worked and flags what it cannot place', () => {
    const entries = [
      { id: 'a', personId: 'p01', date: '2026-11-09', reasonId: 'leave', start: '20:00', end: '22:00' },
      { id: 'b', personId: 'p01', date: '2026-11-10', reasonId: 'leave', hours: 2 },
    ];
    const m = personMonth(wf, idx, entries, 'p01', '2026-11', opts);
    expect(m.ob.eve).toBe(22);
    expect(m.obUncertain).toBe(true);
    expect(m.flags).toContainEqual({ date: '2026-11-10', entryId: 'b', problem: 'obNeedsTimes' });
  });
  it('prepares OB rules from spreadsheet rows for review', () => {
    const rows = parseObRows([
      { Namn: 'Kväll', Dagar: 'mån-fre', Från: '18:00', Till: '22:00', Ersättning: '' },
      { name: 'Bad', days: 'someday', start: '25:99', end: '' },
    ]);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].rule).toMatchObject({ days: [1, 2, 3, 4, 5], start: '18:00', end: '22:00' });
    expect(rows[1].errors.length).toBeGreaterThan(1);
  });
});
