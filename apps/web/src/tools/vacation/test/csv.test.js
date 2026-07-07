import { describe, it, expect } from 'vitest';
import { parseCSV, mergeOperators, exportOperatorsCSV } from '../csv';

describe('parseCSV — English headers (backwards compat)', () => {
  it('parses valid CSV with all columns', () => {
    const csv = 'Name,Shift,Certifications\nAnna,S1,Avsyning;Serialisering\nErik,S2,Etikettering';
    const { operators, error } = parseCSV(csv);
    expect(error).toBeNull();
    expect(operators).toHaveLength(2);
    expect(operators[0].name).toBe('Anna');
    expect(operators[0].shift).toBe('S1');
    expect(operators[0].certifications).toEqual(['Avsyning', 'Serialisering']);
    expect(operators[1].name).toBe('Erik');
    expect(operators[1].shift).toBe('S2');
  });

  it('returns error when no header row', () => {
    const { error } = parseCSV('');
    expect(error).toContain('header');
  });

  it('returns error when Name/Namn column is missing', () => {
    const { error } = parseCSV('Shift,Certifications\nS1,Avsyning');
    expect(error).toBeTruthy();
    expect(error).toMatch(/Namn|Name/);
  });

  it('defaults shift to S1 when column missing', () => {
    const csv = 'Name\nAnna';
    const { operators } = parseCSV(csv);
    expect(operators[0].shift).toBe('S1');
  });

  it('handles quoted fields with commas', () => {
    const csv = 'Name,Shift,Certifications\n"Svensson, Anna",S1,Avsyning';
    const { operators } = parseCSV(csv);
    expect(operators[0].name).toBe('Svensson, Anna');
  });

  it('uppercases shift values', () => {
    const csv = 'Name,Shift\nAnna,s2';
    const { operators } = parseCSV(csv);
    expect(operators[0].shift).toBe('S2');
  });

  it('skips rows with empty name', () => {
    const csv = 'Name,Shift\nAnna,S1\n,S2\nErik,S1';
    const { operators } = parseCSV(csv);
    expect(operators).toHaveLength(2);
  });
});

describe('parseCSV — Swedish headers', () => {
  it('parses Namn/Skift/Certifieringar headers', () => {
    const csv = 'Namn,Skift,Certifieringar\nAnna,S1,Avsyning;Serialisering';
    const { operators, error } = parseCSV(csv);
    expect(error).toBeNull();
    expect(operators).toHaveLength(1);
    expect(operators[0].name).toBe('Anna');
    expect(operators[0].certifications).toEqual(['Avsyning', 'Serialisering']);
  });

  it('accepts Swedish headers case-insensitively with whitespace', () => {
    const csv = ' NAMN , SKIFT , CERTIFIERINGAR \nAnna,S1,Avsyning';
    const { operators, error } = parseCSV(csv);
    expect(error).toBeNull();
    expect(operators[0].name).toBe('Anna');
  });
});

describe('parseCSV — comment lines', () => {
  it('skips lines starting with #', () => {
    const csv = [
      '# Semester Planner — Personalexport',
      '# Genererad: 2026-04-20',
      '',
      'Namn,Skift,Certifieringar',
      '# comment mid-file',
      'Anna,S1,Avsyning',
    ].join('\n');
    const { operators, error } = parseCSV(csv);
    expect(error).toBeNull();
    expect(operators).toHaveLength(1);
    expect(operators[0].name).toBe('Anna');
  });

  it('strips UTF-8 BOM prefix', () => {
    const csv = '\uFEFFNamn,Skift,Certifieringar\nAnna,S1,Avsyning';
    const { operators, error } = parseCSV(csv);
    expect(error).toBeNull();
    expect(operators[0].name).toBe('Anna');
  });
});

describe('parseCSV — cert handling', () => {
  it('matches cert names case-insensitively and trims whitespace', () => {
    const csv = 'Namn,Skift,Certifieringar\nAnna,S1,  avsyning ; SERIALISERING ';
    const { operators } = parseCSV(csv);
    expect(operators[0].certifications).toEqual(['Avsyning', 'Serialisering']);
  });

  it('emits a fuzzy suggestion warning for a typo within Levenshtein ≤ 2', () => {
    const csv = 'Namn,Skift,Certifieringar\nAnna,S1,Avsynng';
    const { operators, warnings } = parseCSV(csv);
    expect(operators[0].certifications).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Avsynng');
    expect(warnings[0]).toContain('Avsyning');
    expect(warnings[0]).toMatch(/Rad \d+/);
  });

  it('emits warning without suggestion when cert is too far from any known one', () => {
    const csv = 'Namn,Skift,Certifieringar\nAnna,S1,Xylofon';
    const { operators, warnings } = parseCSV(csv);
    expect(operators[0].certifications).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Xylofon');
    expect(warnings[0]).not.toContain('menade du');
  });

  it('reports the actual file row number for warnings (after comments)', () => {
    const csv = [
      '# header comment',
      '# another',
      '',
      'Namn,Skift,Certifieringar',
      'Anna,S1,Avsynng',
    ].join('\n');
    const { warnings } = parseCSV(csv);
    expect(warnings[0]).toContain('Rad 5');
  });
});

describe('exportOperatorsCSV', () => {
  const ops = [
    { id: '1', name: 'Anna Lindgren', shift: 'S1', active: true, certifications: ['Avsyning', 'Serialisering'] },
    { id: '2', name: 'Erik Holm', shift: 'S1', active: true, certifications: ['Kapselresaren'] },
  ];

  it('prefixes UTF-8 BOM for Excel compatibility', () => {
    const out = exportOperatorsCSV(ops);
    expect(out.charCodeAt(0)).toBe(0xFEFF);
  });

  it('emits Swedish column headers', () => {
    const out = exportOperatorsCSV(ops);
    expect(out).toContain('Namn,Skift,Certifieringar');
  });

  it('emits # comment preamble with format description', () => {
    const out = exportOperatorsCSV(ops);
    expect(out).toContain('# Semester Planner');
    expect(out).toMatch(/# Genererad: \d{4}-\d{2}-\d{2}/);
    expect(out).toContain('# Tillgängliga certifieringar:');
  });

  it('serializes each operator as a data row', () => {
    const out = exportOperatorsCSV(ops);
    expect(out).toContain('Anna Lindgren,S1,Avsyning;Serialisering');
    expect(out).toContain('Erik Holm,S1,Kapselresaren');
  });

  it('round-trips: export then re-import produces equivalent operators', () => {
    const csv = exportOperatorsCSV(ops);
    const { operators, error, warnings } = parseCSV(csv);
    expect(error).toBeNull();
    expect(warnings).toEqual([]);
    expect(operators).toHaveLength(2);
    expect(operators[0].name).toBe('Anna Lindgren');
    expect(operators[0].shift).toBe('S1');
    expect(operators[0].certifications).toEqual(['Avsyning', 'Serialisering']);
    expect(operators[1].name).toBe('Erik Holm');
    expect(operators[1].certifications).toEqual(['Kapselresaren']);
  });

  it('escapes names containing commas with quotes', () => {
    const withComma = [{ id: '1', name: 'Svensson, Anna', shift: 'S1', active: true, certifications: [] }];
    const out = exportOperatorsCSV(withComma);
    expect(out).toContain('"Svensson, Anna"');
    const { operators } = parseCSV(out);
    expect(operators[0].name).toBe('Svensson, Anna');
  });
});

describe('mergeOperators', () => {
  const existing = [
    { id: 'op1', name: 'Anna', shift: 'S1', active: true, certifications: ['Avsyning'] },
  ];

  it('adds new operators', () => {
    const imported = [{ name: 'Erik', shift: 'S2', certifications: ['Serialisering'] }];
    const { operators, added, updated } = mergeOperators(existing, imported);
    expect(added).toBe(1);
    expect(updated).toBe(0);
    expect(operators).toHaveLength(2);
    expect(operators[1].name).toBe('Erik');
    expect(operators[1].active).toBe(true);
  });

  it('updates existing operators by case-insensitive name match', () => {
    const imported = [{ name: 'anna', shift: 'S2', certifications: ['Serialisering'] }];
    const { operators, added, updated } = mergeOperators(existing, imported);
    expect(added).toBe(0);
    expect(updated).toBe(1);
    expect(operators).toHaveLength(1);
    expect(operators[0].shift).toBe('S2');
    expect(operators[0].certifications).toEqual(['Serialisering']);
  });

  it('preserves id and active status of existing operators', () => {
    const imported = [{ name: 'Anna', shift: 'S2', certifications: [] }];
    const { operators } = mergeOperators(existing, imported);
    expect(operators[0].id).toBe('op1');
  });
});
