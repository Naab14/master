import { describe, it, expect } from 'vitest';
import { planningWeekCoverage, isoYearOf, buildPlanningModel, resolveOperators, planningGroups, coverageTeamIds, isoWeekMonday, UNLINKED, NO_TEAM } from '../planningModel';
import { mergeDemandSeries } from '../demandSeries';
import { isUsablePlan, adoptPlan, seedOperators, seedVacationBlocks, buildDefaultDemand, defaultSettings } from '../data';
import { getAllCoverageForWeek } from '../coverage';
import { buildSample } from '../../../workforce/logic/sample';

const t = s => s;
const TODAY = '2026-11-04';
const op = (id, extra = {}) => ({ id, name: `Op ${id}`, shift: 'S1', active: true, certifications: ['Avsyning'], ...extra });

describe('planning model for Vacations', () => {
  const wf = buildSample();
  const model = buildPlanningModel(wf, TODAY);

  it('has no model without processes, so Vacations keeps its own lists', () => {
    expect(buildPlanningModel(null, TODAY)).toBeNull();
    expect(buildPlanningModel({ ...wf, processes: {} }, TODAY)).toBeNull();
  });

  it('takes processes from planning with their own keys', () => {
    expect(model.processes.map(p => p.name)).toEqual(['Capsuling', 'Inspection', 'Labelling', 'Serialization']);
    expect(model.processes.every(p => p.key.startsWith('wf:'))).toBe(true);
  });

  it('gives a linked operator the profile\'s team and counting competencies', () => {
    const info = model.byPerson.get('p01');
    expect(info.teamId).toBe('red');
    // p01 holds a trainer level (counts fully) in Inspection
    expect(info.certifications).toContain('wf:insp');
  });

  it('does not count supervised or learning levels as covering', () => {
    const info = model.byPerson.get('p34'); // a trainee: supervised only
    expect(info.certifications).toEqual([]);
  });

  it('ignores a team move that waits for a manager', () => {
    const doc = structuredClone(wf);
    doc.memberships.ms_p01 = { ...doc.memberships.ms_p01, to: '2026-11-01' };
    doc.memberships.ms_p01_new = { id: 'ms_p01_new', personId: 'p01', teamId: 'blue', from: '2026-11-02', to: null, status: 'pending' };
    expect(buildPlanningModel(doc, TODAY).byPerson.get('p01').teamId).toBe(NO_TEAM);
  });

  it('never matches an unlinked operator by name, and leaves the saved operator untouched', () => {
    const name = wf.people.p01.name;
    const saved = [op('old', { name, personId: undefined, shift: 'S2', certifications: ['Avsyning', 'Etikettering'] })];
    const snapshot = JSON.stringify(saved);
    const [r] = resolveOperators(saved, model);
    expect(r.shift).toBe(UNLINKED);
    expect(r.certifications).toEqual([]);
    expect(JSON.stringify(saved)).toBe(snapshot);
  });

  it('treats a link to a removed profile as unlinked and keeps the saved data', () => {
    const saved = [op('x', { personId: 'gone', shift: 'S2' })];
    expect(resolveOperators(saved, model)[0].shift).toBe(UNLINKED);
    expect(saved[0].shift).toBe('S2');
  });

  it('returns the operators unchanged without a model', () => {
    const saved = [op('a')];
    expect(resolveOperators(saved, null)).toBe(saved);
  });

  it('groups by team, then no team, then not linked; the last two show no coverage', () => {
    const saved = [
      op('a', { personId: 'p01' }), op('b', { personId: 'p02' }), op('old'),
    ];
    const groups = planningGroups(resolveOperators(saved, model), model, t);
    expect(groups.map(g => g.label)).toEqual(['Blue', 'Red', 'Not linked']);
    expect(groups[2].noCoverage).toBe(true);
    expect(groups[0].noCoverage).toBeUndefined();
  });

  it('counts coverage by planning process and takes an approved vacation out', () => {
    const saved = [op('a', { personId: 'p01' }), op('b', { personId: 'p04' })];
    const resolved = resolveOperators(saved, model);
    const keys = model.processes.map(p => p.key);
    const on = getAllCoverageForWeek(resolved, [], {}, 10, 'combined', null, {}, keys);
    expect(on['wf:insp'].covered).toBeGreaterThan(0);
    expect(on['wf:insp'].required).toBe(2); // no stored demand: default of 2
    const away = getAllCoverageForWeek(resolved, [{ id: 'v', operatorId: 'a', startWeek: 10, endWeek: 10, status: 'approved' }], {}, 10, 'combined', null, {}, keys);
    expect(away['wf:insp'].covered).toBe(on['wf:insp'].covered - 1);
    expect(away['wf:insp'].operatorsOut.map(o => o.id)).toContain('a');
  });

  it('the older process names still work by default', () => {
    const r = getAllCoverageForWeek([op('a')], [], {}, 10, 'combined', null, {});
    expect(r.Avsyning.covered).toBe(1);
    expect(Object.keys(r)).not.toContain('wf:insp');
  });

  it('uses the team on the evaluated date, so a move planned for later counts later', () => {
    const doc = structuredClone(wf);
    doc.memberships.ms_p01 = { ...doc.memberships.ms_p01, to: '2026-11-08' };
    doc.memberships.ms_p01_new = { id: 'ms_p01_new', personId: 'p01', teamId: 'blue', from: '2026-11-09', to: null, status: 'confirmed' };
    const m = buildPlanningModel(doc, '2026-11-04');
    const saved = [op('a', { personId: 'p01' })];
    expect(resolveOperators(saved, m)[0].shift).toBe('red');
    expect(resolveOperators(saved, m, '2026-11-04')[0].shift).toBe('red');
    expect(resolveOperators(saved, m, '2026-11-09')[0].shift).toBe('blue');
  });

  it('finds the Monday of an ISO week', () => {
    expect(isoWeekMonday(2026, 1)).toBe('2025-12-29');
    expect(isoWeekMonday(2026, 46)).toBe('2026-11-09');
  });

  it('gives coverage only to teams with people, the same list for the grid and the Dashboard', () => {
    const doc = structuredClone(wf);
    doc.teams.empty = { id: 'empty', name: 'Empty team' };
    const m = buildPlanningModel(doc, TODAY);
    const resolved = resolveOperators([op('a', { personId: 'p01' }), op('old')], m);
    expect(coverageTeamIds(resolved, m, t)).toEqual(['red']);
  });
});

describe('is this a usable saved plan', () => {
  const plan = { operators: seedOperators, vacationBlocks: seedVacationBlocks, demand: buildDefaultDemand(), settings: defaultSettings };
  it('accepts a whole plan, including one with zero demand and linked operators', () => {
    expect(isUsablePlan(plan)).toBe(true);
    expect(isUsablePlan({ ...plan, demand: { Avsyning: { 3: 0 } } })).toBe(true);
  });
  it('rejects partial or damaged ones', () => {
    for (const bad of [null, 'x', [], { operators: [] }, { ...plan, settings: null }, { ...plan, operators: [{ name: 'no id' }] },
      { ...plan, vacationBlocks: [{ operatorId: 'a', startWeek: 'x', endWeek: 2 }] }, { ...plan, demand: [] }]) {
      expect(isUsablePlan(bad)).toBe(false);
    }
  });
});

describe('review round 2', () => {
  const wf = buildSample();
  const plan = { operators: seedOperators, vacationBlocks: seedVacationBlocks, demand: buildDefaultDemand(), settings: defaultSettings };

  it('gives coverage rows to a team someone moves to on a date shown, even if it is empty today', () => {
    const doc = structuredClone(wf);
    doc.teams.solo = { id: 'solo', name: 'Solo' };
    doc.memberships.ms_p01 = { ...doc.memberships.ms_p01, to: '2026-11-08' };
    doc.memberships.ms_p01_new = { id: 'ms_p01_new', personId: 'p01', teamId: 'solo', from: '2026-11-09', to: null, status: 'confirmed' };
    const m = buildPlanningModel(doc, '2026-11-04');
    const resolved = resolveOperators([{ id: 'a', name: 'A', active: true, personId: 'p01', shift: 'S1', certifications: [] }], m);
    expect(planningGroups(resolved, m, t, ['2026-11-04']).map(g => g.shift)).toEqual(['red']);
    const shown = planningGroups(resolved, m, t, ['2026-11-04', '2026-11-09']);
    expect(shown.map(g => g.shift)).toEqual(['red', 'solo']);
    expect(shown[1].ops).toEqual([]);
    expect(coverageTeamIds(resolved, m, t, ['2026-11-09'])).toContain('solo');
  });

  it('rejects a backup with a bad block status or day override and fills missing operator fields', () => {
    expect(isUsablePlan({ ...plan, vacationBlocks: [{ id: 'b', operatorId: 'op1', startWeek: 1, endWeek: 2 }] })).toBe(false);
    expect(isUsablePlan({ ...plan, vacationBlocks: [{ id: 'b', operatorId: 'op1', startWeek: 1, endWeek: 2, status: 'draft', dayStatuses: { '2026-01-01': 'nope' } }] })).toBe(false);
    const sparse = adoptPlan({ ...plan, operators: [{ id: 'x', name: 'X' }] });
    expect(sparse.operators[0]).toMatchObject({ certifications: [], active: true, shift: 'S1' });
    expect(plan.operators).toBe(seedOperators); // input untouched
    expect(adoptPlan({ operators: [] })).toBeNull();
  });

  it('fills only empty weeks when copying demand, and replaces saved weeks only when told to', () => {
    const target = { 1: 3, 2: 0 };
    const source = { 1: 5, 2: 0, 3: 0, 4: 1 };
    const fill = mergeDemandSeries(target, source, false);
    expect(fill.series).toEqual({ 1: 3, 2: 0, 3: 0, 4: 1 });
    expect(fill.conflicts).toBe(1);
    expect(mergeDemandSeries(target, source, true).series).toEqual({ 1: 5, 2: 0, 3: 0, 4: 1 });
    expect(target).toEqual({ 1: 3, 2: 0 });
  });
});

describe('review round 3', () => {
  it('treats a null demand series as empty, in copying and when adopting a plan', () => {
    expect(mergeDemandSeries(null, { 1: 2 }).series).toEqual({ 1: 2 });
    expect(mergeDemandSeries({ 1: 2 }, null).series).toEqual({ 1: 2 });
    const plan = { operators: seedOperators, vacationBlocks: [], demand: { Avsyning: null, Kapselresaren: { 3: 0 } }, settings: defaultSettings };
    expect(adoptPlan(plan).demand).toEqual({ Avsyning: {}, Kapselresaren: { 3: 0 } });
  });

  it('the Dashboard and the grid share one week calculation: a Wednesday move counts from its own Monday', () => {
    const wf = buildSample();
    // Blue is the team 'blue'; p02 is on it. Move the only red operator (p01) to blue on Wednesday 2026-11-11.
    const doc = structuredClone(wf);
    doc.memberships.ms_p01 = { ...doc.memberships.ms_p01, to: '2026-11-10' };
    doc.memberships.ms_p01_new = { id: 'n', personId: 'p01', teamId: 'blue', from: '2026-11-11', to: null, status: 'confirmed' };
    const m = buildPlanningModel(doc, '2026-11-11'); // "today" is already after the move
    const plan = {
      operators: [op('a', { personId: 'p01' })], vacationBlocks: [], demand: {},
      settings: { ...defaultSettings, shiftMode: 'separate' },
    };
    // Week 46 starts Monday 2026-11-09: on that date p01 is still on red.
    const { results } = planningWeekCoverage(plan, m, 46, isoYearOf('2026-11-11'), t);
    // Coverage is by the Monday's team (red); a team someone is on today (blue) also gets its row, as in the grid
    expect(results.map(r => r.shift)).toEqual(['blue', 'red']);
    // Week 47 (from 2026-11-16): on blue.
    expect(planningWeekCoverage(plan, m, 47, 2026, t).results.map(r => r.shift)).toEqual(['blue']);
    expect(isoYearOf('2027-01-01')).toBe(2026);
  });
});

describe('review round 4', () => {
  it('keeps array-backed demand exactly as the old code read it (index = week), zeros included', () => {
    const plan = { operators: seedOperators, vacationBlocks: [], demand: { Avsyning: [null, 0, 7] }, settings: defaultSettings };
    const d = adoptPlan(plan).demand.Avsyning;
    expect(d[1]).toBe(0);
    expect(d[2]).toBe(7);
    expect(d[0]).toBeUndefined();
    expect(plan.demand.Avsyning).toEqual([null, 0, 7]);
  });

  it('tells apart two sets of conflicts that have the same size', () => {
    const a = mergeDemandSeries({ 1: 3, 2: 4 }, { 1: 5, 2: 4 }).signature;
    const b = mergeDemandSeries({ 1: 3, 2: 4 }, { 1: 3, 2: 5 }).signature;
    expect(a).not.toBe(b);
    expect(mergeDemandSeries({ 1: 3 }, { 1: 5 }).signature).toBe(mergeDemandSeries({ 1: 3 }, { 1: 5 }).signature);
  });

  it('uses one ISO year for week numbers, also in the last days of December', () => {
    expect(isoYearOf('2025-12-29')).toBe(2026);
    expect(isoWeekMonday(isoYearOf('2025-12-29'), 1)).toBe('2025-12-29');
  });
});

describe('review: one rule for a week\'s teams', () => {
  it('a team whose member joined after the week\'s Monday gets a row on the Dashboard as in the grid', () => {
    const doc = structuredClone(buildSample());
    doc.teams.south = { id: 'south', name: 'South' };
    doc.memberships.ms_p01 = { ...doc.memberships.ms_p01, to: '2026-11-21' };
    doc.memberships.ms_new = { id: 'ms_new', personId: 'p01', teamId: 'south', from: '2026-11-22', to: null, status: 'confirmed' };
    const today = '2026-11-23';
    const m = buildPlanningModel(doc, today);
    const plan = { operators: [op('a', { personId: 'p01' })], vacationBlocks: [], demand: {}, settings: { ...defaultSettings, shiftMode: 'separate' } };
    // Week 47 starts 2026-11-16, before the move: the person is still on red, but South has someone today
    const dash = planningWeekCoverage(plan, m, 47, 2026, t, today).results.map(r => r.shift);
    const grid = planningGroups(resolveOperators(plan.operators, m), m, t, ['2026-11-16']).filter(g => !g.noCoverage).map(g => g.shift);
    expect(dash).toEqual(grid);
    expect(dash).toContain('south');
  });
});
