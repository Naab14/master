/**
 * Master API core — the JSON REST routes, independent of where data lives.
 *
 * Data is split into three sections:
 *   boards     { members, boards }   (Frieday)
 *   manageclip { tasks, logs, links, settings }   (Shift HQ)
 *   vacation   { operators, vacationBlocks, demand, settings } | null
 *
 * `route()` works on whichever sections a request needs and reports which
 * it changed; the adapters (server.js on disk, api/index.js on Supabase)
 * load and save them.
 */

const crypto = require('crypto');
const access = require('./access');

const WORKFORCE_COLLECTIONS = [
  'people', 'teams', 'memberships', 'shiftTypes', 'patterns', 'patternAssignments', 'overrides',
  'processes', 'skills', 'levels', 'certs', 'qualifications',
  'templates', 'templateRanges', 'requirements', 'adjustments',
  'trainings', 'events', 'obRules', 'reasons', 'settings',
];
const ATTENDANCE_COLLECTIONS = ['entries'];
const DOC_COLLECTIONS = { workforce: WORKFORCE_COLLECTIONS, attendance: ATTENDANCE_COLLECTIONS };
// The attendance log is the record of who changed what (requirement A6), so
// it is kept long; the planning log is a recent-activity trail.
const LOG_LIMIT = { workforce: 500, attendance: 20000 };
const SECTION_KEYS = ['boards', 'manageclip', 'vacation', 'workforce', 'attendance', 'admin', 'sketches'];

function seedDoc(key) {
  const doc = { rev: 0, log: [] };
  for (const c of DOC_COLLECTIONS[key]) doc[c] = {};
  return doc;
}

function uid() {
  return crypto.randomBytes(6).toString('hex');
}

function defaultStatusLabels() {
  return [
    { label: 'Done', color: '#00c875' },
    { label: 'Working on it', color: '#fdab3d' },
    { label: 'Stuck', color: '#e2445c' },
    { label: 'Not started', color: '#c4c4c4' },
  ];
}

function defaultPriorityLabels() {
  return [
    { label: 'Critical', color: '#333333' },
    { label: 'High', color: '#e2445c' },
    { label: 'Medium', color: '#fdab3d' },
    { label: 'Low', color: '#579bfc' },
  ];
}

function defaultColumns() {
  return [
    { id: uid(), title: 'Status', type: 'status', labels: defaultStatusLabels() },
    { id: uid(), title: 'Owner', type: 'person' },
    { id: uid(), title: 'Due date', type: 'date' },
    { id: uid(), title: 'Priority', type: 'status', labels: defaultPriorityLabels() },
  ];
}

const GROUP_COLORS = ['#579bfc', '#00c875', '#a25ddc', '#e2445c', '#fdab3d', '#66ccff', '#ff642e', '#7f5347'];

function seedBoardsSection() {
  const columns = defaultColumns();
  const [statusCol, ownerCol, dateCol, priorityCol] = columns;

  const mkItem = (name, status, owner, due, priority) => ({
    id: uid(),
    name,
    values: {
      [statusCol.id]: status,
      [ownerCol.id]: owner,
      [dateCol.id]: due,
      [priorityCol.id]: priority,
    },
    createdAt: new Date().toISOString(),
  });

  return {
    members: ['Abbe'],
    boards: [
      {
        id: uid(),
        name: 'Getting Started',
        description: 'A sample board — rename it, add your own groups and items, or delete it.',
        columns,
        groups: [
          {
            id: uid(),
            title: 'This week',
            color: GROUP_COLORS[0],
            items: [
              mkItem('Explore the board: click any cell to edit it', 'Working on it', 'Abbe', '', 'High'),
              mkItem('Try the Kanban view (tab above)', 'Not started', '', '', 'Medium'),
              mkItem('Create your first real board from the sidebar', 'Not started', '', '', 'Critical'),
            ],
          },
          {
            id: uid(),
            title: 'Done',
            color: GROUP_COLORS[1],
            items: [mkItem('Set up the boards tool', 'Done', 'Abbe', new Date().toISOString().slice(0, 10), 'Low')],
          },
        ],
      },
    ],
  };
}

// ManageClip state mirrors what the standalone tool kept in localStorage
// (smd.tasks / smd.logs / smd.links / smd.settings).
function seedManageclip() {
  return { tasks: [], logs: [], links: [], settings: { weeklyTarget: 10 } };
}

/** Fill in a section that has never been stored (null) or is malformed. */
function normalizeSection(key, data) {
  if (key === 'boards') {
    if (!data || typeof data !== 'object') return seedBoardsSection();
    return {
      members: Array.isArray(data.members) ? data.members : [],
      boards: Array.isArray(data.boards) ? data.boards : [],
    };
  }
  if (key === 'manageclip') return data && typeof data === 'object' ? data : seedManageclip();
  if (key === 'workforce' || key === 'attendance') {
    const doc = seedDoc(key);
    if (data && typeof data === 'object') {
      doc.rev = Number(data.rev) || 0;
      doc.log = Array.isArray(data.log) ? data.log : [];
      for (const c of DOC_COLLECTIONS[key]) if (data[c] && typeof data[c] === 'object') doc[c] = data[c];
    }
    return doc;
  }
  if (key === 'sketches') return { boards: data && typeof data === 'object' && data.boards && typeof data.boards === 'object' ? data.boards : {} };
  if (key === 'admin') return { ...access.seedAdmin(), ...(data && typeof data === 'object' ? data : {}) };
  // vacation: null means "not yet initialized" — the web client seeds its
  // own sample data on first run, exactly like the standalone app did.
  return data && typeof data === 'object' ? data : null;
}

/** Which data sections a request reads or writes. */
function sectionsFor(pathname) {
  // `admin` holds the roles, so every request needs it.
  if (pathname === '/api/state') return ['boards', 'manageclip', 'vacation', 'admin'];
  if (pathname.startsWith('/api/manageclip/')) return ['manageclip', 'admin'];
  if (pathname.startsWith('/api/vacation/')) return ['vacation', 'admin'];
  if (pathname.startsWith('/api/workforce/')) return ['workforce', 'admin'];
  if (pathname.startsWith('/api/attendance/')) return ['attendance', 'workforce', 'admin'];
  if (pathname === '/api/sketches' || pathname.startsWith('/api/sketches/')) return ['sketches', 'admin'];
  if (pathname === '/api/me' || pathname.startsWith('/api/admin/')) return ['admin'];
  return ['boards', 'admin'];
}

// ---------------------------------------------------------------------------
// Entity documents (workforce, attendance)
// ---------------------------------------------------------------------------

function teamOnDate(wf, personId, date) {
  let best = null;
  for (const m of Object.values(wf.memberships || {})) {
    if (m.personId !== personId || m.status === 'pending') continue;
    if (m.from <= date && (!m.to || date <= m.to) && (!best || m.from > best.from)) best = m;
  }
  return best ? best.teamId : null;
}

const strip = (e) => {
  if (!e) return null;
  const { _rev, _by, _at, ...rest } = e; // eslint-disable-line no-unused-vars
  return rest;
};

/**
 * Apply a batch of entity operations: [{ op: 'put'|'del', col, id, value, base }].
 * `base` is the entity revision the client last saw (0 = expects none). If
 * someone else changed the entity since, nothing in the batch is applied and
 * the current versions come back, so an edit or an undo never silently
 * overwrites a newer change.
 */
function applyOps(key, doc, ops, user, admin, wf, now) {
  if (!Array.isArray(ops) || !ops.length || ops.length > 2000) return { status: 400, body: { error: 'expected { ops: [...] }' } };
  const today = now.slice(0, 10);
  const conflicts = [];
  for (const o of ops) {
    if (!o || !DOC_COLLECTIONS[key].includes(o.col) || typeof o.id !== 'string' || !o.id || !['put', 'del'].includes(o.op)) {
      return { status: 400, body: { error: 'invalid operation' } };
    }
    if (o.op === 'put' && (!o.value || typeof o.value !== 'object')) return { status: 400, body: { error: 'invalid operation' } };
    if (!access.can(user, admin, access.COLLECTION_PERMISSION[o.col])) {
      return { status: 403, body: { error: `no permission: ${access.COLLECTION_PERMISSION[o.col]}`, permission: access.COLLECTION_PERMISSION[o.col] } };
    }
    const current = doc[o.col][o.id];
    // Team scope: leads limited to some teams only touch their own people.
    if (user.teams && ['entries', 'overrides', 'qualifications'].includes(o.col)) {
      const subject = o.col === 'qualifications' ? o.id : (o.value || current || {}).personId;
      const date = (o.value || current || {}).date || today;
      if (!user.teams.includes(teamOnDate(wf, subject, date))) return { status: 403, body: { error: 'outside your teams' } };
    }
    // Only people who may confirm moves can put a team change into force.
    if (o.col === 'memberships' && !access.can(user, admin, 'teams.confirm')) {
      const settings = wf.settings.main || {};
      const needsManager = settings.requireMoveConfirmation !== false;
      const touchesConfirmed = (o.value && o.value.status !== 'pending') || (current && current.status !== 'pending');
      if (needsManager && touchesConfirmed) return { status: 403, body: { error: 'a manager must confirm team moves', permission: 'teams.confirm' } };
    }
    if (o.base !== undefined && o.base !== null && (current ? current._rev : 0) !== o.base) {
      conflicts.push({ col: o.col, id: o.id, current: current || null });
    }
  }
  if (conflicts.length) return { status: 409, body: { error: 'conflict', conflicts } };

  const changed = [];
  for (const o of ops) {
    const before = doc[o.col][o.id] || null;
    let after = null;
    if (o.op === 'del') delete doc[o.col][o.id];
    else {
      after = { ...strip(o.value), id: o.id, _rev: (before ? before._rev || 0 : 0) + 1, _by: user.email || user.name, _at: now };
      doc[o.col][o.id] = after;
    }
    if (before || after) doc.log.push({ at: now, by: user.email || user.name, col: o.col, id: o.id, before: strip(before), after: strip(after) });
    changed.push({ col: o.col, id: o.id, value: after });
  }
  if (doc.log.length > LOG_LIMIT[key]) doc.log = doc.log.slice(-LOG_LIMIT[key]);
  doc.rev += 1;
  return { status: 200, body: { ok: true, rev: doc.rev, changed } };
}

/** What an operator account may read: the shared schedule and only their own profile. */
function operatorView(wf, user) {
  const own = (map) => (user.personId && map[user.personId] ? { [user.personId]: map[user.personId] } : {});
  const mine = (map) => Object.fromEntries(Object.entries(map).filter(([, e]) => e.personId === user.personId));
  return {
    ...wf, log: [], people: own(wf.people), qualifications: own(wf.qualifications),
    memberships: mine(wf.memberships), overrides: mine(wf.overrides), trainings: mine(wf.trainings),
    patternAssignments: Object.fromEntries(Object.entries(wf.patternAssignments).filter(([, a]) => a.target === 'team' || a.targetId === user.personId)),
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * Handle one API request against loaded sections.
 * @param {string} method
 * @param {string} pathname  e.g. /api/boards/abc
 * @param {object} body      parsed JSON body ({} when none)
 * @param {object} s         loaded sections, keyed by sectionsFor(pathname)
 * @param {object} ctx       { identity, env, now } from the adapter (auth.js)
 * @returns {{ status: number, body: any, dirty: string[] }}
 */
function route(method, pathname, body, s, ctx = {}) {
  const parts = pathname.split('/').filter(Boolean); // ['api', ...]
  const dirty = new Set();
  const out = (status, b) => ({ status, body: b, dirty: [...dirty] });
  const now = ctx.now || new Date().toISOString();
  const admin = s.admin || access.seedAdmin();
  const identity = ctx.identity || { via: 'open', email: null };
  const env = ctx.env || { adminEmails: [], allowedEmails: [], codeRole: 'manager' };

  // --- Who is asking --------------------------------------------------------
  let user = access.resolveUser(identity, admin, env);
  // External guests: only when the admin allows it, and only people a sketch
  // board has been shared with. They reach nothing but those boards.
  if (!user && identity.via === 'google' && admin.settings.externalGuests === true && (admin.guestEmails || []).includes(identity.email)) {
    user = { email: identity.email, name: identity.email, role: 'guest', teams: null, personId: null };
  }
  if (!user) {
    // Signed in with Google but not invited: remember the request so the
    // admin can approve it in the app, and say no.
    const known = admin.users[identity.email];
    if (!known && !admin.requests[identity.email] && Object.keys(admin.requests).length < 50) {
      admin.requests[identity.email] = { email: identity.email, at: now };
      dirty.add('admin');
    }
    return out(403, { error: `${identity.email} doesn't have access yet. Ask the admin to approve your account.`, code: 'not-invited' });
  }
  const can = (permission) => access.can(user, admin, permission);
  const need = (permission) => (can(permission) ? null : out(403, { error: `no permission: ${permission}`, permission }));
  // Editing a tool needs both its view and its edit permission.
  const readOrWrite = (tool) => need(`${tool}.view`) || (method === 'GET' ? null : need(`${tool}.edit`));

  if (method === 'GET' && pathname === '/api/me') {
    return out(200, { email: user.email, name: user.name, role: user.role, teams: user.teams, personId: user.personId, permissions: access.permissionsOf(user, admin), via: identity.via });
  }

  // --- Sketch boards (Excalidraw) -------------------------------------------
  // A board belongs to whoever created it and is private until shared. The
  // checks below look only at owner and share list: no role, including
  // admin, opens someone else's private board through the app.
  if (parts[1] === 'sketches') {
    const me = user.email || (identity.via === 'code' ? 'access-code' : 'local');
    const boards = s.sketches.boards;
    const canSee = (b) => b.owner === me || (b.shared || []).includes(me);
    const meta = (b) => ({ id: b.id, name: b.name, owner: b.owner, shared: b.owner === me ? b.shared || [] : undefined, mine: b.owner === me, rev: b.rev, updatedAt: b.updatedAt, updatedBy: b.updatedBy, links: b.links || [] });
    const changedSketch = (status, b) => { dirty.add('sketches'); return out(status, b); };
    const isGuest = user.role === 'guest';
    // Keep the list of outside addresses that boards are shared with, so a
    // guest can be recognised without loading every drawing on each request.
    const syncGuests = () => {
      const known = (e) => env.adminEmails.includes(e) || env.allowedEmails.includes(e) || !!admin.users[e];
      admin.guestEmails = [...new Set(Object.values(boards).flatMap((b) => b.shared || []).filter((e) => !known(e)))];
      dirty.add('admin');
    };
    if (!isGuest && !can('sketches.use')) return need('sketches.use');

    if (parts.length === 2 && method === 'GET') {
      return out(200, { boards: Object.values(boards).filter(canSee).map(meta).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))), me, externalGuests: admin.settings.externalGuests === true });
    }
    if (parts.length === 2 && method === 'POST') {
      if (isGuest) return out(403, { error: 'guests cannot create boards' });
      const name = String(body.name || '').trim().slice(0, 120);
      if (!name) return out(400, { error: 'name required' });
      const board = { id: uid(), name, owner: me, shared: [], links: [], scene: null, rev: 1, createdAt: now, updatedAt: now, updatedBy: me };
      boards[board.id] = board;
      return changedSketch(201, { ...meta(board), scene: null });
    }
    const board = boards[parts[2]];
    // "Not found" for boards you may not see, so their existence isn't revealed.
    if (!board || !canSee(board)) return out(404, { error: 'board not found' });
    if (parts.length === 3 && method === 'GET') return out(200, { ...meta(board), scene: board.scene });
    if (parts.length === 3 && method === 'PUT') {
      if (typeof body.baseRev === 'number' && body.baseRev !== board.rev) return out(409, { error: 'conflict', current: { ...meta(board), scene: board.scene } });
      const owner = board.owner === me;
      if ((body.name !== undefined || body.shared !== undefined) && !owner) return out(403, { error: 'only the owner can rename or share a board' });
      if (typeof body.name === 'string' && body.name.trim()) board.name = body.name.trim().slice(0, 120);
      if (Array.isArray(body.shared)) {
        const emails = [...new Set(body.shared.map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e !== me))];
        const known = (e) => env.adminEmails.includes(e) || env.allowedEmails.includes(e) || (admin.users[e] && admin.users[e].active !== false);
        const outside = emails.filter((e) => !known(e));
        if (outside.length && admin.settings.externalGuests !== true) {
          return out(400, { error: `Not invited to this workspace: ${outside.join(', ')}. The admin can allow external guests under Access.`, code: 'external-off' });
        }
        board.shared = emails.slice(0, 50);
        syncGuests();
      }
      if (Array.isArray(body.links)) board.links = body.links.filter((l) => l && typeof l === 'object').slice(0, 20);
      if (body.scene && typeof body.scene === 'object') board.scene = body.scene;
      board.rev += 1; board.updatedAt = now; board.updatedBy = me;
      return changedSketch(200, meta(board));
    }
    if (parts.length === 3 && method === 'DELETE') {
      if (board.owner !== me) return out(403, { error: 'only the owner can delete a board' });
      delete boards[board.id];
      syncGuests();
      return changedSketch(200, { ok: true });
    }
    return out(404, { error: 'not found' });
  }
  // Guests reach nothing else.
  if (user.role === 'guest' && pathname !== '/api/me') return out(403, { error: 'guests can only open boards shared with them', permission: 'guest' });

  // --- Admin: users, access requests, permissions ---------------------------
  if (parts[1] === 'admin') {
    if (user.role !== 'admin') return out(403, { error: 'admin only' });
    const changedAdmin = (b) => { dirty.add('admin'); return out(200, b); };
    const publicAdmin = () => ({ users: admin.users, requests: admin.requests, permissions: admin.permissions, settings: admin.settings, roles: access.ROLES, defaults: access.PERMISSIONS, adminEmails: env.adminEmails });
    if (method === 'GET' && pathname === '/api/admin/state') return out(200, publicAdmin());
    if (method === 'POST' && pathname === '/api/admin/users') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return out(400, { error: 'a valid email is required' });
      if (!access.ROLES.includes(body.role) || body.role === 'admin') return out(400, { error: 'choose a role (the admin account is set in the server configuration)' });
      admin.users[email] = {
        email, role: body.role, name: String(body.name || '').trim(), active: body.active !== false,
        teams: Array.isArray(body.teams) ? body.teams.filter((t) => typeof t === 'string') : [],
        personId: typeof body.personId === 'string' ? body.personId : null,
        invitedBy: admin.users[email]?.invitedBy || user.email || user.name, invitedAt: admin.users[email]?.invitedAt || now,
      };
      delete admin.requests[email];
      return changedAdmin(publicAdmin());
    }
    if (method === 'DELETE' && parts[2] === 'users' && parts[3]) {
      delete admin.users[decodeURIComponent(parts[3]).toLowerCase()];
      return changedAdmin(publicAdmin());
    }
    if (method === 'DELETE' && parts[2] === 'requests' && parts[3]) {
      delete admin.requests[decodeURIComponent(parts[3]).toLowerCase()];
      return changedAdmin(publicAdmin());
    }
    if (method === 'PUT' && pathname === '/api/admin/permissions') {
      const next = {};
      for (const role of access.ROLES) {
        if (role === 'admin' || !body[role] || typeof body[role] !== 'object') continue;
        next[role] = {};
        for (const p of Object.keys(access.PERMISSIONS)) if (typeof body[role][p] === 'boolean') next[role][p] = body[role][p];
      }
      admin.permissions = next;
      return changedAdmin(publicAdmin());
    }
    if (method === 'PUT' && pathname === '/api/admin/settings') {
      if (typeof body.externalGuests === 'boolean') admin.settings = { ...admin.settings, externalGuests: body.externalGuests };
      return changedAdmin(publicAdmin());
    }
    return out(404, { error: 'not found' });
  }

  // --- Workforce planning and attendance -----------------------------------
  if (pathname === '/api/workforce/state' && method === 'GET') {
    if (can('workforce.view')) return out(200, s.workforce);
    if (can('self.view') && (s.workforce.settings.main || {}).operatorAccess) return out(200, operatorView(s.workforce, user));
    return need('workforce.view');
  }
  if (pathname === '/api/workforce/ops' && method === 'POST') {
    const r = applyOps('workforce', s.workforce, body.ops, user, admin, s.workforce, now);
    if (r.status === 200) dirty.add('workforce');
    return out(r.status, r.body);
  }
  if (pathname === '/api/attendance/state' && method === 'GET') {
    return need('attendance.view') || out(200, s.attendance);
  }
  if (pathname === '/api/attendance/ops' && method === 'POST') {
    const r = applyOps('attendance', s.attendance, body.ops, user, admin, s.workforce, now);
    if (r.status === 200) dirty.add('attendance');
    return out(r.status, r.body);
  }
  if (parts[1] === 'workforce' || parts[1] === 'attendance') return out(404, { error: 'not found' });

  // GET /api/state — every section merged. One call powers the dashboard on
  // both web and iOS. Sections the caller may not see come back empty.
  if (method === 'GET' && pathname === '/api/state') {
    const boards = can('boards.view') ? s.boards : { members: [], boards: [] };
    return out(200, {
      ...boards,
      manageclip: can('shifthq.view') ? s.manageclip : { tasks: [], logs: [], links: [], settings: {} },
      vacation: can('vacations.view') ? s.vacation : null,
    });
  }

  // --- ManageClip (shift dashboard) state -----------------------------------
  if (pathname === '/api/manageclip/state') {
    const denied = readOrWrite('shifthq');
    if (denied) return denied;
    if (method === 'GET') return out(200, s.manageclip);
    if (method === 'PUT') {
      s.manageclip = {
        tasks: Array.isArray(body.tasks) ? body.tasks : [],
        logs: Array.isArray(body.logs) ? body.logs : [],
        links: Array.isArray(body.links) ? body.links : [],
        settings: body.settings && typeof body.settings === 'object' ? body.settings : {},
      };
      dirty.add('manageclip');
      return out(200, s.manageclip);
    }
  }

  // --- Vacation Planner state ------------------------------------------------
  if (pathname === '/api/vacation/state') {
    const denied = readOrWrite('vacations');
    if (denied) return denied;
    if (method === 'GET') return out(200, s.vacation);
    if (method === 'PUT') {
      if (!body || typeof body !== 'object' || !Array.isArray(body.operators)) {
        return out(400, { error: 'expected { operators, vacationBlocks, demand, settings }' });
      }
      s.vacation = body;
      dirty.add('vacation');
      return out(200, s.vacation);
    }
  }

  // --- Boards (Frieday) -------------------------------------------------------
  const boardsDenied = readOrWrite('boards');
  if (boardsDenied) return boardsDenied;
  const db = s.boards;
  const findBoard = (id) => db.boards.find((b) => b.id === id);
  const findGroup = (board, id) => board.groups.find((g) => g.id === id);
  const findItem = (board, id) => {
    for (const g of board.groups) {
      const item = g.items.find((i) => i.id === id);
      if (item) return { group: g, item };
    }
    return null;
  };
  const changed = (status, b) => { dirty.add('boards'); return out(status, b); };

  // POST /api/boards
  if (method === 'POST' && pathname === '/api/boards') {
    const name = String(body.name || '').trim();
    if (!name) return out(400, { error: 'name required' });
    const board = {
      id: uid(),
      name,
      description: String(body.description || ''),
      columns: defaultColumns(),
      groups: [{ id: uid(), title: 'Group 1', color: GROUP_COLORS[0], items: [] }],
    };
    db.boards.push(board);
    return changed(201, board);
  }

  // /api/boards/:bid...
  if (parts[1] === 'boards' && parts[2]) {
    const board = findBoard(parts[2]);
    if (!board) return out(404, { error: 'board not found' });

    // PATCH/DELETE /api/boards/:bid
    if (parts.length === 3) {
      if (method === 'PATCH') {
        if (typeof body.name === 'string' && body.name.trim()) board.name = body.name.trim();
        if (typeof body.description === 'string') board.description = body.description;
        return changed(200, board);
      }
      if (method === 'DELETE') {
        db.boards = db.boards.filter((b) => b.id !== board.id);
        return changed(200, { ok: true });
      }
    }

    // POST /api/boards/:bid/groups
    if (parts[3] === 'groups' && parts.length === 4 && method === 'POST') {
      const group = {
        id: uid(),
        title: String(body.title || 'New group').trim() || 'New group',
        color: GROUP_COLORS[board.groups.length % GROUP_COLORS.length],
        items: [],
      };
      board.groups.push(group);
      return changed(201, group);
    }

    // /api/boards/:bid/groups/:gid
    if (parts[3] === 'groups' && parts[4]) {
      const group = findGroup(board, parts[4]);
      if (!group) return out(404, { error: 'group not found' });

      if (parts.length === 5 && method === 'PATCH') {
        if (typeof body.title === 'string' && body.title.trim()) group.title = body.title.trim();
        if (typeof body.color === 'string') group.color = body.color;
        return changed(200, group);
      }
      if (parts.length === 5 && method === 'DELETE') {
        board.groups = board.groups.filter((g) => g.id !== group.id);
        return changed(200, { ok: true });
      }
      // POST /api/boards/:bid/groups/:gid/items
      if (parts[5] === 'items' && method === 'POST') {
        const name = String(body.name || '').trim();
        if (!name) return out(400, { error: 'name required' });
        const item = { id: uid(), name, values: {}, createdAt: new Date().toISOString() };
        group.items.push(item);
        return changed(201, item);
      }
    }

    // /api/boards/:bid/items/:iid
    if (parts[3] === 'items' && parts[4]) {
      const found = findItem(board, parts[4]);
      if (!found) return out(404, { error: 'item not found' });
      const { group, item } = found;

      if (method === 'PATCH') {
        if (typeof body.name === 'string' && body.name.trim()) item.name = body.name.trim();
        if (body.values && typeof body.values === 'object') {
          Object.assign(item.values, body.values);
        }
        // Move to another group (used by kanban drag or "move to group")
        if (typeof body.groupId === 'string' && body.groupId !== group.id) {
          const target = findGroup(board, body.groupId);
          if (target) {
            group.items = group.items.filter((i) => i.id !== item.id);
            target.items.push(item);
          }
        }
        return changed(200, item);
      }
      if (method === 'DELETE') {
        group.items = group.items.filter((i) => i.id !== item.id);
        return changed(200, { ok: true });
      }
    }

    // POST /api/boards/:bid/columns
    if (parts[3] === 'columns' && parts.length === 4 && method === 'POST') {
      const type = ['text', 'status', 'person', 'date', 'number'].includes(body.type) ? body.type : 'text';
      const column = { id: uid(), title: String(body.title || 'New column').trim() || 'New column', type };
      if (type === 'status') column.labels = Array.isArray(body.labels) && body.labels.length ? body.labels : defaultStatusLabels();
      board.columns.push(column);
      return changed(201, column);
    }

    // DELETE /api/boards/:bid/columns/:cid
    if (parts[3] === 'columns' && parts[4] && method === 'DELETE') {
      board.columns = board.columns.filter((c) => c.id !== parts[4]);
      for (const g of board.groups) for (const i of g.items) delete i.values[parts[4]];
      return changed(200, { ok: true });
    }
  }

  // POST /api/members
  if (method === 'POST' && pathname === '/api/members') {
    const name = String(body.name || '').trim();
    if (!name) return out(400, { error: 'name required' });
    if (!db.members.includes(name)) db.members.push(name);
    return changed(201, { members: db.members });
  }

  return out(404, { error: 'not found' });
}

module.exports = { route, sectionsFor, normalizeSection, SECTION_KEYS };
