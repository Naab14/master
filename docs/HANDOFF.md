# Handoff

The exact checkpoint for the next session. **Read this and run
`git status` before doing anything else.** Don't restart or redo finished
work. Last updated 2026-11-10.

## Where things are

| | |
| --- | --- |
| Branch | `claude/naab14-shift-management-qmu4s9` |
| Pull request | https://github.com/Naab14/master/pull/6 — the only PR for this work; merged to `main` on 2026-11-10 (its description holds the post-release check results) |
| Production | https://master-mocha-pi.vercel.app — deploys from `main`. **Locked**: it shows "Sign-in is not set up yet" and the API refuses everything until the owner's steps below are done |
| Preview | https://master-git-claude-naab14-shift-manageme-f00fc0-naab14s-projects.vercel.app — behind Vercel login, uses the test table `app_state_preview` with the made-up demo plant |
| Database | Supabase project `master` (free plan). Restored from auto-pause on 2026-11-10. Migrations 002 and 003 applied. Backup copy of the original three sections: table `app_state_backup_20261110` |
| Uncommitted files | None |

Any follow-up work after the merge starts from the latest `main` on the same
branch name and opens a new PR (a merged PR can't take more commits).

## What the owner must do to open the site

Nothing else is needed; no secret goes through chat.

1. **Create a Google sign-in client** (about five minutes, free):
   Google Cloud Console → *APIs & Services* → *Credentials* → *Create
   credentials* → *OAuth client ID* → type **Web application**.
   Under *Authorized redirect URIs* add exactly
   `https://wsqpjlhhfonkqhrxqgre.supabase.co/auth/v1/callback`.
   If Google first asks for a consent screen: type *External*, app name
   "Master", your own email; then set it to **In production** (Publish) so
   invited colleagues can sign in. Only name and email are requested, so
   Google needs no review.
2. **Enter it in Supabase**: project `master` → *Authentication* → *Sign In
   / Providers* → *Google* → switch on, paste the **Client ID** and **Client
   secret** from step 1, Save.
3. **Tell Supabase where the site is**: *Authentication* → *URL
   Configuration* → *Site URL* = `https://master-mocha-pi.vercel.app`.
4. **Name the admin account.** Either tell Claude which Google address is
   the admin (it is then stored in the database, no redeploy), or add
   `ADMIN_EMAIL` yourself in Vercel → project `master` → Settings →
   Environment Variables (Production) and press Redeploy.

Then: open the site, sign in with Google, open **Access** to invite team
leads, and **Setup** to enter shifts, people and requirements.

Recommended, optional: in Supabase → *Authentication* → *Sign In /
Providers* → *Email*, switch off sign-ups. The app already refuses password
logins; this just keeps strangers from creating unused accounts.

## Waiting on the owner in this session

- **A database clean-up needs confirming.** The Supabase connector asked for
  confirmation before deleting the three temporary test accounts
  (`…-test@master-test.invalid`) and got no answer. Until it runs: those
  accounts still exist (password logins, refused by the app), the preview
  shows the sign-in page instead of the open demo, and production has no
  stored public sign-in key yet. The statement to run again is in
  "Database statements" below.

## Checks run, with results

| Check | Result |
| --- | --- |
| `npm --prefix apps/web run test:ci` | 231 passed, 20 files |
| `npm --prefix apps/web run lint` | clean |
| `npm --prefix apps/web run build` | builds |
| Migration 002 on production | applied after a backup; the three existing sections are byte-identical (same md5 and version) before and after |
| Preview in a browser | Same Schedule as the earlier screenshot (with "Plan leave" where "Print" was); reads and writes only the preview table |
| Access, on the deployed preview with real Supabase tokens | No sign-in: every route refused. Made-up token refused. Configured admin is admin. Uninvited account refused and queued. Stranger can't approve themselves. Team lead (limited to one team): can record attendance for own team only, can't edit people, competencies, setup or Access. Sign-out clears the browser and the session stops working on the API. Google-only setting refuses a password account using the admin's address |
| Motion, in a running browser | 22 checks on desktop, phone and reduced motion: panel in/out, section height, view changes, drag lift/target/glide, pulse after drop and Undo, toast, hover, confirm dialog |

**Not verified:** a real Google login (Google is not switched on in
Supabase), a real phone, the iOS app.

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
-- Clean up after the access tests (waiting for confirmation, see above)
delete from auth.users where email like '%@master-test.invalid';
delete from public.app_state_preview where key = 'admin';
insert into public.app_state (key, data, version)
values ('admin', jsonb_build_object('owners', '[]'::jsonb, 'authConfig',
  jsonb_build_object('publishableKey', '<the project''s publishable key>'),
  'users', '{}'::jsonb, 'requests', '{}'::jsonb, 'permissions', '{}'::jsonb, 'settings', '{}'::jsonb), 1)
on conflict (key) do nothing;

-- Name the admin without a redeploy (replace the address)
update public.app_state
set data = jsonb_set(data, '{owners}', '["you@example.com"]'::jsonb), version = version + 1
where key = 'admin';
```

The publishable key is the public one (Supabase → Project Settings → API
Keys → "publishable"); it is meant to be visible to browsers. The secret
service key stays only in Vercel.

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

## Spending

No paid service, plan, credit or domain was added. Supabase stays on the
free plan (restoring a paused project is free; it pauses again after about
a week without use). One free open-source package (`@excalidraw/excalidraw`).

## Exact next action

1. When the owner confirms: run the clean-up statement above.
2. When the owner has done steps 1–3 and named the admin: check
   `/api/config` on production shows Google ready, ask the owner to sign in,
   then verify Access, an uninvited account and sign-out on production.
3. Then continue with `ROADMAP.md` → Next (translate and restyle the three
   older tools).

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
