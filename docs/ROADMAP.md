# Roadmap

The shared status page. Requirements live in [`REQUIREMENTS.md`](REQUIREMENTS.md);
the exact place to resume is in [`HANDOFF.md`](HANDOFF.md). Log decisions at
the bottom with a date.

## In progress

| What | Where | Status |
| --- | --- | --- |
| Workforce planning build (the 2026-11-09 brief) | Branch `claude/naab14-shift-management-qmu4s9`, draft PR #6. **One branch, one PR** for all of it | Phases 1–6 built and browser-tested; see the table below. Not deployed: `main` and production are unchanged |
| Design foundation, PR #4 | Included in PR #6 | Merged into the working branch; PR #4 left open and untouched |
| Strategy docs, PR #5 | Included in PR #6 | Merged into the working branch; PR #5 left open. Where it conflicts with the brief, the brief wins (see Decisions) |

## Status by requirement

"Built" means it works in the app and was driven in a real browser against a
local server with the 40-operator demo plant. Nothing here has run against
production data or real Google sign-in yet.

| Area | Built | Not built yet |
| --- | --- | --- |
| **Calendar and patterns** (C1–C8) | People-by-date grid and month calendar; smooth zoom (slider, buttons, Ctrl+wheel); Today/Week/Month; view, filters, zoom and scroll remembered; repeating patterns per team or person, fixed and rotating; change one day or from a date onward with history kept; each process runs its own shifts; team moves with optional manager confirmation; overnight shifts, Swedish time, DST-correct hours, ISO week 53 | A true hour-by-hour day grid (the day panel has a 30-hour timeline strip); public holidays marked in the schedule; shift time overrides in the UI (the data model has them) |
| **Coverage** (K1–K9) | Matrix with configurable levels; certificates with expiry judged on the planned date; requirements per process, shift and weekday; templates (normal / low season) by date range; day and week adjustments; one person never fills two dedicated positions; shared roles; tasks with fixed window or flexible hours shown as competing demands; trainees count only next to a supervisor, configurable per level and process; find-by-skill chips; leave planning with gaps, replacements and knock-on gaps; wording says "possible", never "assigned" | **Digital line assignments** (optional toggle): not built. Time-window overrides for line positions (only tasks have windows). The trainee step is a simple pass after the main matching, so a trainer is not deliberately steered to the process that needs supervising |
| **Attendance and reports** (A1–A6) | Day register; configurable reasons; partial days by hours or times; comment-only entries flagged, never given a duration; month review with deviations, overtime, sick, vacation, other absence, late, OB per rule; OB from configurable rules with priority, public holidays and a CSV preview; receipt-style and team summaries; grouping by employment; print/PDF; no locking; change log with who, when, old and new | OB rules ship empty: **the owner's workplace rules are needed**. Breaks are not deducted from OB. Excel `.xlsx` files are not read directly (CSV or paste) |
| **Profiles** (P1–P5) | One profile (real name, nickname, photo, colour, employment type, team history, notes); employment filter/grouping and a subtle marker with admin-set style; nickname use per view; CSV/paste import with preview, validation, duplicate handling | The older **Vacations** tool still has its own operator list. Its approved leave shows in the schedule when names match, but the lists are not merged |
| **Training** (T1–T3) | Thin spots per team and competency; planned training with trainer, period, progress, status; expiring certificates; trainee counting rules | Training sessions do not reserve time in the schedule |
| **Events and existing tools** (E1–E3) | Weekly/monthly calendar activities on the dashboard, calendar and day panel, never affecting staffing; dashboard cards for today's coverage, who is away, short shifts in the next two weeks, pending team moves, expiring certificates; Shift HQ, Vacations and Boards unchanged and working | Turning a shift task into a board item; a weekly review across all tools |
| **Design and interaction** (D1–D6) | Three themes (Calm, Arcade, Night) across the new screens via shared tokens; drag with mouse and long-press touch, drop targets, immediate simple moves, confirm for swaps and from-date changes; Undo toast, Ctrl/Cmd+Z, redo; arrow keys, shift-code keys, changeable shortcuts; undo refused when a colleague changed the item since; detail panels with fullscreen, phone full-screen sheets; collapsible sections remembered; reduced-motion respected | A fourth "cartoon/pop" theme; per-user theme saved on the server (it is per browser); the three older tools still carry their original look; no formal accessibility audit |
| **Printing and languages** (L1–L2) | A4/A3, portrait/landscape print layouts with headings, date ranges, legends and page splitting for the schedule, competency matrix, month review and receipts; English and Swedish for every new screen, with a test that fails on a missing translation; dates and numbers follow the language | **Shift HQ, Vacations, Boards and the old dashboard cards are English only.** Server error messages are English |
| **Login and permissions** (S1–S5) | `ADMIN_EMAIL` names the admin; uninvited Google accounts are refused and queued for approval; invitations, roles, a permission table the admin edits; all enforced on the server, including the older tools; team-limited team leads; operator read access prepared and off; offline read-only with banner, last-update time and paused editing; cache cleared on sign-out | **Google sign-in itself has never been switched on** (needs the owner's Google OAuth client). Operator screens and vacation requests. Shift HQ and Vacations keep their own older offline caches |
| **Excalidraw** (X1–X4) | The real Excalidraw editor embedded; multiple named boards, saved and reopened; private until shared, with no admin bypass in the app; sharing with workspace users; outside guests behind an admin switch, limited to shared boards; links to activities and web addresses | **Live collaboration is not built.** Others' saves appear within seconds, and simultaneous saves are detected, not merged. See "Excalidraw collaboration" below |
| **Optional AI** (AI1–AI3) | Nothing depends on AI | **Not built**: no admin settings, no provider, no key storage |
| **Platforms** (W1–W3) | Installable web app (manifest, icons, service worker for the app shell); phone layout with bottom tabs | Not yet installed on a real phone; iOS app untouched and behind (see below) |

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

In order. Each is independent enough to pick up alone.

1. **Owner decisions** in `REQUIREMENTS.md` §16 (sick/late data, hosting
   plan, OB rules).
2. **Go live safely**: the steps in `HANDOFF.md` (migration, `ADMIN_EMAIL`,
   Google provider), then verify sign-in on a phone.
3. **Merge people**: make Vacations read the shared profiles.
4. **Translate and restyle the three older tools** and the old dashboard cards.
5. **Digital assignments** (optional toggle) and time windows for line positions.
6. **Operator screens**: own schedule, training, competencies, leave requests.
7. **Live Excalidraw collaboration** over Supabase Realtime.
8. **Optional AI settings** (off and hidden by default).
9. Hour-level day grid, holidays in the schedule, training time reservations.

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
