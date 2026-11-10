# Handoff

The exact checkpoint for the next session. **Read this and run
`git status` before doing anything else.** Don't restart or redo finished
work. Last updated 2026-11-10.

## Where things are

| | |
| --- | --- |
| Production | https://master-mocha-pi.vercel.app — commit `b472699` (merge of PR #6), deployed 2026-11-10 and not redeployed since. **Google sign-in is active**; the admin is the owner's Google address |
| Pull requests | #6 merged (the whole build). This file's update is in a docs-only follow-up PR from the same branch name |
| Preview | https://master-git-claude-naab14-shift-manageme-f00fc0-naab14s-projects.vercel.app — behind Vercel login, uses the test table `app_state_preview` with the made-up demo plant, open without sign-in (by design, for previews only) |
| Database | Supabase project `master` (free plan). Migrations 001–003 applied. Backup copy of the original three sections: table `app_state_backup_20261110` |
| Uncommitted files | None |

Any further work starts from the latest `main` and opens a new PR.

## Configuration completed on 2026-11-10 (no secret values here)

| What | Where | By |
| --- | --- | --- |
| Google OAuth web client, with the Supabase callback as redirect address | Google Cloud | Owner |
| Google provider switched on, client ID and secret saved | Supabase → Authentication → Providers | Owner |
| Site URL set to the production address | Supabase → Authentication → URL Configuration | Owner |
| Admin account named (`owners`) and the public sign-in key saved (`authConfig.publishableKey`) | Production `admin` row in `app_state` | Claude, one SQL insert |

No Vercel environment variable was added and nothing was redeployed: the
API reads the `admin` row on every request. The service-role key stays only
in Vercel; the OAuth client secret stays only in Supabase.

## Temporary test accounts: removed

The three accounts created for the access tests were deleted on 2026-11-10,
selected by their exact ids, email addresses and a test marker set at
creation (`admin-test`, `lead-test` and `stranger-test` at
`master-test.invalid`). Their test-only access records (the preview table's
`admin` and `attendance` rows, which held nothing else) were removed too.

Checked afterwards: Supabase Auth holds no users, identities or sessions;
`boards`, `manageclip` and `vacation` in production are byte-identical to
the backup; the backup table has its three rows; the preview keeps its demo
rows (`boards`, `manageclip`, `workforce`).

## What still needs the owner

1. **Sign in once.** Open https://master-mocha-pi.vercel.app, press "Sign in
   with Google" and use the admin address. Google's page says "continue to
   wsqpjlhhfonkqhrxqgre.supabase.co": that is expected (Supabase handles
   the sign-in). This is the one check Claude cannot do.
2. If Google says the app is in testing and blocks a colleague later:
   Google Cloud → OAuth consent screen → Publish app.
3. Supply the OB rules when ready.
4. Merge the docs follow-up PR when convenient (it changes no code).

## Checks run, with results

| Check | Where | Result |
| --- | --- | --- |
| Tests, lint, build | Repository at `b472699` | 231 tests pass, lint clean, builds |
| Sign-in page replaces the locked page | Production, desktop and phone | Yes; button enabled; no app content or stored data before sign-in |
| Button → Supabase → Google | Production | Return address is the production site; callback is `…supabase.co/auth/v1/callback`; Google accepts the request and shows its sign-in form (no redirect or client error) |
| Anonymous requests | Production, 15 read and write routes | All refused (401) |
| Invalid tokens: random text, a forged token claiming the admin address, the public key | Production, same 15 routes each | All refused (401) |
| Old access-code header; direct links to `#/schedule`, `#/admin`, … | Production | Refused; only the sign-in page shows |
| The build served contains the new Schedule, no print controls, no install manifest | Production bundle | Yes |
| Existing Shift HQ, Vacations and Boards data | Database | Byte-identical to the backup |
| Admin recognised, uninvited account refused and queued, team-lead limits, sign-out clears the browser and ends the session, password account refused | **Preview**, with real Supabase tokens for temporary accounts (since deleted) | Passed. Not repeated on production: that needs real Google accounts |

**Not verified by Claude:** the owner's own Google login on production, and
therefore the signed-in production screens (Schedule with real data, Access,
sign-out). An uninvited real Google account on production. A real phone.

## Recovery

- **Bad release:** in Vercel → project `master` → Deployments, pick the
  previous production deployment → *Instant Rollback*. The older code works
  with the migrated database (the migration only allowed more section names).
  Note the older code has no sign-in.
- **Data:** the original `boards`, `manageclip` and `vacation` rows are in
  `app_state_backup_20261110`. To restore one:
  `update app_state a set data = b.data, version = a.version + 1 from app_state_backup_20261110 b where a.key = b.key and a.key = 'vacation';`
- **Undo migration 002** (only after deleting any `workforce`, `attendance`,
  `admin` or `sketches` rows): re-create the check constraint with the three
  original names.

## Database statements

Run by hand in the Supabase SQL editor, or through Claude.

```sql
-- Change or add an admin without a redeploy (replace the address)
update public.app_state
set data = jsonb_set(data, '{owners}', '["you@example.com"]'::jsonb), version = version + 1
where key = 'admin';
```

## Start it locally

```sh
npm --prefix apps/web install
npm --prefix apps/web run build
node backend/server.js            # http://localhost:3000, data in backend/data/db.json
# then: Setup → "Load the demo plant"
```

Local mode has no sign-in and treats you as admin. That is only possible
off the production site: with `VERCEL_ENV=production` the API is locked
unless an admin is configured.

## Spending and availability

No paid service, plan, credit or domain was added. Supabase stays on the
free plan. One free open-source package (`@excalidraw/excalidraw`).

The free Supabase project pauses after about a week without use; then the
site can't load data until it is restored (free, a few minutes, data
kept; Claude or the Supabase dashboard can do it). No automatic keep-alive
was added. Avoiding the pause entirely needs the paid Supabase plan: that
is a spending decision for the owner, not taken here.

## Exact next action

1. After the owner has signed in: confirm with them that Schedule, Access
   and sign-out work on production, and that their existing Shift HQ,
   Vacations and Boards data shows.
2. Then continue with `ROADMAP.md` → Next.

## Map of the code added in this work

```
backend/auth.js                  who is calling; production lock; Google-only sessions
backend/access.js                roles, permission table
backend/core.js                  routes: /api/me, /api/admin/*, /api/workforce/*, /api/attendance/*, /api/sketches/*
api/index.js                     Vercel function; preview deployments use app_state_preview
supabase/migrations/002, 003     more sections; preview table (both applied)
apps/web/src/workforce/logic/    planning rules + tests (time, schedule, coverage, attendance, training, import)
apps/web/src/workforce/store.jsx load, optimistic save, conflicts, undo, offline cache
apps/web/src/workforce/*View.jsx Schedule, People, Attendance, Training, Setup, Admin (Access), Sketch
apps/web/src/workforce/motion.js pulse and glide helpers; CSS motion in workforce.css
apps/web/src/tools/vacation/sharedPeople.js  operators linked to profiles by id
apps/web/src/i18n/               English/Swedish
```
