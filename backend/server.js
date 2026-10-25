#!/usr/bin/env node
/**
 * Master — self-hosted backend for the consolidated shift-management tool.
 *
 * Grown from Frieday's zero-dependency Node server. The API routes live in
 * core.js (shared with the Vercel function in api/index.js); this file stores
 * the data in data/db.json (atomic writes) and serves the built web app from
 * ../apps/web/dist.
 *
 * Run:  node server.js   (PORT env var optional, defaults to 3000)
 * Set APP_ACCESS_CODE to require an access code on every API request.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { route, sectionsFor, normalizeSection, checkAccess } = require('./core');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = process.env.WEB_DIST || path.join(__dirname, '..', 'apps', 'web', 'dist');

// ---------------------------------------------------------------------------
// Persistence — db.json holds { members, boards, manageclip, vacation }
// ---------------------------------------------------------------------------

let db = null;

function loadDb() {
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    // first run — seeded below
  }
  // Also upgrades a plain Frieday db.json by adding the new sections.
  const boards = normalizeSection('boards', raw && Array.isArray(raw.boards) ? raw : null);
  db = {
    ...boards,
    manageclip: normalizeSection('manageclip', raw && raw.manageclip),
    vacation: normalizeSection('vacation', raw && raw.vacation),
  };
  if (!raw) saveDb();
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
// API
// ---------------------------------------------------------------------------

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

async function handleApi(req, res, pathname) {
  const denied = checkAccess(req.headers);
  if (denied) return json(res, denied.status, denied.body);

  const body = req.method === 'GET' ? {} : await readBody(req);
  const sections = {};
  for (const key of sectionsFor(pathname)) {
    sections[key] = key === 'boards' ? { members: db.members, boards: db.boards } : db[key];
  }

  const result = route(req.method, pathname, body, sections);

  if (result.dirty.length) {
    for (const key of result.dirty) {
      if (key === 'boards') {
        db.members = sections.boards.members;
        db.boards = sections.boards.boards;
      } else {
        db[key] = sections[key];
      }
    }
    saveDb();
  }
  return json(res, result.status, result.body);
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
  // Permissive CORS: the iOS app and the Vite dev server talk to it from
  // other origins.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Access-Code');
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
