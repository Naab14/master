# Roadmap

Shared by every thread (Design, Features, Strategy). Keep it current: claim
work before starting, move it when done, and log decisions with a date.

## In progress

| What | Thread | Status |
| --- | --- | --- |
| Strategy, roadmap order, ideas inbox | Strategy | Branch `strategy/direction`. `docs/STRATEGY.md`, `docs/IDEAS.md` |
| Google login (Supabase Auth + email allowlist) | Build (original thread) | Code in PR #3. Waiting on the owner for a Google OAuth client ID and secret, a Supabase access token, and the allowed emails. Then: enable the Google provider in Supabase, set `ALLOWED_EMAILS` in Vercel, merge, verify. |

## Next

Ordered by `docs/STRATEGY.md`. Finish a release before starting the next.

### Release 1: the owner checks it (target early November)

- **Google login live** (owner + Build thread): owner provides the Google
  OAuth client, a Supabase access token and the invite emails; then merge
  and verify, including on an iPhone in Safari.
- **Design foundation** (Design): finish and merge PR #4, then the app shell.
- **Dashboard answers the main question** (Design): this week's coverage,
  gaps and who's out, readable on a phone without clicking.
- **Vacations opens on the current week** (Features), not week 15, and
  handles ISO week 53.
- **Fix the "Can't reach the backend" banner** (Features): it tells people
  to run `node backend/server.js`, which is wrong on Vercel.
- **Keep Supabase awake** (Features): a daily Vercel cron that reads the
  database, so the free project doesn't pause after a week without use.

### Release 2: leaders pilot (November–December)

- **Team module** (Features + Design): one people list (merge Boards
  members and Vacation operators), certifications and system access
  (yes/no per system), and where the team is thin. Label certifications as
  an overview, not the official record.
- **Import from Excel** (Features): CSV import for people, certifications
  and vacations, so retiring a sheet takes minutes.
- **Invite list in the app** (Features): the owner adds and removes Google
  emails without touching Vercel. Two roles: manager (edit) and viewer
  (read). Enforced on the server.
- **Skill gaps in coverage** (Features): warn when an approved vacation
  leaves a process without enough certified people.
- **Retention** (Features): delete vacation entries older than 12 months.

### Release 3: operators (from January)

- **Operator view:** own vacations and certifications, request leave.
- **Out today:** mark someone out for today, no reason stored.
- **Decide on employer involvement** (Strategy) before inviting operators.

## Later

- Multi-team admin page and work-account SSO (from the design handover).
- Sketch tab (Excalidraw), once there's a concrete use.
- Native iOS app: first Xcode build, Google sign-in (ASWebAuthenticationSession
  + PKCE). Until then, iPhone users use the web app.
- Weekly review PDF covering all tools; reminders for overdue tasks.
- Cross-tool links (shift task to board item).

## Backlog

### Design
- Mobile pass: Vacations' grid and Shift HQ's month calendar are dense on a
  phone (part of R1 where it touches the dashboard).
- Empty states that guide first use.

### Tech debt
- The main web bundle is about 1.4 MB (mostly the holidays data in
  Vacations); split it.
- The access-code prompt (`shell/AccessGate.jsx`) stays as a fallback; remove
  it once everyone signs in with Google.

## Done

- 2026-07: Consolidated the three apps into this repo: dashboard, web app,
  iOS app (PR #1).
- 2026-10-25: Fixed the Codex findings: lost Shift HQ edits, Vacations
  overwriting the saved plan, share links, boards on phones.
- 2026-10-25: Moved to Vercel + Supabase, with concurrency-safe saves.
- 2026-10-25: Made the access code optional (PR #2), so the app is open
  while testing.

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-07 | Native SwiftUI for iOS, plus a web app | Best haptics and iOS feel; the web keeps desktop use |
| 2026-07 | Dashboard + separate tools, not one merged workflow | Keeps each tool's depth while giving one overview |
| 2026-10-25 | Host on Vercel with data in Supabase (one `app_state` table, one row per section) | Owner's choice. One JSON document per section keeps the original data models intact |
| 2026-10-25 | Google login through Supabase Auth with an email allowlist | Owner wants Google sign-in. Supabase is already in use, and the allowlist keeps random Google accounts out |
| 2026-10-25 | No login while testing; real data only after login is live | Owner wants no friction during testing |
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
