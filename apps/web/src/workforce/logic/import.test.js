import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv';
import { previewPeopleImport, importOps } from './importPeople';
import { buildSample } from './sample';
import { levelsOf } from './model';
import { upcomingEvents, occursOn } from './events';
import { skillGaps, expiringCerts } from './training';
import { buildIndex } from './schedule';

describe('import', () => {
  it('reads Swedish Excel CSV (semicolons, quotes) and pasted cells (tabs)', () => {
    expect(parseCsv('﻿Namn;Lag\n"Berg, Ida";Red\n').rows).toEqual([{ Namn: 'Berg, Ida', Lag: 'Red' }]);
    expect(parseCsv('name\tteam\nIda\tBlue').rows).toEqual([{ name: 'Ida', team: 'Blue' }]);
  });
  it('previews people with validation and duplicate handling', () => {
    const wf = buildSample();
    const csv = 'Namn;Anställning;Lag;Inspection;Forklift licence;Shoe size\nNy Person;konsult;Red;Independent;2027-06-30;42\nAlva Almkvist;fast;;Trainer;ja;\n;fast;;;;\nNy Person;x;Nowhere;Expert;maybe;';
    const pv = previewPeopleImport(wf, levelsOf(wf), parseCsv(csv));
    expect(pv.ignored).toEqual(['Shoe size']);
    expect(pv.rows[0]).toMatchObject({ action: 'add', employment: 'consultant', teamId: 'red', skills: { insp: 'independent' }, certs: { truck: { expires: '2027-06-30' } } });
    expect(pv.rows[1]).toMatchObject({ action: 'update', match: { id: 'p01' } });
    expect(pv.rows[2].errors).toEqual(['noName']);
    expect(pv.rows[3].errors).toEqual(['duplicateInFile']);
    expect(pv.rows[3].warnings.length).toBe(4);
    const ops = importOps(wf, pv.rows, '2026-11-10');
    expect(ops.filter(o => o.col === 'people')).toHaveLength(2);
    expect(ops.find(o => o.col === 'qualifications' && o.id === 'p01').value.skills.insp).toBe('trainer');
    expect(ops.filter(o => o.col === 'memberships')).toHaveLength(1);
  });
});

describe('activities and training', () => {
  const wf = buildSample();
  it('repeats weekly and monthly without touching staffing', () => {
    expect(occursOn(wf.events.ev1, '2026-11-16')).toBe(true);
    expect(occursOn(wf.events.ev1, '2026-11-17')).toBe(false);
    expect(occursOn(wf.events.ev2, '2026-12-05')).toBe(true);
    expect(upcomingEvents(wf, '2026-11-02', 7).map(e => e.id)).toEqual(['ev1', 'ev2']);
  });
  it('finds thin spots and expiring certificates', () => {
    const gaps = skillGaps(wf, buildIndex(wf), '2026-11-10');
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps[0].margin).toBeLessThanOrEqual(gaps[gaps.length - 1].margin);
    expect(expiringCerts(wf, '2026-11-10', 30).every(c => c.expires === '2026-11-20')).toBe(true);
  });
});
