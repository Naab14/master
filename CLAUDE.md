# Master — project guide for Claude

Read this first in every session. Then, in this order:

1. [`docs/HANDOFF.md`](docs/HANDOFF.md): the exact checkpoint. Read it and
   run `git status` before doing anything; don't redo finished work.
2. [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md): what the product must do
   (the owner's brief of 2026-11-09). It wins over older documents.
3. [`docs/ROADMAP.md`](docs/ROADMAP.md): status per requirement, what's
   next, and the decisions log.

[`docs/STRATEGY.md`](docs/STRATEGY.md) is the earlier direction (2026-10-27);
still useful background, but superseded where it conflicts with the brief.

## What this is

One tool for running a shift team, merged from three earlier apps:

| Module | Was | Does |
| --- | --- | --- |
| **Shift HQ** | `naab14/manageclip` | Daily leader standard work: task calendar, activity log, quick-link hub, weekly review + PDF |
| **Vacations** | `naab14/vacation-planner` | Operator vacation planning and week-by-week coverage vs demand |
| **Boards** | `naab14/frieday` | monday.com-style boards: groups, columns, table + kanban |

On top of those sits **workforce planning** for about 40 operators, 3 shifts
and 4 processes: Schedule, People (profiles and competency matrix),
Attendance (register and monthly review with OB), Training, Sketches
(Excalidraw), Setup and Access.

A **Dashboard** joins them: today's possible coverage and who's away,
upcoming activities, what needs attention, tasks, and work items by status.

**Owner:** a shift manager. This is a hobby project, not company software.
The owner isn't a developer: explain things in plain language, do setup work
end to end where tools allow, and keep the steps you hand over short and exact.

## Working in threads

The project is worked on in separate threads, all reading this file:

- **Design:** look and feel, layout, mobile, theming, UX copy
- **Features:** new capabilities and fixes, end to end (web, API, data, iOS)
- **Strategy:** direction, priorities, users, privacy, costs; produces
  decisions and roadmap changes, not code. Also the owner's brainstorm:
  ideas land in `docs/IDEAS.md` and only reach the roadmap once triaged

Rules so threads don't collide:

- `docs/ROADMAP.md` is the shared source of truth. Claim work in **In
  progress** (with the thread name) before starting, and record decisions in
  its **Decisions** log with a date. Don't keep important context only in a
  chat.
- **The workforce build uses one branch and one draft PR**
  (`claude/naab14-shift-management-qmu4s9`, PR #6) until the owner says
  otherwise. Don't open extra or stacked PRs for it, don't merge or push to
  `main` without the owner's instruction, and don't force-push.
- For unrelated work: one branch and one PR per piece, from the latest
  `main`. Check open PRs first so you don't edit the same files.
- When a thread changes something every thread should know (architecture,
  conventions, deploy setup), update this file in the same PR.

## Architecture

```
api/index.js        Vercel serverless function: every /api route, data in Supabase
backend/core.js     the API routes, independent of storage (shared)
backend/auth.js     who is calling: Google login / access code (shared)
backend/access.js   what they may do: roles and the permission table (shared)
backend/server.js   self-hosted server: same routes, data in backend/data/db.json
apps/web/           React 19 + Vite + Tailwind 3 (plain JS, no TypeScript)
  src/App.jsx         shell: sign-in phases, nav rail, hash routing (#/dashboard …)
  src/dashboard/      cross-tool dashboard
  src/tools/manageclip|vacation|boards/
  src/workforce/      planning screens; logic/ holds the pure, tested rules
  src/i18n/           English and Swedish (sv.js); t('English text')
  src/ui/, src/theme/ shared controls and the three themes
  src/api.js, access.js, auth.js   API client, credentials, Supabase login
  public/             PWA manifest, icons, service worker (app shell only)
apps/ios/           SwiftUI app with haptics (Xcode 16+, can't be built on Linux)
supabase/migrations/  database schema
docs/AUDIT.md       how the three source apps mapped in
docs/design/        redesign handover: HANDOVER.md, mockups (.dc.html), old screenshots
```

**Data:** one Supabase table, `app_state`, with one row per section:
`boards` (`{members, boards}`), `manageclip` (`{tasks, logs, links, settings}`)
and `vacation` (`{operators, vacationBlocks, demand, settings}`, or null until
first use), plus `workforce` (people, teams, patterns, competencies,
requirements, training, activities, settings), `attendance` (entries and a
change log), `admin` (invited users, permissions) and `sketches`
(Excalidraw boards). Every write bumps `version`, and `api/index.js` retries
on version conflicts, so concurrent saves aren't lost. RLS is on with no
policies: only the server's secret key reaches the table.

**Planning data** is saved per entity: the web app sends operations to
`/api/workforce/ops` or `/api/attendance/ops`, each with the entity version
it last saw. The server refuses a stale one (409), so an edit or an Undo
never overwrites a colleague's change. Planning rules (who is scheduled,
coverage, OB) run in the browser from `src/workforce/logic`; the server
stores, checks permissions and logs.

**Permissions** are checked on the server for every route
(`backend/access.js`). Hiding a button in the web app is only a courtesy.

**Web data flow:** the tools keep a localStorage cache for offline use and
sync to the API (Vacations and Shift HQ PUT the whole section after a 500 ms
debounce and only after loading the server copy; Boards use granular REST
calls).

**Theming:** three app-wide themes (Calm, the default; Arcade; Night shift),
set as `<html data-theme>` and saved per browser (`src/theme/theme.js`).
Every color, font, radius and status shade is a token in
`apps/web/src/theme/tokens.css`; use tokens (or their Tailwind names like
`bg-panel`, `text-ink-3`) rather than hard-coded colors. Old variable names
(`--bg-primary`, `--accent` …) still work and point at the tokens. Base
controls live in `src/ui/` (review page: `#/ui`).

## Deployment

- **Vercel** project `master`, team `naab14s-projects`. Production:
  https://master-mocha-pi.vercel.app. Pushes to `main` deploy to production;
  PR branches get preview deployments behind Vercel login.
  `vercel.json` builds `apps/web` and routes `/api/*` to `api/index.js`
  (region `arn1`, Stockholm).
- **Supabase** project `master`, ref `wsqpjlhhfonkqhrxqgre`, region eu-north-1.
- **Vercel environment variables** (names only; never commit values):
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret), `SUPABASE_PUBLISHABLE_KEY`,
  `ADMIN_EMAIL` (the admin's Google account; turns Google login on),
  `ALLOWED_EMAILS` (older allow list, treated as managers), `APP_ACCESS_CODE`
  (optional).
- **Database migrations** in `supabase/migrations` are run by hand, with the
  owner's go-ahead. `002_more_sections.sql` is needed before the planning
  screens can save in production.
- **Sign-in:** see `backend/auth.js`. Current state is in the roadmap.

## Commands

```sh
npm --prefix apps/web install
npm --prefix apps/web run test:ci   # vitest (215 tests)
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
- Every user-facing text in `src/workforce` goes through `t('English text')`
  and needs a Swedish entry in `src/i18n/sv.js`; a test fails otherwise.
- Use the theme tokens (`src/theme/tokens.css`) and the shared controls in
  `src/ui` and `src/workforce/ui.jsx`. Lint is strict about React rules: no
  refs or `Date.now()` during render, components in their own files.
- Coverage wording is always "possible", never "assigned": positions are
  decided at the whiteboard. No OB rates or rules are built in.
- Demo and test data use made-up names.
- Swift can't be compiled in the Linux container: keep iOS changes small,
  mirror the API contract exactly, and say they're unverified.
