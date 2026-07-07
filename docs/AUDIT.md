# Source Repo Audit

Audit of the three tools being consolidated into this master tool.
Snapshot taken 2026-07-07.

## The common thread

All three are **local-first internal tools for a shift manager running a team of
operators**:

- **ManageClip** covers the *daily* loop — what the manager does on shift (LSW tasks,
  activity log, quick links, weekly review).
- **Vacation Planner** covers the *staffing* loop — which operators are in or out,
  vacation approvals, and whether coverage demand is met week by week.
- **Frieday** covers the *project* loop — longer-running work items tracked
  monday.com-style on boards.

They share people (operators/persons), dates/weeks, and statuses, but today have three
disconnected UIs and three disconnected stores. None has auth.

## 1. ManageClip — Shift Management Dashboard (LSW)

- **Source**: `naab14/manageclip`, branch `main`.
- **Stack**: vanilla HTML/CSS/JS, zero dependencies, no build step (~1.6k lines total).
- **Persistence**: `localStorage` (`js/storage.js`), keys `smd.*`. Seeded sample data on
  first run.
- **Entities**:
  - `Task { id, title, description, due_date, status, category }`
  - `Log { id, entry_date, content, category }`
  - `Link { id, url, display_mode, display_name, icon_reference }`
  - `Settings` (weekly target etc.)
- **Screens**: Shift Command Center (month/week calendar, drag-and-drop, status colors),
  Activity Logger, Link Configuration Hub, Quick Action Clipboard (sidebar),
  Weekly Review Dashboard with client-side PDF export (`js/pdf.js`, "MiniPDF").
- **Theme**: "Neon Rush" — dark, `#00FFB4` accent, monospace.

## 2. Vacation Planner — operator vacation & coverage

- **Source**: `naab14/vacation-planner`, branch `master`.
- **Stack**: React 19 + Vite + Tailwind 3; `date-holidays` for public holidays;
  Vitest + Testing Library suite (`src/test/`, 15 test files).
- **Persistence**: `localStorage` (`src/storage.js`) with JSON export/import, share-via-URL
  (state compressed into the hash), undo/redo via `historyReducer`.
- **Entities** (`src/types.js`):
  - `Operator { id, name, shift: 'S1'|'S2', active, certifications[] }`
  - `VacationBlock { id, operatorId, startWeek, endWeek, status: draft|pending|approved|requested, dayStatuses?, note? }`
  - `Demand { [process]: { [week]: number } }`, `Settings { shiftMode, visibleWeeks, startWeek }`
- **Core logic**: `src/coverage.js` (coverage level green/yellow/red per week vs demand),
  `src/holidays.js`, `src/csv.js` (operator CSV import/export).
- **UI**: week/day-zoom calendar grid, operator panel, demand editor, coverage rows,
  legend, responsive breakpoints. Many themes.

## 3. Frieday — monday.com-style work management

- **Source**: `naab14/frieday`, branch `claude/monday-duplicate-tool-s0az6o`
  (**never merged** — `main` only has a README).
- **Stack**: zero-dependency Node 18+ server (`server.js`, ~390 lines) + vanilla JS
  frontend (`public/`, ~1.2k lines).
- **Persistence**: server-side `data/db.json`, flushed on every change — the only tool
  with shared/multi-device state today.
- **API**: JSON REST — `GET /api/state`, CRUD for boards / groups / items / columns,
  `POST /api/members`. No auth (built for trusted LAN use).
- **Entities**: Board → Groups (color-coded) → Items with per-column `values`;
  Column types: Status, Person, Date, Priority, Text, Number; Members (with avatars).
- **UI**: Main Table view with status distribution strips, Kanban by status with
  drag-and-drop, per-board search.

## Consolidation implications

1. **Backend**: only Frieday has a server, and it's the right shape — a tiny
   zero-dependency Node JSON API over a single JSON file. Extending it into the unified
   backend (adding `/api/manageclip/*` and `/api/vacation/*` state endpoints) gives web
   and iOS one shared store while "reusing what the tools use". The localStorage tools
   keep their data models unchanged, just moved server-side (with one-time import of
   existing localStorage/JSON backups).
2. **Web stack**: Vacation Planner is the largest, best-tested codebase — React + Vite +
   Tailwind becomes the shell; its components port over nearly as-is. ManageClip and
   Frieday UIs get ported into React sections reusing their existing logic
   (MiniPDF, coverage.js, csv.js, holidays.js are all framework-free and copy straight in).
3. **Shared concepts to unify**: Person (Frieday Member ↔ Vacation Planner Operator),
   dates/ISO weeks, status vocabularies. The dashboard joins them: today's tasks +
   overdue (ManageClip), this week's coverage level + who's out (Vacation Planner),
   open items by status (Frieday).
4. **iOS**: native SwiftUI app talks to the same JSON API; Frieday's "trusted network,
   no auth" deployment model carries over initially.
