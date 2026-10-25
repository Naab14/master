# Roadmap

Shared by every thread (Design, Features, Strategy). Keep it current: claim
work before starting, move it when done, and log decisions with a date.

## In progress

| What | Thread | Status |
| --- | --- | --- |
| Google login (Supabase Auth + email allowlist) | Build (original thread) | Code in PR #3. Waiting on the owner for a Google OAuth client ID and secret, a Supabase access token, and the allowed emails. Then: enable the Google provider in Supabase, set `ALLOWED_EMAILS` in Vercel, merge, verify. |
| Redesign, step 1: theme tokens (Calm, Arcade, Night shift), type scale, base controls, app-wide theme switcher | Design | Branch `design/foundation`. Spec in `docs/design/HANDOVER.md`. Then: app shell → Dashboard → Vacations → Shift HQ → Boards → Team cards |

## Next

- **iOS Google sign-in.** Once `ALLOWED_EMAILS` is set, the iOS app can only
  get in with `APP_ACCESS_CODE`. Add Supabase Google sign-in to the app
  (ASWebAuthenticationSession + PKCE) and send the session token.
- **First iOS build on a Mac.** The SwiftUI app has never been compiled; fix
  whatever the first Xcode build reports.
- **Real data only after login is live.** The app will hold employee names
  and vacations.

## Backlog

### Design
- One visual language across the three tools. They still look like separate
  apps: Vacations has its own top bar and themes (default, MotherDuck, dark,
  ocean), while Shift HQ and Boards follow the shell.
- Dark mode for the whole app, not just Vacations.
- Mobile pass: Vacations' grid and Shift HQ's month calendar are dense on a
  phone.
- Dashboard: richer cards (trends, what changed since yesterday), empty
  states that guide first use.

### Features
- Cross-tool links: turn a shift task into a board item; warn on the
  dashboard when an approved vacation drops coverage below demand.
- Shared people list: Boards members and Vacation operators are separate
  lists today.
- Weekly review PDF covering all three tools, not just Shift HQ.
- Notifications or reminders for overdue tasks.

### Strategy
- Who is it for: just the owner, or the shift team too? Drives login,
  sharing and roles.
- Privacy: employee names and vacation data. Keep it behind login, and
  decide how long data is kept.
- Costs: Vercel Hobby and the Supabase free plan today (free projects pause
  after inactivity). Decide when an upgrade is worth it.

### Tech debt
- The main web bundle is about 1.4 MB (mostly the holidays data in
  Vacations); split it.
- The dashboard's "Can't reach the backend" banner tells people to run
  `node backend/server.js`, which is wrong on Vercel.
- The access-code prompt (`shell/AccessGate.jsx`) stays as a fallback; remove
  it once iOS has Google sign-in.

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
| 2026-10-25 | Redesign follows `docs/design/HANDOVER.md`; mockups are visual specs, not code to copy | Design exploration done with the owner on a design canvas |
| 2026-10-25 | Three app-wide themes (Calm, Arcade, Night shift): same layouts, only tokens change. They replace the four Vacations-only themes | One visual language across the tools; the theme is a personal choice |
| 2026-10-25 | Status colors: green/amber/red mean coverage and work status only. Leave is blue (solid approved, dashed pending, grey draft, dotted requested) | Color should follow priority; holiday stripes were the loudest thing on screen |
| 2026-10-25 | Schedule zoom 3 → 6 → 12 → 18 months (Ctrl + scroll and −/+); operator cards that flip; Sketch tab with Excalidraw | Owner's picks from the design exploration |
| 2026-10-25 | Proposed, not yet planned: admin "All teams" page, roles, multi-team, work-account sign-in | From the handover. Needs a Strategy decision (who is it for) and Build work on auth; Design only builds the look until then |
