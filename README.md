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
├── api/            # Vercel serverless function: the API, data in Supabase
├── backend/        # API routes (core.js) + self-hosted server on db.json (server.js)
├── apps/
│   ├── web/        # React 19 + Vite + Tailwind: dashboard + 3 tool sections
│   └── ios/        # native SwiftUI app with haptics (build in Xcode)
└── docs/AUDIT.md
```

Everything shares **one store** through one JSON REST API; the web and iOS
apps are just two clients of it. The routes live in `backend/core.js` and run
in two places:

- **Vercel** (`api/index.js`): data in a Supabase table, `app_state`, one row
  per section (boards, shift data, vacations). Concurrent saves are safe:
  each row has a version number and a save that loses a race retries on the
  fresh data.
- **Self-hosted** (`backend/server.js`): data in `backend/data/db.json`.

Optionally set `APP_ACCESS_CODE` to require an access code on every API
request. Without it the API is open to anyone with the URL. With it, the web
app asks for the code once per device, and the iOS app has a field for it in
Settings.

## Running

### On Vercel + Supabase

1. In Supabase, run [`supabase/migrations/001_app_state.sql`](supabase/migrations/001_app_state.sql)
   once (creates the `app_state` table, locked to the server).
2. Import the repo in Vercel and leave Root Directory and Framework Preset as
   they are; `vercel.json` sets the build and routes `/api/*` to the function.
3. In the Vercel project's **Settings → Environment Variables**, add:
   - `SUPABASE_URL`: `https://<project-ref>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: the project's secret key (Supabase →
     Project Settings → API Keys). Server-side only; never put it in the web app.
   - `APP_ACCESS_CODE` (optional): a code people must type to open the app
4. Redeploy and open the site.

### Self-hosted backend + web app

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
