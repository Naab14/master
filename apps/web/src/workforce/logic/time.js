/* Calendar dates and Swedish local time.
 *
 * A date is a 'YYYY-MM-DD' string and a time of day is minutes from local
 * midnight (may pass 1440 for the part of an overnight shift that falls on
 * the next day). Real durations go through zonedToUtc(), so a night shift
 * over a daylight-saving change is 7 or 9 hours, not a nominal 8.
 */

export const TZ = 'Europe/Stockholm';
const DAY = 86400000;

export const parseDate = s => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const fmtDate = ms => new Date(ms).toISOString().slice(0, 10);
export const addDays = (s, n) => fmtDate(parseDate(s) + n * DAY);
export const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / DAY);
/** 1 = Monday … 7 = Sunday */
export const weekday = s => ((new Date(parseDate(s)).getUTCDay() + 6) % 7) + 1;
export const startOfWeek = s => addDays(s, 1 - weekday(s));
export const startOfMonth = s => s.slice(0, 8) + '01';
export const endOfMonth = s => {
  const [y, m] = s.split('-').map(Number);
  return fmtDate(Date.UTC(y, m, 0));
};
export const addMonths = (s, n) => {
  const [y, m] = s.split('-').map(Number);
  return fmtDate(Date.UTC(y, m - 1 + n, 1));
};
export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** ISO 8601 week number (week 53 exists in some years, e.g. 2026). */
export function isoWeek(s) {
  const thursday = parseDate(addDays(s, 4 - weekday(s)));
  const jan1 = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return 1 + Math.floor((thursday - jan1) / (7 * DAY));
}
export const isoWeekYear = s => new Date(parseDate(addDays(s, 4 - weekday(s)))).getUTCFullYear();
/** Monday of ISO week `week` in `year`. */
export function isoWeekStart(year, week) {
  const jan4 = fmtDate(Date.UTC(year, 0, 4));
  return addDays(startOfWeek(jan4), (week - 1) * 7);
}

export const toMinutes = hhmm => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
};
export const fromMinutes = min => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const fmtCache = new Map();
function partsFormatter(tz) {
  if (!fmtCache.has(tz)) {
    fmtCache.set(tz, new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
  }
  return fmtCache.get(tz);
}
function wallClock(utcMs, tz) {
  const p = {};
  for (const { type, value } of partsFormatter(tz).formatToParts(new Date(utcMs))) p[type] = Number(value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}
/** Minutes the zone is ahead of UTC at that instant. */
export const tzOffsetMinutes = (utcMs, tz = TZ) => Math.round((wallClock(utcMs, tz) - utcMs) / 60000);

/** The instant (UTC ms) of local `date` + `minutes` past its midnight. */
export function zonedToUtc(date, minutes, tz = TZ) {
  const wall = parseDate(date) + minutes * 60000;
  let utc = wall - tzOffsetMinutes(wall, tz) * 60000;
  utc = wall - tzOffsetMinutes(utc, tz) * 60000;
  return utc;
}
/** Local date and minutes-from-midnight of an instant. */
export function utcToZoned(utcMs, tz = TZ) {
  const wall = wallClock(utcMs, tz);
  const date = fmtDate(wall);
  return { date, minutes: Math.round((wall - parseDate(date)) / 60000) };
}
export const todayIn = (tz = TZ, now = Date.now()) => utcToZoned(now, tz).date;

/** Start/end minutes for a shift that starts on a date; overnight ends past 1440. */
export function shiftMinutes(start, end) {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 1440;
  return { s, e };
}
/** Real hours between two local times on `date` (DST-aware). */
export const realHours = (date, startMin, endMin, tz = TZ) =>
  (zonedToUtc(date, endMin, tz) - zonedToUtc(date, startMin, tz)) / 3600000;

export const round2 = n => Math.round(n * 100) / 100;
