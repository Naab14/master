/* Calendar activities: reminders only. They never reduce staffing. */
import { weekday, diffDays, addDays } from './time';
import { list } from './model';

export function occursOn(ev, date) {
  if (date < ev.date || (ev.until && date > ev.until)) return false;
  if (ev.repeat === 'weekly') return weekday(date) === weekday(ev.date) && (diffDays(ev.date, date) / 7) % (ev.every || 1) === 0;
  if (ev.repeat === 'monthly') return date.slice(8) === ev.date.slice(8);
  return date === ev.date;
}
export const eventsOn = (wf, date) => list(wf.events).filter(e => occursOn(e, date)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
export function upcomingEvents(wf, from, days = 14, limit = 8) {
  const out = [];
  let d = from;
  for (let i = 0; i < days && out.length < limit; i++) {
    for (const e of eventsOn(wf, d)) out.push({ ...e, on: d });
    d = addDays(d, 1);
  }
  return out.slice(0, limit);
}
