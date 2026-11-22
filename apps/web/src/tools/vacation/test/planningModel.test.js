import { describe, it, expect } from 'vitest';
import { buildPlanningModel, resolveOperators, planningGroups, UNLINKED, NO_TEAM } from '../planningModel';
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
});
