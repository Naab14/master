# Master

One tool for running a shift team, consolidating three previously separate
apps into a single streamlined workflow with a shared backend, a web app, and
a native iOS app.

| Module | What it does | Was |
| --- | --- | --- |
| **Shift HQ** | Daily LSW loop: task calendar, activity log, quick-link hub, weekly review + PDF | `manageclip` |
| **Vacations** | Operator vacation planning and week-by-week coverage vs demand | `vacation-planner` |
| **Boards** | monday.com-style boards: groups, columns, table + kanban | `frieday` |

A home **Dashboard** joins all three: today's shift tasks and overdue count,
this week's coverage level and who's out, and open work items by status.

See [`docs/AUDIT.md`](docs/AUDIT.md) for how the three source tools mapped into
this one.

## Architecture

```
master/
├── backend/        # zero-dependency Node JSON API + static host (grown from frieday's server)
├── apps/
│   ├── web/        # React 19 + Vite + Tailwind: dashboard + 3 tool sections
│   └── ios/        # native SwiftUI app with haptics (build in Xcode)
└── docs/AUDIT.md
```

Everything shares **one store** (`backend/data/db.json`) through one JSON REST
API. The web and iOS apps are just two clients of it. There is no auth — like
the tools it replaces, it's built to run on a trusted home/office network.

## Running

### Backend + web app

```sh
# 1. build the web app
npm --prefix apps/web install
npm --prefix apps/web run build

# 2. start the server (serves the API and the built web app on :3000)
node backend/server.js
#   → http://localhost:3000
```

For web development with hot reload, run the backend on `:3000` and the Vite
dev server alongside it (`npm --prefix apps/web run dev`) — Vite proxies `/api`
to the backend.

### iOS app

See [`apps/ios/RUN.md`](apps/ios/RUN.md). It needs a Mac with Xcode 16+; point
it at your computer's LAN address in the app's Settings tab.

## Tests

```sh
npm --prefix apps/web run test:ci   # 168 vitest tests (ported vacation-planner suite)
```
