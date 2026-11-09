/* Who is scheduled to work when.
 *
 * - A pattern is a repeating cycle of shift types (null = day off) anchored
 *   to a date. Fixed shifts are a 7-day cycle; rotations are longer.
 * - A pattern is assigned to a team or to one person for a date range.
 *   Changing the future closes the old assignment and opens a new one, so
 *   the past keeps the schedule it actually had.
 * - A person belongs to a team for a date range (memberships).
 * - An override replaces one person's shift on one date.
 */
import { addDays, diffDays, shiftMinutes, realHours } from './time';
import { list, uid, settingsOf } from './model';

const activeOn = (e, date) => e.from <= date && (!e.to || date <= e.to);
const latestFirst = (a, b) => (a.from < b.from ? 1 : a.from > b.from ? -1 : 0);

/** Lookups built once per document; pass it to the functions below. */
export function buildIndex(wf) {
  const membershipsByPerson = new Map();
  for (const m of list(wf.memberships)) {
    if (m.status === 'pending') continue; // waits for a manager, not in force
    if (!membershipsByPerson.has(m.personId)) membershipsByPerson.set(m.personId, []);
    membershipsByPerson.get(m.personId).push(m);
  }
  const assignmentsByTarget = new Map();
  for (const a of list(wf.patternAssignments)) {
    const key = `${a.target}:${a.targetId}`;
    if (!assignmentsByTarget.has(key)) assignmentsByTarget.set(key, []);
    assignmentsByTarget.get(key).push(a);
  }
  for (const arr of membershipsByPerson.values()) arr.sort(latestFirst);
  for (const arr of assignmentsByTarget.values()) arr.sort(latestFirst);
  return { membershipsByPerson, assignmentsByTarget };
}

export function teamOf(idx, personId, date) {
  const m = (idx.membershipsByPerson.get(personId) || []).find(x => activeOn(x, date));
  return m ? m.teamId : null;
}

export function patternShiftOn(pattern, assignment, date) {
  if (!pattern || !pattern.cycle?.length) return null;
  const n = pattern.cycle.length;
  const i = (((diffDays(pattern.anchor, date) + (assignment.offset || 0)) % n) + n) % n;
  return pattern.cycle[i] || null;
}

/**
 * The shift a person is scheduled for on a date.
 * @returns {{ shiftTypeId: string|null, start?: string, end?: string, source: 'override'|'person'|'team'|null, teamId: string|null, note?: string }}
 */
export function resolveShift(wf, idx, personId, date) {
  const teamId = teamOf(idx, personId, date);
  const person = wf.people[personId];
  if (!person || (person.startDate && date < person.startDate) || (person.endDate && date > person.endDate)) {
    return { shiftTypeId: null, source: null, teamId };
  }
  const o = wf.overrides[`${personId}_${date}`];
  if (o) return { shiftTypeId: o.shiftTypeId || null, start: o.start, end: o.end, source: 'override', teamId, note: o.note };

  const own = (idx.assignmentsByTarget.get(`person:${personId}`) || []).find(a => activeOn(a, date));
  if (own) return { shiftTypeId: patternShiftOn(wf.patterns[own.patternId], own, date), source: 'person', teamId };
  if (teamId) {
    const viaTeam = (idx.assignmentsByTarget.get(`team:${teamId}`) || []).find(a => activeOn(a, date));
    if (viaTeam) return { shiftTypeId: patternShiftOn(wf.patterns[viaTeam.patternId], viaTeam, date), source: 'team', teamId };
  }
  return { shiftTypeId: null, source: null, teamId };
}

/** Start/end (minutes from the date's midnight) and real hours of a resolved shift. */
export function shiftTimes(wf, resolved, date) {
  const type = wf.shiftTypes[resolved.shiftTypeId];
  if (!type) return null;
  const { s, e } = shiftMinutes(resolved.start || type.start, resolved.end || type.end);
  const gross = realHours(date, s, e);
  const breakH = (type.breakMin || 0) / 60;
  return { startMin: s, endMin: e, grossHours: gross, paidHours: Math.max(0, gross - breakH), overnight: e > 1440, type };
}

/* ── Changes, returned as operations for the store ─────────────────────── */

const put = (col, value) => ({ op: 'put', col, id: value.id, value });
const del = (col, id) => ({ op: 'del', col, id });

/**
 * Give a team or person a pattern from `from` onward. Earlier dates keep the
 * assignment they had.
 */
export function assignPatternOps(wf, target, targetId, patternId, from, offset = 0) {
  const ops = [];
  for (const a of list(wf.patternAssignments)) {
    if (a.target !== target || a.targetId !== targetId) continue;
    if (a.from >= from) ops.push(del('patternAssignments', a.id));            // replaced future plan
    else if (!a.to || a.to >= from) ops.push(put('patternAssignments', { ...a, to: addDays(from, -1) }));
  }
  if (patternId) ops.push(put('patternAssignments', { id: uid('pa_'), target, targetId, patternId, from, to: null, offset }));
  return ops;
}

/**
 * Edit a pattern's cycle from a date onward: the old pattern stays for the
 * past, a new version takes over for everyone who follows it.
 */
export function editPatternFromOps(wf, patternId, changes, from) {
  const old = wf.patterns[patternId];
  const next = { ...old, ...changes, id: uid('pt_'), supersedes: patternId };
  const ops = [put('patterns', next)];
  for (const a of list(wf.patternAssignments)) {
    if (a.patternId !== patternId || (a.to && a.to < from)) continue;
    if (a.from >= from) ops.push(put('patternAssignments', { ...a, patternId: next.id }));
    else {
      ops.push(put('patternAssignments', { ...a, to: addDays(from, -1) }));
      ops.push(put('patternAssignments', { ...a, id: uid('pa_'), patternId: next.id, from }));
    }
  }
  return ops;
}

/** Change one person's shift on one date (shiftTypeId null = day off). */
export function overrideOps(personId, date, shiftTypeId, extra = {}) {
  return [put('overrides', { id: `${personId}_${date}`, personId, date, shiftTypeId: shiftTypeId || null, ...extra })];
}
export const clearOverrideOps = (personId, date) => [del('overrides', `${personId}_${date}`)];

/**
 * Move a person to a team from a date. Team leads' moves wait for a manager
 * when the setting says so.
 */
export function moveTeamOps(wf, personId, teamId, from, actorCanConfirm = true) {
  const pending = settingsOf(wf).requireMoveConfirmation && !actorCanConfirm;
  const next = { id: uid('ms_'), personId, teamId, from, to: null, status: pending ? 'pending' : 'confirmed' };
  if (pending) return [put('memberships', next)];
  return [...closeMembershipsOps(wf, personId, from), put('memberships', next)];
}
function closeMembershipsOps(wf, personId, from, exceptId) {
  const ops = [];
  for (const m of list(wf.memberships)) {
    if (m.personId !== personId || m.id === exceptId || m.status === 'pending') continue;
    if (m.from >= from) ops.push(del('memberships', m.id));
    else if (!m.to || m.to >= from) ops.push(put('memberships', { ...m, to: addDays(from, -1) }));
  }
  return ops;
}
export function confirmMoveOps(wf, membershipId) {
  const m = wf.memberships[membershipId];
  return [...closeMembershipsOps(wf, m.personId, m.from, m.id), put('memberships', { ...m, status: 'confirmed' })];
}

/** Which shift types run for a process on a date = those with a requirement. */
export function scheduledPeople(wf, idx, date, shiftTypeId) {
  const out = [];
  for (const p of list(wf.people)) {
    const r = resolveShift(wf, idx, p.id, date);
    if (r.shiftTypeId === shiftTypeId) out.push(p.id);
  }
  return out;
}
