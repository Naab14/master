/* Can a shift's staffing requirements be met?
 *
 * Four things stay separate (requirement K5):
 *   qualified  — level and valid certificates on the planned date
 *   available  — scheduled on the shift and not absent
 *   consumed   — a person fills ONE dedicated position; tasks take hours
 *   met        — the result of matching people to positions
 *
 * The result is what is *possible*, never who actually stands where: the
 * whiteboard decides that.
 */
import { weekday } from './time';
import { list, levelsOf, settingsOf } from './model';
import { resolveShift } from './schedule';

/** The requirement template in force on a date (latest matching range, else the default). */
export function templateFor(wf, date) {
  const ranges = list(wf.templateRanges)
    .filter(r => r.from <= date && date <= r.to)
    .sort((a, b) => (a.from < b.from ? 1 : -1));
  if (ranges.length && wf.templates[ranges[0].templateId]) return ranges[0].templateId;
  const def = list(wf.templates).find(t => t.isDefault) || list(wf.templates)[0];
  return def ? def.id : null;
}

/** Requirements for a date and shift, with day adjustments applied. */
export function requirementsFor(wf, date, shiftTypeId) {
  const templateId = templateFor(wf, date);
  const wd = weekday(date);
  return list(wf.requirements)
    .filter(r => r.templateId === templateId && r.shiftTypeId === shiftTypeId && (r.weekdays || [1, 2, 3, 4, 5]).includes(wd))
    .map(r => {
      const adj = wf.adjustments[`${r.id}_${date}`];
      return adj ? { ...r, count: adj.count, adjusted: true, baseCount: r.count } : r;
    })
    .filter(r => r.count > 0 || r.adjusted);
}

/** Shift types that have any requirement on a date: the operating schedule. */
export function runningShifts(wf, date, processId) {
  const templateId = templateFor(wf, date);
  const wd = weekday(date);
  const ids = new Set();
  for (const r of list(wf.requirements)) {
    if (r.templateId !== templateId || !(r.weekdays || [1, 2, 3, 4, 5]).includes(wd)) continue;
    if (processId && r.processId !== processId) continue;
    const adj = wf.adjustments[`${r.id}_${date}`];
    if ((adj ? adj.count : r.count) > 0) ids.add(r.shiftTypeId);
  }
  return [...ids];
}

export function certIssues(wf, personId, certIds, date) {
  const held = wf.qualifications[personId]?.certs || {};
  const issues = [];
  for (const id of certIds || []) {
    const c = held[id];
    if (!c) issues.push({ certId: id, problem: 'missing' });
    else if (c.expires && c.expires < date) issues.push({ certId: id, problem: 'expired', expires: c.expires });
  }
  return issues;
}

/**
 * How a person can count toward a requirement on a date.
 * @returns {'full'|'supervised'|null}
 */
export function qualification(wf, levels, personId, req, date) {
  if (certIssues(wf, personId, req.certIds, date).length) return null;
  if (!req.skillId) return 'full';
  const levelId = wf.qualifications[personId]?.skills?.[req.skillId];
  const level = levels.find(l => l.id === levelId);
  if (!level) return null;
  // No level asked for: the lowest level that counts on its own.
  const min = levels.find(l => l.id === req.minLevelId) || levels.find(l => l.counts === 'full') || levels[0];
  if (level.rank >= min.rank) return 'full';
  // Below the required level: the process (or the level) says whether a
  // trainee may count, and only under supervision unless set to 'full'.
  const rule = wf.processes[req.processId]?.trainee?.[level.id] ?? level.counts;
  if (rule === 'full') return 'full';
  if (rule === 'supervised') return 'supervised';
  return null;
}

export function canSupervise(wf, levels, personId, skillId) {
  const level = levels.find(l => l.id === wf.qualifications[personId]?.skills?.[skillId]);
  return !!level?.canSupervise;
}

/** People matching every skill (at a minimum level) and certificate asked for. */
export function matchPeople(wf, { skills = [], certs = [], date }) {
  const levels = levelsOf(wf);
  const rank = id => levels.find(l => l.id === id)?.rank ?? 0;
  return list(wf.people).filter(p => {
    const q = wf.qualifications[p.id] || {};
    return skills.every(s => rank(q.skills?.[s.skillId]) >= Math.max(1, rank(s.minLevelId)))
      && certIssues(wf, p.id, certs, date).length === 0;
  }).map(p => p.id);
}

/* Maximum bipartite matching (Kuhn). slots[i].candidates = person ids. Slots
 * earlier in the list are never given up for later ones. */
function matchSlots(slots, taken = new Map()) {
  const slotOf = new Map(taken); // personId -> slot index
  const personOf = new Array(slots.length).fill(null);
  for (const [p, i] of slotOf) personOf[i] = p;
  const tryFill = (i, seen) => {
    for (const p of slots[i].candidates) {
      if (seen.has(p)) continue;
      seen.add(p);
      const other = slotOf.get(p);
      if (other === undefined || tryFill(other, seen)) {
        slotOf.set(p, i);
        personOf[i] = p;
        return true;
      }
    }
    return false;
  };
  slots.forEach((slot, i) => { if (personOf[i] === null) tryFill(i, new Set()); });
  return personOf;
}

/**
 * Coverage for one shift on one date.
 * @param absences  [{ personId, date, hours|null, fullDay, tentative, reasonId }]
 * @param opts.without  Set of person ids to treat as away (what-if)
 */
export function computeCoverage(wf, idx, date, shiftTypeId, absences = [], opts = {}) {
  const levels = levelsOf(wf);
  const settings = settingsOf(wf);
  const without = opts.without || new Set();
  const away = new Map(); // personId -> { full, hours }
  for (const a of absences) {
    if (a.date !== date || a.tentative) continue;
    const cur = away.get(a.personId) || { full: false, hours: 0 };
    if (a.fullDay) cur.full = true; else cur.hours += a.hours || 0;
    cur.unknown = cur.unknown || (!a.fullDay && !a.hours);
    away.set(a.personId, cur);
  }

  const scheduled = [];
  for (const p of list(wf.people)) {
    if (resolveShift(wf, idx, p.id, date).shiftTypeId === shiftTypeId) scheduled.push(p.id);
  }
  const absent = scheduled.filter(id => away.get(id)?.full || without.has(id));
  const available = scheduled.filter(id => !absent.includes(id));
  const partial = new Map(available.filter(id => away.has(id)).map(id => [id, away.get(id)]));

  const reqs = requirementsFor(wf, date, shiftTypeId);
  const qual = new Map(); // `${reqId}|${personId}` -> 'full'|'supervised'
  const cands = (req, kind) => available.filter(p => {
    const k = `${req.id}|${p}`;
    if (!qual.has(k)) qual.set(k, qualification(wf, levels, p, req, date));
    return qual.get(k) === kind;
  });

  const results = reqs.map(req => ({
    req, required: req.count, filled: 0, people: [], supervised: [], competing: 0,
    qualified: cands(req, 'full'), trainees: cands(req, 'supervised'), notes: [],
  }));

  // 1. Dedicated positions first: one person, one position.
  const slots = [];
  results.forEach((r, ri) => {
    if (r.req.kind === 'dedicated' || !r.req.kind) for (let n = 0; n < r.required; n++) slots.push({ ri, candidates: r.qualified });
  });
  const dedicatedCount = slots.length;
  // 2. Then time-consuming tasks, filled by people still free.
  results.forEach((r, ri) => {
    if (r.req.kind === 'task') for (let n = 0; n < r.required; n++) slots.push({ ri, candidates: r.qualified });
  });
  const personOf = matchSlots(slots);
  const used = new Set();
  slots.forEach((slot, i) => {
    const p = personOf[i];
    const r = results[slot.ri];
    if (p) { r.filled++; r.people.push(p); used.add(p); }
    else if (i >= dedicatedCount && r.qualified.length) {
      // Only possible by taking someone off a line for a while.
      r.competing++;
    }
  });

  // 3. Trainees fill what is left on a process only next to a supervisor.
  const perSupervisor = settings.maxTraineesPerSupervisor ?? 1;
  for (const r of results) {
    if (r.req.kind === 'task' || r.req.kind === 'shared' || r.filled >= r.required) continue;
    const sameProcess = results.filter(x => x.req.processId === r.req.processId);
    const supervisors = sameProcess.flatMap(x => x.people).filter(p => canSupervise(wf, levels, p, r.req.skillId));
    const alreadySupervised = sameProcess.reduce((n, x) => n + x.supervised.length, 0);
    let room = supervisors.length * perSupervisor - alreadySupervised;
    for (const t of r.trainees) {
      if (r.filled >= r.required || room <= 0) break;
      if (used.has(t)) continue;
      r.filled++; r.supervised.push(t); used.add(t); room--;
    }
    if (r.filled < r.required && r.trainees.some(t => !used.has(t)) && room <= 0) r.notes.push('needsSupervisor');
  }

  // 4. Shared support roles may be combined with a line position.
  for (const r of results) {
    if (r.req.kind !== 'shared') continue;
    r.people = r.qualified.slice(0, r.required);
    r.filled = r.people.length;
    r.notes.push('shared');
  }

  for (const r of results) {
    const everyone = [...r.people, ...r.supervised];
    if (everyone.some(p => partial.has(p))) r.notes.push('partlyAway');
    if (r.supervised.length) r.notes.push('supervised');
    if (r.req.kind === 'task' && r.competing) r.notes.push(r.req.window ? 'competingFixed' : 'competingFlexible');
    const possible = r.filled + r.competing;
    r.status = r.filled >= r.required ? (r.notes.some(n => n === 'partlyAway' || n === 'supervised') ? 'risk' : 'met')
      : possible >= r.required ? 'risk' : 'short';
    // Certificates that would have helped
    r.certBlocked = available.filter(p => !r.qualified.includes(p) && !r.trainees.includes(p)
      && certIssues(wf, p, r.req.certIds, date).length
      && qualification(wf, levels, p, { ...r.req, certIds: [] }, date));
    if (r.status !== 'met' && r.certBlocked.length) r.notes.push('certIssue');
  }

  const spare = available.filter(p => !used.has(p));
  return {
    date, shiftTypeId, scheduled, available, absent, partial, spare, results,
    short: results.filter(r => r.status === 'short').length,
    risk: results.filter(r => r.status === 'risk').length,
    level: results.some(r => r.status === 'short') ? 'short' : results.some(r => r.status === 'risk') ? 'risk' : results.length ? 'met' : 'none',
  };
}

/**
 * What happens if a person is away on these dates: new gaps, who could step
 * in, and whether moving them opens a gap on their own shift.
 */
export function absenceImpact(wf, idx, personId, dates, absences = []) {
  const levels = levelsOf(wf);
  const days = [];
  for (const date of dates) {
    const shiftTypeId = resolveShift(wf, idx, personId, date).shiftTypeId;
    if (!shiftTypeId) continue;
    const before = computeCoverage(wf, idx, date, shiftTypeId, absences);
    const after = computeCoverage(wf, idx, date, shiftTypeId, absences, { without: new Set([personId]) });
    const rank = { met: 0, risk: 1, short: 2 };
    const isWorse = (b, a) => rank[a.status] > rank[b.status] || a.filled < b.filled;
    const worse = after.results.filter((r, i) => isWorse(before.results[i], r));
    const gaps = worse.map(r => {
      const replacements = [];
      for (const p of list(wf.people)) {
        if (p.id === personId || after.scheduled.includes(p.id)) continue;
        if (qualification(wf, levels, p.id, r.req, date) !== 'full') continue;
        if (absences.some(a => a.personId === p.id && a.date === date && a.fullDay && !a.tentative)) continue;
        const own = resolveShift(wf, idx, p.id, date).shiftTypeId;
        if (!own) { replacements.push({ personId: p.id, from: null, opensGap: false }); continue; }
        const theirsBefore = computeCoverage(wf, idx, date, own, absences);
        const theirsAfter = computeCoverage(wf, idx, date, own, absences, { without: new Set([p.id]) });
        const opens = theirsAfter.results.filter((x, i) => isWorse(theirsBefore.results[i], x)).map(x => x.req.id);
        replacements.push({ personId: p.id, from: own, opensGap: opens.length > 0, gapReqIds: opens });
      }
      replacements.sort((a, b) => Number(a.opensGap) - Number(b.opensGap));
      return { reqId: r.req.id, req: r.req, status: r.status, required: r.required, filled: r.filled, replacements };
    });
    days.push({ date, shiftTypeId, before: before.level, after: after.level, gaps });
  }
  return { days, gapDays: days.filter(d => d.gaps.length).length };
}
