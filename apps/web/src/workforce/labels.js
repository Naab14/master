/* Wording for requirements and coverage notes, shared by screens and prints. */

export const reqLabel = (wf, req) => req.label || wf.processes[req.processId]?.name || wf.skills[req.skillId]?.name || '—';

const clock = min => `${String(Math.floor((min % 1440) / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function noteText(t, fmt, wf, r) {
  const out = [];
  const hours = r.req.hours ? fmt.hours(r.req.hours) : '';
  for (const n of r.notes) {
    if (n === 'shared') out.push(t('Shared role: can be combined with a line position.'));
    if (n === 'supervised') out.push(t('Includes a trainee working under supervision.'));
    if (n === 'needsSupervisor') out.push(t('A trainee is available but there is no free supervisor on this process.'));
    if (n === 'partlyAway') out.push(t('Someone counted here is away part of the shift.'));
    if (n === 'competingFlexible') out.push(t('Only possible by taking someone off a line for {hours}. When is not known.', { hours }));
    if (n === 'competingFixed') out.push(t('Only possible by taking someone off a line {from}–{to}.', { from: r.req.window?.start, to: r.req.window?.end }));
    if (n === 'partTime') out.push(t('Not possible {when}; the rest of the time it is.', { when: r.gaps.map(g => `${clock(g.startMin)}–${clock(g.endMin)}`).join(', ') }));
    if (n === 'certIssue') out.push(t('{n} people would qualify but have a missing or expired certificate on this date.', { n: r.certBlocked.length }));
  }
  return out;
}
