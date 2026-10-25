import { describe, it, expect } from 'vitest';
import { historyReducer, initHistory, HISTORY_CAP } from '../historyReducer';

describe('historyReducer', () => {
  it('SET pushes present into past, applies updater, clears future', () => {
    const initial = initHistory({ n: 1 });
    const next = historyReducer(initial, { type: 'SET', updater: s => ({ n: s.n + 1 }) });
    expect(next.past).toEqual([{ n: 1 }]);
    expect(next.present).toEqual({ n: 2 });
    expect(next.future).toEqual([]);
  });

  it('UNDO reverts present and moves current into future', () => {
    const initial = initHistory({ n: 1 });
    const afterSet = historyReducer(initial, { type: 'SET', updater: () => ({ n: 2 }) });
    const afterUndo = historyReducer(afterSet, { type: 'UNDO' });
    expect(afterUndo.past).toEqual([]);
    expect(afterUndo.present).toEqual({ n: 1 });
    expect(afterUndo.future).toEqual([{ n: 2 }]);
    // present should be the exact original reference (no accidental clone)
    expect(afterUndo.present).toBe(initial.present);
  });

  it('REDO re-applies an undone SET', () => {
    const initial = initHistory({ n: 1 });
    const a = historyReducer(initial, { type: 'SET', updater: () => ({ n: 2 }) });
    const b = historyReducer(a, { type: 'UNDO' });
    const c = historyReducer(b, { type: 'REDO' });
    expect(c.past).toEqual([{ n: 1 }]);
    expect(c.present).toEqual({ n: 2 });
    expect(c.future).toEqual([]);
  });

  it('new SET after UNDO clears the future stack', () => {
    const initial = initHistory({ n: 0 });
    const s1 = historyReducer(initial, { type: 'SET', updater: () => ({ n: 1 }) });
    const s2 = historyReducer(s1, { type: 'SET', updater: () => ({ n: 2 }) });
    const undone = historyReducer(s2, { type: 'UNDO' });
    expect(undone.future).toEqual([{ n: 2 }]);
    const diverged = historyReducer(undone, { type: 'SET', updater: () => ({ n: 99 }) });
    expect(diverged.future).toEqual([]);
    // REDO is now a no-op
    const redo = historyReducer(diverged, { type: 'REDO' });
    expect(redo).toBe(diverged);
  });

  it('history caps at HISTORY_CAP with FIFO eviction of oldest', () => {
    let state = initHistory({ n: 0 });
    for (let i = 1; i <= 60; i++) {
      state = historyReducer(state, { type: 'SET', updater: () => ({ n: i }) });
    }
    expect(state.past.length).toBe(HISTORY_CAP);
    // After 60 SETs, past holds the last 50 prior-presents: {n:10} through {n:59}
    expect(state.past[0]).toEqual({ n: 60 - HISTORY_CAP });
    expect(state.past[state.past.length - 1]).toEqual({ n: 59 });
    expect(state.present).toEqual({ n: 60 });
  });

  it('SET with identity updater is a no-op (reference-equal state, past untouched)', () => {
    const initial = initHistory({ n: 1 });
    const seeded = historyReducer(initial, { type: 'SET', updater: () => ({ n: 2 }) });
    const identity = historyReducer(seeded, { type: 'SET', updater: s => s });
    expect(identity).toBe(seeded);
    expect(identity.past).toBe(seeded.past);
  });

  it('UNDO and REDO on empty stacks return identical state', () => {
    const initial = initHistory({ n: 1 });
    expect(historyReducer(initial, { type: 'UNDO' })).toBe(initial);
    expect(historyReducer(initial, { type: 'REDO' })).toBe(initial);
  });
});
