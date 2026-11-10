/**
 * Roles and permissions, enforced on the server.
 *
 * Who someone is comes from auth.js. What they may do comes from the `admin`
 * section: invited users with a role, and a role → permission table the
 * admin can change. The admin role always has everything.
 */

const ROLES = ['admin', 'manager', 'teamlead', 'viewer', 'operator'];

/** Every permission, with the roles that have it by default. */
const PERMISSIONS = {
  'workforce.view': ['manager', 'teamlead', 'viewer'],
  'schedule.edit': ['manager', 'teamlead'],
  'people.edit': ['manager'],
  'teams.confirm': ['manager'],
  'competencies.edit': ['manager'],
  'requirements.edit': ['manager'],
  'training.edit': ['manager', 'teamlead'],
  'events.edit': ['manager', 'teamlead'],
  'settings.edit': ['manager'],
  'attendance.view': ['manager', 'teamlead'],
  'attendance.edit': ['manager', 'teamlead'],
  'reports.view': ['manager'],
  'shifthq.view': ['manager', 'teamlead', 'viewer'],
  'shifthq.edit': ['manager', 'teamlead'],
  'vacations.view': ['manager', 'teamlead', 'viewer'],
  'vacations.edit': ['manager', 'teamlead'],
  'boards.view': ['manager', 'teamlead', 'viewer'],
  'boards.edit': ['manager', 'teamlead'],
  'sketches.use': ['manager', 'teamlead'],
  'self.view': ['operator'],
};

/** Which permission a write to a collection needs. */
const COLLECTION_PERMISSION = {
  people: 'people.edit', teams: 'people.edit', memberships: 'schedule.edit',
  shiftTypes: 'schedule.edit', patterns: 'schedule.edit', patternAssignments: 'schedule.edit', overrides: 'schedule.edit',
  processes: 'settings.edit', skills: 'settings.edit', levels: 'settings.edit', certs: 'settings.edit',
  qualifications: 'competencies.edit',
  templates: 'requirements.edit', templateRanges: 'requirements.edit', requirements: 'requirements.edit', adjustments: 'requirements.edit',
  trainings: 'training.edit', events: 'events.edit',
  obRules: 'settings.edit', reasons: 'settings.edit', settings: 'settings.edit',
  entries: 'attendance.edit',
};

function seedAdmin() {
  return { users: {}, requests: {}, permissions: {}, settings: {} };
}

/**
 * Turn a proven identity into a user with a role, or null (no access).
 * @param identity { via: 'open'|'code'|'google', email }
 * @param env { adminEmails, allowedEmails, codeRole }
 */
function resolveUser(identity, admin, env) {
  if (identity.via === 'open') return { email: null, name: 'Local', role: 'admin', teams: null, personId: null };
  if (identity.via === 'code') {
    const role = ROLES.includes(env.codeRole) && env.codeRole !== 'admin' ? env.codeRole : 'manager';
    return { email: null, name: 'Access code', role, teams: null, personId: null };
  }
  const email = identity.email;
  if (env.adminEmails.includes(email)) return { email, name: admin.users[email]?.name || email, role: 'admin', teams: null, personId: null };
  const u = admin.users[email];
  if (u && u.active !== false && ROLES.includes(u.role) && u.role !== 'admin') {
    return { email, name: u.name || email, role: u.role, teams: Array.isArray(u.teams) && u.teams.length ? u.teams : null, personId: u.personId || null };
  }
  if (!u && env.allowedEmails.includes(email)) return { email, name: email, role: 'manager', teams: null, personId: null };
  return null;
}

function can(user, admin, permission) {
  if (user.role === 'admin') return true;
  const override = admin.permissions?.[user.role]?.[permission];
  if (typeof override === 'boolean') return override;
  return (PERMISSIONS[permission] || []).includes(user.role);
}

function permissionsOf(user, admin) {
  return Object.keys(PERMISSIONS).filter((p) => can(user, admin, p));
}

module.exports = { ROLES, PERMISSIONS, COLLECTION_PERMISSION, seedAdmin, resolveUser, can, permissionsOf };
