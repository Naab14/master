/* A made-up plant for demos and tests: 40 operators, three shifts, four
 * processes with different operating schedules, a low season, expiring
 * certificates and trainees. All names are invented. */
import { emptyDoc, WORKFORCE_COLLECTIONS, DEFAULT_LEVELS, DEFAULT_REASONS, DEFAULT_SETTINGS } from './model';

const FIRST = ['Alva', 'Bo', 'Cleo', 'Dag', 'Ebba', 'Frej', 'Greta', 'Hugo', 'Idun', 'Jarl', 'Kaj', 'Lova', 'Malte', 'Nora', 'Olle', 'Pim', 'Rut', 'Sixten', 'Tyra', 'Ulf'];
const LAST = ['Almkvist', 'Bergfalk', 'Cederhav', 'Dalmyr', 'Ekstrand', 'Fjällros', 'Granlid', 'Hedvall'];
export const SAMPLE_ANCHOR = '2026-11-02'; // a Monday

export function buildSample() {
  const wf = emptyDoc(WORKFORCE_COLLECTIONS);
  const add = (col, e) => { wf[col][e.id] = e; return e; };

  add('shiftTypes', { id: 'day', name: 'Day', code: 'D', start: '06:00', end: '14:00', breakMin: 30, color: '#E5A23A', order: 1 });
  add('shiftTypes', { id: 'eve', name: 'Evening', code: 'E', start: '14:00', end: '22:00', breakMin: 30, color: '#3B6FD4', order: 2 });
  add('shiftTypes', { id: 'night', name: 'Night', code: 'N', start: '22:00', end: '06:00', breakMin: 30, color: '#7A4BC2', order: 3 });

  const week = t => [t, t, t, t, t, null, null];
  add('patterns', { id: 'rot3', name: '3-shift rotation', anchor: SAMPLE_ANCHOR, cycle: [...week('day'), ...week('eve'), ...week('night')] });
  add('patterns', { id: 'fixday', name: 'Fixed days', anchor: SAMPLE_ANCHOR, cycle: week('day') });

  const teams = [['red', 'Red', '#D2483C', 0], ['blue', 'Blue', '#3B6FD4', 7], ['green', 'Green', '#2F8A55', 14], ['days', 'Day team', '#8A6A00', 0]];
  for (const [id, name, color, offset] of teams) {
    add('teams', { id, name, color });
    add('patternAssignments', { id: `pa_${id}`, target: 'team', targetId: id, patternId: id === 'days' ? 'fixday' : 'rot3', from: '2026-01-05', to: null, offset });
  }

  const procs = [['insp', 'Inspection', '#C2412D'], ['caps', 'Capsuling', '#2563C9'], ['seri', 'Serialization', '#2F8A55'], ['labl', 'Labelling', '#7A4BC2']];
  for (const [id, name, color] of procs) {
    add('processes', { id, name, color });
    add('skills', { id, name, processId: id });
  }
  add('skills', { id: 'docs', name: 'Documentation control', processId: null });
  for (const l of DEFAULT_LEVELS) add('levels', l);
  for (const r of DEFAULT_REASONS) add('reasons', r);
  add('certs', { id: 'truck', name: 'Forklift licence', expires: true });
  add('certs', { id: 'gmp', name: 'GMP basics', expires: false });
  add('settings', { ...DEFAULT_SETTINGS });

  const skillIds = ['insp', 'caps', 'seri', 'labl'];
  for (let i = 0; i < 40; i++) {
    const id = `p${String(i + 1).padStart(2, '0')}`;
    const teamId = i < 36 ? ['red', 'blue', 'green'][i % 3] : 'days';
    const first = FIRST[i % FIRST.length];
    add('people', {
      id, name: `${first} ${LAST[(i * 3) % LAST.length]}`, nickname: i % 5 === 0 ? first.slice(0, 3) : '',
      employment: i % 4 === 3 ? 'consultant' : 'permanent', color: teams.find(t => t[0] === teamId)[2], notes: '',
    });
    add('memberships', { id: `ms_${id}`, personId: id, teamId, from: '2026-01-05', to: null, status: 'confirmed' });
    const skills = {};
    const n = 1 + (i % 3);                       // 1–3 skills each
    const k = Math.floor(i / 3);                 // same within a team trio
    for (let j = 0; j < n; j++) skills[skillIds[(k + j) % 4]] = j === 0 ? (k % 4 === 0 ? 'trainer' : 'independent') : (j === 2 ? 'supervised' : 'independent');
    if (k % 3 === 0) skills.docs = 'independent';
    if (i >= 33 && i < 36) { for (const s of Object.keys(skills)) delete skills[s]; skills.insp = 'supervised'; } // newest hires: trainees
    const certs = { gmp: { expires: null } };
    if (i % 4 === 0) certs.truck = { expires: i % 8 === 0 ? '2026-11-20' : '2027-09-30' };
    add('qualifications', { id, skills, certs });
  }

  add('templates', { id: 'normal', name: 'Normal', isDefault: true });
  add('templates', { id: 'low', name: 'Low season', isDefault: false });
  add('templateRanges', { id: 'tr_low', templateId: 'low', from: '2026-12-21', to: '2027-01-10' });
  const wd = [1, 2, 3, 4, 5];
  const req = (templateId, processId, shiftTypeId, count, extra = {}) => add('requirements', {
    id: `rq_${templateId}_${extra.skillId || processId}_${shiftTypeId}${extra.kind ? '_' + extra.kind : ''}`,
    templateId, processId, shiftTypeId, weekdays: wd, kind: 'dedicated', count, skillId: processId, minLevelId: 'independent', certIds: [], window: null, hours: null, ...extra,
  });
  // Normal: each process has its own operating schedule.
  for (const s of ['day', 'eve', 'night']) req('normal', 'insp', s, 2);
  for (const s of ['day', 'eve']) req('normal', 'caps', s, 2);
  for (const s of ['day', 'eve', 'night']) req('normal', 'seri', s, s === 'night' ? 1 : 2);
  req('normal', 'labl', 'day', 2);
  for (const s of ['day', 'eve']) req('normal', null, s, 1, { kind: 'task', skillId: 'docs', hours: 1, label: 'Documentation control' });
  for (const s of ['day', 'eve', 'night']) req('normal', null, s, 1, { kind: 'shared', skillId: null, minLevelId: null, certIds: ['truck'], label: 'Forklift on call' });
  // Low season: fewer shifts and people.
  for (const s of ['day', 'eve']) req('low', 'insp', s, 1);
  req('low', 'caps', 'day', 1);
  req('low', 'seri', 'day', 1);
  req('low', 'labl', 'day', 1);
  req('low', null, 'day', 1, { kind: 'task', skillId: 'docs', hours: 1, label: 'Documentation control' });

  add('events', { id: 'ev1', title: 'Tier 2 meeting', date: SAMPLE_ANCHOR, time: '09:00', repeat: 'weekly' });
  add('events', { id: 'ev2', title: 'Safety walk', date: '2026-11-05', time: '13:00', repeat: 'monthly' });
  return wf;
}
