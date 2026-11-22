import { describe, it, expect } from 'vitest';
import { syncOperatorsWithPeople, linkOperator, linkBlocked, unlinkedOperators } from '../sharedPeople';
import { historyReducer, initHistory } from '../historyReducer';

const people = [{ id: 'p1', name: 'Alva Almkvist' }, { id: 'p2', name: 'Bo Dalmyr', endDate: '2026-01-31' }];

describe('shared operator identity', () => {
  it('gives every profile an operator, linked by id, and leaves older operators alone', () => {
    const legacy = { id: 'op1', name: 'Alva Almkvist', shift: 'S2', active: true, certifications: ['Avsyning'] };
    const out = syncOperatorsWithPeople([legacy], people, '2026-11-10');
    expect(out).toHaveLength(3);
    expect(out[0]).toBe(legacy);                                  // same name, still NOT linked: no name matching
    expect(out[1]).toMatchObject({ id: 'wf-p1', personId: 'p1', name: 'Alva Almkvist', active: true });
    expect(out[2]).toMatchObject({ personId: 'p2', active: false }); // has left
    expect(unlinkedOperators(out)).toEqual([legacy]);
  });

  it('follows a renamed profile and is stable when nothing changes', () => {
    const ops = syncOperatorsWithPeople([], people, '2026-01-01');
    expect(syncOperatorsWithPeople(ops, people, '2026-01-01')).toBe(ops);
    const renamed = syncOperatorsWithPeople(ops, [{ id: 'p1', name: 'Alva Berg' }, people[1]], '2026-01-01');
    expect(renamed.find(o => o.personId === 'p1')).toMatchObject({ id: 'wf-p1', name: 'Alva Berg' });
    // A removed profile keeps its operator and history.
    expect(syncOperatorsWithPeople(ops, [people[0]], '2026-01-01')).toBe(ops);
  });

  it('links an older operator by hand and keeps its vacation blocks', () => {
    const state = {
      operators: [{ id: 'op1', name: 'A. Almkvist', shift: 'S2', active: true, certifications: ['Avsyning'] }, { id: 'wf-p1', personId: 'p1', name: 'Alva Almkvist', shift: 'S1', active: true, certifications: [] }],
      vacationBlocks: [{ id: 'b1', operatorId: 'op1', startWeek: 28, endWeek: 30, status: 'approved' }, { id: 'b2', operatorId: 'wf-p1', startWeek: 40, endWeek: 40, status: 'draft' }],
    };
    expect(linkBlocked(state, 'op1', 'p1')).toMatchObject({ reason: 'confirm' });
    expect(linkOperator(state, 'op1', 'p1', people)).toBe(state); // needs the user's yes
    const out = linkOperator(state, 'op1', 'p1', people, { confirmMerge: true });
    expect(out.operators).toHaveLength(1);
    expect(out.operators[0]).toMatchObject({ id: 'op1', personId: 'p1', name: 'Alva Almkvist', shift: 'S2', certifications: ['Avsyning'] });
    expect(out.operators[0].mergedFrom).toEqual([{ id: 'wf-p1', personId: 'p1', name: 'Alva Almkvist', shift: 'S1', active: true, certifications: [] }]);
    expect(out.vacationBlocks.map(b => b.operatorId)).toEqual(['op1', 'op1']);
    expect(linkOperator(out, 'op1', 'p2', people)).toBe(out); // already linked
  });

  it('syncs without adding an undo step', () => {
    const h = historyReducer(initHistory({ operators: [] }), { type: 'SYNC', updater: s => ({ ...s, operators: [1] }) });
    expect(h).toEqual({ past: [], present: { operators: [1] }, future: [] });
  });

  it('replaces an empty synthesized twin without asking', () => {
    const state = {
      operators: [{ id: 'op1', name: 'A', shift: 'S2', active: true, certifications: ['Avsyning'] }, { id: 'wf-p1', personId: 'p1', name: 'Alva Almkvist', shift: 'S1', active: true, certifications: [] }],
      vacationBlocks: [],
    };
    expect(linkBlocked(state, 'op1', 'p1')).toBeNull();
    expect(linkOperator(state, 'op1', 'p1', people).operators.map(o => o.id)).toEqual(['op1']);
  });

  it('refuses to merge when both operators have blocks in the same weeks, and loses nothing', () => {
    const state = {
      operators: [{ id: 'op1', name: 'A', shift: 'S2', active: true, certifications: [] }, { id: 'wf-p1', personId: 'p1', name: 'Alva', shift: 'S1', active: true, certifications: [] }],
      vacationBlocks: [{ id: 'b1', operatorId: 'op1', startWeek: 28, endWeek: 30, status: 'approved' }, { id: 'b2', operatorId: 'wf-p1', startWeek: 30, endWeek: 31, status: 'draft' }],
    };
    expect(linkBlocked(state, 'op1', 'p1')).toMatchObject({ reason: 'overlap' });
    expect(linkOperator(state, 'op1', 'p1', people, { confirmMerge: true })).toBe(state);
  });

  it('asks before merging a twin whose active state was changed, and keeps its whole record', () => {
    const twin = { id: 'wf-p1', personId: 'p1', name: 'Alva', shift: 'S1', active: false, certifications: [] };
    const state = { operators: [{ id: 'op1', name: 'A', shift: 'S2', active: true, certifications: [] }, twin], vacationBlocks: [] };
    expect(linkBlocked(state, 'op1', 'p1')).toMatchObject({ reason: 'confirm' });
    expect(linkOperator(state, 'op1', 'p1', people)).toBe(state);
    expect(linkOperator(state, 'op1', 'p1', people, { confirmMerge: true }).operators[0].mergedFrom).toEqual([twin]);
  });
});
