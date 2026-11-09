# Handoff

The exact checkpoint for the next session. **Read this and run
`git status` before doing anything else.** Don't restart or redo finished
work. Last updated 2026-11-09.

## Where things are

| | |
| --- | --- |
| Branch | `claude/naab14-shift-management-qmu4s9` (pushed) |
| Pull request | https://github.com/Naab14/master/pull/6 (draft, the only PR for this work) |
| `main` / production | Unchanged. Nothing is deployed, no database change has been run |
| Uncommitted files | None |
| Last milestone | Phases 1–6 of the brief built and browser-tested, plus sketch boards (Excalidraw) and leave planning |

## What works (verified)

See the status table in `ROADMAP.md`. In short: schedule and calendar,
patterns with history, coverage, leave impact, attendance and month
reports with OB, people/matrix/import, training, roles and permissions,
English/Swedish, printing, offline read-only, installable app, sketch
boards.

## Tests run on the last commit, with results

| Check | Result |
| --- | --- |
| `npm --prefix apps/web run test:ci` | 215 passed, 19 files (174 existed before) |
| `npm --prefix apps/web run lint` | clean |
| `npm --prefix apps/web run build` | builds |
| Browser (Playwright + Chromium, local server, demo plant) | drag a shift, Undo toast, persists after reload, shift-code keys, Ctrl+Z, arrow keys, undo refused after a second browser changed the same shift, zoom remembered, print preview and print media, Swedish screens, offline banner and paused editing, phone layout, attendance entry flow, month review and receipt, leave planning, sketch draw/save/reload/remote update: all passed |

**Not verified anywhere:** real Google sign-in, the Supabase database
(only a stand-in in tests), installing the app on a real phone, real
printing on paper, the iOS app.

## Start it locally

```sh
npm --prefix apps/web install
npm --prefix apps/web run build
node backend/server.js            # http://localhost:3000, data in backend/data/db.json
# then: Setup → "Load the demo plant"
```

Local mode has no sign-in and treats you as admin. To try roles locally,
call the API routes through the tests in
`apps/web/src/workforce/backend.test.js`.

## To go live (needs the owner; nothing here has been done)

Do these in order. Steps 1–3 are safe on their own; the app keeps working
as today between steps.

1. **Database**: run `supabase/migrations/002_more_sections.sql` in the
   Supabase project `master`. It only widens which section names are
   allowed; it changes and deletes nothing. Until it runs, the old tools
   work and the new screens answer "The database needs an update".
2. **Merge PR #6** (owner's decision), which deploys to production.
3. **Admin**: in Vercel → project `master` → Settings → Environment
   Variables, add `ADMIN_EMAIL` = the owner's Google address, then
   redeploy. **This switches Google sign-in on**, so do step 4 first or the
   sign-in button won't work.
4. **Google provider** (the long-standing blocker): create a Google OAuth
   client (Web application, redirect URI
   `https://wsqpjlhhfonkqhrxqgre.supabase.co/auth/v1/callback`), enable
   Google under Supabase → Authentication → Providers with its client ID
   and secret, and set the Site URL to the Vercel address. Also set
   `SUPABASE_PUBLISHABLE_KEY` in Vercel if it isn't there.
5. Sign in, open **Access**, invite the team leads, then **Setup**.

Secrets go into Vercel/Supabase settings only, never into chat or files.

## Blockers and decisions waiting for the owner

1. Sick and late records for real people: employer go-ahead (see
   `REQUIREMENTS.md` §16). The feature is built; the decision is about data.
2. OB rules: supply the workplace rules (a document or sheet). None are built in.
3. Google OAuth client (step 4 above).
4. Whether to merge PR #6 now or after more of "Next" is done.
5. Hosting: Vercel Hobby is for non-commercial use.

## Spending

No paid service, plan, credit or domain was added. One free open-source
package was added (`@excalidraw/excalidraw`). No production resource was
created or changed. Claude account limits can't be inspected from inside a
session, so no claim is made about remaining usage.

## Exact next action

If the owner has answered nothing yet: start **"Merge people"** from
`ROADMAP.md` → Next (make `apps/web/src/tools/vacation` read
`wf.people` through `useWorkforce()` instead of its own operator list,
keeping its 174 tests green), on this same branch and PR.

If the owner wants to go live first: walk through "To go live" above with
them, then verify sign-in on a phone.

## Map of the new code

```
backend/access.js                roles, permission table
backend/core.js                  routes: /api/me, /api/admin/*, /api/workforce/*, /api/attendance/*, /api/sketches/*
supabase/migrations/002_…sql     allows the new sections (not applied)
apps/web/src/workforce/logic/    pure planning logic + tests (time, schedule, coverage, attendance, training, import)
apps/web/src/workforce/store.jsx load, optimistic save, conflicts, undo, offline cache
apps/web/src/workforce/*View.jsx Schedule, People, Attendance, Training, Setup, Admin (Access), Sketch
apps/web/src/i18n/               English/Swedish
apps/web/public/                 PWA manifest, icons, service worker
```
