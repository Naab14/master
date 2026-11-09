# Requirements

The consolidated product requirements, from the owner's brief of 2026-11-09.
Where this file and older documents disagree (`docs/STRATEGY.md`,
`docs/IDEAS.md`, the backlog), **this file wins**. Progress per requirement
is tracked in [`ROADMAP.md`](ROADMAP.md); the exact resume point is in
[`HANDOFF.md`](HANDOFF.md).

## 1. Purpose

A shift-management and workforce-planning tool for about **40 operators,
3 shifts and 4 line processes**. Highest priority: the **calendar /
scheduling system** and correct **competency-based coverage planning**.

It helps with workforce, vacation and training planning, reviewing monthly
attendance deviations before time is approved in another system, and the
existing shift tasks, logs, boards and overview.

It is **not**: the payroll or time-approval system, a clock-in system, or the
official GMP training, assessment or certification record.

Team leaders allocate daily line positions on a physical whiteboard. Digital
assignments are an optional, admin-toggleable extra, never a prerequisite.

## 2. Rules for the work itself

| Rule | Detail |
| --- | --- |
| Spending | Only usage already included in the owner's accounts. No paid plans, overages, credits, domains or new billable resources without explicit permission. If a service can't be shown to be inside existing allowances, prepare the integration and report it as blocked. |
| Git | One working branch, one draft PR. No stacked or extra PRs. Never push to `main` or merge without the owner's instruction. No force-push or history rewrite. Small commits, pushed often. |
| Data | Never overwrite production data or run destructive migrations without explicit authorization. Demo data uses made-up names. |
| Honesty | Never describe placeholders, mocks or untested behavior as done. |
| Docs | Keep this file, `ROADMAP.md` and `HANDOFF.md` current. No secrets in them. |

## 3. Calendar and shift patterns (C)

- **C1** Two views: people as rows across dates, and a traditional calendar.
- **C2** Compact long-range down to detailed day/time views; smooth zoom and
  density; Today / Week / Month shortcuts.
- **C3** Remember view, filters, zoom and position.
- **C4** Editable repeating patterns per team or operator: fixed, rotating
  and mixed.
- **C5** Change one occurrence, or everything from a chosen date onward.
  Past schedules stay as they were when future patterns change.
- **C6** Each process has its own operating schedule: one, two or three
  shifts, independent of other processes. No hard-coded S1/S2 model.
- **C7** Operators belong to a shift team and pattern; managers oversee team
  leads and operators. Moves between teams are configurable, including
  whether a manager must confirm.
- **C8** Overnight shifts, Swedish local time, daylight-saving changes and
  recurring dates handled consistently.

## 4. Attendance and monthly reports (A)

- **A1** Team leaders record statuses: present, late, sick, vacation, and
  other configurable absence reasons.
- **A2** The regular schedule is the baseline; the monthly review highlights
  deviations, overtime, sickness, vacation, other absence, OB (including OB
  earned on regular shifts), comments and totals.
- **A3** Partial-day exceptions take hours, or start/end times, plus
  comments. A comment alone never invents a duration; incomplete entries are
  flagged.
- **A4** OB is calculated from configurable workplace rules, with guided
  settings and a way to prepare rules from supplied documents/spreadsheets
  for review. No invented collective-agreement rates.
- **A5** Reports: receipt-style individual summary, whole-team summary,
  optional grouping by consultant/permanent, on screen and as PDF.
- **A6** No approval or month-locking. Records stay editable, with a change
  log of who changed what and when, keeping old and new values.

## 5. Operator profiles (P)

- **P1** One shared profile across scheduling, training, competencies and
  vacations. An operator needs no login.
- **P2** Real name, optional nickname, avatar, team and pattern, employment
  type (consultant / permanent), competencies, certifications, planning
  notes.
- **P3** Employment type is filterable/groupable everywhere relevant and
  shown subtly; admin controls how and where the indicator shows.
- **P4** Nickname display is configurable per view; the real identity stays
  easy to find, including in reports.
- **P5** Manual entry and Excel/CSV import with preview, validation and
  duplicate handling.

## 6. Competency matrix and coverage (K)

- **K1** Editable matrix linked to profiles, with configurable levels
  (e.g. Learning, Supervised, Independent, Trainer).
- **K2** Separate certifications; some expire. Validity is judged on the
  date being planned.
- **K3** Staffing requirements per process and shift, optional time-window
  overrides, required numbers, levels and certifications.
- **K4** Seasonal templates (including low season), applied by date range,
  with day/week adjustments.
- **K5** Keep four things separate: what someone is qualified for, when they
  are available, what consumes their time, and whether a requirement can
  really be met. One multi-skilled person never fills several dedicated
  positions at once.
- **K6** Requirement kinds: dedicated line positions, shared support roles
  (where explicitly permitted), and time-consuming tasks (e.g. documentation
  control) with a fixed window or a flexible duration. A flexible task
  reduces capacity without pretending its timing is known; the uncertainty
  is visible.
- **K7** Dynamic groups/filters for people matching skill or certificate
  combinations.
- **K8** Without digital assignments, show *possible* coverage and competing
  demands, never "confirmed" line assignments.
- **K9** Vacation planning shows resulting gaps, qualified replacements,
  whether moving a replacement opens a gap elsewhere, and availability or
  certification issues. The manager decides; no blanket automatic block.

## 7. Training planning (T)

- **T1** Identify skill gaps, plan training, assign trainers, show progress
  and simple completion; highlight training that helps future coverage.
- **T2** A visual planning aid only; formal sign-off stays in the GMP system.
- **T3** How trainees count toward staffing is configurable per process and
  level, including supervision. Trainees and trainers are never assumed to
  be unrestricted capacity.

## 8. Events and existing tools (E)

- **E1** Keep the dashboard and the distinct tools (Shift HQ, Vacations,
  Boards) with their depth.
- **E2** Prominent upcoming calendar activities with weekly/monthly
  recurrence. They are reminders only and never reduce staffing.
- **E3** Earlier roadmap goals that still stand: cross-tool links, shared
  people, coverage warnings on the dashboard, a useful weekly review, clear
  empty states and error messages.

## 9. Design and interaction (D)

- **D1** Professional, calm, polished; one design system across modules.
- **D2** Several complete themes, from cartoon/pop to Notion-like; each user
  picks their own.
- **D3** Thoughtful motion and feedback; collapsible panels; remembered
  preferences; good on computers, phones and large shared screens.
- **D4** Calendar drag-and-drop: clear previews and drop targets, touch
  support, immediate simple moves, confirmation for recurring or
  consequential changes, visible Undo, Ctrl/Cmd+Z, broad keyboard support
  with configurable shortcuts.
- **D5** Respect text-editing undo, focus, accessibility and reduced motion.
  Undo must not overwrite someone else's later change.
- **D6** Details open in a popup/panel with fullscreen expansion; closing
  restores the previous view and scroll position; phone-friendly fullscreen
  details.

## 10. Printing and languages (L)

- **L1** Everything user-facing in English and Swedish, including
  printouts, with matching date, time and number formats.
- **L2** Real A4/A3 print layouts (portrait and landscape where useful) for
  the major planning and reporting views: headings, date ranges, legends,
  sensible page breaks. Not the interactive page with clipped columns.

## 11. Login, permissions, offline (S)

- **S1** Google login. The admin is a specifically configured Google email;
  the first signup never becomes admin automatically.
- **S2** Other accounts get nothing until invited or approved.
- **S3** Admin-configurable permissions (including competency editing and
  team access), **enforced on the server**.
- **S4** Prepared but off: operator access to their own schedule, training
  and competencies, and vacation requests.
- **S5** Offline: last loaded schedule read-only, a clear "Offline — showing
  saved information" banner with last update time in the chosen language,
  editing paused, cached data cleared on sign-out.

## 12. Excalidraw (X)

- **X1** The real open-source Excalidraw embedded: multiple named boards,
  save and reopen, links to events and work items.
- **X2** Live multi-user collaboration, personal boards, in-app invitations,
  existing users and external guests, admin switch for external invites,
  guests limited to boards shared with them.
- **X3** Personal boards are private until shared; no admin bypass.
- **X4** Collaboration hosting assessed honestly; if it needs paid
  infrastructure, report it as blocked.

## 13. Optional AI (AI)

- **AI1** Subtle, optional, configured in admin settings: provider/model,
  server-side key storage, can be disabled and hidden completely.
- **AI2** Clear notice before sending operator or workplace information
  out; no hidden background calls.
- **AI3** Scheduling, OB, coverage, reports and training work without AI.
  No paid AI usage chosen on the owner's behalf; no big chatbot.

## 14. Platforms (W)

- **W1** Web first: a published, responsive app that works well on phones;
  an installable PWA is the preferred first delivery.
- **W2** The SwiftUI app is secondary and must not block the web release.
- **W3** Keep Vercel + Supabase unless there is a concrete need to change.

## 15. Validation scenarios

40 operators over three shifts; four processes with different operating
schedules; low-season demand; multi-skilled operators with conflicting
needs; one hour of documentation during a line shift; partial-day absence
and overtime; expiring certifications; supervised training; overnight
shifts and pattern changes; concurrent edits and offline read-only.

## 16. Open decisions for the owner

| # | Question | Why it matters |
| --- | --- | --- |
| 1 | **Sick and late records.** The 2026-10-27 strategy said *not* to store absence reasons or lateness, because sickness is health data under GDPR and lateness is employee monitoring. This brief asks for both, so they are built. Before entering real people's sick/late records, get your employer's (HR / data protection / union) go-ahead, or use the app with made-up or coded names. | A private hobby app on personal accounts holding colleagues' health data is a real compliance risk for you personally. |
| 2 | Vercel Hobby is for non-commercial use. Daily use by a team at work may need the employer's own account. | Same question as in `STRATEGY.md`; still open. |
| 3 | OB rules: the app ships with **no** rates. Supply your workplace rules (document or spreadsheet) to load them. | We don't invent collective-agreement terms. |
