/* Attendance deviations and OB, against the regular schedule as baseline.
 *
 * Nothing here approves time or calculates pay. It prepares a monthly review.
 * Rule A3: a comment alone never becomes a duration; an entry that needs a
 * duration and has none is reported as incomplete.
 */
import { addDays, dateRange, endOfMonth, realHours, round2, shiftMinutes, toMinutes, weekday, zonedToUtc } from './time';
import { list, reasonsOf } from './model';
import { resolveShift, shiftTimes } from './schedule';

const H = 3600000;

/** What an entry means in time. */
export function entryTime(entry, reason, shift, date) {
  const cat = reason?.category || 'absence';
  if (cat === 'present') return { kind: 'none' };
  const hasTimes = !!(entry.start && entry.end);
  const hasHours = typeof entry.hours === 'number' && entry.hours > 0;
  if (hasTimes) {
    let { s, e } = shiftMinutes(entry.start, entry.end);
    // Times after midnight on an overnight shift belong to its second day.
    if (shift?.overnight && cat !== 'overtime' && s < shift.startMin && s + 1440 < shift.endMin) { s += 1440; e += 1440; }
    return { kind: 'interval', startMin: s, endMin: e, hours: realHours(date, s, e) };
  }
  if (hasHours) {
    // A late arrival is the first part of the shift, so it can be placed.
    if (cat === 'late' && shift) return { kind: 'interval', startMin: shift.startMin, endMin: shift.startMin + entry.hours * 60, hours: entry.hours };
    return { kind: 'hours', hours: entry.hours };
  }
  if (entry.fullDay && cat !== 'late' && cat !== 'overtime') {
    return shift ? { kind: 'full', hours: shift.paidHours } : { kind: 'full', hours: 0 };
  }
  return { kind: 'incomplete' };
}

/** Absences in the shape coverage wants, from attendance entries. */
export function absencesFromEntries(wf, entries) {
  const reasons = Object.fromEntries(reasonsOf(wf).map(r => [r.id, r]));
  const out = [];
  for (const e of entries) {
    const cat = reasons[e.reasonId]?.category;
    if (!['sick', 'vacation', 'absence', 'late'].includes(cat)) continue;
    const timed = !!(e.start && e.end);
    const hours = timed ? (shiftMinutes(e.start, e.end).e - shiftMinutes(e.start, e.end).s) / 60 : e.hours || null;
    out.push({ personId: e.personId, date: e.date, fullDay: !!e.fullDay && !hours, hours, start: timed ? e.start : null, end: timed ? e.end : null, reasonId: e.reasonId, category: cat, tentative: !!e.tentative });
  }
  return out;
}

/**
 * OB hours for worked intervals.
 * @param intervals [{ a, b }] UTC ms
 * @param rules [{ id, days: [1..7], holidays: bool, start, end, priority, from?, to? }]
 * @param holidays Set of 'YYYY-MM-DD'
 * Where rules overlap, the highest priority takes the time (no double count).
 */
export function obHours(intervals, rules, holidays = new Set(), utcToDate) {
  const totals = {};
  for (const { a, b } of intervals) {
    if (!(b > a)) continue;
    const firstDay = addDays(utcToDate(a), -1);
    const lastDay = utcToDate(b);
    const windows = [];
    for (const rule of rules) {
      const { s, e } = shiftMinutes(rule.start, rule.end === '24:00' ? '00:00' : rule.end);
      for (const day of dateRange(firstDay, lastDay)) {
        if ((rule.from && day < rule.from) || (rule.to && day > rule.to)) continue;
        const isHoliday = holidays.has(day);
        const dayMatch = (rule.days || []).includes(weekday(day)) && !(rule.notOnHolidays && isHoliday);
        if (!dayMatch && !(rule.holidays && isHoliday)) continue;
        const wa = Math.max(a, zonedToUtc(day, s));
        const wb = Math.min(b, zonedToUtc(day, e));
        if (wb > wa) windows.push({ a: wa, b: wb, rule });
      }
    }
    const cuts = [...new Set(windows.flatMap(w => [w.a, w.b]))].sort((x, y) => x - y);
    for (let i = 0; i < cuts.length - 1; i++) {
      const mid = (cuts[i] + cuts[i + 1]) / 2;
      const best = windows.filter(w => w.a <= mid && mid < w.b)
        .sort((x, y) => (y.rule.priority || 0) - (x.rule.priority || 0))[0];
      if (best) totals[best.rule.id] = (totals[best.rule.id] || 0) + (cuts[i + 1] - cuts[i]) / H;
    }
  }
  for (const k of Object.keys(totals)) totals[k] = round2(totals[k]);
  return totals;
}

function subtract(intervals, cut) {
  const out = [];
  for (const iv of intervals) {
    if (cut.b <= iv.a || cut.a >= iv.b) { out.push(iv); continue; }
    if (cut.a > iv.a) out.push({ a: iv.a, b: cut.a });
    if (cut.b < iv.b) out.push({ a: cut.b, b: iv.b });
  }
  return out;
}

/**
 * One person's month against their schedule.
 * @param month 'YYYY-MM'
 */
export function personMonth(wf, idx, entries, personId, month, { holidays = new Set(), utcToDate } = {}) {
  const reasons = Object.fromEntries(reasonsOf(wf).map(r => [r.id, r]));
  const rules = list(wf.obRules).filter(r => r.active !== false);
  const from = `${month}-01`;
  const to = endOfMonth(from);
  const byDate = new Map();
  for (const e of entries) {
    if (e.personId !== personId || e.date < from || e.date > to || e.tentative) continue;
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  }

  const totals = { scheduledShifts: 0, scheduledHours: 0, workedHours: 0, overtimeHours: 0, lateCount: 0, lateHours: 0,
    sick: { days: 0, hours: 0 }, vacation: { days: 0, hours: 0 }, absence: { days: 0, hours: 0 }, byReason: {} };
  const days = [];
  const flags = [];
  const worked = [];
  let obUncertain = false;

  for (const date of dateRange(from, to)) {
    const resolved = resolveShift(wf, idx, personId, date);
    const shift = resolved.shiftTypeId ? shiftTimes(wf, resolved, date) : null;
    const dayEntries = byDate.get(date) || [];
    if (!shift && !dayEntries.length) continue;
    let intervals = shift ? [{ a: zonedToUtc(date, shift.startMin), b: zonedToUtc(date, shift.endMin) }] : [];
    let workedH = shift ? shift.paidHours : 0;
    if (shift) { totals.scheduledShifts++; totals.scheduledHours += shift.paidHours; }
    const lines = [];

    for (const e of dayEntries) {
      const reason = reasons[e.reasonId];
      const cat = reason?.category || 'absence';
      const t = entryTime(e, reason, shift, date);
      const line = { entry: e, reason, category: cat, time: t };
      lines.push(line);
      if (t.kind === 'none') continue;
      if (t.kind === 'incomplete') {
        flags.push({ date, entryId: e.id, problem: 'incomplete' });
        continue;
      }
      const bucket = totals.byReason[e.reasonId] || (totals.byReason[e.reasonId] = { days: 0, hours: 0, count: 0 });
      bucket.count++;
      if (cat === 'overtime') {
        totals.overtimeHours += t.hours; bucket.hours += t.hours; workedH += t.hours;
        if (t.kind === 'interval') intervals.push({ a: zonedToUtc(date, t.startMin), b: zonedToUtc(date, t.endMin) });
        else { obUncertain = true; flags.push({ date, entryId: e.id, problem: 'obNeedsTimes' }); }
        continue;
      }
      if (!shift) { flags.push({ date, entryId: e.id, problem: 'notScheduled' }); continue; }
      const hours = Math.min(t.hours, shift.paidHours);
      bucket.hours += hours; workedH -= hours;
      if (cat === 'late') { totals.lateCount++; totals.lateHours += hours; }
      else {
        const group = totals[cat] || totals.absence;
        group.hours += hours;
        if (t.kind === 'full') { group.days++; bucket.days++; }
      }
      if (t.kind === 'full') intervals = [];
      else if (t.kind === 'interval') intervals = subtract(intervals, { a: zonedToUtc(date, t.startMin), b: zonedToUtc(date, t.endMin) });
      else if (intervals.length && rules.length) { obUncertain = true; flags.push({ date, entryId: e.id, problem: 'obNeedsTimes' }); }
    }
    workedH = Math.max(0, workedH);
    totals.workedHours += workedH;
    worked.push(...intervals);
    const dayOb = rules.length ? obHours(intervals, rules, holidays, utcToDate) : {};
    days.push({ date, shift, resolved, lines, workedHours: round2(workedH), ob: dayOb, deviation: dayEntries.some(e => reasons[e.reasonId]?.category !== 'present') });
  }

  const ob = rules.length ? obHours(worked, rules, holidays, utcToDate) : {};
  for (const k of ['scheduledHours', 'workedHours', 'overtimeHours', 'lateHours']) totals[k] = round2(totals[k]);
  for (const k of ['sick', 'vacation', 'absence']) totals[k].hours = round2(totals[k].hours);
  for (const b of Object.values(totals.byReason)) b.hours = round2(b.hours);
  const comments = days.flatMap(d => d.lines.filter(l => l.entry.comment).map(l => ({ date: d.date, reasonId: l.entry.reasonId, comment: l.entry.comment })));
  return { personId, month, days, totals, ob, obUncertain, flags, comments, deviations: days.filter(d => d.deviation).length };
}

/** Parse OB rules from spreadsheet rows for review (nothing is saved here). */
export function parseObRows(rows) {
  const dayNames = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7, 'mån': 1, tis: 2, ons: 3, tor: 4, fre: 5, 'lör': 6, 'sön': 7 };
  return rows.map((row, i) => {
    const get = (...keys) => { for (const k of Object.keys(row)) if (keys.includes(k.trim().toLowerCase())) return String(row[k] ?? '').trim(); return ''; };
    const errors = [];
    const name = get('name', 'namn', 'rule', 'regel');
    const daysRaw = get('days', 'dagar');
    const days = [];
    let holidays = false;
    for (const part of daysRaw.toLowerCase().split(/[\s,;]+/).filter(Boolean)) {
      if (/^(holiday|holidays|helgdag|helgdagar|röd)$/.test(part)) { holidays = true; continue; }
      const m = /^([a-zåäö]{3})[a-zåäö]*(?:-([a-zåäö]{3})[a-zåäö]*)?$/.exec(part);
      const a = m && dayNames[m[1]];
      const b = m && m[2] ? dayNames[m[2]] : a;
      if (!a || !b) { errors.push(`days: "${part}"`); continue; }
      for (let d = a; ; d = (d % 7) + 1) { days.push(d); if (d === b) break; }
    }
    const start = get('start', 'from', 'från');
    const end = get('end', 'to', 'till', 'slut');
    const okTime = t => /^\d{1,2}:\d{2}$/.test(t) && toMinutes(t) <= 1440;
    if (!name) errors.push('name');
    if (!okTime(start)) errors.push('start');
    if (!okTime(end)) errors.push('end');
    if (!days.length && !holidays) errors.push('days');
    return {
      row: i + 2, errors,
      rule: { name, days: [...new Set(days)], holidays, start: start.padStart(5, '0'), end: end.padStart(5, '0'), rate: get('rate', 'ersättning', 'belopp'), priority: Number(get('priority', 'prioritet')) || 0 },
    };
  });
}
