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
import { shiftMinutes, toMinutes, weekday } from './time';
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
function matchSlots(slots) {
  const slotOf = new Map(); // personId -> slot index
  const personOf = new Array(slots.length).fill(null);
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

/** A clock time as minutes from the shift date's midnight (past 1440 on the second day of a night shift). */
function inShift(hhmm, shift) {
  let m = toMinutes(hhmm);
  if (shift.endMin > 1440 && m < shift.startMin) m += 1440;
  return m;
}
/** The part of the shift a requirement applies to: its window, or the whole shift. */
function reqSpan(req, shift) {
  if (!req.window?.start || !req.window?.end) return [shift.startMin, shift.endMin];
  const a = Math.max(shift.startMin, inShift(req.window.start, shift));
  let b = inShift(req.window.end, shift);
  if (b <= a) b += 1440;
  return [a, Math.min(shift.endMin, b)];
}
const isFlexibleTask = req => req.kind === 'task' && !(req.window?.start && req.window?.end);

/**
 * Time booked for training on a date: trainee and trainer are both off the
 * line then. Only trainings with set times reserve anything.
 */
export function trainingBusy(wf, date) {
  const out = [];
  const wd = weekday(date);
  for (const t of list(wf.trainings)) {
    const r = t.reserve;
    if (!r?.start || !r?.end || t.status === 'done') continue;
    if ((t.from && date < t.from) || (t.to && date > t.to)) continue;
    if (!(r.weekdays || [1, 2, 3, 4, 5]).includes(wd)) continue;
    for (const personId of [t.personId, t.trainerId]) if (personId) out.push({ personId, start: r.start, end: r.end, kind: 'training', trainingId: t.id });
  }
  return out;
}

/**
 * The most people with one competency needed at the same moment on one shift:
 * requirements that overlap in time are added up, ones that follow each
 * other are not. Flexible tasks have no known time, so they are added on top.
 */
export function peakDemand(reqs, shift) {
  const timed = reqs.filter(r => !isFlexibleTask(r) && r.kind !== 'shared').map(r => ({ r, span: reqSpan(r, shift) })).filter(x => x.span[1] > x.span[0]);
  const cuts = [...new Set(timed.flatMap(x => x.span))].sort((x, y) => x - y);
  let peak = 0;
  for (let i = 0; i < cuts.length - 1; i++) {
    const mid = (cuts[i] + cuts[i + 1]) / 2;
    peak = Math.max(peak, timed.filter(x => x.span[0] <= mid && mid < x.span[1]).reduce((n, x) => n + x.r.count, 0));
  }
  return peak + reqs.filter(isFlexibleTask).reduce((n, r) => n + r.count, 0);
}

/**
 * Coverage for one shift on one date.
 *
 * The shift is cut into stretches wherever something changes (a requirement's
 * time window, a part-day absence with known times, booked training). Each
 * stretch is matched on its own, so a person can cover one position in the
 * morning and another in the afternoon, but never two at once. A requirement
 * is met only if it can be filled in every stretch it applies to.
 *
 * @param absences  [{ personId, date, fullDay, hours, start, end, tentative }]
 * @param opts.without  Set of person ids to treat as away (what-if)
 */
export function computeCoverage(wf, idx, date, shiftTypeId, absences = [], opts = {}) {
  const levels = levelsOf(wf);
  const settings = settingsOf(wf);
  const without = opts.without || new Set();
  const type = wf.shiftTypes[shiftTypeId];
  const { s: startMin, e: endMin } = type ? shiftMinutes(type.start, type.end) : { s: 0, e: 0 };
  const shift = { startMin, endMin };

  // Who is away: the whole shift, a known part of it, or an unknown part.
  const fullAway = new Set();
  const busy = new Map();     // personId -> [{ a, b, kind }]
  const unknownPart = new Map(); // personId -> hours away with no times given
  const addBusy = (personId, start, end, kind) => {
    const a = Math.max(startMin, inShift(start, shift));
    let b = inShift(end, shift);
    if (b <= a) b += 1440;
    b = Math.min(endMin, b);
    if (b > a) busy.set(personId, [...(busy.get(personId) || []), { a, b, kind }]);
  };
  for (const x of absences) {
    if (x.date !== date || x.tentative) continue;
    if (x.fullDay) fullAway.add(x.personId);
    else if (x.start && x.end) addBusy(x.personId, x.start, x.end, 'absence');
    else unknownPart.set(x.personId, (unknownPart.get(x.personId) || 0) + (x.hours || 0));
  }
  for (const t of trainingBusy(wf, date)) addBusy(t.personId, t.start, t.end, 'training');

  const scheduled = [];
  for (const p of list(wf.people)) {
    if (resolveShift(wf, idx, p.id, date).shiftTypeId === shiftTypeId) scheduled.push(p.id);
  }
  const absent = scheduled.filter(id => fullAway.has(id) || without.has(id));
  const available = scheduled.filter(id => !absent.includes(id));
  const partial = new Map(available.filter(id => busy.has(id) || unknownPart.has(id))
    .map(id => [id, { hours: unknownPart.get(id) || 0, unknown: unknownPart.has(id), windows: busy.get(id) || [] }]));

  const reqs = requirementsFor(wf, date, shiftTypeId);
  const qual = new Map(); // `${reqId}|${personId}` -> 'full'|'supervised'|null
  const q = (req, p) => {
    const k = `${req.id}|${p}`;
    if (!qual.has(k)) qual.set(k, qualification(wf, levels, p, req, date));
    return qual.get(k);
  };

  const results = reqs.map(req => ({
    req, required: req.count, filled: 0, people: [], supervised: [], competing: 0, notes: [], gaps: [], gapHours: 0,
    // Three different things, kept apart:
    qualifiedScheduled: scheduled.filter(p => q(req, p) === 'full'),  // can do it and is on this shift
    qualified: available.filter(p => q(req, p) === 'full'),           // … and is not away
    trainees: available.filter(p => q(req, p) === 'supervised'),
    span: reqSpan(req, shift),
  }));

  // Cut the shift where anything changes.
  const cutSet = new Set([startMin, endMin]);
  for (const r of results) if (!isFlexibleTask(r.req)) r.span.forEach(m => cutSet.add(m));
  for (const id of available) for (const w of busy.get(id) || []) { cutSet.add(w.a); cutSet.add(w.b); }
  const cuts = [...cutSet].filter(m => m >= startMin && m <= endMin).sort((x, y) => x - y);
  const perSupervisor = settings.maxTraineesPerSupervisor ?? 1;
  const freeMinutes = new Map(available.map(id => [id, 0]));
  const everUsed = new Set();
  const segs = [];

  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i]; const b = cuts[i + 1];
    const mid = (a + b) / 2;
    const here = id => !(busy.get(id) || []).some(w => w.a <= mid && mid < w.b);
    const active = results.map((r, ri) => ({ r, ri })).filter(({ r }) => !isFlexibleTask(r.req) && r.span[0] <= mid && mid < r.span[1]);

    // 1. Dedicated positions first, then fixed-time tasks: one person, one place.
    const slots = [];
    for (const { r, ri } of active) if (r.req.kind === 'dedicated' || !r.req.kind) for (let n = 0; n < r.required; n++) slots.push({ ri, candidates: r.qualified.filter(here) });
    const dedicated = slots.length;
    for (const { r, ri } of active) if (r.req.kind === 'task') for (let n = 0; n < r.required; n++) slots.push({ ri, candidates: r.qualified.filter(here) });
    const personOf = matchSlots(slots);
    const seg = new Map(active.map(({ ri }) => [ri, { filled: 0, people: [], supervised: [], competing: 0, needsSupervisor: false }]));
    const used = new Set();
    slots.forEach((slot, k) => {
      const p = personOf[k];
      const st = seg.get(slot.ri);
      if (p) { st.filled++; st.people.push(p); used.add(p); }
      else if (k >= dedicated && slot.candidates.length) st.competing++; // only by taking someone off a line
    });

    // 2. Trainees fill what is left on a process only next to a supervisor.
    for (const { r, ri } of active) {
      const st = seg.get(ri);
      if (r.req.kind === 'task' || r.req.kind === 'shared' || st.filled >= r.required) continue;
      const same = active.filter(x => x.r.req.processId === r.req.processId);
      const supervisors = same.flatMap(x => seg.get(x.ri).people).filter(p => canSupervise(wf, levels, p, r.req.skillId));
      let room = supervisors.length * perSupervisor - same.reduce((n, x) => n + seg.get(x.ri).supervised.length, 0);
      const waiting = r.trainees.filter(t => here(t) && !used.has(t));
      for (const t of waiting) {
        if (st.filled >= r.required || room <= 0) break;
        st.filled++; st.supervised.push(t); used.add(t); room--;
      }
      if (st.filled < r.required && waiting.some(t => !used.has(t))) st.needsSupervisor = true;
    }

    // 3. Shared support roles may be combined with a line position.
    for (const { r, ri } of active) {
      if (r.req.kind !== 'shared') continue;
      const st = seg.get(ri);
      st.people = r.qualified.filter(here).slice(0, r.required);
      st.filled = st.people.length;
    }

    for (const id of available) if (here(id) && !used.has(id)) freeMinutes.set(id, freeMinutes.get(id) + (b - a));
    used.forEach(id => everUsed.add(id));
    segs.push({ a, b, seg });
  }

  // Fold the stretches into one answer per requirement: the worst stretch decides.
  results.forEach((r, ri) => {
    if (isFlexibleTask(r.req)) return;
    let worst = null;
    for (const { a, b, seg } of segs) {
      const st = seg.get(ri);
      if (!st) continue;
      const possible = st.filled + st.competing;
      if (!worst || possible < worst.possible || (possible === worst.possible && st.filled < worst.st.filled)) worst = { st, possible };
      if (st.filled < r.required) {
        const missing = r.required - st.filled;
        const last = r.gaps[r.gaps.length - 1];
        if (last && last.endMin === a && last.missing === missing) last.endMin = b; else r.gaps.push({ startMin: a, endMin: b, missing });
        r.gapHours += (missing * (b - a)) / 60;
      }
      if (st.needsSupervisor && !r.notes.includes('needsSupervisor')) r.notes.push('needsSupervisor');
    }
    if (worst) {
      r.filled = worst.st.filled; r.people = worst.st.people; r.supervised = worst.st.supervised; r.competing = worst.st.competing;
    }
    // Short for only part of the time it applies to.
    if (r.gaps.length && r.gaps.reduce((n, g) => n + g.endMin - g.startMin, 0) < r.span[1] - r.span[0]) r.notes.push('partTime');
  });

  // Flexible tasks: someone qualified with enough time not spent on a line.
  const taken = new Set();
  for (const r of results) {
    if (!isFlexibleTask(r.req)) continue;
    const need = (r.req.hours || 0) * 60;
    for (let n = 0; n < r.required; n++) {
      const free = r.qualified.filter(p => !taken.has(p) && freeMinutes.get(p) >= Math.max(need, 1))
        .sort((x, y) => Number(everUsed.has(x)) - Number(everUsed.has(y)))[0];
      if (free) { r.filled++; r.people.push(free); taken.add(free); freeMinutes.set(free, freeMinutes.get(free) - need); }
      else if (r.qualified.length) r.competing++;
    }
  }

  for (const r of results) {
    if (r.req.kind === 'shared') r.notes.push('shared');
    const everyone = [...r.people, ...r.supervised];
    if (everyone.some(p => unknownPart.has(p))) r.notes.push('partlyAway');
    if (r.supervised.length) r.notes.push('supervised');
    if (r.req.kind === 'task' && r.competing) r.notes.push(isFlexibleTask(r.req) ? 'competingFlexible' : 'competingFixed');
    const possible = r.filled + r.competing;
    r.status = r.filled >= r.required ? (r.notes.some(n => n === 'partlyAway' || n === 'supervised') ? 'risk' : 'met')
      : possible >= r.required ? 'risk' : 'short';
    r.gapHours = Math.round(r.gapHours * 100) / 100;
    // Certificates that would have helped
    r.certBlocked = available.filter(p => !r.qualified.includes(p) && !r.trainees.includes(p)
      && certIssues(wf, p, r.req.certIds, date).length
      && qualification(wf, levels, p, { ...r.req, certIds: [] }, date));
    if (r.status !== 'met' && r.certBlocked.length) r.notes.push('certIssue');
  }

  const spare = available.filter(p => !everUsed.has(p) && !taken.has(p));
  return {
    date, shiftTypeId, shift, scheduled, available, absent, partial, spare, results, segments: segs.length,
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
