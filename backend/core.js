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
  // vacation: null means "not yet initialized" — the web client seeds its
  // own sample data on first run, exactly like the standalone app did.
  return data && typeof data === 'object' ? data : null;
}

/** Which data sections a request reads or writes. */
function sectionsFor(pathname) {
  if (pathname === '/api/state') return ['boards', 'manageclip', 'vacation'];
  if (pathname.startsWith('/api/manageclip/')) return ['manageclip'];
  if (pathname.startsWith('/api/vacation/')) return ['vacation'];
  return ['boards'];
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
 * @returns {{ status: number, body: any, dirty: string[] }}
 */
function route(method, pathname, body, s) {
  const parts = pathname.split('/').filter(Boolean); // ['api', ...]
  const dirty = new Set();
  const out = (status, b) => ({ status, body: b, dirty: [...dirty] });

  // GET /api/state — every section merged. One call powers the dashboard on
  // both web and iOS.
  if (method === 'GET' && pathname === '/api/state') {
    return out(200, { ...s.boards, manageclip: s.manageclip, vacation: s.vacation });
  }

  // --- ManageClip (shift dashboard) state -----------------------------------
  if (pathname === '/api/manageclip/state') {
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

module.exports = { route, sectionsFor, normalizeSection };
