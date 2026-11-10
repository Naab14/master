# Roadmap

The shared status page. Requirements live in [`REQUIREMENTS.md`](REQUIREMENTS.md);
the exact place to resume is in [`HANDOFF.md`](HANDOFF.md). Log decisions at
the bottom with a date.

## In progress

| What | Where | Status |
| --- | --- | --- |
| Workforce planning build (brief of 2026-11-09, corrections of 2026-11-10) | Branch `claude/naab14-shift-management-qmu4s9`, PR #6. **One branch, one PR** | Released to production on 2026-11-10 in a **locked** state: the site refuses everyone until Google sign-in and an admin are set up. See `HANDOFF.md` for what the owner must do |
| Design foundation (PR #4), Strategy docs (PR #5) | Included in PR #6 | Their commits are part of PR #6; the two PRs were left untouched |

## Status by requirement

"Built" means it works in the app and was driven in a real browser. The
planning screens were also checked on the Vercel preview with real sign-in
tokens. **Google sign-in itself has not been exercised**: it is not switched
on in Supabase yet.

| Area | Built | Not built yet |
| --- | --- | --- |
| **Calendar and patterns** (C1–C8) | People-by-date grid and month calendar with a legend; smooth zoom; Today/Week/Month; view, filters, zoom and scroll remembered; repeating patterns per team or person; change one day or from a date onward with history kept; each process runs its own shifts; team moves with optional manager confirmation; overnight shifts, Swedish time, DST-correct hours, ISO week 53 | An hour-by-hour day grid (the day panel has a timeline strip); public holidays marked in the schedule; shift time overrides in the UI |
| **Coverage** (K1–K9) | Matched stretch by stretch through the shift, so requirement **time windows**, **part-day absences with known times** and **booked training time** are handled; one person never fills two positions at once but can cover two that follow each other; shared roles; flexible tasks fit into free time or show as competing demands; trainees only next to a supervisor; certificates judged on the planned date; templates and day/week adjustments; the day panel shows **Qualified → Available → Possible** as three numbers; leave planning with gaps and replacements; skill gaps count demand at the same time | **Digital line assignments** (optional toggle). A part-day absence given only as hours (no times) can't be placed: the person still counts and is flagged. The trainee step does not steer a trainer toward the process that needs supervising |
| **Attendance and reports** (A1–A6) | Day register; configurable reasons; partial days by hours or times; comment-only entries flagged, never given a duration; month review; **receipt-style summaries on screen**, per person and as a Receipts view for the team; grouping by employment; no locking; change log with old and new values; OB from configurable rules with priority, holidays and a CSV preview | **OB rules are not configured**: the owner supplies them later. Until then every OB figure reads "OB rules not configured", never zero. Breaks are not deducted from OB. No printing (removed on request) |
| **Profiles** (P1–P5) | One profile per operator; **Vacations operators are linked to profiles by id**, names follow the profile, nothing is matched by name; employment filter, grouping and marker; nickname use per view; CSV/paste import with preview | Vacations still keeps its own S1/S2 and process list for its week view. Older Vacations operators stay "unlinked" until linked by hand |
| **Training** (T1–T3) | Thin spots per team and competency with correct concurrent demand; planned training with trainer, period, progress; optional time off the line that takes trainee and trainer out of coverage; expiring certificates | Training does not appear as its own block in the schedule grid |
| **Events and existing tools** (E1–E3) | Weekly/monthly activities on the dashboard, calendar and day panel, never affecting staffing; dashboard planning cards; Shift HQ, Vacations and Boards working | Turning a shift task into a board item; a weekly review across all tools |
| **Design and interaction** (D1–D6) | Three themes; **motion throughout**: panels slide in and out (from the bottom on phones), sections open by height, views rise in, dragged shifts lift and glide to their place, changed cells pulse (also after Undo or a colleague's edit), hover and press states, toasts slide out; all instant with reduced motion; drag with mouse and long-press; Undo/Redo that never overwrites a colleague; keyboard and changeable shortcuts | A fourth "cartoon/pop" theme; theme saved per user on the server; Shift HQ, Vacations and Boards keep their older look and have no new motion; no formal accessibility audit |
| **Languages** (L1) | English and Swedish for the planning screens, sign-in, dashboard and theme switcher, with a test that fails on a missing translation | **Shift HQ, Vacations and Boards are English only.** Server error messages are English. Printing was removed from scope |
| **Login and permissions** (S1–S5) | Production is **locked** until an admin is configured: no anonymous access. Only Google sessions count (a password login is refused even on a Google-linked account). Uninvited accounts are refused and queued for approval; invitations, roles, a permission table; all enforced on the server; team-limited team leads; sign-out clears cached data and the session stops working within 20 seconds; offline read-only with banner. Preview deployments use their own table | **Google is not switched on in Supabase** (owner's step). Operator screens and vacation requests. Shift HQ and Vacations keep their own older offline caches |
| **Excalidraw** (X1–X4) | The real Excalidraw editor; named boards saved and reopened; private until shared, no admin bypass; sharing; outside guests behind an admin switch; links | **Not live collaboration.** Saved changes from others appear within seconds; simultaneous saves are detected, not merged. The app says so on the Sketches page |
| **Optional AI** (AI1–AI3) | Nothing depends on AI | **Not built** |
| **Platforms** (W1–W3) | Responsive web app for the phone's browser with bottom tabs and full-screen panels; offline read-only kept | No install prompt or app icon (removed on request). iOS app sidelined |

### Excalidraw collaboration: the honest assessment

- The drawing component does not include collaboration. The official
  approach needs a relay server that keeps connections open
  ([excalidraw-room](https://github.com/excalidraw/excalidraw-room)).
- **Vercel's serverless functions can't host that relay.**
- **Supabase Realtime** (already part of the project's free plan) could
  carry the messages. It needs: the browser talking to Supabase directly,
  private channels with database policies so only people a board is shared
  with can join, and merge logic in the app. That is real security work,
  and it only makes sense once Google sign-in is live.
- No extra paid service is required for that route. It has not been
  started. Until then the app says clearly that boards are not live.

### iOS app

Sidelined, as the brief allows. `apps/ios` has never been compiled, knows
nothing about the new planning data, and will be refused by the API once
Google sign-in is on unless `APP_ACCESS_CODE` is set. Use the web app on
the phone (it can be added to the home screen).

## Next

In order.

1. **Owner: switch Google sign-in on and name the admin** (`HANDOFF.md`).
   Then verify the real Google login on a computer and a phone.
2. **Owner: supply the OB rules.**
3. **Translate and restyle Shift HQ, Vacations and Boards**, with the same
   motion as the planning screens.
4. **Vacations on the planning model**: replace its S1/S2 and process list
   with teams, shifts and competencies from planning.
5. **Digital assignments** (optional toggle).
6. **Operator screens**: own schedule, training, competencies, leave requests.
7. **Live Excalidraw collaboration** over Supabase Realtime.
8. **Optional AI settings** (off and hidden by default).
9. Hour-level day grid, holidays in the schedule.

## Tech debt

- The main bundle is large (about 0.5 MB plus the holidays data and the
  Excalidraw chunk, both loaded only when needed). Split further.
- `workforce` and `attendance` are single JSON documents. Fine for 40
  people and a few years; move attendance to its own table if it grows.
- The access-code prompt stays as a fallback for local use.
- The planning screens poll every 30 seconds; there is no push.

## Done

- 2026-07: Consolidated the three apps into this repo: dashboard, web app,
  iOS app (PR #1).
- 2026-10-25: Fixed the Codex findings: lost Shift HQ edits, Vacations
  overwriting the saved plan, share links, boards on phones.
- 2026-10-25: Moved to Vercel + Supabase, with concurrency-safe saves.
- 2026-10-25: Made the access code optional (PR #2), so the app is open
  while testing.
- 2026-11-09: Google login merged (PR #3). It has not been switched on: no admin or allow list is set in Vercel.
- 2026-11-09: Workforce planning phases 1–6 built on the working branch (PR #6, not merged).

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-07 | Native SwiftUI for iOS, plus a web app | Best haptics and iOS feel; the web keeps desktop use |
| 2026-07 | Dashboard + separate tools, not one merged workflow | Keeps each tool's depth while giving one overview |
| 2026-10-25 | Host on Vercel with data in Supabase (one `app_state` table, one row per section) | Owner's choice. One JSON document per section keeps the original data models intact |
| 2026-10-25 | Google login through Supabase Auth with an email allowlist | Owner wants Google sign-in. Supabase is already in use, and the allowlist keeps random Google accounts out |
| 2026-10-25 | No login while testing; real data only after login is live | Owner wants no friction during testing |
| 2026-10-25 | Redesign follows `docs/design/HANDOVER.md`; mockups are visual specs, not code to copy | Design exploration done with the owner on a design canvas |
| 2026-10-25 | Three app-wide themes (Calm, Arcade, Night shift): same layouts, only tokens change. They replace the four Vacations-only themes | One visual language across the tools; the theme is a personal choice |
| 2026-10-25 | Status colors: green/amber/red mean coverage and work status only. Leave is blue (solid approved, dashed pending, grey draft, dotted requested) | Color should follow priority; holiday stripes were the loudest thing on screen |
| 2026-10-25 | Schedule zoom 3 → 6 → 12 → 18 months (Ctrl + scroll and −/+); operator cards that flip; Sketch tab with Excalidraw | Owner's picks from the design exploration |
| 2026-10-25 | Calm is the default theme; the theme is saved per browser until login can store it per user | Owner's choice. Light reads best on the floor |
| 2026-10-25 | Old `--accent` stays a fill that carries white text in every theme (Arcade `#3A7CA5`, Night `#7357E0`) | Tools and sign-in put white text on it; as text it is about 3:1 until each tool is redesigned |
| 2026-10-25 | Proposed, not yet planned: admin "All teams" page, roles, multi-team, work-account sign-in | From the handover. Needs a Strategy decision (who is it for) and Build work on auth; Design only builds the look until then |
| 2026-10-27 | Focus: people and skills, coverage, and today. Shift HQ supports; Boards frozen; Sketch parked | Owner wants one overview of team strength that replaces the Excel sheets (`docs/STRATEGY.md`) |
| 2026-10-27 | Users in order: owner, then shift managers and team leads, then operators | Each stage starts only when the one before is used weekly |
| 2026-10-27 | Data: display name, shift, certifications, system access (yes/no), vacations, "out today". No absence reasons, lateness, IDs or contact details | Real employee data isn't allowed in a hobby app; absence reasons are health data |
| 2026-10-27 | No lateness tracking | Employee monitoring needs the employer, HR and the union |
| 2026-10-27 | Certifications are an overview; the official GMP training record stays in the company system | The app isn't a validated system |
| 2026-10-27 | Google sign-in for everyone, invite-only; invite list moves into the app in R2 | Owner wants "just sign in with Google"; an open door would expose the team |
| 2026-10-27 | Web app on the phone first; native iOS app paused (moved to Later) | Owner doesn't need the iOS app, but sign-in must work on an iPhone |
| 2026-10-27 | Stay on free plans; add a daily keep-alive so Supabase doesn't pause | Owner's budget is the existing membership |
| 2026-10-27 | Multi-team admin and work-account SSO from the design handover move to Later | They come after the pilot; Google sign-in replaces work-account SSO for now |
| 2026-10-27 | New ideas go to `docs/IDEAS.md` first; Strategy triages them into the roadmap | Keeps the brainstorm out of the build threads |
| 2026-11-09 | The brief in `REQUIREMENTS.md` replaces the release order of 2026-10-27 and wins where they conflict | Owner's instruction |
| 2026-11-09 | Attendance records include sick and late, reversing the 2026-10-27 "no absence reasons, no lateness" rule | The brief asks for them. Flagged to the owner: get the employer's go-ahead before entering real people's sick/late records |
| 2026-11-09 | One branch and one draft PR (#6) for the whole build; PRs #4 and #5 merged into it and left open | Owner found scattered PRs confusing. Overrides "one PR per piece of work" for this build |
| 2026-11-09 | Admin is the configured `ADMIN_EMAIL`; everyone else is invited in the app; roles and a permission table are enforced on the server | First signup must never become admin; hiding buttons is not security |
| 2026-11-09 | Planning data is saved per entity with a version; an edit or undo based on an old version is refused | Concurrent edits and Undo must not overwrite a colleague |
| 2026-11-09 | Coverage is computed by matching people to positions and is always worded as "possible" | The whiteboard decides positions; one person can't fill two |
| 2026-11-09 | No OB rules or rates are built in | Collective-agreement terms must come from the owner |
| 2026-11-09 | Printing uses the browser's print (Save as PDF) with dedicated page layouts, not the old ASCII-only PDF writer | Swedish letters, A4/A3, portrait/landscape |
| 2026-11-09 | Excalidraw boards are private to the owner with no admin bypass; live collaboration deferred to Supabase Realtime | Vercel can't host a relay; no paid service needed, but it is real security work |
| 2026-11-09 | New dependency: `@excalidraw/excalidraw` (MIT), loaded only when a board is opened; fonts served from our own site | Requirement X1; no outside requests |
| 2026-11-09 | The web app is the product (installable PWA); the iOS app is sidelined | The brief; the iOS app would slow the web release |
| 2026-11-10 | Printing and install prompts removed from scope; receipts are an on-screen format | Owner's correction |
| 2026-11-10 | The production site is locked until an admin is configured; open access only on a home computer and on Vercel-protected previews | Owner: never release with anonymous admin access |
| 2026-11-10 | Preview deployments use their own table (`app_state_preview`) | Trying a branch must never touch production data |
| 2026-11-10 | The admin can be named in the database (`owners` in the admin section) as well as with `ADMIN_EMAIL`; the API cannot change either | The Vercel connector can't edit environment variables; the database route needs no redeploy |
| 2026-11-10 | Only OAuth (Google) sessions are accepted, checked on the server from the verified token | Email sign-up is open in Supabase by default; a password must never be a way in |
| 2026-11-10 | Coverage is matched per stretch of the shift | Time windows, part-day absences and training need time, not just head counts |
| 2026-11-10 | Vacations operators link to profiles by id; no name matching anywhere | Owner's correction |
| 2026-11-10 | The paused free Supabase project was restored; migrations 002 and 003 applied after a backup copy (`app_state_backup_20261110`) | Production was failing because the database had auto-paused; migrations verified byte-identical for existing data |
