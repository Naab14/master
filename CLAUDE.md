# Master — project guide for Claude

Read this first in every session. Then read [`docs/ROADMAP.md`](docs/ROADMAP.md)
for current status, who is working on what, and past decisions.

## What this is

One tool for running a shift team, merged from three earlier apps:

| Module | Was | Does |
| --- | --- | --- |
| **Shift HQ** | `naab14/manageclip` | Daily leader standard work: task calendar, activity log, quick-link hub, weekly review + PDF |
| **Vacations** | `naab14/vacation-planner` | Operator vacation planning and week-by-week coverage vs demand |
| **Boards** | `naab14/frieday` | monday.com-style boards: groups, columns, table + kanban |

A **Dashboard** joins them: today's tasks and overdue count, this week's
coverage and who's out, and work items by status.

**Owner:** a shift manager. This is a hobby project, not company software.
The owner isn't a developer: explain things in plain language, do setup work
end to end where tools allow, and keep the steps you hand over short and exact.

## Working in threads

The project is worked on in separate threads, all reading this file:

- **Design:** look and feel, layout, mobile, theming, UX copy
- **Features:** new capabilities and fixes, end to end (web, API, data, iOS)
- **Strategy:** direction, priorities, users, privacy, costs; produces
  decisions and roadmap changes, not code

Rules so threads don't collide:

- `docs/ROADMAP.md` is the shared source of truth. Claim work in **In
  progress** (with the thread name) before starting, and record decisions in
  its **Decisions** log with a date. Don't keep important context only in a
  chat.
- One branch and one PR per piece of work, branched from the latest `main`.
  Before starting, check open PRs so you don't edit the same files as another
  thread.
- When a thread changes something every thread should know (architecture,
  conventions, deploy setup), update this file in the same PR.

## Architecture

```
api/index.js        Vercel serverless function: every /api route, data in Supabase
backend/core.js     the API routes, independent of storage (shared)
backend/auth.js     who may call the API: Google login allowlist / access code (shared)
backend/server.js   self-hosted server: same routes, data in backend/data/db.json
apps/web/           React 19 + Vite + Tailwind 3 (plain JS, no TypeScript)
  src/App.jsx         shell: sign-in phases, nav rail, hash routing (#/dashboard …)
  src/dashboard/      cross-tool dashboard
  src/tools/manageclip|vacation|boards/
  src/api.js, access.js, auth.js   API client, credentials, Supabase login
apps/ios/           SwiftUI app with haptics (Xcode 16+, can't be built on Linux)
supabase/migrations/  database schema
docs/AUDIT.md       how the three source apps mapped in
docs/design/        redesign handover: HANDOVER.md, mockups (.dc.html), old screenshots
```

**Data:** one Supabase table, `app_state`, with one row per section:
`boards` (`{members, boards}`), `manageclip` (`{tasks, logs, links, settings}`)
and `vacation` (`{operators, vacationBlocks, demand, settings}`, or null until
first use). Every write bumps `version`, and `api/index.js` retries on version
conflicts, so concurrent saves aren't lost. RLS is on with no policies: only
the server's secret key reaches the table.

**Web data flow:** the tools keep a localStorage cache for offline use and
sync to the API (Vacations and Shift HQ PUT the whole section after a 500 ms
debounce and only after loading the server copy; Boards use granular REST
calls). Theme colors are CSS variables in `apps/web/src/index.css`; use them
rather than hard-coded colors.

## Deployment

- **Vercel** project `master`, team `naab14s-projects`. Production:
  https://master-mocha-pi.vercel.app. Pushes to `main` deploy to production;
  PR branches get preview deployments behind Vercel login.
  `vercel.json` builds `apps/web` and routes `/api/*` to `api/index.js`
  (region `arn1`, Stockholm).
- **Supabase** project `master`, ref `wsqpjlhhfonkqhrxqgre`, region eu-north-1.
- **Vercel environment variables** (names only; never commit values):
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret), `SUPABASE_PUBLISHABLE_KEY`,
  `ALLOWED_EMAILS` (turns Google login on), `APP_ACCESS_CODE` (optional).
- **Sign-in:** see `backend/auth.js`. Current state is in the roadmap.

## Commands

```sh
npm --prefix apps/web install
npm --prefix apps/web run test:ci   # vitest (168 tests)
npm --prefix apps/web run lint
npm --prefix apps/web run build
node backend/server.js              # self-hosted API + built web app on :3000
npm --prefix apps/web run dev       # Vite dev server, proxies /api to :3000
```

## Conventions

- Before a PR: lint, tests and build clean. For behavior changes, drive the
  real app in a browser (Playwright with Chromium at `/opt/pw-browsers/chromium`)
  against a running backend, not just unit tests.
- PRs open as drafts. Codex reviews when a PR is marked ready; address its
  findings (reproduce, fix, verify) before merging.
- Never commit secrets or keys. Test against real data carefully: don't leave
  test data in production Supabase.
- The backend stays dependency-free Node (CommonJS). The web app is plain JS.
- Swift can't be compiled in the Linux container: keep iOS changes small,
  mirror the API contract exactly, and say they're unverified.
