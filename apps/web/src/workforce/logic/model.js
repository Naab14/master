/* The workforce document.
 *
 * Every collection is a map id → entity, so two people editing different
 * entities never collide (the server merges per entity, see backend/core.js).
 */

export const WORKFORCE_COLLECTIONS = [
  'people', 'teams', 'memberships', 'shiftTypes', 'patterns', 'patternAssignments', 'overrides',
  'processes', 'skills', 'levels', 'certs', 'qualifications',
  'templates', 'templateRanges', 'requirements', 'adjustments',
  'trainings', 'events', 'obRules', 'reasons', 'settings',
];
export const ATTENDANCE_COLLECTIONS = ['entries'];

export function emptyDoc(collections) {
  return Object.fromEntries(collections.map(c => [c, {}]));
}
export const list = map => Object.values(map || {});
export const uid = (prefix = '') => prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Default competency levels; all of it is editable in settings. */
export const DEFAULT_LEVELS = [
  { id: 'learning', name: { en: 'Learning', sv: 'Under upplärning' }, rank: 1, counts: 'none', canSupervise: false },
  { id: 'supervised', name: { en: 'Supervised', sv: 'Med handledning' }, rank: 2, counts: 'supervised', canSupervise: false },
  { id: 'independent', name: { en: 'Independent', sv: 'Självständig' }, rank: 3, counts: 'full', canSupervise: false },
  { id: 'trainer', name: { en: 'Trainer', sv: 'Handledare' }, rank: 4, counts: 'full', canSupervise: true },
];

/** Attendance reasons. `category` drives the maths; names are editable. */
export const DEFAULT_REASONS = [
  { id: 'present', name: { en: 'Present', sv: 'Närvarande' }, category: 'present', order: 1 },
  { id: 'late', name: { en: 'Late', sv: 'Sen ankomst' }, category: 'late', order: 2 },
  { id: 'sick', name: { en: 'Sick', sv: 'Sjuk' }, category: 'sick', order: 3 },
  { id: 'vacation', name: { en: 'Vacation', sv: 'Semester' }, category: 'vacation', order: 4 },
  { id: 'vab', name: { en: 'Care of child (VAB)', sv: 'VAB' }, category: 'absence', order: 5 },
  { id: 'leave', name: { en: 'Leave of absence', sv: 'Tjänstledig' }, category: 'absence', order: 6 },
  { id: 'overtime', name: { en: 'Overtime', sv: 'Övertid' }, category: 'overtime', order: 7 },
];

export const DEFAULT_SETTINGS = {
  id: 'main',
  requireMoveConfirmation: true,   // team moves by team leads wait for a manager
  maxTraineesPerSupervisor: 1,
  digitalAssignments: false,       // the whiteboard is the default
  employmentIndicator: 'dot',      // 'dot' | 'tag' | 'none'
  nicknameIn: { schedule: true, people: false, reports: false, coverage: true },
  operatorAccess: false,           // prepared, off until the admin turns it on
};

export const settingsOf = wf => ({ ...DEFAULT_SETTINGS, ...(wf.settings?.main || {}) });
export const levelsOf = wf => (list(wf.levels).length ? list(wf.levels) : DEFAULT_LEVELS).slice().sort((a, b) => a.rank - b.rank);
export const reasonsOf = wf => (list(wf.reasons).length ? list(wf.reasons) : DEFAULT_REASONS).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

export const displayName = (person, useNickname) =>
  (useNickname && person?.nickname) || person?.name || '—';
export const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
