#!/usr/bin/env node
/**
 * Master — unified backend for the consolidated shift-management tool.
 *
 * Grown from Frieday's zero-dependency Node server; now also stores the
 * ManageClip (shift dashboard) and Vacation Planner state so web + iOS share
 * one database. Plain Node.js HTTP server, JSON REST API under /api,
 * persistence to data/db.json (atomic writes), static frontend from
 * ../apps/web/dist.
 *
 * Run:  node server.js   (PORT env var optional, defaults to 3000)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = process.env.WEB_DIST || path.join(__dirname, '..', 'apps', 'web', 'dist');

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

let db = null;

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

function seedBoards() {
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

  return [
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
  ];
}

// ManageClip state mirrors what the standalone tool kept in localStorage
// (smd.tasks / smd.logs / smd.links / smd.settings).
function seedManageclip() {
  return { tasks: [], logs: [], links: [], settings: { weeklyTarget: 10 } };
}

// Vacation Planner state mirrors its localStorage AppState
// ({ operators, vacationBlocks, demand, settings }). null means "not yet
// initialized" — the web client seeds its own sample data on first run,
// exactly like the standalone app did.
function seedVacation() {
  return null;
}

function seedDb() {
  return {
    members: ['Abbe'],
    boards: seedBoards(),
    manageclip: seedManageclip(),
    vacation: seedVacation(),
  };
}

function loadDb() {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    db = seedDb();
    saveDb();
  }
  // Upgrade path from a plain Frieday db.json: add the new sections.
  if (!db.manageclip) db.manageclip = seedManageclip();
  if (!('vacation' in db)) db.vacation = seedVacation();
  if (!Array.isArray(db.members)) db.members = [];
  if (!Array.isArray(db.boards)) db.boards = [];
}

let saveTimer = null;
function saveDb() {
  // Debounce bursts of edits; atomic write via tmp+rename.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }, 100);
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function findBoard(id) {
  return db.boards.find((b) => b.id === id);
}

function findGroup(board, id) {
  return board.groups.find((g) => g.id === id);
}

function findItem(board, id) {
  for (const g of board.groups) {
    const item = g.items.find((i) => i.id === id);
    if (item) return { group: g, item };
  }
  return null;
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 5e6) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// API routing
// ---------------------------------------------------------------------------

async function handleApi(req, res, pathname) {
  const parts = pathname.split('/').filter(Boolean); // ['api', ...]
  const method = req.method;

  // GET /api/state — the full database: boards, members, manageclip, vacation.
  // One call powers the dashboard on both web and iOS.
  if (method === 'GET' && pathname === '/api/state') {
    return json(res, 200, db);
  }

  // --- ManageClip (shift dashboard) state -----------------------------------
  if (pathname === '/api/manageclip/state') {
    if (method === 'GET') return json(res, 200, db.manageclip);
    if (method === 'PUT') {
      const body = await readBody(req);
      db.manageclip = {
        tasks: Array.isArray(body.tasks) ? body.tasks : [],
        logs: Array.isArray(body.logs) ? body.logs : [],
        links: Array.isArray(body.links) ? body.links : [],
        settings: body.settings && typeof body.settings === 'object' ? body.settings : {},
      };
      saveDb();
      return json(res, 200, db.manageclip);
    }
  }

  // --- Vacation Planner state ------------------------------------------------
  if (pathname === '/api/vacation/state') {
    if (method === 'GET') return json(res, 200, db.vacation);
    if (method === 'PUT') {
      const body = await readBody(req);
      if (!body || typeof body !== 'object' || !Array.isArray(body.operators)) {
        return json(res, 400, { error: 'expected { operators, vacationBlocks, demand, settings }' });
      }
      db.vacation = body;
      saveDb();
      return json(res, 200, db.vacation);
    }
  }

  // --- Boards (Frieday) -------------------------------------------------------

  // POST /api/boards
  if (method === 'POST' && pathname === '/api/boards') {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    if (!name) return json(res, 400, { error: 'name required' });
    const board = {
      id: uid(),
      name,
      description: String(body.description || ''),
      columns: defaultColumns(),
      groups: [{ id: uid(), title: 'Group 1', color: GROUP_COLORS[0], items: [] }],
    };
    db.boards.push(board);
    saveDb();
    return json(res, 201, board);
  }

  // /api/boards/:bid...
  if (parts[1] === 'boards' && parts[2]) {
    const board = findBoard(parts[2]);
    if (!board) return json(res, 404, { error: 'board not found' });

    // PATCH/DELETE /api/boards/:bid
    if (parts.length === 3) {
      if (method === 'PATCH') {
        const body = await readBody(req);
        if (typeof body.name === 'string' && body.name.trim()) board.name = body.name.trim();
        if (typeof body.description === 'string') board.description = body.description;
        saveDb();
        return json(res, 200, board);
      }
      if (method === 'DELETE') {
        db.boards = db.boards.filter((b) => b.id !== board.id);
        saveDb();
        return json(res, 200, { ok: true });
      }
    }

    // POST /api/boards/:bid/groups
    if (parts[3] === 'groups' && parts.length === 4 && method === 'POST') {
      const body = await readBody(req);
      const group = {
        id: uid(),
        title: String(body.title || 'New group').trim() || 'New group',
        color: GROUP_COLORS[board.groups.length % GROUP_COLORS.length],
        items: [],
      };
      board.groups.push(group);
      saveDb();
      return json(res, 201, group);
    }

    // /api/boards/:bid/groups/:gid
    if (parts[3] === 'groups' && parts[4]) {
      const group = findGroup(board, parts[4]);
      if (!group) return json(res, 404, { error: 'group not found' });

      if (parts.length === 5 && method === 'PATCH') {
        const body = await readBody(req);
        if (typeof body.title === 'string' && body.title.trim()) group.title = body.title.trim();
        if (typeof body.color === 'string') group.color = body.color;
        saveDb();
        return json(res, 200, group);
      }
      if (parts.length === 5 && method === 'DELETE') {
        board.groups = board.groups.filter((g) => g.id !== group.id);
        saveDb();
        return json(res, 200, { ok: true });
      }
      // POST /api/boards/:bid/groups/:gid/items
      if (parts[5] === 'items' && method === 'POST') {
        const body = await readBody(req);
        const name = String(body.name || '').trim();
        if (!name) return json(res, 400, { error: 'name required' });
        const item = { id: uid(), name, values: {}, createdAt: new Date().toISOString() };
        group.items.push(item);
        saveDb();
        return json(res, 201, item);
      }
    }

    // /api/boards/:bid/items/:iid
    if (parts[3] === 'items' && parts[4]) {
      const found = findItem(board, parts[4]);
      if (!found) return json(res, 404, { error: 'item not found' });
      const { group, item } = found;

      if (method === 'PATCH') {
        const body = await readBody(req);
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
        saveDb();
        return json(res, 200, item);
      }
      if (method === 'DELETE') {
        group.items = group.items.filter((i) => i.id !== item.id);
        saveDb();
        return json(res, 200, { ok: true });
      }
    }

    // POST /api/boards/:bid/columns
    if (parts[3] === 'columns' && parts.length === 4 && method === 'POST') {
      const body = await readBody(req);
      const type = ['text', 'status', 'person', 'date', 'number'].includes(body.type) ? body.type : 'text';
      const column = { id: uid(), title: String(body.title || 'New column').trim() || 'New column', type };
      if (type === 'status') column.labels = Array.isArray(body.labels) && body.labels.length ? body.labels : defaultStatusLabels();
      board.columns.push(column);
      saveDb();
      return json(res, 201, column);
    }

    // DELETE /api/boards/:bid/columns/:cid
    if (parts[3] === 'columns' && parts[4] && method === 'DELETE') {
      board.columns = board.columns.filter((c) => c.id !== parts[4]);
      for (const g of board.groups) for (const i of g.items) delete i.values[parts[4]];
      saveDb();
      return json(res, 200, { ok: true });
    }
  }

  // POST /api/members
  if (method === 'POST' && pathname === '/api/members') {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    if (!name) return json(res, 400, { error: 'name required' });
    if (!db.members.includes(name)) db.members.push(name);
    saveDb();
    return json(res, 201, { members: db.members });
  }

  return json(res, 404, { error: 'not found' });
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveStatic(res, pathname) {
  let rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, index) => {
        if (err2) {
          res.writeHead(404);
          return res.end('not found — build the web app first: npm --prefix apps/web run build');
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(index);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

loadDb();

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  // Permissive CORS: this is a trusted-network tool and the iOS app + Vite dev
  // server talk to it from other origins.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  try {
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
    } else {
      serveStatic(res, pathname);
    }
  } catch (err) {
    json(res, 400, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Master backend running at http://localhost:${PORT}`);
});
