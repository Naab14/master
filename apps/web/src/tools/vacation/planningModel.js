/* Vacations on the planning model.
 *
 * Teams and competencies come from workforce planning instead of Vacations'
 * own S1/S2 list and process list. Nothing here writes to the saved Vacations
 * data and nothing matches by name:
 *
 * - A linked operator (has `personId`) is grouped by the team the profile
 *   belongs to today and counts toward the processes the profile is qualified
 *   for at a level that counts on its own (`counts: 'full'`).
 * - An older operator without a link keeps its S1/S2 and process list in the
 *   saved data, untouched, but is shown apart ("Not linked") and counts toward
 *   nothing until someone links it by hand.
 *
 * Process keys are `wf:<processId>`, so they never collide with the older
 * process names that may still sit in the saved demand.
 */
import { buildIndex, teamOf } from '../../workforce/logic/schedule';
import { getAllCoverageForWeek } from './coverage';
import { isoWeekStart } from '../../workforce/logic/time';
import { list, levelsOf } from '../../workforce/logic/model';

export const UNLINKED = '__unlinked';
export const NO_TEAM = '__noteam';
export const processKey = id => `wf:${id}`;

/**
 * @returns null when planning isn't available or has no processes yet
 *          (Vacations then keeps working on its own S1/S2 and process list).
 */
export function buildPlanningModel(wf, today) {
  if (!wf) return null;
  const processes = list(wf.processes)
    .map(p => ({ key: processKey(p.id), id: p.id, name: p.name, color: p.color }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!processes.length) return null;

  const fullLevels = new Set(levelsOf(wf).filter(l => l.counts === 'full').map(l => l.id));
  const skillProcess = new Map(list(wf.skills).filter(s => s.processId && wf.processes?.[s.processId]).map(s => [s.id, processKey(s.processId)]));
  const idx = buildIndex(wf);
  const teams = list(wf.teams).map(tm => ({ id: tm.id, name: tm.name, color: tm.color })).sort((a, b) => a.name.localeCompare(b.name));
  const teamIds = new Set(teams.map(tm => tm.id));

  const byPerson = new Map();
  for (const p of list(wf.people)) {
    const q = wf.qualifications?.[p.id];
    const certs = new Set();
    for (const [skillId, levelId] of Object.entries(q?.skills || {})) {
      const key = skillProcess.get(skillId);
      if (key && fullLevels.has(levelId)) certs.add(key);
    }
    const team = teamOf(idx, p.id, today);
    byPerson.set(p.id, { teamId: team && teamIds.has(team) ? team : NO_TEAM, certifications: [...certs] });
  }
  // Who is on which team on a given date (a move planned for next week counts next week)
  const teamAt = (personId, date) => {
    const tm = teamOf(idx, personId, date);
    return tm && teamIds.has(tm) ? tm : NO_TEAM;
  };
  return { processes, teams, byPerson, teamAt, certsOf: personId => byPerson.get(personId)?.certifications };
}

/* One ISO week/year rule for every place that turns a Vacations week number into
 * dates (grid, Day view, Dashboard, Schedule absences): the one in workforce/logic/time. */
export { isoWeekStart as isoWeekMonday, isoWeekYear as isoYearOf } from '../../workforce/logic/time';

/**
 * The operators as coverage sees them. `shift` holds the team id (or one of
 * the two markers above) — today's, or the team on `date` when one is given —
 * and `certifications` the process keys. The saved
 * operators are never modified.
 */
export function resolveOperators(operators, model, date = null) {
  if (!model) return operators;
  return operators.map(op => {
    const info = op.personId ? model.byPerson.get(op.personId) : null;
    if (!info) return { ...op, shift: UNLINKED, certifications: [] };
    return { ...op, shift: date ? model.teamAt(op.personId, date) : info.teamId, certifications: info.certifications };
  });
}

/** Row groups for the grid: one per team, then people without a team, then unlinked ones. */
export function planningGroups(resolved, model, t, dates = []) {
  // A team also gets coverage rows when someone is on it on one of the dates shown
  const onDates = new Set();
  for (const o of resolved) {
    if (!o.personId || !model.byPerson.has(o.personId)) continue;
    for (const d of dates) onDates.add(model.teamAt(o.personId, d));
  }
  const groups = [];
  for (const tm of model.teams) {
    const ops = resolved.filter(o => o.shift === tm.id);
    if (ops.length || onDates.has(tm.id)) groups.push({ label: tm.name, ops, shift: tm.id });
  }
  const none = resolved.filter(o => o.shift === NO_TEAM);
  if (none.length) groups.push({ label: t('No team'), ops: none, shift: NO_TEAM, noCoverage: true });
  const unlinked = resolved.filter(o => o.shift === UNLINKED);
  if (unlinked.length) groups.push({ label: t('Not linked'), ops: unlinked, shift: UNLINKED, noCoverage: true });
  return groups;
}

/** The team ids that get coverage rows (shared by the grid and the Dashboard). */
export const coverageTeamIds = (resolved, model, t, dates) => planningGroups(resolved, model, t, dates).filter(g => !g.noCoverage).map(g => g.shift);

/**
 * One week's coverage by team (or for everyone when not separate), the way the
 * Vacations grid computes it: the team and competencies of the week's Monday,
 * and the same rule for which teams get a row: those with people today or on
 * the week's Monday (the grid adds every shown Monday to that). The Dashboard
 * uses this too, so the two never disagree about the same week.
 * @returns {{ operators: object[], results: { shift: string|null, cov: object }[] }}
 */
export function planningWeekCoverage(plan, model, week, year, t, today) {
  const { vacationBlocks = [], demand = {}, settings = {} } = plan;
  const monday = isoWeekStart(year, week);
  const operators = resolveOperators(plan.operators, model, monday);
  const shiftMode = settings.shiftMode || 'combined';
  const keys = model.processes.map(p => p.key);
  const shifts = shiftMode === 'separate' ? coverageTeamIds(resolveOperators(plan.operators, model, today || null), model, t, [monday]) : [null];
  return { operators, results: shifts.map(shift => ({ shift, cov: getAllCoverageForWeek(operators, vacationBlocks, demand, week, shiftMode, shift, null, keys) })) };
}
