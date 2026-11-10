/* Turn spreadsheet rows into people, for a preview before anything is saved.
 * Recognised columns (English or Swedish): name, nickname, employment, team,
 * plus one column per competency (value = a level) and per certificate
 * (value = yes or an expiry date). */
import { list, uid } from './model';

const norm = s => String(s ?? '').trim().toLowerCase();
const COLS = {
  name: ['name', 'namn', 'full name', 'operator', 'operatör'],
  nickname: ['nickname', 'smeknamn', 'alias'],
  employment: ['employment', 'anställning', 'anställningsform', 'type', 'typ'],
  team: ['team', 'lag', 'skiftlag', 'shift', 'skift'],
};
const EMPLOYMENT = { consultant: 'consultant', konsult: 'consultant', bemanning: 'consultant', permanent: 'permanent', fast: 'permanent', anställd: 'permanent', employee: 'permanent', tillsvidare: 'permanent' };

export function previewPeopleImport(wf, levels, { headers, rows }) {
  const colFor = key => headers.find(h => COLS[key].includes(norm(h)));
  const nameCol = colFor('name');
  const skillCols = headers.map(h => [h, list(wf.skills).find(s => norm(s.name) === norm(h))]).filter(x => x[1]);
  const certCols = headers.map(h => [h, list(wf.certs).find(c => norm(c.name) === norm(h))]).filter(x => x[1]);
  const known = new Set([...Object.keys(COLS).map(colFor), ...skillCols.map(x => x[0]), ...certCols.map(x => x[0])].filter(Boolean));
  const ignored = headers.filter(h => !known.has(h));
  const existing = new Map(list(wf.people).map(p => [norm(p.name), p]));
  const seen = new Set();
  const levelOf = v => levels.find(l => [l.id, l.name?.en, l.name?.sv, l.name, String(l.rank)].some(n => norm(n) === norm(v)));

  const out = rows.map((row, i) => {
    const errors = [];
    const warnings = [];
    const name = String(row[nameCol] ?? '').trim();
    if (!nameCol) errors.push('noNameColumn');
    else if (!name) errors.push('noName');
    const key = norm(name);
    const match = existing.get(key);
    if (name && seen.has(key)) errors.push('duplicateInFile');
    seen.add(key);
    const empRaw = norm(row[colFor('employment')]);
    const employment = EMPLOYMENT[empRaw] || (empRaw ? null : undefined);
    if (employment === null) warnings.push(`employment: “${row[colFor('employment')]}”`);
    const teamRaw = String(row[colFor('team')] ?? '').trim();
    const team = teamRaw ? list(wf.teams).find(t => norm(t.name) === norm(teamRaw)) : null;
    if (teamRaw && !team) warnings.push(`team: “${teamRaw}”`);
    const skills = {};
    for (const [h, skill] of skillCols) {
      const v = String(row[h] ?? '').trim();
      if (!v) continue;
      const level = levelOf(v);
      if (level) skills[skill.id] = level.id; else warnings.push(`${h}: “${v}”`);
    }
    const certs = {};
    for (const [h, cert] of certCols) {
      const v = String(row[h] ?? '').trim();
      if (!v || /^(no|nej|-|0)$/i.test(v)) continue;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) certs[cert.id] = { expires: v };
      else if (/^(yes|ja|x|1|true)$/i.test(v)) certs[cert.id] = { expires: null };
      else warnings.push(`${h}: “${v}”`);
    }
    return { row: i + 2, name, nickname: String(row[colFor('nickname')] ?? '').trim(), employment: employment || undefined, teamId: team?.id, skills, certs, match, errors, warnings, action: errors.length ? 'skip' : match ? 'update' : 'add' };
  });
  return { rows: out, ignored, skillCols: skillCols.map(x => x[1].name), certCols: certCols.map(x => x[1].name) };
}

/** Operations for the rows the user chose to add or update. */
export function importOps(wf, rows, from) {
  const ops = [];
  for (const r of rows) {
    if (r.action === 'skip' || r.errors.length) continue;
    const id = r.action === 'update' && r.match ? r.match.id : uid('p_');
    const base = r.action === 'update' && r.match ? r.match : { id, name: r.name, nickname: '', employment: 'permanent', notes: '' };
    ops.push({ op: 'put', col: 'people', id, value: { ...base, name: r.name, ...(r.nickname ? { nickname: r.nickname } : {}), ...(r.employment ? { employment: r.employment } : {}) } });
    if (Object.keys(r.skills).length || Object.keys(r.certs).length) {
      const q = wf.qualifications[id] || { id, skills: {}, certs: {} };
      ops.push({ op: 'put', col: 'qualifications', id, value: { ...q, id, skills: { ...q.skills, ...r.skills }, certs: { ...q.certs, ...r.certs } } });
    }
    if (r.teamId && !(r.match && list(wf.memberships).some(m => m.personId === id && m.teamId === r.teamId && !m.to))) {
      ops.push({ op: 'put', col: 'memberships', id: `ms_${id}_${from}`, value: { id: `ms_${id}_${from}`, personId: id, teamId: r.teamId, from, to: null, status: 'confirmed' } });
    }
  }
  return ops;
}
