import { describe, it, expect } from 'vitest';
import { getCoverage, getAllCoverageForWeek } from '../coverage';
import { PROCESSES, buildDefaultDemand } from '../data';

const makeOp = (id, shift = 'S1', active = true, certifications = []) =>
  ({ id, name: `Op ${id}`, shift, active, certifications });

const makeBlock = (id, operatorId, startWeek, endWeek, status = 'approved') =>
  ({ id, operatorId, startWeek, endWeek, status });

const defaultDemand = buildDefaultDemand();
const emptyHolidays = {};

describe('getCoverage', () => {
  it('returns green when coverage meets demand', () => {
    const ops = [
      makeOp('1', 'S1', true, ['Avsyning']),
      makeOp('2', 'S1', true, ['Avsyning']),
    ];
    const result = getCoverage(ops, [], defaultDemand, 'Avsyning', 10, 'combined', null, emptyHolidays);
    expect(result.covered).toBe(2);
    expect(result.required).toBe(2);
    expect(result.level).toBe('green');
  });

  it('returns yellow when one short of required', () => {
    const ops = [makeOp('1', 'S1', true, ['Avsyning'])];
    const result = getCoverage(ops, [], defaultDemand, 'Avsyning', 10, 'combined', null, emptyHolidays);
    expect(result.covered).toBe(1);
    expect(result.level).toBe('yellow');
  });

  it('returns red when coverage is well below required', () => {
    const result = getCoverage([], [], defaultDemand, 'Avsyning', 10, 'combined', null, emptyHolidays);
    expect(result.covered).toBe(0);
    expect(result.level).toBe('red');
  });

  it('excludes operators on approved vacation', () => {
    const ops = [
      makeOp('1', 'S1', true, ['Avsyning']),
      makeOp('2', 'S1', true, ['Avsyning']),
    ];
    const blocks = [makeBlock('b1', '1', 10, 12, 'approved')];
    const result = getCoverage(ops, blocks, defaultDemand, 'Avsyning', 10, 'combined', null, emptyHolidays);
    expect(result.covered).toBe(1);
    expect(result.operatorsOut).toHaveLength(1);
    expect(result.operatorsOut[0].id).toBe('1');
  });

  it('does not exclude operators on draft/pending vacation', () => {
    const ops = [makeOp('1', 'S1', true, ['Avsyning'])];
    const blocks = [makeBlock('b1', '1', 10, 12, 'draft')];
    const result = getCoverage(ops, blocks, defaultDemand, 'Avsyning', 10, 'combined', null, emptyHolidays);
    expect(result.covered).toBe(1);
    expect(result.operatorsOut).toHaveLength(0);
  });

  it('excludes inactive operators', () => {
    const ops = [makeOp('1', 'S1', false, ['Avsyning'])];
    const result = getCoverage(ops, [], defaultDemand, 'Avsyning', 10, 'combined', null, emptyHolidays);
    expect(result.covered).toBe(0);
  });

  it('filters by shift in separate mode', () => {
    const ops = [
      makeOp('1', 'S1', true, ['Avsyning']),
      makeOp('2', 'S2', true, ['Avsyning']),
    ];
    const result = getCoverage(ops, [], defaultDemand, 'Avsyning', 10, 'separate', 'S1', emptyHolidays);
    expect(result.covered).toBe(1);
    expect(result.operatorsIn).toHaveLength(1);
    expect(result.operatorsIn[0].id).toBe('1');
  });

  it('skips operators with zero certifications', () => {
    const ops = [makeOp('1', 'S1', true, [])];
    const result = getCoverage(ops, [], defaultDemand, 'Avsyning', 10, 'combined', null, emptyHolidays);
    expect(result.covered).toBe(0);
  });

  it('flags holiday weeks', () => {
    const holidays = { 10: { holidays: [{ name: 'Test', dateStr: '2026-03-10' }] } };
    const result = getCoverage([], [], defaultDemand, 'Avsyning', 10, 'combined', null, holidays);
    expect(result.isHoliday).toBe(true);
  });
});

describe('getAllCoverageForWeek — multi-cert assignment', () => {
  it('assigns single-cert operators first, then multi-cert to most-needed', () => {
    const ops = [
      makeOp('1', 'S1', true, ['Avsyning']),
      makeOp('2', 'S1', true, ['Avsyning', 'Serialisering']),
    ];
    const result = getAllCoverageForWeek(ops, [], defaultDemand, 10, 'combined', null, emptyHolidays);
    expect(result['Avsyning'].covered).toBe(1);
    expect(result['Serialisering'].covered).toBe(1);
  });

  it('handles all operators on vacation', () => {
    const ops = [makeOp('1', 'S1', true, ['Avsyning'])];
    const blocks = [makeBlock('b1', '1', 1, 52, 'approved')];
    const result = getAllCoverageForWeek(ops, blocks, defaultDemand, 10, 'combined', null, emptyHolidays);
    expect(result['Avsyning'].covered).toBe(0);
    expect(result['Avsyning'].level).toBe('red');
  });

  it('returns all processes', () => {
    const result = getAllCoverageForWeek([], [], defaultDemand, 10, 'combined', null, emptyHolidays);
    for (const proc of PROCESSES) {
      expect(result[proc]).toBeDefined();
      expect(result[proc].required).toBe(2);
    }
  });
});
